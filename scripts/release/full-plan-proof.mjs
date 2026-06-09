#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const artifactPath = join(root, "artifacts", "full-plan-proof.json");

const files = {
  packageJson: readJson("package.json", {}),
  releaseCheck: read("scripts/release/release-check.mjs"),
  internalRunner: read("scripts/internal/run-task.mjs"),
  packSmoke: read("scripts/release/pack-smoke.mjs"),
  buildSdk: read("scripts/runtime/build-sdk.mjs"),
  jsDaemonClient: read("bin/lib/daemonClient.mjs"),
  lifecycleCli: read("bin/lib/lifecycleCli.mjs"),
  lightweightMcp: read("bin/lib/lightweightMcpServer.mjs"),
  tsDaemonClient: read("src/runtime/daemonClient.ts"),
  tsMcpRuntime: read("src/connectors/mcpRuntimeClient.ts"),
  sdkClient: read("sdk/typescript/client.ts"),
  helpers: read("src/api/server/helpers.ts"),
  dreamRoutes: read("src/api/server/dreamRoutes.ts"),
  dreamRuntime: read("src/api/service/memoryServiceDreamEngineering.ts"),
  dreamWorkerRuntime: read("src/api/service/dreamRuntime.ts"),
  memoryService: read("src/api/service/memoryService.ts"),
  memoryServiceStore: read("src/api/service/memoryServiceStore.ts"),
  storeRuntime: read("src/api/service/storeRuntime.ts"),
  searchRuntime: read("src/api/service/searchRuntime.ts"),
  truthGate: read("src/core/truthGate.ts"),
  eventJournal: read("src/core/eventJournal.ts"),
  connectorRuntime: read("src/api/service/connectorRuntime.ts"),
  postgresRepository: read("src/api/repositories/postgresRepository.ts"),
  persistence: read("src/api/service/memoryServicePersistence.ts"),
  apiTests: read("tests/api.test.ts"),
  cliTests: read("tests/cli.test.ts"),
  coreTests: read("tests/core.test.ts"),
  integrationTests: read("tests/core-integrations.test.ts"),
  evaluationTests: read("tests/evaluation.test.ts"),
  latestAnalysis: readJson("artifacts/latest-analysis-audit.json", { passed: false, checks: [] }),
  productTruth: readJson("artifacts/product-truth-audit.json", { passed: false, checks: [] }),
  planGaps: readJson("artifacts/plan-gaps-audit.json", { passed: false, checks: [] }),
  connectorCertification: readJson("artifacts/connector-certification.json", { passed: false, rows: [] }),
  arena: readJson("artifacts/arena/run.json", { systems: [], claimBoundary: {} }),
  cognicode: readJson("artifacts/cognicodebench/run.json", { scenarioCount: 0, claimBoundary: {} }),
  operatorMemoryBenchmark: readJson("artifacts/operator-memory-benchmark.json", { marketProofGate: {}, marketClaimAllowed: false })
};

const checks = [
  check("package.plain-node-exports", "NPM package exports compiled JS SDK entrypoints and pack smoke proves plain Node imports.", [
    files.packageJson.exports?.["."] === "./dist/sdk/typescript/index.js",
    files.packageJson.exports?.["./sdk/typescript/client"] === "./dist/sdk/typescript/client.js",
    files.packageJson.scripts?.["build:sdk"] === "node scripts/runtime/build-sdk.mjs",
    files.buildSdk.includes("entryPoints") && files.buildSdk.includes("dist\", \"sdk\", \"typescript"),
    files.packSmoke.includes("installed plain Node SDK imports"),
    files.packSmoke.includes("await import(\"@cognilabz/cognibrain\")")
  ]),
  check("security.harness-execute-argv-only", "/harness/execute parses allowlisted argv and never shells untrusted command strings.", [
    files.dreamRoutes.includes("parseAllowedHarnessCommand"),
    files.dreamRoutes.includes("spawn(parsed.bin, parsed.args"),
    files.dreamRoutes.includes("shell: false"),
    !files.dreamRoutes.includes("spawn(command, { shell: true") && !files.dreamRoutes.includes("spawn(command, []"),
    files.apiTests.includes("node bin/cognibrain.mjs help | sh"),
    files.apiTests.includes("node bin/cognibrain.mjs help `echo pwned`"),
    files.apiTests.includes("node bin/cognibrain.mjs help\\nnode bin/cognibrain.mjs status")
  ]),
  check("security.production-mode-aligned", "API, CLI and MCP production detection use COGNIBRAIN and MEMORY env aliases, and production CORS does not default to wildcard.", [
    files.helpers.includes("COGNIBRAIN_SECURITY_MODE"),
    files.helpers.includes("COGNIBRAIN_PRODUCTION_MODE"),
    files.helpers.includes("productionMode() ? \"null\""),
    files.apiTests.includes("treats COGNIBRAIN production env as protected"),
    files.tsMcpRuntime.includes("COGNIBRAIN_PRODUCTION_MODE"),
    files.lifecycleCli.includes("COGNIBRAIN_PRODUCTION_MODE")
  ]),
  check("runtime.shared-daemon-client", "CLI, lightweight MCP, TS MCP runtime and SDK use shared daemon discovery/auth/autostart/http code instead of forked clients.", [
    files.jsDaemonClient.includes("export function discoverDaemonUrl"),
    files.jsDaemonClient.includes("export async function autostartDaemon"),
    files.jsDaemonClient.includes("export async function httpJson"),
    files.lifecycleCli.includes("./daemonClient.mjs"),
    files.lightweightMcp.includes("./daemonClient.mjs"),
    !files.lifecycleCli.includes("function discoverDaemonUrl("),
    !files.lifecycleCli.includes("function authHeadersFromOptions("),
    !files.lightweightMcp.includes("function authHeadersFromEnv("),
    !files.lightweightMcp.includes("function autostartDaemon("),
    files.tsDaemonClient.includes("export class RuntimeDaemonClient"),
    files.tsMcpRuntime.includes("new RuntimeDaemonClient"),
    files.sdkClient.includes("discoverDaemonUrl")
  ]),
  check("truth.mandatory-engineering-claim-gate", "Engineering memories without claim records are review-only and unsafe before context injection.", [
    files.truthGate.includes("evaluateTruthGate"),
    files.truthGate.includes("engineering memory lacks claim record"),
    files.truthGate.includes("unsafeToInject: true"),
    files.searchRuntime.includes("applyTruthGateDecision"),
    files.searchRuntime.includes("recordTruthGateMetric"),
    files.coreTests.includes("marks engineering memories without claim records as review-only and unsafe to inject"),
    files.truthGate.includes("suppressedClaimIds"),
    files.coreTests.includes("suppressedClaimIds")
  ]),
  check("storage.db-primary-event-proof", "Storage plan has row-backed SQLite/Postgres paths, append-only audit/event proof and no open plan gap artifact.", [
    files.postgresRepository.includes("AsyncPostgresMemoryRepository"),
    files.eventJournal.includes("MemoryProjectionBuilder"),
    files.eventJournal.includes("memory.deleted"),
    files.eventJournal.includes("DomainProjection"),
    files.eventJournal.includes("domainEventsApplied"),
    files.coreTests.includes("rebuilds a MemoryStore projection from typed memory events"),
    files.coreTests.includes("rebuilds claims truth conflicts evidence dream and connector projections from typed events"),
    files.coreTests.includes("rebuilds non-memory domain projections from a persisted SQLite event journal"),
    files.postgresRepository.includes("cognibrain_claims"),
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
    files.postgresRepository.includes("cognibrain_dream_jobs"),
    files.memoryService.includes("createProductionPersistedFileFromRepository"),
    files.memoryService.includes("const memories = await repository.list({});") && files.memoryService.includes("if (memories.length > 0)") && files.memoryService.includes("allowServiceStateFallback"),
    files.memoryService.includes("isStrictDbPrimaryBackend") && files.memoryService.includes("allowServiceStateFallback: !isStrictDbPrimaryBackend(backend)"),
    files.memoryServiceStore.includes("addAsync(input: MemoryInput): Promise<Memory>"),
    files.storeRuntime.includes("executeUnitOfWork") && files.storeRuntime.includes("uow.memoryRepository.create") && files.storeRuntime.includes("uow.claimRepository.register") && files.storeRuntime.includes("uow.truthRepository.decide"),
    files.coreTests.includes("commits production memory writes through an async UnitOfWork before returning"),
    files.coreTests.includes("hydrates production Postgres startup from repository rows before legacy service_state"),
    files.coreTests.includes("does not read legacy service_state for strict DB-primary production startup"),
    files.persistence.includes("previousHash") && files.persistence.includes("payloadHash"),
    files.productTruth.checks?.some((item) => item.id === "gap-storage-db-primary" && item.passed),
    files.planGaps.passed === true
  ]),
  check("dream.durable-queue-proof", "Dream jobs are persisted, controllable and release/source-aware across service, HTTP, MCP and tests.", [
    files.postgresRepository.includes("cognibrain_dream_jobs"),
    files.postgresRepository.includes("cognibrain_dream_job_logs"),
    files.postgresRepository.includes("lease_owner"),
    files.dreamRuntime.includes("attemptCount"),
    files.dreamRuntime.includes("leaseDreamJob"),
    files.dreamRuntime.includes("queueOnly"),
    files.dreamRuntime.includes("runDreamJobWorkerOnce"),
    files.dreamWorkerRuntime.includes("productionAsyncRepository?.dreamJobRepository"),
    files.dreamWorkerRuntime.includes("repository.queue"),
    files.dreamWorkerRuntime.includes("repository.claimDueJob"),
    files.dreamWorkerRuntime.includes("repository.completeJob"),
    files.dreamRoutes.includes("url.pathname === \"/dream/jobs\"") && files.dreamRoutes.includes("{ queueOnly: true }"),
    files.dreamRuntime.includes("repository?.completeJob"),
    files.dreamRuntime.includes("repository?.retryJob"),
    files.dreamRuntime.includes("cancelDreamJobAsync"),
    files.dreamRoutes.includes("await defaultService.cancelDreamJobAsync"),
    files.lifecycleCli.includes("boolOption(options, \"wait\")"),
    files.dreamRoutes.includes("body.wait"),
    files.cliTests.includes("\"release-prepare\", \"--user\", \"harness-all-daemon\", \"--repo\", \"demo/harness-all\", \"--wait\""),
    files.coreTests.includes("persists dream job queue state across service restarts"),
    files.coreTests.includes("resumes queued dream jobs through a worker after service restart"),
    files.coreTests.includes("prevents duplicate dream job execution across two durable lease workers"),
    files.coreTests.includes("runs dream workers from the async repository queue when available"),
    files.coreTests.includes("queues started dream jobs through the async repository before waiting"),
    files.coreTests.includes("keeps HTTP dream job creation enqueue-only for worker-owned execution"),
    files.coreTests.includes("persists dream cancel and retry controls through the async repository when available"),
    files.coreTests.includes("expect(second).toBeUndefined()"),
    files.coreTests.includes("leaseOwner"),
    files.coreTests.includes("releaseBlockers"),
    files.lightweightMcp.includes("memory_dream_job_start"),
    files.tsMcpRuntime.includes("dream.jobStart")
  ]),
  check("connectors.certification-proof", "Connector certification is artifact-backed and bounded; docs/audits cannot claim production certification without live proof.", [
    files.connectorCertification.passed === true,
    (files.connectorCertification.rows ?? []).length >= 10,
    (files.connectorCertification.rows ?? []).some((row) => row.state === "credential-blocked"),
    /^[a-f0-9]{64}$/.test(String(files.connectorCertification.proofGate?.artifactHash ?? "")),
    files.connectorCertification.proofGate?.status === "credential-blocked" || files.connectorCertification.proofGate?.tenantClaimAllowed === true,
    files.connectorCertification.proofGate?.productionClaimAllowed !== true || files.connectorCertification.proofGate?.status === "production-certified",
    files.connectorRuntime.includes("certification:"),
    files.coreTests.includes("productionCertified: false"),
    files.productTruth.checks?.some((item) => item.id === "connector-certification-boundary" && item.passed),
    files.evaluationTests.includes("tenantVerified")
  ]),
  check("benchmarks.next-change-proof-boundary", "Benchmarks prove local next-change diagnostics while blocking quality/market claims without judge/native proof.", [
    files.cognicode.scenarioCount >= 1000,
    files.cognicode.claimBoundary?.qualityClaimAllowed === false,
    files.cognicode.claimBoundary?.marketClaimAllowed === false,
    files.arena.systems?.some((system) => system.system === "cognibrain" && system.proofLevel === "same-run-full"),
    files.arena.claimBoundary?.marketClaimAllowed === false,
    files.operatorMemoryBenchmark.marketClaimAllowed === false,
    files.operatorMemoryBenchmark.marketProofGate?.status === "blocked",
    files.operatorMemoryBenchmark.marketProofGate?.checks?.publicArtifactHash === false,
    files.operatorMemoryBenchmark.marketProofGate?.checks?.vendorOrIndependentProof === false,
    files.productTruth.checks?.some((item) => item.id === "benchmark-release-claim-boundary" && item.passed),
    files.productTruth.checks?.some((item) => item.id === "operator-memory-market-proof-boundary" && item.passed)
  ]),
  check("release.goal-proof-gated", "Release, CI and proof scripts include all plan audits and this full-plan proof gate.", [
    files.packageJson.scripts?.["proof:plan"] === "node scripts/release/full-plan-proof.mjs",
    files.internalRunner.includes("\"proof:plan\""),
    files.internalRunner.includes("\"audit:latest-analysis\", \"proof:plan\""),
    files.internalRunner.includes("proof:plan\", \"build"),
    files.releaseCheck.includes("full plan proof"),
    files.latestAnalysis.passed === true,
    files.productTruth.passed === true,
    files.planGaps.passed === true
  ])
];

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length
  },
  checks
};

mkdirSync(join(root, "artifacts"), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.id} - ${item.description}`);
if (report.summary.failed) {
  console.error(`full plan proof failed: ${report.summary.failed}/${report.summary.total} checks failed; see artifacts/full-plan-proof.json`);
  process.exit(1);
}
console.log(`full plan proof passed: ${report.summary.passed}/${report.summary.total} checks`);

function check(id, description, assertions) {
  const failed = assertions.map((value, index) => ({ index, passed: Boolean(value) })).filter((item) => !item.passed);
  return { id, description, passed: failed.length === 0, failedAssertions: failed };
}

function read(path) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch {
    return "";
  }
}

function readJson(path, fallback) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return fallback;
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    return fallback;
  }
}
