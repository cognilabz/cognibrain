#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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
  mcpHandlers: read("src/connectors/mcpHandlers.ts"),
  mcpServer: read("src/connectors/mcpServer.ts"),
  dashboard: read("src/dashboard/main.tsx"),
  leaderboard: read("src/eval/leaderboard.ts"),
  cognicode: read("src/eval/cognicodeBench.ts"),
  tests: all(read("tests/core.test.ts"), read("tests/evaluation.test.ts")),
  scenarioSchema: exists("docs/schemas/cognicodebench-scenario.schema.json") ? read("docs/schemas/cognicodebench-scenario.schema.json") : "",
  scenarioExamples: exists("fixtures/cognicodebench/scenarios.example.json") ? read("fixtures/cognicodebench/scenarios.example.json") : ""
};

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
    (JSON.parse(files.scenarioExamples).scenarios ?? []).length === 3,
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

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
if (failed.length) {
  console.error(`plan1_2 audit failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`plan1_2 audit passed: ${checks.length}/${checks.length} checks`);

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
