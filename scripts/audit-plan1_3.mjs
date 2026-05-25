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
  plan: read("plan1_3.md"),
  package: read("package.json"),
  readme: read("README.md"),
  product: read("PRODUCT.md"),
  status: read("docs/implementation-status.md"),
  claims: exists("docs/claims.md") ? read("docs/claims.md") : "",
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
  pythonSdk: exists("sdk/python/cognibrain_client.py") ? read("sdk/python/cognibrain_client.py") : "",
  harnessHook: read("src/connectors/harnessHook.ts"),
  mcpHandlers: read("src/connectors/mcpHandlers.ts"),
  mcpServer: read("src/connectors/mcpServer.ts"),
  vendorConnectors: exists("src/connectors/vendorConnectors.ts") ? read("src/connectors/vendorConnectors.ts") : "",
  dashboard: read("src/dashboard/main.tsx"),
  leaderboard: read("src/eval/leaderboard.ts"),
  cognicode: read("src/eval/cognicodeBench.ts"),
  codingIntents: exists("src/eval/codingIntentCases.ts") ? read("src/eval/codingIntentCases.ts") : "",
  ci: exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "",
  tests: all(read("tests/core.test.ts"), read("tests/evaluation.test.ts"), exists("sdk/python/tests/test_cognibrain_client.py") ? read("sdk/python/tests/test_cognibrain_client.py") : ""),
  scenarioSchema: exists("docs/schemas/cognicodebench-scenario.schema.json") ? read("docs/schemas/cognicodebench-scenario.schema.json") : "",
  scenarioExamples: exists("fixtures/cognicodebench/scenarios.example.json") ? read("fixtures/cognicodebench/scenarios.example.json") : "",
  marketPages: [
    "docs/market/engineering-memory-os.md",
    "docs/market/cognibrain-vs-mem0.md",
    "docs/market/cognibrain-vs-gbrain.md",
    "docs/market/cognibrain-vs-hindsight.md",
    "docs/market/cognibrain-vs-zep.md"
  ].map((path) => (exists(path) ? read(path) : "")).join("\n")
};

const planHeadings = extractPlanHeadings(files.plan);
const engineeringKinds = ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"];
const ablationModes = ["no_memory", "raw_chat_history", "keyword_only", "semantic_only", "vector_only", "graph_only", "temporal_only", "procedure_only", "cognibrain_full"];
const codingQueryTypes = ["command_selection", "change_location", "reviewer_correction", "dangerous_file", "architecture_decision", "failed_last_time", "repo_change"];

const checks = [
  check("plan1_3 structure is fully represented", [
    planHeadings.epics === 10,
    planHeadings.workpackages === 36,
    has(files.status, "Plan1_3 implementation issues #310-#315"),
    has(files.package, "audit:plan1_3")
  ]),
  check("EPIC 1 repo-state verification and product truth", [
    has(files.status, "| Feature | Code implemented | API exposed | CLI exposed | MCP exposed | Dashboard exposed | Tests | Docs | Production ready? |"),
    has(files.package, "verify:status"),
    has(files.package, "audit:plan1_3"),
    has(files.readme, "docs/implementation-status.md"),
    exists("docs/claims.md"),
    countClaimRows(files.claims) >= 10,
    has(files.claims, "Claim ID"),
    has(files.claims, "Evidence gate"),
    has(files.claims, "Do not claim managed SaaS"),
    has(files.claims, "Explicit Non-Claims"),
    has(files.status, "Strict Plan1_3 re-audit"),
    has(files.status, "self-hosted production readiness"),
    has(files.status, "SaaS remains a future track")
  ]),
  check("EPIC 2 CogniCodeBench specification, generator, simulator, evaluator, and ablations", [
    exists("docs/benchmarks/cognicodebench.md"),
    has(files.scenarioSchema, "CogniCodeBench Scenario"),
    has(files.scenarioSchema, "legacy"),
    (JSON.parse(files.scenarioExamples).scenarios ?? []).length >= 5,
    has(files.cognicode, "generateCogniCodeScenarios"),
    has(files.cognicode, "runCogniCodeBench"),
    ["typescript", "python", "go", "react", "monorepo", "legacy"].every((item) => has(files.cognicode, item)),
    ["easy", "medium", "hard", "evil"].every((item) => has(files.cognicode, item)),
    ["command_correction", "library_correction", "architecture_correction", "style_correction", "test_correction", "forbidden_file_correction", "temporal_migration_correction"].every((item) => has(files.cognicode, item)),
    ablationModes.every((item) => has(files.cognicode, item)),
    artifact("artifacts/cognicodebench/scenarios.json", (report) => (report.scenarios ?? []).length >= 100),
    artifact("artifacts/cognicodebench/run.json", (report) =>
      report.passed === true &&
      report.mode === "benchmark" &&
      report.scenarioCount >= 100 &&
      (report.examples ?? []).length >= 5 &&
      ablationModes.every((mode) => report.ablation?.[mode]) &&
      report.metrics?.correctionCarryoverRate >= 0.9 &&
      report.metrics?.repeatedMistakeRate <= 0.05 &&
      report.metrics?.procedureRecallRate >= 0.9 &&
      report.metrics?.wrongMemorySuppression >= 0.9 &&
      report.ablation?.cognibrain_full?.score > Math.max(...Object.entries(report.ablation ?? {}).filter(([name]) => name !== "cognibrain_full").map(([, value]) => Number(value.score ?? 0)))
    )
  ]),
  check("strict self-hosted production and benchmark boundaries are visible", [
    has(files.production, "not a managed SaaS certification"),
    has(files.production, "vendor connector certification without running the connector against real"),
    has(files.claims, "CogniCodeBench is synthetic simulator proof"),
    has(files.benchDocs, "measured synthetic ablation baselines"),
    has(files.status, "measured real-agent/harness E2E beyond local hook compatibility"),
    has(files.status, "real tenant vendor connector smokes"),
    has(files.status, "deployment-owned OIDC/SSO/autoscaling/billing/SLA proof"),
    has(files.status, "Postgres operation through a deployment pooler")
  ]),
  check("EPIC 3 Engineering Memory model", [
    has(files.types, "EngineeringMemoryKind"),
    has(files.types, "CodebaseScope"),
    has(files.types, "EngineeringMemoryMetadata"),
    engineeringKinds.every((kind) => has(files.types, kind)),
    has(files.engineering, "withEngineeringMemoryMetadata"),
    has(files.engineering, "codebaseScopeMatches"),
    has(files.service, "recordCodeCorrection"),
    has(files.service, "recordHarnessAction"),
    has(files.tests, "stores engineering corrections")
  ]),
  check("EPIC 4 coding-agent retrieval", [
    codingQueryTypes.every((queryType) => has(files.service, queryType)),
    has(files.codingIntents, "CODING_QUERY_INTENT_CASES"),
    codingIntentCount(files.codingIntents) >= 50,
    has(files.tests, "CODING_QUERY_INTENT_CASES"),
    has(files.service, "codingContextPack"),
    has(files.service, "guardAction"),
    has(files.retrieval, "engineeringKind"),
    has(files.retrieval, "codebaseScopeMatches"),
    has(files.mcpServer, "memory_procedure_recall")
  ]),
  check("EPIC 5 evidence-grade context packs", [
    has(files.types, "CodingContextPack"),
    has(files.types, "PatchEvidenceTrail"),
    has(files.types, "ActionGuardReport"),
    has(files.engineering, "buildCodingContextPackFromResults"),
    has(files.engineering, "buildPatchEvidenceTrail"),
    has(files.engineering, "excludedStaleRules"),
    has(files.service, "patchEvidenceTrail"),
    has(files.cognicode, "wrongMemorySuppression")
  ]),
  check("EPIC 6 temporal belief and codebase evolution", [
    has(files.types, "verificationDueAt"),
    has(files.types, "validUntil"),
    has(files.service, "applySupersession"),
    has(files.service, "verificationQueue"),
    has(files.engineering, "HIGH_IMPACT_KINDS"),
    has(files.cognicode, "temporal_migration_correction"),
    has(files.tests, "beliefState).toBe(\"superseded\")")
  ]),
  check("EPIC 7 harness distribution", [
    has(files.connectorDocs, "Claude Code"),
    has(files.connectorDocs, "OpenAI Codex"),
    has(files.connectorDocs, "GitHub"),
    has(files.connectorDocs, "Cursor"),
    has(files.harnessHook, "startSession"),
    has(files.harnessHook, "beforeToolCall"),
    has(files.harnessHook, "afterToolCall"),
    has(files.harnessHook, "captureCorrection"),
    has(files.harnessHook, "finishPatch"),
    has(files.mcpServer, "memory_coding_context_pack"),
    has(files.mcpServer, "memory_action_guard"),
    has(files.vendorConnectors, "https://api.github.com"),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true)
  ]),
  check("EPIC 8 production platform hardening", [
    has(files.production, "MEMORY_STORAGE_BACKEND=postgres-remote"),
    has(files.production, "MEMORY_API_KEYS"),
    has(files.server, "authenticate"),
    has(files.server, "/metrics"),
    has(files.service, "metricsReport"),
    has(files.service, "evaluatePolicy"),
    has(files.service, "policy.denied"),
    has(files.status, "SQLite"),
    has(files.status, "Postgres"),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true && report.acceptance?.idempotentMigrations === true && report.acceptance?.transactionRollback === true)
  ]),
  check("EPIC 9 API, SDK, and docs", [
    has(files.server, "/v1/openapi.json"),
    has(files.service, "openapiCodegen"),
    has(files.apiDocs, "/openapi.json"),
    has(files.sdk, "CognibrainError"),
    has(files.sdk, "codingContextPack"),
    has(files.sdk, "guardAction"),
    has(files.sdk, "patchEvidenceTrail"),
    has(files.pythonSdk, "def openapi"),
    has(files.production, "Production Docs"),
    has(files.production, "Troubleshooting")
  ]),
  check("EPIC 10 benchmark proof and market positioning", [
    has(files.readme, "CogniCodeBench"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.benchmarking, "CogniCodeBench"),
    has(files.leaderboard, "engineering_memory"),
    exists("docs/market/engineering-memory-os.md"),
    exists("docs/market/cognibrain-vs-mem0.md"),
    exists("docs/market/cognibrain-vs-gbrain.md"),
    exists("docs/market/cognibrain-vs-hindsight.md"),
    exists("docs/market/cognibrain-vs-zep.md"),
    has(files.marketDocs, "docs/market/engineering-memory-os.md"),
    has(files.marketPages.toLowerCase(), "claim boundary")
  ]),
  check("release verification wiring", [
    has(files.package, "npm run verify:status"),
    has(files.package, "npm run audit:plan1_3"),
    has(files.ci, "artifacts/plan1_3-audit.json"),
    has(files.ci, "artifacts/status-verification.json"),
    has(files.production, "audit:plan1_3"),
    has(files.status, "npm run audit:plan1_3")
  ])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks, planHeadings);
if (failed.length) {
  console.error(`plan1_3 audit failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`plan1_3 audit passed: ${checks.length}/${checks.length} checks`);

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

function countClaimRows(content) {
  return content.split(/\r?\n/).filter((line) => /^\| CB-CLAIM-/.test(line)).length;
}

function codingIntentCount(content) {
  return (content.match(/expectedQueryType:/g) ?? []).length;
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
  const path = join(root, "artifacts/plan1_3-audit.json");
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    plan: "plan1_3",
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
