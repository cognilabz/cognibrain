import type { EngineeringMemoryKind } from "../../core";
import type { CogniCodeCorrectionType, CogniCodeDifficulty, CogniCodeScenario } from "../cognicodeBench";

export type CogniCodeConnectorId =
  | "github"
  | "gitlab"
  | "azure-devops"
  | "jira"
  | "confluence"
  | "notion"
  | "linear"
  | "slack"
  | "discord";

export interface CogniCodeSourceRef {
  connectorId: CogniCodeConnectorId;
  externalId: string;
  uri: string;
  eventType: string;
}

export interface CogniCodeSessionEvent {
  index: number;
  kind: "task" | "wrong_action" | "correction" | "tool_outcome" | "connector_event" | "noise" | "stale_memory";
  content: string;
  relevant: boolean;
  sourceRef?: CogniCodeSourceRef;
}

export interface CogniCodeNoiseMemory {
  content: string;
  beliefState?: "active" | "stale" | "superseded" | "contradicted" | "needs_verification";
  sourceRef?: CogniCodeSourceRef;
  relevant: boolean;
}

export interface CogniCodePatchModel {
  files: Array<{ path: string; content: string; generated?: boolean }>;
  expectedDiff: {
    changedFiles: string[];
    forbiddenFiles: string[];
    requiredPatterns: string[];
    testFiles: string[];
  };
}

export interface CogniCodeScenarioFactoryOptions {
  count?: number;
  scenarios?: number;
  seed?: string;
  repos?: number;
  sessions?: number;
  noiseRatio?: number;
  staleRatio?: number;
  connectorMix?: CogniCodeConnectorId[];
  difficulty?: CogniCodeDifficulty | "mixed";
}

export interface CogniCodeScenarioFactorySummary {
  version: "2.0";
  seed: string;
  requestedScenarios: number;
  requestedRepos: number;
  sessionsPerScenario: number;
  noiseRatio: number;
  staleRatio: number;
  connectorMix: CogniCodeConnectorId[];
  requestedDifficulty: CogniCodeDifficulty | "mixed";
  availableRepoTemplates: number;
  availableCorrectionTypes: number;
  generatedMemoryEvents: number;
  connectorEventCount: number;
  difficultyDistribution: Record<CogniCodeDifficulty, number>;
  horizon: {
    short: number;
    medium: number;
    long: number;
    averageLength: number;
  };
}

export interface CogniCodeScenarioFactoryResult {
  scenarios: CogniCodeScenario[];
  summary: CogniCodeScenarioFactorySummary;
}

type RepoLanguage = CogniCodeScenario["repoSeed"]["language"];
type PackageManager = CogniCodeScenario["repoSeed"]["packageManager"];

interface RepoTemplate {
  name: string;
  language: RepoLanguage;
  framework: string;
  packageManager: PackageManager;
  testCommand: string;
  validationFile: string;
  serviceFile: string;
  testFile: string;
  generatedFile: string;
  rules: string[];
  hiddenTrap: string;
}

interface CorrectionTemplate {
  type: CogniCodeCorrectionType;
  memoryKind: EngineeringMemoryKind;
  label: string;
  wrongCommand?: (repo: RepoTemplate) => string;
  wrongFile?: (repo: RepoTemplate) => string;
  expectedFile: (repo: RepoTemplate) => string;
  correctAction: (repo: RepoTemplate) => string;
  content: (repo: RepoTemplate, connector: CogniCodeSourceRef, variant: string) => string;
  task: (repo: RepoTemplate, variant: string) => string;
  referencedKinds: EngineeringMemoryKind[];
  staleRule?: (repo: RepoTemplate) => string;
  blockedAction?: (repo: RepoTemplate) => string;
  requiredPatterns: string[];
}

const connectorIds: CogniCodeConnectorId[] = ["github", "jira", "confluence", "notion", "slack", "linear", "gitlab", "azure-devops", "discord"];

const languageProfiles: Array<{
  language: RepoLanguage;
  frameworks: string[];
  packageManager: PackageManager;
  testCommand: string;
  validationFile: string;
  serviceFile: string;
  testFile: string;
  generatedFile: string;
}> = [
  {
    language: "typescript",
    frameworks: ["node", "nestjs", "express", "fastify"],
    packageManager: "npm",
    testCommand: "npm test",
    validationFile: "src/validation/userValidation.ts",
    serviceFile: "src/services/accountService.ts",
    testFile: "src/validation/userValidation.test.ts",
    generatedFile: "src/generated/api.generated.ts"
  },
  {
    language: "python",
    frameworks: ["fastapi", "django", "flask", "litestar"],
    packageManager: "pip",
    testCommand: "pytest tests/unit",
    validationFile: "app/validation/invoices.py",
    serviceFile: "app/services/invoice_service.py",
    testFile: "tests/unit/test_invoices.py",
    generatedFile: "app/schemas/generated_models.py"
  },
  {
    language: "go",
    frameworks: ["chi", "gin", "fiber", "grpc"],
    packageManager: "go",
    testCommand: "go test ./...",
    validationFile: "internal/validation/orders.go",
    serviceFile: "internal/orders/service.go",
    testFile: "internal/orders/service_test.go",
    generatedFile: "internal/gen/openapi.gen.go"
  },
  {
    language: "react",
    frameworks: ["react", "nextjs", "vite", "remix"],
    packageManager: "npm",
    testCommand: "npm run test -- SettingsPanel",
    validationFile: "src/components/settings/SettingsPanel.tsx",
    serviceFile: "src/features/billing/settings.ts",
    testFile: "src/components/settings/SettingsPanel.test.tsx",
    generatedFile: "src/graphql/types.generated.ts"
  },
  {
    language: "monorepo",
    frameworks: ["turbo", "nx", "pnpm-workspace", "rush"],
    packageManager: "npm",
    testCommand: "npm run test --workspace packages/api",
    validationFile: "packages/api/src/validation/users.ts",
    serviceFile: "packages/api/src/routes/users.ts",
    testFile: "packages/api/src/validation/users.test.ts",
    generatedFile: "packages/api/src/schema.generated.ts"
  },
  {
    language: "legacy",
    frameworks: ["express-legacy", "rails-js", "legacy-mvc", "struts-bridge"],
    packageManager: "npm",
    testCommand: "npm run test:legacy -- billing",
    validationFile: "legacy/billing/service.js",
    serviceFile: "legacy/billing/controller.js",
    testFile: "legacy/billing/service.test.js",
    generatedFile: "legacy/billing/generated/client.js"
  }
];

const domains = [
  "atlas",
  "ledger",
  "northwind",
  "meridian",
  "orbit",
  "legacy-billing",
  "apollo",
  "cedar",
  "harbor",
  "keystone",
  "novus",
  "summit",
  "vector",
  "waypoint",
  "zephyr",
  "helix"
];

const repoKinds = ["api", "worker", "admin", "mobile-bff", "checkout", "insights", "identity", "routing"];

const correctionTemplates: CorrectionTemplate[] = [
  {
    type: "command_correction",
    memoryKind: "repo_policy",
    label: "package manager",
    wrongCommand: (repo) => repo.packageManager === "npm" ? "pnpm test" : "npm test",
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => repo.testCommand,
    content: (repo) => `Repo policy from review: use ${repo.testCommand}; do not use the globally installed fallback command.`,
    task: () => "Add the requested validation and run the repository-approved test command.",
    referencedKinds: ["repo_policy", "tool_outcome"],
    blockedAction: (repo) => repo.packageManager === "npm" ? "pnpm test" : "npm test",
    requiredPatterns: ["approved test command"]
  },
  {
    type: "library_correction",
    memoryKind: "dependency_rule",
    label: "dependency convention",
    wrongFile: (repo) => repo.serviceFile,
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Use the approved dependency pattern and run ${repo.testCommand}`,
    content: () => "Dependency rule: use the approved in-repo client package instead of introducing a new library.",
    task: () => "Update the service using the existing dependency convention.",
    referencedKinds: ["dependency_rule", "tool_outcome"],
    requiredPatterns: ["approved dependency"]
  },
  {
    type: "architecture_correction",
    memoryKind: "architecture_decision",
    label: "module boundary",
    wrongFile: (repo) => repo.serviceFile,
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Edit ${repo.validationFile} and run ${repo.testCommand}`,
    content: (repo) => `Architecture decision: validation logic belongs in ${repo.validationFile}, not inline in ${repo.serviceFile}.`,
    task: () => "Add validation in the correct architecture layer.",
    referencedKinds: ["architecture_decision", "test_strategy"],
    requiredPatterns: ["validation layer"]
  },
  {
    type: "style_correction",
    memoryKind: "forbidden_action",
    label: "legacy boundary",
    wrongFile: (repo) => repo.serviceFile,
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Keep legacy boundaries intact and run ${repo.testCommand}`,
    content: (repo) => `Forbidden action: do not edit ${repo.serviceFile} for this flow; keep the change in ${repo.validationFile}.`,
    task: () => "Apply the change without crossing the legacy boundary.",
    referencedKinds: ["forbidden_action", "tool_outcome"],
    blockedAction: (repo) => `edit ${repo.serviceFile}`,
    requiredPatterns: ["legacy boundary"]
  },
  {
    type: "test_correction",
    memoryKind: "test_strategy",
    label: "test scope",
    wrongCommand: () => "npm test",
    expectedFile: (repo) => repo.testFile,
    correctAction: (repo) => repo.testCommand,
    content: (repo) => `Test strategy: for this package, run ${repo.testCommand} after touching ${repo.testFile}.`,
    task: () => "Update the focused test and run the focused test command.",
    referencedKinds: ["test_strategy", "procedure"],
    requiredPatterns: ["focused test"]
  },
  {
    type: "forbidden_file_correction",
    memoryKind: "generated_file_rule",
    label: "generated file",
    wrongFile: (repo) => repo.generatedFile,
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Edit ${repo.validationFile}; regenerate ${repo.generatedFile} separately only when asked.`,
    content: (repo) => `Do not edit generated files like ${repo.generatedFile}; make the source change in ${repo.validationFile}.`,
    task: () => "Add the feature without touching generated files.",
    referencedKinds: ["generated_file_rule"],
    blockedAction: (repo) => `edit ${repo.generatedFile}`,
    requiredPatterns: ["generated file guard"]
  },
  {
    type: "temporal_migration_correction",
    memoryKind: "migration_note",
    label: "test migration",
    wrongCommand: () => "yarn jest packages/api",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => repo.testCommand,
    content: (repo) => `Migration note: older tasks used yarn jest, but this branch now uses ${repo.testCommand}.`,
    task: () => "Make the route change and use the current post-migration test command.",
    referencedKinds: ["migration_note", "tool_outcome"],
    staleRule: () => "yarn jest packages/api",
    requiredPatterns: ["migration aware"]
  },
  {
    type: "branch_policy_correction",
    memoryKind: "repo_policy",
    label: "branch-specific rule",
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Apply the branch-specific rule and run ${repo.testCommand}`,
    content: (repo) => `Branch policy: ${repo.name} on this branch keeps compatibility checks in ${repo.validationFile}.`,
    task: () => "Apply the branch-specific compatibility rule.",
    referencedKinds: ["repo_policy", "procedure"],
    requiredPatterns: ["branch policy"]
  },
  {
    type: "review_feedback_correction",
    memoryKind: "review_correction",
    label: "review feedback",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Address the review feedback and run ${repo.testCommand}`,
    content: () => "Review correction: preserve the existing public API and add the behavior behind the reviewed adapter.",
    task: () => "Address the review feedback without changing the public API.",
    referencedKinds: ["review_correction", "tool_outcome"],
    requiredPatterns: ["public API preserved"]
  },
  {
    type: "generated_file_regeneration_correction",
    memoryKind: "generated_file_rule",
    label: "regen workflow",
    wrongFile: (repo) => repo.generatedFile,
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Change source files, then document regeneration for ${repo.generatedFile}`,
    content: (repo) => `Generated-file procedure: never hand-edit ${repo.generatedFile}; update source files and run the generator only in a separate regeneration step.`,
    task: () => "Update source logic and avoid hand-editing generated output.",
    referencedKinds: ["generated_file_rule", "procedure"],
    blockedAction: (repo) => `hand-edit ${repo.generatedFile}`,
    requiredPatterns: ["regeneration procedure"]
  },
  {
    type: "security_pattern_correction",
    memoryKind: "architecture_decision",
    label: "security pattern",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Use the established authorization helper and run ${repo.testCommand}`,
    content: () => "Security decision: authorization must go through the established helper, not a new inline role check.",
    task: () => "Add the security check using the established helper.",
    referencedKinds: ["architecture_decision", "dependency_rule"],
    requiredPatterns: ["authorization helper"]
  },
  {
    type: "performance_regression_correction",
    memoryKind: "tool_outcome",
    label: "perf regression",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Keep the hot path allocation-free and run ${repo.testCommand}`,
    content: () => "Tool outcome: the previous patch regressed the hot path; keep the lookup cached and allocation-free.",
    task: () => "Fix the hot-path behavior without reintroducing the allocation regression.",
    referencedKinds: ["tool_outcome", "procedure"],
    requiredPatterns: ["cached lookup"]
  },
  {
    type: "api_contract_correction",
    memoryKind: "architecture_decision",
    label: "API contract",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Preserve the API contract and run ${repo.testCommand}`,
    content: () => "API contract decision: keep response fields backward-compatible and add optional fields only.",
    task: () => "Add the field without breaking the API contract.",
    referencedKinds: ["architecture_decision", "review_correction"],
    requiredPatterns: ["backward compatible"]
  },
  {
    type: "schema_migration_correction",
    memoryKind: "migration_note",
    label: "schema migration",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Use the online-safe migration pattern and run ${repo.testCommand}`,
    content: () => "Migration note: schema changes must be backward-compatible and split into expand, backfill and contract steps.",
    task: () => "Add the schema-aware code path without assuming the new column exists everywhere.",
    referencedKinds: ["migration_note", "procedure"],
    requiredPatterns: ["expand backfill contract"]
  },
  {
    type: "build_tool_correction",
    memoryKind: "repo_policy",
    label: "build tool",
    wrongCommand: () => "npm run build",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Use the workspace build wrapper and run ${repo.testCommand}`,
    content: () => "Repo policy: use the workspace build wrapper; direct package builds miss generated type checks.",
    task: () => "Make the code change and use the workspace build wrapper.",
    referencedKinds: ["repo_policy", "tool_outcome"],
    requiredPatterns: ["workspace build"]
  },
  {
    type: "workspace_boundary_correction",
    memoryKind: "architecture_decision",
    label: "workspace boundary",
    wrongFile: (repo) => repo.serviceFile,
    expectedFile: (repo) => repo.validationFile,
    correctAction: (repo) => `Stay inside the owning workspace and run ${repo.testCommand}`,
    content: (repo) => `Architecture boundary: ${repo.validationFile} owns this behavior; do not patch sibling workspaces for it.`,
    task: () => "Patch the owning workspace only.",
    referencedKinds: ["architecture_decision", "repo_policy"],
    requiredPatterns: ["owning workspace"]
  },
  {
    type: "dependency_version_correction",
    memoryKind: "dependency_rule",
    label: "dependency version",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Use the pinned dependency version and run ${repo.testCommand}`,
    content: () => "Dependency rule: keep the pinned SDK major version; newer majors changed the retry API.",
    task: () => "Use the retry API from the pinned dependency version.",
    referencedKinds: ["dependency_rule", "test_strategy"],
    requiredPatterns: ["pinned dependency"]
  },
  {
    type: "feature_flag_correction",
    memoryKind: "procedure",
    label: "feature flag",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Gate the behavior behind the existing feature flag and run ${repo.testCommand}`,
    content: () => "Procedure: new behavior must be behind the existing feature flag until release approval.",
    task: () => "Add the behavior behind the feature flag.",
    referencedKinds: ["procedure", "repo_policy"],
    requiredPatterns: ["feature flag"]
  },
  {
    type: "observability_correction",
    memoryKind: "procedure",
    label: "observability",
    expectedFile: (repo) => repo.serviceFile,
    correctAction: (repo) => `Add the existing metric and run ${repo.testCommand}`,
    content: () => "Procedure: use the existing metric namespace and include the operation label on new instrumentation.",
    task: () => "Add instrumentation using the existing metric namespace.",
    referencedKinds: ["procedure", "dependency_rule"],
    requiredPatterns: ["metric namespace"]
  },
  {
    type: "release_gate_correction",
    memoryKind: "test_strategy",
    label: "release gate",
    expectedFile: (repo) => repo.testFile,
    correctAction: (repo) => `Update release-gate coverage and run ${repo.testCommand}`,
    content: () => "Release gate: behavior changes require a focused test plus the package release gate command.",
    task: () => "Add the release-gate test coverage for the behavior change.",
    referencedKinds: ["test_strategy", "procedure"],
    requiredPatterns: ["release gate"]
  }
];

export function buildCogniCodeScenarioSet(options: CogniCodeScenarioFactoryOptions = {}): CogniCodeScenarioFactoryResult {
  const normalized = normalizeOptions(options);
  const random = seededRandom(normalized.seed);
  const templates = buildRepoTemplates();
  const selectedRepos = Array.from({ length: normalized.repos }, (_, index) => templates[index % templates.length]);
  const scenarios = Array.from({ length: normalized.count }, (_, index) => {
    const repo = selectedRepos[index % selectedRepos.length];
    const correction = correctionTemplates[index % correctionTemplates.length];
    const difficulty = chooseDifficulty(normalized.difficulty, index);
    const connector = sourceRef(normalized.connectorMix[index % normalized.connectorMix.length], index, correction.type);
    return scenarioFor({ index, repo, correction, difficulty, connector, random, options: normalized });
  });
  const summary = summarizeFactory(scenarios, templates.length, normalized);
  return { scenarios, summary };
}

export function scenarioFactoryCapabilities(): { availableRepoTemplates: number; availableCorrectionTypes: number; connectorIds: CogniCodeConnectorId[] } {
  return {
    availableRepoTemplates: buildRepoTemplates().length,
    availableCorrectionTypes: correctionTemplates.length,
    connectorIds
  };
}

function scenarioFor(input: {
  index: number;
  repo: RepoTemplate;
  correction: CorrectionTemplate;
  difficulty: CogniCodeDifficulty;
  connector: CogniCodeSourceRef;
  random: () => number;
  options: Required<Omit<CogniCodeScenarioFactoryOptions, "difficulty" | "connectorMix">> & { difficulty: CogniCodeDifficulty | "mixed"; connectorMix: CogniCodeConnectorId[] };
}): CogniCodeScenario {
  const { index, repo, correction, difficulty, connector, random, options } = input;
  const variant = Math.floor(random() * 1_000_000).toString(36);
  const branch = difficulty === "evil" ? `migration/${variant}` : index % 5 === 0 ? `feature/${correction.label.replaceAll(" ", "-")}-${variant}` : "main";
  const expectedFile = correction.expectedFile(repo);
  const wrongFile = correction.wrongFile?.(repo) ?? repo.generatedFile;
  const wrongCommand = correction.wrongCommand?.(repo) ?? "npm test";
  const noiseCount = Math.max(0, Math.round(options.sessions * clamp(options.noiseRatio, 0, 1)));
  const staleCount = Math.max(0, Math.round(options.sessions * clamp(options.staleRatio, 0, 1)));
  const sessionCount = Math.max(3, options.sessions);
  const sourceBackedCorrection = index % 3 !== 1;
  const scenario: CogniCodeScenario = {
    id: `cognicode-${String(index + 1).padStart(3, "0")}`,
    difficulty,
    correctionType: correction.type,
    repoSeed: {
      name: `${repo.name}-${variant}`,
      language: repo.language,
      framework: repo.framework,
      branch,
      packageManager: repo.packageManager,
      testCommand: repo.testCommand,
      generatedFiles: [repo.generatedFile],
      rules: [
        ...repo.rules,
        `Scenario seed ${variant} is reproducible.`,
        `Connector-backed decisions cite ${connector.connectorId}.`
      ],
      hiddenTrap: repo.hiddenTrap,
      files: [
        { path: repo.validationFile, purpose: "owner implementation" },
        { path: repo.serviceFile, purpose: "service or route boundary" },
        { path: repo.testFile, purpose: "focused regression test" },
        { path: repo.generatedFile, purpose: "generated output", generated: true }
      ]
    },
    initialTask: `Scenario ${index + 1}: ${correction.task(repo, variant)}`,
    wrongAction: {
      command: wrongCommand,
      filesChanged: [wrongFile],
      reason: `The agent ignored the ${correction.label} correction and touched ${wrongFile}.`
    },
    correction: {
      content: correction.content(repo, connector, variant),
      type: correction.type,
      memoryKind: correction.memoryKind,
      correctAction: correction.correctAction(repo)
    },
    nextTask: `${correction.task(repo, variant)} Cite the relevant memory before changing code.`,
    expected: {
      command: repo.testCommand,
      filesChanged: [expectedFile],
      referencedKinds: correction.referencedKinds,
      blockedAction: correction.blockedAction?.(repo),
      staleRuleSuppressed: correction.staleRule?.(repo)
    },
    sessions: sessionsFor({ scenarioIndex: index, sessionCount, correction, connector, sourceBackedCorrection }),
    noiseMemories: noiseMemoriesFor({ repo, connector, noiseCount, staleCount, variant }),
    connectorEvents: connectorEventsFor({ connector, repo, correction, expectedFile, sourceBackedCorrection }),
    sourceRef: connector,
    syntheticRepo: patchModelFor(repo, expectedFile, correction.requiredPatterns),
    horizon: {
      sessionCount,
      correctionSession: Math.max(1, Math.floor(sessionCount * 0.25)),
      taskSession: sessionCount,
      horizonLength: Math.max(1, sessionCount - Math.max(1, Math.floor(sessionCount * 0.25)))
    }
  };
  return scenario;
}

function sessionsFor(input: { scenarioIndex: number; sessionCount: number; correction: CorrectionTemplate; connector: CogniCodeSourceRef; sourceBackedCorrection: boolean }): CogniCodeSessionEvent[] {
  const sessions: CogniCodeSessionEvent[] = [];
  for (let index = 1; index <= input.sessionCount; index += 1) {
    const kind: CogniCodeSessionEvent["kind"] =
      index === 1 ? "task" :
      index === 2 ? "wrong_action" :
      index === Math.max(3, Math.floor(input.sessionCount * 0.25)) ? "correction" :
      index === input.sessionCount ? "task" :
      index % 4 === 0 ? "connector_event" : "noise";
    sessions.push({
      index,
      kind,
      relevant: ["task", "wrong_action", "correction", "connector_event"].includes(kind),
      content: `${kind} session ${index} for ${input.correction.label} scenario ${input.scenarioIndex + 1}.`,
      sourceRef: kind === "connector_event" || input.sourceBackedCorrection && kind === "correction" ? input.connector : undefined
    });
  }
  return sessions;
}

function noiseMemoriesFor(input: { repo: RepoTemplate; connector: CogniCodeSourceRef; noiseCount: number; staleCount: number; variant: string }): CogniCodeNoiseMemory[] {
  const noise: CogniCodeNoiseMemory[] = [];
  for (let index = 0; index < input.noiseCount; index += 1) {
    noise.push({
      relevant: false,
      content: `Adjacent project ${input.variant}-${index} prefers a different command and should not affect ${input.repo.name}.`,
      sourceRef: index % 2 === 0 ? input.connector : undefined
    });
  }
  for (let index = 0; index < input.staleCount; index += 1) {
    noise.push({
      relevant: false,
      beliefState: index % 2 === 0 ? "stale" : "contradicted",
      content: `Outdated ${input.repo.name} note ${index}: use an old command or edit generated files.`
    });
  }
  return noise;
}

function connectorEventsFor(input: {
  connector: CogniCodeSourceRef;
  repo: RepoTemplate;
  correction: CorrectionTemplate;
  expectedFile: string;
  sourceBackedCorrection: boolean;
}): CogniCodeSessionEvent[] {
  return [
    {
      index: 0,
      kind: "connector_event",
      relevant: input.sourceBackedCorrection,
      sourceRef: input.connector,
      content: `${input.connector.connectorId} event says ${input.correction.label} work in ${input.repo.name} must land in ${input.expectedFile}.`
    }
  ];
}

function patchModelFor(repo: RepoTemplate, expectedFile: string, requiredPatterns: string[]): CogniCodePatchModel {
  return {
    files: [
      { path: repo.validationFile, content: `// source file for ${repo.name}\nexport const owner = true;\n` },
      { path: repo.serviceFile, content: `// service file for ${repo.name}\nexport const service = true;\n` },
      { path: repo.testFile, content: `// tests for ${repo.name}\n` },
      { path: repo.generatedFile, content: "// generated - do not edit\n", generated: true }
    ],
    expectedDiff: {
      changedFiles: [expectedFile],
      forbiddenFiles: [repo.generatedFile],
      requiredPatterns,
      testFiles: [repo.testFile]
    }
  };
}

function buildRepoTemplates(): RepoTemplate[] {
  const templates: RepoTemplate[] = [];
  for (const domain of domains) {
    for (const kind of repoKinds) {
      for (const profile of languageProfiles) {
        const framework = profile.frameworks[(templates.length + domain.length + kind.length) % profile.frameworks.length];
        templates.push({
          name: `${domain}-${kind}-${profile.language}`,
          language: profile.language,
          framework,
          packageManager: profile.packageManager,
          testCommand: profile.testCommand,
          validationFile: profile.validationFile,
          serviceFile: profile.serviceFile,
          testFile: profile.testFile,
          generatedFile: profile.generatedFile,
          rules: [
            `Use ${profile.testCommand} for ${framework} changes.`,
            `Generated file ${profile.generatedFile} is read-only.`,
            `Keep ${kind} ownership inside ${profile.validationFile.split("/")[0]}.`
          ],
          hiddenTrap: `${domain}-${kind} has adjacent stale docs that mention a different command.`
        });
      }
    }
  }
  return templates;
}

function sourceRef(connectorId: CogniCodeConnectorId, index: number, type: CogniCodeCorrectionType): CogniCodeSourceRef {
  return {
    connectorId,
    externalId: `${connectorId}-${type}-${index + 1}`,
    uri: `https://example.test/${connectorId}/${type}/${index + 1}`,
    eventType: type
  };
}

function normalizeOptions(options: CogniCodeScenarioFactoryOptions): Required<Omit<CogniCodeScenarioFactoryOptions, "difficulty" | "connectorMix">> & { difficulty: CogniCodeDifficulty | "mixed"; connectorMix: CogniCodeConnectorId[] } {
  const count = Math.max(1, Math.floor(options.scenarios ?? options.count ?? 100));
  return {
    count,
    scenarios: count,
    seed: options.seed ?? "cognicodebench-v2",
    repos: Math.max(1, Math.floor(options.repos ?? Math.min(100, count))),
    sessions: Math.max(3, Math.floor(options.sessions ?? 6)),
    noiseRatio: clamp(options.noiseRatio ?? 0.25, 0, 1),
    staleRatio: clamp(options.staleRatio ?? 0.15, 0, 1),
    connectorMix: options.connectorMix?.length ? options.connectorMix : ["github", "jira", "confluence", "notion", "slack"],
    difficulty: options.difficulty ?? "mixed"
  };
}

function chooseDifficulty(requested: CogniCodeDifficulty | "mixed", index: number): CogniCodeDifficulty {
  if (requested !== "mixed") return requested;
  const difficulties: CogniCodeDifficulty[] = ["easy", "medium", "hard", "evil"];
  return difficulties[index % difficulties.length];
}

function summarizeFactory(
  scenarios: CogniCodeScenario[],
  availableRepoTemplates: number,
  options: Required<Omit<CogniCodeScenarioFactoryOptions, "difficulty" | "connectorMix">> & { difficulty: CogniCodeDifficulty | "mixed"; connectorMix: CogniCodeConnectorId[] }
): CogniCodeScenarioFactorySummary {
  const distribution: Record<CogniCodeDifficulty, number> = { easy: 0, medium: 0, hard: 0, evil: 0 };
  for (const scenario of scenarios) distribution[scenario.difficulty] += 1;
  const horizons = scenarios.map((scenario) => scenario.horizon?.horizonLength ?? 1);
  return {
    version: "2.0",
    seed: options.seed,
    requestedScenarios: scenarios.length,
    requestedRepos: options.repos,
    sessionsPerScenario: options.sessions,
    noiseRatio: options.noiseRatio,
    staleRatio: options.staleRatio,
    connectorMix: options.connectorMix,
    requestedDifficulty: options.difficulty,
    availableRepoTemplates,
    availableCorrectionTypes: correctionTemplates.length,
    generatedMemoryEvents: scenarios.reduce((total, scenario) => total + (scenario.sessions?.length ?? 0) + (scenario.noiseMemories?.length ?? 0) + (scenario.connectorEvents?.length ?? 0), 0),
    connectorEventCount: scenarios.reduce((total, scenario) => total + (scenario.connectorEvents?.length ?? 0), 0),
    difficultyDistribution: distribution,
    horizon: {
      short: horizons.filter((value) => value <= 3).length,
      medium: horizons.filter((value) => value > 3 && value <= 10).length,
      long: horizons.filter((value) => value > 10).length,
      averageLength: round(horizons.reduce((sum, value) => sum + value, 0) / Math.max(1, horizons.length))
    }
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
