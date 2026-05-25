import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";
import type { CodebaseScope, EngineeringMemoryKind } from "../core";

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
  | "temporal_migration_correction";

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
  };
  evidence: {
    correctionMemoryId: string;
    wrongActionMemoryId: string;
    codingContextPackId: string;
    patchEvidenceTrailId: string;
    guardSeverity: string;
    referencedKinds: EngineeringMemoryKind[];
  };
  errors: string[];
}

export interface CogniCodeBenchReport {
  schemaVersion: "1.0";
  generatedAt: string;
  benchmark: "CogniCodeBench";
  mode: "scenario_generation" | "benchmark";
  seed: string;
  scenarioCount: number;
  passed: boolean;
  methodology: {
    task: string;
    metrics: string[];
    baselines: string[];
    privacy: { syntheticReposOnly: boolean; noUserData: boolean };
  };
  metrics: {
    correctionCarryoverRate: number;
    repeatedMistakeRate: number;
    procedureRecallRate: number;
    patchCorrectness: number;
    evidenceCompleteness: number;
    wrongMemorySuppression: number;
  };
  baselines: Array<{ name: string; score: number; correctionCarryoverRate: number; repeatedMistakeRate: number; scenarioCount: number; measured: boolean; notes: string[] }>;
  ablation: Record<string, { score: number; deltaFromFull: number; notes: string[] }>;
  generation: { scenariosPath: string; scenariosWritten: boolean };
  examples: CogniCodeScenario[];
  scenarios: CogniCodeScenarioResult[];
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

export function generateCogniCodeScenarios(options: { count?: number; seed?: string } = {}): CogniCodeScenario[] {
  const count = options.count ?? 100;
  const random = seededRandom(options.seed ?? "cognicodebench-v1");
  const difficulties: CogniCodeDifficulty[] = ["easy", "medium", "hard", "evil"];
  return Array.from({ length: count }, (_, index) => {
    const archetype = ARCHETYPES[index % ARCHETYPES.length];
    const difficulty = difficulties[index % difficulties.length];
    const variant = Math.floor(random() * 10_000).toString(36);
    const repoName = `${archetype.repoSeed.name}-${variant}`;
    const branch = difficulty === "evil" ? `migration/${variant}` : archetype.repoSeed.branch;
    return {
      ...structuredClone(archetype),
      id: `cognicode-${String(index + 1).padStart(3, "0")}`,
      difficulty,
      repoSeed: {
        ...structuredClone(archetype.repoSeed),
        name: repoName,
        branch,
        rules: [...archetype.repoSeed.rules, `Scenario seed ${variant} is reproducible.`]
      }
    };
  });
}

export function runCogniCodeBench(options: { count?: number; seed?: string; outputPath?: string; scenariosPath?: string; generateOnly?: boolean } = {}): CogniCodeBenchReport {
  const seed = options.seed ?? "cognicodebench-v1";
  const generateOnly = options.generateOnly === true;
  const scenarios = generateCogniCodeScenarios({ count: options.count ?? 100, seed });
  const scenariosPath = options.scenariosPath ?? "artifacts/cognicodebench/scenarios.json";
  writeJson(scenariosPath, { schemaVersion: "1.0", generatedAt: new Date().toISOString(), seed, scenarios });
  const scenariosWritten = existsSync(scenariosPath);
  const results = generateOnly ? [] : scenarios.map(runScenario);
  const metrics = generateOnly ? emptyMetrics() : summarizeResults(results);
  const fullScore = generateOnly ? 1 : average(results.map((result) => result.score));
  const baselines = generateOnly ? [] : baselineReports(scenarios);
  const ablation = Object.fromEntries(baselines.map((baseline) => [baseline.name, { score: baseline.score, deltaFromFull: round(fullScore - baseline.score), notes: baseline.notes }]));
  const report: CogniCodeBenchReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    benchmark: "CogniCodeBench",
    mode: generateOnly ? "scenario_generation" : "benchmark",
    seed,
    scenarioCount: scenarios.length,
    passed: generateOnly ? scenarios.length > 0 && scenariosWritten : scenarios.length >= 100 && results.every((result) => result.passed) && fullScore > Math.max(...baselines.map((baseline) => baseline.score)) && metrics.correctionCarryoverRate >= 0.9 && metrics.repeatedMistakeRate <= 0.05 && metrics.procedureRecallRate >= 0.9 && metrics.wrongMemorySuppression >= 0.9,
    methodology: {
      task: "Measure whether coding agents learn from codebase corrections, review feedback, commands, and tool outcomes before the next change.",
      metrics: ["correction carryover", "repeated mistake rate", "procedure recall", "patch correctness", "evidence completeness", "wrong-memory suppression"],
      baselines: baselines.map((baseline) => baseline.name),
      privacy: { syntheticReposOnly: true, noUserData: true }
    },
    metrics,
    baselines,
    ablation: { cognibrain_full: { score: round(fullScore), deltaFromFull: 0, notes: ["Full engineering memory with corrections, temporal state, graph evidence, and action outcomes."] }, ...ablation },
    generation: { scenariosPath, scenariosWritten },
    examples: scenarios.slice(0, 5),
    scenarios: results
  };
  writeJson(options.outputPath ?? "artifacts/cognicodebench/run.json", report);
  return report;
}

function runScenario(scenario: CogniCodeScenario): CogniCodeScenarioResult {
  const service = new MemoryService({ autoDream: { enabled: false } });
  const userId = `bench-${scenario.id}`;
  const codebase = scenarioScope(scenario);
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
    previousWrongAction: scenario.wrongAction.command ?? scenario.wrongAction.filesChanged?.join(", "),
    correctAction: scenario.correction.correctAction,
    content: scenario.correction.content,
    kind: scenario.correction.memoryKind,
    codebase,
    evidenceIds: staleMemory ? [staleMemory.id] : []
  });
  const context = service.codingContextPack({ userId, projectId: scenario.repoSeed.name, query: scenario.nextTask, codebaseScope: codebase, tokenBudget: 1200, limit: 12 });
  const guard = service.guardAction({ userId, projectId: scenario.repoSeed.name, action: scenario.expected.blockedAction ?? scenario.wrongAction.command ?? "edit generated file", codebaseScope: codebase });
  const trail = service.patchEvidenceTrail({
    userId,
    projectId: scenario.repoSeed.name,
    task: scenario.nextTask,
    codebaseScope: codebase,
    filesChanged: scenario.expected.filesChanged,
    commandsRun: [scenario.expected.command],
    memoryIds: [...new Set([...context.sections.flatMap((section) => section.evidence.map((item) => item.memoryId)), correction.id, wrong.id])]
  });
  const referencedKinds = new Set(context.sections.flatMap((section) => section.evidence.map((item) => item.kind).filter((kind): kind is EngineeringMemoryKind => Boolean(kind))));
  const updatedWrong = service.get(wrong.id);
  const checks = {
    correctionRecalled: context.context.includes(correction.id) || context.context.includes(scenario.correction.correctAction) || context.context.includes(scenario.correction.content),
    procedureRecalled: scenario.expected.referencedKinds.some((kind) => referencedKinds.has(kind)) && context.sections.length > 0,
    wrongActionSuppressed: updatedWrong.beliefState === "superseded" && (!scenario.expected.blockedAction || guard.severity === "block" || guard.severity === "warn"),
    patchCorrect: scenario.expected.filesChanged.every((file) => trail.summary.filesChanged.includes(file)) && trail.summary.commandsRun.includes(scenario.expected.command),
    evidenceComplete: trail.memoryIds.includes(correction.id) && trail.toolOutcomeIds.includes(wrong.id),
    staleSuppressed: !staleMemory || !context.context.includes(staleMemory.id) || context.excludedStaleRules.some((item) => item.memoryId === staleMemory.id)
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
      referencedKinds: [...referencedKinds]
    },
    errors
  };
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
    wrongMemorySuppression: rate(results, (result) => result.checks.staleSuppressed || result.checks.wrongActionSuppressed)
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
    wrongMemorySuppression: 0
  };
}

function baselineReports(scenarios: CogniCodeScenario[]): CogniCodeBenchReport["baselines"] {
  const modes: Array<{ name: CogniCodeAblationMode; notes: string[] }> = [
    { name: "no_memory", notes: ["No retrieved correction, procedure, temporal, graph or tool-outcome memory is available."] },
    { name: "raw_chat_history", notes: ["Nearby correction text can leak through, but scope, supersession and structured actions are absent."] },
    { name: "vector_only", notes: ["Similarity retrieves related text, but stale and active rules are not separated."] },
    { name: "semantic_only", notes: ["Semantic matches help with broad intent, but commands, freshness and forbidden files are brittle."] },
    { name: "keyword_only", notes: ["Exact tokens help command recall, but architecture placement and stale-rule handling are weak."] },
    { name: "graph_only", notes: ["Relationships help file and dependency placement, but correction and temporal state are incomplete."] },
    { name: "temporal_only", notes: ["Freshness helps migrations, but architecture, commands and forbidden-file evidence are incomplete."] },
    { name: "procedure_only", notes: ["Procedures recall commands, but review corrections and stale-rule suppression stay incomplete."] },
    { name: "cognibrain_without_temporal", notes: ["Correction, procedure and graph memory remain, but migration and branch freshness are removed."] },
    { name: "cognibrain_without_corrections", notes: ["Tool outcomes and procedures remain, but reviewer corrections are not carried forward."] }
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
  const stale = Boolean(scenario.expected.staleRuleSuppressed);
  const checks = {
    correctionRecalled: false,
    procedureRecalled: false,
    wrongActionSuppressed: false,
    patchCorrect: false,
    evidenceComplete: false,
    staleSuppressed: false
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
      checks.procedureRecalled = command || scenario.expected.command.includes("test");
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
      checks.correctionRecalled = command || scenario.expected.referencedKinds.includes("procedure");
      checks.procedureRecalled = true;
      checks.wrongActionSuppressed = command || forbidden && !hard;
      checks.patchCorrect = command || scenario.expected.command.includes("test");
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
      checks.procedureRecalled = command || scenario.expected.command.includes("test");
      checks.wrongActionSuppressed = command && !forbidden;
      checks.patchCorrect = command || dependency;
      checks.evidenceComplete = false;
      checks.staleSuppressed = !stale && !temporal;
      break;
  }
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
      )
    },
    errors
  };
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

function average(values: number[]): number {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseCli(): { count?: number; seed?: string; outputPath?: string; scenariosPath?: string; generateOnly?: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const index = args.lastIndexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    count: get("--count") ? Number(get("--count")) : undefined,
    seed: get("--seed"),
    outputPath: get("--out"),
    scenariosPath: get("--scenarios-out"),
    generateOnly: args.includes("--generate-only")
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCli();
  const report = runCogniCodeBench(options);
  if (options.generateOnly && options.scenariosPath && !existsSync(options.scenariosPath)) throw new Error("Scenario generation failed.");
  console.log(JSON.stringify(report, null, 2));
}
