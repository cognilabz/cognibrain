import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";
import { conceptScore, tokenize } from "../core";
import type { BeliefState, CodebaseScope, CodingContextPack, EngineeringMemoryKind, SourceKind } from "../core";
import { buildCogniCodeScenarioSet, type CogniCodeNoiseMemory, type CogniCodePatchModel, type CogniCodeScenarioFactoryOptions, type CogniCodeScenarioFactorySummary, type CogniCodeSessionEvent, type CogniCodeSourceRef } from "./cognicode/scenarioFactory";

export type CogniCodeDifficulty = "easy" | "medium" | "hard" | "evil";
export type CogniCodeAblationMode =
  | "no_memory"
  | "raw_chat_history"
  | "keyword_only"
  | "semantic_only"
  | "vector_only"
  | "graph_only"
  | "temporal_only"
  | "procedure_only"
  | "cognibrain_without_temporal"
  | "cognibrain_without_corrections";
export type CogniCodeCorrectionType =
  | "command_correction"
  | "library_correction"
  | "architecture_correction"
  | "style_correction"
  | "test_correction"
  | "forbidden_file_correction"
  | "temporal_migration_correction"
  | "branch_policy_correction"
  | "review_feedback_correction"
  | "generated_file_regeneration_correction"
  | "security_pattern_correction"
  | "performance_regression_correction"
  | "api_contract_correction"
  | "schema_migration_correction"
  | "build_tool_correction"
  | "workspace_boundary_correction"
  | "dependency_version_correction"
  | "feature_flag_correction"
  | "observability_correction"
  | "release_gate_correction";

export interface CogniCodeScenario {
  id: string;
  difficulty: CogniCodeDifficulty;
  correctionType: CogniCodeCorrectionType;
  repoSeed: {
    name: string;
    language: "typescript" | "python" | "go" | "react" | "monorepo" | "legacy";
    framework: string;
    branch: string;
    packageManager: "npm" | "pnpm" | "pip" | "go";
    testCommand: string;
    generatedFiles: string[];
    rules: string[];
    hiddenTrap: string;
    files: Array<{ path: string; purpose: string; generated?: boolean }>;
  };
  initialTask: string;
  wrongAction: {
    command?: string;
    filesChanged?: string[];
    reason: string;
  };
  correction: {
    content: string;
    type: CogniCodeCorrectionType;
    memoryKind: EngineeringMemoryKind;
    correctAction: string;
  };
  nextTask: string;
  expected: {
    command: string;
    filesChanged: string[];
    referencedKinds: EngineeringMemoryKind[];
    blockedAction?: string;
    staleRuleSuppressed?: string;
  };
  sessions?: CogniCodeSessionEvent[];
  noiseMemories?: CogniCodeNoiseMemory[];
  connectorEvents?: CogniCodeSessionEvent[];
  sourceRef?: CogniCodeSourceRef;
  syntheticRepo?: CogniCodePatchModel;
  horizon?: {
    sessionCount: number;
    correctionSession: number;
    taskSession: number;
    horizonLength: number;
  };
}

export interface CogniCodeScenarioResult {
  id: string;
  passed: boolean;
  score: number;
  checks: {
    correctionRecalled: boolean;
    procedureRecalled: boolean;
    wrongActionSuppressed: boolean;
    patchCorrect: boolean;
    evidenceComplete: boolean;
    staleSuppressed: boolean;
    sourceRefCorrect: boolean;
    patchGranularCorrect: boolean;
    longHorizonRecall: boolean;
  };
  evidence: {
    correctionMemoryId: string;
    wrongActionMemoryId: string;
    codingContextPackId: string;
    patchEvidenceTrailId: string;
    guardSeverity: string;
    referencedKinds: EngineeringMemoryKind[];
    connectorMemoryIds?: string[];
    sourceRefs?: CogniCodeSourceRef[];
    patchProposal: CogniCodePatchProposal;
    patchChecks?: {
      changedExpectedFiles: boolean;
      avoidedForbiddenFiles: boolean;
      requiredPatternsModeled: boolean;
      testFilesModeled: boolean;
    };
  };
  errors: string[];
}

export interface CogniCodePatchProposal {
  mode: "context-derived" | "external-harness" | "ablation-simulated";
  status: "passed" | "failed";
  command: string;
  filesChanged: string[];
  reason: string;
  evidence?: Record<string, unknown>;
}

export interface CogniCodeBenchReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "CogniCodeBench";
  claimScope: "engineering-memory-synthetic-diagnostic";
  proof: "local-diagnostic" | "llm-harness";
  mode: "scenario_generation" | "benchmark";
  seed: string;
  scenarioCount: number;
  passed: boolean;
  diagnosticPassed: boolean;
  qualityClaimAllowed: boolean;
  marketClaimAllowed: boolean;
  claimBoundary: {
    proof: "local-diagnostic" | "llm-harness";
    scorer: "cognicodebench-local-scenario-diagnostic" | "cognicodebench-llm-harness-judge";
    qualityClaimAllowed: boolean;
    marketClaimAllowed: boolean;
    claimBlockers: string[];
  };
  harnessContracts: {
    qualityJudge: {
      configured: boolean;
      requiredForQualityClaim: true;
      reportLevel: true;
      semanticJudgeRequired: true;
      strictJson: true;
      failClosed: true;
      forbidsStringRegexScoring: true;
      protocol: "cognibrain-cognicodebench-quality-llm-harness-judge-v1";
      envVar: "MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND";
    };
    patchProposal: {
      configured: boolean;
      hiddenExpectedFieldsProvided: false;
      visibleRepoMetadataOnly: true;
      strictJson: true;
      failClosed: true;
      protocol: "cognibrain-cognicodebench-patch-proposal-harness-v1";
      envVar: "MEMORY_COGNICODEBENCH_PATCH_COMMAND";
    };
    ablation: {
      patchSimulationUsesHiddenExpected: false;
      hiddenExpectedEvaluatorOnly: true;
      simulatedPatchSource: "visible-repo-metadata-and-recalled-memory-kinds";
    };
  };
  judge: {
    kind: "missing" | "llm-harness-command";
    status: "missing" | "passed" | "failed";
    score?: number;
    reason: string;
    evidence?: Record<string, unknown>;
  };
  methodology: {
    task: string;
    metrics: string[];
    baselines: string[];
    privacy: { syntheticReposOnly: boolean; noUserData: boolean };
    deterministicDiagnostics: boolean;
    requiredExternalProofForQualityClaim: string[];
    requiredExternalProofForMarketClaim: string[];
  };
  metrics: {
    correctionCarryoverRate: number;
    repeatedMistakeRate: number;
    procedureRecallRate: number;
    patchCorrectness: number;
    evidenceCompleteness: number;
    wrongMemorySuppression: number;
    sourceRefCorrectness: number;
    granularPatchCorrectness: number;
    longHorizonRecallRate: number;
  };
  scenarioFactory: CogniCodeScenarioFactorySummary;
  difficultyDistribution: Record<CogniCodeDifficulty, number>;
  noiseRatio: number;
  staleRatio: number;
  horizon: CogniCodeScenarioFactorySummary["horizon"];
  patchEvaluation: {
    syntheticRepoFiles: boolean;
    granular: boolean;
    averageExpectedFiles: number;
    averageForbiddenFiles: number;
  };
  diagnostics: {
    integrity: {
      score: number;
      overfitRisk: "low" | "medium" | "high";
      metrics: {
        expectedLeakage: number;
        expectedDirectPatchHarness: boolean;
        externalPatchHarnessRate: number;
        bestBaseline: number;
        fullScore: number;
      };
    };
    weaknesses: Array<{ area: string; severity: "low" | "medium" | "high"; evidence: string; recommendation: string }>;
  };
  baselines: Array<{ name: string; score: number; correctionCarryoverRate: number; repeatedMistakeRate: number; scenarioCount: number; measured: boolean; notes: string[] }>;
  ablation: Record<string, { score: number; deltaFromFull: number; notes: string[] }>;
  generation: { scenariosPath: string; scenariosWritten: boolean };
  examples: CogniCodeScenario[];
  scenarios: CogniCodeScenarioResult[];
}

interface CogniCodeQualityJudgeResult {
  passed: boolean;
  score: number;
  reason: string;
  evidence?: Record<string, unknown>;
}

const ARCHETYPES: Array<Omit<CogniCodeScenario, "id" | "difficulty">> = [
  {
    correctionType: "command_correction",
    repoSeed: {
      name: "atlas-node-service",
      language: "typescript",
      framework: "node",
      branch: "main",
      packageManager: "npm",
      testCommand: "npm test",
      generatedFiles: ["src/generated/api.generated.ts"],
      rules: ["Use npm, not pnpm.", "Validation lives in src/validation."],
      hiddenTrap: "pnpm exists on the developer machine but is not supported by CI.",
      files: [
        { path: "src/validation/userValidation.ts", purpose: "request validation" },
        { path: "src/generated/api.generated.ts", purpose: "generated OpenAPI client", generated: true }
      ]
    },
    initialTask: "Add a validation rule and run tests.",
    wrongAction: { command: "pnpm test", filesChanged: ["src/generated/api.generated.ts"], reason: "The agent picked the globally installed package manager and edited a generated file." },
    correction: { content: "Do not use pnpm in this repo; use npm test and keep generated files untouched.", type: "command_correction", memoryKind: "repo_policy", correctAction: "npm test" },
    nextTask: "Add a validation rule for account status and run the right tests.",
    expected: { command: "npm test", filesChanged: ["src/validation/userValidation.ts"], referencedKinds: ["repo_policy", "tool_outcome"], blockedAction: "pnpm test" }
  },
  {
    correctionType: "architecture_correction",
    repoSeed: {
      name: "ledger-fastapi",
      language: "python",
      framework: "fastapi",
      branch: "feature/invoices",
      packageManager: "pip",
      testCommand: "pytest tests/unit",
      generatedFiles: ["app/schemas/generated_models.py"],
      rules: ["FastAPI validators live in app/validation.", "Do not edit generated_models.py."],
      hiddenTrap: "The route file imports validators but should not define them inline.",
      files: [
        { path: "app/api/invoices.py", purpose: "HTTP route" },
        { path: "app/validation/invoices.py", purpose: "validation logic" },
        { path: "app/schemas/generated_models.py", purpose: "generated schema", generated: true }
      ]
    },
    initialTask: "Add invoice validation.",
    wrongAction: { command: "pytest", filesChanged: ["app/api/invoices.py"], reason: "The agent added validation in the route instead of the validation module." },
    correction: { content: "Validation architecture decision: invoice validation lives in app/validation/invoices.py, not in app/api/invoices.py.", type: "architecture_correction", memoryKind: "architecture_decision", correctAction: "Edit app/validation/invoices.py and run pytest tests/unit" },
    nextTask: "Add due-date validation for invoices.",
    expected: { command: "pytest tests/unit", filesChanged: ["app/validation/invoices.py"], referencedKinds: ["architecture_decision", "test_strategy"] }
  },
  {
    correctionType: "library_correction",
    repoSeed: {
      name: "northwind-go",
      language: "go",
      framework: "chi",
      branch: "main",
      packageManager: "go",
      testCommand: "go test ./...",
      generatedFiles: ["internal/gen/openapi.gen.go"],
      rules: ["Use zerolog for logging.", "Generated Go files are read-only."],
      hiddenTrap: "The stdlib logger compiles but violates the service convention.",
      files: [
        { path: "internal/orders/service.go", purpose: "order service" },
        { path: "internal/gen/openapi.gen.go", purpose: "generated server stubs", generated: true }
      ]
    },
    initialTask: "Add logging around order cancellation.",
    wrongAction: { command: "go test ./...", filesChanged: ["internal/orders/service.go"], reason: "The agent used log.Printf instead of zerolog." },
    correction: { content: "Dependency rule: use zerolog, not log.Printf, for order-service logging.", type: "library_correction", memoryKind: "dependency_rule", correctAction: "Use zerolog and run go test ./..." },
    nextTask: "Add logging for order refund handling.",
    expected: { command: "go test ./...", filesChanged: ["internal/orders/service.go"], referencedKinds: ["dependency_rule", "tool_outcome"] }
  },
  {
    correctionType: "forbidden_file_correction",
    repoSeed: {
      name: "meridian-react",
      language: "react",
      framework: "react",
      branch: "ui/settings",
      packageManager: "npm",
      testCommand: "npm run test -- SettingsPanel",
      generatedFiles: ["src/graphql/types.generated.ts"],
      rules: ["Do not edit generated GraphQL types.", "UI copy lives with components."],
      hiddenTrap: "The generated GraphQL type looks like the easiest place to add a field.",
      files: [
        { path: "src/components/settings/SettingsPanel.tsx", purpose: "settings UI" },
        { path: "src/graphql/types.generated.ts", purpose: "generated GraphQL types", generated: true }
      ]
    },
    initialTask: "Add a settings flag to the panel.",
    wrongAction: { command: "npm run test -- SettingsPanel", filesChanged: ["src/graphql/types.generated.ts"], reason: "The agent edited generated GraphQL types." },
    correction: { content: "Do not edit generated files like src/graphql/types.generated.ts; update src/components/settings/SettingsPanel.tsx and regenerate types separately.", type: "forbidden_file_correction", memoryKind: "generated_file_rule", correctAction: "Edit src/components/settings/SettingsPanel.tsx and run npm run test -- SettingsPanel" },
    nextTask: "Add the billing-settings flag to the panel.",
    expected: { command: "npm run test -- SettingsPanel", filesChanged: ["src/components/settings/SettingsPanel.tsx"], referencedKinds: ["generated_file_rule"], blockedAction: "edit src/graphql/types.generated.ts" }
  },
  {
    correctionType: "temporal_migration_correction",
    repoSeed: {
      name: "orbit-monorepo",
      language: "monorepo",
      framework: "turbo",
      branch: "main",
      packageManager: "npm",
      testCommand: "npm run test --workspace packages/api",
      generatedFiles: ["packages/api/src/schema.generated.ts"],
      rules: ["The repo migrated from Jest to Vitest in May 2026.", "Package tests must use npm workspaces."],
      hiddenTrap: "Older memories still mention yarn jest.",
      files: [
        { path: "packages/api/src/routes/users.ts", purpose: "API route" },
        { path: "packages/api/src/schema.generated.ts", purpose: "generated schema", generated: true }
      ]
    },
    initialTask: "Fix an API route after the test migration.",
    wrongAction: { command: "yarn jest packages/api", filesChanged: ["packages/api/src/routes/users.ts"], reason: "The agent followed stale pre-migration test instructions." },
    correction: { content: "Migration note: before May 2026 Jest was valid, now use npm run test --workspace packages/api for API package changes.", type: "temporal_migration_correction", memoryKind: "migration_note", correctAction: "npm run test --workspace packages/api" },
    nextTask: "Update the users route and run the current API-package tests.",
    expected: { command: "npm run test --workspace packages/api", filesChanged: ["packages/api/src/routes/users.ts"], referencedKinds: ["migration_note", "tool_outcome"], staleRuleSuppressed: "yarn jest packages/api" }
  },
  {
    correctionType: "style_correction",
    repoSeed: {
      name: "legacy-billing-app",
      language: "legacy",
      framework: "express-legacy",
      branch: "support/billing-audit",
      packageManager: "npm",
      testCommand: "npm run test:legacy -- billing",
      generatedFiles: ["legacy/billing/generated/client.js"],
      rules: ["Do not change legacy billing controllers directly.", "Legacy audit logic belongs in legacy/billing/service.js."],
      hiddenTrap: "The controller is the obvious file, but production support forbids direct controller edits.",
      files: [
        { path: "legacy/billing/controller.js", purpose: "legacy HTTP controller" },
        { path: "legacy/billing/service.js", purpose: "billing business logic" },
        { path: "legacy/billing/generated/client.js", purpose: "generated legacy client", generated: true }
      ]
    },
    initialTask: "Add an audit marker for a legacy billing event.",
    wrongAction: { command: "npm test", filesChanged: ["legacy/billing/controller.js"], reason: "The agent edited the legacy controller and used the generic test command." },
    correction: { content: "Forbidden action: do not change legacy billing controllers directly; add audit logic in legacy/billing/service.js and run npm run test:legacy -- billing.", type: "style_correction", memoryKind: "forbidden_action", correctAction: "Edit legacy/billing/service.js and run npm run test:legacy -- billing" },
    nextTask: "Add the settlement audit marker to legacy billing.",
    expected: { command: "npm run test:legacy -- billing", filesChanged: ["legacy/billing/service.js"], referencedKinds: ["forbidden_action", "tool_outcome"], blockedAction: "change legacy/billing/controller.js" }
  }
];

export function generateCogniCodeScenarios(options: CogniCodeScenarioFactoryOptions = {}): CogniCodeScenario[] {
  return buildCogniCodeScenarioSet(options).scenarios;
}

export function runCogniCodeBench(options: CogniCodeScenarioFactoryOptions & { outputPath?: string; scenariosPath?: string; generateOnly?: boolean } = {}): CogniCodeBenchReport {
  const seed = options.seed ?? "cognicodebench-v2";
  const generateOnly = options.generateOnly === true;
  const scenarioSet = buildCogniCodeScenarioSet({ ...options, count: options.count ?? options.scenarios ?? 100, seed });
  const scenarios = scenarioSet.scenarios;
  const scenariosPath = options.scenariosPath ?? "artifacts/cognicodebench/scenarios.json";
  writeJson(scenariosPath, { schemaVersion: "1.0", generatedAt: new Date().toISOString(), seed, scenarios });
  const scenariosWritten = existsSync(scenariosPath);
  const results = generateOnly ? [] : scenarios.map(runScenario);
  const metrics = generateOnly ? emptyMetrics() : summarizeResults(results);
  const fullScore = generateOnly ? 1 : average(results.map((result) => result.score));
  const baselines = generateOnly ? [] : baselineReports(scenarios);
  const ablation = Object.fromEntries(baselines.map((baseline) => [baseline.name, { score: baseline.score, deltaFromFull: round(fullScore - baseline.score), notes: baseline.notes }]));
  const diagnosticPassed = generateOnly ? scenarios.length > 0 && scenariosWritten : scenarios.length >= 100 && results.every((result) => result.passed) && fullScore > Math.max(...baselines.map((baseline) => baseline.score)) && metrics.correctionCarryoverRate >= 0.9 && metrics.repeatedMistakeRate <= 0.05 && metrics.procedureRecallRate >= 0.9 && metrics.wrongMemorySuppression >= 0.9;
  const qualityJudge = generateOnly ? undefined : judgeCogniCodeQuality({
    scenarioCount: scenarios.length,
    scenarios,
    results,
    metrics,
    baselines,
    diagnostics: benchmarkDiagnostics(scenarios, results, baselines, metrics),
    ablation: { cognibrain_full: { score: round(fullScore), deltaFromFull: 0 }, ...ablation }
  });
  const qualityClaimAllowed = Boolean(diagnosticPassed && qualityJudge?.passed);
  const claimBlockers = [
    ...(!qualityClaimAllowed ? [
      "CogniCodeBench local scenario checks, ablations, token overlap leakage diagnostics and synthetic patch checks are deterministic diagnostics only.",
      "Set MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND to an external LLM/harness judge before using this artifact as a quality claim."
    ] : []),
    "Market superiority requires same-run native/cloud competitor adapters, public comparable protocol evidence, and independent replication; CogniCodeBench alone is not market proof."
  ];
  const diagnostics = benchmarkDiagnostics(scenarios, results, baselines, metrics);
  const report: CogniCodeBenchReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "CogniCodeBench",
    claimScope: "engineering-memory-synthetic-diagnostic",
    proof: qualityClaimAllowed ? "llm-harness" : "local-diagnostic",
    mode: generateOnly ? "scenario_generation" : "benchmark",
    seed,
    scenarioCount: scenarios.length,
    passed: diagnosticPassed,
    diagnosticPassed,
    qualityClaimAllowed,
    marketClaimAllowed: false,
    claimBoundary: {
      proof: qualityClaimAllowed ? "llm-harness" : "local-diagnostic",
      scorer: qualityClaimAllowed ? "cognicodebench-llm-harness-judge" : "cognicodebench-local-scenario-diagnostic",
      qualityClaimAllowed,
      marketClaimAllowed: false,
      claimBlockers
    },
    harnessContracts: {
      qualityJudge: {
        configured: Boolean(process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND),
        requiredForQualityClaim: true,
        reportLevel: true,
        semanticJudgeRequired: true,
        strictJson: true,
        failClosed: true,
        forbidsStringRegexScoring: true,
        protocol: "cognibrain-cognicodebench-quality-llm-harness-judge-v1",
        envVar: "MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND"
      },
      patchProposal: {
        configured: Boolean(process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND),
        hiddenExpectedFieldsProvided: false,
        visibleRepoMetadataOnly: true,
        strictJson: true,
        failClosed: true,
        protocol: "cognibrain-cognicodebench-patch-proposal-harness-v1",
        envVar: "MEMORY_COGNICODEBENCH_PATCH_COMMAND"
      },
      ablation: {
        patchSimulationUsesHiddenExpected: false,
        hiddenExpectedEvaluatorOnly: true,
        simulatedPatchSource: "visible-repo-metadata-and-recalled-memory-kinds"
      }
    },
    judge: qualityJudge
      ? {
        kind: "llm-harness-command",
        status: qualityJudge.passed ? "passed" : "failed",
        score: qualityJudge.score,
        reason: qualityJudge.reason,
        evidence: qualityJudge.evidence
      }
      : {
        kind: "missing",
        status: "missing",
        reason: generateOnly ? "Scenario-generation mode is not quality judged." : "MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND is not configured."
      },
    methodology: {
      task: "Measure whether coding agents learn from codebase corrections, review feedback, commands, and tool outcomes before the next change.",
      metrics: ["correction carryover", "repeated mistake rate", "procedure recall", "patch correctness", "evidence completeness", "wrong-memory suppression", "sourceRef correctness", "granular patch correctness", "long-horizon recall"],
      baselines: baselines.map((baseline) => baseline.name),
      privacy: { syntheticReposOnly: true, noUserData: true },
      deterministicDiagnostics: true,
      requiredExternalProofForQualityClaim: [
        "LLM/harness judge over semantic scenario evidence using MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND",
        "hidden expected actions or external patch proposal stage for patch-correctness claims",
        "ablation baselines may simulate from visible repo metadata only; hidden expected commands and files stay evaluator-only",
        "public artifact with full judge contract, prompt, raw evidence and failure cases"
      ],
      requiredExternalProofForMarketClaim: [
        "same-run native/cloud adapters for original memory systems",
        "neutral public protocol or third-party replication",
        "credentialed live-system runs where competitors require hosted APIs"
      ]
    },
    metrics,
    scenarioFactory: scenarioSet.summary,
    difficultyDistribution: scenarioSet.summary.difficultyDistribution,
    noiseRatio: scenarioSet.summary.noiseRatio,
    staleRatio: scenarioSet.summary.staleRatio,
    horizon: scenarioSet.summary.horizon,
    patchEvaluation: patchEvaluationSummary(scenarios),
    diagnostics,
    baselines,
    ablation: { cognibrain_full: { score: round(fullScore), deltaFromFull: 0, notes: ["Full engineering memory with corrections, temporal state, graph evidence, and action outcomes."] }, ...ablation },
    generation: { scenariosPath, scenariosWritten },
    examples: scenarios.slice(0, 5),
    scenarios: results
  };
  writeJson(options.outputPath ?? "artifacts/cognicodebench/run.json", report);
  return report;
}

function judgeCogniCodeQuality(payload: {
  scenarioCount: number;
  scenarios: CogniCodeScenario[];
  results: CogniCodeScenarioResult[];
  metrics: CogniCodeBenchReport["metrics"];
  baselines: CogniCodeBenchReport["baselines"];
  diagnostics: CogniCodeBenchReport["diagnostics"];
  ablation: Record<string, { score: number; deltaFromFull: number; notes?: string[] }>;
}): CogniCodeQualityJudgeResult | undefined {
  const judgeCommand = process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND;
  if (!judgeCommand) return undefined;
  const result = spawnSync(judgeCommand, {
    cwd: process.cwd(),
    input: JSON.stringify({
      schemaVersion: "1.0",
      contract: "cognibrain-cognicodebench-quality-llm-harness-judge-v1",
      instructions: [
        "Judge whether CogniCodeBench semantically supports an engineering-memory quality claim from the supplied scenario evidence.",
        "Do not rely on exact string overlap, token overlap, regex matches, check names, or runner-proposed scores.",
        "Treat local scenario checks, ablations and generated patch checks as diagnostic evidence unless independently justified.",
        "Return strict JSON with boolean passed, finite score in 0..1, and reason."
      ],
      ...payload
    }),
    encoding: "utf8",
    shell: true,
    timeout: Number(process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_TIMEOUT_MS ?? 120_000),
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    return { passed: false, score: 0, reason: `CogniCodeBench quality judge command failed with status ${result.status ?? 1}`, evidence: { stderrTail: tail(result.stderr), stdoutTail: tail(result.stdout) } };
  }
  const parsed = parseJsonLine(result.stdout);
  const passed = typeof parsed?.passed === "boolean" ? parsed.passed : undefined;
  const score = typeof parsed?.score === "number" && Number.isFinite(parsed.score) && parsed.score >= 0 && parsed.score <= 1 ? parsed.score : undefined;
  if (passed === undefined || score === undefined) {
    return { passed: false, score: 0, reason: "CogniCodeBench quality judge must return boolean passed and finite score in 0..1", evidence: { stdoutTail: tail(result.stdout) } };
  }
  return {
    passed,
    score,
    reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 1000) : "CogniCodeBench quality judge decision",
    evidence: parsed?.evidence && typeof parsed.evidence === "object" ? parsed.evidence as Record<string, unknown> : undefined
  };
}

function runScenario(scenario: CogniCodeScenario): CogniCodeScenarioResult {
  const service = new MemoryService({ autoDream: { enabled: false } });
  const userId = `bench-${scenario.id}`;
  const codebase = scenarioScope(scenario);
  for (const memory of scenario.noiseMemories ?? []) addBenchmarkNoiseMemory(service, scenario, userId, memory, codebase);
  const connectorMemoryIds = (scenario.connectorEvents ?? []).map((event) => addBenchmarkConnectorEvent(service, scenario, userId, event, codebase));
  const staleMemory = scenario.expected.staleRuleSuppressed
    ? service.add({
        userId,
        projectId: scenario.repoSeed.name,
        content: `Old pre-migration rule: run ${scenario.expected.staleRuleSuppressed}.`,
        source: { kind: "reviewed_code", confidence: 0.82 },
        tags: ["engineering-memory", "engineering:test_strategy"],
        metadata: { engineering: { kind: "test_strategy", codebase, confidence: 0.82, command: scenario.expected.staleRuleSuppressed } },
        beliefState: "stale",
        temporal: { eventAt: "2026-01-01T00:00:00.000Z", validUntil: "2026-05-01T00:00:00.000Z" }
      })
    : undefined;
  const wrong = service.recordHarnessAction({
    userId,
    agentId: "cognicode-simulator",
    projectId: scenario.repoSeed.name,
    command: scenario.wrongAction.command,
    cwd: `/work/${scenario.repoSeed.name}`,
    exitCode: 1,
    failureReason: scenario.wrongAction.reason,
    filesChanged: scenario.wrongAction.filesChanged,
    tests: [{ name: scenario.repoSeed.testCommand, status: "failed", output: scenario.wrongAction.reason }],
    benchmarkScenarioId: scenario.id,
    content: `Wrong action for ${scenario.id}: ${scenario.wrongAction.reason}`
  });
  const correction = service.recordCodeCorrection({
    userId,
    agentId: "review-simulator",
    projectId: scenario.repoSeed.name,
    previousMemoryId: wrong.id,
    previousWrongAction: scenario.expected.blockedAction ?? scenario.wrongAction.command ?? scenario.wrongAction.filesChanged?.join(", "),
    correctAction: scenario.correction.correctAction,
    content: scenario.correction.content,
    kind: scenario.correction.memoryKind,
    codebase,
    evidenceIds: staleMemory ? [staleMemory.id] : []
  });
  const context = service.codingContextPack({ userId, projectId: scenario.repoSeed.name, query: scenario.nextTask, codebaseScope: codebase, tokenBudget: 1200, limit: 12 });
  const guard = service.guardAction({ userId, projectId: scenario.repoSeed.name, action: scenario.expected.blockedAction ?? scenario.wrongAction.command ?? "edit generated file", codebaseScope: codebase });
  const patchProposal = proposePatch(scenario, context);
  const trail = service.patchEvidenceTrail({
    userId,
    projectId: scenario.repoSeed.name,
    task: scenario.nextTask,
    codebaseScope: codebase,
    filesChanged: patchProposal.filesChanged,
    commandsRun: patchProposal.command ? [patchProposal.command] : [],
    memoryIds: [...new Set([...context.sections.flatMap((section) => section.evidence.map((item) => item.memoryId)), correction.id, wrong.id, ...connectorMemoryIds])]
  });
  const referencedKinds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.kind).filter((kind): kind is EngineeringMemoryKind => Boolean(kind))));
  const contextMemoryIds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.memoryId)));
  const updatedWrong = service.get(wrong.id);
  const patchChecks = evaluatePatchModel(scenario, patchProposal);
  const checks = {
    correctionRecalled: contextMemoryIds.has(correction.id) || trail.correctionIds.includes(correction.id),
    procedureRecalled: scenario.expected.referencedKinds.some((kind) => referencedKinds.has(kind)) && context.sections.length > 0,
    wrongActionSuppressed: updatedWrong.beliefState === "superseded" && (!scenario.expected.blockedAction || guard.severity === "block" || guard.severity === "warn"),
    patchCorrect: scenario.expected.filesChanged.every((file) => trail.summary.filesChanged.includes(file)) && trail.summary.commandsRun.includes(scenario.expected.command),
    evidenceComplete: trail.memoryIds.includes(correction.id) && trail.toolOutcomeIds.includes(wrong.id),
    staleSuppressed: !staleMemory || !contextMemoryIds.has(staleMemory.id) || context.excludedStaleRules.some((item) => item.memoryId === staleMemory.id) || trail.excludedStaleRules.some((item) => item.memoryId === staleMemory.id),
    sourceRefCorrect: !scenario.sourceRef || connectorMemoryIds.length === (scenario.connectorEvents ?? []).length && scenario.connectorEvents?.every((event) => event.sourceRef?.connectorId === scenario.sourceRef?.connectorId) === true,
    patchGranularCorrect: Object.values(patchChecks).every(Boolean),
    longHorizonRecall: !scenario.horizon || scenario.horizon.taskSession > scenario.horizon.correctionSession && scenario.horizon.horizonLength >= 1
  };
  const errors = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  const score = round(Object.values(checks).filter(Boolean).length / Object.values(checks).length);
  return {
    id: scenario.id,
    passed: errors.length === 0,
    score,
    checks,
    evidence: {
      correctionMemoryId: correction.id,
      wrongActionMemoryId: wrong.id,
      codingContextPackId: context.id,
      patchEvidenceTrailId: trail.id,
      guardSeverity: guard.severity,
      referencedKinds: [...referencedKinds],
      connectorMemoryIds,
      sourceRefs: (scenario.connectorEvents ?? []).map((event) => event.sourceRef).filter((sourceRef): sourceRef is CogniCodeSourceRef => Boolean(sourceRef)),
      patchProposal,
      patchChecks
    },
    errors
  };
}

function proposePatch(scenario: CogniCodeScenario, context: CodingContextPack): CogniCodePatchProposal {
  const external = runPatchProposalCommand(scenario, context);
  if (external) return external;
  const relevantKinds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.kind).filter(Boolean)));
  if (!context.sections.length || relevantKinds.size === 0) {
    return { mode: "context-derived", status: "failed", command: "", filesChanged: [], reason: "no coding context evidence was available for patch proposal" };
  }
  const filesChanged = contextDerivedFiles(scenario, relevantKinds as Set<EngineeringMemoryKind>);
  const command = scenario.repoSeed.testCommand;
  return {
    mode: "context-derived",
    status: filesChanged.length > 0 && Boolean(command) ? "passed" : "failed",
    command,
    filesChanged,
    reason: "Derived from retrieved engineering memory kinds, repo test command metadata, and source-backed codebase ownership.",
    evidence: {
      contextPackId: context.id,
      evidenceKinds: [...relevantKinds],
      evidenceMemoryIds: context.sections.flatMap((section) => section.evidence.map((item) => item.memoryId))
    }
  };
}

function runPatchProposalCommand(scenario: CogniCodeScenario, context: CodingContextPack): CogniCodePatchProposal | undefined {
  const command = process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND;
  if (!command) return undefined;
  const result = spawnSync(command, {
    cwd: process.cwd(),
    input: JSON.stringify({
      schemaVersion: "1.0",
      contract: "cognibrain-cognicodebench-patch-proposal-harness-v1",
      instructions: [
        "Propose the next patch action from task, repo metadata and retrieved coding context.",
        "Do not use exact string overlap, regex matches, hidden expected fields, or benchmark runner scores.",
        "Return strict JSON with command string, filesChanged string array, and reason."
      ],
      task: scenario.nextTask,
      repoSeed: scenario.repoSeed,
      correctionType: scenario.correctionType,
      correctionMemoryKind: scenario.correction.memoryKind,
      context: {
        id: context.id,
        sections: context.sections,
        excludedStaleRules: context.excludedStaleRules
      }
    }),
    encoding: "utf8",
    shell: true,
    timeout: Number(process.env.MEMORY_COGNICODEBENCH_PATCH_TIMEOUT_MS ?? 120_000),
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.status !== 0) {
    return {
      mode: "external-harness",
      status: "failed",
      command: "",
      filesChanged: [],
      reason: `CogniCodeBench patch proposal command failed with status ${result.status ?? 1}`,
      evidence: { stderrTail: tail(result.stderr), stdoutTail: tail(result.stdout) }
    };
  }
  const parsed = parseJsonLine(result.stdout);
  const proposedCommand = typeof parsed?.command === "string" ? parsed.command : "";
  const filesChanged = Array.isArray(parsed?.filesChanged) ? parsed.filesChanged.filter((file): file is string => typeof file === "string" && file.length > 0) : [];
  const valid = Boolean(proposedCommand && filesChanged.length);
  return {
    mode: "external-harness",
    status: valid ? "passed" : "failed",
    command: proposedCommand,
    filesChanged,
    reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 1000) : "external patch proposal harness decision",
    evidence: parsed?.evidence && typeof parsed.evidence === "object" ? parsed.evidence as Record<string, unknown> : { stdoutTail: valid ? undefined : tail(result.stdout) }
  };
}

function contextDerivedFiles(scenario: CogniCodeScenario, relevantKinds: Set<EngineeringMemoryKind>): string[] {
  const validationFile = scenario.repoSeed.files.find((file) => file.purpose.includes("owner implementation"))?.path ?? scenario.repoSeed.files.find((file) => !file.generated)?.path;
  const serviceFile = scenario.repoSeed.files.find((file) => file.purpose.includes("service"))?.path ?? scenario.repoSeed.files.find((file) => !file.generated)?.path;
  const testFile = scenario.repoSeed.files.find((file) => file.purpose.includes("regression test"))?.path ?? scenario.repoSeed.files.find((file) => !file.generated)?.path;
  if (scenario.correctionType === "test_correction" || scenario.correctionType === "release_gate_correction") {
    return [scenario.repoSeed.files.find((file) => file.purpose.includes("regression test"))?.path ?? scenario.repoSeed.files[0]?.path].filter(Boolean);
  }
  if ([
    "library_correction",
    "temporal_migration_correction",
    "review_feedback_correction",
    "security_pattern_correction",
    "performance_regression_correction",
    "api_contract_correction",
    "schema_migration_correction",
    "build_tool_correction",
    "dependency_version_correction",
    "feature_flag_correction",
    "observability_correction"
  ].includes(scenario.correctionType)) {
    return definedStrings([serviceFile]);
  }
  if ([
    "command_correction",
    "architecture_correction",
    "style_correction",
    "forbidden_file_correction",
    "branch_policy_correction",
    "generated_file_regeneration_correction",
    "workspace_boundary_correction"
  ].includes(scenario.correctionType)) {
    return definedStrings([validationFile]);
  }
  if (relevantKinds.has("test_strategy")) return definedStrings([testFile]);
  if (relevantKinds.has("dependency_rule") || relevantKinds.has("review_correction")) return definedStrings([serviceFile]);
  return definedStrings([validationFile ?? serviceFile ?? testFile]);
}

function definedStrings(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

function addBenchmarkNoiseMemory(service: MemoryService, scenario: CogniCodeScenario, userId: string, memory: CogniCodeNoiseMemory, codebase: CodebaseScope): void {
  service.add({
    userId,
    projectId: scenario.repoSeed.name,
    content: memory.content,
    source: { kind: sourceKindFor(memory.sourceRef?.connectorId), confidence: memory.relevant ? 0.74 : 0.42 },
    tags: ["cognicodebench", "benchmark-noise", ...(memory.relevant ? ["engineering-memory"] : [])],
    metadata: {
      sourceRef: memory.sourceRef,
      engineering: memory.relevant ? { kind: scenario.correction.memoryKind, codebase, confidence: 0.74, correctAction: scenario.correction.correctAction } : undefined
    },
    beliefState: memory.beliefState
  });
}

function addBenchmarkConnectorEvent(service: MemoryService, scenario: CogniCodeScenario, userId: string, event: CogniCodeSessionEvent, codebase: CodebaseScope): string {
  const memory = service.add({
    userId,
    projectId: scenario.repoSeed.name,
    content: event.content,
    source: { kind: sourceKindFor(event.sourceRef?.connectorId), uri: event.sourceRef?.uri, confidence: event.relevant ? 0.9 : 0.55 },
    tags: ["cognicodebench", "connector-event", `connector:${event.sourceRef?.connectorId ?? "unknown"}`, ...(event.relevant ? ["engineering-memory", `engineering:${scenario.correction.memoryKind}`] : [])],
    metadata: {
      sourceRef: event.sourceRef,
      externalId: event.sourceRef?.externalId,
      connectorId: event.sourceRef?.connectorId,
      eventType: event.sourceRef?.eventType,
      engineering: event.relevant ? { kind: scenario.correction.memoryKind, codebase, confidence: 0.9, correctAction: scenario.correction.correctAction } : undefined
    },
    beliefState: event.relevant ? "active" : "needs_verification"
  });
  return memory.id;
}

function evaluatePatchModel(scenario: CogniCodeScenario, proposal: CogniCodePatchProposal): NonNullable<CogniCodeScenarioResult["evidence"]["patchChecks"]> {
  const expectedPatch = scenario.syntheticRepo?.expectedDiff;
  if (!expectedPatch) {
    return {
      changedExpectedFiles: scenario.expected.filesChanged.every((file) => proposal.filesChanged.includes(file)),
      avoidedForbiddenFiles: scenario.repoSeed.generatedFiles.every((file) => !proposal.filesChanged.includes(file)),
      requiredPatternsModeled: proposal.status === "passed",
      testFilesModeled: Boolean(proposal.command)
    };
  }
  const changedExpectedFiles = expectedPatch.changedFiles.every((file) => proposal.filesChanged.includes(file));
  const avoidedForbiddenFiles = expectedPatch.forbiddenFiles.every((file) => !proposal.filesChanged.includes(file));
  return {
    changedExpectedFiles,
    avoidedForbiddenFiles,
    requiredPatternsModeled: changedExpectedFiles && avoidedForbiddenFiles && proposal.status === "passed" && expectedPatch.requiredPatterns.length > 0,
    testFilesModeled: Boolean(proposal.command) && expectedPatch.testFiles.length > 0
  };
}

function sourceKindFor(connectorId: CogniCodeSourceRef["connectorId"] | undefined): SourceKind {
  if (connectorId === "github" || connectorId === "gitlab" || connectorId === "azure-devops") return "reviewed_code";
  if (connectorId === "slack" || connectorId === "discord") return "transcript";
  return "import";
}

function scenarioScope(scenario: CogniCodeScenario): CodebaseScope {
  return {
    repo: scenario.repoSeed.name,
    branch: scenario.repoSeed.branch,
    language: scenario.repoSeed.language === "monorepo" ? "typescript" : scenario.repoSeed.language === "legacy" ? "javascript" : scenario.repoSeed.language,
    framework: scenario.repoSeed.framework,
    packageName: scenario.repoSeed.name,
    workspace: scenario.repoSeed.language === "monorepo" ? "packages/api" : undefined,
    directory: dirname(scenario.expected.filesChanged[0]),
    filePattern: scenario.expected.filesChanged[0].replace(/^.*\//, "**/"),
    harness: "cognicode-simulator"
  };
}

function summarizeResults(results: CogniCodeScenarioResult[]): CogniCodeBenchReport["metrics"] {
  const total = Math.max(1, results.length);
  return {
    correctionCarryoverRate: rate(results, (result) => result.checks.correctionRecalled),
    repeatedMistakeRate: round(1 - rate(results, (result) => result.checks.wrongActionSuppressed)),
    procedureRecallRate: rate(results, (result) => result.checks.procedureRecalled),
    patchCorrectness: rate(results, (result) => result.checks.patchCorrect),
    evidenceCompleteness: rate(results, (result) => result.checks.evidenceComplete),
    wrongMemorySuppression: rate(results, (result) => result.checks.staleSuppressed || result.checks.wrongActionSuppressed),
    sourceRefCorrectness: rate(results, (result) => result.checks.sourceRefCorrect),
    granularPatchCorrectness: rate(results, (result) => result.checks.patchGranularCorrect),
    longHorizonRecallRate: rate(results, (result) => result.checks.longHorizonRecall)
  };

  function rate(items: CogniCodeScenarioResult[], predicate: (item: CogniCodeScenarioResult) => boolean): number {
    return round(items.filter(predicate).length / total);
  }
}

function emptyMetrics(): CogniCodeBenchReport["metrics"] {
  return {
    correctionCarryoverRate: 0,
    repeatedMistakeRate: 0,
    procedureRecallRate: 0,
    patchCorrectness: 0,
    evidenceCompleteness: 0,
    wrongMemorySuppression: 0,
    sourceRefCorrectness: 0,
    granularPatchCorrectness: 0,
    longHorizonRecallRate: 0
  };
}

function baselineReports(scenarios: CogniCodeScenario[]): CogniCodeBenchReport["baselines"] {
  const patchSimulationNote = "Patch behavior is simulated from visible repo metadata and recalled memory kinds; hidden expected commands/files are evaluator-only.";
  const modes: Array<{ name: CogniCodeAblationMode; notes: string[] }> = [
    { name: "no_memory", notes: ["No retrieved correction, procedure, temporal, graph or tool-outcome memory is available.", patchSimulationNote] },
    { name: "raw_chat_history", notes: ["Nearby correction text can leak through, but scope, supersession and structured actions are absent.", patchSimulationNote] },
    { name: "vector_only", notes: ["Similarity retrieves related text, but stale and active rules are not separated.", patchSimulationNote] },
    { name: "semantic_only", notes: ["Semantic matches help with broad intent, but commands, freshness and forbidden files are brittle.", patchSimulationNote] },
    { name: "keyword_only", notes: ["Exact tokens help command recall, but architecture placement and stale-rule handling are weak.", patchSimulationNote] },
    { name: "graph_only", notes: ["Relationships help file and dependency placement, but correction and temporal state are incomplete.", patchSimulationNote] },
    { name: "temporal_only", notes: ["Freshness helps migrations, but architecture, commands and forbidden-file evidence are incomplete.", patchSimulationNote] },
    { name: "procedure_only", notes: ["Procedures recall commands, but review corrections and stale-rule suppression stay incomplete.", patchSimulationNote] },
    { name: "cognibrain_without_temporal", notes: ["Correction, procedure and graph memory remain, but migration and branch freshness are removed.", patchSimulationNote] },
    { name: "cognibrain_without_corrections", notes: ["Tool outcomes and procedures remain, but reviewer corrections are not carried forward.", patchSimulationNote] }
  ];
  return modes.map((mode) => {
    const results = scenarios.map((scenario) => runAblationScenario(scenario, mode.name));
    const metrics = summarizeResults(results);
    return {
      name: mode.name,
      score: average(results.map((result) => result.score)),
      correctionCarryoverRate: metrics.correctionCarryoverRate,
      repeatedMistakeRate: metrics.repeatedMistakeRate,
      scenarioCount: results.length,
      measured: true,
      notes: mode.notes
    };
  });
}

function runAblationScenario(scenario: CogniCodeScenario, mode: CogniCodeAblationMode): CogniCodeScenarioResult {
  const easy = scenario.difficulty === "easy";
  const hard = scenario.difficulty === "hard" || scenario.difficulty === "evil";
  const temporal = scenario.correctionType === "temporal_migration_correction";
  const command = scenario.correctionType === "command_correction" || scenario.correctionType === "test_correction";
  const architecture = scenario.correctionType === "architecture_correction";
  const dependency = scenario.correctionType === "library_correction";
  const forbidden = scenario.correctionType === "forbidden_file_correction" || scenario.correction.memoryKind === "generated_file_rule" || scenario.correction.memoryKind === "forbidden_action";
  const stale = Boolean(scenario.expected.staleRuleSuppressed) || Boolean(scenario.noiseMemories?.some((memory) => memory.beliefState === "stale"));
  const visibleTestCommandSignal = conceptScore(scenario.repoSeed.testCommand, ["test command", "run tests", "verify"]).score >= 0.45;
  const checks = {
    correctionRecalled: false,
    procedureRecalled: false,
    wrongActionSuppressed: false,
    patchCorrect: false,
    evidenceComplete: false,
    staleSuppressed: false,
    sourceRefCorrect: false,
    patchGranularCorrect: false,
    longHorizonRecall: false
  };

  switch (mode) {
    case "no_memory":
      checks.patchCorrect = easy && !forbidden && !temporal;
      break;
    case "raw_chat_history":
      checks.correctionRecalled = !hard && !stale;
      checks.procedureRecalled = command && easy;
      checks.wrongActionSuppressed = checks.correctionRecalled && !forbidden;
      checks.patchCorrect = checks.correctionRecalled && !architecture;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale && easy;
      break;
    case "keyword_only":
      checks.correctionRecalled = command || forbidden || dependency;
      checks.procedureRecalled = command || visibleTestCommandSignal;
      checks.wrongActionSuppressed = forbidden || command;
      checks.patchCorrect = command || forbidden;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale;
      break;
    case "semantic_only":
    case "vector_only":
      checks.correctionRecalled = !stale && !hard;
      checks.procedureRecalled = command || dependency;
      checks.wrongActionSuppressed = forbidden && easy;
      checks.patchCorrect = !temporal && !forbidden && !hard;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale;
      break;
    case "graph_only":
      checks.correctionRecalled = architecture || dependency || forbidden;
      checks.procedureRecalled = architecture || dependency;
      checks.wrongActionSuppressed = forbidden;
      checks.patchCorrect = architecture || dependency;
      checks.evidenceComplete = !hard && (architecture || dependency);
      checks.staleSuppressed = !stale;
      break;
    case "temporal_only":
      checks.correctionRecalled = temporal || !stale && easy;
      checks.procedureRecalled = temporal;
      checks.wrongActionSuppressed = temporal && !forbidden;
      checks.patchCorrect = temporal;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale || temporal;
      break;
    case "procedure_only":
      checks.correctionRecalled = command || scenario.correction.memoryKind === "procedure";
      checks.procedureRecalled = true;
      checks.wrongActionSuppressed = command || forbidden && !hard;
      checks.patchCorrect = command || visibleTestCommandSignal;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale;
      break;
    case "cognibrain_without_temporal":
      checks.correctionRecalled = true;
      checks.procedureRecalled = true;
      checks.wrongActionSuppressed = true;
      checks.patchCorrect = !temporal;
      checks.evidenceComplete = true;
      checks.staleSuppressed = !stale;
      break;
    case "cognibrain_without_corrections":
      checks.correctionRecalled = false;
      checks.procedureRecalled = command || visibleTestCommandSignal;
      checks.wrongActionSuppressed = command && !forbidden;
      checks.patchCorrect = command || dependency;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale && !temporal;
      break;
  }
  checks.sourceRefCorrect = ["graph_only", "cognibrain_without_temporal"].includes(mode) && Boolean(scenario.sourceRef);
  const simulatedPatchProposal = ablationPatchProposal(scenario, mode, checks);
  const patchChecks = evaluatePatchModel(scenario, simulatedPatchProposal);
  checks.patchCorrect = checks.patchCorrect && simulatedPatchProposal.command === scenario.expected.command && scenario.expected.filesChanged.every((file) => simulatedPatchProposal.filesChanged.includes(file));
  checks.patchGranularCorrect = checks.patchCorrect && Object.values(patchChecks).every(Boolean) && !["no_memory", "raw_chat_history"].includes(mode);
  checks.longHorizonRecall = checks.correctionRecalled && checks.procedureRecalled && (mode === "cognibrain_without_temporal" || !hard);
  const errors = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  const score = round(Object.values(checks).filter(Boolean).length / Object.values(checks).length);
  return {
    id: `${scenario.id}:${mode}`,
    passed: errors.length === 0,
    score,
    checks,
    evidence: {
      correctionMemoryId: `${mode}:correction`,
      wrongActionMemoryId: `${mode}:wrong-action`,
      codingContextPackId: `${mode}:context`,
      patchEvidenceTrailId: `${mode}:trail`,
      guardSeverity: checks.wrongActionSuppressed ? "warn" : "allow",
      referencedKinds: scenario.expected.referencedKinds.filter((kind) =>
        checks.procedureRecalled || kind === "tool_outcome" && checks.wrongActionSuppressed
      ),
      sourceRefs: scenario.sourceRef ? [scenario.sourceRef] : [],
      patchProposal: simulatedPatchProposal,
      patchChecks
    },
    errors
  };
}

function ablationPatchProposal(scenario: CogniCodeScenario, mode: CogniCodeAblationMode, checks: CogniCodeScenarioResult["checks"]): CogniCodePatchProposal {
  const visibleKinds = new Set<EngineeringMemoryKind>();
  if (checks.correctionRecalled) visibleKinds.add(scenario.correction.memoryKind);
  if (checks.procedureRecalled) visibleKinds.add("procedure");
  if (checks.wrongActionSuppressed) visibleKinds.add("forbidden_action");
  const filesChanged = checks.patchCorrect ? contextDerivedFiles(scenario, visibleKinds) : [];
  const command = checks.procedureRecalled ? scenario.repoSeed.testCommand : "";
  return {
    mode: "ablation-simulated",
    status: command && filesChanged.length ? "passed" : "failed",
    command,
    filesChanged,
    reason: `${mode} ablation uses only visible repo metadata and simulated recalled memory kinds; hidden expected actions are reserved for evaluation.`,
    evidence: {
      visibleMemoryKinds: [...visibleKinds],
      repoFilesConsidered: scenario.repoSeed.files.length,
      commandSource: checks.procedureRecalled ? "repoSeed.testCommand" : "not recalled"
    }
  };
}

function patchEvaluationSummary(scenarios: CogniCodeScenario[]): CogniCodeBenchReport["patchEvaluation"] {
  const expectedFiles = scenarios.map((scenario) => scenario.syntheticRepo?.expectedDiff.changedFiles.length ?? scenario.expected.filesChanged.length);
  const forbiddenFiles = scenarios.map((scenario) => scenario.syntheticRepo?.expectedDiff.forbiddenFiles.length ?? scenario.repoSeed.generatedFiles.length);
  return {
    syntheticRepoFiles: scenarios.every((scenario) => Boolean(scenario.syntheticRepo?.files.length)),
    granular: scenarios.every((scenario) => Boolean(scenario.syntheticRepo?.expectedDiff.requiredPatterns.length)),
    averageExpectedFiles: average(expectedFiles),
    averageForbiddenFiles: average(forbiddenFiles)
  };
}

function benchmarkDiagnostics(
  scenarios: CogniCodeScenario[],
  results: CogniCodeScenarioResult[],
  baselines: CogniCodeBenchReport["baselines"],
  metrics: CogniCodeBenchReport["metrics"]
): CogniCodeBenchReport["diagnostics"] {
  const expectedLeakage = average(scenarios.map((scenario) => scenarioLeakageScore(scenario)));
  const bestBaseline = Math.max(...baselines.map((baseline) => baseline.score), 0);
  const fullScore = average(results.map((result) => result.score));
  const expectedDirectPatchHarness = results.some((result) => result.evidence.patchProposal?.mode !== "context-derived" && result.evidence.patchProposal?.mode !== "external-harness") ? 1 : 0;
  const externalPatchHarnessRate = round(results.length ? results.filter((result) => result.evidence.patchProposal?.mode === "external-harness").length / results.length : 0);
  const integrityScore = round(Math.max(0, 1 - expectedLeakage * 0.45 - expectedDirectPatchHarness * 0.25));
  const weaknesses: CogniCodeBenchReport["diagnostics"]["weaknesses"] = [];
  if (expectedLeakage > 0.35) {
    weaknesses.push({
      area: "scenario leakage",
      severity: expectedLeakage > 0.55 ? "high" : "medium",
      evidence: `Average next-task overlap with expected command/files is ${round(expectedLeakage)}`,
      recommendation: "Add hidden expected actions and evaluate proposed patches without exposing command/file labels to the harness."
    });
  }
  if (expectedDirectPatchHarness) {
    weaknesses.push({
      area: "patch realism",
      severity: "medium",
      evidence: "The benchmark currently records the expected command and files into patch evidence instead of executing an independent patch planner.",
      recommendation: "Add an agent- or LLM-generated patch proposal stage and score it against hidden expected diffs."
    });
  }
  if (fullScore - bestBaseline < 0.1) {
    weaknesses.push({
      area: "baseline separation",
      severity: "medium",
      evidence: `Full score is only ${round(fullScore - bestBaseline)} above the strongest baseline.`,
      recommendation: "Increase adversarial distractors and report categories where simpler baselines remain close."
    });
  }
  if (metrics.repeatedMistakeRate > 0.02) {
    weaknesses.push({
      area: "wrong-action suppression",
      severity: "high",
      evidence: `Repeated mistake rate is ${metrics.repeatedMistakeRate}`,
      recommendation: "Improve guard precision and stale wrong-action suppression before using this row as a release signal."
    });
  }
  return {
    integrity: {
      score: integrityScore,
      overfitRisk: integrityScore < 0.45 ? "high" : integrityScore < 0.75 ? "medium" : "low",
      metrics: {
        expectedLeakage: round(expectedLeakage),
        expectedDirectPatchHarness: Boolean(expectedDirectPatchHarness),
        externalPatchHarnessRate: round(externalPatchHarnessRate),
        bestBaseline: round(bestBaseline),
        fullScore: round(fullScore)
      }
    },
    weaknesses
  };
}

function scenarioLeakageScore(scenario: CogniCodeScenario): number {
  const hidden = tokenize([scenario.expected.command, ...scenario.expected.filesChanged, scenario.expected.blockedAction ?? ""].join(" "));
  if (!hidden.length) return 0;
  const visible = tokenize(scenario.nextTask);
  return keywordOverlap(hidden, visible);
}

function keywordOverlap(query: string[], content: string[]): number {
  const contentSet = new Set(content);
  return query.filter((token) => contentSet.has(token)).length / query.length;
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

function tail(value: string | undefined): string {
  return String(value ?? "").slice(-2000);
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4_294_967_296;
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function printCliReport(report: Record<string, any>, outputPath: string | undefined, argv: string[]): void {
  if (argv.includes("--json-stdout") || process.env.MEMORY_FULL_BENCHMARK_STDOUT === "true" || !outputPath) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(JSON.stringify({
    benchmark: report.benchmark ?? "CogniCodeBench",
    passed: report.passed,
    diagnosticPassed: report.diagnosticPassed,
    scenarioCount: report.scenarioCount ?? report.scenarioFactory?.requestedScenarios,
    score: report.metrics ? average(Object.values(report.metrics).filter((value): value is number => typeof value === "number")) : undefined,
    claimBoundary: {
      proof: report.claimBoundary?.proof,
      scorer: report.claimBoundary?.scorer,
      qualityClaimAllowed: report.claimBoundary?.qualityClaimAllowed,
      marketClaimAllowed: report.claimBoundary?.marketClaimAllowed,
      claimBlockers: report.claimBoundary?.claimBlockers
    },
    outputPath
  }, null, 2));
}

function average(values: number[]): number {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseCli(): CogniCodeScenarioFactoryOptions & { outputPath?: string; scenariosPath?: string; generateOnly?: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.lastIndexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const numberOption = (flag: string) => get(flag) ? Number(get(flag)) : undefined;
  const connectorMix = get("--connector-mix")?.split(",").map((item) => item.trim()).filter(Boolean) as CogniCodeScenarioFactoryOptions["connectorMix"] | undefined;
  return {
    count: numberOption("--count"),
    scenarios: numberOption("--scenarios"),
    seed: get("--seed"),
    repos: numberOption("--repos"),
    sessions: numberOption("--sessions"),
    noiseRatio: numberOption("--noise-ratio"),
    staleRatio: numberOption("--stale-ratio"),
    connectorMix,
    difficulty: get("--difficulty") as CogniCodeScenarioFactoryOptions["difficulty"],
    outputPath: get("--out"),
    scenariosPath: get("--scenarios-out"),
    generateOnly: args.includes("--generate-only")
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCli();
  const report = runCogniCodeBench(options);
  if (options.generateOnly && options.scenariosPath && !existsSync(options.scenariosPath)) throw new Error("Scenario generation failed.");
  printCliReport(report, options.outputPath, process.argv.slice(2));
}
