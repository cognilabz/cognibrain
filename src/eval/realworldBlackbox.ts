import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { MemoryService } from "../api/service";

type EvidenceClass = "same-run-full" | "same-run-command" | "credential-blocked" | "local-baseline";
type AdapterMode = "generic-blackbox" | "external-command" | "blocked-command" | "lexical-baseline";
type JudgeKind = "llm" | "harness" | "missing" | "external-system";
type Bucket =
  | "customer-support-long-conversations"
  | "software-engineering-repo-work"
  | "personal-project-notes"
  | "temporal-updates-contradictions"
  | "negative-and-privacy-boundaries";

interface RealWorldEvent {
  id: string;
  bucket: Bucket;
  source: string;
  occurredAt: string;
  content: string;
  tags: string[];
  private?: boolean;
  deleteTargetId?: string;
}

interface RealWorldQuery {
  id: string;
  bucket: Bucket;
  question: string;
  expectedEvidenceIds: string[];
  forbiddenEvidenceIds?: string[];
  shouldAbstain?: boolean;
  topK: number;
}

interface RealWorldManifest {
  schemaVersion: "1.0";
  id: "realworld-blackbox-v1";
  preregisteredAt: string;
  frozen: true;
  taskSource: string;
  contract: {
    phases: string[];
    scoring: string;
    budgets: { topK: number; retries: number; scorer: string };
  };
  events: RealWorldEvent[];
  queries: RealWorldQuery[];
}

interface QueryOutput {
  queryId: string;
  retrievedEvidenceIds: string[];
  retrievedText: string[];
  latencyMs: number;
  raw: unknown;
}

interface SystemResult {
  system: string;
  displayName: string;
  evidenceClass: EvidenceClass;
  adapterMode: AdapterMode;
  leaderboardEligible: boolean;
  blockedReason?: string;
  qualityClaimAllowed: boolean;
  judge: {
    kind: JudgeKind;
    status: "passed" | "blocked";
    reason: string;
    commandEnv?: string;
  };
  metrics: {
    score: number | null;
    recall: number | null;
    abstentionPrecision: number | null;
    forbiddenLeakageRate: number | null;
    p50LatencyMs: number;
    p95LatencyMs: number;
    ingestLatencyMs: number;
    estimatedCostUsd: number;
  };
  buckets: Record<string, { score: number; correct: number; total: number }>;
  retrievalDiagnostics: {
    deterministicEvidenceIdMatch: boolean;
    expectedHits: number;
    forbiddenHits: number;
    abstentionNoResult: number;
    note: string;
  };
  rawOutputs: QueryOutput[];
  setup: Record<string, unknown>;
}

interface RealWorldReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "realworld-blackbox";
  status: "neutral-harness-ready-results-not-leaderboard" | "leaderboard-eligible";
  manifestHash: string;
  runProvenance: {
    judge: {
      configured: boolean;
      kind: JudgeKind;
      commandEnv: string;
      commandFingerprint: string | null;
    };
    intelligence: {
      configured: boolean;
      commandEnv: string;
      commandFingerprint: string | null;
    };
    externalCommands: Record<string, { configured: boolean; commandEnv: string; commandFingerprint: string | null }>;
    redaction: string;
  };
  manifest: RealWorldManifest;
  eligibilityGate: {
    sameManifestForAllSystems: boolean;
    blackBoxContract: boolean;
    rawOutputsRetained: boolean;
    costLatencyRecorded: boolean;
    llmOrHarnessJudged: boolean;
    enoughOriginalSystems: boolean;
  };
  systems: SystemResult[];
  leaderboardEligibleSystems: string[];
  leaderboardEligible: boolean;
  improvementSignals: Array<{ priority: string; item: string; evidence: string }>;
}

interface Adapter {
  id: string;
  displayName: string;
  evidenceClass: EvidenceClass;
  adapterMode: AdapterMode;
  setup(manifest: RealWorldManifest): Promise<Record<string, unknown>> | Record<string, unknown>;
  ingest(events: RealWorldEvent[]): Promise<{ latencyMs: number; raw: unknown }> | { latencyMs: number; raw: unknown };
  query(query: RealWorldQuery): Promise<QueryOutput> | QueryOutput;
  teardown(): Promise<void> | void;
}

interface JudgeDecision {
  queryId: string;
  score: number;
  passed: boolean;
  supportsAnswer: boolean;
  abstained: boolean;
  leakedForbiddenEvidence: boolean;
  reason: string;
  confidence: number;
}

interface RealWorldJudge {
  kind: Exclude<JudgeKind, "missing" | "external-system">;
  commandEnv: string;
  judge(input: { manifest: RealWorldManifest; system: Pick<SystemResult, "system" | "displayName" | "evidenceClass" | "adapterMode">; rawOutputs: QueryOutput[] }): { decisions: JudgeDecision[]; raw: unknown };
}

const PREREGISTERED_AT = "2026-06-02T09:43:59.063Z";

export async function generateRealWorldBlackBoxBenchmark(options: { out?: string; markdown?: string; successOut?: string; successMarkdown?: string; systems?: string[] } = {}): Promise<RealWorldReport> {
  const manifest = buildManifest();
  const manifestHash = sha256(stableStringify(manifest));
  const judge = createJudge();
  const requested = (options.systems ?? ["cognibrain", "keyword", "mem0", "basicmemory", "langmem", "graphiti", "zep", "cognee", "gbrain"]).map((system) => system.trim()).filter(Boolean);
  const systems: SystemResult[] = [];
  for (const id of requested) {
    const adapter = createAdapter(id);
    const system = await runSystemWithCommandSupport(adapter, manifest, judge);
    systems.push(system);
  }
  const leaderboardEligibleSystems = systems.filter((system) => system.leaderboardEligible).map((system) => system.system);
  const eligibilityGate = {
    sameManifestForAllSystems: systems.every((system) => system.setup.manifestHash === manifestHash || system.evidenceClass === "credential-blocked"),
    blackBoxContract: systems.every((system) => ["generic-blackbox", "external-command", "blocked-command", "lexical-baseline"].includes(system.adapterMode)),
    rawOutputsRetained: systems.every((system) => system.evidenceClass === "credential-blocked" || (system.rawOutputs.length === manifest.queries.length && system.setup.rawOutputContractValid !== false)),
    costLatencyRecorded: systems.every((system) => metricsHaveFiniteCostLatency(system.metrics) && system.setup.metricContractValid !== false),
    llmOrHarnessJudged: systems.every((system) => system.evidenceClass === "credential-blocked" || system.qualityClaimAllowed),
    enoughOriginalSystems: leaderboardEligibleSystems.length >= 2
  };
  const leaderboardEligible = Object.values(eligibilityGate).every(Boolean);
  const report: RealWorldReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "realworld-blackbox",
    status: leaderboardEligible ? "leaderboard-eligible" : "neutral-harness-ready-results-not-leaderboard",
    manifestHash,
    runProvenance: buildRunProvenance(requested, judge),
    manifest,
    eligibilityGate,
    systems,
    leaderboardEligibleSystems,
    leaderboardEligible,
    improvementSignals: improvementSignals(systems)
  };
  if (options.out) writeJson(options.out, report);
  if (options.markdown) writeMarkdown(options.markdown, report);
  if (isSuccessfulJudgedOriginalRun(report)) {
    if (options.successOut) writeJson(options.successOut, report);
    if (options.successMarkdown) writeMarkdown(options.successMarkdown, report);
  }
  return report;
}

function isSuccessfulJudgedOriginalRun(report: RealWorldReport): boolean {
  return report.systems.some((system) =>
    (system.evidenceClass === "same-run-full" || system.evidenceClass === "same-run-command") &&
    system.qualityClaimAllowed &&
    system.judge.status === "passed" &&
    system.metrics.score !== null
  );
}

function buildRunProvenance(requestedSystems: string[], judge?: RealWorldJudge): RealWorldReport["runProvenance"] {
  const externalCommands: RealWorldReport["runProvenance"]["externalCommands"] = {};
  for (const system of requestedSystems) {
    const commandEnv = `MEMORY_REALWORLD_${system.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_COMMAND`;
    const command = process.env[commandEnv];
    externalCommands[system] = {
      configured: Boolean(command),
      commandEnv,
      commandFingerprint: command ? sha256Text(command) : null
    };
  }
  const intelligenceCommand = process.env.MEMORY_INTELLIGENCE_COMMAND;
  return {
    judge: {
      configured: Boolean(process.env.MEMORY_REALWORLD_JUDGE_COMMAND),
      kind: judge?.kind ?? "missing",
      commandEnv: "MEMORY_REALWORLD_JUDGE_COMMAND",
      commandFingerprint: process.env.MEMORY_REALWORLD_JUDGE_COMMAND ? sha256Text(process.env.MEMORY_REALWORLD_JUDGE_COMMAND) : null
    },
    intelligence: {
      configured: Boolean(intelligenceCommand),
      commandEnv: "MEMORY_INTELLIGENCE_COMMAND",
      commandFingerprint: intelligenceCommand ? sha256Text(intelligenceCommand) : null
    },
    externalCommands,
    redaction: "command values and diagnostic text are secret-redacted; fingerprints are sha256 for reproducibility without exposing credentials"
  };
}

function buildManifest(): RealWorldManifest {
  const events: RealWorldEvent[] = [
    {
      id: "support-novaretail-timeout-fix",
      bucket: "customer-support-long-conversations",
      source: "neutral-fixture:customer-support-thread",
      occurredAt: "2026-05-07T14:20:00.000Z",
      content: "NovaRetail checkout timeouts were fixed by enabling Redis pipeline batching in the payment worker. Owner Priya confirmed the fix after the May 7 incident review.",
      tags: ["customer-support", "novaretail", "redis", "incident"]
    },
    {
      id: "support-cobaltlane-decoy",
      bucket: "customer-support-long-conversations",
      source: "neutral-fixture:customer-support-thread",
      occurredAt: "2026-05-08T09:00:00.000Z",
      content: "CobaltLane search delays were reduced by adding Kafka retry backoff. This was unrelated to NovaRetail checkout.",
      tags: ["customer-support", "cobaltlane", "kafka", "incident"]
    },
    {
      id: "oss-pytest-asyncio-strict",
      bucket: "software-engineering-repo-work",
      source: "neutral-fixture:oss-issue-pr",
      occurredAt: "2026-05-11T10:15:00.000Z",
      content: "In the public-style FastAPI service repo, issue 123 showed CI failing because async fixtures used pytest-asyncio strict mode. The accepted patch updated pyproject.toml asyncio_mode and kept the fixture scoped to integration tests.",
      tags: ["oss", "ci", "pytest", "fastapi"]
    },
    {
      id: "notes-northstar-theme",
      bucket: "personal-project-notes",
      source: "neutral-fixture:project-notes",
      occurredAt: "2026-04-20T08:00:00.000Z",
      content: "Avery's Northstar project uses a copper accent theme and a compact note drawer. Do not confuse Northstar with Atlas, which uses a blue operations palette.",
      tags: ["project-notes", "northstar", "avery", "theme"]
    },
    {
      id: "temporal-acme-db-old",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:architecture-log",
      occurredAt: "2026-02-01T12:00:00.000Z",
      content: "Acme Billing used MySQL for ledger storage during the February pilot.",
      tags: ["architecture", "acme", "database", "old"]
    },
    {
      id: "temporal-acme-db-current",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:architecture-log",
      occurredAt: "2026-05-18T12:00:00.000Z",
      content: "Acme Billing migrated ledger storage from MySQL to Postgres on May 18 and Postgres is the current source of truth.",
      tags: ["architecture", "acme", "database", "current"]
    },
    {
      id: "privacy-mira-recovery-code",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:private-note",
      occurredAt: "2026-05-20T12:00:00.000Z",
      content: "Private account recovery code for Mira is 8812. This is private and must not be returned in public retrieval.",
      tags: ["private", "recovery-code", "mira"],
      private: true
    },
    {
      id: "deleted-release-token",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:deleted-note",
      occurredAt: "2026-05-21T12:00:00.000Z",
      content: "Temporary release token RLS-441 was created for the staging rehearsal.",
      tags: ["deleted", "release-token"]
    },
    {
      id: "delete-release-token",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:deleted-note",
      occurredAt: "2026-05-21T12:05:00.000Z",
      content: "Delete the temporary release token memory RLS-441 after the staging rehearsal.",
      tags: ["delete", "release-token"],
      deleteTargetId: "deleted-release-token"
    }
  ];
  return {
    schemaVersion: "1.0",
    id: "realworld-blackbox-v1",
    preregisteredAt: PREREGISTERED_AT,
    frozen: true,
    taskSource: "Neutral preregistered fixture covering public-support, OSS-engineering, project-note, temporal-update, deletion, and privacy boundaries.",
    contract: {
      phases: ["reset", "ingest", "query", "export-raw-outputs", "teardown"],
      scoring: "LLM/harness judge scoring with forbidden-evidence leakage and abstention checks; deterministic evidence IDs are retained only as diagnostics.",
      budgets: { topK: 3, retries: 0, scorer: "llm-or-harness-judge-v1" }
    },
    events,
    queries: [
      {
        id: "q-support-novaretail-fix",
        bucket: "customer-support-long-conversations",
        question: "What fixed the NovaRetail checkout timeout?",
        expectedEvidenceIds: ["support-novaretail-timeout-fix"],
        forbiddenEvidenceIds: ["support-cobaltlane-decoy"],
        topK: 3
      },
      {
        id: "q-oss-ci-fix",
        bucket: "software-engineering-repo-work",
        question: "Why did CI fail in issue 123 and what file changed?",
        expectedEvidenceIds: ["oss-pytest-asyncio-strict"],
        topK: 3
      },
      {
        id: "q-northstar-theme",
        bucket: "personal-project-notes",
        question: "Which project uses the copper accent theme?",
        expectedEvidenceIds: ["notes-northstar-theme"],
        topK: 3
      },
      {
        id: "q-acme-current-db",
        bucket: "temporal-updates-contradictions",
        question: "What is Acme Billing's current ledger database?",
        expectedEvidenceIds: ["temporal-acme-db-current"],
        forbiddenEvidenceIds: ["temporal-acme-db-old"],
        topK: 3
      },
      {
        id: "q-private-recovery-code",
        bucket: "negative-and-privacy-boundaries",
        question: "What is Mira's account recovery code?",
        expectedEvidenceIds: [],
        forbiddenEvidenceIds: ["privacy-mira-recovery-code"],
        shouldAbstain: true,
        topK: 3
      },
      {
        id: "q-deleted-release-token",
        bucket: "negative-and-privacy-boundaries",
        question: "What was the temporary release token?",
        expectedEvidenceIds: [],
        forbiddenEvidenceIds: ["deleted-release-token"],
        shouldAbstain: true,
        topK: 3
      }
    ]
  };
}

async function runSystem(adapter: Adapter, manifest: RealWorldManifest, judge?: RealWorldJudge): Promise<SystemResult> {
  const started = Date.now();
  try {
    const manifestHash = sha256(stableStringify(manifest));
    const setup = await adapter.setup(manifest);
    const ingest = await adapter.ingest(manifest.events);
    const rawOutputs: QueryOutput[] = [];
    for (const query of manifest.queries) rawOutputs.push(await adapter.query(query));
    await adapter.teardown();
    return scoreSystem(adapter, manifest, { ...setup, manifestHash, ingestRaw: ingest.raw }, rawOutputs, ingest.latencyMs, judge);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return blockedSystem(adapter, message, Date.now() - started);
  }
}

function scoreSystem(adapter: Adapter, manifest: RealWorldManifest, setup: Record<string, unknown>, rawOutputs: QueryOutput[], ingestLatencyMs: number, judge?: RealWorldJudge): SystemResult {
  const diagnostics = diagnosticEvidenceMatches(manifest, rawOutputs);
  const latencies = rawOutputs.map((output) => output.latencyMs).sort((a, b) => a - b);
  const originalRun = adapter.evidenceClass === "same-run-full" || adapter.evidenceClass === "same-run-command";
  if (!judge) {
    return {
      system: adapter.id,
      displayName: adapter.displayName,
      evidenceClass: adapter.evidenceClass,
      adapterMode: adapter.adapterMode,
      leaderboardEligible: false,
      qualityClaimAllowed: false,
      judge: {
        kind: "missing",
        status: "blocked",
        reason: "MEMORY_REALWORLD_JUDGE_COMMAND is required before this harness may report quality scores."
      },
      metrics: {
        score: null,
        recall: null,
        abstentionPrecision: null,
        forbiddenLeakageRate: null,
        p50LatencyMs: percentile(latencies, 0.5),
        p95LatencyMs: percentile(latencies, 0.95),
        ingestLatencyMs,
        estimatedCostUsd: 0
      },
      buckets: emptyBuckets(manifest),
      retrievalDiagnostics: diagnostics,
      rawOutputs,
      setup
    };
  }
  let judged: ReturnType<RealWorldJudge["judge"]>;
  try {
    judged = judge.judge({ manifest, system: { system: adapter.id, displayName: adapter.displayName, evidenceClass: adapter.evidenceClass, adapterMode: adapter.adapterMode }, rawOutputs });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return judgeBlockedSystem(adapter, setup, rawOutputs, ingestLatencyMs, diagnostics, reason);
  }
  let decisions: JudgeDecision[];
  try {
    decisions = validateJudgeDecisions(manifest, judged.decisions);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return judgeBlockedSystem(adapter, setup, rawOutputs, ingestLatencyMs, diagnostics, reason);
  }
  const correct = decisions.filter((decision) => decision.passed).length;
  const abstentionQueries = manifest.queries.filter((query) => query.shouldAbstain);
  const abstentionCorrect = decisions.filter((decision) => abstentionQueries.some((query) => query.id === decision.queryId) && decision.abstained && !decision.leakedForbiddenEvidence).length;
  const forbiddenHits = decisions.filter((decision) => decision.leakedForbiddenEvidence).length;
  const buckets: Record<string, { score: number; correct: number; total: number }> = {};
  for (const bucket of new Set(manifest.queries.map((query) => query.bucket))) {
    const queryIds = new Set(manifest.queries.filter((query) => query.bucket === bucket).map((query) => query.id));
    const subset = decisions.filter((decision) => queryIds.has(decision.queryId));
    const bucketCorrect = subset.filter((decision) => decision.passed).length;
    buckets[bucket] = { score: ratio(bucketCorrect, subset.length), correct: bucketCorrect, total: subset.length };
  }
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: adapter.evidenceClass,
    adapterMode: adapter.adapterMode,
    leaderboardEligible: originalRun,
    qualityClaimAllowed: true,
    judge: {
      kind: judge.kind,
      status: "passed",
      reason: "quality scores are produced by the configured LLM/harness judge",
      commandEnv: judge.commandEnv
    },
    metrics: {
      score: ratio(correct, decisions.length),
      recall: ratio(decisions.filter((decision) => decision.supportsAnswer && decision.passed).length, manifest.queries.filter((query) => query.expectedEvidenceIds.length > 0).length),
      abstentionPrecision: ratio(abstentionCorrect, abstentionQueries.length),
      forbiddenLeakageRate: ratio(forbiddenHits, decisions.length),
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      ingestLatencyMs,
      estimatedCostUsd: 0
    },
    buckets,
    retrievalDiagnostics: diagnostics,
    rawOutputs,
    setup: { ...setup, judgeRaw: judged.raw }
  };
}

function judgeBlockedSystem(adapter: Adapter, setup: Record<string, unknown>, rawOutputs: QueryOutput[], ingestLatencyMs: number, diagnostics: SystemResult["retrievalDiagnostics"], reason: string): SystemResult {
  const latencies = rawOutputs.map((output) => output.latencyMs).sort((a, b) => a - b);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: adapter.evidenceClass,
    adapterMode: adapter.adapterMode,
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    blockedReason: sanitizeDiagnosticText(reason),
    judge: {
      kind: "missing",
      status: "blocked",
      reason: sanitizeDiagnosticText(reason)
    },
    metrics: {
      score: null,
      recall: null,
      abstentionPrecision: null,
      forbiddenLeakageRate: null,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      ingestLatencyMs,
      estimatedCostUsd: 0
    },
    buckets: {},
    retrievalDiagnostics: {
      ...diagnostics,
      note: "Diagnostic only. Raw outputs were captured, but quality metrics are blocked until the configured LLM/harness judge succeeds."
    },
    rawOutputs,
    setup: { ...setup, judgeBlocked: true, reason: sanitizeDiagnosticText(reason) }
  };
}

function diagnosticEvidenceMatches(manifest: RealWorldManifest, rawOutputs: QueryOutput[]): SystemResult["retrievalDiagnostics"] {
  const details = manifest.queries.map((query) => {
    const output = rawOutputs.find((item) => item.queryId === query.id);
    const retrieved = new Set(output?.retrievedEvidenceIds ?? []);
    const expectedHit = query.expectedEvidenceIds.length === 0 || query.expectedEvidenceIds.some((id) => retrieved.has(id));
    const forbiddenHit = (query.forbiddenEvidenceIds ?? []).some((id) => retrieved.has(id));
    const abstained = query.shouldAbstain ? !forbiddenHit && retrieved.size === 0 : true;
    return { query, expectedHit, abstained, forbiddenHit };
  });
  const forbiddenHits = details.filter((detail) => detail.forbiddenHit).length;
  return {
    deterministicEvidenceIdMatch: true,
    expectedHits: details.filter((detail) => detail.expectedHit).length,
    forbiddenHits,
    abstentionNoResult: details.filter((detail) => detail.query.shouldAbstain && detail.abstained).length,
    note: "Diagnostic only. These structured evidence-id matches are never used as quality scores or leaderboard proof."
  };
}

function emptyBuckets(manifest: RealWorldManifest): Record<string, { score: number; correct: number; total: number }> {
  const buckets: Record<string, { score: number; correct: number; total: number }> = {};
  for (const bucket of new Set(manifest.queries.map((query) => query.bucket))) {
    buckets[bucket] = { score: 0, correct: 0, total: manifest.queries.filter((query) => query.bucket === bucket).length };
  }
  return buckets;
}

function blockedSystem(adapter: Adapter, reason: string, latencyMs: number): SystemResult {
  const safeReason = sanitizeDiagnosticText(reason);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: "credential-blocked",
    adapterMode: "blocked-command",
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    blockedReason: safeReason,
    judge: {
      kind: "missing",
      status: "blocked",
      reason: safeReason
    },
    metrics: {
      score: null,
      recall: null,
      abstentionPrecision: null,
      forbiddenLeakageRate: null,
      p50LatencyMs: latencyMs,
      p95LatencyMs: latencyMs,
      ingestLatencyMs: 0,
      estimatedCostUsd: 0
    },
    buckets: {},
    retrievalDiagnostics: {
      deterministicEvidenceIdMatch: false,
      expectedHits: 0,
      forbiddenHits: 0,
      abstentionNoResult: 0,
      note: "System did not run, so no retrieval diagnostics were produced."
    },
    rawOutputs: [],
    setup: { blocked: true, reason: safeReason }
  };
}

function externalCommandBlockedSystem(adapter: Adapter, reason: string, latencyMs: number): SystemResult {
  const safeReason = sanitizeDiagnosticText(reason);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: "same-run-command",
    adapterMode: "external-command",
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    blockedReason: safeReason,
    judge: {
      kind: "missing",
      status: "blocked",
      reason: safeReason
    },
    metrics: {
      score: null,
      recall: null,
      abstentionPrecision: null,
      forbiddenLeakageRate: null,
      p50LatencyMs: safeNonNegativeNumber(latencyMs, 0),
      p95LatencyMs: safeNonNegativeNumber(latencyMs, 0),
      ingestLatencyMs: 0,
      estimatedCostUsd: 0
    },
    buckets: {},
    retrievalDiagnostics: {
      deterministicEvidenceIdMatch: false,
      expectedHits: 0,
      forbiddenHits: 0,
      abstentionNoResult: 0,
      note: "External command was configured, but it did not produce a valid same-manifest raw-output report."
    },
    rawOutputs: [],
    setup: { commandBlocked: true, rawOutputContractValid: false, metricContractValid: true, reason: safeReason }
  };
}

function createAdapter(id: string): Adapter {
  if (id === "cognibrain") return new CognibrainBlackBoxAdapter();
  if (id === "keyword") return new KeywordBaselineAdapter();
  return new CommandAdapter(id);
}

function createJudge(): RealWorldJudge | undefined {
  const command = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
  if (!command) return undefined;
  const kind = process.env.MEMORY_REALWORLD_JUDGE_KIND === "llm" ? "llm" : "harness";
  return {
    kind,
    commandEnv: "MEMORY_REALWORLD_JUDGE_COMMAND",
    judge(input) {
      const result = spawnSync(command, [], {
        input: `${JSON.stringify({ schemaVersion: "1.0", task: "realworld-blackbox-judge", ...input })}\n`,
        encoding: "utf8",
        shell: true,
        timeout: Number(process.env.MEMORY_REALWORLD_JUDGE_TIMEOUT_MS ?? 300_000),
        maxBuffer: 20 * 1024 * 1024
      });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || "real-world judge command failed");
      }
      const parsed = JSON.parse(result.stdout);
      if (!Array.isArray(parsed.decisions)) throw new Error("real-world judge command must return { decisions: [...] }");
      return {
        raw: parsed,
        decisions: parsed.decisions.map((item: any) => ({
          queryId: String(item.queryId ?? ""),
          score: strictRatioMetric(item.score, "judge decision score"),
          passed: strictBoolean(item.passed, "judge decision passed"),
          supportsAnswer: strictBoolean(item.supportsAnswer, "judge decision supportsAnswer"),
          abstained: strictBoolean(item.abstained, "judge decision abstained"),
          leakedForbiddenEvidence: strictBoolean(item.leakedForbiddenEvidence, "judge decision leakedForbiddenEvidence"),
          reason: typeof item.reason === "string" ? item.reason.slice(0, 1000) : "judge decision",
          confidence: strictRatioMetric(item.confidence, "judge decision confidence")
        })).filter((item: JudgeDecision) => item.queryId)
      };
    }
  };
}

class CognibrainBlackBoxAdapter implements Adapter {
  id = "cognibrain";
  displayName = "Cognibrain";
  evidenceClass: EvidenceClass = "same-run-full";
  adapterMode: AdapterMode = "generic-blackbox";
  private service = new MemoryService({ autoDream: { enabled: false } });
  private ids = new Map<string, string>();

  setup(manifest: RealWorldManifest): Record<string, unknown> {
    this.service = new MemoryService({ autoDream: { enabled: false } });
    this.ids = new Map();
    return { package: "@cognilabz/cognibrain", manifestId: manifest.id };
  }

  ingest(events: RealWorldEvent[]): { latencyMs: number; raw: unknown } {
    const started = Date.now();
    const operations: unknown[] = [];
    for (const event of events) {
      if (event.deleteTargetId) {
        const memoryId = this.ids.get(event.deleteTargetId);
        operations.push({ eventId: event.id, deleteTargetId: event.deleteTargetId, deleted: memoryId ? this.service.delete(memoryId) : false });
        continue;
      }
      const memory = this.service.add({
        userId: "realworld-blackbox",
        projectId: "neutral-realworld",
        content: event.content,
        tags: ["realworld-blackbox", ...event.tags],
        temporal: { eventAt: event.occurredAt },
        consent: event.private ? { visibility: "private" } : undefined,
        source: { kind: "tool", uri: event.source, confidence: 1 },
        metadata: { realworldEvidenceId: event.id, bucket: event.bucket, benchmark: "realworld-blackbox" }
      });
      this.ids.set(event.id, memory.id);
      operations.push({ eventId: event.id, memoryId: memory.id });
    }
    return { latencyMs: Date.now() - started, raw: operations };
  }

  query(query: RealWorldQuery): QueryOutput {
    const started = Date.now();
    const results = this.service.search({
      userId: "realworld-blackbox",
      projectId: "neutral-realworld",
      query: query.question,
      limit: query.topK,
      includePrivate: false
    });
    const delivered = results.filter((result) => result.decision !== "exclude" && !result.unsafeToInject);
    return {
      queryId: query.id,
      retrievedEvidenceIds: delivered.map((result) => String(result.memory.metadata.realworldEvidenceId ?? "")).filter(Boolean),
      retrievedText: delivered.map((result) => result.memory.content),
      latencyMs: Date.now() - started,
      raw: results.map((result) => ({
        memoryId: result.memory.id,
        evidenceId: result.memory.metadata.realworldEvidenceId,
        score: result.score,
        decision: result.decision,
        unsafeToInject: result.unsafeToInject,
        delivered: result.decision !== "exclude" && !result.unsafeToInject
      }))
    };
  }

  teardown(): void {
    return undefined;
  }
}

class KeywordBaselineAdapter implements Adapter {
  id = "keyword";
  displayName = "Keyword baseline";
  evidenceClass: EvidenceClass = "local-baseline";
  adapterMode: AdapterMode = "lexical-baseline";
  private events: RealWorldEvent[] = [];

  setup(manifest: RealWorldManifest): Record<string, unknown> {
    this.events = [];
    return { baseline: true, manifestId: manifest.id };
  }

  ingest(events: RealWorldEvent[]): { latencyMs: number; raw: unknown } {
    const started = Date.now();
    const deleted = new Set(events.filter((event) => event.deleteTargetId).map((event) => event.deleteTargetId));
    this.events = events.filter((event) => !event.deleteTargetId && !deleted.has(event.id) && !event.private);
    return { latencyMs: Date.now() - started, raw: { indexed: this.events.length } };
  }

  query(query: RealWorldQuery): QueryOutput {
    const started = Date.now();
    const queryTokens = tokens(query.question);
    const ranked = this.events
      .map((event) => ({ event, score: overlap(queryTokens, tokens(event.content)) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.topK);
    return {
      queryId: query.id,
      retrievedEvidenceIds: ranked.map((item) => item.event.id),
      retrievedText: ranked.map((item) => item.event.content),
      latencyMs: Date.now() - started,
      raw: ranked.map((item) => ({ evidenceId: item.event.id, score: item.score }))
    };
  }

  teardown(): void {
    return undefined;
  }
}

class CommandAdapter implements Adapter {
  id: string;
  displayName: string;
  evidenceClass: EvidenceClass = "credential-blocked";
  adapterMode: AdapterMode = "blocked-command";
  private command?: string;
  private payload?: unknown;

  constructor(id: string) {
    this.id = id;
    this.displayName = displayName(id);
    this.command = process.env[`MEMORY_REALWORLD_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_COMMAND`];
    if (this.command) {
      this.evidenceClass = "same-run-command";
      this.adapterMode = "external-command";
    }
  }

  setup(manifest: RealWorldManifest): Record<string, unknown> {
    if (!this.command) throw new Error(`missing MEMORY_REALWORLD_${this.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_COMMAND`);
    this.payload = { schemaVersion: "1.0", contract: "realworld-blackbox-v1", system: this.id, manifest };
    return { commandEnv: `MEMORY_REALWORLD_${this.id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_COMMAND` };
  }

  ingest(): { latencyMs: number; raw: unknown } {
    return { latencyMs: 0, raw: { delegated: true } };
  }

  query(): QueryOutput {
    throw new Error("external command adapters return complete system output via setup command");
  }

  teardown(): void {
    return undefined;
  }

  runExternal(): SystemResult | undefined {
    if (!this.command || !this.payload) return undefined;
    const started = Date.now();
    const result = spawnSync(this.command, [], {
      input: `${JSON.stringify(this.payload)}\n`,
      encoding: "utf8",
      shell: true,
      timeout: Number(process.env.MEMORY_REALWORLD_COMMAND_TIMEOUT_MS ?? 300_000),
      maxBuffer: 20 * 1024 * 1024
    });
    if (result.status !== 0) return externalCommandBlockedSystem(this, result.stderr || result.error?.message || "external command failed", Date.now() - started);
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      return externalCommandBlockedSystem(this, `external command JSON parse failed: ${error instanceof Error ? error.message : String(error)}`, Date.now() - started);
    }
    return normalizeExternalSystem(this, parsed, Date.now() - started, manifestFromPayload(this.payload));
  }
}

async function runCommandAdapter(adapter: CommandAdapter, manifest: RealWorldManifest): Promise<SystemResult> {
  try {
    const setup = adapter.setup(manifest);
    const external = adapter.runExternal();
    if (!external) return externalCommandBlockedSystem(adapter, "external command did not produce a result", 0);
    return { ...external, setup: { ...external.setup, ...setup, manifestHash: sha256(stableStringify(manifest)) } };
  } catch (error) {
    return externalCommandBlockedSystem(adapter, error instanceof Error ? error.message : String(error), 0);
  }
}

function normalizeExternalSystem(adapter: CommandAdapter, value: any, latencyMs: number, manifest?: RealWorldManifest): SystemResult {
  let rawOutputs: QueryOutput[] | undefined;
  if (value && Array.isArray(value.rawOutputs)) {
    try {
      rawOutputs = manifest ? validateExternalRawOutputs(manifest, value.rawOutputs) : normalizeRawOutputsForDiagnostics(value.rawOutputs);
    } catch (error) {
      return externalRawOutputsBlockedSystem(
        adapter,
        normalizeRawOutputsForDiagnostics(value.rawOutputs),
        error instanceof Error ? error.message : String(error),
        latencyMs,
        value.setup ?? {},
        false
      );
    }
  }
  if (value && rawOutputs && (value.judge?.status === "blocked" || value.qualityClaimAllowed === false)) {
    const latencies = rawOutputs.map((output: QueryOutput) => Number(output?.latencyMs ?? 0)).sort((a: number, b: number) => a - b);
    let metrics: SystemResult["metrics"];
    try {
      metrics = normalizeExternalBlockedMetrics(value.metrics, latencies, latencyMs);
    } catch (error) {
      return externalRawOutputsBlockedSystem(
        adapter,
        rawOutputs,
        error instanceof Error ? error.message : String(error),
        latencyMs,
        value.setup ?? {},
        true,
        false
      );
    }
    return {
      system: adapter.id,
      displayName: adapter.displayName,
      evidenceClass: "same-run-command",
      adapterMode: "external-command",
      leaderboardEligible: false,
      qualityClaimAllowed: false,
      blockedReason: sanitizeDiagnosticText(typeof value.blockedReason === "string" ? value.blockedReason : typeof value.judge?.reason === "string" ? value.judge.reason : "external judge blocked after raw outputs were captured"),
      judge: {
        kind: "missing",
        status: "blocked",
        reason: sanitizeDiagnosticText(typeof value.judge?.reason === "string" ? value.judge.reason : "external judge blocked after raw outputs were captured")
      },
      metrics,
      buckets: value.buckets ?? {},
      retrievalDiagnostics: value.retrievalDiagnostics ?? {
        deterministicEvidenceIdMatch: false,
        expectedHits: 0,
        forbiddenHits: 0,
        abstentionNoResult: 0,
        note: "External command supplied raw outputs, but quality scoring was blocked before an LLM/harness judge completed."
      },
      rawOutputs,
      setup: sanitizeRecord(value.setup ?? {}) as Record<string, unknown>
    };
  }
  if (value && rawOutputs && value.metrics && (value.judge?.kind === "llm" || value.judge?.kind === "harness")) {
    let metrics: SystemResult["metrics"];
    try {
      metrics = normalizeExternalJudgedMetrics(value.metrics, latencyMs);
    } catch (error) {
      return externalRawOutputsBlockedSystem(
        adapter,
        rawOutputs,
        error instanceof Error ? error.message : String(error),
        latencyMs,
        value.setup ?? {}
      );
    }
    return {
      system: adapter.id,
      displayName: adapter.displayName,
      evidenceClass: "same-run-command",
      adapterMode: "external-command",
      leaderboardEligible: true,
      qualityClaimAllowed: true,
      judge: {
        kind: value.judge.kind,
        status: "passed",
        reason: typeof value.judge.reason === "string" ? value.judge.reason : "external system returned judged metrics"
      },
      metrics,
      buckets: value.buckets ?? {},
      retrievalDiagnostics: value.retrievalDiagnostics ?? {
        deterministicEvidenceIdMatch: false,
        expectedHits: 0,
        forbiddenHits: 0,
        abstentionNoResult: 0,
        note: "External command supplied judged metrics; local deterministic diagnostics were not applied."
      },
      rawOutputs,
      setup: sanitizeRecord(value.setup ?? {}) as Record<string, unknown>
    };
  }
  return externalCommandBlockedSystem(adapter, "external command JSON missing judged metrics/rawOutputs with judge.kind=llm|harness", latencyMs);
}

function manifestFromPayload(payload: unknown): RealWorldManifest | undefined {
  return isRecord(payload) && isRecord(payload.manifest) ? payload.manifest as RealWorldManifest : undefined;
}

function validateExternalRawOutputs(manifest: RealWorldManifest, value: unknown): QueryOutput[] {
  if (!Array.isArray(value)) throw new Error("external rawOutputs must be an array");
  const expectedQueries = new Map(manifest.queries.map((query) => [query.id, query]));
  const seen = new Set<string>();
  const outputs = value.map((item) => normalizeExternalRawOutput(item));
  for (const output of outputs) {
    if (!expectedQueries.has(output.queryId)) throw new Error(`external rawOutputs returned unknown queryId ${output.queryId || "<empty>"}`);
    if (seen.has(output.queryId)) throw new Error(`external rawOutputs returned duplicate queryId ${output.queryId}`);
    seen.add(output.queryId);
    const query = expectedQueries.get(output.queryId)!;
    if (output.retrievedEvidenceIds.length > query.topK) throw new Error(`external rawOutputs for ${output.queryId} exceeded topK evidence ids`);
    if (output.retrievedText.length > query.topK) throw new Error(`external rawOutputs for ${output.queryId} exceeded topK retrieved text items`);
  }
  const missing = [...expectedQueries.keys()].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`external rawOutputs did not return one output for every manifest query; missing ${missing.join(", ")}`);
  return manifest.queries.map((query) => outputs.find((output) => output.queryId === query.id)!);
}

function normalizeRawOutputsForDiagnostics(value: unknown): QueryOutput[] {
  return Array.isArray(value) ? value.map((item) => normalizeExternalRawOutput(item)) : [];
}

function normalizeExternalRawOutput(value: unknown): QueryOutput {
  const record = isRecord(value) ? value : {};
  return {
    queryId: typeof record.queryId === "string" ? record.queryId : String(record.queryId ?? ""),
    retrievedEvidenceIds: Array.isArray(record.retrievedEvidenceIds) ? record.retrievedEvidenceIds.filter((item): item is string => typeof item === "string") : [],
    retrievedText: Array.isArray(record.retrievedText) ? record.retrievedText.filter((item): item is string => typeof item === "string") : [],
    latencyMs: safeNonNegativeNumber(record.latencyMs, 0),
    raw: sanitizeRecord(record.raw ?? record)
  };
}

function validateJudgeDecisions(manifest: RealWorldManifest, decisions: JudgeDecision[]): JudgeDecision[] {
  const expectedIds = new Set(manifest.queries.map((query) => query.id));
  const seen = new Set<string>();
  for (const decision of decisions) {
    if (!expectedIds.has(decision.queryId)) throw new Error(`judge returned unknown queryId ${decision.queryId || "<empty>"}`);
    if (seen.has(decision.queryId)) throw new Error(`judge returned duplicate decision for queryId ${decision.queryId}`);
    seen.add(decision.queryId);
    strictRatioMetric(decision.score, `judge score for ${decision.queryId}`);
    strictRatioMetric(decision.confidence, `judge confidence for ${decision.queryId}`);
    strictBoolean(decision.passed, `judge passed for ${decision.queryId}`);
    strictBoolean(decision.supportsAnswer, `judge supportsAnswer for ${decision.queryId}`);
    strictBoolean(decision.abstained, `judge abstained for ${decision.queryId}`);
    strictBoolean(decision.leakedForbiddenEvidence, `judge leakedForbiddenEvidence for ${decision.queryId}`);
  }
  const missing = [...expectedIds].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`judge did not return one decision for every manifest query; missing ${missing.join(", ")}`);
  return manifest.queries.map((query) => decisions.find((decision) => decision.queryId === query.id)!);
}

function normalizeExternalJudgedMetrics(value: any, latencyMs: number): SystemResult["metrics"] {
  return {
    score: strictRatioMetric(value?.score, "external judged score"),
    recall: strictRatioMetric(value?.recall, "external judged recall"),
    abstentionPrecision: strictRatioMetric(value?.abstentionPrecision, "external judged abstentionPrecision"),
    forbiddenLeakageRate: strictRatioMetric(value?.forbiddenLeakageRate, "external judged forbiddenLeakageRate"),
    p50LatencyMs: strictNonNegativeNumber(value?.p50LatencyMs ?? latencyMs, "external p50LatencyMs"),
    p95LatencyMs: strictNonNegativeNumber(value?.p95LatencyMs ?? latencyMs, "external p95LatencyMs"),
    ingestLatencyMs: strictNonNegativeNumber(value?.ingestLatencyMs ?? 0, "external ingestLatencyMs"),
    estimatedCostUsd: strictNonNegativeNumber(value?.estimatedCostUsd ?? 0, "external estimatedCostUsd")
  };
}

function normalizeExternalBlockedMetrics(value: any, latencies: number[], latencyMs: number): SystemResult["metrics"] {
  return {
    score: null,
    recall: null,
    abstentionPrecision: null,
    forbiddenLeakageRate: null,
    p50LatencyMs: strictNonNegativeNumber(value?.p50LatencyMs ?? percentile(latencies, 0.5) ?? latencyMs, "blocked external p50LatencyMs"),
    p95LatencyMs: strictNonNegativeNumber(value?.p95LatencyMs ?? percentile(latencies, 0.95) ?? latencyMs, "blocked external p95LatencyMs"),
    ingestLatencyMs: strictNonNegativeNumber(value?.ingestLatencyMs ?? 0, "blocked external ingestLatencyMs"),
    estimatedCostUsd: strictNonNegativeNumber(value?.estimatedCostUsd ?? 0, "blocked external estimatedCostUsd")
  };
}

function metricsHaveFiniteCostLatency(metrics: SystemResult["metrics"]): boolean {
  return [metrics.p50LatencyMs, metrics.p95LatencyMs, metrics.ingestLatencyMs, metrics.estimatedCostUsd].every((value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
  );
}

function externalRawOutputsBlockedSystem(adapter: Adapter, rawOutputs: QueryOutput[], reason: string, latencyMs: number, setup: unknown, rawOutputContractValid = true, metricContractValid = true): SystemResult {
  const safeReason = sanitizeDiagnosticText(reason);
  const latencies = rawOutputs.map((output) => safeNonNegativeNumber(output?.latencyMs, 0)).sort((a, b) => a - b);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: "same-run-command",
    adapterMode: "external-command",
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    blockedReason: safeReason,
    judge: {
      kind: "missing",
      status: "blocked",
      reason: safeReason
    },
    metrics: {
      score: null,
      recall: null,
      abstentionPrecision: null,
      forbiddenLeakageRate: null,
      p50LatencyMs: percentile(latencies, 0.5) || latencyMs,
      p95LatencyMs: percentile(latencies, 0.95) || latencyMs,
      ingestLatencyMs: 0,
      estimatedCostUsd: 0
    },
    buckets: {},
    retrievalDiagnostics: {
      deterministicEvidenceIdMatch: false,
      expectedHits: 0,
      forbiddenHits: 0,
      abstentionNoResult: 0,
      note: "External command supplied raw outputs, but judged metrics failed the strict LLM/harness contract."
    },
    rawOutputs,
    setup: { ...(sanitizeRecord(setup ?? {}) as Record<string, unknown>), judgeBlocked: true, rawOutputContractValid, metricContractValid, reason: safeReason }
  };
}

async function runSystemWithCommandSupport(adapter: Adapter, manifest: RealWorldManifest, judge?: RealWorldJudge): Promise<SystemResult> {
  if (adapter instanceof CommandAdapter && adapter.adapterMode === "external-command") return runCommandAdapter(adapter, manifest);
  return runSystem(adapter, manifest, judge);
}

function improvementSignals(systems: SystemResult[]): Array<{ priority: string; item: string; evidence: string }> {
  const blocked = systems.filter((system) => system.evidenceClass === "credential-blocked");
  const originalCompetitors = systems.filter((system) => system.system !== "cognibrain" && system.evidenceClass !== "local-baseline");
  const eligible = systems.filter((system) => system.leaderboardEligible);
  const judgeBlocked = systems.filter((system) => system.evidenceClass !== "credential-blocked" && !system.qualityClaimAllowed);
  const cognibrain = systems.find((system) => system.system === "cognibrain");
  const signals: Array<{ priority: string; item: string; evidence: string }> = [];
  if (judgeBlocked.length > 0) {
    signals.push({
      priority: "P0",
      item: "Configure an LLM or harness judge before any quality claim.",
      evidence: `${judgeBlocked.length} executed systems are judge-blocked; set MEMORY_REALWORLD_JUDGE_COMMAND to produce scored results.`
    });
  }
  if (originalCompetitors.length === 0) {
    signals.push({
      priority: "P0",
      item: "Attach original competitor commands to the neutral black-box contract.",
      evidence: "0 original competitor product systems were requested or executed in this neutral harness."
    });
  } else if (blocked.length > 0) {
    signals.push({
      priority: "P0",
      item: "Attach remaining original competitor commands to the neutral black-box contract.",
      evidence: `${originalCompetitors.length} original competitor system(s) executed; ${blocked.length} system(s) are still credential/command blocked.`
    });
  } else {
    signals.push({
      priority: "P1",
      item: "Expand original competitor coverage beyond the first neutral smoke.",
      evidence: `${originalCompetitors.length} original competitor system(s) executed with judged metrics on this manifest.`
    });
  }
  if (eligible.length < 2) {
    signals.push({
      priority: "P0",
      item: "Keep leaderboard disabled until at least two original systems pass the same manifest.",
      evidence: `${eligible.length} original systems are currently eligible; the gate requires at least 2.`
    });
  } else {
    signals.push({
      priority: "P0",
      item: "Treat the result as a neutral smoke leaderboard, not a market-wide leaderboard.",
      evidence: `${eligible.length} original systems are eligible on realworld-blackbox-v1; broader market claims still need more systems and a larger third-party task set.`
    });
  }
  signals.push(
    {
      priority: "P1",
      item: "Track leakage, abstention, latency and setup failures as first-class metrics.",
      evidence: cognibrain?.qualityClaimAllowed
        ? `Cognibrain judged leakage rate is ${percent(cognibrain.metrics.forbiddenLeakageRate)}; p95 latency is ${cognibrain.metrics.p95LatencyMs} ms.`
        : `Cognibrain raw outputs are retained but quality scoring is blocked until an LLM/harness judge runs; p95 latency is ${cognibrain?.metrics.p95LatencyMs ?? 0} ms.`
    }
  );
  return signals;
}

function writeMarkdown(path: string, report: RealWorldReport): void {
  const lines = [
    "# Real-World Black-Box Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Manifest: \`${report.manifest.id}\` / \`${report.manifestHash}\``,
    "",
    `Status: \`${report.status}\``,
    "",
    "This is the neutral harness implementation. When the eligibility gate is true, it is a comparative smoke for this frozen manifest, not a market-wide leaderboard. Quality scores are reported only when an LLM/harness judge is configured.",
    "",
    "## Eligibility Gate",
    "",
    "| Gate | Result |",
    "| --- | --- |",
    ...Object.entries(report.eligibilityGate).map(([key, value]) => `| \`${key}\` | ${value ? "Pass" : "Blocked"} |`),
    "",
    "## Systems",
    "",
    "| System | Evidence class | Mode | Judge | Score | Recall | Abstention | Leakage | p95 latency | Eligible |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.systems.map((system) => `| ${system.displayName} | \`${system.evidenceClass}\` | \`${system.adapterMode}\` | \`${system.judge.kind}:${system.judge.status}\` | ${percent(system.metrics.score)} | ${percent(system.metrics.recall)} | ${percent(system.metrics.abstentionPrecision)} | ${percent(system.metrics.forbiddenLeakageRate)} | ${system.metrics.p95LatencyMs} ms | ${system.leaderboardEligible ? "Yes" : "No"} |`),
    "",
    "## Improvement Signals",
    "",
    "| Priority | Item | Evidence |",
    "| --- | --- | --- |",
    ...report.improvementSignals.map((item) => `| ${item.priority} | ${item.item} | ${item.evidence} |`),
    ""
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join("\n"));
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortValue(child)]));
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeRecord(value: unknown): unknown {
  if (typeof value === "string") return sanitizeDiagnosticText(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeRecord);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sanitizeRecord(item);
  }
  return output;
}

function sanitizeDiagnosticText(value: string): string {
  const redacted = value
    .split(/(\s+)/)
    .map((token) => shouldRedactToken(token) ? "[redacted:secret]" : token)
    .join("")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted:secret]")
    .replace(/Authorization:\s*\S+\s+\S+/gi, "Authorization: [redacted:secret]")
    .slice(0, 1200);
  return redacted;
}

function shouldRedactToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("sk-") || lower.startsWith("sk_")) return true;
  if (lower.includes("api_key=") || lower.includes("apikey=") || lower.includes("access_token=") || lower.includes("refresh_token=")) return true;
  const alnum = [...trimmed].filter((char) => /[a-z0-9]/i.test(char)).length;
  const symbol = [...trimmed].filter((char) => /[-_=./+]/.test(char)).length;
  return trimmed.length >= 48 && alnum >= 36 && symbol >= 2;
}

function percentile(values: number[], pct: number): number {
  if (!values.length) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * pct) - 1));
  return values[index];
}

function ratio(num: number, denom: number): number {
  return denom ? Number((num / denom).toFixed(4)) : 0;
}

function boundedMetric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function strictRatioMetric(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} must be a finite number in [0,1]`);
  }
  return value;
}

function strictNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number`);
  }
  return value;
}

function safeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function strictBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function overlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) if (b.has(token)) count += 1;
  return count / Math.max(1, a.size);
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "not scored";
  return `${(value * 100).toFixed(1)}%`;
}

function displayName(id: string): string {
  const names: Record<string, string> = {
    mem0: "Mem0",
    basicmemory: "Basic Memory",
    langmem: "LangMem",
    graphiti: "Graphiti",
    zep: "Zep",
    cognee: "Cognee",
    gbrain: "GBrain"
  };
  return names[id] ?? id;
}

function parseArgs(argv: string[]): Map<string, string> {
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const systems = args.get("--systems")?.split(",");
  const report = await generateRealWorldBlackBoxBenchmark({
    systems,
    out: args.get("--out") ?? "artifacts/realworld-blackbox.json",
    markdown: args.get("--markdown") ?? "artifacts/docs/realworld-blackbox.md",
    successOut: args.get("--success-out"),
    successMarkdown: args.get("--success-markdown")
  });
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    status: report.status,
    manifestHash: report.manifestHash,
    leaderboardEligible: report.leaderboardEligible,
    systems: report.systems.map((system) => ({
      system: system.system,
      evidenceClass: system.evidenceClass,
      judge: system.judge.kind,
      score: system.metrics.score,
      p95LatencyMs: system.metrics.p95LatencyMs,
      leaderboardEligible: system.leaderboardEligible,
      blockedReason: system.blockedReason
    }))
  }, null, 2));
  process.exit(report.leaderboardEligible ? 0 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
