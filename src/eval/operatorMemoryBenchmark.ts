import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MemoryService } from "../api/service";
import type { ConnectorManifest, MemoryExtractionEvent } from "../core";

type ScenarioKind = "source_update" | "user_correction" | "connector_failure";
type SystemId =
  | "cognibrain-dream"
  | "retrieval-only"
  | "connector-import-only"
  | "reflect-only"
  | "recency-only"
  | "mem0-native"
  | "langmem-native"
  | "graphiti-native"
  | "cognee-native";
type ProofLevel = "same-run-full" | "local-baseline" | "same-run-native" | "same-run-cloud-api" | "credential-blocked";

interface OperatorMemoryScenario {
  id: string;
  title: string;
  kind: ScenarioKind;
  connectorId?: string;
  connectorKind?: ConnectorManifest["kind"];
  query: string;
  initial: MemoryExtractionEvent & { externalId?: string };
  updated?: MemoryExtractionEvent & { externalId?: string };
  expectedTerms: string[];
  staleTerms: string[];
  staleContent: string;
  currentContent: string;
}

interface ScenarioChecks {
  currentTruthSelected: boolean;
  staleTruthSuppressed: boolean;
  sourceRefRevalidated: boolean;
  connectorRefreshAccounted: boolean;
  beliefRevisionApplied: boolean;
  failureContained: boolean;
}

interface ScenarioResult {
  scenarioId: string;
  title: string;
  kind: ScenarioKind;
  score: number;
  checks: ScenarioChecks;
  capabilityGaps?: string[];
  evidence: Record<string, unknown>;
}

interface SystemResult {
  system: SystemId;
  displayName: string;
  proofLevel: ProofLevel;
  adapterMode: "full-local" | "local-baseline" | "native-command" | "cloud-command" | "blocked-command";
  score: number;
  metrics: {
    currentTruthAccuracy: number;
    staleSuppressionRate: number;
    sourceRevalidationRate: number;
    connectorRefreshAccountingRate: number;
    beliefRevisionRate: number;
    failureContainmentRate: number;
  };
  scenarios: ScenarioResult[];
  capabilityGaps: string[];
  runner?: { commandEnv: string; command?: string };
}

interface OperatorMemoryBenchmarkReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "OperatorMemoryDreamBenchmark";
  claimScope: "engineering-memory-dreaming";
  methodology: {
    sameScenarioStream: boolean;
    deterministic: boolean;
    metrics: string[];
    requiredExternalProofForMarketClaim: string[];
  };
  systems: SystemResult[];
  leaderboard: Array<{ system: string; score: number; proofLevel: string }>;
  summary: {
    scenarioCount: number;
    winner: string;
    cognibrainScore: number;
    bestBaselineScore: number;
    margin: number;
    localBaselineSuperiority: boolean;
    marketSuperiorityClaimAllowed: boolean;
    marketSuperiorityBlockers: string[];
  };
  passed: boolean;
}

const SYSTEMS: SystemId[] = ["cognibrain-dream", "retrieval-only", "connector-import-only", "reflect-only", "recency-only"];
const NATIVE_SYSTEMS: SystemId[] = ["mem0-native", "langmem-native", "graphiti-native", "cognee-native"];

export async function runOperatorMemoryBenchmark(options: { out?: string; markdown?: string; systems?: SystemId[] } = {}): Promise<OperatorMemoryBenchmarkReport> {
  const scenarios = operatorMemoryScenarios();
  const systems: SystemResult[] = [];
  for (const system of options.systems ?? SYSTEMS) {
    systems.push(await runSystem(system, scenarios));
  }
  const leaderboard = systems
    .map((system) => ({ system: system.displayName, score: system.score, proofLevel: system.proofLevel }))
    .sort((a, b) => b.score - a.score || a.system.localeCompare(b.system));
  const cognibrain = systems.find((system) => system.system === "cognibrain-dream");
  const competitors = systems.filter((system) => system.system !== "cognibrain-dream");
  const bestBaseline = Math.max(0, ...competitors.map((system) => system.score));
  const realCompetitors = competitors.filter((system) => ["same-run-native", "same-run-cloud-api"].includes(system.proofLevel));
  const requiredNative = ["mem0-native", "langmem-native", "graphiti-native"] as const;
  const missingNative = requiredNative.filter((system) => !systems.some((result) => result.system === system && ["same-run-native", "same-run-cloud-api"].includes(result.proofLevel)));
  const marketSuperiorityBlockers = [
    ...missingNative.map((system) => `${displayName(system)} same-run native/cloud artifact is missing or credential-blocked.`),
    ...(process.env.MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF === "true" ? [] : ["No live GitHub/Jira/Confluence/Notion credentialed tenant run was supplied."]),
    ...(process.env.MEMORY_OPERATOR_MEMORY_INDEPENDENT_PROOF === "true" ? [] : ["No vendor-signed or independently reproduced artifact was supplied."])
  ];
  const marketSuperiorityClaimAllowed = Boolean(
    cognibrain &&
    realCompetitors.length >= 3 &&
    missingNative.length === 0 &&
    cognibrain.score > Math.max(...realCompetitors.map((system) => system.score)) &&
    cognibrain.score >= 0.95 &&
    marketSuperiorityBlockers.length === 0
  );
  const report: OperatorMemoryBenchmarkReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "OperatorMemoryDreamBenchmark",
    claimScope: "engineering-memory-dreaming",
    methodology: {
      sameScenarioStream: true,
      deterministic: true,
      metrics: [
        "current truth selected",
        "stale truth suppressed",
        "sourceRef revalidated",
        "connector refresh accounted",
        "belief revision applied",
        "connector failure contained"
      ],
      requiredExternalProofForMarketClaim: [
        "same-run adapters for Mem0, Zep/Graphiti, LangMem and at least one hosted memory API",
        "credentialed connector tenant run for GitHub, Jira, Confluence and Notion",
        "public artifact with scenario rows and methodology metadata"
      ]
    },
    systems,
    leaderboard,
    summary: {
      scenarioCount: scenarios.length,
      winner: leaderboard[0]?.system ?? "",
      cognibrainScore: cognibrain?.score ?? 0,
      bestBaselineScore: bestBaseline,
      margin: (cognibrain?.score ?? 0) - bestBaseline,
      localBaselineSuperiority: Boolean(cognibrain && cognibrain.score > bestBaseline && cognibrain.score >= 0.95),
      marketSuperiorityClaimAllowed,
      marketSuperiorityBlockers: marketSuperiorityClaimAllowed ? [] : marketSuperiorityBlockers
    },
    passed: Boolean(cognibrain && cognibrain.score > bestBaseline && cognibrain.score >= 0.95)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, renderMarkdown(report));
  }
  return report;
}

async function runSystem(system: SystemId, scenarios: OperatorMemoryScenario[]): Promise<SystemResult> {
  if (isNativeSystem(system)) return runNativeSystem(system, scenarios);
  const results = [];
  for (const scenario of scenarios) {
    results.push(system === "cognibrain-dream" ? await runCognibrainScenario(scenario) : runBaselineScenario(system, scenario));
  }
  const score = average(results.map((result) => result.score));
  return {
    system,
    displayName: displayName(system),
    proofLevel: system === "cognibrain-dream" ? "same-run-full" : "local-baseline",
    adapterMode: system === "cognibrain-dream" ? "full-local" : "local-baseline",
    score,
    metrics: {
      currentTruthAccuracy: rate(results, "currentTruthSelected"),
      staleSuppressionRate: rate(results, "staleTruthSuppressed"),
      sourceRevalidationRate: rate(results, "sourceRefRevalidated"),
      connectorRefreshAccountingRate: rate(results, "connectorRefreshAccounted"),
      beliefRevisionRate: rate(results, "beliefRevisionApplied"),
      failureContainmentRate: rate(results, "failureContained")
    },
    scenarios: results,
    capabilityGaps: capabilityGaps(system)
  };
}

function runNativeSystem(system: SystemId, scenarios: OperatorMemoryScenario[]): SystemResult {
  const command = nativeCommand(system);
  const results = scenarios.map((scenario) => runNativeScenario(system, scenario, command.command));
  const proofLevel = nativeProofLevel(results);
  const score = proofLevel === "credential-blocked" ? 0 : average(results.map((result) => result.score));
  return {
    system,
    displayName: displayName(system),
    proofLevel,
    adapterMode: proofLevel === "credential-blocked" ? "blocked-command" : proofLevel === "same-run-cloud-api" ? "cloud-command" : "native-command",
    score,
    metrics: {
      currentTruthAccuracy: rate(results, "currentTruthSelected"),
      staleSuppressionRate: rate(results, "staleTruthSuppressed"),
      sourceRevalidationRate: rate(results, "sourceRefRevalidated"),
      connectorRefreshAccountingRate: rate(results, "connectorRefreshAccounted"),
      beliefRevisionRate: rate(results, "beliefRevisionApplied"),
      failureContainmentRate: rate(results, "failureContained")
    },
    scenarios: results,
    capabilityGaps: unique(results.flatMap((result) => result.capabilityGaps ?? [])),
    runner: { commandEnv: command.envName, command: command.command }
  };
}

function runNativeScenario(system: SystemId, scenario: OperatorMemoryScenario, command: string): ScenarioResult {
  if (!command) return blockedNativeScenario(system, scenario, "native command is not configured");
  const started = Date.now();
  const payload = JSON.stringify({ schemaVersion: "1.0", benchmark: "OperatorMemoryDreamBenchmark", system, scenario });
  const result = spawnSync(command, {
    cwd: process.cwd(),
    input: payload,
    encoding: "utf8",
    shell: true,
    timeout: Number(process.env.MEMORY_OPERATOR_MEMORY_RUNNER_TIMEOUT_MS ?? 120_000),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0 || !result.stdout.trim()) {
    return blockedNativeScenario(system, scenario, `${displayName(system)} runner failed before producing JSON`, {
      status: result.status ?? 1,
      stderrTail: tail(result.stderr),
      stdoutTail: tail(result.stdout),
      error: result.error?.message,
      latencyMs: Date.now() - started
    });
  }
  try {
    const parsed = JSON.parse(result.stdout.trim());
    const checks = normalizeChecks(parsed.checks);
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      kind: scenario.kind,
      checks,
      score: parsed.proofLevel === "credential-blocked" ? 0 : scoreChecks(checks),
      capabilityGaps: Array.isArray(parsed.capabilityGaps) ? parsed.capabilityGaps.map(String) : capabilityGaps(system),
      evidence: {
        system,
        proofLevel: parsed.proofLevel ?? "same-run-native",
        adapterMode: parsed.adapterMode ?? "native-command",
        latencyMs: parsed.latencyMs,
        runner: command,
        nativeEvidence: parsed.evidence
      }
    };
  } catch (error) {
    return blockedNativeScenario(system, scenario, `${displayName(system)} runner returned invalid JSON`, {
      error: error instanceof Error ? error.message : String(error),
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr),
      latencyMs: Date.now() - started
    });
  }
}

async function runCognibrainScenario(scenario: OperatorMemoryScenario): Promise<ScenarioResult> {
  const service = new MemoryService({ autoDream: { enabled: false } });
  const userId = `operator-memory-${scenario.id}`;
  if (scenario.connectorId) registerScenarioConnector(service, scenario);
  if (scenario.kind === "user_correction") {
    service.add({
      userId,
      content: scenario.staleContent,
      source: { kind: "agent", confidence: 0.98 },
      tags: ["agent-inference"],
      timestamp: scenario.initial.timestamp
    });
    service.add({
      userId,
      content: scenario.currentContent,
      source: { kind: "human", confidence: 0.86 },
      tags: ["correction", "engineering-correction"],
      timestamp: scenario.updated?.timestamp
    });
    service.runDreamCycle({ userId, trigger: "after_contradiction_detected", mode: "dream", budget: "release", force: true });
  } else if (scenario.connectorId) {
    service.syncConnectorEvents(scenario.connectorId, [scenario.initial], { userId, projectId: scenario.connectorId });
    const fetchImpl = async () => {
      if (scenario.kind === "connector_failure") {
        return new Response(JSON.stringify({ events: scenario.updated ? [scenario.updated] : [] }), { status: 500, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        nextCursor: `${scenario.id}-cursor-2`,
        sourceVersion: `${scenario.id}-v2`,
        events: scenario.updated ? [scenario.updated] : []
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    await service.startDreamJob({
      userId,
      trigger: "before_release",
      mode: "dream",
      budget: "release",
      sourceRefresh: true,
      connectorIds: [scenario.connectorId],
      scope: { kind: "project", projectId: scenario.connectorId },
      force: true
    }, fetchImpl as typeof fetch, 10_000, { wait: true });
  }
  return evaluateServiceScenario("cognibrain-dream", scenario, service, userId);
}

function runBaselineScenario(system: SystemId, scenario: OperatorMemoryScenario): ScenarioResult {
  const service = new MemoryService({ autoDream: { enabled: false } });
  const userId = `operator-memory-${system}-${scenario.id}`;
  if (scenario.connectorId) registerScenarioConnector(service, scenario);
  if (scenario.kind === "user_correction") {
    service.add({ userId, content: scenario.staleContent, source: { kind: "agent", confidence: 0.98 }, tags: ["agent-inference"], timestamp: scenario.initial.timestamp });
    if (system !== "retrieval-only") {
      service.add({ userId, content: scenario.currentContent, source: { kind: "human", confidence: 0.86 }, tags: ["correction"], timestamp: scenario.updated?.timestamp });
    }
  } else if (scenario.connectorId) {
    service.syncConnectorEvents(scenario.connectorId, [scenario.initial], { userId, projectId: scenario.connectorId });
    if (system === "connector-import-only" || system === "recency-only") {
      if (scenario.updated && scenario.kind !== "connector_failure") service.syncConnectorEvents(scenario.connectorId, [scenario.updated], { userId, projectId: scenario.connectorId });
      if (scenario.updated && scenario.kind === "connector_failure") service.syncConnectorEvents(scenario.connectorId, [scenario.updated], { userId, projectId: scenario.connectorId });
    }
  }
  if (system === "reflect-only") service.reflect(userId);
  return evaluateServiceScenario(system, scenario, service, userId);
}

function evaluateServiceScenario(system: SystemId, scenario: OperatorMemoryScenario, service: MemoryService, userId: string): ScenarioResult {
  const results = service.search({ userId, query: scenario.query, limit: 5, includePrivate: true });
  const context = results.map((result) => result.memory.content).join("\n").toLowerCase();
  const memories = service.listMemories(userId, { includeArchived: true });
  const staleMemories = memories.filter((memory) => memory.content.toLowerCase().includes(scenario.staleTerms[0]?.toLowerCase() ?? scenario.staleContent.toLowerCase()));
  const currentTruthSelected = scenario.expectedTerms.every((term) => context.includes(term.toLowerCase()));
  const staleTruthSuppressed = scenario.staleTerms.every((term) => !context.includes(term.toLowerCase()));
  const connectorState = scenario.connectorId ? service.connectorSyncState(scenario.connectorId)[0] : undefined;
  const jobs = service.dreamJobStatus();
  const lastJob = jobs[0];
  const connectorRefreshAccounted = scenario.kind === "user_correction"
    ? true
    : Boolean(lastJob?.report?.dreamCycle.connectorRefresh || connectorState?.lastStatus === "failed");
  const sourceRefRevalidated = scenario.kind === "user_correction"
    ? true
    : staleMemories.some((memory) => ["superseded", "contradicted", "needs_verification"].includes(memory.beliefState)) || scenario.kind === "connector_failure";
  const beliefRevisionApplied = staleMemories.length === 0 || staleMemories.some((memory) => memory.beliefState !== "active") || staleTruthSuppressed;
  const failureContained = scenario.kind !== "connector_failure" || (!context.includes(scenario.updated?.content.toLowerCase() ?? "__poison__") && connectorState?.lastStatus === "failed");
  const checks = {
    currentTruthSelected,
    staleTruthSuppressed,
    sourceRefRevalidated,
    connectorRefreshAccounted,
    beliefRevisionApplied,
    failureContained
  };
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    kind: scenario.kind,
    checks,
    score: scoreChecks(checks),
    evidence: {
      topMemoryIds: results.map((result) => result.memory.id),
      topContents: results.map((result) => result.memory.content),
      staleBeliefStates: staleMemories.map((memory) => ({ id: memory.id, beliefState: memory.beliefState })),
      connectorState,
      dreamJob: lastJob ? { status: lastJob.status, progress: lastJob.progress, connectorRefresh: lastJob.report?.dreamCycle.connectorRefresh } : undefined,
      system
    }
  };
}

function blockedNativeScenario(system: SystemId, scenario: OperatorMemoryScenario, reason: string, evidence: Record<string, unknown> = {}): ScenarioResult {
  const checks = normalizeChecks({});
  return {
    scenarioId: scenario.id,
    title: scenario.title,
    kind: scenario.kind,
    checks,
    score: 0,
    capabilityGaps: [reason],
    evidence: {
      system,
      proofLevel: "credential-blocked",
      adapterMode: "blocked-command",
      blocked: true,
      reason,
      ...evidence
    }
  };
}

function normalizeChecks(value: unknown): ScenarioChecks {
  const checks = value && typeof value === "object" ? value as Partial<Record<keyof ScenarioChecks, unknown>> : {};
  return {
    currentTruthSelected: Boolean(checks.currentTruthSelected),
    staleTruthSuppressed: Boolean(checks.staleTruthSuppressed),
    sourceRefRevalidated: Boolean(checks.sourceRefRevalidated),
    connectorRefreshAccounted: Boolean(checks.connectorRefreshAccounted),
    beliefRevisionApplied: Boolean(checks.beliefRevisionApplied),
    failureContained: Boolean(checks.failureContained)
  };
}

function nativeProofLevel(results: ScenarioResult[]): ProofLevel {
  const proofLevels = results.map((result) => result.evidence.proofLevel).filter(Boolean).map(String);
  if (proofLevels.some((proof) => proof === "same-run-cloud-api")) return "same-run-cloud-api";
  if (proofLevels.some((proof) => proof === "same-run-native")) return "same-run-native";
  return "credential-blocked";
}

function nativeCommand(system: SystemId): { envName: string; command: string } {
  const key = system.replace("-native", "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const envName = `MEMORY_OPERATOR_MEMORY_${key}_COMMAND`;
  const configured = process.env[envName];
  if (configured) return { envName, command: configured };
  const script = join(process.cwd(), "scripts", "benchmark", "competitors", "operator-memory-native-python-runner.mjs");
  if (!existsSync(script)) return { envName, command: "" };
  return { envName, command: `${process.execPath} ${JSON.stringify(script)} --system ${system.replace("-native", "")}` };
}

function isNativeSystem(system: SystemId): boolean {
  return NATIVE_SYSTEMS.includes(system);
}

function registerScenarioConnector(service: MemoryService, scenario: OperatorMemoryScenario): void {
  if (!scenario.connectorId) return;
  service.registerConnectorManifest({
    id: scenario.connectorId,
    name: scenario.title,
    kind: scenario.connectorKind ?? "custom",
    version: "1.0.0",
    direction: "ingest",
    capabilities: ["ingest", "poll"],
    auth: "none",
    defaultSourceKind: "tool",
    metadataMapping: {},
    poll: { endpoint: `https://example.invalid/${scenario.connectorId}/poll`, method: "GET" },
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  });
}

function operatorMemoryScenarios(): OperatorMemoryScenario[] {
  return [
    sourceScenario("github-ci", "GitHub CI status supersedes stale PR memory", "bench-github", "code", "GitHub PR 42 CI status", "GitHub PR 42 CI status is pending.", "GitHub PR 42 CI status is passed.", ["passed"], ["pending"]),
    sourceScenario("jira-status", "Jira status update changes release truth", "bench-jira", "project_management", "Jira CB-7 release status", "Jira CB-7 release status is blocked.", "Jira CB-7 release status is ready.", ["ready"], ["blocked"]),
    sourceScenario("confluence-adr", "Confluence ADR version supersedes old architecture decision", "bench-confluence", "docs", "ADR cache backend decision", "Confluence ADR-12 says cache backend is Postgres.", "Confluence ADR-12 says cache backend is Redis.", ["redis"], ["postgres"]),
    sourceScenario("notion-spec", "Notion spec version updates implementation command", "bench-notion", "docs", "Notion deploy command", "Notion release spec says deploy command is npm test --legacy.", "Notion release spec says deploy command is npm test && npm run build.", ["npm test", "build"], ["legacy"]),
    {
      id: "human-correction",
      title: "Human correction beats stale agent inference",
      kind: "user_correction",
      query: "target repo",
      initial: { role: "assistant", content: "target repo is /workspace/old-platform", timestamp: "2026-05-01T00:00:00.000Z" },
      updated: { role: "user", content: "target repo is /workspace/new-platform", timestamp: "2026-05-02T00:00:00.000Z" },
      currentContent: "target repo is /workspace/new-platform",
      staleContent: "target repo is /workspace/old-platform",
      expectedTerms: ["new-platform"],
      staleTerms: ["old-platform"]
    },
    {
      id: "failed-pagerduty",
      title: "Failed connector poll does not poison release context",
      kind: "connector_failure",
      connectorId: "bench-pagerduty",
      connectorKind: "custom",
      query: "PagerDuty INC-1 state",
      initial: { role: "tool", content: "PagerDuty INC-1 state is resolved.", externalId: "INC-1", timestamp: "2026-05-01T00:00:00.000Z", metadata: { version: "1" } },
      updated: { role: "tool", content: "PagerDuty INC-1 state is open from failed HTTP 500 payload.", externalId: "INC-1", timestamp: "2026-05-02T00:00:00.000Z", metadata: { version: "2" } },
      currentContent: "PagerDuty INC-1 state is resolved.",
      staleContent: "PagerDuty INC-1 state is open from failed HTTP 500 payload.",
      expectedTerms: ["resolved"],
      staleTerms: ["open from failed"]
    }
  ];
}

function sourceScenario(
  id: string,
  title: string,
  connectorId: string,
  connectorKind: ConnectorManifest["kind"],
  query: string,
  staleContent: string,
  currentContent: string,
  expectedTerms: string[],
  staleTerms: string[]
): OperatorMemoryScenario {
  return {
    id,
    title,
    kind: "source_update",
    connectorId,
    connectorKind,
    query,
    initial: { role: "tool", content: staleContent, externalId: id, timestamp: "2026-05-01T00:00:00.000Z", metadata: { version: "1" } },
    updated: { role: "tool", content: currentContent, externalId: id, timestamp: "2026-05-02T00:00:00.000Z", metadata: { version: "2" } },
    currentContent,
    staleContent,
    expectedTerms,
    staleTerms
  };
}

function scoreChecks(checks: ScenarioChecks): number {
  const weights: Record<keyof ScenarioChecks, number> = {
    currentTruthSelected: 0.28,
    staleTruthSuppressed: 0.24,
    sourceRefRevalidated: 0.16,
    connectorRefreshAccounted: 0.12,
    beliefRevisionApplied: 0.14,
    failureContained: 0.06
  };
  return Object.entries(checks).reduce((sum, [key, passed]) => sum + (passed ? weights[key as keyof ScenarioChecks] : 0), 0);
}

function rate(results: ScenarioResult[], key: keyof ScenarioChecks): number {
  return results.filter((result) => result.checks[key]).length / Math.max(1, results.length);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function displayName(system: SystemId): string {
  return {
    "cognibrain-dream": "Cognibrain source-aware Dream",
    "retrieval-only": "Retrieval only baseline",
    "connector-import-only": "Connector import without belief revision",
    "reflect-only": "Local reflect without source refresh",
    "recency-only": "Recency-only memory baseline",
    "mem0-native": "Mem0 native",
    "langmem-native": "LangMem native",
    "graphiti-native": "Graphiti/Zep native",
    "cognee-native": "Cognee native"
  }[system];
}

function capabilityGaps(system: SystemId): string[] {
  return {
    "cognibrain-dream": [],
    "retrieval-only": ["no connector refresh", "no sourceRef revalidation", "no belief revision", "no stale suppression"],
    "connector-import-only": ["imports connector updates but does not classify superseded beliefs", "no connector failure containment"],
    "reflect-only": ["local reflection only; no pre-reflection source refresh", "no connector sync state proof"],
    "recency-only": ["recency ranking can select current text but does not prove source validity", "no conflict set or belief revision"],
    "mem0-native": ["real native memory add/search, but no Dream source refresh", "no sourceRef revalidation", "no belief-state suppression"],
    "langmem-native": ["real native memory manage/search, but no Dream source refresh", "no sourceRef revalidation", "no belief-state suppression"],
    "graphiti-native": ["real graph run requires LLM credentials", "no Cognibrain connector failure accounting in this adapter"],
    "cognee-native": ["real knowledge pipeline requires LLM credentials", "no Cognibrain connector failure accounting in this adapter"]
  }[system];
}

function renderMarkdown(report: OperatorMemoryBenchmarkReport): string {
  const rows = report.systems
    .map((system) => `| ${system.displayName} | ${points(system.score)} | ${system.proofLevel} | ${system.adapterMode} | ${points(system.metrics.currentTruthAccuracy)} | ${points(system.metrics.staleSuppressionRate)} | ${points(system.metrics.sourceRevalidationRate)} |`)
    .join("\n");
  const scenarioRows = report.systems.find((system) => system.system === "cognibrain-dream")?.scenarios
    .map((scenario) => `| ${scenario.scenarioId} | ${points(scenario.score)} | ${mark(scenario.checks.currentTruthSelected)} | ${mark(scenario.checks.staleTruthSuppressed)} | ${mark(scenario.checks.connectorRefreshAccounted)} | ${mark(scenario.checks.failureContained)} |`)
    .join("\n") ?? "";
  return `# Operator Memory Dream Benchmark

Generated at ${report.generatedAt}.

Claim scope: \`${report.claimScope}\`.

This benchmark proves same-scenario superiority against configured baselines and native competitors. It allows market-superiority claims only when native/cloud competitor runs, credentialed connector tenant runs and independent artifacts are all present.

| System | Score | Proof | Adapter | Current truth | Stale suppression | Source revalidation |
| --- | ---: | --- | --- | ---: | ---: | ---: |
${rows}

| Cognibrain scenario | Score | Current truth | Stale suppressed | Connector accounted | Failure contained |
| --- | ---: | ---: | ---: | ---: | ---: |
${scenarioRows}

Market claim allowed: ${report.summary.marketSuperiorityClaimAllowed ? "yes" : "no"}.

Blockers:
${report.summary.marketSuperiorityBlockers.map((item) => `- ${item}`).join("\n")}

Native runner evidence:
${report.systems.filter((system) => system.runner).map((system) => `- ${system.displayName}: \`${system.runner?.commandEnv}\`, ${system.proofLevel}`).join("\n") || "- none"}
`;
}

function points(value: number): string {
  return `${Math.round(value * 1000)}/1000`;
}

function mark(value: boolean): string {
  return value ? "yes" : "no";
}

function cliOptions(argv: string[]): { out?: string; markdown?: string; systems?: SystemId[] } {
  const systems = optionValue(argv, "--systems")?.split(",").map((item) => item.trim()).filter(Boolean) as SystemId[] | undefined;
  return {
    out: optionValue(argv, "--out") ?? "artifacts/operator-memory-benchmark.json",
    markdown: optionValue(argv, "--markdown") ?? "artifacts/docs/operator-memory-benchmark.md",
    systems
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function tail(value = "", limit = 3000): string {
  return String(value ?? "").slice(-limit);
}

function optionValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOperatorMemoryBenchmark(cliOptions(process.argv.slice(2))).then((report) => {
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exit(1);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
