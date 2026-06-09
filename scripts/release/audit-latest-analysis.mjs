#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const artifactPath = join(root, "artifacts", "latest-analysis-audit.json");

const files = {
  packageJson: readJson("package.json", {}),
  readme: read("README.md"),
  internalRunner: read("scripts/internal/run-task.mjs"),
  releaseCheck: read("scripts/release/release-check.mjs"),
  buildSdk: read("scripts/runtime/build-sdk.mjs"),
  fullPlanProof: read("scripts/release/full-plan-proof.mjs"),
  jsDaemonClient: read("bin/lib/daemonClient.mjs"),
  certifyProduction: read("scripts/release/certify-production.mjs"),
  packSmoke: read("scripts/release/pack-smoke.mjs"),
  cliRuntime: read("bin/lib/cliRuntime.mjs"),
  lifecycleCli: read("bin/lib/lifecycleCli.mjs"),
  runtimeDaemonClient: read("src/runtime/daemonClient.ts"),
  mcpRuntimeClient: read("src/connectors/mcpRuntimeClient.ts"),
  sdkClient: read("sdk/typescript/client.ts"),
  memoryService: read("src/api/service/memoryService.ts"),
  memoryServiceStore: read("src/api/service/memoryServiceStore.ts"),
  dreamRuntime: read("src/api/service/dreamRuntime.ts"),
  dreamEngineeringRuntime: read("src/api/service/memoryServiceDreamEngineering.ts"),
  dreamInsightsMaintenance: read("src/api/service/memoryServiceInsightsMaintenance.ts"),
  dreamRoutes: read("src/api/server/dreamRoutes.ts"),
  memoryRoutes: read("src/api/server/routes/memoryRoutes.ts"),
  contractJson: readJson("src/contracts/harness/v1.json", {}),
  contractSource: read("src/contracts/harness/v1.ts"),
  goldenFixtures: readJson("fixtures/harness/v1/golden-lifecycle.json", { fixtures: [] }),
  harnessRuntime: read("bin/lib/harnessRuntime.mjs"),
  harnessMaturity: read("src/eval/harnessMaturity.ts"),
  harnessMaturityArtifact: readJson("artifacts/harness-maturity.json", { summary: {}, passed: false }),
  cliTests: read("tests/cli.test.ts"),
  coreTests: read("tests/core.test.ts"),
  coreIntegrationTests: read("tests/core-integrations.test.ts"),
  apiTests: read("tests/api.test.ts"),
  evaluationTests: read("tests/evaluation.test.ts"),
  retrieval: read("src/core/retrieval.ts"),
  truthGate: read("src/core/truthGate.ts"),
  eventJournal: read("src/core/eventJournal.ts"),
  engineeringMemory: read("src/core/engineeringMemory.ts"),
  searchRuntime: read("src/api/service/searchRuntime.ts"),
  persistence: read("src/api/service/memoryServicePersistence.ts"),
  storeRuntime: read("src/api/service/storeRuntime.ts"),
  sqliteRepository: read("src/api/repositories/sqliteRepository.ts"),
  postgresRepository: read("src/api/repositories/postgresRepository.ts"),
  planGaps: readJson("artifacts/plan-gaps-audit.json", { passed: false, checks: [] }),
  productTruth: readJson("artifacts/product-truth-audit.json", { passed: false, checks: [] }),
  connectorCertification: readJson("artifacts/connector-certification.json", { passed: false, rows: [], summary: {} }),
  connectorMaturity: readJson("artifacts/connector-maturity.json", { rows: [], summary: {} }),
  cognicodeRelease: readJson("artifacts/public/cognicodebench-release.json", { passed: false, releases: [] }),
  arena: readJson("artifacts/arena/run.json", { systems: [] }),
  operatorOs: readJson("artifacts/operator-os-maturity.json", { passed: false, rows: [] })
};

const contractCommands = Object.keys(files.contractJson.commands ?? {});
const parityCommands = Object.keys(files.contractJson.mcpParity ?? {});
const goldenCommands = new Set((files.goldenFixtures.fixtures ?? []).map((fixture) => fixture.command));

const checks = [
  check("p0-release-truth", "Package, scripts, dependencies, doctor and pack smoke align with the analysis P0 installability criteria.", [
    files.packageJson.name === "@cognilabz/cognibrain",
    Boolean(files.packageJson.bin?.cognibrain),
    ["@modelcontextprotocol/sdk", "pg", "zod", "tsx"].every((dep) => Boolean(files.packageJson.dependencies?.[dep])),
    ["release:check", "internal", "verify:selfhosted"].every((script) => Boolean(files.packageJson.scripts?.[script])),
    files.packageJson.exports?.["."] === "./dist/sdk/typescript/index.js",
    files.packageJson.exports?.["./sdk/typescript/client"] === "./dist/sdk/typescript/client.js",
    files.packageJson.scripts?.["build:sdk"] === "node scripts/runtime/build-sdk.mjs",
    files.packageJson.scripts?.["proof:plan"] === "node scripts/release/full-plan-proof.mjs",
    files.buildSdk.includes("sdk\", \"typescript") && files.buildSdk.includes("dist\", \"sdk\", \"typescript"),
    files.packSmoke.includes("npm pack") && files.packSmoke.includes("installed MCP help") && files.packSmoke.includes("installed plain Node SDK imports") && files.packSmoke.includes("node\", [\"--input-type=module\""),
    files.cliRuntime.includes("doctor --publish") && files.cliRuntime.includes("npm pack dry-run"),
    files.releaseCheck.includes("npm pack smoke install")
  ]),
  check("p1-harness-contract", "Harness lifecycle has versioned schemas, MCP parity, golden fixtures, latency assertions and generated templates.", [
    files.contractJson.contract === "cognibrain-harness-lifecycle-v1",
    contractCommands.length >= 12,
    parityCommands.length === contractCommands.length,
    contractCommands.every((command) => goldenCommands.has(command)),
    files.contractSource.includes("harnessCommandJsonSchema") && files.contractSource.includes("HarnessLifecycleCommand"),
    files.cliTests.includes("golden lifecycle fixtures") && files.cliTests.includes("stable JSON envelope"),
    files.cliTests.includes("toBeLessThan(500)") && files.cliTests.includes("toBeLessThan(250)") && files.cliTests.includes("toBeLessThan(300)"),
    files.harnessRuntime.includes("writeCodexConfig") && files.harnessRuntime.includes("writeLangGraphConfig") && files.harnessRuntime.includes("writeDevinStyleConfig"),
    files.harnessMaturityArtifact.passed === true && files.harnessMaturityArtifact.summary?.cliGoldenFixtureCommands === files.harnessMaturityArtifact.summary?.cliMcpParityCommands
  ]),
  check("p2-mcp-thin-proxy", "MCP defaults to daemon-owned state, production local-direct is gated, and process parity is tested.", [
    files.mcpRuntimeClient.includes("assertLocalDirectMcpAllowed"),
    files.mcpRuntimeClient.includes("productionMcpMode"),
    files.runtimeDaemonClient.includes("export class RuntimeDaemonClient"),
    files.runtimeDaemonClient.includes("discoverDaemonUrl"),
    files.runtimeDaemonClient.includes("autostartDaemon"),
    files.jsDaemonClient.includes("export function discoverDaemonUrl"),
    files.jsDaemonClient.includes("export async function autostartDaemon"),
    files.lifecycleCli.includes("./daemonClient.mjs"),
    files.mcpRuntimeClient.includes("new RuntimeDaemonClient"),
    files.fullPlanProof.includes("runtime.shared-daemon-client"),
    files.sdkClient.includes("discoverDaemonUrl"),
    files.cliTests.includes("toBeInstanceOf(RuntimeDaemonClient)"),
    files.coreIntegrationTests.includes("discovers the daemon URL from runtime metadata"),
    files.cliTests.includes("rejects local-direct MCP runtime mode in production"),
    files.cliTests.includes("shares state between a spawned MCP process and the HTTP daemon")
  ]),
  check("p3-db-event-journal", "DB-primary storage and replayable append-only/audit event paths are present and validated.", [
    files.planGaps.passed === true,
    files.eventJournal.includes("MemoryProjectionBuilder"),
    files.eventJournal.includes("rebuildMemoryStoreFromEvents"),
    files.eventJournal.includes("DomainProjection"),
    files.eventJournal.includes("domainEventsApplied"),
    files.coreTests.includes("rebuilds a MemoryStore projection from typed memory events"),
    files.coreTests.includes("rebuilds a MemoryStore projection from a persisted SQLite event journal"),
    files.coreTests.includes("rebuilds claims truth conflicts evidence dream and connector projections from typed events"),
    files.coreTests.includes("rebuilds non-memory domain projections from a persisted SQLite event journal"),
    files.sqliteRepository.includes("persistence_events"),
    files.sqliteRepository.includes("claimRepository"),
    files.sqliteRepository.includes("truthRepository"),
    files.sqliteRepository.includes("conflictRepository"),
    files.sqliteRepository.includes("evidencePackRepository"),
    files.sqliteRepository.includes("connectorSyncRepository"),
    files.sqliteRepository.includes("policyRepository"),
    files.sqliteRepository.includes("createUnitOfWork(): AsyncUnitOfWork"),
    files.sqliteRepository.includes("executeUnitOfWork<T>"),
    files.postgresRepository.includes("cognibrain_persistence_events"),
    files.postgresRepository.includes("cognibrain_current_truth"),
    files.postgresRepository.includes("claimRepository"),
    files.postgresRepository.includes("truthRepository"),
    files.postgresRepository.includes("conflictRepository"),
    files.postgresRepository.includes("evidencePackRepository"),
    files.postgresRepository.includes("connectorSyncRepository"),
    files.postgresRepository.includes("policyRepository"),
    files.postgresRepository.includes("createUnitOfWork(): AsyncUnitOfWork"),
    files.postgresRepository.includes("executeUnitOfWork<T>") && files.postgresRepository.includes("createClientUnitOfWork(client: PoolClient)") && files.postgresRepository.includes("upsertMemoryWithClient(client, memory"),
    files.coreTests.includes("persists claims and current truth through SQLite domain repositories"),
    files.coreTests.includes("persists conflict evidence connector policy and retention rows through SQLite domain repositories"),
    files.coreTests.includes("commits memory claim truth and event writes through a SQLite async UnitOfWork"),
    files.coreTests.includes("rolls back SQLite async UnitOfWork writes atomically"),
    files.memoryService.includes("createProductionPersistedFileFromRepository"),
    files.memoryService.includes("const memories = await repository.list({});") && files.memoryService.includes("if (memories.length > 0)") && files.memoryService.includes("allowServiceStateFallback"),
    files.memoryService.includes("isStrictDbPrimaryBackend") && files.memoryService.includes("allowServiceStateFallback: !isStrictDbPrimaryBackend(backend)"),
    files.memoryServiceStore.includes("addAsync(input: MemoryInput): Promise<Memory>") && files.memoryServiceStore.includes("return addAsyncImpl(this, input)"),
    files.memoryServiceStore.includes("updateAsync(id: string") && files.memoryServiceStore.includes("archiveAsync(id: string)") && files.memoryServiceStore.includes("deleteAsync(id: string)"),
    files.storeRuntime.includes("executeUnitOfWork") && files.storeRuntime.includes("uow.memoryRepository.create") && files.storeRuntime.includes("uow.memoryRepository.update") && files.storeRuntime.includes("uow.memoryRepository.delete") && files.storeRuntime.includes("uow.claimRepository.register") && files.storeRuntime.includes("uow.truthRepository.decide"),
    files.memoryRoutes.includes("await defaultService.recordHarnessActionAsync") && files.memoryRoutes.includes("await defaultService.recordCodeCorrectionAsync") && files.memoryRoutes.includes("await defaultService.updateAsync") && files.memoryRoutes.includes("await defaultService.archiveAsync") && files.memoryRoutes.includes("await defaultService.deleteAsync"),
    files.persistence.includes("waitForProductionAsyncFlush") && files.persistence.includes("productionAsyncFlushError"),
    files.coreTests.includes("hydrates production Postgres startup from repository rows before legacy service_state"),
    files.coreTests.includes("does not read legacy service_state for strict DB-primary production startup"),
    files.coreTests.includes("commits production memory writes through an async UnitOfWork before returning"),
    files.coreTests.includes("commits production memory update archive and delete through an async UnitOfWork before returning"),
    files.coreTests.includes("keeps HTTP memory mutation routes on async production-aware service methods"),
    files.coreTests.includes("surfaces production Postgres flush failures through an explicit awaitable barrier"),
    files.coreTests.includes("await service.waitForProductionAsyncFlush()"),
    files.persistence.includes("previousHash") && files.persistence.includes("payloadHash") && files.persistence.includes("replayAuditEvents"),
    files.coreTests.includes("supports an append-only durable persistence backend"),
    files.coreTests.includes("previousHash") && files.apiTests.includes("/audit/chain")
  ]),
  check("p4-truth-gate", "Current truth affects retrieval/context, stale suppression is tested, and injected context explains why it is safe.", [
    files.retrieval.includes("truthInjectionSummary"),
    files.retrieval.includes("safe_to_inject"),
    files.engineeringMemory.includes("truthExplanation"),
    files.truthGate.includes("TruthGateDecision"),
    files.truthGate.includes("suppressedClaimIds"),
    files.truthGate.includes("engineering memory lacks claim record"),
    files.truthGate.includes("unsafeToInject: true"),
    files.searchRuntime.includes("applyTruthGateDecision"),
    files.searchRuntime.includes("recordTruthGateMetric"),
    files.coreTests.includes("marks engineering memories without claim records as review-only and unsafe to inject"),
    files.coreTests.includes("currentTruthForMemory"),
    files.coreTests.includes("safe_to_inject="),
    files.coreTests.includes("suppressed=1")
  ]),
  check("p5-dream-orchestrator", "Dream jobs are durable, source-aware, release-aware and tested across restart/revalidation paths.", [
    files.postgresRepository.includes("cognibrain_dream_jobs"),
    files.postgresRepository.includes("cognibrain_dream_job_logs"),
    files.dreamRuntime.includes("queueOnly"),
    files.dreamRuntime.includes("runDreamJobWorkerOnce"),
    files.dreamRuntime.includes("productionAsyncRepository?.dreamJobRepository"),
    files.dreamRuntime.includes("repository.queue"),
    files.dreamRuntime.includes("repository.claimDueJob"),
    files.dreamRuntime.includes("repository.completeJob"),
    files.dreamRuntime.includes("productionDreamWorkerMode"),
    files.dreamRuntime.includes("in-process fallback is disabled"),
    files.dreamEngineeringRuntime.includes("Production dream job execution must be claimed"),
    files.dreamRoutes.includes("productionMode()") && files.dreamRoutes.includes("url.pathname === \"/dream/run\"") && files.dreamRoutes.includes("defaultService.startDreamJob") && files.dreamRoutes.includes("defaultService.runDueDreamJobsAsync()"),
    files.dreamInsightsMaintenance.includes("productionDreamWorkerMode") && files.dreamInsightsMaintenance.includes("runDueDreamJobsAsync") && files.dreamInsightsMaintenance.includes("queueAutoDreamJob"),
    files.dreamRoutes.includes("url.pathname === \"/dream/jobs\"") && files.dreamRoutes.includes("{ queueOnly: true }"),
    files.dreamEngineeringRuntime.includes("repository?.completeJob"),
    files.dreamEngineeringRuntime.includes("repository?.retryJob"),
    files.dreamEngineeringRuntime.includes("cancelDreamJobAsync"),
    files.dreamRoutes.includes("await defaultService.cancelDreamJobAsync"),
    files.lifecycleCli.includes("boolOption(options, \"wait\")"),
    files.contractJson.commands?.["release-prepare"]?.properties?.includes("wait"),
    files.cliTests.includes("\"release-prepare\", \"--user\", \"harness-all-daemon\", \"--repo\", \"demo/harness-all\", \"--wait\""),
    files.coreTests.includes("persists dream job queue state across service restarts"),
    files.coreTests.includes("resumes queued dream jobs through a worker after service restart"),
    files.coreTests.includes("prevents duplicate dream job execution across two durable lease workers"),
    files.coreTests.includes("runs dream workers from the async repository queue when available"),
    files.coreTests.includes("queues started dream jobs through the async repository before waiting"),
    files.coreTests.includes("keeps production dream job wait worker-owned after repository enqueue"),
    files.coreTests.includes("fails closed instead of using in-process dream fallback in production"),
    files.coreTests.includes("queues due auto dream jobs instead of running inline in production"),
    files.coreTests.includes("queues due maintenance dream jobs through the production repository"),
    files.coreTests.includes("keeps HTTP dream job creation enqueue-only for worker-owned execution"),
    files.coreTests.includes("persists dream cancel and retry controls through the async repository when available"),
    files.coreTests.includes("expect(second).toBeUndefined()"),
    files.coreTests.includes("runs source-refresh dream jobs by polling connectors before revalidation"),
    files.coreTests.includes("releaseBlockers")
  ]),
  check("p6-connector-certification", "Connector certification is artifact-backed and bounded by signed tenant/production proof.", [
    files.connectorCertification.passed === true,
    Number(files.connectorCertification.summary?.credentialBlocked ?? 0) > 0,
    files.connectorCertification.rows.every((row) => row.state !== "production-certified" || row.checks?.productionCertification === true),
    files.evaluationTests.includes("requires signed live-smoke and owner artifacts"),
    files.connectorMaturity.rows.length >= 7
  ]),
  check("p7-cognicodebench-moat", "Benchmarks use immutable hashes, proof levels and next-change/repeated-mistake metrics.", [
    files.cognicodeRelease.passed === true,
    files.cognicodeRelease.releases.some((release) => typeof release.sha256 === "string" && release.sha256.length === 64),
    files.arena.systems.every((system) => typeof system.proofLevel === "string"),
    JSON.stringify(files.arena).includes("repeatedMistakeRate"),
    files.evaluationTests.includes("repeatedMistakeRate")
  ]),
  check("p8-operator-trust-ux", "Operator surfaces explain truth/context decisions, correction, conflicts and production workbenches.", [
    files.cliTests.includes("truth") && files.cliTests.includes("context") && files.cliTests.includes("whyInjectedVisible"),
    files.coreTests.includes("policyDecision?.allowed"),
    files.operatorOs.passed === true,
    files.productTruth.passed === true,
    files.productTruth.checks.some((item) => item.id === "operator-os-proof" && item.passed)
  ]),
  check("p9-security-policy-enterprise", "Security, policy, redaction, tenant isolation and audit chain criteria are code-backed.", [
    files.coreTests.includes("fuzzes tenant isolation"),
    files.coreTests.includes("redacts sensitive writes"),
    files.coreTests.includes("auditChain"),
    files.apiTests.includes("cross-org") && files.apiTests.includes("nested body"),
    files.productTruth.checks.some((item) => item.id === "policy-tenant-boundary" && item.passed),
    files.productTruth.checks.some((item) => item.id === "gap-default-deny-policy" && item.passed),
    files.productTruth.checks.some((item) => item.id === "gap-enterprise-authz" && item.passed),
    files.apiTests.includes("treats COGNIBRAIN production env as protected"),
    files.apiTests.includes("node bin/cognibrain.mjs help | sh")
  ])
];

for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.id} - ${item.description}`);

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  source: "latest-analysis-acceptance-audit",
  checks,
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length
  },
  passed: checks.every((item) => item.passed)
};

mkdirSync(dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) process.exit(1);

function check(id, description, assertions) {
  const failed = assertions
    .map((value, index) => ({ index, passed: Boolean(value) }))
    .filter((item) => !item.passed)
    .map((item) => item.index);
  return { id, description, passed: failed.length === 0, failedAssertions: failed };
}

function read(relative) {
  const path = join(root, relative);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(relative, fallback) {
  try {
    const content = read(relative);
    return content ? JSON.parse(content) : fallback;
  } catch {
    return fallback;
  }
}
