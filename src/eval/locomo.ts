import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { MemoryStore, RetrievalEngine, estimateTokens } from "../core";
import type { BenchmarkResult, Memory, MemoryInput, SearchResult } from "../core";
import { keywordOnly, recencyOnly, vectorOnly, type Retriever } from "./baselines";

const LOCOMO_DATASET_URL = "https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json";

interface LocomoTurn {
  speaker: string;
  dia_id: string;
  text: string;
  blip_caption?: string;
  img_url?: string;
}

interface LocomoQa {
  question: string;
  answer: string;
  evidence?: string[];
  category: number;
}

interface LocomoSample {
  sample_id: string;
  qa: LocomoQa[];
  conversation: Record<string, unknown>;
  observation?: Record<string, string>;
  session_summary?: Record<string, string>;
}

interface LocomoRunOptions {
  datasetPath: string;
  maxQuestions?: number;
  topK: number;
  includeSummaries: boolean;
  outputPath: string;
}

interface LocomoDetail {
  id: string;
  sampleId: string;
  category: number;
  question: string;
  answer: string;
  expectedEvidence: string[];
  retrievedEvidence: string[];
  expected: string[];
  retrieved: string[];
  passed: boolean;
  topScore: number;
}

interface LocomoResult extends BenchmarkResult {
  dataset: string;
  metric: "evidence_recall_at_k";
  topK: number;
  categories: Record<string, { correct: number; total: number; accuracy: number }>;
  details: LocomoDetail[];
}

export function runLocomoBenchmark(options: Partial<LocomoRunOptions> = {}) {
  const resolved: LocomoRunOptions = {
    datasetPath: options.datasetPath ?? "data/benchmarks/locomo/locomo10.json",
    maxQuestions: options.maxQuestions,
    topK: options.topK ?? 5,
    includeSummaries: options.includeSummaries ?? true,
    outputPath: options.outputPath ?? "artifacts/locomo-report.json"
  };
  ensureDataset(resolved.datasetPath);
  const samples = JSON.parse(readFileSync(resolved.datasetPath, "utf8")) as LocomoSample[];
  const store = new MemoryStore();
  const simulator = new LocomoUserSimulator(store);
  for (const sample of samples) simulator.ingest(sample, { includeSummaries: resolved.includeSummaries });

  const questions = samples.flatMap((sample) =>
    sample.qa
      .filter((qa) => qa.category !== 5 && qa.evidence?.length)
      .map((qa, index) => ({ sample, qa, index }))
  );
  const selected = resolved.maxQuestions ? questions.slice(0, resolved.maxQuestions) : questions;
  const retrieval = new RetrievalEngine(store);
  const memories = store.list();

  const ours = evaluateLocomoRetriever(
    "cognibrain",
    selected,
    (query, userId, limit) => evidenceSearch(retrieval, query, userId, limit),
    resolved
  );
  const baselines = [
    evaluateLocomoMemoryRetriever("vector-only", selected, memories, vectorOnly, resolved),
    evaluateLocomoMemoryRetriever("keyword-only", selected, memories, keywordOnly, resolved),
    evaluateLocomoMemoryRetriever("recency-only", selected, memories, recencyOnly, resolved)
  ];
  const bestBaseline = Math.max(...baselines.map((baseline) => baseline.accuracy));
  const diagnosticPassed = ours.accuracy > bestBaseline;
  const claimBoundary = publicDatasetIdRecallBoundary(
    "locomo-evidence-id-recall-diagnostic",
    "LoCoMo evidence-id recall uses dialog IDs as retrieval diagnostics; it is not an LLM/harness quality judge."
  );
  const report = {
    passed: diagnosticPassed,
    diagnosticPassed,
    proof: claimBoundary.proof,
    qualityClaimAllowed: claimBoundary.qualityClaimAllowed,
    judge: claimBoundary.judge,
    claimBoundary,
    generatedAt: new Date().toISOString(),
    source: {
      name: "LoCoMo",
      datasetPath: resolved.datasetPath,
      repository: "https://github.com/snap-research/locomo",
      paper: "https://arxiv.org/abs/2402.17753",
      metric: "Evidence recall@K against LoCoMo QA evidence dialog ids"
    },
    config: resolved,
    ours,
    baselines
  };
  mkdirSync(resolve(resolved.outputPath, ".."), { recursive: true });
  writeFileSync(resolved.outputPath, JSON.stringify(report, null, 2));
  return report;
}

export class LocomoUserSimulator {
  constructor(private readonly store: MemoryStore) {}

  ingest(sample: LocomoSample, options: { includeSummaries: boolean }): Memory[] {
    const userId = sample.sample_id;
    const memories: Memory[] = [];
    const speakerA = String(sample.conversation.speaker_a ?? "speaker_a");
    const speakerB = String(sample.conversation.speaker_b ?? "speaker_b");
    memories.push(
      this.store.add({
        userId,
        content: `Conversation participants: ${speakerA} and ${speakerB}.`,
        type: "reference",
        layer: "long_term",
        tags: ["locomo", "participants"],
        entities: [speakerA, speakerB],
        source: locomoSource(sample.sample_id, "participants")
      })
    );

    for (const sessionId of sessionIds(sample)) {
      const timestamp = parseLocomoDate(String(sample.conversation[`${sessionId}_date_time`] ?? ""));
      const turns = sample.conversation[sessionId] as LocomoTurn[];
      for (const turn of turns) {
        const imageText = turn.blip_caption ? ` Image caption: ${turn.blip_caption}` : "";
        memories.push(
          this.store.add({
            userId,
            agentId: "locomo-user-simulator",
            content: `${turn.speaker} said on ${timestamp.toISOString().slice(0, 10)}: ${turn.text}${imageText}`,
            type: "episodic",
            layer: "episodic",
            tags: ["locomo", sessionId, `category-source`],
            entities: [turn.speaker, turn.dia_id, sessionId],
            timestamp,
            source: locomoSource(sample.sample_id, turn.dia_id),
            metadata: { sampleId: sample.sample_id, sessionId, diaId: turn.dia_id }
          })
        );
      }
      if (options.includeSummaries) {
        const summary = sample.session_summary?.[`${sessionId}_summary`];
        if (summary) {
          memories.push(
            this.store.add({
              userId,
              content: `Session ${sessionId} summary: ${summary}`,
              type: "reference",
              layer: "reflection",
              tags: ["locomo", "summary", sessionId],
              entities: [sessionId, speakerA, speakerB],
              timestamp,
              source: locomoSource(sample.sample_id, `${sessionId}_summary`),
              metadata: { sampleId: sample.sample_id, sessionId, summary: true }
            })
          );
        }
      }
    }
    return memories;
  }
}

function evaluateLocomoRetriever(
  name: string,
  questions: Array<{ sample: LocomoSample; qa: LocomoQa; index: number }>,
  retriever: (query: string, userId: string, limit: number) => SearchResult[],
  options: LocomoRunOptions
): LocomoResult {
  const started = performance.now();
  const details = questions.map(({ sample, qa, index }) => {
    const results = retriever(questionText(qa), sample.sample_id, options.topK);
    const retrievedEvidence = results.map((result) => String(result.memory.metadata.diaId ?? result.memory.source.uri ?? ""));
    const expectedEvidence = qa.evidence ?? [];
    const passed = expectedEvidence.some((evidence) => retrievedEvidence.includes(evidence));
    return {
      id: `${sample.sample_id}:${index}`,
      sampleId: sample.sample_id,
      category: qa.category,
      question: qa.question,
      answer: qa.answer,
      expectedEvidence,
      retrievedEvidence,
      expected: expectedEvidence,
      retrieved: retrievedEvidence,
      passed,
      topScore: results[0]?.score ?? 0
    };
  });
  return finalizeLocomoResult(name, details, started, options);
}

function evaluateLocomoMemoryRetriever(
  name: string,
  questions: Array<{ sample: LocomoSample; qa: LocomoQa; index: number }>,
  memories: Memory[],
  factory: (memories: Memory[]) => Retriever,
  options: LocomoRunOptions
): LocomoResult {
  const byUser = new Map<string, Memory[]>();
  for (const memory of memories) {
    const group = byUser.get(memory.userId) ?? [];
    group.push(memory);
    byUser.set(memory.userId, group);
  }
  const started = performance.now();
  const details = questions.map(({ sample, qa, index }) => {
    const retriever = factory(byUser.get(sample.sample_id) ?? []);
    const results = retriever(questionText(qa), options.topK);
    const retrievedEvidence = results.map((memory) => String(memory.metadata.diaId ?? memory.source.uri ?? ""));
    const expectedEvidence = qa.evidence ?? [];
    return {
      id: `${sample.sample_id}:${index}`,
      sampleId: sample.sample_id,
      category: qa.category,
      question: qa.question,
      answer: qa.answer,
      expectedEvidence,
      retrievedEvidence,
      expected: expectedEvidence,
      retrieved: retrievedEvidence,
      passed: expectedEvidence.some((evidence) => retrievedEvidence.includes(evidence)),
      topScore: 0
    };
  });
  return finalizeLocomoResult(name, details, started, options);
}

function evidenceSearch(retrieval: RetrievalEngine, query: string, userId: string, limit: number): SearchResult[] {
  const broad = retrieval.search({ userId, query, limit: limit * 5 });
  return broad.filter((result) => typeof result.memory.metadata.diaId === "string").slice(0, limit);
}

function finalizeLocomoResult(
  name: string,
  details: LocomoDetail[],
  started: number,
  options: LocomoRunOptions
): LocomoResult {
  const correct = details.filter((detail) => detail.passed).length;
  const categories: LocomoResult["categories"] = {};
  for (const detail of details) {
    const category = String(detail.category);
    const current = categories[category] ?? { correct: 0, total: 0, accuracy: 0 };
    current.total += 1;
    if (detail.passed) current.correct += 1;
    current.accuracy = current.correct / current.total;
    categories[category] = current;
  }
  const meanTokens =
    details.reduce((sum, detail) => sum + estimateTokens(`${detail.question}\n${detail.retrievedEvidence.join(" ")}`), 0) /
    Math.max(1, details.length);
  return {
    name,
    dataset: "LoCoMo",
    metric: "evidence_recall_at_k",
    topK: options.topK,
    accuracy: correct / Math.max(1, details.length),
    correct,
    total: details.length,
    meanTokens,
    meanLatencyMs: (performance.now() - started) / Math.max(1, details.length),
    categories,
    details
  };
}

function publicDatasetIdRecallBoundary(scorer: string, note: string) {
  return {
    proof: "local-diagnostic" as const,
    scorer,
    judge: { kind: "missing" as const, requiredForQualityClaim: true },
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    claimBlockers: [
      note,
      "Comparable quality or market claims require LLM/harness judging or an official same-protocol public benchmark artifact."
    ]
  };
}

function questionText(qa: LocomoQa): string {
  return qa.question;
}

function sessionIds(sample: LocomoSample): string[] {
  return Object.keys(sample.conversation)
    .filter((key) => /^session_\d+$/.test(key) && Array.isArray(sample.conversation[key]))
    .sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));
}

function locomoSource(sampleId: string, part: string) {
  return {
    kind: "import" as const,
    confidence: 0.86,
    uri: `locomo://${sampleId}/${part}`
  };
}

function ensureDataset(datasetPath: string): void {
  if (existsSync(datasetPath)) return;
  mkdirSync(resolve(datasetPath, ".."), { recursive: true });
  execFileSync("curl", ["-L", LOCOMO_DATASET_URL, "-o", datasetPath], { stdio: "inherit" });
}

function parseLocomoDate(value: string): Date {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const rewritten = value.replace(/^(\d{1,2}:\d{2}\s+[ap]m)\s+on\s+(.+)$/i, "$2 $1");
  const parsed = new Date(rewritten);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date("1970-01-01T00:00:00.000Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
  }
  const report = runLocomoBenchmark({
    datasetPath: args.get("--dataset") ?? undefined,
    maxQuestions: args.has("--max-questions") ? Number(args.get("--max-questions")) : undefined,
    topK: args.has("--top-k") ? Number(args.get("--top-k")) : undefined,
    outputPath: args.get("--out") ?? undefined,
    includeSummaries: args.get("--summaries") !== "false"
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
