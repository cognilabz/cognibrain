import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

interface SuiteScore {
  id: string;
  passed: boolean;
  diagnosticPassed: boolean;
  proof: "local-lifecycle-diagnostic";
  qualityClaimAllowed: false;
  marketClaimAllowed: false;
  claimBoundary: {
    scorer: "deterministic-fixture-diagnostic" | "structural-lifecycle-diagnostic" | "harness-review-diagnostic";
    claimBlockers: string[];
  };
  score: number;
  details: Array<{ id: string; passed: boolean; diagnosticPassed: boolean; score: number; expected: string[]; actual: string; scorer: string }>;
}

export function runNextgenBenchmarkSuites(outputPath = "artifacts/nextgen-benchmarks.json", trendPath = "artifacts/benchmark-trend.json") {
  const suites = [answerGenerationSuite(), multiHopTemporalSuite(), behavioralPatternSuite(), retrievalCalibrationSuite(), uspEvidenceSuite()];
  const trend = benchmarkTrend(suites, trendPath);
  const diagnosticPassed = suites.every((suite) => suite.diagnosticPassed);
  const report = {
    passed: diagnosticPassed,
    diagnosticPassed,
    proof: "local-lifecycle-diagnostic" as const,
    qualityClaimAllowed: false as const,
    marketClaimAllowed: false as const,
    claimBoundary: {
      scorer: "deterministic-fixture-diagnostic",
      claimBlockers: [
        "Nextgen suites are local lifecycle diagnostics built from deterministic fixtures and structural checks.",
        "Answer-quality or market claims require an external LLM/harness judge or comparable public benchmark proof."
      ]
    },
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
    return diagnosticDetail(test.id, score === 1, score, test.expected, actual, "deterministic-fixture-diagnostic");
  });
  return finalizeSuite("answer-generation", details, "deterministic-fixture-diagnostic");
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
    diagnosticDetail("multi-hop-path", path.length > 0, path.length > 0 ? 1 : 0, ["transitive_depends_on"], JSON.stringify(path[0]?.explanation ?? []), "structural-lifecycle-diagnostic"),
    diagnosticDetail("temporal-interval", temporal.events.length === 2, temporal.events.length === 2 ? 1 : 0, ["2 events"], `${temporal.events.length} events`, "structural-lifecycle-diagnostic")
  ];
  return finalizeSuite("multi-hop-temporal", details, "structural-lifecycle-diagnostic");
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
    diagnosticDetail("weekly-friday-detection", Boolean(friday), friday ? 1 : 0, ["weekly:friday"], JSON.stringify(patterns.map((pattern) => pattern.cadence)), "structural-lifecycle-diagnostic"),
    diagnosticDetail("false-positive-risk", Boolean(friday && (friday.falsePositiveRisk ?? 1) <= 0.5), friday ? 1 - (friday.falsePositiveRisk ?? 1) : 0, ["risk<=0.5"], String(friday?.falsePositiveRisk ?? "missing"), "structural-lifecycle-diagnostic")
  ];
  return finalizeSuite("behavioral-patterns", details, "structural-lifecycle-diagnostic");
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
  const harnessService = new MemoryService({
    intelligence: {
      evidenceJudge: {
        judgeEvidence: ({ results }) => ({
          answerable: true,
          confidence: 0.95,
          reason: "harness review gate",
          decisions: results.map((result) => ({ id: result.memory.id, decision: "review", confidence: 0.95, reason: "operator review required" }))
        })
      }
    }
  });
  const reviewed = harnessService.add({ userId: "calibration", content: "Atlas deployment reviewed gate requires operator approval before injection.", entities: ["atlas", "deployment"], source: { kind: "reviewed_code", confidence: 0.99 } });
  const harnessPack = harnessService.evidencePack({ userId: "calibration", query: "Atlas deployment reviewed gate", limit: 1, tokenBudget: 500 });
  const weakDelivered = pack.results.some((result) => result.memoryId === weak.id);
  const weakExcluded = pack.excludedResults?.some((result) => result.memoryId === weak.id) ?? false;
  const reviewedDelivered = harnessPack.results.some((result) => result.memoryId === reviewed.id);
  const reviewedRetainedInVerdict = harnessPack.evidenceVerdict?.reviewMemoryIds.includes(reviewed.id) ?? false;
  const details = [
    diagnosticDetail("confidence-field", typeof high?.confidence === "number" && high.confidence > 0.5, high?.confidence ?? 0, ["confidence>0.5"], String(high?.confidence ?? "missing"), "structural-lifecycle-diagnostic"),
    diagnosticDetail("unsafe-threshold", Boolean(low?.unsafeToInject && (low.confidence ?? 1) < 0.5), low?.unsafeToInject ? 1 : 0, ["unsafe low-confidence"], JSON.stringify({ confidence: low?.confidence, unsafeToInject: low?.unsafeToInject }), "structural-lifecycle-diagnostic"),
    diagnosticDetail("context-exclusion", !weakDelivered && weakExcluded, !weakDelivered && weakExcluded ? 1 : 0, ["weak memory excluded"], JSON.stringify({ deliveredIds: pack.results.map((result) => result.memoryId), excludedIds: pack.excludedResults?.map((result) => result.memoryId) ?? [] }), "structural-lifecycle-diagnostic"),
    diagnosticDetail("harness-review-not-injected", !reviewedDelivered && reviewedRetainedInVerdict, !reviewedDelivered && reviewedRetainedInVerdict ? 1 : 0, ["reviewed memory excluded", "evidence verdict retained"], JSON.stringify({ deliveredIds: harnessPack.results.map((result) => result.memoryId), evidenceVerdict: harnessPack.evidenceVerdict }), "harness-review-diagnostic")
  ];
  return finalizeSuite("retrieval-calibration", details, "harness-review-diagnostic");
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
    diagnosticDetail("why-used-explanation", Boolean(first?.retrieval.explanation.length && first.retrieval.signals.trust > 0), first?.retrieval.explanation.length ? 1 : 0, ["explanation", "trust signal"], JSON.stringify(first?.retrieval.explanation ?? []), "structural-lifecycle-diagnostic"),
    diagnosticDetail("source-citation", Boolean(first?.retrieval.citation.includes("AGENTS.md") && first.retrieval.citation.includes(":12")), first?.retrieval.citation.includes("AGENTS.md") ? 1 : 0, ["file citation"], first?.retrieval.citation ?? "missing", "structural-lifecycle-diagnostic"),
    diagnosticDetail("temporal-validity", first?.validity.validFrom === "2026-05-01T00:00:00.000Z" && first?.validity.stale === false, first?.validity.validFrom ? 1 : 0, ["validFrom", "not stale"], JSON.stringify(first?.validity ?? {}), "structural-lifecycle-diagnostic"),
    diagnosticDetail("consent-boundary", !pack.results.some((result) => result.content.includes("private until approved")), pack.results.some((result) => result.content.includes("private until approved")) ? 0 : 1, ["private excluded"], pack.results.map((result) => result.consent.visibility).join(","), "structural-lifecycle-diagnostic")
  ];
  return finalizeSuite("usp-evidence-pack", details, "structural-lifecycle-diagnostic");
}

function synthesizeAnswer(evidence: string[]): string {
  return evidence.slice(0, 3).join(" ");
}

function diagnosticDetail(id: string, passed: boolean, score: number, expected: string[], actual: string, scorer: SuiteScore["claimBoundary"]["scorer"]): SuiteScore["details"][number] {
  return { id, passed, diagnosticPassed: passed, score, expected, actual, scorer };
}

function finalizeSuite(id: string, details: SuiteScore["details"], scorer: SuiteScore["claimBoundary"]["scorer"]): SuiteScore {
  const score = details.reduce((total, item) => total + item.score, 0) / Math.max(1, details.length);
  const diagnosticPassed = details.every((detail) => detail.diagnosticPassed);
  return {
    id,
    passed: diagnosticPassed,
    diagnosticPassed,
    proof: "local-lifecycle-diagnostic",
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    claimBoundary: {
      scorer,
      claimBlockers: [
        `${id} uses ${scorer}; it is a local lifecycle diagnostic, not answer-quality or market-comparison proof.`,
        "Promote only after LLM/harness judging or comparable public benchmark proof is attached."
      ]
    },
    score,
    details
  };
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

function printCliReport(report: Record<string, any>, outputPath: string | undefined, argv: string[]): void {
  if (argv.includes("--json-stdout") || process.env.MEMORY_FULL_BENCHMARK_STDOUT === "true" || !outputPath) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const suites = Array.isArray(report.suites) ? report.suites : [];
  console.log(JSON.stringify({
    benchmark: "NextgenLifecycle",
    passed: report.passed,
    diagnosticPassed: report.diagnosticPassed,
    suiteCount: suites.length,
    suites: suites.map((suite: Record<string, any>) => ({
      id: suite.id,
      passed: suite.passed,
      score: suite.score,
      scorer: suite.claimBoundary?.scorer
    })),
    claimBoundary: report.claimBoundary,
    outputPath
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;
  const report = runNextgenBenchmarkSuites(outputPath);
  printCliReport(report, outputPath, process.argv.slice(2));
  if (!report.passed) process.exit(1);
}
