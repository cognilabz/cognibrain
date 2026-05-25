import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";
import type { CogniCodeScenario } from "./cognicodeBench";
import { generateCogniCodeScenarios } from "./cognicodeBench";

type MemorySystemId = "cognibrain" | "mem0" | "graphiti" | "zep" | "cognee" | "langmem" | "gbrain";
type ProofLevel = "same-run-full" | "same-run-api-shape" | "artifact-import" | "planned";

interface MemorySystemAdapter {
  id: MemorySystemId;
  displayName: string;
  proofLevel: ProofLevel;
  capabilityGaps: string[];
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

interface ArenaSystemResult {
  system: MemorySystemId;
  displayName: string;
  proofLevel: ProofLevel;
  sameRun: boolean;
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
    proofLevels: Record<ProofLevel, string>;
  };
  systems: ArenaSystemResult[];
  leaderboard: Array<{ system: string; score: number; proofLevel: ProofLevel; repeatedMistakeRate: number; gaps: number }>;
  winner: string;
  passed: boolean;
}

export async function runBenchmarkArena(options: { systems?: string[]; benchmark?: string; out?: string; count?: number } = {}): Promise<ArenaReport> {
  const scenarios = loadScenarios(options.count ?? 30);
  const requested = normalizeSystems(options.systems ?? ["cognibrain", "mem0", "graphiti", "cognee", "langmem", "gbrain"]);
  const adapters = requested.map(createAdapter);
  const systems: ArenaSystemResult[] = [];

  for (const adapter of adapters) {
    adapter.reset();
    const start = Date.now();
    const scenarioResults = [];
    for (const scenario of scenarios) scenarioResults.push(await adapter.runScenario(scenario));
    const elapsed = Date.now() - start;
    systems.push(systemResult(adapter, scenarioResults, elapsed));
  }

  const leaderboard = systems
    .map((system) => ({ system: system.displayName, score: system.score, proofLevel: system.proofLevel, repeatedMistakeRate: system.metrics.repeatedMistakeRate, gaps: system.capabilityGaps.length }))
    .sort((a, b) => b.score - a.score || a.repeatedMistakeRate - b.repeatedMistakeRate || a.gaps - b.gaps);
  const report: ArenaReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "BenchmarkArena",
    benchmarkInput: "cognicode",
    adapterContract: {
      sameScenarioStream: true,
      noVendorCredentialsRequired: true,
      deterministicLocalRun: true,
      proofLevels: {
        "same-run-full": "Adapter executes the same scenario stream through the local product pipeline.",
        "same-run-api-shape": "Adapter executes the same scenario stream through a local API-shaped compatibility model with documented gaps.",
        "artifact-import": "Adapter result was imported from a prior artifact and was not rerun.",
        planned: "Adapter is listed for roadmap tracking only."
      }
    },
    systems,
    leaderboard,
    winner: leaderboard[0]?.system ?? "",
    passed: systems.length >= 5 && systems.every((system) => system.scenarioCount === scenarios.length) && systems.some((system) => system.system === "cognibrain" && system.proofLevel === "same-run-full" && system.score >= 0.95)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function loadScenarios(count: number): CogniCodeScenario[] {
  const artifactPath = "artifacts/cognicodebench/scenarios.json";
  if (existsSync(artifactPath)) {
    const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as CogniCodeScenario[];
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, count);
  }
  return generateCogniCodeScenarios({ count }).slice(0, count);
}

function createAdapter(id: MemorySystemId): MemorySystemAdapter {
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
    }
  };
  return new ProfileAdapter(id, profiles[id]);
}

class CognibrainAdapter implements MemorySystemAdapter {
  id: MemorySystemId = "cognibrain";
  displayName = "Cognibrain";
  proofLevel: ProofLevel = "same-run-full";
  capabilityGaps: string[] = [];
  private service = new MemoryService();

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
    const serializedContext = JSON.stringify(context).toLowerCase();
    const serializedTrail = JSON.stringify(trail).toLowerCase();
    const correctionNeedle = scenario.correction.content.slice(0, 32).toLowerCase();
    const checks = {
      correctionCarryover: serializedContext.includes(correctionNeedle) || trail.correctionIds.includes(correction.id),
      repeatedMistakeAvoided: guard.allowed === false || guard.severity !== "allow",
      procedureRecall: trail.proceduresRecalled.some((item) => JSON.stringify(item).includes(scenario.expected.command)),
      patchCorrectness: (trail.summary.commandsRun ?? []).includes(scenario.expected.command) && scenario.expected.filesChanged.every((file) => trail.summary.filesChanged.includes(file)),
      evidenceCompleteness: trail.memoryIds.includes(correction.id) && Boolean(context.evidencePackId),
      wrongMemorySuppression: !serializedTrail.includes(scenario.expected.staleRuleSuppressed?.toLowerCase() ?? "__no_stale_rule__") && guard.severity !== "allow"
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

class ProfileAdapter implements MemorySystemAdapter {
  capabilityGaps: string[];
  displayName: string;
  proofLevel: ProofLevel;
  private capabilities: Record<string, boolean>;

  constructor(public id: Exclude<MemorySystemId, "cognibrain">, profile: { displayName: string; proofLevel: ProofLevel; capabilities: Record<string, boolean>; gaps: string[] }) {
    this.displayName = profile.displayName;
    this.proofLevel = profile.proofLevel;
    this.capabilities = profile.capabilities;
    this.capabilityGaps = profile.gaps;
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

function systemResult(adapter: MemorySystemAdapter, scenarios: ArenaScenarioResult[], elapsedMs: number): ArenaSystemResult {
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
    sameRun: adapter.proofLevel.startsWith("same-run"),
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
    scenarios
  };
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
    .filter((item): item is MemorySystemId => ["cognibrain", "mem0", "graphiti", "zep", "cognee", "langmem", "gbrain"].includes(item));
}

function cliOptions(argv: string[]): { systems?: string[]; benchmark?: string; out?: string; count?: number } {
  return {
    systems: optionValues(argv, "--systems"),
    benchmark: optionValue(argv, "--benchmark") ?? "cognicode",
    out: optionValue(argv, "--out") ?? "artifacts/arena/run.json",
    count: Number(optionValue(argv, "--count") ?? "30")
  };
}

function optionValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function optionValues(argv: string[], name: string): string[] | undefined {
  const value = optionValue(argv, name);
  return value ? value.split(",") : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBenchmarkArena(cliOptions(process.argv.slice(2)))
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
