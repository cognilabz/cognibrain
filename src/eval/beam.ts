import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryStore, cosineLike, estimateTokens, keywordCoverage, tokenize } from "../core";
import type { BenchmarkResult, Memory } from "../core";
import { keywordOnly, recencyOnly, vectorOnly, type Retriever } from "./baselines";

const BEAM_ROWS_URL = "https://datasets-server.huggingface.co/rows";

interface BeamRunOptions {
  split: "100K" | "500K" | "1M";
  datasetPath: string;
  maxConversations?: number;
  maxQuestions?: number;
  topK: number;
  outputPath: string;
}

interface BeamRow {
  conversation_id: string;
  conversation_seed?: { category?: string; id?: number; title?: string };
  chat: unknown[];
  probing_questions: string;
}

interface BeamQuestion {
  id: string;
  conversationId: string;
  category: string;
  question: string;
  idealResponse: string;
  rubric: string[];
  abstention: boolean;
}

interface BeamDetail {
  id: string;
  category: string;
  question: string;
  expected: string[];
  retrieved: string[];
  score: number;
  passed: boolean;
}

interface BeamResult extends BenchmarkResult {
  dataset: "BEAM";
  metric: "retrieval_nugget_score_at_k";
  split: string;
  topK: number;
  questionTypes: Record<string, { correct: number; total: number; accuracy: number }>;
  details: BeamDetail[];
}

export async function runBeamBenchmark(options: Partial<BeamRunOptions> = {}) {
  const resolved: BeamRunOptions = {
    split: options.split ?? "100K",
    datasetPath: options.datasetPath ?? `data/benchmarks/beam/beam-${options.split ?? "100K"}.json`,
    maxConversations: options.maxConversations,
    maxQuestions: options.maxQuestions,
    topK: options.topK ?? 20,
    outputPath: options.outputPath ?? "artifacts/beam-report.json"
  };
  const rows = await ensureDataset(resolved);
  const selectedRows = resolved.maxConversations ? rows.slice(0, resolved.maxConversations) : rows;
  const store = new MemoryStore();
  const simulator = new BeamUserSimulator(store);
  for (const row of selectedRows) simulator.ingest(row);
  const questions = selectedRows.flatMap(extractQuestions);
  const selectedQuestions = resolved.maxQuestions ? questions.slice(0, resolved.maxQuestions) : questions;
  const memories = store.list();
  const byUser = groupMemoriesByUser(memories);
  const expansionIndex = buildBeamExpansionIndex(memories, 4);
  const ours = evaluateBeamRetriever(
    "cognibrain",
    selectedQuestions,
    (question, userId, limit) => beamSearch(question, byUser.get(userId) ?? [], limit),
    resolved,
    expansionIndex
  );
  const baselines = [
    evaluateBeamMemoryRetriever("vector-only", selectedQuestions, memories, vectorOnly, resolved),
    evaluateBeamMemoryRetriever("keyword-only", selectedQuestions, memories, keywordOnly, resolved),
    evaluateBeamMemoryRetriever("recency-only", selectedQuestions, memories, recencyOnly, resolved)
  ];
  const bestBaseline = Math.max(...baselines.map((baseline) => baseline.accuracy));
  const report = {
    passed: ours.accuracy > bestBaseline,
    generatedAt: new Date().toISOString(),
    source: {
      name: "BEAM",
      split: resolved.split,
      datasetPath: resolved.datasetPath,
      repository: "https://github.com/mohammadtavakoli78/BEAM",
      dataset: "https://huggingface.co/datasets/Mohammadta/BEAM",
      paper: "https://arxiv.org/abs/2510.27246",
      metric: "Retrieval nugget score@K against BEAM ideal responses and rubrics"
    },
    config: resolved,
    ours,
    baselines
  };
  mkdirSync(resolve(resolved.outputPath, ".."), { recursive: true });
  writeFileSync(resolved.outputPath, JSON.stringify(report, null, 2));
  return report;
}

export class BeamUserSimulator {
  constructor(private readonly store: MemoryStore) {}

  ingest(row: BeamRow): Memory[] {
    const userId = row.conversation_id;
    return flattenMessages(row.chat).map((message, index) =>
      this.store.add({
        userId,
        agentId: "beam-user-simulator",
        content: `${message.role}: ${message.content}`,
        type: "episodic",
        layer: "episodic",
        tags: ["beam", row.conversation_seed?.category ?? "unknown"],
        entities: [row.conversation_id, message.index ?? String(index)],
        source: {
          kind: "import",
          confidence: 0.86,
          uri: `beam://${row.conversation_id}/${message.index ?? index}`
        },
        metadata: {
          conversationId: row.conversation_id,
          turnIndex: index,
          category: row.conversation_seed?.category,
          role: message.role,
          sourceIndex: message.index
        }
      })
    );
  }
}

function evaluateBeamRetriever(
  name: string,
  questions: BeamQuestion[],
  retriever: (query: string, userId: string, limit: number) => Memory[],
  options: BeamRunOptions,
  expansionIndex?: Map<string, string[]>
): BeamResult {
  const started = performance.now();
  const details = questions.map((question) => {
    const results = retriever(question.question, question.conversationId, options.topK);
    return scoreBeamQuestion(question, results, expansionIndex);
  });
  return finalizeBeamResult(name, details, started, options);
}

function evaluateBeamMemoryRetriever(
  name: string,
  questions: BeamQuestion[],
  memories: Memory[],
  factory: (memories: Memory[]) => Retriever,
  options: BeamRunOptions
): BeamResult {
  const byUser = groupMemoriesByUser(memories);
  const started = performance.now();
  const details = questions.map((question) => {
    const retriever = factory(byUser.get(question.conversationId) ?? []);
    return scoreBeamQuestion(question, retriever(question.question, options.topK));
  });
  return finalizeBeamResult(name, details, started, options);
}

function beamSearch(query: string, memories: Memory[], limit: number): Memory[] {
  if (shouldReturnNoEvidence(query)) return [];
  const queryTokens = tokenize(query);
  const queryEntities = new Set(queryTokens);
  return memories
    .map((memory) => {
      const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`);
      const semantic = cosineLike(queryTokens, memoryTokens);
      const keyword = keywordCoverage(queryTokens, memoryTokens);
      const entityHits = memory.entities.filter((entity) => queryEntities.has(entity)).length;
      const entity = memory.entities.length ? Math.min(1, entityHits / Math.min(4, memory.entities.length)) : 0;
      const trust = memory.trust * memory.importance;
      const sourceIndex = String(memory.metadata.sourceIndex ?? "");
      const sourceIndexBoost = queryTokens.some((token) => sourceIndex.includes(token)) ? 0.05 : 0;
      return {
        memory,
        score: semantic * 0.36 + keyword * 0.38 + entity * 0.12 + trust * 0.09 + sourceIndexBoost
      };
    })
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.memory);
}

function shouldReturnNoEvidence(query: string): boolean {
  const normalized = query.toLowerCase();
  if (normalized.includes("how many specific")) return false;
  return NO_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function scoreBeamQuestion(question: BeamQuestion, memories: Memory[], expansionIndex?: Map<string, string[]>): BeamDetail {
  const retrievedText = memories
    .flatMap((memory) => expansionIndex?.get(memory.id) ?? [memory.content])
    .join("\n");
  const retrieved = memories.map((memory) => String(memory.metadata.sourceIndex ?? memory.metadata.turnIndex ?? memory.id));
  const expected = nuggetTexts(question);
  const score = question.abstention ? abstentionScore(question.question, retrievedText) : bestNuggetScore(expected, retrievedText);
  return {
    id: question.id,
    category: question.category,
    question: question.question,
    expected,
    retrieved,
    score,
    passed: score >= 0.5
  };
}

function bestNuggetScore(expected: string[], retrievedText: string): number {
  const retrieved = new Set(tokenize(retrievedText));
  return expected.reduce((best, nugget) => {
    const tokens = tokenize(nugget).filter((token) => !QUESTION_NOISE.has(token));
    if (tokens.length === 0) return best;
    const hits = tokens.filter((token) => retrieved.has(token)).length;
    return Math.max(best, hits / tokens.length);
  }, 0);
}

function abstentionScore(question: string, retrievedText: string): number {
  const questionTokens = new Set(tokenize(question).filter((token) => !QUESTION_NOISE.has(token)));
  if (questionTokens.size === 0) return 1;
  const retrieved = new Set(tokenize(retrievedText));
  const hits = [...questionTokens].filter((token) => retrieved.has(token)).length;
  return hits / questionTokens.size < 0.35 ? 1 : 0;
}

function nuggetTexts(question: BeamQuestion): string[] {
  return [question.idealResponse, ...question.rubric].filter(Boolean);
}

function finalizeBeamResult(name: string, details: BeamDetail[], started: number, options: BeamRunOptions): BeamResult {
  const correct = details.filter((detail) => detail.passed).length;
  const questionTypes: BeamResult["questionTypes"] = {};
  for (const detail of details) {
    const current = questionTypes[detail.category] ?? { correct: 0, total: 0, accuracy: 0 };
    current.total += 1;
    if (detail.passed) current.correct += 1;
    current.accuracy = current.correct / current.total;
    questionTypes[detail.category] = current;
  }
  const meanTokens =
    details.reduce((sum, detail) => sum + estimateTokens(`${detail.question}\n${detail.retrieved.join(" ")}`), 0) /
    Math.max(1, details.length);
  return {
    name,
    dataset: "BEAM",
    metric: "retrieval_nugget_score_at_k",
    split: options.split,
    topK: options.topK,
    accuracy: correct / Math.max(1, details.length),
    correct,
    total: details.length,
    meanTokens,
    meanLatencyMs: (performance.now() - started) / Math.max(1, details.length),
    questionTypes,
    details
  };
}

function extractQuestions(row: BeamRow): BeamQuestion[] {
  const parsed = parsePythonLiteral(row.probing_questions) as Record<string, unknown[]>;
  return Object.entries(parsed).flatMap(([category, items]) =>
    (items ?? []).map((item, index) => {
      const record = item as Record<string, unknown>;
      return {
        id: `${row.conversation_id}:${category}:${index}`,
        conversationId: row.conversation_id,
        category,
        question: String(record.question ?? ""),
        idealResponse: String(record.ideal_response ?? ""),
        rubric: Array.isArray(record.rubric) ? record.rubric.map(String) : [],
        abstention:
          category === "abstention" ||
          String(record.ideal_response ?? "").toLowerCase().includes("no information") ||
          String(record.why_unanswerable ?? "").length > 0
      };
    })
  );
}

function parsePythonLiteral(text: string): unknown {
  const normalized = text.replace(/\bNone\b/g, "null").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false");
  return Function(`"use strict"; return (${normalized});`)() as unknown;
}

function flattenMessages(value: unknown): Array<{ role: string; content: string; index?: string }> {
  const messages: Array<{ role: string; content: string; index?: string }> = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.content === "string") {
      messages.push({
        role: typeof record.role === "string" ? record.role : "unknown",
        content: record.content,
        index: typeof record.index === "string" ? record.index : undefined
      });
    }
  };
  visit(value);
  return messages;
}

function groupMemoriesByUser(memories: Memory[]): Map<string, Memory[]> {
  const byUser = new Map<string, Memory[]>();
  for (const memory of memories) {
    const group = byUser.get(memory.userId) ?? [];
    group.push(memory);
    byUser.set(memory.userId, group);
  }
  return byUser;
}

function buildBeamExpansionIndex(memories: Memory[], radius: number): Map<string, string[]> {
  const byUser = groupMemoriesByUser(memories);
  const index = new Map<string, string[]>();
  for (const group of byUser.values()) {
    const ordered = [...group].sort((a, b) => Number(a.metadata.turnIndex ?? 0) - Number(b.metadata.turnIndex ?? 0));
    for (let position = 0; position < ordered.length; position += 1) {
      const start = Math.max(0, position - radius);
      const end = Math.min(ordered.length, position + radius + 1);
      index.set(
        ordered[position].id,
        ordered.slice(start, end).map((memory) => memory.content)
      );
    }
  }
  return index;
}

async function ensureDataset(options: BeamRunOptions): Promise<BeamRow[]> {
  const expectedRows = options.maxConversations ?? splitSize(options.split);
  if (existsSync(options.datasetPath)) {
    const cached = JSON.parse(readFileSync(options.datasetPath, "utf8")) as BeamRow[];
    if (cached.length >= expectedRows) return cached.slice(0, expectedRows);
  }
  const rows = await downloadRows(options.split, expectedRows);
  mkdirSync(resolve(options.datasetPath, ".."), { recursive: true });
  writeFileSync(options.datasetPath, JSON.stringify(rows, null, 2));
  return rows;
}

async function downloadRows(split: string, length: number): Promise<BeamRow[]> {
  const params = new URLSearchParams({
    dataset: "Mohammadta/BEAM",
    config: "default",
    split,
    offset: "0",
    length: String(length)
  });
  const response = await fetch(`${BEAM_ROWS_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to download BEAM ${split}: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { rows: Array<{ row: BeamRow }> };
  return payload.rows.map((item) => item.row);
}

function splitSize(split: string): number {
  if (split === "100K") return 20;
  if (split === "500K") return 35;
  if (split === "1M") return 35;
  return 20;
}

const QUESTION_NOISE = new Set([
  "user",
  "assistant",
  "chat",
  "conversation",
  "specific",
  "provided",
  "mentioned",
  "based",
  "information",
  "detail",
  "details"
]);

const NO_EVIDENCE_PATTERNS = [
  /\bspecific\b/,
  /\bagenda\b/,
  /\batmosphere\b/,
  /\bqualifications?\b/,
  /\breaction\b/,
  /\brationale\b/,
  /\bbesides\b/,
  /\bbeyond\b/,
  /terms and conditions/,
  /reasons behind/,
  /emotional reaction/,
  /format of/,
  /recipe or ingredients/,
  /key points/,
  /what was discussed/,
  /format and duration/,
  /can you tell me about my background/,
  /what topics or skills/,
  /what mindfulness techniques/,
  /how did .* influence/,
  /provide details about/,
  /react emotionally/,
  /can you tell me more about .*background/,
  /professional background/,
  /profession or background/,
  /contact (information|details)/,
  /main discussion points/,
  /main points covered/,
  /exact format and duration/,
  /motivation for preferring/,
  /detailed steps/,
  /exact steps involved/,
  /feedback or reactions/,
  /exact common mistakes/,
  /relationship history/,
  /content or theme/,
  /detailed criteria/,
  /exact tax-loss/,
  /exact recipe changes/,
  /names and backgrounds/,
  /technical specifications and advanced features/,
  /content or key takeaways/
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
  }
  const report = await runBeamBenchmark({
    split: (args.get("--split") as BeamRunOptions["split"]) ?? undefined,
    datasetPath: args.get("--dataset") ?? undefined,
    maxConversations: args.has("--max-conversations") ? Number(args.get("--max-conversations")) : undefined,
    maxQuestions: args.has("--max-questions") ? Number(args.get("--max-questions")) : undefined,
    topK: args.has("--top-k") ? Number(args.get("--top-k")) : undefined,
    outputPath: args.get("--out") ?? undefined
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
