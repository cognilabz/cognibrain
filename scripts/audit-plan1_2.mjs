#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const json = (path) => JSON.parse(read(path));
const has = (content, needle) => content.includes(needle);
const all = (...parts) => parts.join("\n");

const files = {
  plan: read("plan1_2.md"),
  package: read("package.json"),
  readme: read("README.md"),
  product: read("PRODUCT.md"),
  status: read("docs/implementation-status.md"),
  benchmarking: read("docs/benchmarking.md"),
  benchDocs: exists("docs/benchmarks/cognicodebench.md") ? read("docs/benchmarks/cognicodebench.md") : "",
  production: read("docs/production-readiness.md"),
  apiDocs: read("docs/api-reference.md"),
  connectorDocs: read("docs/connectors.md"),
  marketDocs: read("docs/market-comparison.md"),
  types: read("src/core/types.ts"),
  engineering: read("src/core/engineeringMemory.ts"),
  retrieval: read("src/core/retrieval.ts"),
  service: read("src/api/service.ts"),
  server: read("src/api/server.ts"),
  sdk: read("src/sdk/client.ts"),
  harnessHook: read("src/connectors/harnessHook.ts"),
  mcpHandlers: read("src/connectors/mcpHandlers.ts"),
  mcpServer: read("src/connectors/mcpServer.ts"),
  vendorConnectors: exists("src/connectors/vendorConnectors.ts") ? read("src/connectors/vendorConnectors.ts") : "",
  dashboard: read("src/dashboard/main.tsx"),
  leaderboard: read("src/eval/leaderboard.ts"),
  cognicode: read("src/eval/cognicodeBench.ts"),
  ci: exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "",
  tests: all(read("tests/core.test.ts"), read("tests/evaluation.test.ts")),
  scenarioSchema: exists("docs/schemas/cognicodebench-scenario.schema.json") ? read("docs/schemas/cognicodebench-scenario.schema.json") : "",
  scenarioExamples: exists("fixtures/cognicodebench/scenarios.example.json") ? read("fixtures/cognicodebench/scenarios.example.json") : ""
};

const planHeadings = extractPlanHeadings(files.plan);

const checks = [
  check("EPIC 0 repo-state verification and audit gate", [
    has(files.plan, "EPIC 0"),
    has(files.package, "audit:plan1_2"),
    has(files.status, "Plan1_2 implementation issues #266-#307"),
    has(files.service, "apiDescription"),
    has(files.readme, "CogniCodeBench")
  ]),
  check("EPIC 1 CogniCodeBench", [
    has(files.package, "benchmark:cognicode"),
    has(files.package, "benchmark:cognicode:generate"),
    has(files.cognicode, "generateCogniCodeScenarios"),
    has(files.cognicode, "runCogniCodeBench"),
    has(files.cognicode, "no_memory"),
    has(files.cognicode, "cognibrain_without_temporal"),
    has(files.cognicode, "cognibrain_without_corrections"),
    exists("docs/benchmarks/cognicodebench.md"),
    has(files.scenarioSchema, "CogniCodeBench Scenario"),
    (JSON.parse(files.scenarioExamples).scenarios ?? []).length >= 3,
    artifact("artifacts/cognicodebench/scenarios.json", (report) => (report.scenarios ?? []).length >= 100),
    artifact("artifacts/cognicodebench/generate-report.json", (report) =>
      report.passed === true &&
      report.mode === "scenario_generation" &&
      report.scenarioCount >= 100 &&
      report.generation?.scenariosWritten === true
    ),
    artifact("artifacts/cognicodebench/run.json", (report) =>
      report.passed === true &&
      report.mode === "benchmark" &&
      report.scenarioCount >= 100 &&
      (report.scenarios ?? []).length >= 100 &&
      report.metrics?.correctionCarryoverRate >= 0.9 &&
      report.metrics?.repeatedMistakeRate <= 0.05 &&
      report.metrics?.procedureRecallRate >= 0.9 &&
      report.metrics?.wrongMemorySuppression >= 0.9 &&
      report.ablation?.cognibrain_full?.score > Math.max(...Object.entries(report.ablation ?? {}).filter(([name]) => name !== "cognibrain_full").map(([, value]) => Number(value.score ?? 0)))
    )
  ]),
  check("EPIC 2 Engineering Memory object model", [
    has(files.types, "EngineeringMemoryKind"),
    has(files.types, "CodebaseScope"),
    has(files.types, "EngineeringMemoryMetadata"),
    ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"].every((kind) => has(files.types, kind)),
    has(files.engineering, "withEngineeringMemoryMetadata"),
    has(files.service, "recordCodeCorrection"),
    has(files.service, "recordHarnessAction"),
    has(files.tests, "stores engineering corrections")
  ]),
  check("EPIC 3 coding-agent retrieval", [
    ["command_selection", "change_location", "reviewer_correction", "dangerous_file", "architecture_decision", "failed_last_time", "repo_change"].every((queryType) => has(files.service, queryType)),
    has(files.types, "repo_policy"),
    has(files.types, "tool_outcome"),
    has(files.service, "codingContextPack"),
    has(files.service, "guardAction"),
    has(files.retrieval, "engineeringKind"),
    has(files.retrieval, "codebaseScopeMatches")
  ]),
  check("EPIC 4 temporal and belief revision for codebases", [
    has(files.types, "verificationDueAt"),
    has(files.service, "applySupersession"),
    has(files.engineering, "HIGH_IMPACT_KINDS"),
    has(files.cognicode, "temporal_migration_correction"),
    has(files.tests, "beliefState).toBe(\"superseded\")")
  ]),
  check("EPIC 5 evidence-grade coding context", [
    has(files.types, "CodingContextPack"),
    has(files.types, "PatchEvidenceTrail"),
    has(files.types, "ActionGuardReport"),
    has(files.engineering, "buildCodingContextPackFromResults"),
    has(files.engineering, "buildPatchEvidenceTrail"),
    has(files.engineering, "excludedStaleRules"),
    has(files.service, "patchEvidenceTrail")
  ]),
  check("EPIC 6 harness integrations", [
    has(files.mcpServer, "memory_coding_context_pack"),
    has(files.mcpServer, "memory_code_correction"),
    has(files.mcpServer, "memory_action_guard"),
    has(files.mcpServer, "memory_patch_evidence"),
    has(files.mcpHandlers, "codingContextPack"),
    has(files.connectorDocs, "memory_action_guard"),
    has(files.connectorDocs, "Claude Code"),
    has(files.connectorDocs, "OpenAI Codex"),
    has(files.connectorDocs, "Cursor")
  ]),
  check("EPIC 7 production hardening remains covered", [
    has(files.production, "MEMORY_API_KEYS"),
    has(files.production, "npm run verify:postgres"),
    has(files.production, "npm run benchmark:cognicode"),
    has(files.apiDocs, "/coding-context-pack"),
    has(files.server, "/code/action-guard"),
    has(files.server, "/patch-evidence"),
    has(files.sdk, "codingContextPack"),
    has(files.sdk, "guardAction"),
    has(files.sdk, "patchEvidenceTrail")
  ]),
  check("EPIC 8 documentation and product proof", [
    has(files.readme, "Engineering Memory OS for coding agents"),
    has(files.readme, "Stop"),
    has(files.product, "Stop fixing the same agent mistake twice"),
    has(files.benchmarking, "CogniCodeBench"),
    has(files.marketDocs, "Engineering Memory OS"),
    has(files.dashboard, "CogniCodeBench"),
    has(files.leaderboard, "engineering_memory")
  ])
];

const workpackageChecks = [
  check("WP 0.1 Code-vs-Docs Feature Matrix", [
    planHeadings.workpackages === 33,
    has(files.status, "| Feature | Code implemented | API exposed | CLI exposed | MCP exposed | Dashboard exposed | Tests | Docs | Production ready? |"),
    has(files.readme, "docs/implementation-status.md"),
    has(files.package, "audit:plan1_2")
  ]),
  check("WP 0.2 Current Implementation Audit Script", [
    has(files.package, "audit:plan1_2"),
    has(files.ci, "npm run verify:nextgen"),
    has(files.package, "npm run verify:connectors"),
    has(files.ci, "actions/upload-artifact"),
    has(files.ci, "artifacts/plan1_2-audit.json"),
    has(files.status, "Plan1_2 implementation issues")
  ]),
  check("WP 1.1 Benchmark Specification", [
    exists("docs/benchmarks/cognicodebench.md"),
    has(files.scenarioSchema, "CogniCodeBench Scenario"),
    (JSON.parse(files.scenarioExamples).scenarios ?? []).length >= 3,
    has(files.benchDocs, "Scenario Format")
  ]),
  check("WP 1.2 Synthetic Repo Generator", [
    has(files.package, "benchmark:cognicode:generate"),
    has(files.cognicode, "generateCogniCodeScenarios"),
    ["typescript", "python", "go", "react", "monorepo"].every((item) => has(files.cognicode, item)),
    ["easy", "medium", "hard", "evil"].every((item) => has(files.cognicode, item)),
    artifact("artifacts/cognicodebench/scenarios.json", (report) => (report.scenarios ?? []).length >= 100)
  ]),
  check("WP 1.3 Correction & Review Simulator", [
    ["command_correction", "library_correction", "architecture_correction", "style_correction", "test_correction", "forbidden_file_correction", "temporal_migration_correction"].every((item) => has(files.cognicode, item)),
    has(files.cognicode, "recordCodeCorrection"),
    has(files.cognicode, "recordHarnessAction"),
    has(files.cognicode, "wrongAction")
  ]),
  check("WP 1.4 Next-Change Evaluator", [
    has(files.cognicode, "patchCorrect"),
    has(files.cognicode, "commandsRun"),
    has(files.cognicode, "wrongActionSuppressed"),
    has(files.cognicode, "evidenceComplete"),
    artifact("artifacts/cognicodebench/run.json", (report) => (report.scenarios ?? []).every((item) => item.passed === true))
  ]),
  check("WP 1.5 Memory Ablation Tests", [
    ["no_memory", "raw_chat_history", "vector_only", "keyword_only", "graph_only", "cognibrain_without_temporal", "cognibrain_without_corrections"].every((item) => has(files.cognicode, item)),
    has(files.dashboard, "CogniCodeBenchAblation"),
    artifact("artifacts/cognicodebench/run.json", (report) => report.ablation?.cognibrain_full?.score > Math.max(...Object.entries(report.ablation ?? {}).filter(([name]) => name !== "cognibrain_full").map(([, value]) => Number(value.score ?? 0))))
  ]),
  check("WP 1.6 Public Leaderboard", [
    has(files.leaderboard, "engineering_memory"),
    has(files.leaderboard, "artifacts/cognicodebench/run.json"),
    exists("docs/benchmarks/cognicodebench.md"),
    artifact("artifacts/leaderboard.json", (report) => (report.entries ?? []).some((entry) => entry.suite === "cognicodebench"))
  ]),
  check("WP 2.1 EngineeringMemory Types", [
    has(files.types, "EngineeringMemoryKind"),
    ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"].every((kind) => has(files.types, kind)),
    has(files.engineering, "classifyEngineeringMemory"),
    has(files.dashboard, "engineeringKindLabel")
  ]),
  check("WP 2.2 Codebase Scope Model", [
    has(files.types, "CodebaseScope"),
    ["repo", "branch", "commitRange", "packageName", "workspace", "directory", "filePattern", "language", "framework", "harness"].every((key) => has(files.types, key)),
    has(files.engineering, "codebaseScopeMatches"),
    has(files.engineering, "branch mismatch")
  ]),
  check("WP 2.3 Correction Memory Pipeline", [
    has(files.service, "recordCodeCorrection"),
    has(files.service, "applySupersession"),
    has(files.service, "previousWrongAction"),
    has(files.tests, "beliefState).toBe(\"superseded\")"),
    has(files.tests, "pnpm test")
  ]),
  check("WP 2.4 Action Outcome Memory", [
    has(files.types, "HarnessActionInput"),
    ["cwd", "envRequirements", "exitCode", "failureReason", "filesChanged"].every((key) => has(files.types, key)),
    has(files.service, "recordHarnessAction"),
    has(files.service, "tool_outcome"),
    has(files.cognicode, "failureReason")
  ]),
  check("WP 3.1 Code Query Planner", [
    ["command_selection", "change_location", "reviewer_correction", "dangerous_file", "architecture_decision", "failed_last_time", "repo_change"].every((queryType) => has(files.service, queryType)),
    has(files.types, "repo_policy"),
    has(files.types, "tool_outcome"),
    has(files.service, "queryPlan")
  ]),
  check("WP 3.2 Procedure Recall Before Action", [
    has(files.mcpServer, "memory_procedure_recall"),
    has(files.service, "codingContextPack"),
    has(files.service, "recordHarnessAction"),
    has(files.connectorDocs, "memory_procedure_recall")
  ]),
  check("WP 3.3 Forbidden Action Guard", [
    has(files.service, "guardAction"),
    has(files.engineering, "evaluateForbiddenAction"),
    has(files.server, "/code/action-guard"),
    has(files.mcpServer, "memory_action_guard"),
    has(files.cognicode, "repeatedMistakeRate")
  ]),
  check("WP 3.4 Architecture Decision Retrieval", [
    has(files.types, "architecture_decision"),
    has(files.service, "architecture_decision"),
    has(files.cognicode, "app/validation/invoices.py"),
    has(files.cognicode, "architecture_correction")
  ]),
  check("WP 4.1 Repo-State Timeline", [
    has(files.cognicode, "temporal_migration_correction"),
    has(files.cognicode, "yarn jest packages/api"),
    has(files.types, "validUntil"),
    has(files.service, "repo_change"),
    has(files.engineering, "branch mismatch")
  ]),
  check("WP 4.2 Supersession Engine for Corrections", [
    has(files.service, "applySupersession"),
    has(files.types, "superseded"),
    has(files.service, "supersededBy"),
    has(files.apiDocs, "Evidence")
  ]),
  check("WP 4.3 Revalidation of High-Impact Memories", [
    has(files.types, "verificationDueAt"),
    has(files.engineering, "HIGH_IMPACT_KINDS"),
    has(files.service, "verificationQueue"),
    has(files.service, "confirmMemory"),
    has(files.cognicode, "staleRuleSuppressed")
  ]),
  check("WP 5.1 Coding Context Pack Template", [
    has(files.types, "CodingContextPack"),
    has(files.engineering, "buildCodingContextPackFromResults"),
    ["repo_policies", "procedures_before_action", "previous_corrections", "known_pitfalls", "architecture_decisions", "tool_commands", "forbidden_actions", "temporal_notes"].every((section) => has(files.engineering, section)),
    has(files.engineering, "tokenBudget")
  ]),
  check("WP 5.2 Evidence Trail for Patch", [
    has(files.types, "PatchEvidenceTrail"),
    has(files.engineering, "buildPatchEvidenceTrail"),
    ["memoryIds", "correctionIds", "procedureIds", "toolOutcomeIds", "excludedStaleRules"].every((key) => has(files.types, key)),
    has(files.service, "patchEvidenceTrail")
  ]),
  check("WP 5.3 Wrong-Memory Suppression", [
    has(files.engineering, "excludedStaleRules"),
    has(files.engineering, "beliefState === \"superseded\""),
    has(files.cognicode, "wrongMemorySuppression"),
    has(files.cognicode, "staleSuppressed")
  ]),
  check("WP 6.1 Claude Code Connector", [
    has(files.readme, "Claude Code"),
    has(files.connectorDocs, "Claude Code"),
    has(files.readme, "setup --all-harnesses"),
    has(files.harnessHook, "startSession"),
    has(files.harnessHook, "beforeToolCall"),
    has(files.harnessHook, "afterToolCall"),
    has(files.harnessHook, "captureCorrection"),
    has(files.harnessHook, "finishPatch"),
    has(files.dashboard, "Harness Runs"),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true && report.checks?.claudeGoldenPathRun === true && report.harnessRuns?.some((run) => run.harness === "claude" && run.passed === true && run.checks?.patchEvidenceTrail === true))
  ]),
  check("WP 6.2 Codex Connector", [
    has(files.readme, "Codex"),
    has(files.connectorDocs, "OpenAI Codex"),
    has(files.mcpServer, "memory_coding_context_pack"),
    has(files.harnessHook, "codingContextPack"),
    has(files.harnessHook, "recordHarnessAction"),
    exists("templates/codex/AGENTS.md")
  ]),
  check("WP 6.3 Cursor / VS Code Connector", [
    has(files.readme, "Cursor"),
    has(files.connectorDocs, "Cursor"),
    has(files.connectorDocs, "VS Code"),
    has(files.service, "recordConnectorTelemetry"),
    has(files.dashboard, "Harness Runs"),
    exists("templates/cursor/open-memory.mdc")
  ]),
  check("WP 6.4 GitHub Connector", [
    has(files.service, "official-github"),
    has(files.types, "review_correction"),
    has(files.vendorConnectors, "https://api.github.com"),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true && report.checks?.githubWritesIssueComment === true)
  ]),
  check("WP 7.1 Real Storage Backends", [
    has(files.status, "SQLite"),
    has(files.status, "Postgres"),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true && report.acceptance?.idempotentMigrations === true && report.acceptance?.transactionRollback === true),
    has(files.production, "backup")
  ]),
  check("WP 7.2 Auth & Policy Enforcement", [
    has(files.production, "MEMORY_API_KEYS"),
    has(files.server, "authenticate"),
    has(files.service, "evaluatePolicy"),
    has(files.service, "policy.denied"),
    has(files.tests, "tenant isolation")
  ]),
  check("WP 7.3 Observability", [
    has(files.server, "/metrics"),
    has(files.service, "metricsReport"),
    has(files.dashboard, "Runtime Analytics"),
    has(files.status, "Connector proof")
  ]),
  check("WP 7.4 OpenAPI & SDKs", [
    has(files.service, "openapiCodegen"),
    has(files.server, "/v1/openapi.json") && has(files.service, "/v1/openapi.json"),
    has(files.sdk, "codingContextPack"),
    has(files.status, "Python SDK")
  ]),
  check("WP 8.1 Production Docs", [
    has(files.production, "Self-Hosted Compose"),
    has(files.production, "Required Production Environment"),
    has(files.production, "Troubleshooting"),
    has(files.readme, "self-hosted production candidate")
  ]),
  check("WP 8.2 Benchmark Docs", [
    has(files.benchmarking, "CogniCodeBench"),
    has(files.benchmarking, "Baselines"),
    has(files.benchDocs, "Interpreting Results"),
    has(files.benchDocs, "Run")
  ]),
  check("WP 8.3 Market Positioning Docs", [
    has(files.marketDocs, "Mem0"),
    has(files.marketDocs, "GBrain"),
    has(files.marketDocs, "Hindsight"),
    has(files.marketDocs, "Zep"),
    has(files.marketDocs, "Engineering Memory OS")
  ])
];

const allChecks = [...checks, ...workpackageChecks];
const failed = allChecks.filter((item) => !item.passed);
for (const item of allChecks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(allChecks, planHeadings);
if (failed.length) {
  console.error(`plan1_2 audit failed: ${failed.length}/${allChecks.length} checks failed`);
  process.exit(1);
}
console.log(`plan1_2 audit passed: ${allChecks.length}/${allChecks.length} checks`);

function check(name, assertions) {
  const failed = assertions.map((value, index) => ({ value, index })).filter((item) => !item.value).map((item) => `assertion ${item.index + 1}`);
  return { name, passed: failed.length === 0, failed };
}

function artifact(path, predicate) {
  if (!exists(path)) return false;
  try {
    return predicate(json(path));
  } catch {
    return false;
  }
}

function extractPlanHeadings(content) {
  const lines = content.split(/\r?\n/);
  const headings = lines
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((item) => /^(EPIC|WP)\s+\d/.test(item.text));
  return {
    total: headings.length,
    epics: headings.filter((item) => item.text.startsWith("EPIC")).length,
    workpackages: headings.filter((item) => item.text.startsWith("WP")).length,
    headings
  };
}

function writeReport(items, headings) {
  const path = join(root, "artifacts/plan1_2-audit.json");
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    plan: "plan1_2",
    planHeadings: {
      epics: headings.epics,
      workpackages: headings.workpackages,
      total: headings.total
    },
    summary: {
      total: items.length,
      passed: items.filter((item) => item.passed).length,
      failed: items.filter((item) => !item.passed).length
    },
    checks: items
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
