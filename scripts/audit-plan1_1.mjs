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
  plan: read("plan1_1.md"),
  package: read("package.json"),
  status: read("docs/implementation-status.md"),
  readme: read("README.md"),
  product: read("PRODUCT.md"),
  apiDocs: read("docs/api-reference.md"),
  benchmarkDocs: read("docs/benchmarking.md"),
  connectorDocs: read("docs/connectors.md"),
  productionDocs: exists("docs/production-readiness.md") ? read("docs/production-readiness.md") : "",
  advancedDocs: read("docs/advanced-features.md"),
  memoryOsDocs: read("docs/agent-memory-os.md"),
  auditDocs: exists("docs/market-analysis-implementation-audit.md") ? read("docs/market-analysis-implementation-audit.md") : "",
  envExample: read(".env.example"),
  dockerfile: read("docker/Dockerfile"),
  compose: read("docker/docker-compose.yml"),
  kubernetes: read("deploy/kubernetes/cognibrain.yaml"),
  service: read("src/api/service.ts"),
  server: read("src/api/server.ts"),
  persistence: read("src/api/persistence.ts"),
  cli: read("src/cli/memctl.ts"),
  types: read("src/core/types.ts"),
  storageAdapter: exists("src/core/storageAdapter.ts") ? read("src/core/storageAdapter.ts") : "",
  store: read("src/core/store.ts"),
  retrieval: read("src/core/retrieval.ts"),
  extraction: read("src/core/extraction.ts"),
  embeddings: exists("src/core/embeddings.ts") ? read("src/core/embeddings.ts") : "",
  openaiEmbeddings: exists("src/core/openaiEmbeddings.ts") ? read("src/core/openaiEmbeddings.ts") : "",
  mcp: all(read("src/connectors/mcpHandlers.ts"), read("src/connectors/mcpServer.ts")),
  connectorSdk: exists("src/connectors/sdk.ts") ? read("src/connectors/sdk.ts") : "",
  tsClient: read("src/sdk/client.ts"),
  pythonClient: exists("sdk/python/cognibrain_client.py") ? read("sdk/python/cognibrain_client.py") : "",
  pythonPyproject: exists("sdk/python/pyproject.toml") ? read("sdk/python/pyproject.toml") : "",
  dashboard: read("src/dashboard/main.tsx"),
  tests: all(read("tests/core.test.ts"), read("tests/api.test.ts"), read("tests/evaluation.test.ts")),
  nextgen: read("src/eval/nextgenBenchmarks.ts"),
  vendorConnectors: exists("src/connectors/vendorConnectors.ts") ? read("src/connectors/vendorConnectors.ts") : "",
  connectorsLive: exists("src/eval/connectorsLive.ts") ? read("src/eval/connectorsLive.ts") : "",
  vendorConnectorsLive: exists("src/eval/vendorConnectorsLive.ts") ? read("src/eval/vendorConnectorsLive.ts") : "",
  load: exists("src/eval/load.ts") ? read("src/eval/load.ts") : "",
  postgresLive: exists("src/eval/postgresLive.ts") ? read("src/eval/postgresLive.ts") : ""
};

const checks = [
  check("WP 1.1 MemoryRecord v2", [
    has(files.types, "MemoryRecordV2"),
    has(files.types, "schemaVersion: \"2.0\""),
    exists("docs/schemas/memory-record-v2.schema.json"),
    has(files.apiDocs, "MemoryRecordV2"),
    has(files.tests, "stores MemoryRecordV2 fields")
  ]),
  check("WP 1.2 EvidencePack first-class object", [
    has(files.types, "EvidencePack"),
    exists("docs/schemas/evidence-pack.schema.json"),
    has(files.service, "evidencePacks = new Map"),
    has(files.server, "context-packs") && has(files.server, "evidence"),
    has(files.cli, "evidence-pack"),
    has(files.mcp, "memory_evidence_pack"),
    has(files.dashboard, "Context Pack Preview")
  ]),
  check("WP 1.3 why-used everywhere", [
    has(files.types, "whyIncluded"),
    has(files.types, "whyNotExcluded"),
    has(files.types, "scoreBreakdown"),
    has(files.types, "policyDecision"),
    has(files.cli, "why-used"),
    has(files.mcp, "memory_context_pack"),
    has(files.dashboard, "Why used:"),
    has(files.nextgen, "why-used-explanation")
  ]),
  check("WP 2.1 StorageAdapter interface", [
    has(files.storageAdapter, "interface MemoryStorageAdapter"),
    has(files.storageAdapter, "create(input"),
    has(files.storageAdapter, "searchIndexUpdate"),
    has(files.storageAdapter, "auditWrite"),
    has(files.storageAdapter, "transaction<T>"),
    has(files.service, "readonly storage: MemoryStorageAdapter")
  ]),
  check("WP 2.2 SQLite backend", [
    has(files.persistence, "SQLitePersistenceAdapter"),
    has(files.persistence, "memory_fts"),
    has(files.persistence, "retention_rules"),
    has(files.persistence, "backup") || has(files.apiDocs, "/backup/verify"),
    has(files.tests, "SQLitePersistenceAdapter")
  ]),
  check("WP 2.3 Postgres backend", [
    has(files.persistence, "PostgresRemotePersistenceAdapter"),
    has(files.persistence, "cognibrain_schema_migrations"),
    has(files.persistence, "search_vector"),
    has(files.postgresLive, "transactionRollback") || has(files.postgresLive, "rollback"),
    has(files.productionDocs, "PgBouncer") || has(files.productionDocs, "pooler"),
    has(files.dockerfile, "postgresql-client"),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true && report.acceptance?.idempotentMigrations === true)
  ]),
  check("WP 2.4 Event-sourced audit journal", [
    has(files.types, "AuditJournalEvent"),
    has(files.service, "previousHash"),
    has(files.service, "replayAuditEvents"),
    has(files.service, "canonicalAuditJournalType"),
    has(files.tests, "AuditChain")
  ]),
  check("WP 3.1 API auth layer", [
    has(files.server, "function authenticate"),
    has(files.server, "MEMORY_API_KEYS"),
    has(files.server, "MEMORY_REQUIRE_AUTH"),
    has(files.tests, "401"),
    has(files.server, "actorId")
  ]),
  check("WP 3.2 Policy engine", [
    has(files.types, "MemoryPolicyRule"),
    has(files.service, "evaluatePolicy"),
    has(files.service, "canRead") || has(files.service, "policyAllows"),
    has(files.service, "policy.violation"),
    has(files.mcp, "memory_policy_check")
  ]),
  check("WP 3.3 Tenant isolation suite", [
    has(files.tests, "fuzzes tenant isolation"),
    has(files.tests, "TENANT_PRIVATE_A"),
    has(files.service, "federatedSearch"),
    has(files.service, "privacyPreservingCrossBrainCompute")
  ]),
  check("WP 4.1 Query planner", [
    has(files.types, "QueryPlan"),
    has(files.service, "buildQueryPlan"),
    has(files.types, "risk") || has(files.types, "confidence"),
    has(files.tests, "plans at least twenty query types"),
    has(files.types, "strategies")
  ]),
  check("WP 4.2 Real lexical search", [
    has(files.persistence, "sqlite-fts5"),
    has(files.persistence, "postgres-tsvector"),
    has(files.retrieval, "lexicalProviderScores"),
    artifact("artifacts/load-benchmark-100k.json", (report) => report.passed === true && report.workload?.memories === 100000)
  ]),
  check("WP 4.3 Vector backend interface", [
    has(files.types, "EmbeddingProvider"),
    has(files.embeddings, "LocalHashEmbeddingProvider"),
    has(files.openaiEmbeddings, "OpenAICompatibleEmbeddingProvider"),
    has(files.embeddings, "MEMORY_PRIVACY_DISABLE_EMBEDDINGS"),
    has(files.persistence, "pgvector")
  ]),
  check("WP 4.4 Retrieval calibration", [
    has(files.types, "unsafeToInject"),
    has(files.retrieval, "calibrateResults"),
    has(files.nextgen, "retrieval-calibration"),
    has(files.dashboard, "confidence")
  ]),
  check("WP 5.1 Belief state machine", [
    has(files.types, "\"archived\""),
    has(files.types, "needs_verification"),
    has(files.store, "beliefStateFor"),
    has(files.service, "confirmMemory"),
    has(files.service, "retractMemory")
  ]),
  check("WP 5.2 Temporal graph paths", [
    has(files.types, "validFrom"),
    has(files.types, "validUntil"),
    has(files.service, "validAt"),
    has(files.tests, "validPast") && has(files.tests, "validFuture")
  ]),
  check("WP 5.3 Belief revision engine", [
    has(files.types, "MemoryClaim"),
    has(files.extraction, "extractClaim"),
    has(files.service, "applySupersession"),
    has(files.tests, "Mira lives in Vienna"),
    has(files.tests, "Berlin")
  ]),
  check("WP 6.1 Structured claim extraction", [
    has(files.types, "MemoryClaim"),
    has(files.extraction, "qualifiers"),
    has(files.extraction, "sensitivity"),
    has(files.tests, "noisy chat") || has(files.tests, "extracted.claims"),
    has(files.tests, "decisions") || has(files.extraction, "decision")
  ]),
  check("WP 6.2 Durable/ephemeral classifier", [
    has(files.extraction, "classifyDurability"),
    has(files.extraction, "session_only"),
    has(files.extraction, "working_memory"),
    has(files.extraction, "ask_user"),
    has(files.tests, "smalltalk")
  ]),
  check("WP 6.3 Ground truth episode store", [
    has(files.types, "EpisodeRecord"),
    has(files.service, "createEpisode"),
    has(files.store, "extractedFromEpisodeId"),
    has(files.service, "applyEpisodeRetention"),
    has(files.tests, "episode.rawConversation"),
    has(files.apiDocs, "Retention policy applies to linked episodes")
  ]),
  check("WP 7.1 MCP graph tools", [
    has(files.mcp, "memory_graph_path"),
    has(files.mcp, "memory_graph_query"),
    has(files.mcp, "memory_graph_activate"),
    has(files.mcp, "memory_explain_connection"),
    has(files.readme, "memory_graph_path"),
    has(files.connectorDocs, "memory_graph_query")
  ]),
  check("WP 7.2 MCP evidence and policy tools", [
    has(files.mcp, "memory_evidence_pack"),
    has(files.mcp, "memory_policy_check"),
    has(files.mcp, "memory_verify_claim"),
    has(files.mcp, "memory_retention_review")
  ]),
  check("WP 7.3 MCP procedure tools", [
    has(files.mcp, "memory_procedure_recall"),
    has(files.mcp, "memory_action_record"),
    has(files.mcp, "memory_action_outcome"),
    has(files.service, "recordHarnessAction")
  ]),
  check("WP 8.1 Procedural memory first-class", [
    has(files.types, "ProceduralMemoryMetadata"),
    has(files.types, "triggerConditions"),
    has(files.service, "withProceduralMetadata"),
    has(files.mcp, "memory_procedure_recall"),
    has(files.tests, "procedural")
  ]),
  check("WP 8.2 Agent action memory", [
    has(files.types, "HarnessActionInput"),
    has(files.service, "recordHarnessAction"),
    has(files.service, "harness-action"),
    has(files.connectorsLive, "githubTestFailureActionMemory"),
    has(files.cli, "action")
  ]),
  check("WP 9.1 Connector SDK", [
    has(files.connectorSdk, "createConnectorManifest"),
    has(files.service, "beginConnectorOAuth"),
    has(files.service, "connectorHealth"),
    has(files.service, "revokeConnectorAuth"),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true && report.checks?.connectorRevoke === true)
  ]),
  check("WP 9.2 GitHub connector", [
    has(files.service, "official-github"),
    has(files.service, "vendor://github"),
    has(files.vendorConnectors, "https://api.github.com"),
    has(files.vendorConnectors, "/repos/${owner}/${repo}/pulls"),
    has(files.vendorConnectors, "/issues/${issueNumber}/comments"),
    has(files.vendorConnectorsLive, "githubUsesRestPulls"),
    has(files.vendorConnectorsLive, "githubWritesIssueComment"),
    has(files.connectorsLive, "pr_decision"),
    has(files.connectorsLive, "test_failure"),
    has(files.connectorsLive, "githubRepoGraphEdges"),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true && report.checks?.githubUsesRestPulls === true && report.checks?.githubWritesIssueComment === true)
  ]),
  check("WP 9.3 Slack/Discord connector", [
    has(files.service, "official-slack"),
    has(files.service, "official-discord"),
    has(files.service, "vendor://slack"),
    has(files.service, "vendor://discord"),
    has(files.vendorConnectors, "https://slack.com/api"),
    has(files.vendorConnectors, "conversations.history"),
    has(files.vendorConnectors, "chat.postMessage"),
    has(files.vendorConnectors, "https://discord.com/api/v10"),
    has(files.vendorConnectors, "/channels/${channel}/messages"),
    has(files.vendorConnectorsLive, "slackUsesConversationsHistory"),
    has(files.vendorConnectorsLive, "discordUsesChannelMessages"),
    has(files.connectorsLive, "slackDecisionReviewQueue"),
    has(files.connectorsLive, "discordDecisionReviewQueue"),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true && report.checks?.slackWritesChatPostMessage === true && report.checks?.discordWritesChannelMessage === true)
  ]),
  check("WP 9.4 Official harness packages", [
    has(read("bin/cognibrain-connect.mjs"), "claude-code"),
    has(read("bin/cognibrain-connect.mjs"), "codex"),
    has(read("bin/cognibrain.mjs"), ".cognibrain-harness-package.json"),
    has(files.connectorsLive, "harnessPackages"),
    has(files.connectorDocs, "Health Check") || has(files.connectorDocs, "health")
  ]),
  check("WP 10.1 OpenAPI from code", [
    has(files.server, "z.object"),
    has(files.server, "/openapi.json"),
    has(files.server, "/v1/"),
    has(files.service, "servers: [{ url: \"/v1\""),
    has(files.service, "apiDescription"),
    has(files.tests, "/v1/openapi.json")
  ]),
  check("WP 10.2 TypeScript SDK v1", [
    has(files.tsClient, "CognibrainClient"),
    has(files.tsClient, "CognibrainError"),
    has(files.tsClient, "paginateMemories"),
    has(files.tsClient, "connectorHealth"),
    has(files.tsClient, "policy")
  ]),
  check("WP 10.3 Python SDK v1", [
    has(files.pythonPyproject, "name = \"cognibrain\""),
    exists("sdk/python/examples/langgraph_agent.py"),
    exists("sdk/python/examples/crewai_memory_tool.py"),
    has(files.pythonClient, "evidence_pack"),
    has(files.pythonClient, "policy"),
    has(read("sdk/python/README.md"), "PyPI-style installable")
  ]),
  check("WP 10.4 Production documentation", [
    exists("docs/configuration.md"),
    exists("docs/connectors.md"),
    exists("docs/benchmarking.md"),
    exists("docs/production-readiness.md"),
    has(files.apiDocs, "production"),
    has(files.apiDocs.toLowerCase(), "local development"),
    exists("docs/implementation-status.md"),
    has(files.productionDocs, "self-hosted production candidate"),
    has(files.productionDocs, "MEMORY_REQUIRE_AUTH=true"),
    has(files.productionDocs, "MEMORY_STORAGE_BACKEND=postgres-remote"),
    has(files.productionDocs, "npm run verify:postgres"),
    has(files.productionDocs, "npm run verify:connectors"),
    has(files.productionDocs, "npm run verify:vendor-connectors"),
    has(files.productionDocs, "benchmark:load"),
    has(files.envExample, "MEMORY_API_KEYS"),
    !has(files.envExample, "Future storage"),
    has(files.compose, "MEMORY_REQUIRE_AUTH"),
    has(files.compose, "postgres:16-alpine"),
    has(files.kubernetes, "MEMORY_POSTGRES_URL"),
    has(files.kubernetes, "MEMORY_REQUIRE_AUTH")
  ]),
  check("WP 11.1 End-to-end answer benchmarks", [
    has(files.package, "benchmark:answer-generation"),
    has(files.benchmarkDocs, "per-question"),
    artifact("artifacts/answer-generation.json", (report) => report.summary?.meanScore >= 0.9),
    has(files.benchmarkDocs, "LoCoMo") && has(files.benchmarkDocs, "LongMemEval") && has(files.benchmarkDocs, "BEAM")
  ]),
  check("WP 11.2 USP benchmark suite", [
    has(files.nextgen, "usp-evidence-pack"),
    has(files.nextgen, "temporal-validity"),
    has(files.nextgen, "why-used-explanation"),
    artifact("artifacts/nextgen-benchmarks.json", (report) => report.passed === true),
    has(files.dashboard, "benchmarks")
  ]),
  check("WP 11.3 Load and reliability benchmarks", [
    artifact("artifacts/load-benchmark-10k-dream.json", (report) => report.passed === true && report.totals?.dreamActions > 0),
    artifact("artifacts/load-benchmark-100k.json", (report) => report.passed === true && report.workload?.memories === 100000),
    artifact("artifacts/load-benchmark-1m.json", (report) => report.passed === true && report.workload?.memories === 1000000),
    artifact("artifacts/postgres-live.json", (report) => report.passed === true)
  ]),
  check("WP 12.1 5-minute Memory OS demo", [
    has(files.readme, "first-five-minutes proof"),
    has(files.readme, "Five-minute Memory OS demo"),
    has(files.readme, "docs/assets/dashboard-desktop.png"),
    exists("docs/assets/dashboard-desktop.png"),
    has(files.memoryOsDocs, "memory why-used"),
    has(files.readme, "Mem0") && has(files.readme, "GBrain"),
    has(files.product, "Evidence-grade Agent Memory OS")
  ]),
  check("WP 12.2 Implementation status matrix", [
    exists("docs/implementation-status.md"),
    has(files.status, "MemoryRecordV2"),
    has(files.status, "Production load benchmarks"),
    has(files.readme, "docs/implementation-status.md"),
    has(files.package, "audit:plan1_1"),
    has(files.status, "#212-#261 are closed"),
    has(files.status, "#262") && has(files.status, "#263"),
    has(files.status, "Open-source launch readiness")
  ]),
  check("OSS launch and overclaim guard", [
    has(files.readme, "Is It Production Ready?"),
    has(files.readme, "self-hosted production candidate"),
    has(files.readme, "Production Readiness"),
    has(files.product, "Benefits"),
    has(files.product, "Mem0/GBrain"),
    exists("LICENSE"),
    exists("CONTRIBUTING.md"),
    exists("SECURITY.md"),
    has(files.service, "openapiCodegen"),
    has(read("bin/cognibrain.mjs"), "sdk/python/cognibrain.egg-info"),
    !has(files.package, "\"sdk/\""),
    !exists("sdk/go/cognibrain/client.go"),
    !exists("sdk/rust/src/lib.rs"),
    !has(files.service, "sdk/go"),
    !has(files.service, "sdk/rust"),
    !has(files.readme, "Go/Rust"),
    !has(files.advancedDocs, "Go, and Rust")
  ])
];

for (const marker of Array.from({ length: 12 }, (_, index) => `EPIC ${index + 1}`)) {
  if (!has(files.plan, marker)) fail(`plan1_1.md missing ${marker}`);
}

const failures = checks.filter((item) => item.failed.length > 0);
if (failures.length) {
  console.error("plan1_1 audit failed");
  for (const item of failures) console.error(`- ${item.name}: ${item.failed.length} failed checks`);
  process.exit(1);
}

console.log(`plan1_1 audit passed: ${checks.length} workpackages verified`);

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
