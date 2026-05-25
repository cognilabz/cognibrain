import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

interface SuiteScore {
  id: string;
  passed: boolean;
  score: number;
  details: Array<{ id: string; passed: boolean; score: number; expected: string[]; actual: string }>;
}

export function runNextgenBenchmarkSuites(outputPath = "artifacts/nextgen-benchmarks.json", trendPath = "artifacts/benchmark-trend.json") {
  const suites = [answerGenerationSuite(), multiHopTemporalSuite(), behavioralPatternSuite(), retrievalCalibrationSuite(), uspEvidenceSuite()];
  const trend = benchmarkTrend(suites, trendPath);
  const report = {
    passed: suites.every((suite) => suite.passed),
    generatedAt: new Date().toISOString(),
    suites,
    trend
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  mkdirSync(dirname(trendPath), { recursive: true });
  writeFileSync(trendPath, JSON.stringify(trend, null, 2));
  return report;
}

function answerGenerationSuite(): SuiteScore {
  const service = new MemoryService();
  service.add({ userId: "answer", content: "Project Atlas uses TypeScript and Redis for cache reads.", entities: ["atlas", "typescript", "redis"], source: { kind: "human", confidence: 0.96 } });
  service.add({ userId: "answer", content: "Project Atlas moved away from SQLite for cache reads.", entities: ["atlas", "sqlite"], source: { kind: "human", confidence: 0.93 } });
  const cases = [
    { id: "direct-answer", query: "What does Atlas use for cache reads?", expected: ["redis"] },
    { id: "language-answer", query: "What language does Atlas use?", expected: ["typescript"] }
  ];
  const details = cases.map((test) => {
    const results = service.search({ userId: "answer", query: test.query, includePrivate: true, limit: 3 });
    const actual = synthesizeAnswer(results.map((result) => result.memory.content));
    const score = test.expected.every((term) => actual.toLowerCase().includes(term)) ? 1 : 0;
    return { id: test.id, passed: score === 1, score, expected: test.expected, actual };
  });
  return finalizeSuite("answer-generation", details);
}

function multiHopTemporalSuite(): SuiteScore {
  const service = new MemoryService();
  service.add({ userId: "multi", content: "Atlas depends on CacheClient.", entities: ["atlas", "cacheclient"], relations: [{ type: "depends_on", sourceEntity: "atlas", targetEntity: "cacheclient", confidence: 0.92 }], source: { kind: "reviewed_code", confidence: 0.96 } });
  service.add({ userId: "multi", content: "CacheClient imports RedisAdapter.", entities: ["cacheclient", "redisadapter"], relations: [{ type: "imports", sourceEntity: "cacheclient", targetEntity: "redisadapter", confidence: 0.91 }], source: { kind: "reviewed_code", confidence: 0.96 } });
  service.add({ userId: "multi", content: "Operator approved graph reports on Friday.", tags: ["graph"], temporal: { eventAt: "2026-05-01T09:00:00.000Z" }, source: { kind: "human", confidence: 0.94 } });
  service.add({ userId: "multi", content: "Operator approved temporal reports on Friday.", tags: ["temporal"], temporal: { eventAt: "2026-05-08T09:00:00.000Z" }, source: { kind: "human", confidence: 0.94 } });
  service.runInference();
  const path = service.graphPaths("atlas", "redisadapter", { userId: "multi", relationTypes: ["transitive_depends_on"], maxDepth: 3 });
  const temporal = service.temporalQuery("multi", { after: "2026-05-01T00:00:00.000Z", before: "2026-05-09T00:00:00.000Z" });
  const details = [
    { id: "multi-hop-path", passed: path.length > 0, score: path.length > 0 ? 1 : 0, expected: ["transitive_depends_on"], actual: JSON.stringify(path[0]?.explanation ?? []) },
    { id: "temporal-interval", passed: temporal.events.length === 2, score: temporal.events.length === 2 ? 1 : 0, expected: ["2 events"], actual: `${temporal.events.length} events` }
  ];
  return finalizeSuite("multi-hop-temporal", details);
}

function behavioralPatternSuite(): SuiteScore {
  const service = new MemoryService();
  for (const [content, eventAt] of [
    ["Mira orders Thai food every Friday.", "2026-05-01T18:00:00.000Z"],
    ["Mira orders Thai food again on Friday.", "2026-05-08T18:00:00.000Z"],
    ["Mira bestellt Thai Essen am Freitag.", "2026-05-15T18:00:00.000Z"]
  ]) {
    service.add({ userId: "pattern", content, tags: ["food"], temporal: { eventAt }, source: { kind: "human", confidence: 0.93 } });
  }
  const patterns = service.behavioralPatterns("pattern").patterns;
  const friday = patterns.find((pattern) => pattern.cadence === "weekly:friday");
  const details = [
    { id: "weekly-friday-detection", passed: Boolean(friday), score: friday ? 1 : 0, expected: ["weekly:friday"], actual: JSON.stringify(patterns.map((pattern) => pattern.cadence)) },
    { id: "false-positive-risk", passed: Boolean(friday && (friday.falsePositiveRisk ?? 1) <= 0.5), score: friday ? 1 - (friday.falsePositiveRisk ?? 1) : 0, expected: ["risk<=0.5"], actual: String(friday?.falsePositiveRisk ?? "missing") }
  ];
  return finalizeSuite("behavioral-patterns", details);
}

function retrievalCalibrationSuite(): SuiteScore {
  const service = new MemoryService();
  service.add({ userId: "calibration", content: "Atlas deployment requires reviewed npm test evidence before release.", entities: ["atlas", "deployment"], source: { kind: "reviewed_code", confidence: 0.99 } });
  const weak = service.add({ userId: "calibration", content: "Atlas deployment maybe skips tests according to a weak note.", entities: ["atlas", "deployment"], source: { kind: "agent", confidence: 0.08 } });
  service.update(weak.id, { trust: 0.04, importance: 0.1 });
  const results = service.search({ userId: "calibration", query: "Atlas deployment tests", limit: 2 });
  const high = results.find((result) => result.memory.id !== weak.id);
  const low = results.find((result) => result.memory.id === weak.id);
  const pack = service.evidencePack({ userId: "calibration", query: "Atlas deployment tests", limit: 2, tokenBudget: 500 });
  const details = [
    { id: "confidence-field", passed: typeof high?.confidence === "number" && high.confidence > 0.5, score: high?.confidence ?? 0, expected: ["confidence>0.5"], actual: String(high?.confidence ?? "missing") },
    { id: "unsafe-threshold", passed: Boolean(low?.unsafeToInject && (low.confidence ?? 1) < 0.5), score: low?.unsafeToInject ? 1 : 0, expected: ["unsafe low-confidence"], actual: JSON.stringify({ confidence: low?.confidence, unsafeToInject: low?.unsafeToInject }) },
    { id: "context-exclusion", passed: !pack.context.includes(weak.id), score: pack.context.includes(weak.id) ? 0 : 1, expected: ["weak memory excluded"], actual: pack.context }
  ];
  return finalizeSuite("retrieval-calibration", details);
}

function uspEvidenceSuite(): SuiteScore {
  const service = new MemoryService();
  service.add({
    userId: "usp",
    content: "Atlas deploys require npm test before release.",
    orgId: "org-1",
    entities: ["atlas", "release"],
    tags: ["procedure", "release"],
    source: { kind: "reviewed_code", uri: "file://AGENTS.md", lineStart: 12, lineEnd: 14, confidence: 0.97 },
    consent: { visibility: "org" },
    temporal: { validFrom: "2026-05-01T00:00:00.000Z", lastConfirmedAt: "2026-05-20T00:00:00.000Z" }
  });
  service.add({
    userId: "usp",
    content: "Atlas release notes are private until approved.",
    entities: ["atlas", "release notes"],
    tags: ["privacy"],
    source: { kind: "human", confidence: 0.94 },
    consent: { visibility: "private" }
  });
  const pack = service.evidencePack({ userId: "usp", orgId: "org-1", query: "Why should Atlas run tests before release?", limit: 3, tokenBudget: 500 });
  const first = pack.results[0];
  const details = [
    { id: "why-used-explanation", passed: Boolean(first?.retrieval.explanation.length && first.retrieval.signals.trust > 0), score: first?.retrieval.explanation.length ? 1 : 0, expected: ["explanation", "trust signal"], actual: JSON.stringify(first?.retrieval.explanation ?? []) },
    { id: "source-citation", passed: Boolean(first?.retrieval.citation.includes("AGENTS.md") && first.retrieval.citation.includes(":12")), score: first?.retrieval.citation.includes("AGENTS.md") ? 1 : 0, expected: ["file citation"], actual: first?.retrieval.citation ?? "missing" },
    { id: "temporal-validity", passed: first?.validity.validFrom === "2026-05-01T00:00:00.000Z" && first?.validity.stale === false, score: first?.validity.validFrom ? 1 : 0, expected: ["validFrom", "not stale"], actual: JSON.stringify(first?.validity ?? {}) },
    { id: "consent-boundary", passed: !pack.results.some((result) => result.content.includes("private until approved")), score: pack.results.some((result) => result.content.includes("private until approved")) ? 0 : 1, expected: ["private excluded"], actual: pack.results.map((result) => result.consent.visibility).join(",") }
  ];
  return finalizeSuite("usp-evidence-pack", details);
}

function synthesizeAnswer(evidence: string[]): string {
  return evidence.slice(0, 3).join(" ");
}

function finalizeSuite(id: string, details: SuiteScore["details"]): SuiteScore {
  const score = details.reduce((total, item) => total + item.score, 0) / Math.max(1, details.length);
  return { id, passed: details.every((detail) => detail.passed), score, details };
}

function benchmarkTrend(suites: SuiteScore[], trendPath: string) {
  const previous = existsSync(trendPath) ? JSON.parse(readFileSync(trendPath, "utf8")) : { points: [] };
  const point = {
    generatedAt: new Date().toISOString(),
    suites: Object.fromEntries(suites.map((suite) => [suite.id, suite.score])),
    meanScore: suites.reduce((total, suite) => total + suite.score, 0) / Math.max(1, suites.length)
  };
  return { points: [...(previous.points ?? []), point].slice(-20) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const report = runNextgenBenchmarkSuites(outIndex >= 0 ? process.argv[outIndex + 1] : undefined);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
