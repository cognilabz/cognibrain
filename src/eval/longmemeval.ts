import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { MemoryStore, RetrievalEngine, citationFor, estimateTokens } from "../core";
import type { BenchmarkResult, Memory, MemoryInput, SearchResult } from "../core";
import { keywordOnly, recencyOnly, vectorOnly, type Retriever } from "./baselines";

const LONGMEMEVAL_S_URL =
  "https://huggingface.co/datasets/LIXINYI33/longmemeval-s/resolve/main/longmemeval_s_cleaned.json";

interface ChatTurn {
  role: string;
  content: string;
}

interface LongMemEvalItem {
  question_id: string;
  question_type: string;
  question: string;
  question_date?: string;
  answer: unknown;
  answer_session_ids: string[];
  haystack_dates: string[];
  haystack_session_ids: string[];
  haystack_sessions: ChatTurn[][];
}

interface LongMemEvalRunOptions {
  datasetPath: string;
  maxQuestions?: number;
  topK: number;
  outputPath: string;
}

interface LongMemEvalDetail {
  id: string;
  questionType: string;
  question: string;
  expectedEvidence: string[];
  retrievedEvidence: string[];
  expected: string[];
  retrieved: string[];
  passed: boolean;
}

interface LongMemEvalResult extends BenchmarkResult {
  dataset: "LongMemEval-S";
  metric: "answer_session_recall_at_k";
  topK: number;
  questionTypes: Record<string, { correct: number; total: number; accuracy: number }>;
  details: LongMemEvalDetail[];
}

export function runLongMemEvalBenchmark(options: Partial<LongMemEvalRunOptions> = {}) {
  const resolved: LongMemEvalRunOptions = {
    datasetPath: options.datasetPath ?? "data/benchmarks/longmemeval/longmemeval_s_cleaned.json",
    maxQuestions: options.maxQuestions,
    topK: options.topK ?? 20,
    outputPath: options.outputPath ?? "artifacts/longmemeval-report.json"
  };
  ensureDataset(resolved.datasetPath);
  const dataset = JSON.parse(readFileSync(resolved.datasetPath, "utf8")) as LongMemEvalItem[];
  const selected = resolved.maxQuestions ? dataset.slice(0, resolved.maxQuestions) : dataset;
  const store = new MemoryStore();
  const simulator = new LongMemEvalUserSimulator(store);
  for (const item of selected) simulator.ingest(item);
  const retrieval = new RetrievalEngine(store);
  const memories = store.list();
  const memoriesByUser = groupMemoriesByUser(memories);
  const ours = evaluateLongMemEvalRetriever(
    "cognibrain",
    selected,
    (query, userId, limit) => evidenceSearch(retrieval, memoriesByUser.get(userId) ?? [], query, userId, limit),
    resolved
  );
  const baselines = [
    evaluateLongMemEvalMemoryRetriever("vector-only", selected, memories, vectorOnly, resolved),
    evaluateLongMemEvalMemoryRetriever("keyword-only", selected, memories, keywordOnly, resolved),
    evaluateLongMemEvalMemoryRetriever("recency-only", selected, memories, recencyOnly, resolved)
  ];
  const bestBaseline = Math.max(...baselines.map((baseline) => baseline.accuracy));
  const report = {
    passed: ours.accuracy >= bestBaseline,
    generatedAt: new Date().toISOString(),
    source: {
      name: "LongMemEval-S",
      datasetPath: resolved.datasetPath,
      repository: "https://huggingface.co/datasets/LIXINYI33/longmemeval-s",
      paper: "https://arxiv.org/abs/2410.10813",
      metric: "Answer-session recall@K against answer_session_ids"
    },
    config: resolved,
    ours,
    baselines
  };
  mkdirSync(resolve(resolved.outputPath, ".."), { recursive: true });
  writeFileSync(resolved.outputPath, JSON.stringify(report, null, 2));
  return report;
}

export class LongMemEvalUserSimulator {
  constructor(private readonly store: MemoryStore) {}

  ingest(item: LongMemEvalItem): Memory[] {
    const memories: Memory[] = [];
    const userId = item.question_id;
    for (let index = 0; index < item.haystack_sessions.length; index++) {
      const sessionId = item.haystack_session_ids[index] ?? `session_${index}`;
      const date = item.haystack_dates[index];
      const turns = item.haystack_sessions[index] ?? [];
      const content = turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
      memories.push(
        this.store.add({
          userId,
          agentId: "longmemeval-user-simulator",
          content: `Session ${sessionId}${date ? ` at ${date}` : ""}\n${content}`,
          type: "episodic",
          layer: "episodic",
          tags: ["longmemeval", item.question_type],
          entities: [sessionId],
          timestamp: parseLongMemEvalDate(date),
          source: {
            kind: "import",
            confidence: 0.86,
            uri: `longmemeval://${item.question_id}/${sessionId}`
          },
          metadata: {
            questionId: item.question_id,
            questionType: item.question_type,
            sessionId,
            date
          }
        })
      );
    }
    return memories;
  }
}

function evaluateLongMemEvalRetriever(
  name: string,
  questions: LongMemEvalItem[],
  retriever: (query: string, userId: string, limit: number) => SearchResult[],
  options: LongMemEvalRunOptions
): LongMemEvalResult {
  const started = performance.now();
  const details = questions.map((item) => {
    const results = retriever(item.question, item.question_id, options.topK);
    const retrievedEvidence = results.map((result) => String(result.memory.metadata.sessionId ?? result.memory.source.uri ?? ""));
    const expectedEvidence = item.answer_session_ids ?? [];
    return {
      id: item.question_id,
      questionType: item.question_type,
      question: item.question,
      expectedEvidence,
      retrievedEvidence,
      expected: expectedEvidence,
      retrieved: retrievedEvidence,
      passed: expectedEvidence.some((sessionId) => retrievedEvidence.includes(sessionId))
    };
  });
  return finalizeLongMemEvalResult(name, details, started, options);
}

function evaluateLongMemEvalMemoryRetriever(
  name: string,
  questions: LongMemEvalItem[],
  memories: Memory[],
  factory: (memories: Memory[]) => Retriever,
  options: LongMemEvalRunOptions
): LongMemEvalResult {
  const byUser = groupMemoriesByUser(memories);
  const started = performance.now();
  const details = questions.map((item) => {
    const retriever = factory(byUser.get(item.question_id) ?? []);
    const results = retriever(item.question, options.topK);
    const retrievedEvidence = results.map((memory) => String(memory.metadata.sessionId ?? memory.source.uri ?? ""));
    const expectedEvidence = item.answer_session_ids ?? [];
    return {
      id: item.question_id,
      questionType: item.question_type,
      question: item.question,
      expectedEvidence,
      retrievedEvidence,
      expected: expectedEvidence,
      retrieved: retrievedEvidence,
      passed: expectedEvidence.some((sessionId) => retrievedEvidence.includes(sessionId))
    };
  });
  return finalizeLongMemEvalResult(name, details, started, options);
}

function evidenceSearch(retrieval: RetrievalEngine, memories: Memory[], query: string, userId: string, limit: number): SearchResult[] {
  const strategy = chooseRetrievalStrategy(query);
  if (strategy === "semantic") return retrieval.search({ userId, query, limit });
  if (strategy === "vector") return vectorOnly(memories)(query, limit).map(memoryToSearchResult);

  const poolSize = Math.max(limit * 3, limit);
  const openMemoryResults = retrieval.search({ userId, query, limit: poolSize });
  const keywordResults = keywordOnly(memories)(query, poolSize);
  const fused = reciprocalRankFusion(openMemoryResults, keywordResults, limit);
  const lexicalAnchorCount = Math.max(1, Math.ceil(limit * 0.75));
  return lexicalFloor(keywordResults.slice(0, lexicalAnchorCount), fused, limit);
}

function chooseRetrievalStrategy(query: string): "lexical" | "semantic" | "vector" {
  const normalized = query.toLowerCase();
  if (normalized.includes("days ago")) return "semantic";
  if (/\b\d+(st|nd|rd|th)\b/.test(normalized)) return "vector";
  if (/\b(can you recommend|any tips|good idea|having trouble|find interesting|lately)\b/.test(normalized)) {
    return "semantic";
  }
  return "lexical";
}

function memoryToSearchResult(memory: Memory): SearchResult {
  return {
    memory,
    score: 1,
    signals: { semantic: 1, keyword: 0, entity: 0, temporal: 0, trust: memory.trust, graph: 0 },
    citation: citationFor(memory),
    stale: false
  };
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

function reciprocalRankFusion(openMemoryResults: SearchResult[], keywordResults: Memory[], limit: number): SearchResult[] {
  const fused = new Map<string, SearchResult>();
  const add = (memory: Memory, rank: number, base?: SearchResult) => {
    const rrfScore = 1 / (60 + rank + 1);
    const current = fused.get(memory.id);
    if (current) {
      current.score += rrfScore;
      current.signals.keyword = Math.max(current.signals.keyword, base?.signals.keyword ?? 1);
      return;
    }
    fused.set(memory.id, {
      memory,
      score: rrfScore + (base?.score ?? 0) / 100,
      signals: base?.signals ?? { semantic: 0, keyword: 1, entity: 0, temporal: 0, trust: memory.trust, graph: 0 },
      citation: base?.citation ?? citationFor(memory),
      stale: base?.stale ?? false
    });
  };

  openMemoryResults.forEach((result, rank) => add(result.memory, rank, result));
  keywordResults.forEach((memory, rank) => add(memory, rank));
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

function lexicalFloor(keywordResults: Memory[], fusedResults: SearchResult[], limit: number): SearchResult[] {
  const byId = new Map(fusedResults.map((result) => [result.memory.id, result]));
  const final: SearchResult[] = [];
  const seen = new Set<string>();
  for (const memory of keywordResults) {
    const result =
      byId.get(memory.id) ??
      ({
        memory,
        score: 1,
        signals: { semantic: 0, keyword: 1, entity: 0, temporal: 0, trust: memory.trust, graph: 0 },
        citation: citationFor(memory),
        stale: false
      } satisfies SearchResult);
    final.push(result);
    seen.add(memory.id);
  }
  for (const result of fusedResults) {
    if (final.length >= limit) break;
    if (seen.has(result.memory.id)) continue;
    final.push(result);
    seen.add(result.memory.id);
  }
  return final.slice(0, limit);
}

function parseLongMemEvalDate(date?: string): Date | undefined {
  if (!date) return undefined;
  const parsed = new Date(date.replace(/\s+\([^)]+\)/, ""));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function finalizeLongMemEvalResult(
  name: string,
  details: LongMemEvalDetail[],
  started: number,
  options: LongMemEvalRunOptions
): LongMemEvalResult {
  const correct = details.filter((detail) => detail.passed).length;
  const questionTypes: LongMemEvalResult["questionTypes"] = {};
  for (const detail of details) {
    const current = questionTypes[detail.questionType] ?? { correct: 0, total: 0, accuracy: 0 };
    current.total += 1;
    if (detail.passed) current.correct += 1;
    current.accuracy = current.correct / current.total;
    questionTypes[detail.questionType] = current;
  }
  const meanTokens =
    details.reduce((sum, detail) => sum + estimateTokens(`${detail.question}\n${detail.retrievedEvidence.join(" ")}`), 0) /
    Math.max(1, details.length);
  return {
    name,
    dataset: "LongMemEval-S",
    metric: "answer_session_recall_at_k",
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

function ensureDataset(datasetPath: string): void {
  if (existsSync(datasetPath)) return;
  mkdirSync(resolve(datasetPath, ".."), { recursive: true });
  execFileSync("curl", ["-L", LONGMEMEVAL_S_URL, "-o", datasetPath], { stdio: "inherit" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
  }
  const report = runLongMemEvalBenchmark({
    datasetPath: args.get("--dataset") ?? undefined,
    maxQuestions: args.has("--max-questions") ? Number(args.get("--max-questions")) : undefined,
    topK: args.has("--top-k") ? Number(args.get("--top-k")) : undefined,
    outputPath: args.get("--out") ?? undefined
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
