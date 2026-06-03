import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryStore, conceptScore, cosineLike, estimateTokens, extractEntities, keywordCoverage, tokenize } from "../core";
import { createJsonCommandIntelligenceFromEnv } from "../core/providers";
import type { BenchmarkResult, ContextEvidenceJudge, Memory, SearchResult } from "../core";
import { keywordOnly, recencyOnly, vectorOnly, type Retriever } from "./baselines";

const BEAM_ROWS_URL = "https://datasets-server.huggingface.co/rows";

interface BeamRunOptions {
  split: "100K" | "500K" | "1M";
  datasetPath: string;
  maxConversations?: number;
  maxQuestions?: number;
  topK: number;
  outputPath: string;
  evidenceJudge?: ContextEvidenceJudge;
  requireEvidenceJudge?: boolean;
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
  judge: {
    mode: "abstention" | "rubric_support";
    threshold: number;
    evidenceSupport: number;
    entitySupport: number;
    weakness?: string;
  };
}

interface BeamResult extends BenchmarkResult {
  dataset: "BEAM";
  metric: "retrieval_nugget_score_at_k";
  split: string;
  topK: number;
  questionTypes: Record<string, { correct: number; total: number; accuracy: number }>;
  weaknesses: Array<{ category: string; accuracy: number; gapToBestCategory: number; recommendation: string }>;
  judge: { kind: "provider-evidence-support" | "deterministic-rubric-support"; threshold: number; notes: string[] };
  details: BeamDetail[];
}

type BeamProof = "local-diagnostic" | "llm-harness";

export async function runBeamBenchmark(options: Partial<BeamRunOptions> = {}) {
  const resolved: BeamRunOptions = {
    split: options.split ?? "100K",
    datasetPath: options.datasetPath ?? `data/benchmarks/beam/beam-${options.split ?? "100K"}.json`,
    maxConversations: options.maxConversations,
    maxQuestions: options.maxQuestions,
    topK: options.topK ?? 20,
    outputPath: options.outputPath ?? "artifacts/beam-report.json",
    evidenceJudge: options.evidenceJudge,
    requireEvidenceJudge: options.requireEvidenceJudge
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
  const evidenceJudge = resolved.evidenceJudge ?? createJsonCommandIntelligenceFromEnv();
  if (resolved.requireEvidenceJudge && !evidenceJudge) {
    throw new Error("BEAM evidence judge is required but MEMORY_INTELLIGENCE_COMMAND is not configured");
  }
  const ours = evaluateBeamRetriever(
    "cognibrain",
    selectedQuestions,
    (question, userId, limit) => beamSearch(question, byUser.get(userId) ?? [], limit),
    resolved,
    expansionIndex,
    evidenceJudge
  );
  const baselines = [
    evaluateBeamMemoryRetriever("vector-only", selectedQuestions, memories, vectorOnly, resolved),
    evaluateBeamMemoryRetriever("keyword-only", selectedQuestions, memories, keywordOnly, resolved),
    evaluateBeamMemoryRetriever("recency-only", selectedQuestions, memories, recencyOnly, resolved)
  ];
  const bestBaseline = Math.max(...baselines.map((baseline) => baseline.accuracy));
  const diagnosticPassed = ours.accuracy > bestBaseline;
  const qualityClaimAllowed = Boolean(evidenceJudge);
  const proof: BeamProof = qualityClaimAllowed ? "llm-harness" : "local-diagnostic";
  const report = {
    passed: qualityClaimAllowed && diagnosticPassed,
    diagnosticPassed,
    proof,
    qualityClaimAllowed,
    marketClaimAllowed: false,
    claimBoundary: {
      scorer: qualityClaimAllowed ? "provider-evidence-support" : "beam-rubric-support-diagnostic",
      qualityClaimAllowed,
      marketClaimAllowed: false,
      claimBlockers: qualityClaimAllowed ? [] : [
        "BEAM deterministic rubric/entity/evidence-support scoring is diagnostic only.",
        "Quality claims require MEMORY_INTELLIGENCE_COMMAND or an equivalent LLM/harness evidence judge."
      ]
    },
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
    config: {
      split: resolved.split,
      datasetPath: resolved.datasetPath,
      maxConversations: resolved.maxConversations,
      maxQuestions: resolved.maxQuestions,
      topK: resolved.topK,
      outputPath: resolved.outputPath,
      evidenceJudgeRequired: Boolean(resolved.requireEvidenceJudge),
      evidenceJudgeConfigured: Boolean(evidenceJudge)
    },
    judge: {
      kind: qualityClaimAllowed ? "provider-evidence-support" : "deterministic-rubric-support",
      status: qualityClaimAllowed ? "passed" : "diagnostic-only"
    },
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
  expansionIndex?: Map<string, string[]>,
  evidenceJudge?: ContextEvidenceJudge
): BeamResult {
  const started = performance.now();
  const details = questions.map((question) => {
    const results = retriever(question.question, question.conversationId, options.topK);
    return scoreBeamQuestion(question, results, expansionIndex, evidenceJudge);
  });
  return finalizeBeamResult(name, details, started, options, Boolean(evidenceJudge));
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
  return finalizeBeamResult(name, details, started, options, false);
}

function beamSearch(query: string, memories: Memory[], limit: number): Memory[] {
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
      return {
        memory,
        score: semantic * 0.38 + keyword * 0.34 + entity * 0.14 + trust * 0.08
      };
    })
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.memory);
}

function scoreBeamQuestion(question: BeamQuestion, memories: Memory[], expansionIndex?: Map<string, string[]>, evidenceJudge?: ContextEvidenceJudge): BeamDetail {
  const retrievedText = memories
    .flatMap((memory) => expansionIndex?.get(memory.id) ?? [memory.content])
    .join("\n");
  const retrieved = memories.map((memory) => String(memory.metadata.sourceIndex ?? memory.metadata.turnIndex ?? memory.id));
  const expected = nuggetTexts(question);
  const judged = evidenceJudge
    ? providerBeamScore(evidenceJudge, question, memories, expected)
    : question.abstention
      ? abstentionScore(question.question, retrievedText, memories.length)
      : bestNuggetScore(expected, retrievedText);
  return {
    id: question.id,
    category: question.category,
    question: question.question,
    expected,
    retrieved,
    score: judged.score,
    passed: judged.score >= judged.threshold,
    judge: {
      mode: question.abstention ? "abstention" : "rubric_support",
      threshold: judged.threshold,
      evidenceSupport: judged.evidenceSupport,
      entitySupport: judged.entitySupport,
      weakness: judged.weakness
    }
  };
}

function providerBeamScore(evidenceJudge: ContextEvidenceJudge, question: BeamQuestion, memories: Memory[], expected: string[]): { score: number; threshold: number; evidenceSupport: number; entitySupport: number; weakness?: string } {
  const query = question.abstention
    ? `Can the retrieved evidence answer this question? Question: ${question.question}`
    : `Does the retrieved evidence support the expected answer rubric? Question: ${question.question}\nExpected answer/rubric:\n${expected.join("\n")}`;
  const judgement = evidenceJudge.judgeEvidence({ query, results: memories.map(memoryAsSearchResult), now: new Date() });
  const supports = question.abstention ? !judgement.answerable : judgement.answerable;
  const confidence = Math.max(0, Math.min(1, judgement.confidence));
  return {
    score: supports ? confidence : 1 - confidence,
    threshold: 0.72,
    evidenceSupport: judgement.answerable ? confidence : 1 - confidence,
    entitySupport: confidence,
    weakness: supports ? undefined : judgement.reason ?? "provider judged retrieved evidence insufficient"
  };
}

function memoryAsSearchResult(memory: Memory): SearchResult {
  return {
    memory,
    score: 1,
    decision: "include",
    signals: { semantic: 1, keyword: 1, entity: 1, temporal: 1, trust: memory.trust, graph: 0 },
    citation: `beam:${String(memory.metadata.sourceIndex ?? memory.metadata.turnIndex ?? memory.id)}`,
    stale: false
  };
}

function bestNuggetScore(expected: string[], retrievedText: string): { score: number; threshold: number; evidenceSupport: number; entitySupport: number; weakness?: string } {
  const retrieved = new Set(tokenize(retrievedText));
  let best = { score: 0, threshold: 0.62, evidenceSupport: 0, entitySupport: 0, weakness: "missing rubric support" as string | undefined };
  for (const nugget of expected) {
    const tokens = tokenize(nugget).filter((token) => !QUESTION_NOISE.has(token));
    if (!tokens.length) continue;
    const tokenSupport = tokens.filter((token) => retrieved.has(token)).length / tokens.length;
    const semanticSupport = conceptScore(retrievedText, [nugget]).score;
    const expectedEntities = extractEntities(nugget);
    const retrievedEntities = new Set(extractEntities(retrievedText));
    const entitySupport = expectedEntities.length ? expectedEntities.filter((entity) => retrievedEntities.has(entity)).length / expectedEntities.length : tokenSupport;
    const evidenceSupport = Math.max(tokenSupport, semanticSupport);
    const score = evidenceSupport * 0.72 + entitySupport * 0.28;
    if (score > best.score) {
      best = { score, threshold: 0.62, evidenceSupport, entitySupport, weakness: weaknessFor(score, evidenceSupport, entitySupport) };
    }
  }
  return best;
}

function abstentionScore(question: string, retrievedText: string, retrievedCount: number): { score: number; threshold: number; evidenceSupport: number; entitySupport: number; weakness?: string } {
  const questionTokens = new Set(tokenize(question).filter((token) => !QUESTION_NOISE.has(token)));
  if (questionTokens.size === 0 || retrievedCount === 0) return { score: 1, threshold: 0.72, evidenceSupport: 0, entitySupport: 0 };
  const retrieved = new Set(tokenize(retrievedText));
  const hits = [...questionTokens].filter((token) => retrieved.has(token)).length;
  const evidenceSupport = hits / questionTokens.size;
  const entitySupport = conceptScore(retrievedText, [question]).score;
  const unsupported = 1 - Math.max(evidenceSupport, entitySupport);
  return {
    score: unsupported,
    threshold: 0.72,
    evidenceSupport,
    entitySupport,
    weakness: unsupported >= 0.72 ? undefined : "retrieved plausible evidence for an unanswerable question"
  };
}

function nuggetTexts(question: BeamQuestion): string[] {
  return [question.idealResponse, ...question.rubric].filter(Boolean);
}

function finalizeBeamResult(name: string, details: BeamDetail[], started: number, options: BeamRunOptions, providerDriven: boolean): BeamResult {
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
    weaknesses: beamWeaknesses(questionTypes),
    judge: {
      kind: providerDriven ? "provider-evidence-support" : "deterministic-rubric-support",
      threshold: providerDriven ? 0.72 : 0.62,
      notes: providerDriven
        ? [
            "Answerability and rubric support are judged by the configured MEMORY_INTELLIGENCE_COMMAND evidence task.",
            "The benchmark harness passes retrieved memories and expected rubric context to the provider; no category-specific regex is used for the provider path."
          ]
        : [
            "Answerable questions require rubric support from retrieved evidence instead of exact expected-string matches.",
            "Abstention questions are scored by unsupported-evidence behavior; the retriever does not receive hard-coded unanswerable phrase patterns."
          ]
    },
    details
  };
}

function weaknessFor(score: number, evidenceSupport: number, entitySupport: number): string | undefined {
  if (score >= 0.62) return undefined;
  if (entitySupport < 0.35) return "missing named entity or source-specific evidence";
  if (evidenceSupport < 0.45) return "retrieved context weakly supports rubric";
  return "partial rubric support below threshold";
}

function beamWeaknesses(questionTypes: BeamResult["questionTypes"]): BeamResult["weaknesses"] {
  const entries = Object.entries(questionTypes);
  const best = Math.max(...entries.map(([, value]) => value.accuracy), 0);
  return entries
    .map(([category, value]) => ({
      category,
      accuracy: value.accuracy,
      gapToBestCategory: Math.max(0, best - value.accuracy),
      recommendation: recommendationForBeamCategory(category, value.accuracy, best)
    }))
    .filter((item) => item.gapToBestCategory >= 0.05 || item.accuracy < 0.9)
    .sort((a, b) => b.gapToBestCategory - a.gapToBestCategory || a.accuracy - b.accuracy);
}

function recommendationForBeamCategory(category: string, accuracy: number, best: number): string {
  if (category === "abstention") return "Improve unsupported-question detection and require stronger source support before retrieving context.";
  if (category === "information_extraction") return "Improve entity anchoring and exact evidence localization for factual lookup questions.";
  if (category === "temporal_reasoning") return "Improve temporal normalization and event-order evidence retrieval.";
  if (category === "multi_session_reasoning") return "Improve cross-session evidence stitching and reduce distractor context.";
  if (best - accuracy >= 0.05) return "Inspect failed cases for missing rubric evidence and category-specific distractors.";
  return "Monitor category; no large weakness relative to the current split.";
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
          conceptScore(String(record.ideal_response ?? ""), ["no answer is available in the provided conversation", "the chat does not contain enough information"]).score >= 0.52 ||
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  const report = await runBeamBenchmark({
    split: (args.get("--split") as BeamRunOptions["split"]) ?? undefined,
    datasetPath: args.get("--dataset") ?? undefined,
    maxConversations: args.has("--max-conversations") ? Number(args.get("--max-conversations")) : undefined,
    maxQuestions: args.has("--max-questions") ? Number(args.get("--max-questions")) : undefined,
    topK: args.has("--top-k") ? Number(args.get("--top-k")) : undefined,
    outputPath: args.get("--out") ?? undefined,
    requireEvidenceJudge: args.has("--require-evidence-judge")
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed || (!args.has("--strict") && report.diagnosticPassed) ? 0 : 1);
}

function parseCliArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}
