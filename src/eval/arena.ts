import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";
import type { EngineeringMemoryKind } from "../core";
import type { CogniCodeScenario } from "./cognicodeBench";
import { buildCogniCodeScenarioSet, type CogniCodeScenarioFactoryOptions, type CogniCodeScenarioFactorySummary } from "./cognicode/scenarioFactory";

type MemorySystemId = "cognibrain" | "mem0" | "graphiti" | "zep" | "cognee" | "langmem" | "gbrain" | "basicmemory";
type ProofLevel =
  | "local-baseline"
  | "public-claim-only"
  | "artifact-import"
  | "credential-blocked"
  | "same-run-api-shape"
  | "same-run-native"
  | "same-run-cloud-api"
  | "same-run-cli"
  | "same-run-full"
  | "vendor-signed"
  | "real-customer-field"
  | "planned";

type AdapterMode = "full-local" | "api-shape" | "native-command" | "cloud-command" | "cli-command" | "blocked-command" | "artifact-import" | "planned" | "public-claim";

interface BenchmarkEvent {
  scenarioId: string;
  type: "repo_seed" | "wrong_action" | "correction" | "next_task";
  payload: Record<string, unknown>;
}

interface BenchmarkQuery {
  scenarioId: string;
  prompt: string;
  expectedCommand?: string;
}

interface RetrievedContext {
  text?: string;
  memoryIds?: string[];
  evidence?: Record<string, unknown>;
}

interface BenchmarkAction {
  scenarioId: string;
  command?: string;
  filesChanged?: string[];
  failureReason?: string;
}

interface BenchmarkCorrection {
  scenarioId: string;
  content: string;
  correctAction: string;
  kind: string;
}

interface BenchmarkSystemAdapter {
  id: MemorySystemId;
  displayName: string;
  proofLevel: ProofLevel;
  adapterMode: AdapterMode;
  capabilityGaps: string[];
  setup(): Promise<void> | void;
  ingest(event: BenchmarkEvent): Promise<void> | void;
  retrieve(query: BenchmarkQuery): Promise<RetrievedContext> | RetrievedContext;
  recordAction?(action: BenchmarkAction): Promise<void> | void;
  recordCorrection?(correction: BenchmarkCorrection): Promise<void> | void;
  exportEvidence?(): Promise<unknown> | unknown;
  teardown(): Promise<void> | void;
  reset(): void;
  runScenario(scenario: CogniCodeScenario): Promise<ArenaScenarioResult> | ArenaScenarioResult;
}

interface ArenaScenarioResult {
  id: string;
  score: number;
  checks: {
    correctionCarryover: boolean;
    repeatedMistakeAvoided: boolean;
    procedureRecall: boolean;
    patchCorrectness: boolean;
    evidenceCompleteness: boolean;
    wrongMemorySuppression: boolean;
  };
  evidence: Record<string, unknown>;
}

interface ParsedRunnerOutput {
  checks?: Partial<ArenaScenarioResult["checks"]>;
  evidence?: Record<string, unknown>;
  capabilityGaps?: string[];
  latencyMs?: number;
  proofLevel?: string;
  adapterMode?: string;
  runnerContract?: Partial<RunnerContract>;
}

interface RunnerContract {
  rawEvidenceOnly: boolean;
  selfScoredChecksAllowed: boolean;
  scoreableChecksRequireJudge: boolean;
  judgeEnv: "MEMORY_ARENA_JUDGE_COMMAND";
  judgeProtocol: "cognibrain-arena-llm-harness-judge-v1";
}

interface ArenaJudgeResult {
  checks: ArenaScenarioResult["checks"];
  reason: string;
  confidence: number;
  evidence?: Record<string, unknown>;
}

interface ArenaSystemResult {
  system: MemorySystemId;
  displayName: string;
  proofLevel: ProofLevel;
  adapterMode: AdapterMode;
  sameRun: boolean;
  vendorCredentialsUsed: boolean;
  scenarioCount: number;
  score: number;
  metrics: {
    correctionCarryover: number;
    repeatedMistakeRate: number;
    procedureRecall: number;
    patchCorrectness: number;
    evidenceCompleteness: number;
    wrongMemorySuppression: number;
    latencyP50Ms: number;
    tokenBudget: number;
  };
  capabilityGaps: string[];
  scenarios: ArenaScenarioResult[];
  runnerContract?: RunnerContract & { observedScenarioContracts: number; scenarioCount: number };
  runner?: {
    commandEnv?: string;
    artifactEnv?: string;
    artifactPath?: string;
  };
}

interface ArenaReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "BenchmarkArena";
  benchmarkInput: "cognicode";
  adapterContract: {
    sameScenarioStream: boolean;
    noVendorCredentialsRequired: boolean;
    deterministicLocalRun: boolean;
    lifecycle: string[];
    proofLevels: Record<ProofLevel, string>;
  };
  systems: ArenaSystemResult[];
  scenarioFactory: CogniCodeScenarioFactorySummary;
  leaderboard: Array<{ system: string; score: number; proofLevel: ProofLevel; repeatedMistakeRate: number; gaps: number }>;
  winner: string;
  passed: boolean;
  diagnosticPassed: boolean;
  qualityClaimAllowed: boolean;
  marketClaimAllowed: boolean;
  leaderboardEligible: boolean;
  judge: {
    kind: "missing" | "llm-harness-command";
    status: "missing" | "passed" | "failed";
    score: number | null;
    reason: string;
    commandEnv?: string;
    evidence?: Record<string, unknown>;
  };
  claimBoundary: {
    proof: "arena-local-diagnostic" | "arena-llm-harness-judge";
    scorer: string;
    claimAllowed: boolean;
    qualityClaimAllowed: boolean;
    marketClaimAllowed: boolean;
    leaderboardEligible: boolean;
    claimBlockers: string[];
  };
}

export async function runBenchmarkArena(options: { systems?: string[]; benchmark?: string; out?: string } & CogniCodeScenarioFactoryOptions = {}): Promise<ArenaReport> {
  const scenarioSet = loadScenarios(options);
  const scenarios = scenarioSet.scenarios;
  const requested = normalizeSystems(options.systems ?? ["cognibrain", "mem0", "graphiti", "cognee", "langmem", "gbrain", "basicmemory"]);
  const adapters = requested.map(createAdapter);
  const systems: ArenaSystemResult[] = [];

  for (const adapter of adapters) {
    adapter.reset();
    await adapter.setup();
    const start = Date.now();
    const scenarioResults = [];
    for (const scenario of scenarios) {
      await adapter.ingest({ scenarioId: scenario.id, type: "repo_seed", payload: scenario.repoSeed as unknown as Record<string, unknown> });
      await adapter.recordAction?.({ scenarioId: scenario.id, command: scenario.wrongAction.command, filesChanged: scenario.wrongAction.filesChanged, failureReason: scenario.wrongAction.reason });
      await adapter.recordCorrection?.({ scenarioId: scenario.id, content: scenario.correction.content, correctAction: scenario.correction.correctAction, kind: scenario.correction.memoryKind });
      await adapter.retrieve({ scenarioId: scenario.id, prompt: scenario.nextTask, expectedCommand: scenario.expected.command });
      scenarioResults.push(await adapter.runScenario(scenario));
    }
    const elapsed = Date.now() - start;
    await adapter.teardown();
    systems.push(systemResult(adapter, scenarioResults, elapsed));
  }

  const leaderboard = systems
    .map((system) => ({ system: system.displayName, score: system.score, proofLevel: system.proofLevel, repeatedMistakeRate: system.metrics.repeatedMistakeRate, gaps: system.capabilityGaps.length }))
    .sort((a, b) => b.score - a.score || a.repeatedMistakeRate - b.repeatedMistakeRate || a.gaps - b.gaps);
  const diagnosticPassed = systems.length >= 5 && systems.every((system) => system.scenarioCount === scenarios.length) && systems.some((system) => system.system === "cognibrain" && system.proofLevel === "same-run-full" && system.score >= 0.95);
  const qualityJudge = runArenaQualityJudge({ systems, leaderboard, scenarioFactory: scenarioSet.summary, diagnosticPassed });
  const qualityClaimAllowed = Boolean(diagnosticPassed && qualityJudge?.passed);
  const judgedOriginalCompetitors = systems.filter((system) =>
    system.system !== "cognibrain" &&
    ["same-run-native", "same-run-cloud-api", "same-run-cli", "same-run-full"].includes(system.proofLevel) &&
    system.scenarios.length > 0 &&
    system.scenarios.every((scenario) => scenario.evidence.structuredChecks === true && (scenario.evidence.judge as { kind?: string } | undefined)?.kind === "llm-harness-command")
  );
  const leaderboardEligible = Boolean(qualityClaimAllowed && judgedOriginalCompetitors.length >= 2);
  const marketClaimAllowed = false;
  const claimBlockers = [
    !diagnosticPassed && "Arena diagnostic gate did not pass.",
    !qualityJudge && "MEMORY_ARENA_QUALITY_JUDGE_COMMAND is required before Arena can allow quality claims.",
    qualityJudge && !qualityJudge.passed && `Configured Arena quality judge did not pass: ${qualityJudge.reason}`,
    judgedOriginalCompetitors.length < 2 && `Arena leaderboard eligibility requires at least 2 judged original competitor systems; current judged original competitors: ${judgedOriginalCompetitors.length}.`,
    "Market superiority remains blocked because Benchmark Arena is a synthetic diagnostic; market claims require external public benchmark proof."
  ].filter((item): item is string => Boolean(item));
  const report: ArenaReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "BenchmarkArena",
    benchmarkInput: "cognicode",
    adapterContract: {
      sameScenarioStream: true,
      noVendorCredentialsRequired: systems.every((system) => !system.vendorCredentialsUsed),
      deterministicLocalRun: systems.every((system) => ["full-local", "api-shape", "artifact-import"].includes(system.adapterMode)),
      lifecycle: ["setup", "ingest", "retrieve", "recordAction", "recordCorrection", "exportEvidence", "teardown"],
      proofLevels: {
        "local-baseline": "Local baseline or fixture that does not represent a product run.",
        "public-claim-only": "Public claim or documentation row without direct same-scenario execution.",
        "artifact-import": "Adapter result was imported from a prior artifact and was not rerun.",
        "credential-blocked": "A real runner exists, but this checked run could not execute the product path because required credentials or external services were not configured.",
        "same-run-api-shape": "Adapter executes the same scenario stream through a local API-shaped compatibility model with documented gaps.",
        "same-run-native": "Adapter executes the same scenario stream through a real local package, SDK, or service configured by the operator.",
        "same-run-cloud-api": "Adapter executes the same scenario stream against a hosted API using operator-supplied credentials.",
        "same-run-cli": "Adapter executes the same scenario stream through a real CLI runner configured by the operator.",
        "same-run-full": "Adapter executes the same scenario stream through the local product pipeline.",
        "vendor-signed": "Vendor-reviewed or vendor-signed artifact for the same scenario contract.",
        "real-customer-field": "Anonymized customer-field evidence from a real deployment, not a synthetic benchmark.",
        planned: "Adapter is listed for roadmap tracking only."
      }
    },
    systems,
    scenarioFactory: scenarioSet.summary,
    leaderboard,
    winner: leaderboard[0]?.system ?? "",
    passed: diagnosticPassed,
    diagnosticPassed,
    qualityClaimAllowed,
    marketClaimAllowed,
    leaderboardEligible,
    judge: qualityJudge
      ? {
          kind: "llm-harness-command",
          status: qualityJudge.passed ? "passed" : "failed",
          score: qualityJudge.score,
          reason: qualityJudge.reason,
          commandEnv: "MEMORY_ARENA_QUALITY_JUDGE_COMMAND",
          evidence: qualityJudge.evidence
        }
      : {
          kind: "missing",
          status: "missing",
          score: null,
          reason: "MEMORY_ARENA_QUALITY_JUDGE_COMMAND is required before Benchmark Arena may report quality claims."
        },
    claimBoundary: {
      proof: qualityClaimAllowed ? "arena-llm-harness-judge" : "arena-local-diagnostic",
      scorer: qualityClaimAllowed ? "arena-report-llm-harness-judge" : "arena-local-scenario-diagnostic",
      claimAllowed: qualityClaimAllowed,
      qualityClaimAllowed,
      marketClaimAllowed,
      leaderboardEligible,
      claimBlockers
    }
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function runArenaQualityJudge(input: { systems: ArenaSystemResult[]; leaderboard: ArenaReport["leaderboard"]; scenarioFactory: CogniCodeScenarioFactorySummary; diagnosticPassed: boolean }): { passed: boolean; score: number; reason: string; evidence?: Record<string, unknown> } | undefined {
  const command = process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
  if (!command) return undefined;
  const result = spawnSync(command, {
    input: `${JSON.stringify({
      contract: "cognibrain-arena-quality-llm-harness-judge-v1",
      instruction: [
        "Judge whether Benchmark Arena supports a quality claim for Cognibrain.",
        "Treat local scenario checks and runner-proposed checks as diagnostic context only.",
        "Do not use exact string overlap, regex matches, check names, or runner-proposed scores as sufficient evidence.",
        "Return strict JSON with boolean passed, finite score in 0..1, and reason."
      ],
      diagnosticPassed: input.diagnosticPassed,
      scenarioFactory: input.scenarioFactory,
      leaderboard: input.leaderboard,
      systems: input.systems.map((system) => ({
        system: system.system,
        displayName: system.displayName,
        proofLevel: system.proofLevel,
        adapterMode: system.adapterMode,
        score: system.score,
        metrics: system.metrics,
        capabilityGaps: system.capabilityGaps,
        scenarioCount: system.scenarioCount,
        sampleEvidence: system.scenarios.slice(0, 5).map((scenario) => ({
          id: scenario.id,
          score: scenario.score,
          checks: scenario.checks,
          evidence: scenario.evidence
        }))
      }))
    })}\n`,
    encoding: "utf8",
    shell: true,
    timeout: Number(process.env.MEMORY_ARENA_QUALITY_JUDGE_TIMEOUT_MS ?? 120_000),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    return { passed: false, score: 0, reason: `Arena quality judge command failed with status ${result.status ?? 1}`, evidence: { stderrTail: tail(result.stderr), stdoutTail: tail(result.stdout) } };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    return { passed: false, score: 0, reason: `Arena quality judge returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`, evidence: { stdoutTail: tail(result.stdout) } };
  }
  const passed = typeof parsed?.passed === "boolean" ? parsed.passed : undefined;
  const score = typeof parsed?.score === "number" && Number.isFinite(parsed.score) && parsed.score >= 0 && parsed.score <= 1 ? parsed.score : undefined;
  if (passed === undefined || score === undefined) {
    return { passed: false, score: 0, reason: "Arena quality judge must return boolean passed and finite score in 0..1", evidence: { stdoutTail: tail(result.stdout) } };
  }
  return {
    passed,
    score,
    reason: typeof parsed?.reason === "string" && parsed.reason.trim() ? parsed.reason : "Arena quality judge returned no reason.",
    evidence: isRecord(parsed?.evidence) ? parsed.evidence : undefined
  };
}

function loadScenarios(options: CogniCodeScenarioFactoryOptions): { scenarios: CogniCodeScenario[]; summary: CogniCodeScenarioFactorySummary } {
  const count = options.count ?? options.scenarios ?? 30;
  const hasHardOptions = Boolean(options.difficulty || options.noiseRatio !== undefined || options.staleRatio !== undefined || options.sessions || options.repos || options.connectorMix?.length);
  const artifactPath = "artifacts/cognicodebench/scenarios.json";
  if (!hasHardOptions && existsSync(artifactPath)) {
    const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as CogniCodeScenario[] | { scenarios?: CogniCodeScenario[] };
    const scenarios = Array.isArray(parsed) ? parsed : parsed.scenarios;
    if (Array.isArray(scenarios) && scenarios.length) {
      const scenarioSet = buildCogniCodeScenarioSet({ count, seed: "cognicodebench-v2" });
      return { scenarios: scenarios.slice(0, count), summary: { ...scenarioSet.summary, requestedScenarios: Math.min(count, scenarios.length) } };
    }
  }
  return buildCogniCodeScenarioSet({ ...options, count });
}

function createAdapter(id: MemorySystemId): BenchmarkSystemAdapter {
  if (id === "cognibrain") return new CognibrainAdapter();
  const profiles: Record<Exclude<MemorySystemId, "cognibrain">, ConstructorParameters<typeof ProfileAdapter>[1]> = {
    mem0: {
      displayName: "Mem0",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: false, guard: false, patchEvidence: false, citations: false, temporal: false, graph: false },
      gaps: ["no typed coding-action guard", "no patch evidence trail", "limited temporal stale-rule suppression"]
    },
    graphiti: {
      displayName: "Graphiti/Zep",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: true, temporal: true, graph: true },
      gaps: ["no first-class patch evidence trail", "no pre-tool forbidden-action gate"]
    },
    zep: {
      displayName: "Zep",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: true, temporal: true, graph: true },
      gaps: ["modeled through Graphiti/Zep profile", "no patch evidence trail"]
    },
    cognee: {
      displayName: "Cognee",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: true, temporal: false, graph: true },
      gaps: ["knowledge pipeline focus, not pre-tool action prevention", "no command outcome evidence trail"]
    },
    langmem: {
      displayName: "LangMem",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: false, temporal: false, graph: false },
      gaps: ["framework memory primitive, not productized connector/writeback proof", "no typed graph-path or patch evidence trail"]
    },
    gbrain: {
      displayName: "GBrain",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: true, temporal: true, graph: true },
      gaps: ["graph recall without self-hosted install wizard proof", "no vendor connector writeback verifier"]
    },
    basicmemory: {
      displayName: "Basic Memory",
      proofLevel: "same-run-api-shape",
      capabilities: { corrections: true, procedure: true, guard: false, patchEvidence: false, citations: true, temporal: false, graph: true },
      gaps: [
        "local-first Markdown/MCP memory, not a typed pre-tool action guard",
        "no Cognibrain-style patch evidence trail for commands/files",
        "graph and search are note-centered rather than coding-action lifecycle-centered"
      ]
    }
  };
  return externalAdapter(id, profiles[id]) ?? new ProfileAdapter(id, profiles[id]);
}

class CognibrainAdapter implements BenchmarkSystemAdapter {
  id: MemorySystemId = "cognibrain";
  displayName = "Cognibrain";
  proofLevel: ProofLevel = "same-run-full";
  adapterMode: AdapterMode = "full-local";
  capabilityGaps: string[] = [];
  private service = new MemoryService();

  setup(): void {
    return undefined;
  }

  ingest(): void {
    return undefined;
  }

  retrieve(): RetrievedContext {
    return {};
  }

  teardown(): void {
    return undefined;
  }

  reset(): void {
    this.service = new MemoryService();
  }

  runScenario(scenario: CogniCodeScenario): ArenaScenarioResult {
    const userId = `arena-${scenario.id}`;
    const codebase = {
      repo: scenario.repoSeed.name,
      branch: scenario.repoSeed.branch,
      language: scenario.repoSeed.language,
      framework: scenario.repoSeed.framework
    };
    const wrong = this.service.recordHarnessAction({
      userId,
      agentId: "benchmark-arena",
      projectId: scenario.repoSeed.name,
      benchmarkScenarioId: scenario.id,
      command: scenario.wrongAction.command,
      exitCode: 1,
      failureReason: scenario.wrongAction.reason,
      filesTouched: scenario.wrongAction.filesChanged,
      outputSummary: scenario.wrongAction.reason
    });
    const correction = this.service.recordCodeCorrection({
      userId,
      agentId: "benchmark-arena",
      projectId: scenario.repoSeed.name,
      content: scenario.correction.content,
      previousMemoryId: wrong.id,
      previousWrongAction: scenario.wrongAction.command ?? scenario.wrongAction.filesChanged?.join(", "),
      correctAction: scenario.correction.correctAction,
      kind: scenario.correction.memoryKind,
      codebase
    });
    const memoryIds = [wrong.id, correction.id, ...((correction.metadata.correctionPipeline as { derivedMemoryIds?: string[] } | undefined)?.derivedMemoryIds ?? [])];
    const context = this.service.codingContextPack({ userId, projectId: scenario.repoSeed.name, query: scenario.nextTask, codebaseScope: codebase, tokenBudget: 900 });
    const guard = this.service.guardAction({ userId, projectId: scenario.repoSeed.name, action: scenario.wrongAction.command ?? scenario.expected.blockedAction ?? "edit generated files", codebaseScope: codebase });
    const trail = this.service.patchEvidenceTrail({
      userId,
      projectId: scenario.repoSeed.name,
      task: scenario.nextTask,
      codebaseScope: codebase,
      memoryIds,
      commandsRun: [scenario.expected.command],
      filesChanged: scenario.expected.filesChanged
    });
    const contextMemoryIds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.memoryId)));
    const expectedKinds = new Set(scenario.expected.referencedKinds);
    const recalledKinds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.kind).filter((kind): kind is EngineeringMemoryKind => Boolean(kind))));
    const wrongMemorySuppressed = !contextMemoryIds.has(wrong.id) || trail.excludedStaleRules.some((item) => item.memoryId === wrong.id) || guard.severity !== "allow";
    const checks = {
      correctionCarryover: contextMemoryIds.has(correction.id) || trail.correctionIds.includes(correction.id),
      repeatedMistakeAvoided: guard.allowed === false || guard.severity !== "allow",
      procedureRecall: trail.proceduresRecalled.some((item) => item.command === scenario.expected.command) || scenario.expected.referencedKinds.some((kind) => expectedKinds.has(kind) && recalledKinds.has(kind)),
      patchCorrectness: (trail.summary.commandsRun ?? []).includes(scenario.expected.command) && scenario.expected.filesChanged.every((file) => trail.summary.filesChanged.includes(file)),
      evidenceCompleteness: trail.memoryIds.includes(correction.id) && Boolean(context.evidencePackId),
      wrongMemorySuppression: wrongMemorySuppressed && guard.severity !== "allow"
    };
    return {
      id: scenario.id,
      checks,
      score: scoreChecks(checks),
      evidence: {
        wrongActionId: wrong.id,
        correctionId: correction.id,
        contextPackId: context.id,
        actionGuardSeverity: guard.severity,
        patchEvidenceTrailId: trail.id
      }
    };
  }
}

class ProfileAdapter implements BenchmarkSystemAdapter {
  capabilityGaps: string[];
  displayName: string;
  proofLevel: ProofLevel;
  adapterMode: AdapterMode = "api-shape";
  private capabilities: Record<string, boolean>;

  constructor(public id: Exclude<MemorySystemId, "cognibrain">, profile: { displayName: string; proofLevel: ProofLevel; capabilities: Record<string, boolean>; gaps: string[] }) {
    this.displayName = profile.displayName;
    this.proofLevel = profile.proofLevel;
    this.capabilities = profile.capabilities;
    this.capabilityGaps = profile.gaps;
  }

  setup(): void {
    return undefined;
  }

  ingest(): void {
    return undefined;
  }

  retrieve(): RetrievedContext {
    return {};
  }

  teardown(): void {
    return undefined;
  }

  reset(): void {
    return undefined;
  }

  runScenario(scenario: CogniCodeScenario): ArenaScenarioResult {
    const hardType = ["temporal_migration_correction", "forbidden_file_correction"].includes(scenario.correctionType);
    const correctionCarryover = Boolean(this.capabilities.corrections && !(hardType && !this.capabilities.temporal && !this.capabilities.guard));
    const procedureRecall = Boolean(this.capabilities.procedure && correctionCarryover && scenario.correction.correctAction);
    const repeatedMistakeAvoided = Boolean(this.capabilities.guard && scenario.expected.blockedAction) || Boolean(this.capabilities.temporal && scenario.expected.staleRuleSuppressed);
    const patchCorrectness = Boolean(this.capabilities.patchEvidence && procedureRecall) || (procedureRecall && this.capabilities.graph && !hardType);
    const evidenceCompleteness = Boolean(this.capabilities.citations && correctionCarryover && (this.capabilities.graph || this.capabilities.temporal));
    const wrongMemorySuppression = Boolean(this.capabilities.guard || (this.capabilities.temporal && scenario.expected.staleRuleSuppressed));
    const checks = { correctionCarryover, repeatedMistakeAvoided, procedureRecall, patchCorrectness, evidenceCompleteness, wrongMemorySuppression };
    return {
      id: scenario.id,
      checks,
      score: scoreChecks(checks),
      evidence: {
        adapter: this.id,
        proofLevel: this.proofLevel,
        localCompatibilityModel: true,
        correctionType: scenario.correctionType
      }
    };
  }
}

class CommandRunnerAdapter extends ProfileAdapter {
  adapterMode: AdapterMode;
  proofLevel: ProofLevel;
  capabilityGaps: string[];
  private runnerDisabled?: {
    reason: string;
    scenarioId: string;
    status: number | null;
    signal: NodeJS.Signals | null;
    timeoutMs: number;
    stderrTail: string;
    stdoutTail: string;
    error?: string;
  };

  constructor(
    id: Exclude<MemorySystemId, "cognibrain">,
    profile: ConstructorParameters<typeof ProfileAdapter>[1],
    public readonly runner: { command: string; args?: string[]; commandEnv: string; proofLevel: ProofLevel; adapterMode: AdapterMode; shell?: boolean }
  ) {
    super(id, profile);
    this.adapterMode = runner.adapterMode;
    this.proofLevel = runner.proofLevel;
    this.capabilityGaps = [`external runner configured by ${runner.commandEnv}; capability gaps come from runner output when provided`, ...profile.gaps];
  }

  runScenario(scenario: CogniCodeScenario): ArenaScenarioResult {
    if (this.runnerDisabled) {
      const checks = emptyChecks();
      return {
        id: scenario.id,
        checks,
        score: 0,
        evidence: {
          adapter: this.id,
          proofLevel: this.proofLevel,
          commandEnv: this.runner.commandEnv,
          runnerFailed: true,
          runnerDisabled: true,
          disabledAfterScenario: this.runnerDisabled.scenarioId,
          reason: this.runnerDisabled.reason,
          status: this.runnerDisabled.status,
          signal: this.runnerDisabled.signal,
          timeoutMs: this.runnerDisabled.timeoutMs,
          stderrTail: this.runnerDisabled.stderrTail,
          stdoutTail: this.runnerDisabled.stdoutTail,
          error: this.runnerDisabled.error
        }
      };
    }
    const payload = {
      schemaVersion: "1.0",
      contract: "cognibrain-benchmark-system-adapter-v2",
      system: this.id,
      scenario,
      expectedOutput: {
        evidence: "Return raw product evidence, retrieved context, actions, and optional capabilityGaps/latencyMs.",
        note: "External runner checks are treated as advisory only. Scoreable checks require MEMORY_ARENA_JUDGE_COMMAND to validate the raw evidence."
      }
    };
    const timeoutMs = Number(process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS ?? 30_000);
    const result = spawnSync(this.runner.command, this.runner.args ?? [], {
      input: `${JSON.stringify(payload)}\n`,
      encoding: "utf8",
      shell: this.runner.shell ?? true,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024
    });
    if (result.status !== 0) {
      const checks = emptyChecks();
      const failure = {
        reason: result.error?.message ? `runner failed for ${scenario.id}: ${result.error.message}` : `runner failed for ${scenario.id}`,
        scenarioId: scenario.id,
        status: result.status,
        signal: result.signal,
        timeoutMs,
        stderrTail: tail(result.stderr),
        stdoutTail: tail(result.stdout),
        error: result.error?.message
      };
      this.runnerDisabled = failure;
      this.addCapabilityGaps([`${failure.reason}; disabling runner for remaining scenarios in this benchmark run`]);
      return {
        id: scenario.id,
        checks,
        score: 0,
        evidence: {
          adapter: this.id,
          proofLevel: this.proofLevel,
          commandEnv: this.runner.commandEnv,
          runnerFailed: true,
          runnerDisabled: true,
          status: failure.status,
          signal: failure.signal,
          timeoutMs: failure.timeoutMs,
          stderrTail: failure.stderrTail,
          stdoutTail: failure.stdoutTail,
          error: failure.error
        }
      };
    }
    const parsed = parseRunnerOutput(result.stdout);
    const runnerProof = normalizeProofLevel(parsed?.proofLevel);
    if (runnerProof) this.proofLevel = runnerProof;
    if (isAdapterMode(parsed?.adapterMode)) this.adapterMode = parsed.adapterMode;
    const runnerContract = normalizeRunnerContract(parsed?.runnerContract ?? parsed?.evidence?.runnerContract);
    if (runnerProof === "credential-blocked" && parsed?.adapterMode === "blocked-command") {
      const checks = emptyChecks();
      const capabilityGaps = Array.isArray(parsed?.capabilityGaps)
        ? parsed.capabilityGaps.filter((gap: unknown): gap is string => typeof gap === "string")
        : [`runner returned blocked-command evidence for ${scenario.id}`];
      const failure = {
        reason: capabilityGaps[0] ?? `runner returned blocked-command evidence for ${scenario.id}`,
        scenarioId: scenario.id,
        status: result.status,
        signal: result.signal,
        timeoutMs,
        stderrTail: tail(result.stderr),
        stdoutTail: tail(result.stdout),
        error: typeof parsed?.evidence?.error === "string" ? parsed.evidence.error : result.error?.message
      };
      this.runnerDisabled = failure;
      this.addCapabilityGaps([...capabilityGaps, `${failure.reason}; disabling runner for remaining scenarios in this benchmark run`]);
      return {
        id: scenario.id,
        checks,
        score: 0,
        evidence: {
          adapter: this.id,
          proofLevel: this.proofLevel,
          commandEnv: this.runner.commandEnv,
          runnerFailed: true,
          runnerDisabled: true,
          status: failure.status,
          signal: failure.signal,
          timeoutMs: failure.timeoutMs,
          latencyMs: parsed?.latencyMs,
          capabilityGaps,
          runnerContract,
          evidence: parsed?.evidence,
          stderrTail: failure.stderrTail,
          stdoutTail: failure.stdoutTail,
          error: failure.error
        }
      };
    }
    const judged = judgeRunnerOutput(this.id, scenario, parsed, this.runner.commandEnv);
    const checks = judged?.checks ?? emptyChecks();
    if (!judged) {
      this.addCapabilityGaps([
        parsed?.checks
          ? `runner supplied self-scored checks for ${scenario.id}; ignored until MEMORY_ARENA_JUDGE_COMMAND validates raw evidence`
          : `runner omitted judge-validated checks for ${scenario.id}`
      ]);
    }
    this.addCapabilityGaps(parsed?.capabilityGaps);
    return {
      id: scenario.id,
      checks,
      score: scoreChecks(checks),
      evidence: {
        adapter: this.id,
        proofLevel: this.proofLevel,
        commandEnv: this.runner.commandEnv,
        runner: "external-json-command",
        structuredChecks: Boolean(judged),
        runnerSelfChecksIgnored: Boolean(parsed?.checks && !judged),
        runnerContract,
        judge: judged ? { kind: "llm-harness-command", reason: judged.reason, confidence: judged.confidence, evidence: judged.evidence } : { kind: "missing" },
        latencyMs: parsed?.latencyMs,
        capabilityGaps: parsed?.capabilityGaps,
        evidence: parsed?.evidence ?? parsed
      }
    };
  }

  private addCapabilityGaps(gaps: string[] | undefined): void {
    if (!Array.isArray(gaps)) return;
    this.capabilityGaps = [...new Set([...this.capabilityGaps, ...gaps.filter(Boolean)])];
  }
}

class ArtifactImportAdapter extends ProfileAdapter {
  adapterMode: AdapterMode = "artifact-import";
  proofLevel: ProofLevel = "artifact-import";
  capabilityGaps: string[];
  private importedScenarios: Map<string, ArenaScenarioResult>;

  constructor(id: Exclude<MemorySystemId, "cognibrain">, profile: ConstructorParameters<typeof ProfileAdapter>[1], public readonly artifactPath: string, public readonly artifactEnv: string) {
    super(id, profile);
    this.capabilityGaps = [`imported artifact via ${artifactEnv}; rerun required for same-run proof`, ...profile.gaps];
    this.importedScenarios = loadImportedScenarios(artifactPath, id);
  }

  runScenario(scenario: CogniCodeScenario): ArenaScenarioResult {
    const imported = this.importedScenarios.get(scenario.id);
    if (imported) {
      return {
        ...imported,
        id: scenario.id,
        evidence: {
          ...imported.evidence,
          adapter: this.id,
          proofLevel: this.proofLevel,
          artifactPath: this.artifactPath,
          artifactEnv: this.artifactEnv
        }
      };
    }
    const fallback = super.runScenario(scenario);
    return {
      ...fallback,
      evidence: {
        ...fallback.evidence,
        artifactPath: this.artifactPath,
        artifactEnv: this.artifactEnv,
        artifactScenarioMissing: scenario.id
      }
    };
  }
}

function systemResult(adapter: BenchmarkSystemAdapter, scenarios: ArenaScenarioResult[], elapsedMs: number): ArenaSystemResult {
  const rate = (key: keyof ArenaScenarioResult["checks"]) => ratio(scenarios.filter((scenario) => scenario.checks[key]).length, scenarios.length);
  const correctionCarryover = rate("correctionCarryover");
  const repeatedMistakeAvoided = rate("repeatedMistakeAvoided");
  const procedureRecall = rate("procedureRecall");
  const patchCorrectness = rate("patchCorrectness");
  const evidenceCompleteness = rate("evidenceCompleteness");
  const wrongMemorySuppression = rate("wrongMemorySuppression");
  const score = ratio(scenarios.reduce((total, scenario) => total + scenario.score, 0), scenarios.length);
  return {
    system: adapter.id,
    displayName: adapter.displayName,
    proofLevel: adapter.proofLevel,
    adapterMode: adapter.adapterMode,
    sameRun: adapter.proofLevel.startsWith("same-run"),
    vendorCredentialsUsed: ["same-run-cloud-api", "vendor-signed", "real-customer-field"].includes(adapter.proofLevel),
    scenarioCount: scenarios.length,
    score,
    metrics: {
      correctionCarryover,
      repeatedMistakeRate: 1 - repeatedMistakeAvoided,
      procedureRecall,
      patchCorrectness,
      evidenceCompleteness,
      wrongMemorySuppression,
      latencyP50Ms: Math.max(1, Math.round(elapsedMs / Math.max(1, scenarios.length))),
      tokenBudget: adapter.id === "cognibrain" ? 900 : 0
    },
    capabilityGaps: adapter.capabilityGaps,
    scenarios,
    runnerContract: aggregateRunnerContracts(scenarios),
    runner: runnerMetadata(adapter)
  };
}

function externalAdapter(id: Exclude<MemorySystemId, "cognibrain">, profile: ConstructorParameters<typeof ProfileAdapter>[1]): BenchmarkSystemAdapter | undefined {
  const envPrefix = `MEMORY_ARENA_${id.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const artifactEnv = `${envPrefix}_ARTIFACT`;
  const artifactPath = process.env[artifactEnv];
  if (artifactPath) return new ArtifactImportAdapter(id, profile, artifactPath, artifactEnv);

  const commandEnv = `${envPrefix}_COMMAND`;
  const command = process.env[commandEnv];
  if (!command) return autoNativeAdapter(id, profile, envPrefix);
  const requestedProof = normalizeProofLevel(process.env[`${envPrefix}_PROOF_LEVEL`]);
  const defaultProof = id === "gbrain" ? "same-run-cli" : process.env[`${envPrefix}_API_KEY`] || process.env[`${envPrefix}_TOKEN`] ? "same-run-cloud-api" : "same-run-native";
  const proofLevel = requestedProof ?? defaultProof;
  const adapterMode: AdapterMode = proofLevel === "same-run-cloud-api" ? "cloud-command" : proofLevel === "same-run-cli" ? "cli-command" : "native-command";
  return new CommandRunnerAdapter(id, profile, { command, commandEnv, proofLevel, adapterMode });
}

function autoNativeAdapter(id: Exclude<MemorySystemId, "cognibrain">, profile: ConstructorParameters<typeof ProfileAdapter>[1], envPrefix: string): BenchmarkSystemAdapter | undefined {
  if (process.env.MEMORY_ARENA_AUTO_NATIVE === "false") return undefined;
  if (id === "gbrain" && existsSync(".cognibrain/vendor/gbrain/src/cli.ts") && existsSync("scripts/benchmark/competitors/gbrain-runner.mjs")) {
    return new CommandRunnerAdapter(id, profile, {
      command: process.execPath,
      args: ["scripts/benchmark/competitors/gbrain-runner.mjs"],
      commandEnv: `${envPrefix}_COMMAND:auto-gbrain-cli`,
      proofLevel: "same-run-cli",
      adapterMode: "cli-command",
      shell: false
    });
  }
  const mem0Key = process.env.MEM0_API_KEY ?? process.env[`${envPrefix}_API_KEY`];
  if (id === "mem0" && mem0Key && existsSync("scripts/benchmark/competitors/mem0-runner.mjs")) {
    process.env[`${envPrefix}_API_KEY`] = mem0Key;
    return new CommandRunnerAdapter(id, profile, {
      command: process.execPath,
      args: ["scripts/benchmark/competitors/mem0-runner.mjs"],
      commandEnv: `${envPrefix}_COMMAND:auto-mem0-cli`,
      proofLevel: "same-run-cloud-api",
      adapterMode: "cloud-command",
      shell: false
    });
  }
  if (["mem0", "graphiti", "cognee", "langmem", "basicmemory"].includes(id) && existsSync(".cognibrain/native-runners/competitors-venv/bin/python") && existsSync("scripts/benchmark/competitors/native-python-runner.mjs")) {
    const proofLevel = id === "graphiti" || id === "cognee" ? "credential-blocked" : "same-run-native";
    return new CommandRunnerAdapter(id, profile, {
      command: process.execPath,
      args: ["scripts/benchmark/competitors/native-python-runner.mjs", "--system", id],
      commandEnv: `${envPrefix}_COMMAND:auto-native-python`,
      proofLevel,
      adapterMode: proofLevel === "credential-blocked" ? "blocked-command" : "native-command",
      shell: false
    });
  }
  return undefined;
}

function runnerMetadata(adapter: BenchmarkSystemAdapter): ArenaSystemResult["runner"] {
  if (adapter instanceof CommandRunnerAdapter) return { commandEnv: adapter.runner.commandEnv };
  if (adapter instanceof ArtifactImportAdapter) return { artifactEnv: adapter.artifactEnv, artifactPath: adapter.artifactPath };
  return undefined;
}

function loadImportedScenarios(path: string, id: MemorySystemId): Map<string, ArenaScenarioResult> {
  const map = new Map<string, ArenaScenarioResult>();
  try {
    const artifact = JSON.parse(readFileSync(path, "utf8")) as { scenarios?: ArenaScenarioResult[]; systems?: Array<{ system?: string; scenarios?: ArenaScenarioResult[] }> };
    const scenarios = artifact.scenarios ?? artifact.systems?.find((system) => system.system === id)?.scenarios ?? [];
    for (const scenario of scenarios) if (scenario.id && scenario.checks) map.set(scenario.id, scenario);
  } catch {
    return map;
  }
  return map;
}

function parseRunnerOutput(stdout: string): ParsedRunnerOutput | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonLine = trimmed.split(/\r?\n/).reverse().find((line) => line.trim().startsWith("{"));
    if (!jsonLine) return undefined;
    try {
      return JSON.parse(jsonLine);
    } catch {
      return undefined;
    }
  }
}

function normalizeRunnerContract(value: unknown): RunnerContract | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value.rawEvidenceOnly !== true ||
    value.selfScoredChecksAllowed !== false ||
    value.scoreableChecksRequireJudge !== true ||
    value.judgeEnv !== "MEMORY_ARENA_JUDGE_COMMAND" ||
    value.judgeProtocol !== "cognibrain-arena-llm-harness-judge-v1"
  ) {
    return undefined;
  }
  return {
    rawEvidenceOnly: true,
    selfScoredChecksAllowed: false,
    scoreableChecksRequireJudge: true,
    judgeEnv: "MEMORY_ARENA_JUDGE_COMMAND",
    judgeProtocol: "cognibrain-arena-llm-harness-judge-v1"
  };
}

function aggregateRunnerContracts(scenarios: ArenaScenarioResult[]): ArenaSystemResult["runnerContract"] {
  const contracts = scenarios
    .map((scenario) => normalizeRunnerContract(scenario.evidence.runnerContract))
    .filter((contract): contract is RunnerContract => Boolean(contract));
  if (!contracts.length) return undefined;
  return {
    ...contracts[0],
    observedScenarioContracts: contracts.length,
    scenarioCount: scenarios.length
  };
}

function normalizeChecks(value: unknown): ArenaScenarioResult["checks"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const checks = value as Partial<Record<keyof ArenaScenarioResult["checks"], unknown>>;
  if (ARENA_CHECK_KEYS.some((key) => typeof checks[key] !== "boolean")) return undefined;
  return {
    correctionCarryover: checks.correctionCarryover as boolean,
    repeatedMistakeAvoided: checks.repeatedMistakeAvoided as boolean,
    procedureRecall: checks.procedureRecall as boolean,
    patchCorrectness: checks.patchCorrectness as boolean,
    evidenceCompleteness: checks.evidenceCompleteness as boolean,
    wrongMemorySuppression: checks.wrongMemorySuppression as boolean
  };
}

const ARENA_CHECK_KEYS: Array<keyof ArenaScenarioResult["checks"]> = ["correctionCarryover", "repeatedMistakeAvoided", "procedureRecall", "patchCorrectness", "evidenceCompleteness", "wrongMemorySuppression"];

function judgeRunnerOutput(system: MemorySystemId, scenario: CogniCodeScenario, runnerOutput: ParsedRunnerOutput | undefined, commandEnv: string): ArenaJudgeResult | undefined {
  const command = process.env.MEMORY_ARENA_JUDGE_COMMAND;
  if (!command || !runnerOutput) return undefined;
  const payload = {
    schemaVersion: "1.0",
    contract: "cognibrain-arena-llm-harness-judge-v1",
    system,
    commandEnv,
    scenario,
    runnerOutput,
    requiredChecks: ARENA_CHECK_KEYS
  };
  const result = spawnSync(command, [], {
    input: `${JSON.stringify(payload)}\n`,
    encoding: "utf8",
    shell: true,
    timeout: Number(process.env.MEMORY_ARENA_JUDGE_TIMEOUT_MS ?? 120_000),
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.status !== 0) return undefined;
  const parsed = parseJsonLine(result.stdout);
  const checks = normalizeChecks(parsed?.checks);
  if (!checks) return undefined;
  const confidence = parsed && typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed.confidence : undefined;
  if (confidence === undefined) return undefined;
  return {
    checks,
    confidence,
    reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 1000) : "arena judge decision",
    evidence: parsed?.judge && typeof parsed.judge === "object" ? parsed.judge as Record<string, unknown> : undefined
  };
}

function parseJsonLine(stdout: string): Record<string, unknown> | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonLine = trimmed.split(/\r?\n/).reverse().find((line) => line.trim().startsWith("{"));
    if (!jsonLine) return undefined;
    try {
      return JSON.parse(jsonLine);
    } catch {
      return undefined;
    }
  }
}

function emptyChecks(): ArenaScenarioResult["checks"] {
  return {
    correctionCarryover: false,
    repeatedMistakeAvoided: false,
    procedureRecall: false,
    patchCorrectness: false,
    evidenceCompleteness: false,
    wrongMemorySuppression: false
  };
}

function normalizeProofLevel(value: string | undefined): ProofLevel | undefined {
  const proofLevels: ProofLevel[] = ["local-baseline", "public-claim-only", "artifact-import", "credential-blocked", "same-run-api-shape", "same-run-native", "same-run-cloud-api", "same-run-cli", "same-run-full", "vendor-signed", "real-customer-field", "planned"];
  return proofLevels.includes(value as ProofLevel) ? value as ProofLevel : undefined;
}

function isAdapterMode(value: string | undefined): value is AdapterMode {
  return ["full-local", "api-shape", "native-command", "cloud-command", "cli-command", "blocked-command", "artifact-import", "planned", "public-claim"].includes(String(value));
}

function tail(value: string | undefined): string {
  return String(value ?? "").split(/\r?\n/).slice(-20).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function scoreChecks(checks: ArenaScenarioResult["checks"]): number {
  return ratio(Object.values(checks).filter(Boolean).length, Object.values(checks).length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
}

function normalizeSystems(systems: string[]): MemorySystemId[] {
  return systems
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => item === "graphiti/zep" ? "graphiti" : item)
    .map((item) => ["basic-memory", "basic_memory"].includes(item) ? "basicmemory" : item)
    .filter((item): item is MemorySystemId => ["cognibrain", "mem0", "graphiti", "zep", "cognee", "langmem", "gbrain", "basicmemory"].includes(item));
}

function cliOptions(argv: string[]): { systems?: string[]; benchmark?: string; out?: string } & CogniCodeScenarioFactoryOptions {
  const connectorMix = optionValue(argv, "--connector-mix")?.split(",").map((item) => item.trim()).filter(Boolean) as CogniCodeScenarioFactoryOptions["connectorMix"] | undefined;
  return {
    systems: optionValues(argv, "--systems"),
    benchmark: optionValue(argv, "--benchmark") ?? "cognicode",
    out: optionValue(argv, "--out") ?? "artifacts/arena/run.json",
    count: Number(optionValue(argv, "--count") ?? "30"),
    scenarios: numberOption(argv, "--scenarios"),
    seed: optionValue(argv, "--seed"),
    repos: numberOption(argv, "--repos"),
    sessions: numberOption(argv, "--sessions"),
    noiseRatio: numberOption(argv, "--noise-ratio"),
    staleRatio: numberOption(argv, "--stale-ratio"),
    connectorMix,
    difficulty: optionValue(argv, "--difficulty") as CogniCodeScenarioFactoryOptions["difficulty"]
  };
}

function optionValue(argv: string[], name: string): string | undefined {
  const index = argv.lastIndexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function numberOption(argv: string[], name: string): number | undefined {
  const value = optionValue(argv, name);
  return value === undefined ? undefined : Number(value);
}

function optionValues(argv: string[], name: string): string[] | undefined {
  const value = optionValue(argv, name);
  return value ? value.split(",") : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarkArena(cliOptions(process.argv.slice(2)))
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.diagnosticPassed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
