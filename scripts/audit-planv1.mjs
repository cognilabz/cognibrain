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
  plan: read("planv1.md"),
  package: read("package.json"),
  status: read("docs/implementation-status.md"),
  apiDocs: read("docs/api-reference.md"),
  benchmarkDocs: read("docs/benchmarking.md"),
  connectorDocs: read("docs/connectors.md"),
  service: read("src/api/service.ts"),
  server: read("src/api/server.ts"),
  persistence: read("src/api/persistence.ts"),
  cli: read("src/cli/memctl.ts"),
  types: read("src/core/types.ts"),
  retrieval: read("src/core/retrieval.ts"),
  extraction: read("src/core/extraction.ts"),
  embeddings: exists("src/core/embeddings.ts") ? read("src/core/embeddings.ts") : "",
  openaiEmbeddings: exists("src/core/openaiEmbeddings.ts") ? read("src/core/openaiEmbeddings.ts") : "",
  mcp: all(read("src/connectors/mcpHandlers.ts"), read("src/connectors/mcpServer.ts")),
  sdk: exists("src/connectors/sdk.ts") ? read("src/connectors/sdk.ts") : "",
  tsClient: read("src/sdk/client.ts"),
  dashboard: read("src/dashboard/main.tsx"),
  tests: all(read("tests/core.test.ts"), read("tests/api.test.ts"), read("tests/evaluation.test.ts")),
  nextgen: read("src/eval/nextgenBenchmarks.ts"),
  connectorsLive: exists("src/eval/connectorsLive.ts") ? read("src/eval/connectorsLive.ts") : "",
  load: exists("src/eval/load.ts") ? read("src/eval/load.ts") : "",
  postgresLive: exists("src/eval/postgresLive.ts") ? read("src/eval/postgresLive.ts") : "",
  pythonReadme: exists("sdk/python/README.md") ? read("sdk/python/README.md") : "",
  pythonPyproject: exists("sdk/python/pyproject.toml") ? read("sdk/python/pyproject.toml") : ""
};

const checks = [
  check("WP 1.1 SQLite Store Adapter", [
    exists("src/api/persistence.ts"),
    has(files.persistence, "SQLitePersistenceAdapter"),
    has(files.persistence, "memory_fts"),
    has(files.tests, "SQLite"),
    has(files.service, "storageStatus")
  ]),
  check("WP 1.2 Postgres Store Adapter", [
    has(files.persistence, "PostgresRemotePersistenceAdapter"),
    has(files.persistence, "cognibrain_schema_migrations"),
    has(files.persistence, "search_vector"),
    has(files.postgresLive, "Postgres live verification"),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true && report.acceptance?.idempotentMigrations === true)
  ]),
  check("WP 1.3 Event-Sourced Audit Journal", [
    has(files.types, "AuditJournalEvent"),
    has(files.service, "recordAudit"),
    has(files.service, "auditChain"),
    has(files.tests, "previousHash")
  ]),
  check("WP 2.1 API Authentication Layer", [
    has(files.server, "function authenticate"),
    has(files.server, "MEMORY_API_KEYS"),
    has(files.tests, "protects non-health routes when API keys are configured"),
    has(files.server, "actorId")
  ]),
  check("WP 2.2 Authorization & Policy Engine", [
    has(files.types, "MemoryPolicyRule"),
    has(files.service, "evaluatePolicy"),
    has(files.service, "policy.violation"),
    has(files.tests, "private, org, project")
  ]),
  check("WP 2.3 Tenant Isolation Tests", [
    has(files.tests, "fuzzes tenant isolation"),
    has(files.tests, "TENANT_CONNECTOR_A"),
    has(files.service, "federatedSearch"),
    has(files.service, "graphExport")
  ]),
  check("WP 3.1 ContextPack Object Model", [
    has(files.types, "EvidencePack"),
    has(files.service, "contextPack"),
    has(files.service, "evidencePacks"),
    has(files.tests, "exports persisted context packs through evidence endpoints")
  ]),
  check("WP 3.2 Evidence Pack Export", [
    has(files.server, "context-packs") && has(files.server, "evidence"),
    has(files.cli, "evidence"),
    has(files.status, "Evidence pack export"),
    has(files.nextgen, "usp-evidence-pack")
  ]),
  check("WP 3.3 Why Was This Used UI", [
    has(files.dashboard, "Why used:"),
    has(files.dashboard, "Evidence:"),
    has(files.dashboard, "Context Pack Preview"),
    exists("docs/assets/dashboard-recall.png")
  ]),
  check("WP 4.1 Query Planner", [
    has(files.types, "QueryPlan"),
    has(files.service, "buildQueryPlan"),
    has(files.tests, "plans at least twenty query types"),
    has(files.service, "direct_fact")
  ]),
  check("WP 4.2 Real BM25 / Full-Text Backend", [
    has(files.persistence, "sqlite-fts5"),
    has(files.persistence, "postgres-tsvector"),
    has(files.retrieval, "lexicalProviderScores"),
    artifact("artifacts/load-benchmark-100k.json", (report) => report.passed === true && report.workload?.memories === 100000)
  ]),
  check("WP 4.3 Vector Backend Interface", [
    has(files.types, "EmbeddingProvider"),
    has(files.embeddings, "LocalHashEmbeddingProvider"),
    has(files.openaiEmbeddings, "OpenAICompatibleEmbeddingProvider"),
    has(files.embeddings, "MEMORY_PRIVACY_DISABLE_EMBEDDINGS"),
    has(files.persistence, "pgvector")
  ]),
  check("WP 4.4 Retrieval Calibration", [
    has(files.types, "unsafeToInject"),
    has(files.retrieval, "calibrateResults"),
    has(files.nextgen, "retrieval-calibration"),
    has(files.tests, "low-confidence")
  ]),
  check("WP 5.1 Belief State Machine", [
    has(files.types, "needs_verification"),
    has(files.service, "confirmMemory"),
    has(files.service, "retractMemory"),
    has(files.tests, "superseded")
  ]),
  check("WP 5.2 Validity-Aware Graph Paths", [
    has(files.types, "validFrom"),
    has(files.types, "validUntil"),
    has(files.service, "validAt"),
    has(files.tests, "validPast") && has(files.tests, "validFuture")
  ]),
  check("WP 5.3 Belief Revision Engine", [
    has(files.extraction, "extractClaim"),
    has(files.service, "applySupersession"),
    has(files.tests, "Mira lives in Vienna"),
    has(files.tests, "Berlin")
  ]),
  check("WP 6.1 Claim Extraction Schema", [
    has(files.types, "MemoryClaim"),
    has(files.extraction, "qualifiers"),
    has(files.extraction, "sensitivity"),
    has(files.tests, "extracted.claims")
  ]),
  check("WP 6.2 Durable vs Ephemeral Classifier", [
    has(files.extraction, "classifyDurability"),
    has(files.extraction, "session_only"),
    has(files.extraction, "ask_user"),
    has(files.tests, "smalltalk")
  ]),
  check("WP 6.3 Source Connector Provenance", [
    has(files.types, "SourceRef"),
    has(files.service, "sourceRef"),
    has(files.service, "deleteSource"),
    has(files.tests, "source_deleted_revalidation") || has(files.tests, "deleteSource")
  ]),
  check("WP 7.1 Connector SDK", [
    has(files.sdk, "createConnectorManifest"),
    has(files.service, "beginConnectorOAuth"),
    has(files.service, "revokeConnectorAuth"),
    has(files.service, "connectorHealth"),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true && report.checks?.connectorRevoke === true)
  ]),
  check("WP 7.2 GitHub Connector", [
    has(files.service, "official-github"),
    has(files.connectorsLive, "pr_decision"),
    has(files.connectorsLive, "test_failure"),
    has(files.connectorsLive, "githubRepoGraphEdges")
  ]),
  check("WP 7.3 Slack/Discord Connector", [
    has(files.service, "official-slack"),
    has(files.service, "official-discord"),
    has(files.connectorsLive, "slackDecisionReviewQueue"),
    has(files.connectorsLive, "discordDecisionReviewQueue")
  ]),
  check("WP 7.4 Official Harness Packages", [
    has(read("bin/cognibrain-connect.mjs"), "claude-code"),
    has(read("bin/cognibrain.mjs"), ".cognibrain-harness-package.json"),
    has(files.connectorsLive, "harnessPackages"),
    exists("docs/assets/dashboard-benchmarks.png")
  ]),
  check("WP 8.1 MCP Graph Tools", [
    has(files.mcp, "memory_graph_path"),
    has(files.mcp, "memory_graph_query"),
    has(files.mcp, "memory_graph_activation"),
    has(files.mcp, "memory_explain_connection")
  ]),
  check("WP 8.2 MCP Evidence & Policy Tools", [
    has(files.mcp, "memory_context_pack"),
    has(files.mcp, "memory_evidence_pack"),
    has(files.mcp, "memory_policy_check"),
    has(files.mcp, "memory_verify_claim")
  ]),
  check("WP 8.3 MCP Procedure Tools", [
    has(files.mcp, "memory_procedure_recall"),
    has(files.mcp, "memory_action_record"),
    has(files.mcp, "memory_action_outcome"),
    has(files.service, "recordHarnessAction")
  ]),
  check("WP 9.1 OpenAPI From Code", [
    has(files.server, "/sdk/openapi"),
    has(files.service, "apiDescription"),
    has(files.tests, "structured OpenAPI contract"),
    has(files.apiDocs, "/sdk/openapi")
  ]),
  check("WP 9.2 TypeScript SDK v1", [
    has(files.tsClient, "CognibrainClient"),
    has(files.tsClient, "connectorHealth"),
    has(files.tsClient, "policy"),
    has(files.tests, "CognibrainClient")
  ]),
  check("WP 9.3 Python SDK v1", [
    has(files.pythonPyproject, "name = \"cognibrain\""),
    exists("sdk/python/tests/test_cognibrain_client.py"),
    exists("sdk/python/examples/langgraph_agent.py"),
    exists("sdk/python/examples/crewai_memory_tool.py")
  ]),
  check("WP 10.1 Full Answer Generation Benchmarks", [
    has(files.package, "benchmark:answer-generation"),
    has(files.benchmarkDocs, "per-question"),
    artifact("artifacts/answer-generation.json", (report) => report.summary?.meanScore >= 0.9)
  ]),
  check("WP 10.2 USP Benchmark Suite", [
    has(files.nextgen, "usp-evidence-pack"),
    has(files.tests, "sourceRef") && has(files.connectorsLive, "githubPrDecisionMemory"),
    artifact("artifacts/nextgen-benchmarks.json", (report) => report.passed === true)
  ]),
  check("WP 10.3 Production Load Benchmarks", [
    artifact("artifacts/load-benchmark-10k-dream.json", (report) => report.passed === true && report.totals?.dreamActions > 0),
    artifact("artifacts/load-benchmark-100k.json", (report) => report.passed === true && report.workload?.memories === 100000),
    artifact("artifacts/load-benchmark-1m.json", (report) => report.passed === true && report.workload?.memories === 1000000),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true)
  ]),
  check("WP 11.1 Implementation Status Matrix", [
    exists("docs/implementation-status.md"),
    !has(files.status, "status-partial"),
    !has(files.status, "| Partial |"),
    has(files.status, "Latest Load proof")
  ]),
  check("WP 11.2 Production Readiness Docs", [
    exists("docs/configuration.md"),
    exists("docs/connectors.md"),
    exists("docs/benchmarking.md"),
    has(files.connectorDocs, "npm run verify:connectors")
  ]),
  check("WP 11.3 Memory OS Product Docs", [
    has(read("README.md"), "Agent Memory OS"),
    has(read("README.md"), "first-five-minutes proof"),
    exists("docs/agent-memory-os.md"),
    exists("docs/assets/dashboard-desktop.png")
  ])
];

for (const marker of ["EPIC 1", "EPIC 2", "EPIC 3", "EPIC 4", "EPIC 5", "EPIC 6", "EPIC 7", "EPIC 8", "EPIC 9", "EPIC 10", "EPIC 11"]) {
  if (!has(files.plan, marker)) fail(`planv1.md missing ${marker}`);
}

const failures = checks.filter((item) => item.failed.length > 0);
if (failures.length) {
  console.error("planv1 audit failed");
  for (const item of failures) console.error(`- ${item.name}: ${item.failed.length} failed checks`);
  process.exit(1);
}

console.log(`planv1 audit passed: ${checks.length} workpackages verified`);

function check(name, tests) {
  return { name, failed: tests.filter((passed) => !passed) };
}

function artifact(path, predicate) {
  if (!exists(path)) return false;
  try {
    return Boolean(predicate(json(path)));
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
