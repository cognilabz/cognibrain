import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { MemoryService, type MemoryServiceOptions } from "../api/service";
import { JsonCommandMemoryIntelligence } from "../core/providers";

type EvidenceClass = "same-run-full" | "same-run-command" | "credential-blocked" | "local-baseline";
type AdapterMode = "generic-blackbox" | "external-command" | "blocked-command" | "lexical-baseline";
type JudgeKind = "llm" | "harness" | "missing" | "external-system";
type Bucket =
  | "customer-support-long-conversations"
  | "software-engineering-repo-work"
  | "third-party-oss-workflows"
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
  comparativeSmokeEligible: boolean;
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
  resourceFootprint?: ResourceFootprint;
}

interface ResourceFootprint {
  source: "central-harness-process";
  wallMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  rssStartMb: number;
  rssEndMb: number;
  rssDeltaMb: number;
  heapUsedStartMb: number;
  heapUsedEndMb: number;
  heapUsedDeltaMb: number;
  childProcess?: ChildProcessResourceFootprint;
}

interface ChildProcessResourceFootprint {
  source: "spawned-process-tree-sampling";
  pid: number | null;
  wallMs: number;
  sampleIntervalMs: number;
  samples: number;
  peakRssMb: number;
  peakCpuPercent: number;
  maxProcessCount: number;
  timedOut: boolean;
  signal: string | null;
}

interface RealWorldReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "realworld-blackbox";
  status: "neutral-harness-ready-results-not-leaderboard" | "comparative-smoke-eligible-results-not-market-leaderboard";
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
  judgeReadiness: {
    readyForThisRun: boolean;
    configuredJudgeCommand: boolean;
    activeKind: JudgeKind;
    configuredCommandEnv: "MEMORY_REALWORLD_JUDGE_COMMAND";
    openAiCompatibleHarnessJudge: {
      autoActivationAllowed: false;
      keyEnvPresent: boolean;
      keyEnvIgnoredForActivation: true;
      keyEnvNames: ["MEMORY_OPENAI_API_KEY", "OPENAI_API_KEY"];
      judgeScript: "scripts/benchmark/realworld-openai-judge.mjs";
      configuredBy: "MEMORY_REALWORLD_JUDGE_COMMAND";
      kindEnv: "MEMORY_REALWORLD_JUDGE_KIND";
      timeoutEnv: "MEMORY_REALWORLD_JUDGE_TIMEOUT_MS";
    };
    blockedReason: string | null;
    nextAction: string | null;
    runtimeIsolation: "benchmark-only";
    secretRedaction: string;
  };
  manifest: RealWorldManifest;
  eligibilityGate: {
    manifestCoverageReady: boolean;
    sameManifestForAllSystems: boolean;
    blackBoxContract: boolean;
    rawOutputsRetained: boolean;
    costLatencyRecorded: boolean;
    resourceTelemetryRecorded: boolean;
    llmOrHarnessJudged: boolean;
    enoughOriginalSystems: boolean;
  };
  systems: SystemResult[];
  leaderboardEligibleSystems: string[];
  comparativeSmokeEligibleSystems: string[];
  comparativeSmokeEligible: boolean;
  leaderboardEligible: boolean;
  marketClaimAllowed: boolean;
  claimBoundary: {
    proof: "realworld-smoke-diagnostic" | "realworld-central-judge-smoke";
    claimAllowed: boolean;
    comparativeSmokeEligible: boolean;
    leaderboardEligible: boolean;
    marketClaimAllowed: boolean;
    claimBlockers: string[];
  };
  operationalWeaknesses: {
    summary: {
      requestedSystems: number;
      executedSystems: number;
      blockedSystems: number;
      setupFailureRate: number;
      rawOutputCoverageRate: number;
      judgedSystems: number;
      judgeBlockedSystems: number;
      qualityClaimableSystems: number;
      totalEstimatedCostUsd: number;
      p50LatencyMs: number;
      p95LatencyMs: number;
      maxP95LatencyMs: number;
      maxIngestLatencyMs: number;
      resourceTelemetryRecorded: boolean;
      systemsMissingResourceTelemetry: string[];
      maxRssDeltaMb: number;
      maxHeapUsedDeltaMb: number;
      maxCpuMs: number;
      maxWallMs: number;
      commandResourceTelemetryRecorded: boolean;
      systemsMissingCommandResourceTelemetry: string[];
      maxCommandPeakRssMb: number;
      maxCommandPeakCpuPercent: number;
      maxCommandProcessCount: number;
    };
    rawErrorClasses: Array<{ className: string; count: number; systems: string[]; examples: string[] }>;
    bucketWeaknesses: Array<{
      bucket: string;
      totalQueries: number;
      scoredSystems: number;
      judgeBlockedSystems: number;
      missingBucketMetricsSystems: string[];
      bestScore: number | null;
      worstScore: number | null;
      systemsWithLeakage: string[];
      systemsWithZeroScore: string[];
    }>;
    systemWeaknesses: Array<{
      system: string;
      displayName: string;
      evidenceClass: EvidenceClass;
      setupStatus: "executed" | "blocked";
      judgeStatus: string;
      blockerClass: string | null;
      rawOutputCoverage: number;
      rawOutputCoverageRate: number;
      weakBuckets: string[];
      p95LatencyMs: number;
      estimatedCostUsd: number;
      resourceFootprint?: ResourceFootprint;
    }>;
  };
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
  const comparativeSmokeEligibleSystems = systems.filter((system) => system.comparativeSmokeEligible).map((system) => system.system);
  const cognibrainComparativeSmokeEligible = systems.some((system) => system.system === "cognibrain" && system.comparativeSmokeEligible);
  const originalCompetitorEligibleSystems = systems
    .filter((system) =>
      system.system !== "cognibrain" &&
      (system.evidenceClass === "same-run-full" || system.evidenceClass === "same-run-command") &&
      system.comparativeSmokeEligible
    )
    .map((system) => system.system);
  const manifestCoverageReady = manifest.queries.length >= 15 &&
    [...new Set(manifest.queries.map((query) => query.bucket))].every((bucket) => manifest.queries.filter((query) => query.bucket === bucket).length >= 3) &&
    manifest.queries.filter((query) => query.shouldAbstain).length >= 3;
  const eligibilityGate = {
    manifestCoverageReady,
    sameManifestForAllSystems: systems.every((system) => system.setup.manifestHash === manifestHash || system.evidenceClass === "credential-blocked"),
    blackBoxContract: systems.every((system) => ["generic-blackbox", "external-command", "blocked-command", "lexical-baseline"].includes(system.adapterMode)),
    rawOutputsRetained: systems.every((system) => system.evidenceClass === "credential-blocked" || (system.rawOutputs.length === manifest.queries.length && system.setup.rawOutputContractValid !== false)),
    costLatencyRecorded: systems.every((system) => metricsHaveFiniteCostLatency(system.metrics) && system.setup.metricContractValid !== false),
    resourceTelemetryRecorded: systems.every(hasResourceTelemetry),
    llmOrHarnessJudged: systems.every((system) => system.evidenceClass === "credential-blocked" || system.qualityClaimAllowed),
    enoughOriginalSystems: cognibrainComparativeSmokeEligible && originalCompetitorEligibleSystems.length >= 2
  };
  const comparativeSmokeEligible = Object.values(eligibilityGate).every(Boolean);
  const marketClaimAllowed = false;
  const leaderboardEligible = false;
  const claimBoundary = realWorldClaimBoundary(comparativeSmokeEligible);
  const report: RealWorldReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "realworld-blackbox",
    status: comparativeSmokeEligible ? "comparative-smoke-eligible-results-not-market-leaderboard" : "neutral-harness-ready-results-not-leaderboard",
    manifestHash,
    runProvenance: buildRunProvenance(requested, judge),
    judgeReadiness: buildJudgeReadiness(judge),
    manifest,
    eligibilityGate,
    systems,
    leaderboardEligibleSystems: [],
    comparativeSmokeEligibleSystems,
    comparativeSmokeEligible,
    leaderboardEligible,
    marketClaimAllowed,
    claimBoundary,
    operationalWeaknesses: buildOperationalWeaknessReport(manifest, systems),
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

function realWorldClaimBoundary(comparativeSmokeEligible: boolean): RealWorldReport["claimBoundary"] {
  return {
    proof: comparativeSmokeEligible ? "realworld-central-judge-smoke" : "realworld-smoke-diagnostic",
    claimAllowed: false,
    comparativeSmokeEligible,
    leaderboardEligible: false,
    marketClaimAllowed: false,
    claimBlockers: [
      ...(!comparativeSmokeEligible ? ["Comparative smoke requires Cognibrain plus at least two original systems judged by the same central LLM/harness judge on the frozen manifest."] : []),
      "Market leaderboard claims require a larger third-party-sourced task set beyond realworld-blackbox-v1.",
      "Market leaderboard claims require more original memory systems executed without repair on the same preregistered protocol.",
      "Market leaderboard claims require preregistered latency and cost budgets for the LLM/harness judge and all attached systems."
    ]
  };
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
  const evidenceCommand = process.env.MEMORY_REALWORLD_EVIDENCE_COMMAND;
  return {
    judge: {
      configured: Boolean(process.env.MEMORY_REALWORLD_JUDGE_COMMAND),
      kind: judge?.kind ?? "missing",
      commandEnv: "MEMORY_REALWORLD_JUDGE_COMMAND",
      commandFingerprint: process.env.MEMORY_REALWORLD_JUDGE_COMMAND ? sha256Text(process.env.MEMORY_REALWORLD_JUDGE_COMMAND) : null
    },
    intelligence: {
      configured: Boolean(evidenceCommand),
      commandEnv: "MEMORY_REALWORLD_EVIDENCE_COMMAND",
      commandFingerprint: evidenceCommand ? sha256Text(evidenceCommand) : null
    },
    externalCommands,
    redaction: "command values and diagnostic text are secret-redacted; fingerprints are sha256 for reproducibility without exposing credentials"
  };
}

function createRealWorldEvidenceIntelligence(): MemoryServiceOptions["intelligence"] | undefined {
  const command = process.env.MEMORY_REALWORLD_EVIDENCE_COMMAND;
  if (!command) return undefined;
  const provider = new JsonCommandMemoryIntelligence({
    command,
    args: process.env.MEMORY_REALWORLD_EVIDENCE_ARGS ? process.env.MEMORY_REALWORLD_EVIDENCE_ARGS.split(/\s+/).filter(Boolean) : undefined,
    timeoutMs: Number(process.env.MEMORY_REALWORLD_EVIDENCE_TIMEOUT_MS ?? 3500),
    cacheTtlMs: Number(process.env.MEMORY_REALWORLD_EVIDENCE_CACHE_TTL_MS ?? 30_000),
    cacheMaxEntries: Number(process.env.MEMORY_REALWORLD_EVIDENCE_CACHE_MAX_ENTRIES ?? 128),
    compactPayloads: process.env.MEMORY_REALWORLD_EVIDENCE_COMPACT_PAYLOADS !== "0" && process.env.MEMORY_REALWORLD_EVIDENCE_COMPACT_PAYLOADS !== "false"
  });
  return { evidenceJudge: provider };
}

function buildJudgeReadiness(judge?: RealWorldJudge): RealWorldReport["judgeReadiness"] {
  const configuredJudgeCommand = Boolean(process.env.MEMORY_REALWORLD_JUDGE_COMMAND);
  const keyEnvPresent = Boolean(process.env.MEMORY_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
  const readyForThisRun = Boolean(judge);
  return {
    readyForThisRun,
    configuredJudgeCommand,
    activeKind: judge?.kind ?? "missing",
    configuredCommandEnv: "MEMORY_REALWORLD_JUDGE_COMMAND",
    openAiCompatibleHarnessJudge: {
      autoActivationAllowed: false,
      keyEnvPresent,
      keyEnvIgnoredForActivation: true,
      keyEnvNames: ["MEMORY_OPENAI_API_KEY", "OPENAI_API_KEY"],
      judgeScript: "scripts/benchmark/realworld-openai-judge.mjs",
      configuredBy: "MEMORY_REALWORLD_JUDGE_COMMAND",
      kindEnv: "MEMORY_REALWORLD_JUDGE_KIND",
      timeoutEnv: "MEMORY_REALWORLD_JUDGE_TIMEOUT_MS"
    },
    blockedReason: readyForThisRun
      ? null
      : "No MEMORY_REALWORLD_JUDGE_COMMAND was configured, so raw outputs are retained but not scored. Generic OpenAI key env vars are ignored for judge activation.",
    nextAction: readyForThisRun
      ? null
      : "Set MEMORY_REALWORLD_JUDGE_COMMAND to an explicit LLM/harness scorer, for example node scripts/benchmark/realworld-openai-judge.mjs when the harness owns the provider credentials.",
    runtimeIsolation: "benchmark-only",
    secretRedaction: "Only boolean env presence and static env names are reported; secret values are never serialized, and key presence never configures judge commands."
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
      id: "support-orion-refund-webhook",
      bucket: "customer-support-long-conversations",
      source: "neutral-fixture:customer-support-thread",
      occurredAt: "2026-05-09T16:30:00.000Z",
      content: "Orion Market refund emails stopped because the webhook signer rotated keys without updating the notification worker. The fix was to refresh the signer secret and replay the May 9 refund webhook batch.",
      tags: ["customer-support", "orion", "refund", "webhook"]
    },
    {
      id: "support-meridian-auth-rollback",
      bucket: "customer-support-long-conversations",
      source: "neutral-fixture:customer-support-thread",
      occurredAt: "2026-05-10T11:45:00.000Z",
      content: "Meridian Health login failures came from a bad SAML audience value in the Friday deploy. Support confirmed the incident ended after rolling back the SAML audience change.",
      tags: ["customer-support", "meridian", "saml", "auth"]
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
      id: "oss-rate-limit-helper",
      bucket: "software-engineering-repo-work",
      source: "neutral-fixture:oss-issue-pr",
      occurredAt: "2026-05-12T13:10:00.000Z",
      content: "In the TypeScript gateway repo, pull request 88 moved retry throttling into src/rateLimit/backoffPolicy.ts because reviewers rejected inline setTimeout calls in route handlers.",
      tags: ["oss", "typescript", "rate-limit", "review"]
    },
    {
      id: "oss-generated-client-boundary",
      bucket: "software-engineering-repo-work",
      source: "neutral-fixture:oss-issue-pr",
      occurredAt: "2026-05-13T09:35:00.000Z",
      content: "The SDK issue about adding partner status was resolved by editing src/models/partnerStatus.ts and regenerating clients later. Reviewers explicitly said not to hand edit generated/openapi.generated.ts.",
      tags: ["oss", "generated-file", "sdk", "review"]
    },
    {
      id: "thirdparty-next-axios-abortsignal-memory-leak",
      bucket: "third-party-oss-workflows",
      source: "https://github.com/vercel/next.js/issues/84884",
      occurredAt: "2025-10-15T00:00:00.000Z",
      content: "In vercel/next.js issue 84884, the reporter described a memory leak in Next.js middleware when axios used AbortSignal.timeout with the fetch adapter. The reproduction used next-abort-signal-memory-leak-reproduction, built the app, ran node mockServer.js, sent 1,000 requests, captured heap snapshots with kill -USR2 against the next-server PID, and found that the middleware axios path retained signal/abort objects while fetch or removing AbortSignal avoided the leak.",
      tags: ["third-party-oss", "github-issue", "nextjs", "middleware", "memory-leak", "axios", "abortsignal"]
    },
    {
      id: "thirdparty-next-turbopack-fast-refresh-loop",
      bucket: "third-party-oss-workflows",
      source: "https://github.com/vercel/next.js/issues/78957",
      occurredAt: "2025-05-08T00:00:00.000Z",
      content: "In vercel/next.js issue 78957, the Turbopack dev-mode Fast Refresh bug was reproduced from elliason/fast-refresh-error-reproduction by starting the app in dev mode, visiting /grid, and reloading. The observed failure was repeated Fast Refresh logs plus repeated 404 requests for toast component files such as src/components/toast/index.ts and use-toast.ts; the reporter noted it affected next dev with --turbo on Next.js 15.2.0 through 15.4.0-canary.24, not production builds, not webpack, and not Next.js 15.1.7 or lower.",
      tags: ["third-party-oss", "github-issue", "nextjs", "turbopack", "fast-refresh", "hmr"]
    },
    {
      id: "thirdparty-pytest-asyncio-unused-mode-warning",
      bucket: "third-party-oss-workflows",
      source: "https://github.com/pytest-dev/pytest-asyncio/issues/293",
      occurredAt: "2022-02-15T00:00:00.000Z",
      content: "In pytest-dev/pytest-asyncio issue 293, the reporter showed pytest-asyncio 0.18.1 warning about asyncio_mode even when the test suite did not use asyncio. A clean directory with only def test_lala(): pass still emitted a DeprecationWarning that the asyncio_mode default would change to strict and suggested explicitly setting asyncio_mode=strict or auto; the requested behavior was to warn only when pytest-asyncio was actually used in a test.",
      tags: ["third-party-oss", "github-issue", "pytest-asyncio", "configuration-warning", "strict-mode"]
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
      id: "notes-harbor-shortcut",
      bucket: "personal-project-notes",
      source: "neutral-fixture:project-notes",
      occurredAt: "2026-04-22T08:00:00.000Z",
      content: "Harbor Notes uses Command-K for the quick capture drawer and Shift-Command-K for full search. Avery asked to keep those shortcuts distinct.",
      tags: ["project-notes", "harbor", "shortcut", "avery"]
    },
    {
      id: "notes-luna-offline-mode",
      bucket: "personal-project-notes",
      source: "neutral-fixture:project-notes",
      occurredAt: "2026-04-23T08:00:00.000Z",
      content: "Luna Journal should open in offline mode by default during travel weeks. Sync can resume only after Avery turns the travel toggle off.",
      tags: ["project-notes", "luna", "offline", "travel"]
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
      id: "temporal-helio-owner-old",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:ownership-log",
      occurredAt: "2026-03-03T12:00:00.000Z",
      content: "Helio Search ownership sat with the platform indexing team during the March rollout.",
      tags: ["ownership", "helio", "old"]
    },
    {
      id: "temporal-helio-owner-current",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:ownership-log",
      occurredAt: "2026-05-19T12:00:00.000Z",
      content: "Helio Search ownership moved from platform indexing to the relevance team on May 19. Relevance is the current owner.",
      tags: ["ownership", "helio", "current"]
    },
    {
      id: "temporal-cache-old",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:architecture-log",
      occurredAt: "2026-03-15T12:00:00.000Z",
      content: "Atlas Reporting used Redis for scheduled report cache warming in March.",
      tags: ["architecture", "atlas-reporting", "cache", "old"]
    },
    {
      id: "temporal-cache-current",
      bucket: "temporal-updates-contradictions",
      source: "neutral-fixture:architecture-log",
      occurredAt: "2026-05-22T12:00:00.000Z",
      content: "Atlas Reporting moved scheduled cache warming from Redis to Dragonfly on May 22, and Dragonfly is now the active cache warmer.",
      tags: ["architecture", "atlas-reporting", "cache", "current"]
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
    },
    {
      id: "privacy-sam-bank-token",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:private-note",
      occurredAt: "2026-05-22T13:00:00.000Z",
      content: "Private bank verification phrase for Sam is amber-river-42. This is private and must never be returned in public retrieval.",
      tags: ["private", "bank", "sam"],
      private: true
    },
    {
      id: "deleted-api-key",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:deleted-note",
      occurredAt: "2026-05-23T10:00:00.000Z",
      content: "Temporary API key TMP-991 was created for the load test rehearsal.",
      tags: ["deleted", "api-key"]
    },
    {
      id: "delete-api-key",
      bucket: "negative-and-privacy-boundaries",
      source: "neutral-fixture:deleted-note",
      occurredAt: "2026-05-23T10:10:00.000Z",
      content: "Delete the temporary API key TMP-991 after the load test rehearsal.",
      tags: ["delete", "api-key"],
      deleteTargetId: "deleted-api-key"
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
        id: "q-support-orion-refund",
        bucket: "customer-support-long-conversations",
        question: "Why were Orion Market refund emails missing and what fixed them?",
        expectedEvidenceIds: ["support-orion-refund-webhook"],
        topK: 3
      },
      {
        id: "q-support-meridian-login",
        bucket: "customer-support-long-conversations",
        question: "What ended the Meridian Health login incident?",
        expectedEvidenceIds: ["support-meridian-auth-rollback"],
        topK: 3
      },
      {
        id: "q-oss-rate-limit-placement",
        bucket: "software-engineering-repo-work",
        question: "Where did reviewers want gateway retry throttling implemented?",
        expectedEvidenceIds: ["oss-rate-limit-helper"],
        topK: 3
      },
      {
        id: "q-oss-generated-client",
        bucket: "software-engineering-repo-work",
        question: "Which source file changed for partner status, and which generated file was off-limits?",
        expectedEvidenceIds: ["oss-generated-client-boundary"],
        topK: 3
      },
      {
        id: "q-thirdparty-next-axios-memory-leak",
        bucket: "third-party-oss-workflows",
        question: "In the public Next.js issue about axios and AbortSignal, which middleware path leaked memory and what reproduction steps proved it?",
        expectedEvidenceIds: ["thirdparty-next-axios-abortsignal-memory-leak"],
        topK: 3
      },
      {
        id: "q-thirdparty-next-turbopack-refresh-loop",
        bucket: "third-party-oss-workflows",
        question: "What reproduced the Next.js Turbopack Fast Refresh loop and which route/component requests were involved?",
        expectedEvidenceIds: ["thirdparty-next-turbopack-fast-refresh-loop"],
        topK: 3
      },
      {
        id: "q-thirdparty-pytest-asyncio-warning",
        bucket: "third-party-oss-workflows",
        question: "What did pytest-asyncio issue 293 warn about even without asyncio tests, and what behavior did the reporter want instead?",
        expectedEvidenceIds: ["thirdparty-pytest-asyncio-unused-mode-warning"],
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
        id: "q-harbor-shortcuts",
        bucket: "personal-project-notes",
        question: "What are Harbor Notes' quick capture and full search shortcuts?",
        expectedEvidenceIds: ["notes-harbor-shortcut"],
        topK: 3
      },
      {
        id: "q-luna-travel-mode",
        bucket: "personal-project-notes",
        question: "When should Luna Journal default to offline mode?",
        expectedEvidenceIds: ["notes-luna-offline-mode"],
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
        id: "q-helio-current-owner",
        bucket: "temporal-updates-contradictions",
        question: "Who currently owns Helio Search?",
        expectedEvidenceIds: ["temporal-helio-owner-current"],
        forbiddenEvidenceIds: ["temporal-helio-owner-old"],
        topK: 3
      },
      {
        id: "q-atlas-cache-current",
        bucket: "temporal-updates-contradictions",
        question: "What is the current cache warmer for Atlas Reporting?",
        expectedEvidenceIds: ["temporal-cache-current"],
        forbiddenEvidenceIds: ["temporal-cache-old"],
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
        id: "q-private-bank-token",
        bucket: "negative-and-privacy-boundaries",
        question: "What is Sam's private bank verification phrase?",
        expectedEvidenceIds: [],
        forbiddenEvidenceIds: ["privacy-sam-bank-token"],
        shouldAbstain: true,
        topK: 3
      },
      {
        id: "q-deleted-api-key",
        bucket: "negative-and-privacy-boundaries",
        question: "What was the temporary API key for the load test?",
        expectedEvidenceIds: [],
        forbiddenEvidenceIds: ["deleted-api-key"],
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
  const resourceSample = startResourceSample();
  try {
    const manifestHash = sha256(stableStringify(manifest));
    const setup = await adapter.setup(manifest);
    const ingest = await adapter.ingest(manifest.events);
    const rawOutputs: QueryOutput[] = [];
    for (const query of manifest.queries) rawOutputs.push(await adapter.query(query));
    await adapter.teardown();
    const result = scoreSystem(adapter, manifest, { ...setup, manifestHash, ingestRaw: ingest.raw }, rawOutputs, ingest.latencyMs, judge);
    return attachResourceFootprint(result, finishResourceSample(resourceSample));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return attachResourceFootprint(blockedSystem(adapter, message, Date.now() - started), finishResourceSample(resourceSample));
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
      comparativeSmokeEligible: false,
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
  let estimatedCostUsd: number;
  try {
    decisions = validateJudgeDecisions(manifest, judged.decisions);
    estimatedCostUsd = judgeEstimatedCostUsd(judged.raw, judge.kind);
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
    comparativeSmokeEligible: originalRun,
    leaderboardEligible: false,
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
      estimatedCostUsd
    },
    buckets,
    retrievalDiagnostics: diagnostics,
    rawOutputs,
    setup: { ...setup, judgeRaw: judged.raw }
  };
}

function judgeEstimatedCostUsd(raw: unknown, kind: RealWorldJudge["kind"]): number {
  if (kind === "harness") return 0;
  const cost = isRecord(raw) && isRecord(raw.judge) ? raw.judge.estimatedCostUsd : undefined;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) {
    throw new Error("LLM real-world judge must report positive estimatedCostUsd for cost accounting");
  }
  const usage = isRecord(raw) && isRecord(raw.judge) ? raw.judge.usage : undefined;
  if (!isRecord(usage)) {
    throw new Error("LLM real-world judge must report token usage for cost accounting");
  }
  return cost;
}

function judgeBlockedSystem(adapter: Adapter, setup: Record<string, unknown>, rawOutputs: QueryOutput[], ingestLatencyMs: number, diagnostics: SystemResult["retrievalDiagnostics"], reason: string): SystemResult {
  const latencies = rawOutputs.map((output) => output.latencyMs).sort((a, b) => a - b);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: adapter.evidenceClass,
    adapterMode: adapter.adapterMode,
    comparativeSmokeEligible: false,
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
    comparativeSmokeEligible: false,
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
    comparativeSmokeEligible: false,
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
  private service = new MemoryService({ autoDream: { enabled: false }, intelligence: createRealWorldEvidenceIntelligence() });
  private ids = new Map<string, string>();

  setup(manifest: RealWorldManifest): Record<string, unknown> {
    this.service = new MemoryService({ autoDream: { enabled: false }, intelligence: createRealWorldEvidenceIntelligence() });
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

  async runExternal(): Promise<{ system: SystemResult | undefined; childProcess?: ChildProcessResourceFootprint }> {
    if (!this.command || !this.payload) return { system: undefined };
    const started = Date.now();
    const result = await runShellCommandWithResourceTelemetry(this.command, {
      input: `${JSON.stringify(this.payload)}\n`,
      timeoutMs: Number(process.env.MEMORY_REALWORLD_COMMAND_TIMEOUT_MS ?? 300_000),
      maxBuffer: 20 * 1024 * 1024,
      sampleIntervalMs: Number(process.env.MEMORY_REALWORLD_COMMAND_RESOURCE_SAMPLE_MS ?? 50)
    });
    if (result.status !== 0) {
      return {
        system: externalCommandBlockedSystem(this, result.stderr || result.errorMessage || "external command failed", Date.now() - started),
        childProcess: result.resource
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (error) {
      return {
        system: externalCommandBlockedSystem(this, `external command JSON parse failed: ${error instanceof Error ? error.message : String(error)}`, Date.now() - started),
        childProcess: result.resource
      };
    }
    return {
      system: normalizeExternalSystem(this, parsed, Date.now() - started, manifestFromPayload(this.payload)),
      childProcess: result.resource
    };
  }
}

async function runCommandAdapter(adapter: CommandAdapter, manifest: RealWorldManifest, judge?: RealWorldJudge): Promise<SystemResult> {
  const resourceSample = startResourceSample();
  try {
    const setup = adapter.setup(manifest);
    const externalRun = await adapter.runExternal();
    const external = externalRun.system;
    if (!external) return attachResourceFootprint(externalCommandBlockedSystem(adapter, "external command did not produce a result", 0), finishResourceSample(resourceSample, externalRun.childProcess));
    const mergedSetup = { ...external.setup, ...setup, manifestHash: sha256(stableStringify(manifest)) };
    if (judge && external.rawOutputs.length === manifest.queries.length && external.setup.rawOutputContractValid !== false) {
      const result = scoreSystem(adapter, manifest, mergedSetup, external.rawOutputs, external.metrics.ingestLatencyMs, judge);
      return attachResourceFootprint(result, finishResourceSample(resourceSample, externalRun.childProcess));
    }
    return attachResourceFootprint({ ...external, setup: mergedSetup }, finishResourceSample(resourceSample, externalRun.childProcess));
  } catch (error) {
    return attachResourceFootprint(externalCommandBlockedSystem(adapter, error instanceof Error ? error.message : String(error), 0), finishResourceSample(resourceSample));
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
      comparativeSmokeEligible: false,
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
    return externalRawOutputsBlockedSystem(
      adapter,
      rawOutputs,
      "External command supplied judged metrics, but central MEMORY_REALWORLD_JUDGE_COMMAND recomputation is required before quality claims are allowed.",
      latencyMs,
      value.setup ?? {}
    );
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
  const queriesById = new Map(manifest.queries.map((query) => [query.id, query]));
  const expectedIds = new Set(queriesById.keys());
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
    validateJudgeDecisionSemantics(queriesById.get(decision.queryId)!, decision);
  }
  const missing = [...expectedIds].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`judge did not return one decision for every manifest query; missing ${missing.join(", ")}`);
  return manifest.queries.map((query) => decisions.find((decision) => decision.queryId === query.id)!);
}

function validateJudgeDecisionSemantics(query: RealWorldQuery, decision: JudgeDecision): void {
  if (decision.leakedForbiddenEvidence && (decision.passed || decision.score !== 0)) {
    throw new Error(`judge decision for ${decision.queryId} is inconsistent: forbidden leakage must force passed=false and score=0`);
  }
  if (decision.abstained && decision.supportsAnswer) {
    throw new Error(`judge decision for ${decision.queryId} is inconsistent: abstained=true cannot also support the answer`);
  }
  if (decision.passed && decision.score <= 0) {
    throw new Error(`judge decision for ${decision.queryId} is inconsistent: passed=true requires a positive semantic score`);
  }
  if (query.shouldAbstain && decision.passed && (!decision.abstained || decision.supportsAnswer || decision.leakedForbiddenEvidence)) {
    throw new Error(`judge decision for ${decision.queryId} is inconsistent: abstention queries can pass only by abstaining without answer support or leakage`);
  }
  if (!query.shouldAbstain && query.expectedEvidenceIds.length > 0 && decision.passed && (!decision.supportsAnswer || decision.abstained || decision.leakedForbiddenEvidence)) {
    throw new Error(`judge decision for ${decision.queryId} is inconsistent: answer queries can pass only with semantic answer support and no abstention or leakage`);
  }
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

function startResourceSample(): { startedAt: number; cpu: NodeJS.CpuUsage; memory: NodeJS.MemoryUsage } {
  return { startedAt: Date.now(), cpu: process.cpuUsage(), memory: process.memoryUsage() };
}

function finishResourceSample(sample: ReturnType<typeof startResourceSample>, childProcess?: ChildProcessResourceFootprint): ResourceFootprint {
  const cpu = process.cpuUsage(sample.cpu);
  const memory = process.memoryUsage();
  const rssStartMb = bytesToMb(sample.memory.rss);
  const rssEndMb = bytesToMb(memory.rss);
  const heapUsedStartMb = bytesToMb(sample.memory.heapUsed);
  const heapUsedEndMb = bytesToMb(memory.heapUsed);
  return {
    source: "central-harness-process",
    wallMs: Date.now() - sample.startedAt,
    cpuUserMs: roundResource(cpu.user / 1000),
    cpuSystemMs: roundResource(cpu.system / 1000),
    rssStartMb,
    rssEndMb,
    rssDeltaMb: roundResource(rssEndMb - rssStartMb),
    heapUsedStartMb,
    heapUsedEndMb,
    heapUsedDeltaMb: roundResource(heapUsedEndMb - heapUsedStartMb),
    ...(childProcess ? { childProcess } : {})
  };
}

async function runShellCommandWithResourceTelemetry(command: string, options: { input: string; timeoutMs: number; maxBuffer: number; sampleIntervalMs: number }): Promise<{
  status: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  errorMessage?: string;
  resource: ChildProcessResourceFootprint;
}> {
  const started = Date.now();
  const sampleIntervalMs = Math.max(10, Math.min(1_000, Math.floor(options.sampleIntervalMs)));
  const child = spawn(command, [], {
    shell: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  let errorMessage: string | undefined;
  let timedOut = false;
  let peakRssKb = 0;
  let peakCpuPercent = 0;
  let maxProcessCount = 0;
  let samples = 0;
  const sample = () => {
    if (!child.pid) return;
    const tree = sampleProcessTree(child.pid);
    samples += 1;
    peakRssKb = Math.max(peakRssKb, tree.rssKb);
    peakCpuPercent = Math.max(peakCpuPercent, tree.cpuPercent);
    maxProcessCount = Math.max(maxProcessCount, tree.processCount);
  };
  const interval = setInterval(sample, sampleIntervalMs);
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, Math.max(1, options.timeoutMs));
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout += chunk;
    if (stdout.length > options.maxBuffer) {
      errorMessage = "external command stdout exceeded maxBuffer";
      child.kill("SIGTERM");
    }
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
    if (stderr.length > options.maxBuffer) {
      errorMessage = "external command stderr exceeded maxBuffer";
      child.kill("SIGTERM");
    }
  });
  child.stdin?.end(options.input);
  return new Promise((resolve) => {
    child.on("error", (error) => {
      errorMessage = error.message;
    });
    child.on("close", (status, signal) => {
      sample();
      clearInterval(interval);
      clearTimeout(timeout);
      resolve({
        status,
        signal,
        stdout,
        stderr,
        errorMessage,
        resource: {
          source: "spawned-process-tree-sampling",
          pid: child.pid ?? null,
          wallMs: Date.now() - started,
          sampleIntervalMs,
          samples,
          peakRssMb: roundResource(peakRssKb / 1024),
          peakCpuPercent: roundResource(peakCpuPercent),
          maxProcessCount,
          timedOut,
          signal
        }
      });
    });
  });
}

function sampleProcessTree(rootPid: number): { rssKb: number; cpuPercent: number; processCount: number } {
  try {
    const result = spawnSync("ps", ["-axo", "pid=,ppid=,rss=,pcpu="], {
      encoding: "utf8",
      timeout: 1_000,
      maxBuffer: 5 * 1024 * 1024
    });
    if (result.status !== 0 || !result.stdout) return { rssKb: 0, cpuPercent: 0, processCount: 0 };
    const rows = result.stdout.split("\n")
      .map((line) => {
        const [pidText, ppidText, rssText, cpuText] = line.trim().split(/\s+/);
        return {
          pid: Number(pidText),
          ppid: Number(ppidText),
          rssKb: Number(rssText),
          cpuPercent: Number(cpuText)
        };
      })
      .filter((row) => Number.isFinite(row.pid) && Number.isFinite(row.ppid));
    const children = new Map<number, typeof rows>();
    for (const row of rows) {
      const siblings = children.get(row.ppid) ?? [];
      siblings.push(row);
      children.set(row.ppid, siblings);
    }
    const pending = [rootPid];
    const pids = new Set<number>();
    while (pending.length) {
      const pid = pending.pop();
      if (!pid || pids.has(pid)) continue;
      pids.add(pid);
      for (const child of children.get(pid) ?? []) pending.push(child.pid);
    }
    const treeRows = rows.filter((row) => pids.has(row.pid));
    return {
      rssKb: treeRows.reduce((sum, row) => sum + safeNonNegativeNumber(row.rssKb, 0), 0),
      cpuPercent: treeRows.reduce((sum, row) => sum + safeNonNegativeNumber(row.cpuPercent, 0), 0),
      processCount: treeRows.length
    };
  } catch {
    return { rssKb: 0, cpuPercent: 0, processCount: 0 };
  }
}

function attachResourceFootprint(system: SystemResult, resourceFootprint: ResourceFootprint): SystemResult {
  return { ...system, resourceFootprint };
}

function hasResourceTelemetry(system: SystemResult): boolean {
  const resource = system.resourceFootprint;
  return Boolean(
    resource &&
    resource.source === "central-harness-process" &&
    [resource.wallMs, resource.cpuUserMs, resource.cpuSystemMs, resource.rssStartMb, resource.rssEndMb, resource.rssDeltaMb, resource.heapUsedStartMb, resource.heapUsedEndMb, resource.heapUsedDeltaMb].every((value) =>
      typeof value === "number" && Number.isFinite(value)
    )
  );
}

function bytesToMb(value: number): number {
  return roundResource(value / (1024 * 1024));
}

function roundResource(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(3));
}

function externalRawOutputsBlockedSystem(adapter: Adapter, rawOutputs: QueryOutput[], reason: string, latencyMs: number, setup: unknown, rawOutputContractValid = true, metricContractValid = true): SystemResult {
  const safeReason = sanitizeDiagnosticText(reason);
  const latencies = rawOutputs.map((output) => safeNonNegativeNumber(output?.latencyMs, 0)).sort((a, b) => a - b);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    evidenceClass: "same-run-command",
    adapterMode: "external-command",
    comparativeSmokeEligible: false,
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
  if (adapter instanceof CommandAdapter && adapter.adapterMode === "external-command") return runCommandAdapter(adapter, manifest, judge);
  return runSystem(adapter, manifest, judge);
}

function buildOperationalWeaknessReport(manifest: RealWorldManifest, systems: SystemResult[]): RealWorldReport["operationalWeaknesses"] {
  const totalQueries = manifest.queries.length;
  const executedSystems = systems.filter((system) => system.evidenceClass !== "credential-blocked").length;
  const blockedSystems = systems.length - executedSystems;
  const rawOutputSystems = systems.filter((system) => system.rawOutputs.length === totalQueries).length;
  const latencies = systems.flatMap((system) => system.rawOutputs.map((output) => output.latencyMs)).sort((a, b) => a - b);
  const resourceFootprints = systems.map((system) => system.resourceFootprint).filter((resource): resource is ResourceFootprint => Boolean(resource));
  const systemsMissingResourceTelemetry = systems.filter((system) => !hasResourceTelemetry(system)).map((system) => system.system);
  const commandSystems = systems.filter((system) => system.adapterMode === "external-command");
  const commandResourceFootprints = commandSystems.map((system) => system.resourceFootprint?.childProcess).filter((resource): resource is ChildProcessResourceFootprint => Boolean(resource));
  const systemsMissingCommandResourceTelemetry = commandSystems.filter((system) => !system.resourceFootprint?.childProcess).map((system) => system.system);
  const bucketWeaknesses = [...new Set(manifest.queries.map((query) => query.bucket))].map((bucket) => {
    const total = manifest.queries.filter((query) => query.bucket === bucket).length;
    const scored = systems.filter((system) => system.qualityClaimAllowed && system.buckets[bucket]);
    const scores = scored.map((system) => system.buckets[bucket].score);
    return {
      bucket,
      totalQueries: total,
      scoredSystems: scored.length,
      judgeBlockedSystems: systems.filter((system) => system.evidenceClass !== "credential-blocked" && !system.qualityClaimAllowed).length,
      missingBucketMetricsSystems: systems.filter((system) => !system.buckets[bucket]).map((system) => system.system),
      bestScore: scores.length ? Math.max(...scores) : null,
      worstScore: scores.length ? Math.min(...scores) : null,
      systemsWithLeakage: systems.filter((system) => (system.metrics.forbiddenLeakageRate ?? 0) > 0).map((system) => system.system),
      systemsWithZeroScore: systems.filter((system) => system.qualityClaimAllowed && system.buckets[bucket]?.score === 0).map((system) => system.system)
    };
  });
  return {
    summary: {
      requestedSystems: systems.length,
      executedSystems,
      blockedSystems,
      setupFailureRate: ratio(blockedSystems, systems.length),
      rawOutputCoverageRate: ratio(rawOutputSystems, systems.length),
      judgedSystems: systems.filter((system) => system.judge.status === "passed").length,
      judgeBlockedSystems: systems.filter((system) => system.judge.status === "blocked").length,
      qualityClaimableSystems: systems.filter((system) => system.qualityClaimAllowed).length,
      totalEstimatedCostUsd: Number(systems.reduce((sum, system) => sum + system.metrics.estimatedCostUsd, 0).toFixed(6)),
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      maxP95LatencyMs: Math.max(0, ...systems.map((system) => system.metrics.p95LatencyMs)),
      maxIngestLatencyMs: Math.max(0, ...systems.map((system) => system.metrics.ingestLatencyMs)),
      resourceTelemetryRecorded: systemsMissingResourceTelemetry.length === 0,
      systemsMissingResourceTelemetry,
      maxRssDeltaMb: roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.rssDeltaMb))),
      maxHeapUsedDeltaMb: roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.heapUsedDeltaMb))),
      maxCpuMs: roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.cpuUserMs + resource.cpuSystemMs))),
      maxWallMs: roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.wallMs))),
      commandResourceTelemetryRecorded: systemsMissingCommandResourceTelemetry.length === 0,
      systemsMissingCommandResourceTelemetry,
      maxCommandPeakRssMb: roundResource(Math.max(0, ...commandResourceFootprints.map((resource) => resource.peakRssMb))),
      maxCommandPeakCpuPercent: roundResource(Math.max(0, ...commandResourceFootprints.map((resource) => resource.peakCpuPercent))),
      maxCommandProcessCount: Math.max(0, ...commandResourceFootprints.map((resource) => resource.maxProcessCount))
    },
    rawErrorClasses: groupedRawErrorClasses(systems, totalQueries),
    bucketWeaknesses,
    systemWeaknesses: systems.map((system) => {
      const blockerClass = classifyOperationalBlocker(system, totalQueries);
      return {
        system: system.system,
        displayName: system.displayName,
        evidenceClass: system.evidenceClass,
        setupStatus: system.evidenceClass === "credential-blocked" ? "blocked" : "executed",
        judgeStatus: `${system.judge.kind}:${system.judge.status}`,
        blockerClass,
        rawOutputCoverage: system.rawOutputs.length,
        rawOutputCoverageRate: ratio(system.rawOutputs.length, totalQueries),
        weakBuckets: Object.entries(system.buckets).filter(([, bucket]) => bucket.score < 1).map(([bucket]) => bucket),
        p95LatencyMs: system.metrics.p95LatencyMs,
        estimatedCostUsd: system.metrics.estimatedCostUsd,
        resourceFootprint: system.resourceFootprint
      };
    })
  };
}

function groupedRawErrorClasses(systems: SystemResult[], totalQueries: number): Array<{ className: string; count: number; systems: string[]; examples: string[] }> {
  const groups = new Map<string, { className: string; count: number; systems: string[]; examples: string[] }>();
  for (const system of systems) {
    const className = classifyOperationalBlocker(system, totalQueries);
    if (!className) continue;
    const group = groups.get(className) ?? { className, count: 0, systems: [], examples: [] };
    group.count += 1;
    group.systems.push(system.system);
    if (system.blockedReason && group.examples.length < 3) group.examples.push(system.blockedReason);
    groups.set(className, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.className.localeCompare(b.className));
}

function classifyOperationalBlocker(system: SystemResult, totalQueries: number): string | null {
  if (system.evidenceClass === "credential-blocked") return "external-system-not-configured";
  if (system.setup.commandBlocked === true) return "external-command-failed";
  if (system.setup.rawOutputContractValid === false) return "raw-output-contract-invalid";
  if (system.setup.metricContractValid === false) return "metric-contract-invalid";
  if (system.rawOutputs.length > 0 && totalQueries > 0 && system.rawOutputs.length < totalQueries) return "partial-raw-output";
  if (system.rawOutputs.length > 0 && system.judge.status === "blocked") return "central-judge-blocked";
  if (system.rawOutputs.length === 0 && system.judge.status === "blocked") return "no-raw-output";
  return null;
}

function improvementSignals(systems: SystemResult[]): Array<{ priority: string; item: string; evidence: string }> {
  const blocked = systems.filter((system) => system.evidenceClass === "credential-blocked");
  const originalCompetitors = systems.filter((system) => system.system !== "cognibrain" && system.evidenceClass !== "local-baseline");
  const cognibrainEligible = systems.some((system) => system.system === "cognibrain" && system.comparativeSmokeEligible);
  const eligibleCompetitors = systems.filter((system) =>
    system.system !== "cognibrain" &&
    (system.evidenceClass === "same-run-full" || system.evidenceClass === "same-run-command") &&
    system.comparativeSmokeEligible
  );
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
  if (!cognibrainEligible || eligibleCompetitors.length < 2) {
    signals.push({
      priority: "P0",
      item: "Keep leaderboard disabled until Cognibrain and at least two original competitors pass the same judged manifest.",
      evidence: `Cognibrain eligible: ${cognibrainEligible}; eligible original competitors: ${eligibleCompetitors.length}; the gate requires Cognibrain plus at least 2.`
    });
  } else {
    signals.push({
      priority: "P0",
      item: "Treat the result as a neutral smoke leaderboard, not a market-wide leaderboard.",
      evidence: `Cognibrain and ${eligibleCompetitors.length} original competitors are eligible on realworld-blackbox-v1; broader market claims still need more systems and a larger third-party task set.`
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
  const resourceFootprints = systems.map((system) => system.resourceFootprint).filter((resource): resource is ResourceFootprint => Boolean(resource));
  const commandSystems = systems.filter((system) => system.adapterMode === "external-command");
  const commandResourceFootprints = commandSystems.map((system) => system.resourceFootprint?.childProcess).filter((resource): resource is ChildProcessResourceFootprint => Boolean(resource));
  if (resourceFootprints.length === systems.length) {
    signals.push({
      priority: "P1",
      item: "Keep memory and CPU usage visible beside quality and latency.",
      evidence: `Central harness resource telemetry recorded for ${resourceFootprints.length} systems; max RSS delta ${roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.rssDeltaMb)))} MB and max CPU ${roundResource(Math.max(0, ...resourceFootprints.map((resource) => resource.cpuUserMs + resource.cpuSystemMs)))} ms.`
    });
  } else {
    signals.push({
      priority: "P0",
      item: "Require central resource telemetry before any real-world leaderboard use.",
      evidence: `${systems.length - resourceFootprints.length} system(s) are missing central RSS/CPU telemetry.`
    });
  }
  if (commandSystems.length > 0 && commandResourceFootprints.length === commandSystems.length) {
    signals.push({
      priority: "P1",
      item: "Compare original/native runner resource cost with spawned process telemetry.",
      evidence: `Spawned process-tree telemetry recorded for ${commandResourceFootprints.length} command runner(s); max peak RSS ${roundResource(Math.max(0, ...commandResourceFootprints.map((resource) => resource.peakRssMb)))} MB and max peak CPU ${roundResource(Math.max(0, ...commandResourceFootprints.map((resource) => resource.peakCpuPercent)))}%.`
    });
  } else if (commandSystems.length > 0) {
    signals.push({
      priority: "P0",
      item: "Require spawned process telemetry for original/native command runners.",
      evidence: `${commandSystems.length - commandResourceFootprints.length} command runner(s) are missing process-tree RSS/CPU telemetry.`
    });
  }
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
    `Comparative smoke eligible: ${report.comparativeSmokeEligible ? "yes" : "no"}. Market claim allowed: ${report.marketClaimAllowed ? "yes" : "no"}. Leaderboard eligible: ${report.leaderboardEligible ? "yes" : "no"}.`,
    "",
    "This is the neutral harness implementation. When the eligibility gate is true, it is a comparative smoke for this frozen manifest, not a market-wide leaderboard. Quality scores are reported only when an LLM/harness judge is configured.",
    "",
    "## Judge Readiness",
    "",
    "| Check | Value |",
    "| --- | --- |",
    `| Ready for this run | ${report.judgeReadiness.readyForThisRun ? "yes" : "no"} |`,
    `| Active kind | \`${report.judgeReadiness.activeKind}\` |`,
    `| Configured command env | \`${report.judgeReadiness.configuredCommandEnv}\` = ${report.judgeReadiness.configuredJudgeCommand ? "present" : "missing"} |`,
    `| OpenAI-compatible judge script | \`${report.judgeReadiness.openAiCompatibleHarnessJudge.judgeScript}\` |`,
    `| Generic OpenAI key env ignored for activation | ${report.judgeReadiness.openAiCompatibleHarnessJudge.keyEnvIgnoredForActivation ? "yes" : "no"} |`,
    `| Runtime isolation | \`${report.judgeReadiness.runtimeIsolation}\` |`,
    `| Blocked reason | ${report.judgeReadiness.blockedReason ?? "none"} |`,
    `| Next action | ${report.judgeReadiness.nextAction ?? "none"} |`,
    "",
    "Claim blockers:",
    "",
    ...report.claimBoundary.claimBlockers.map((item) => `- ${item}`),
    "",
    "## Eligibility Gate",
    "",
    "| Gate | Result |",
    "| --- | --- |",
    ...Object.entries(report.eligibilityGate).map(([key, value]) => `| \`${key}\` | ${value ? "Pass" : "Blocked"} |`),
    "",
    "## Systems",
    "",
    "| System | Evidence class | Mode | Judge | Score | Recall | Abstention | Leakage | p95 latency | RSS delta | CPU | Command peak RSS | Command peak CPU | Smoke eligible |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.systems.map((system) => `| ${system.displayName} | \`${system.evidenceClass}\` | \`${system.adapterMode}\` | \`${system.judge.kind}:${system.judge.status}\` | ${percent(system.metrics.score)} | ${percent(system.metrics.recall)} | ${percent(system.metrics.abstentionPrecision)} | ${percent(system.metrics.forbiddenLeakageRate)} | ${system.metrics.p95LatencyMs} ms | ${system.resourceFootprint ? `${system.resourceFootprint.rssDeltaMb} MB` : "n/a"} | ${system.resourceFootprint ? `${roundResource(system.resourceFootprint.cpuUserMs + system.resourceFootprint.cpuSystemMs)} ms` : "n/a"} | ${system.resourceFootprint?.childProcess ? `${system.resourceFootprint.childProcess.peakRssMb} MB` : "n/a"} | ${system.resourceFootprint?.childProcess ? `${system.resourceFootprint.childProcess.peakCpuPercent}%` : "n/a"} | ${system.comparativeSmokeEligible ? "Yes" : "No"} |`),
    "",
    "## Operational Weaknesses",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Requested systems | ${report.operationalWeaknesses.summary.requestedSystems} |`,
    `| Executed systems | ${report.operationalWeaknesses.summary.executedSystems} |`,
    `| Blocked systems | ${report.operationalWeaknesses.summary.blockedSystems} |`,
    `| Setup failure rate | ${percent(report.operationalWeaknesses.summary.setupFailureRate)} |`,
    `| Raw-output coverage rate | ${percent(report.operationalWeaknesses.summary.rawOutputCoverageRate)} |`,
    `| Judged systems | ${report.operationalWeaknesses.summary.judgedSystems} |`,
    `| Judge-blocked systems | ${report.operationalWeaknesses.summary.judgeBlockedSystems} |`,
    `| Total estimated scorer/system cost | $${report.operationalWeaknesses.summary.totalEstimatedCostUsd.toFixed(6)} |`,
    `| p95 query latency | ${report.operationalWeaknesses.summary.p95LatencyMs} ms |`,
    `| Resource telemetry recorded | ${report.operationalWeaknesses.summary.resourceTelemetryRecorded ? "yes" : "no"} |`,
    `| Systems missing resource telemetry | ${report.operationalWeaknesses.summary.systemsMissingResourceTelemetry.join(", ") || "none"} |`,
    `| Max RSS delta | ${report.operationalWeaknesses.summary.maxRssDeltaMb} MB |`,
    `| Max heap-used delta | ${report.operationalWeaknesses.summary.maxHeapUsedDeltaMb} MB |`,
    `| Max CPU | ${report.operationalWeaknesses.summary.maxCpuMs} ms |`,
    `| Max wall time | ${report.operationalWeaknesses.summary.maxWallMs} ms |`,
    `| Command resource telemetry recorded | ${report.operationalWeaknesses.summary.commandResourceTelemetryRecorded ? "yes" : "no"} |`,
    `| Command systems missing resource telemetry | ${report.operationalWeaknesses.summary.systemsMissingCommandResourceTelemetry.join(", ") || "none"} |`,
    `| Max command peak RSS | ${report.operationalWeaknesses.summary.maxCommandPeakRssMb} MB |`,
    `| Max command peak CPU | ${report.operationalWeaknesses.summary.maxCommandPeakCpuPercent}% |`,
    `| Max command process count | ${report.operationalWeaknesses.summary.maxCommandProcessCount} |`,
    "",
    "### Raw Error Classes",
    "",
    "| Class | Count | Systems |",
    "| --- | ---: | --- |",
    ...report.operationalWeaknesses.rawErrorClasses.map((item) => `| \`${item.className}\` | ${item.count} | ${item.systems.join(", ")} |`),
    "",
    "### Bucket Weaknesses",
    "",
    "| Bucket | Scored systems | Judge-blocked systems | Best score | Worst score | Missing metrics |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...report.operationalWeaknesses.bucketWeaknesses.map((bucket) => `| \`${bucket.bucket}\` | ${bucket.scoredSystems} | ${bucket.judgeBlockedSystems} | ${percent(bucket.bestScore)} | ${percent(bucket.worstScore)} | ${bucket.missingBucketMetricsSystems.join(", ") || "none"} |`),
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
	    comparativeSmokeEligible: report.comparativeSmokeEligible,
	    leaderboardEligible: report.leaderboardEligible,
	    marketClaimAllowed: report.marketClaimAllowed,
	    claimBlockers: report.claimBoundary.claimBlockers,
	    systems: report.systems.map((system) => ({
      system: system.system,
      evidenceClass: system.evidenceClass,
      judge: system.judge.kind,
      score: system.metrics.score,
      p95LatencyMs: system.metrics.p95LatencyMs,
      comparativeSmokeEligible: system.comparativeSmokeEligible,
      leaderboardEligible: system.leaderboardEligible,
      blockedReason: system.blockedReason
    }))
  }, null, 2));
  process.exit(report.leaderboardEligible ? 0 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
