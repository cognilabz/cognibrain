#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const artifactPath = join(root, "artifacts", "product-truth-audit.json");
const realCompetitorLevels = new Set(["same-run-native", "same-run-cloud-api", "same-run-cli", "vendor-signed", "real-customer-field"]);
const acceptableModeledLevels = new Set(["same-run-api-shape", "artifact-import", "credential-blocked", "public-claim-only", "planned"]);

const files = {
  packageJson: readJson("package.json", {}),
  arena: readJson("artifacts/arena/run.json", { systems: [] }),
  maturity: readJson("artifacts/connector-maturity.json", { rows: [], summary: {} }),
  connectorCertification: readJson("artifacts/connector-certification.json", { rows: [], summary: {}, passed: false }),
  connectorQuality: readJson("artifacts/connector-quality.json", { rows: [], summary: {}, passed: false }),
  connectorTransport: readJson("artifacts/connector-transport.json", { checks: {}, passed: false }),
  connectorWebhooks: readJson("artifacts/connector-webhooks.json", { rows: [], summary: {} }),
  operatorOs: readJson("artifacts/operator-os-maturity.json", { rows: [], summary: {}, passed: false }),
  benchmarkHardening: readJson("artifacts/benchmark-hardening.json", { checks: {}, dataset: {}, passed: false }),
  benchmarkRelease: readJson("artifacts/public/cognicodebench-release.json", { releases: [], scorecardProofLevels: [], publication: {}, passed: false }),
  cognicodeBench: readJson("artifacts/cognicodebench/run.json", { baselines: [], ablation: {}, diagnostics: {}, methodology: {}, claimBoundary: {} }),
  releaseContract: readJson("artifacts/release-contract-audit.json", { summary: {}, checks: [] }),
  harnessMaturity: readJson("artifacts/harness-maturity.json", { rows: [], summary: {} }),
  vendorApiSpecs: readJson("artifacts/vendor-api-specs.json", { rows: [], summary: {} }),
  vendorLive: readJson("artifacts/vendor-live-smoke.json", { liveRequested: false, writebackEnabled: false, providers: [] }),
  postgresLive: readJson("artifacts/postgres-live.json", { acceptance: {} }),
  realworldProtocol: readJson("artifacts/realworld-benchmark-protocol.json", { currentArtifacts: [], leaderboardEligibleArtifacts: [] }),
  realworldBlackbox: readJson("artifacts/realworld-blackbox.json", { systems: [], manifestHash: "", eligibilityGate: {}, leaderboardEligible: true }),
  realworldNativeCompetitors: readJson("artifacts/realworld-native-competitors.json", { systems: [], originalRawOutputRuns: 0 }),
  operatorMemoryBenchmark: readJson("artifacts/operator-memory-benchmark.json", { systems: [] }),
  operatorMemoryNativeCompetitors: readJson("artifacts/operator-memory-native-competitors.json", { systems: [] }),
  arenaSource: read("src/eval/arena.ts"),
  arenaOpenAiJudge: read("scripts/benchmark/arena-openai-judge.mjs"),
  nativeCompetitorBenchmark: read("scripts/benchmark/benchmark-native-competitors.mjs"),
  arenaMem0Runner: read("scripts/benchmark/competitors/mem0-runner.mjs"),
  arenaGbrainRunner: read("scripts/benchmark/competitors/gbrain-runner.mjs"),
  arenaNativePythonRunner: read("scripts/benchmark/competitors/native_python_runner.py"),
  arenaNativePythonRunnerWrapper: read("scripts/benchmark/competitors/native-python-runner.mjs"),
  operatorMemoryBenchmarkSource: read("src/eval/operatorMemoryBenchmark.ts"),
  cognicodeBenchSource: read("src/eval/cognicodeBench.ts"),
  operatorMemoryOpenAiJudge: read("scripts/benchmark/operator-memory-openai-judge.mjs"),
  operatorMemoryNativeCompetitorBenchmark: read("scripts/benchmark/operator-memory-native-competitors.mjs"),
  operatorMemoryNativePythonRunner: read("scripts/benchmark/competitors/operator_memory_native_runner.py"),
  operatorMemoryNativePythonRunnerWrapper: read("scripts/benchmark/competitors/operator-memory-native-python-runner.mjs"),
  basicMemoryExternalRunner: read("scripts/benchmark/competitors/basic_memory_external_runner.py"),
  realworldNativeCompetitorBenchmark: read("scripts/benchmark/benchmark-realworld-native-competitors.mjs"),
  realworldOpenAiJudge: read("scripts/benchmark/realworld-openai-judge.mjs"),
  realworldBasicMemoryRunner: read("scripts/benchmark/competitors/basic_memory_realworld_runner.py"),
  realworldLangMemRunner: read("scripts/benchmark/competitors/langmem_realworld_runner.py"),
  benchmarkCacheRoot: read("scripts/benchmark/cache-root.mjs"),
  realworldBlackboxSource: read("src/eval/realworldBlackbox.ts"),
  marketGateSource: read("src/eval/marketGate.ts"),
  evaluationRunSource: read("src/eval/run.ts"),
  locomoSource: read("src/eval/locomo.ts"),
  longMemEvalSource: read("src/eval/longmemeval.ts"),
  beamSource: read("src/eval/beam.ts"),
  externalHardSource: read("src/eval/externalHard.ts"),
  nextgenBenchmarksSource: read("src/eval/nextgenBenchmarks.ts"),
  publishArenaSource: read("src/eval/publishArena.ts"),
  publishLeaderboardSource: read("src/eval/publishLeaderboard.ts"),
  benchmarkSvgSource: read("scripts/release/render-benchmark-svg.mjs"),
  benchmarkSvg: read("docs/assets/benchmark-results.svg"),
  leaderboardSource: read("src/eval/leaderboard.ts"),
  answerGenerationSource: read("src/eval/answerGeneration.ts"),
  releaseCheck: read("scripts/release/release-check.mjs"),
  internalRunner: read("scripts/internal/run-task.mjs"),
  cli: readMany(["bin/cognibrain.mjs", "bin/lib/render.mjs", "bin/lib/cliRuntime.mjs", "bin/lib/harnessRuntime.mjs", "bin/lib/resourcesRuntime.mjs", "bin/lib/lightweightMcpServer.mjs", "scripts/runtime/start-local.mjs", "scripts/runtime/build-api.mjs"]),
  memoryCommands: read("src/cli/memctl/memoryCommands.ts"),
  server: read("src/api/server.ts"),
  dreamRoutes: read("src/api/server/dreamRoutes.ts"),
  serverHelpers: read("src/api/server/helpers.ts"),
  service: readMany(["src/api/service.ts","src/api/service/memoryService.ts","src/api/service/memoryServiceBase.ts","src/api/service/memoryServiceDeps.ts","src/api/service/memoryServiceImports.ts","src/api/service/memoryServiceStore.ts","src/api/service/memoryServiceTruth.ts","src/api/service/memoryServiceRetrieval.ts","src/api/service/memoryServiceDreamEngineering.ts","src/api/service/memoryServiceSourceRevalidation.ts","src/api/service/memoryServiceLifecycleFeedback.ts","src/api/service/memoryServiceConnectorsAdmin.ts","src/api/service/memoryServiceSharingGraphMarketplace.ts","src/api/service/memoryServiceGovernanceOps.ts","src/api/service/memoryServiceInsightsMaintenance.ts","src/api/service/memoryServicePersistence.ts"]),
  dreamRuntime: read("src/api/service/dreamRuntime.ts"),
  mcpTools: read("src/connectors/mcpTools.ts"),
  mcpHandlers: read("src/connectors/mcpHandlers.ts"),
  cliTests: read("tests/cli.test.ts"),
  coreTests: read("tests/core.test.ts"),
  evaluationTests: read("tests/evaluation.test.ts"),
  storageAdapter: read("src/core/storageAdapter.ts"),
  repositories: readMany([
    "src/api/repositories/sqliteRepository.ts",
    "src/api/repositories/postgresRepository.ts",
    "src/api/repositories/index.ts"
  ]),
  persistence: readMany([
    "src/api/persistence.ts",
    "src/api/persistence/local.ts",
    "src/api/persistence/sqlite.ts",
    "src/api/persistence/compatible.ts",
    "src/api/persistence/remote.ts",
    "src/api/persistence/factory.ts"
  ]),
  readme: read("README.md"),
  docsHome: read("docs/README.md"),
  install: read("docs/install.md"),
  benchmarks: read("docs/benchmarks.md"),
  integrations: read("docs/integrations.md"),
  operations: read("docs/operations.md"),
  evidence: read("docs/evidence.md"),
  status: read("docs/status.md"),
  sameBenchmark: ""
};

const arenaSystems = Array.isArray(files.arena.systems) ? files.arena.systems : [];
const competitors = arenaSystems.filter((system) => system.system !== "cognibrain");
const realCompetitors = competitors.filter((system) => realCompetitorLevels.has(system.proofLevel));
const apiShapeCompetitors = competitors.filter((system) => system.proofLevel === "same-run-api-shape");
const blockedCompetitors = competitors.filter((system) => system.proofLevel === "credential-blocked");
const unsupportedCompetitorLevels = competitors.filter((system) => !realCompetitorLevels.has(system.proofLevel) && !acceptableModeledLevels.has(system.proofLevel));
const cognibrainArena = arenaSystems.find((system) => system.system === "cognibrain");

const maturityRows = Array.isArray(files.maturity.rows) ? files.maturity.rows : [];
const apiSpecRows = Array.isArray(files.vendorApiSpecs.rows) ? files.vendorApiSpecs.rows : [];
const liveSmokeRows = maturityRows.filter((row) => row?.maturity?.tenantVerified === true || row?.maturity?.liveSmoke === true);
const productionCertifiedRows = maturityRows.filter((row) => row?.maturity?.productionCertified === true);
const webhookRows = Array.isArray(files.connectorWebhooks.rows) ? files.connectorWebhooks.rows : [];
const webhookVerifiedRows = maturityRows.filter((row) => row?.maturity?.webhook === true);
const certificationRows = Array.isArray(files.connectorCertification.rows) ? files.connectorCertification.rows : [];
const certificationCredentialBlockedRows = certificationRows.filter((row) => row?.state === "credential-blocked");
const qualityRows = Array.isArray(files.connectorQuality.rows) ? files.connectorQuality.rows : [];
const priorityWebhookProviders = new Set(["github", "jira", "confluence", "notion", "linear", "gitlab", "slack", "teams", "sentry", "pagerduty"]);
const harnessRows = Array.isArray(files.harnessMaturity.rows) ? files.harnessMaturity.rows : [];
const generatedHarnessRows = harnessRows.filter((row) => row?.maturity?.configGenerated === true);
const harnessGoldenPaths = harnessRows.filter((row) => row?.maturity?.e2eDemo === true);
const harnessRowsWithGaps = harnessRows.filter((row) => Array.isArray(row?.gaps) && row.gaps.length > 0);
const hermeticRows = maturityRows.filter((row) => row?.maturity?.hermeticFixture === true && row?.maturity?.apiSpec === true);
const liveSmokeReadyRows = maturityRows.filter((row) => ["live-smoke-ready", "tenant-verified", "production-certified"].includes(row?.proofLevel));
const apiSpecVerifiedRows = maturityRows.filter((row) => row?.maturity?.apiSpec === true);
const vendorLiveProviders = Array.isArray(files.vendorLive.providers) ? files.vendorLive.providers : [];
const vendorLiveAttempted = vendorLiveProviders.filter((provider) => provider && provider.skipped === false);
const storageIsSnapshotFirst = files.persistence.includes("insert into cognibrain_snapshots") && files.persistence.includes("truncate table cognibrain_context_packs");
const dbPrimaryStorage = !storageIsSnapshotFirst && files.persistence.includes("DB-primary repository") && files.persistence.includes("memory.created") && files.persistence.includes("memory.updated") && files.persistence.includes("memory.deleted");
const noFullStoreImportOnPersist = !files.service.includes("repository.import(this.store.export())") && files.service.includes("repositorySharesReadModel()");
const dbPrimaryAliasesBypassLegacyPersistence = files.persistence.includes("DB-primary MemoryRepository backend") && !files.persistence.includes('backend === "postgres-remote" || backend === "postgres-production"') && files.coreTests.includes("does not route DB-primary Postgres aliases through the legacy remote persistence factory");
const hardWiredServiceStore = /readonly\s+store\s*=\s*new\s+MemoryStore\s*\(/.test(files.service);
const memoryRepositoryBoundary = files.storageAdapter.includes("export interface MemoryRepository") && files.service.includes("readonly repository: MemoryRepository") && files.service.includes("repositoryFromStorage");
const dbRepositoryImplementations = files.repositories.includes("class SQLiteMemoryRepository") && files.repositories.includes("class PostgresMemoryRepository") && files.repositories.includes("implements MemoryRepository");
const requiredHeavyGeneratedExcludes = [
  "**/.cognibrain/**",
  "**/.memory-harness.json",
  "**/.venv/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/.next/**",
  "**/artifacts/**",
  "**/coverage/**",
  "**/data/benchmarks/**",
  "**/node_modules/**",
  "**/operator-ui/.next/**",
  "**/playwright-report/**",
  "**/test-results/**"
];
const vscodeHeavyGeneratedExcludes = files.cli.includes("HEAVY_GENERATED_EXCLUDE_PATTERNS") &&
  requiredHeavyGeneratedExcludes.every((pattern) => files.cli.includes(pattern) && files.cliTests.includes(pattern));
const dreamJobWorkerControl = files.service.includes("cancelDreamJob(") && files.service.includes("retryDreamJob(") && files.dreamRoutes.includes("/dream/jobs") && files.dreamRoutes.includes("cancel") && files.dreamRoutes.includes("retry") && files.mcpTools.includes("memory_dream_job_cancel") && files.mcpTools.includes("memory_dream_job_retry") && files.coreTests.includes("cancels and retries dream jobs");
const liveSourceRevalidation = files.service.includes("revalidateSourceRefsAsync") && files.service.includes("await resolver.fetch") && files.service.includes("listExternalVendorItems") && files.dreamRoutes.includes("revalidateSourceRefsAsync") && files.coreTests.includes("uses live async source resolver fetch") && files.coreTests.includes("default GitHub source resolver fetches current provider state");
const postgresVerifierPassed = files.postgresLive?.acceptance?.startsWithPostgresBackend === true && files.postgresLive?.storage?.active === "postgres-repository";
const serverAuthCode = `${files.server}\n${files.serverHelpers}`;
const oidcVerifierPresent = /\bjwks\b|\bopenid-client\b|\bjose\b|verifyJwt|verifyOidc|issuer.+audience/i.test(serverAuthCode);
const apiKeyAuthPresent = serverAuthCode.includes("MEMORY_API_KEYS") && serverAuthCode.includes("Bearer");
const defaultAllowPolicy = files.service.includes('const allowed = decisive ? decisive.effect === "allow" : true');
const corsWildcard = files.server.includes('Access-Control-Allow-Origin", "*"');
const requestRateLimitPresent = /rateLimit|rate limit|429|too_many_requests/i.test(files.server);
const bodyLimitPresent = /bodyLimit|maxBody|payload too large|413/i.test(files.server);
const docsCorpus = [files.readme, files.docsHome, files.install, files.benchmarks, files.integrations, files.operations, files.evidence, files.status, files.sameBenchmark].join("\n\n");
const realworldArtifacts = Array.isArray(files.realworldProtocol.currentArtifacts) ? files.realworldProtocol.currentArtifacts : [];
const realworldEligibleArtifacts = Array.isArray(files.realworldProtocol.leaderboardEligibleArtifacts) ? files.realworldProtocol.leaderboardEligibleArtifacts : [];
const realworldAllClassified = realworldArtifacts.length >= 6 && realworldArtifacts.every((artifact) => artifact?.path && artifact?.className && artifact.leaderboardEligible === false && Array.isArray(artifact.missingForLeaderboard));
const realworldNativeProtocolArtifact = realworldArtifacts.find((artifact) => artifact?.path === "artifacts/realworld-native-competitors.json");
const realworldBlackboxSystems = Array.isArray(files.realworldBlackbox.systems) ? files.realworldBlackbox.systems : [];
const realworldBlackboxCognibrain = realworldBlackboxSystems.find((system) => system.system === "cognibrain");
const realworldBlackboxBlocked = realworldBlackboxSystems.filter((system) => system.evidenceClass === "credential-blocked");
const realworldBlackboxRawRetained = realworldBlackboxCognibrain && Array.isArray(realworldBlackboxCognibrain.rawOutputs) && realworldBlackboxCognibrain.rawOutputs.length >= 15;
const realworldBlackboxJudgeBlocked = realworldBlackboxCognibrain?.qualityClaimAllowed === false && realworldBlackboxCognibrain?.judge?.kind === "missing" && realworldBlackboxCognibrain?.metrics?.score === null && files.realworldBlackbox.eligibilityGate?.llmOrHarnessJudged === false;
const realworldBlackboxHarnessReady = files.realworldBlackbox.manifestHash?.length === 64 && files.realworldBlackbox.leaderboardEligible === false && files.realworldBlackbox.eligibilityGate?.manifestCoverageReady === true && files.realworldBlackbox.eligibilityGate?.rawOutputsRetained === true && files.realworldBlackbox.eligibilityGate?.costLatencyRecorded === true && realworldBlackboxRawRetained && realworldBlackboxJudgeBlocked;
const realworldBlackboxMarketGateStrict = files.realworldBlackboxSource.includes("cognibrainComparativeSmokeEligible") &&
  files.realworldBlackboxSource.includes("leaderboardEligibleSystems: []") &&
  files.realworldBlackboxSource.includes("originalCompetitorEligibleSystems.length >= 2") &&
  files.realworldBlackboxSource.includes('system.system !== "cognibrain"') &&
  files.realworldBlackboxSource.includes('system.evidenceClass === "same-run-command"') &&
  files.realworldBlackboxSource.includes("system.comparativeSmokeEligible") &&
  files.realworldBlackboxSource.includes("Cognibrain plus at least 2");
const realworldNativeCompetitorPath = files.internalRunner.includes("benchmark-realworld-native-competitors.mjs") &&
  files.realworldNativeCompetitorBenchmark.includes("realworld-native-competitor-run") &&
  files.realworldNativeCompetitorBenchmark.includes("basic_memory_realworld_runner.py") &&
  files.realworldNativeCompetitorBenchmark.includes("langmem_realworld_runner.py") &&
  files.realworldNativeCompetitorBenchmark.includes("MEMORY_REALWORLD_JUDGE_COMMAND") &&
  files.realworldNativeCompetitorBenchmark.includes("comparativeSmokeEligible") &&
  files.realworldNativeCompetitorBenchmark.includes("marketClaimAllowed") &&
  files.realworldNativeCompetitorBenchmark.includes("quality and comparative-smoke eligibility require the configured central LLM/harness judge") &&
  files.realworldNativeCompetitorBenchmark.includes("market and leaderboard claims remain blocked by the RealWorld claim boundary") &&
  files.realworldBasicMemoryRunner.includes("basic-memory-original-package") &&
  files.realworldBasicMemoryRunner.includes("Diagnostic only. Raw outputs were captured") &&
  files.realworldLangMemRunner.includes("langmem-original-package") &&
  files.realworldLangMemRunner.includes("Diagnostic only. Raw outputs were captured");
const realworldNativeOriginalRawProof = realworldNativeProtocolArtifact?.className === "native-original-same-manifest-raw-output-proof" &&
  realworldNativeProtocolArtifact?.leaderboardEligible === false &&
  Array.isArray(realworldNativeProtocolArtifact?.missingForLeaderboard) &&
  realworldNativeProtocolArtifact.missingForLeaderboard.includes("LLM/harness judge command succeeds on original raw outputs") &&
  String(realworldNativeProtocolArtifact?.allowedUse ?? "").includes("Same-manifest original-package raw-output proof") &&
  String(realworldNativeProtocolArtifact?.allowedUse ?? "").includes("market claims remain blocked") &&
  files.realworldProtocol.currentArtifacts?.some?.((artifact) => artifact?.path === "artifacts/realworld-native-competitors.json") &&
  files.realworldNativeCompetitors.originalRawOutputRuns >= 2 &&
  files.realworldNativeCompetitors.judgeBlockedOriginalRuns >= 2 &&
  files.realworldNativeCompetitors.marketClaimAllowed === false &&
  files.realworldNativeCompetitors.leaderboardEligible === false &&
  (files.realworldNativeCompetitors.systems ?? []).filter((system) => system?.evidenceClass === "same-run-command" && Number(system.rawOutputCount ?? 0) >= 15).length >= 2;
const realworldCentralJudgeRecompute = files.realworldBlackboxSource.includes("central MEMORY_REALWORLD_JUDGE_COMMAND recomputation is required") &&
  files.realworldBlackboxSource.includes("scoreSystem(adapter, manifest, mergedSetup, external.rawOutputs") &&
  files.realworldBlackboxSource.includes("validateJudgeDecisionSemantics") &&
  files.realworldBlackboxSource.includes("forbidden leakage must force passed=false") &&
  files.evaluationTests.includes("does not trust external command self-judged metrics") &&
  files.evaluationTests.includes("blocks inconsistent real-world judge decisions");
const realworldLlmJudgeCostAccounting = files.realworldBlackboxSource.includes("judgeEstimatedCostUsd") &&
  files.realworldBlackboxSource.includes("LLM real-world judge must report positive estimatedCostUsd") &&
  files.realworldBlackboxSource.includes("LLM real-world judge must report token usage") &&
  files.realworldOpenAiJudge.includes("pricingForModel") &&
  files.realworldOpenAiJudge.includes("estimateCostUsd") &&
  files.realworldOpenAiJudge.includes("perQueryLatencyMs") &&
  files.evaluationTests.includes("records OpenAI real-world judge usage and estimated scorer cost") &&
  files.evaluationTests.includes("blocks LLM real-world judge decisions that omit scorer cost evidence");
const realworldOperationalWeaknessReporting = files.realworldBlackboxSource.includes("buildOperationalWeaknessReport") &&
  files.realworldBlackboxSource.includes("rawErrorClasses") &&
  files.realworldBlackboxSource.includes("bucketWeaknesses") &&
  files.realworldBlackboxSource.includes("systemWeaknesses") &&
  files.realworldBlackboxSource.includes("setupFailureRate") &&
  files.realworldBlackboxSource.includes("rawOutputCoverageRate") &&
  files.evaluationTests.includes("Operational Weaknesses") &&
  files.evaluationTests.includes("central-judge-blocked") &&
  files.evaluationTests.includes("external-system-not-configured") &&
  files.realworldBlackbox?.operationalWeaknesses?.summary?.requestedSystems >= 2 &&
  files.realworldBlackbox?.operationalWeaknesses?.summary?.blockedSystems >= 1 &&
  Array.isArray(files.realworldBlackbox?.operationalWeaknesses?.rawErrorClasses) &&
  files.realworldBlackbox.operationalWeaknesses.rawErrorClasses.length >= 1 &&
  Array.isArray(files.realworldBlackbox?.operationalWeaknesses?.bucketWeaknesses) &&
  files.realworldBlackbox.operationalWeaknesses.bucketWeaknesses.length >= 5;
const thirdPartyOssSources = [
  "https://github.com/vercel/next.js/issues/84884",
  "https://github.com/vercel/next.js/issues/78957",
  "https://github.com/pytest-dev/pytest-asyncio/issues/293"
];
const realworldThirdPartyOssEvents = Array.isArray(files.realworldBlackbox?.manifest?.events)
  ? files.realworldBlackbox.manifest.events.filter((event) => event?.bucket === "third-party-oss-workflows")
  : [];
const realworldThirdPartyOssQueries = Array.isArray(files.realworldBlackbox?.manifest?.queries)
  ? files.realworldBlackbox.manifest.queries.filter((query) => query?.bucket === "third-party-oss-workflows")
  : [];
const protocolThirdPartyOssSources = Array.isArray(files.realworldProtocol?.thirdPartyOssSourceEvidence?.sources)
  ? files.realworldProtocol.thirdPartyOssSourceEvidence.sources
  : [];
const realworldThirdPartyOssBucket =
  files.realworldBlackboxSource.includes('bucket: "third-party-oss-workflows"') &&
  thirdPartyOssSources.every((source) => files.realworldBlackboxSource.includes(source)) &&
  realworldThirdPartyOssEvents.length >= 3 &&
  realworldThirdPartyOssEvents.every((event) => typeof event?.source === "string" && event.source.startsWith("https://github.com/")) &&
  realworldThirdPartyOssQueries.length >= 3 &&
  files.realworldProtocol?.thirdPartyOssSourceEvidence?.present === true &&
  thirdPartyOssSources.every((source) => protocolThirdPartyOssSources.includes(source)) &&
  files.evaluationTests.includes("third-party-oss-workflows") &&
  files.evaluationTests.includes("https://github.com/");
const realworldSmokeMarketBoundary = files.realworldBlackboxSource.includes("comparativeSmokeEligible") &&
  files.realworldBlackboxSource.includes("marketClaimAllowed") &&
  files.realworldBlackboxSource.includes("leaderboardEligibleSystems: []") &&
  files.realworldBlackboxSource.includes("system.comparativeSmokeEligible") &&
  files.realworldBlackboxSource.includes("comparativeSmokeEligible: originalRun") &&
  files.realworldBlackboxSource.includes("leaderboardEligible: false") &&
  files.realworldBlackboxSource.includes("comparative-smoke-eligible-results-not-market-leaderboard") &&
  files.realworldBlackboxSource.includes("Market leaderboard claims require a larger third-party-sourced task set") &&
  files.realworldBlackboxSource.includes("claimBoundary") &&
  files.evaluationTests.includes("comparative smoke eligibility without market claims") &&
  files.evaluationTests.includes("report.leaderboardEligibleSystems).toEqual([]") &&
  files.evaluationTests.includes("marketClaimAllowed).toBe(false)");
const benchmarkReleaseRows = Array.isArray(files.benchmarkRelease.releases) ? files.benchmarkRelease.releases : [];
const benchmarkReleaseClaimBoundary = files.benchmarkRelease.passed === true &&
  files.benchmarkRelease.publication?.qualityClaimAllowed === false &&
  files.benchmarkRelease.publication?.marketClaimAllowed === false &&
  files.benchmarkRelease.publication?.leaderboardEligible === false &&
  Array.isArray(files.benchmarkRelease.scorecardProofLevels) &&
  files.benchmarkRelease.scorecardProofLevels.includes("same-run-api-shape") &&
  !files.benchmarkRelease.scorecardProofLevels.includes("api-shape") &&
  benchmarkReleaseRows.length >= 3 &&
  benchmarkReleaseRows.every((release) =>
    release?.claimBoundary?.claimAllowed === false &&
    release?.claimBoundary?.qualityClaimAllowed === false &&
    release?.claimBoundary?.marketClaimAllowed === false &&
    release?.claimBoundary?.leaderboardEligible === false &&
    typeof release?.claimBoundary?.proof === "string" &&
    Array.isArray(release?.claimBoundary?.claimBlockers) &&
    release.claimBoundary.claimBlockers.length > 0
  );
const arenaRunnerChecksFailClosed = !files.arenaSource.includes("checksFromRunnerText") && !files.arenaSource.includes("haystack.includes") && files.arenaSource.includes("runnerSelfChecksIgnored") && files.arenaSource.includes("MEMORY_ARENA_JUDGE_COMMAND") && files.arenaSource.includes("runner supplied self-scored checks") && files.arenaSource.includes("this.runner.args ?? []") && files.arenaSource.includes("shell: this.runner.shell ?? true") && files.arenaSource.includes("timeoutMs") && files.arenaSource.includes("runnerDisabled") && files.arenaSource.includes("disabling runner for remaining scenarios");
const arenaQualityClaimBoundary = files.arenaSource.includes("MEMORY_ARENA_QUALITY_JUDGE_COMMAND") &&
  files.arenaSource.includes("cognibrain-arena-quality-llm-harness-judge-v1") &&
  files.arenaSource.includes("arena-local-scenario-diagnostic") &&
  files.arenaSource.includes("arena-report-llm-harness-judge") &&
  files.arenaSource.includes("qualityClaimAllowed") &&
  files.arenaSource.includes("marketClaimAllowed") &&
  files.arenaSource.includes("leaderboardEligible") &&
  files.arenaSource.includes("Market superiority remains blocked because Benchmark Arena is a synthetic diagnostic") &&
  files.publishArenaSource.includes("Arena claim allowed") &&
  files.publishArenaSource.includes("Arena claim blockers");
const arenaOpenAiJudgeStrict = files.arenaOpenAiJudge.includes("Do not trust runner-proposed checks") && files.arenaOpenAiJudge.includes("Do not use exact string overlap") && files.arenaOpenAiJudge.includes("must be a JSON boolean") && files.nativeCompetitorBenchmark.includes("arena-openai-judge.mjs");
const arenaRunnerContractRows = Array.isArray(files.arena.systems) ? files.arena.systems.filter((system) => system?.runner?.commandEnv || system?.runnerContract) : [];
const arenaBundledRunnersRawOnly = arenaRunnerContractRows.length > 0 && arenaRunnerContractRows.every((system) =>
  system.runnerContract?.rawEvidenceOnly === true &&
  system.runnerContract?.selfScoredChecksAllowed === false &&
  system.runnerContract?.scoreableChecksRequireJudge === true &&
  system.runnerContract?.judgeEnv === "MEMORY_ARENA_JUDGE_COMMAND" &&
  system.runnerContract?.judgeProtocol === "cognibrain-arena-llm-harness-judge-v1" &&
  system.runnerContract?.observedScenarioContracts === system.scenarioCount &&
  system.scenarios?.every((scenario) =>
    scenario.evidence?.runnerContract?.rawEvidenceOnly === true &&
    scenario.evidence?.runnerContract?.selfScoredChecksAllowed === false &&
    scenario.evidence?.runnerContract?.scoreableChecksRequireJudge === true
  )
);
const operatorMemoryNativeJudgeBoundary = files.operatorMemoryBenchmarkSource.includes("MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND") && files.operatorMemoryBenchmarkSource.includes("runnerSelfChecksIgnored") && files.operatorMemoryBenchmarkSource.includes("raw native evidence is unjudged") && files.operatorMemoryBenchmarkSource.includes("native/cloud artifact is unjudged") && files.operatorMemoryOpenAiJudge.includes("Do not trust runner-proposed checks") && files.operatorMemoryOpenAiJudge.includes("Do not use exact string overlap") && files.operatorMemoryOpenAiJudge.includes("must be a JSON boolean") && files.operatorMemoryNativeCompetitorBenchmark.includes("operator-memory-openai-judge.mjs");
const operatorMemoryRunnerContractRows = Array.isArray(files.operatorMemoryBenchmark.systems) ? files.operatorMemoryBenchmark.systems.filter((system) => system?.runner?.commandEnv || system?.runnerContract) : [];
const operatorMemoryNativeRunnerContractRows = Array.isArray(files.operatorMemoryNativeCompetitors.systems) ? files.operatorMemoryNativeCompetitors.systems.filter((system) => system?.runner?.commandEnv || system?.runnerContract) : [];
const operatorMemoryBundledRunnersRawOnly = operatorMemoryRunnerContractRows.length > 0 && operatorMemoryRunnerContractRows.every((system) =>
  system.runnerContract?.rawEvidenceOnly === true &&
  system.runnerContract?.selfScoredChecksAllowed === false &&
  system.runnerContract?.scoreableChecksRequireJudge === true &&
  system.runnerContract?.judgeEnv === "MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND" &&
  system.runnerContract?.judgeProtocol === "cognibrain-operator-memory-llm-harness-judge-v1" &&
  system.runnerContract?.observedScenarioContracts === system.scenarioCount &&
  system.scenarios?.every((scenario) =>
    scenario.evidence?.runnerContract?.rawEvidenceOnly === true &&
    scenario.evidence?.runnerContract?.selfScoredChecksAllowed === false &&
    scenario.evidence?.runnerContract?.scoreableChecksRequireJudge === true
  )
) && operatorMemoryNativeRunnerContractRows.length > 0 && operatorMemoryNativeRunnerContractRows.every((system) =>
  system.runnerContract?.rawEvidenceOnly === true &&
  system.runnerContract?.selfScoredChecksAllowed === false &&
  system.runnerContract?.scoreableChecksRequireJudge === true &&
  system.runnerContract?.judgeEnv === "MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND"
);
const operatorMemoryQualityClaimBoundary = files.operatorMemoryBenchmarkSource.includes("MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_COMMAND") && files.operatorMemoryBenchmarkSource.includes("operator-memory-quality-llm-harness-judge-v1") && files.operatorMemoryBenchmarkSource.includes("operator-memory-local-check-diagnostic") && files.operatorMemoryBenchmarkSource.includes("operator-memory-llm-harness-judge") && files.operatorMemoryBenchmarkSource.includes("Local operator-memory scenario checks are deterministic diagnostics only") && files.operatorMemoryBenchmarkSource.includes("Quality claims require") && files.operatorMemoryBenchmarkSource.includes("Do not rely on exact string overlap, check names, or runner-proposed scores");
const cognicodeArtifactRequiredProof = Array.isArray(files.cognicodeBench.methodology?.requiredExternalProofForQualityClaim) && files.cognicodeBench.methodology.requiredExternalProofForQualityClaim.includes("ablation baselines may simulate from visible repo metadata only; hidden expected commands and files stay evaluator-only");
const cognicodeArtifactBaselineBoundary = Array.isArray(files.cognicodeBench.baselines) && files.cognicodeBench.baselines.length > 0 && files.cognicodeBench.baselines.every((baseline) => Array.isArray(baseline.notes) && baseline.notes.some((note) => typeof note === "string" && note.includes("hidden expected commands/files are evaluator-only")));
const cognicodeArtifactAblationBoundary = files.cognicodeBench.ablation && Object.keys(files.cognicodeBench.ablation).filter((name) => name !== "cognibrain_full").every((name) => Array.isArray(files.cognicodeBench.ablation[name]?.notes) && files.cognicodeBench.ablation[name].notes.some((note) => typeof note === "string" && note.includes("hidden expected commands/files are evaluator-only")));
const cognicodeArtifactClaimBoundary = files.cognicodeBench.proof === "local-diagnostic" && files.cognicodeBench.qualityClaimAllowed === false && files.cognicodeBench.marketClaimAllowed === false && files.cognicodeBench.claimBoundary?.qualityClaimAllowed === false && files.cognicodeBench.claimBoundary?.marketClaimAllowed === false;
const cognicodeIntegrityMetrics = files.cognicodeBench.diagnostics?.integrity?.metrics ?? {};
const cognicodeArtifactPatchBoundary = cognicodeIntegrityMetrics.expectedDirectPatchHarness === false && Number.isFinite(cognicodeIntegrityMetrics.expectedLeakage) && Number.isFinite(cognicodeIntegrityMetrics.externalPatchHarnessRate) && Number.isFinite(cognicodeIntegrityMetrics.bestBaseline) && Number.isFinite(cognicodeIntegrityMetrics.fullScore);
const cognicodeHarnessContracts = files.cognicodeBench.harnessContracts ?? {};
const cognicodeQualityHarnessContract = cognicodeHarnessContracts.qualityJudge?.requiredForQualityClaim === true && cognicodeHarnessContracts.qualityJudge?.reportLevel === true && cognicodeHarnessContracts.qualityJudge?.semanticJudgeRequired === true && cognicodeHarnessContracts.qualityJudge?.strictJson === true && cognicodeHarnessContracts.qualityJudge?.failClosed === true && cognicodeHarnessContracts.qualityJudge?.forbidsStringRegexScoring === true;
const cognicodePatchHarnessContract = cognicodeHarnessContracts.patchProposal?.hiddenExpectedFieldsProvided === false && cognicodeHarnessContracts.patchProposal?.visibleRepoMetadataOnly === true && cognicodeHarnessContracts.patchProposal?.strictJson === true && cognicodeHarnessContracts.patchProposal?.failClosed === true;
const cognicodeAblationHarnessContract = cognicodeHarnessContracts.ablation?.patchSimulationUsesHiddenExpected === false && cognicodeHarnessContracts.ablation?.hiddenExpectedEvaluatorOnly === true;
const cognicodeArtifactHarnessContract = cognicodeQualityHarnessContract && cognicodePatchHarnessContract && cognicodeAblationHarnessContract;
const cognicodeArtifactBoundary = cognicodeArtifactRequiredProof && cognicodeArtifactBaselineBoundary && cognicodeArtifactAblationBoundary && cognicodeArtifactClaimBoundary && cognicodeArtifactPatchBoundary && cognicodeArtifactHarnessContract;
const cognicodeQualityClaimBoundary = cognicodeArtifactBoundary;
const externalBasicMemoryHeuristicsBounded = files.basicMemoryExternalRunner.includes("MEMORY_EXTERNAL_PUBLIC_JUDGE_COMMAND") && files.basicMemoryExternalRunner.includes('"qualityClaimAllowed"') && files.basicMemoryExternalRunner.includes('"heuristicDiagnostics"') && files.basicMemoryExternalRunner.includes("Diagnostic only. These values are produced by evidence-id, token, or substring heuristics") && files.basicMemoryExternalRunner.includes('"accuracy": None');
const marketGateClaimBoundary = files.marketGateSource.includes("diagnostic-public-benchmark-baseline") && files.marketGateSource.includes("claimAllowed") && files.marketGateSource.includes("claimBlockers") && files.marketGateSource.includes("local-diagnostic") && files.marketGateSource.includes("provider-evidence-support");
const syntheticEvaluationClaimBoundary = files.evaluationRunSource.includes("deterministic-expected-id-substring-diagnostic") && files.evaluationRunSource.includes("qualityClaimAllowed: false") && files.evaluationRunSource.includes("marketClaimAllowed: false") && files.evaluationRunSource.includes("Synthetic fixture expected-id substring scoring is diagnostic only") && files.leaderboardSource.includes("Not quality-claim eligible without LLM/harness or comparable public-benchmark proof");
const publicDatasetIdRecallBoundaries = files.locomoSource.includes("locomo-evidence-id-recall-diagnostic") && files.locomoSource.includes("qualityClaimAllowed: false") && files.locomoSource.includes("marketClaimAllowed: false") && files.longMemEvalSource.includes("longmemeval-answer-session-id-recall-diagnostic") && files.longMemEvalSource.includes("qualityClaimAllowed: false") && files.longMemEvalSource.includes("marketClaimAllowed: false") && files.marketGateSource.includes("Local evidence-id or deterministic recall reports are diagnostics only");
const beamClaimBoundary = files.beamSource.includes("beam-rubric-support-diagnostic") && files.beamSource.includes("qualityClaimAllowed") && files.beamSource.includes("marketClaimAllowed: false") && files.beamSource.includes("BEAM deterministic rubric/entity/evidence-support scoring is diagnostic only") && files.beamSource.includes("MEMORY_INTELLIGENCE_COMMAND") && files.beamSource.includes("report.passed || (!args.has(\"--strict\") && report.diagnosticPassed)") && docsContainAll([
  "BEAM raw artifacts now carry this boundary directly",
  "local BEAM rubric-support scoring is not quality or market proof",
  "`local-diagnostic`"
]);
const externalHardClaimBoundary = files.externalHardSource.includes("diagnostic-public-dataset-stress") && files.externalHardSource.includes("claimAllowed") && files.externalHardSource.includes("External-hard public dataset stress rows are diagnostics unless their child benchmark artifact carries LLM/harness") && files.externalHardSource.includes("Local evidence-id, session-id, deterministic or rubric recall wins") && files.externalHardSource.includes("scoreable && diagnosticPassed") && docsContainAll([
  "External-hard public dataset stress is diagnostic-only",
  "`claimAllowed=false`",
  "diagnostic retrieval stress rows"
]);
const nextgenLifecycleDiagnosticBoundary = files.nextgenBenchmarksSource.includes("local-lifecycle-diagnostic") && files.nextgenBenchmarksSource.includes("qualityClaimAllowed: false") && files.nextgenBenchmarksSource.includes("marketClaimAllowed: false") && files.nextgenBenchmarksSource.includes("deterministic-fixture-diagnostic") && files.nextgenBenchmarksSource.includes("structural-lifecycle-diagnostic") && files.nextgenBenchmarksSource.includes("harness-review-diagnostic") && files.leaderboardSource.includes("Not quality-claim eligible without LLM/harness or comparable public-benchmark proof") && docsContainAll([
  "`nextgen-benchmarks.json` lifecycle suite is also diagnostic-only",
  "`qualityClaimAllowed=false`",
  "`marketClaimAllowed=false`"
]);
const arenaPublishPublicGateBoundary = files.publishArenaSource.includes("claimAllowed") && files.publishArenaSource.includes("diagnosticPassed") && files.publishArenaSource.includes("claimBlockers") && files.publishArenaSource.includes("Public benchmark claim blockers") && files.publishArenaSource.includes("scoreable") && files.publishArenaSource.includes("local-diagnostic") && files.publishArenaSource.includes("systemClaimStatus") && files.publishArenaSource.includes("Synthetic Diagnostic Scorecard") && files.publishArenaSource.includes("Top diagnostic score") && files.publishArenaSource.includes("market and quality claims require publicBenchmarkGate.claimAllowed=true");
const benchmarkSvgClaimBoundary = files.benchmarkSvgSource.includes("publicClaimAllowed") && files.benchmarkSvgSource.includes("publicClaimDetail") && files.benchmarkSvgSource.includes("boundary-missing") && files.benchmarkSvgSource.includes("arenaProofDetail") && files.benchmarkSvgSource.includes("API-shape and blocked rows are diagnostic, not market proof") && files.benchmarkSvgSource.includes("Internal regression and ablation diagnostics") && files.benchmarkSvgSource.includes("Diagnostic rows are not quality or market proof unless LLM/harness claim status says so") && !files.benchmarkSvgSource.includes('row.label === "Cognibrain full"') && files.benchmarkSvg.includes("claim blocked") && files.benchmarkSvg.includes("diagnostic pass") && files.benchmarkSvg.includes("api-shape diagnostic") && files.benchmarkSvg.includes("not market proof") && files.benchmarkSvg.includes("ablation diagnostic") && files.benchmarkSvg.includes("internal diagnostic");
const leaderboardDiagnosticClaimsBounded = files.leaderboardSource.includes('"local-diagnostic"') && files.leaderboardSource.includes("claimAllowed") && files.leaderboardSource.includes("cannot allow quality claims") && files.leaderboardSource.includes('"llm-harness"') && files.leaderboardSource.includes('"public-benchmark"');
const leaderboardPublishClaimBoundary = files.publishLeaderboardSource.includes("cognibrain diagnostic leaderboard") && files.publishLeaderboardSource.includes("claimSummary") && files.publishLeaderboardSource.includes("diagnostic-publication") && files.publishLeaderboardSource.includes("Claim allowed:") && files.publishLeaderboardSource.includes("Diagnostic entries") && files.publishLeaderboardSource.includes("Diagnostic/claim score") && files.publishLeaderboardSource.includes("local diagnostic entries are not quality or market proof");
const answerGenerationNormalizeJudge = functionBody(files.answerGenerationSource, "normalizeJudge");
const answerGenerationJudgeStrict = answerGenerationNormalizeJudge.includes("passed must be a boolean") && answerGenerationNormalizeJudge.includes("score must be a finite 0..1 number") && !answerGenerationNormalizeJudge.includes("score >= 0.5");
const answerGenerationClaimBoundary = files.answerGenerationSource.includes("qualityClaimAllowed") && files.answerGenerationSource.includes("marketClaimAllowed: false") && files.answerGenerationSource.includes("judgeCommandConfigured") && files.answerGenerationSource.includes("blockedJudge") && files.answerGenerationSource.includes("deterministic-coverage-diagnostic") && files.answerGenerationSource.includes("external-llm-harness-judge") && files.answerGenerationSource.includes("Deterministic expected-term coverage is diagnostic only") && files.leaderboardSource.includes("dataset.qualityClaimAllowed === true && dataset.proof === \"llm-harness\"") && docsContainAll([
  "Answer-generation artifacts carry the same boundary",
  "configured judge-command failures fail closed",
  "`qualityClaimAllowed=true`"
]);
const honestDbBackedBoundary = docsContainAll([
  "MemoryRepository paths for SQLite and Postgres",
  "target database"
]);
const positiveOidcClaims = oidcVerifierPresent ? [] : findPositiveClaims(docsCorpus, [
  ["oidc-jwt-rbac", /\b(?:built-in|native|first-party|supports?)\b[^\n.]{0,80}\b(?:OIDC|JWT|RBAC)\b/i]
]);
const positiveOverclaims = findPositiveOverclaims(docsCorpus);
const runtimeStatus = runtimeStatusReport();
mkdirSync(join(root, "artifacts"), { recursive: true });
writeFileSync(join(root, "artifacts", "runtime-status.json"), `${JSON.stringify(runtimeStatus, null, 2)}\n`);

const packageFiles = new Set(Array.isArray(files.packageJson.files) ? files.packageJson.files : []);

const checks = [
  check("arena-cognibrain-full", "Cognibrain row is a real local full-system benchmark run.", cognibrainArena?.proofLevel === "same-run-full" && cognibrainArena?.adapterMode === "full-local", "fail", {
    artifact: "artifacts/arena/run.json",
    observed: `${cognibrainArena?.proofLevel ?? "missing"} / ${cognibrainArena?.adapterMode ?? "missing"}`
  }),
  check("arena-competitor-proof-boundary", "Checked artifacts contain bounded competitor rows; real runs, API-shape models and credential-blocked rows stay separated by proof level.", realCompetitors.length > 0 || apiShapeCompetitors.length > 0 || blockedCompetitors.length > 0, "fail", {
    artifact: "artifacts/arena/run.json",
    realCompetitorRuns: realCompetitors.map((system) => `${system.displayName ?? system.system}:${system.proofLevel}`),
    apiShapeCompetitors: apiShapeCompetitors.map((system) => system.displayName ?? system.system),
    blockedCompetitors: blockedCompetitors.map((system) => system.displayName ?? system.system)
  }),
  check("arena-proof-levels-known", "Every competitor row uses a known proof level.", unsupportedCompetitorLevels.length === 0, "fail", {
    unsupported: unsupportedCompetitorLevels.map((system) => `${system.displayName ?? system.system}:${system.proofLevel}`)
  }),
  check("arena-runner-judge-validated-checks", "Arena command runners fail closed unless a central LLM/harness judge validates raw runner evidence into strict boolean checks; runner self-checks are diagnostic only.", arenaRunnerChecksFailClosed, "fail", {
    source: "src/eval/arena.ts"
  }),
  check("benchmark-docs-boundary", "Benchmark docs explicitly separate full local proof from API-shape, native, cloud, CLI and vendor-certified rows.", docsContainAll([
    "This page records the current checked benchmark artifacts",
    "same-run-api-shape",
    "credential-blocked"
  ]), "fail", {
    docs: ["README.md", "docs/benchmarks.md", "docs/evidence.md"]
  }),
  check("realworld-benchmark-boundary", "Real-world benchmark protocol demotes current adapted/internal artifacts from comparative leaderboard evidence.", realworldAllClassified && realworldEligibleArtifacts.length === 0 && docsContainAll([
    "The real-world protocol currently classifies 0 checked artifacts as fair",
    "Cognibrain-shaped",
    "custom-adapter-diagnostic"
  ]), "fail", {
    artifact: "artifacts/realworld-benchmark-protocol.json",
    classifiedArtifacts: realworldArtifacts.map((artifact) => `${artifact.path}:${artifact.className}:${artifact.leaderboardEligible ? "eligible" : "not-eligible"}`),
    leaderboardEligibleArtifacts: realworldEligibleArtifacts
  }),
  check("realworld-blackbox-harness-proof", "Neutral real-world black-box harness has broad bucket coverage, retains raw outputs, latency/cost fields and refuses quality scoring without an LLM/harness judge.", realworldBlackboxHarnessReady && realworldBlackboxBlocked.length >= 5 && docsContainAll([
    "Real-World Black-Box Smoke",
    "at least 15 queries",
    "export-raw-outputs",
    "MEMORY_REALWORLD_JUDGE_COMMAND",
    "not scored",
    "diagnostics only"
  ]), "fail", {
    artifact: "artifacts/realworld-blackbox.json",
    manifestHash: files.realworldBlackbox.manifestHash,
    leaderboardEligible: files.realworldBlackbox.leaderboardEligible,
    llmOrHarnessJudged: files.realworldBlackbox.eligibilityGate?.llmOrHarnessJudged,
    judge: realworldBlackboxCognibrain?.judge,
    blockedSystems: realworldBlackboxBlocked.map((system) => system.system),
    cognibrainScore: realworldBlackboxCognibrain?.metrics?.score,
    rawOutputs: realworldBlackboxCognibrain?.rawOutputs?.length ?? 0
  }),
  check("realworld-blackbox-market-gate-strict", "Real-world leaderboard eligibility requires Cognibrain plus at least two judged original competitor same-run systems, so local baselines and single-opponent smokes cannot become market proof.", realworldBlackboxMarketGateStrict, "fail", {
    source: "src/eval/realworldBlackbox.ts"
  }),
  check("realworld-native-competitor-runner", "Real-world competitor mode attaches Basic Memory and LangMem original package runners to the same manifest while keeping raw-output diagnostics claim-blocked until an LLM/harness judge succeeds.", realworldNativeCompetitorPath, "fail", {
    source: "scripts/benchmark/benchmark-realworld-native-competitors.mjs",
    runners: ["scripts/benchmark/competitors/basic_memory_realworld_runner.py", "scripts/benchmark/competitors/langmem_realworld_runner.py"]
  }),
  check("realworld-native-original-raw-proof", "Real-world protocol surfaces the native original-package raw-output proof as same-manifest diagnostic evidence while blocking score, market and leaderboard claims until the shared LLM/harness judge succeeds.", realworldNativeOriginalRawProof, "fail", {
    artifact: "artifacts/realworld-native-competitors.json",
    protocolArtifact: realworldNativeProtocolArtifact,
    originalRawOutputRuns: files.realworldNativeCompetitors.originalRawOutputRuns ?? 0,
    judgeBlockedOriginalRuns: files.realworldNativeCompetitors.judgeBlockedOriginalRuns ?? 0
  }),
  check("realworld-central-judge-recompute", "Real-world external commands cannot self-certify quality metrics; raw outputs must be recomputed by the central LLM/harness judge and semantically inconsistent judge decisions fail closed.", realworldCentralJudgeRecompute, "fail", {
    source: "src/eval/realworldBlackbox.ts",
    tests: "tests/evaluation.test.ts"
  }),
  check("realworld-llm-judge-cost-accounting", "Real-world LLM judge quality claims fail closed unless scorer token usage, pricing and positive estimated cost are recorded by the central judge.", realworldLlmJudgeCostAccounting, "fail", {
    source: "src/eval/realworldBlackbox.ts",
    judge: "scripts/benchmark/realworld-openai-judge.mjs",
    tests: "tests/evaluation.test.ts"
  }),
  check("realworld-operational-weakness-reporting", "Real-world black-box results expose setup failure rate, raw-output coverage, raw error classes, bucket weakness rows, scorer cost and latency beside quality metrics.", realworldOperationalWeaknessReporting, "fail", {
    source: "src/eval/realworldBlackbox.ts",
    tests: "tests/evaluation.test.ts",
    artifact: "artifacts/realworld-blackbox.json",
    summary: files.realworldBlackbox?.operationalWeaknesses?.summary,
    rawErrorClasses: files.realworldBlackbox?.operationalWeaknesses?.rawErrorClasses?.map((item) => item.className)
  }),
  check("realworld-third-party-oss-workflows", "Real-world black-box coverage includes a third-party OSS workflow bucket sourced from public GitHub issues, and protocol evidence keeps those source URLs visible without allowing market claims.", realworldThirdPartyOssBucket, "fail", {
    source: "src/eval/realworldBlackbox.ts",
    tests: "tests/evaluation.test.ts",
    artifacts: ["artifacts/realworld-blackbox.json", "artifacts/realworld-benchmark-protocol.json"],
    events: realworldThirdPartyOssEvents.length,
    queries: realworldThirdPartyOssQueries.length,
    sources: protocolThirdPartyOssSources
  }),
  check("realworld-smoke-market-claim-boundary", "Real-world centrally judged small-manifest results may become comparative smoke only; market and leaderboard claims stay blocked until a larger third-party-sourced protocol with more original systems and preregistered cost/latency budgets exists.", realworldSmokeMarketBoundary, "fail", {
    source: "src/eval/realworldBlackbox.ts",
    tests: "tests/evaluation.test.ts"
  }),
  check("leaderboard-diagnostic-claim-boundary", "Public leaderboard artifacts mark local deterministic scores as diagnostic-only and allow claims only for LLM/harness or comparable public benchmark proof.", leaderboardDiagnosticClaimsBounded, "fail", {
    source: "src/eval/leaderboard.ts"
  }),
  check("leaderboard-publish-claim-boundary", "Public leaderboard publishing exposes claimAllowed, proofLevel and diagnostic entry counts in the first viewport instead of presenting local diagnostics as a market leaderboard.", leaderboardPublishClaimBoundary, "fail", {
    source: "src/eval/publishLeaderboard.ts"
  }),
  check("answer-generation-judge-contract", "External answer-generation judges fail closed unless score is finite 0..1 and passed is a strict boolean.", answerGenerationJudgeStrict, "fail", {
    source: "src/eval/answerGeneration.ts"
  }),
  check("answer-generation-claim-boundary", "Answer-generation artifacts expose deterministic coverage as diagnostic-only and fail closed when a configured LLM/harness judge command is invalid.", answerGenerationClaimBoundary, "fail", {
    source: "src/eval/answerGeneration.ts"
  }),
  check("arena-external-runner-judge-contract", "External Arena competitor runners cannot score themselves; native same-run outputs require an explicit LLM/harness judge command for scoreable checks.", arenaRunnerChecksFailClosed && arenaOpenAiJudgeStrict, "fail", {
    source: "src/eval/arena.ts",
    judge: "scripts/benchmark/arena-openai-judge.mjs"
  }),
  check("arena-quality-claim-boundary", "Benchmark Arena separates diagnostic pass from quality, market and leaderboard claims; report-level quality claims require an explicit LLM/harness judge and market claims remain blocked as synthetic diagnostics.", arenaQualityClaimBoundary, "fail", {
    source: "src/eval/arena.ts"
  }),
  check("arena-bundled-runner-raw-evidence-only", "Arena command-runner competitor rows emit raw evidence only and require the central LLM/harness judge before checks can score.", arenaBundledRunnersRawOnly, "fail", {
    artifact: "artifacts/arena/run.json",
    runnerSystems: arenaRunnerContractRows.map((system) => ({
      system: system.system,
      proofLevel: system.proofLevel,
      adapterMode: system.adapterMode,
      runner: system.runner,
      runnerContract: system.runnerContract
    }))
  }),
  check("operator-memory-native-judge-boundary", "Operator Memory native competitor runners cannot score themselves; same-run native/cloud outputs require an explicit LLM/harness judge command for scoreable source-aware checks.", operatorMemoryNativeJudgeBoundary, "fail", {
    source: "src/eval/operatorMemoryBenchmark.ts",
    judge: "scripts/benchmark/operator-memory-openai-judge.mjs"
  }),
  check("operator-memory-bundled-runner-raw-evidence-only", "Operator Memory native command-runner rows emit raw evidence only and require the central LLM/harness judge before source-aware checks can score.", operatorMemoryBundledRunnersRawOnly, "fail", {
    artifacts: ["artifacts/operator-memory-benchmark.json", "artifacts/operator-memory-native-competitors.json"],
    runnerSystems: operatorMemoryRunnerContractRows.map((system) => ({
      system: system.system,
      proofLevel: system.proofLevel,
      adapterMode: system.adapterMode,
      runner: system.runner,
      runnerContract: system.runnerContract
    }))
  }),
  check("operator-memory-quality-claim-boundary", "Operator Memory local source-aware checks remain diagnostic-only unless a report-level LLM/harness judge validates quality claims.", operatorMemoryQualityClaimBoundary, "fail", {
    source: "src/eval/operatorMemoryBenchmark.ts"
  }),
  check("cognicodebench-quality-claim-boundary", "CogniCodeBench local scenario, ablation and patch-proposal diagnostics remain claim-blocked unless a report-level LLM/harness judge validates quality; patch planning is separated from hidden expected actions and ablation simulations keep hidden expected commands/files evaluator-only.", cognicodeQualityClaimBoundary, "fail", {
    source: "src/eval/cognicodeBench.ts",
    artifact: "artifacts/cognicodebench/run.json",
    artifactBoundary: {
      requiredProof: cognicodeArtifactRequiredProof,
      baselineBoundary: cognicodeArtifactBaselineBoundary,
      ablationBoundary: cognicodeArtifactAblationBoundary,
      claimBoundary: cognicodeArtifactClaimBoundary,
      patchBoundary: cognicodeArtifactPatchBoundary,
      harnessContract: cognicodeArtifactHarnessContract,
      integrityMetrics: cognicodeIntegrityMetrics
    }
  }),
  check("external-basic-memory-score-boundary", "Basic Memory external public-dataset adapter keeps evidence-id/token/substr heuristics as diagnostics and requires an external LLM/harness judge before accuracy/delta become scoreable.", externalBasicMemoryHeuristicsBounded, "fail", {
    source: "scripts/benchmark/competitors/basic_memory_external_runner.py"
  }),
  check("market-gate-claim-boundary", "MarketGate keeps local public-dataset ID/recall victories diagnostic until included benchmark artifacts carry LLM/harness or comparable public-benchmark proof.", marketGateClaimBoundary, "fail", {
    source: "src/eval/marketGate.ts"
  }),
  check("synthetic-evaluation-claim-boundary", "Synthetic retrieval evaluation keeps expected-id substring scoring diagnostic-only and blocks quality or market claims without LLM/harness proof.", syntheticEvaluationClaimBoundary, "fail", {
    source: "src/eval/run.ts"
  }),
  check("public-dataset-id-recall-boundary", "LoCoMo and LongMemEval local public-dataset ID-recall reports expose diagnostic scores while blocking quality or market claims without LLM/harness or same-protocol public proof.", publicDatasetIdRecallBoundaries, "fail", {
    sources: ["src/eval/locomo.ts", "src/eval/longmemeval.ts", "src/eval/marketGate.ts"]
  }),
  check("beam-rubric-diagnostic-boundary", "BEAM deterministic rubric-support scoring is diagnostic-only and reserves passed quality claims for LLM/harness evidence-judge runs.", beamClaimBoundary, "fail", {
    source: "src/eval/beam.ts"
  }),
  check("external-hard-claim-boundary", "External-hard public dataset stress summaries keep local diagnostic wins separate from scoreable quality or market claims.", externalHardClaimBoundary, "fail", {
    source: "src/eval/externalHard.ts"
  }),
  check("nextgen-lifecycle-diagnostic-boundary", "Nextgen lifecycle benchmark suites expose deterministic/structural local checks as diagnostic-only and block quality or market claims without LLM/harness proof.", nextgenLifecycleDiagnosticBoundary, "fail", {
    source: "src/eval/nextgenBenchmarks.ts"
  }),
  check("arena-publish-public-gate-boundary", "Arena publishing surfaces public benchmark gate claimAllowed, diagnosticPassed, scoreable proof and claim blockers instead of displaying diagnostic scores as quality claims.", arenaPublishPublicGateBoundary, "fail", {
    source: "src/eval/publishArena.ts"
  }),
  check("benchmark-svg-claim-boundary", "Benchmark SVG surfaces proof and claim status for public dataset rows instead of displaying diagnostic bars as market or quality proof.", benchmarkSvgClaimBoundary, "fail", {
    source: "scripts/release/render-benchmark-svg.mjs",
    artifact: "docs/assets/benchmark-results.svg"
  }),
  check("connector-hermetic-drivers", "Connector registry has first-party driver and fixture coverage for the native connector set.", maturityRows.length >= 19 && hermeticRows.length >= 19, "fail", {
    artifact: "artifacts/connector-maturity.json",
    total: maturityRows.length,
    hermeticDrivers: hermeticRows.length
  }),
  check("connector-api-specs", "Connector drivers are checked against codified vendor API contracts for method, path, auth and writeback shape.", apiSpecRows.length >= 19 && apiSpecVerifiedRows.length >= 19 && files.vendorApiSpecs.passed === true, "fail", {
    artifact: "artifacts/vendor-api-specs.json",
    total: apiSpecRows.length,
    apiSpecVerified: apiSpecVerifiedRows.length
  }),
  check("connector-live-smoke", "Checked artifacts expose live-smoke-ready drivers while avoiding tenant certification claims without tenant credentials.", liveSmokeReadyRows.length >= 19 && liveSmokeRows.length === 0 && vendorLiveAttempted.length === 0, "fail", {
    artifact: "artifacts/vendor-live-smoke.json",
    liveRequested: Boolean(files.vendorLive.liveRequested),
    attempted: vendorLiveAttempted.map((provider) => provider.provider),
    liveSmokeReady: liveSmokeReadyRows.length,
    tenantVerified: liveSmokeRows.length
  }),
  check("connector-webhooks", "Priority webhook-capable connectors have hermetic signature, replay, normalization, sourceRef and review-queue proof.", webhookRows.length >= 10 && webhookRows.every((row) => row.passed === true) && webhookVerifiedRows.length >= 10, "fail", {
    artifact: "artifacts/connector-webhooks.json",
    webhookVerified: webhookVerifiedRows.map((row) => row.provider).filter((provider) => priorityWebhookProviders.has(provider))
  }),
  check("connector-docs-boundary", "Connector docs state the checked artifact level: live-smoke-ready drivers, API/spec verification, no tenant live-smoke, no production certification.", docsContainAll([
    "First-party connector definitions and drivers",
    "Credentialed live checks depend on tenant credentials",
    "connector reports under `artifacts/`"
  ]), "fail", {
    docs: ["README.md", "docs/integrations.md", "docs/status.md", "docs/evidence.md"]
  }),
  check("connector-transport-proof", "Connector transport proof covers retry/backoff, cursor pagination, transient failures and redaction.", files.connectorTransport.passed === true && files.connectorTransport.checks?.rateLimitBackoff === true && files.connectorTransport.checks?.cursorPagination === true && files.connectorTransport.checks?.transientRetry === true, "fail", {
    artifact: "artifacts/connector-transport.json"
  }),
  check("connector-quality-proof", "Connector semantic quality benchmark checks provider-specific Engineering Memory mapping and source quality.", files.connectorQuality.passed === true && qualityRows.length >= 19 && files.connectorQuality.summary?.checkedCases >= 19, "fail", {
    artifact: "artifacts/connector-quality.json",
    rows: qualityRows.length,
    checkedCases: files.connectorQuality.summary?.checkedCases ?? 0
  }),
  check("connector-certification-boundary", "Connector certification matrix exists and marks tenant certification as credential-blocked unless live tenant proof exists.", files.connectorCertification.passed === true && certificationRows.length >= 19 && certificationCredentialBlockedRows.length >= 19 && productionCertifiedRows.length === 0, "fail", {
    artifact: "artifacts/connector-certification.json",
    credentialBlocked: certificationCredentialBlockedRows.length,
    productionCertified: productionCertifiedRows.length
  }),
  check("status-matrix-current", "A current compact implementation status matrix exists with surface/state/evidence columns.", files.status.includes("| Surface | Current state | Evidence anchor |") && countStatusRows(files.status) >= 7 && files.readme.includes("docs/status.md") && files.docsHome.includes("status.md"), "fail", {
    docs: ["docs/status.md", "README.md", "docs/README.md"],
    rows: countStatusRows(files.status)
  }),
  check("runtime-status-artifact", "Runtime status is exported as an internal machine-readable artifact and kept out of the npm package.", runtimeStatus.summary.selfHostedCandidate === true && runtimeStatus.summary.productionCertified === false && runtimeStatus.rows.length >= 8 && !packageFiles.has("artifacts/runtime-status.json"), "fail", {
    artifact: "artifacts/runtime-status.json",
    selfHostedCandidate: runtimeStatus.summary.selfHostedCandidate,
    productionCertified: runtimeStatus.summary.productionCertified
  }),
  check("storage-boundary", "Storage docs and code identify DB-primary MemoryRepository persistence honestly while row-backed runtime writes avoid full-store persist reimports.", dbPrimaryStorage && noFullStoreImportOnPersist && dbPrimaryAliasesBypassLegacyPersistence && memoryRepositoryBoundary && dbRepositoryImplementations && honestDbBackedBoundary, "fail", {
    code: "src/api/persistence.ts",
    liveVerifier: "artifacts/postgres-live.json",
    postgresVerifierPassed,
    dbPrimaryStorage,
    noFullStoreImportOnPersist,
    dbPrimaryAliasesBypassLegacyPersistence,
    memoryRepositoryBoundary,
    dbRepositoryImplementations,
    hardWiredServiceStore,
    honestDbBackedBoundary
  }),
  check("api-auth-boundary", "Docs and code expose API-key auth plus optional JWT/OIDC verifier, actor scopes and route-level RBAC.", apiKeyAuthPresent && oidcVerifierPresent && positiveOidcClaims.length === 0 && docsContainAll([
    "JWT/OIDC verifier",
    "route-level RBAC",
    "actor scopes"
  ]), "fail", {
    code: "src/api/server.ts",
    oidcVerifierPresent,
    positiveOidcClaims
  }),
  check("policy-tenant-boundary", "Strict policy mode default-denies when no rule matches and docs keep target storage checks visible.", !defaultAllowPolicy && docsContainAll([
    "strict policy mode",
    "target database"
  ]), "fail", {
    code: "src/api/service.ts",
    defaultAllowPolicy
  }),
  check("positive-overclaim-scan", "Docs avoid positive production-certified, tenant-verified, managed-SaaS and DB-primary claims without matching artifacts.", positiveOverclaims.length === 0, "fail", {
    scannedDocs: ["README.md", "docs/README.md", "docs/install.md", "docs/integrations.md", "docs/operations.md", "docs/evidence.md", "docs/status.md"],
    matches: positiveOverclaims
  }),
  check("harness-maturity-proof", "Harness maturity artifact separates generated packages, native hooks, daemon-backed CLI lifecycle and simulator proof for common and external-agent modes without open implementation gaps.", harnessRows.length >= 16 && generatedHarnessRows.length >= 16 && harnessGoldenPaths.length >= 16 && harnessRowsWithGaps.length === 0 && docsContainAll([
    "Use MCP for MCP-native agents",
    "cognibrain harness",
    "SDK/HTTP for product integrations"
  ]), "fail", {
    artifact: "artifacts/harness-maturity.json",
    total: harnessRows.length,
    generated: generatedHarnessRows.length,
    goldenPaths: harnessGoldenPaths.length,
    rowsWithGaps: harnessRowsWithGaps.map((row) => row.harness)
  }),
  check("cli-operator-primary", "The installable CLI uses stable compact text surfaces without the removed Ink TUI dependency and stores memory-add provenance flags structurally instead of as raw content.", !files.packageJson.dependencies?.ink && !existsSync(join(root, "src", "cli", "inkApp.mjs")) && files.cli.includes("function renderPlainSurface") && files.cli.includes("clipText") && files.memoryCommands.includes("function parseAddInput") && files.memoryCommands.includes("Unknown memctl add option") && files.cliTests.includes("stores memory add CLI flags as structured provenance instead of raw content") && files.cliTests.includes('not.toContain("--source-kind")') && files.cliTests.includes("provenance.sourceRef"), "fail", {
    source: "bin/cognibrain.mjs",
    removed: ["animated terminal UI dependency", "src/cli/inkApp.mjs", "generated CLI screenshots"],
    structuredMemoryAdd: "src/cli/memctl/memoryCommands.ts"
  }),
  check("runtime-resource-footprint", "MCP, lifecycle and status runtime paths avoid heavyweight TSX/process fan-out by default, VSCode harness setup excludes generated benchmark/runtime directories from watchers, status exposes API/dashboard RSS and CPU, and reinstallable benchmark caches have a measured prune path.", files.cli.includes("lightweightMcpServer.mjs") && vscodeHeavyGeneratedExcludes && files.cli.includes("files.watcherExclude") && files.cli.includes("statusArgs.includes(\"--full\") ? await cliHomeData() : statusData()") && files.cli.includes("runNodeAndExit(\"bin/lib/lightweightMcpServer.mjs\"") && files.cli.includes("Server } from \"@modelcontextprotocol/sdk/server/index.js\"") && files.cli.includes("callOperation(\"memory.evidencePack\"") && files.cli.includes("function processResources") && files.cli.includes("rssMb") && files.cli.includes("cpuPercent") && files.cli.includes("api rss") && files.cli.includes("function resourcesCommand") && files.cli.includes("WORKSPACE_BENCHMARK_CACHE_TARGETS") && files.cli.includes("user-cache/native-runners") && files.cli.includes("--prune-benchmark-caches") && files.benchmarkCacheRoot.includes("COGNIBRAIN_BENCHMARK_CACHE_ROOT") && files.benchmarkCacheRoot.includes("Library\", \"Caches\", \"cognibrain") && files.cli.includes("runtime: \"built-node\"") && files.cli.includes("runtime: \"source-node-import-tsx\"") && files.cli.includes("processModel: \"single-process\"") && files.cli.includes("runtime: \"source-tsx-cli\"") && files.cli.includes("COGNIBRAIN_API_RUNTIME") && files.cli.includes("dist/api/server.mjs") && files.cli.includes("entryPoints: [resolve(root, \"src\", \"api\", \"server.ts\")]") && files.packageJson.scripts?.["build:api"] === "node scripts/runtime/build-api.mjs" && files.packageJson.scripts?.build?.includes("npm run build:api") && packageFiles.has("dist/api/") && files.cliTests.includes("status.runtime.api.resources.rssMb") && files.cliTests.includes("status.runtime.api.runtime") && files.cliTests.includes("prunes reinstallable benchmark caches") && files.cliTests.includes("COGNIBRAIN_BENCHMARK_CACHE_ROOT") && files.cliTests.includes("user-cache/native-runners"), "fail", {
    code: ["bin/lib/cliRuntime.mjs", "bin/lib/harnessRuntime.mjs", "bin/lib/lightweightMcpServer.mjs"],
    checks: [
      "default MCP uses lightweight JS daemon proxy",
      "local-direct TSX MCP remains explicit opt-in",
      "status uses lightweight runtime payload unless --full is requested",
      "build emits a packaged dist/api/server.mjs API bundle for low-RSS daemon starts",
      "local lifecycle API prefers the built Node server and falls back to single-process node --import tsx instead of the tsx CLI process fan-out",
      "runtime state records API runtime and process model for resource measurements",
      "status reports API/dashboard RSS and CPU for live runtime PIDs",
      "VSCode watcher/search excludes generated runtime and benchmark directories",
      "original/native benchmark package caches default to a user cache outside the VSCode workspace",
      "resources CLI measures and prunes reinstallable benchmark caches without deleting memory data"
    ],
    requiredHeavyGeneratedExcludes
  }),
  check("operator-os-proof", "The terminal operator OS maturity artifact covers memory, connectors, runtime, config, benchmarks, policy, retention, logs and docs.", files.operatorOs.passed === true && Array.isArray(files.operatorOs.rows) && files.operatorOs.rows.length >= 10, "fail", {
    artifact: "artifacts/operator-os-maturity.json",
    rows: files.operatorOs.rows?.length ?? 0
  }),
  check("benchmark-hardening-proof", "Benchmark hardening artifact pins CogniCodeBench scenarios with hashes, schema evidence, real-repo workflow fixtures and native competitor boundaries.", files.benchmarkHardening.passed === true && files.benchmarkHardening.dataset?.sha256?.length === 64 && files.benchmarkHardening.dataset?.scenarioCount >= 100, "fail", {
    artifact: "artifacts/benchmark-hardening.json",
    scenarioCount: files.benchmarkHardening.dataset?.scenarioCount ?? 0
  }),
  check("benchmark-release-claim-boundary", "Benchmark release manifests expose dataset identity and split metadata only; every split blocks quality, market and leaderboard claims until LLM/harness or comparable public proof exists.", benchmarkReleaseClaimBoundary, "fail", {
    artifact: "artifacts/public/cognicodebench-release.json",
    releases: benchmarkReleaseRows.map((release) => `${release.id}:${release.split}:${release.claimBoundary?.proof ?? "missing"}`),
    publication: files.benchmarkRelease.publication,
    scorecardProofLevels: files.benchmarkRelease.scorecardProofLevels
  }),
  check("dream-job-worker-proof", "Dream job worker lifecycle supports persisted start, status, cancel, retry and live source revalidation paths across service, HTTP, MCP and tests.", dreamJobWorkerControl && liveSourceRevalidation, "fail", {
    code: ["src/api/service.ts", "src/api/server/dreamRoutes.ts", "src/connectors/mcpTools.ts", "tests/core.test.ts"],
    dreamJobWorkerControl,
    liveSourceRevalidation
  }),
  check("docker-optional", "Docker is present only as an optional deployment artifact, not the required product path.", docsContainAll([
    "Docker is optional",
    "The CLI is the required control plane"
  ]) && !/Docker is required|docker compose is required|required Docker|required docker/i.test(docsCorpus), "fail", {
    packageIncludesDocker: Array.isArray(files.packageJson.files) && files.packageJson.files.includes("docker/")
  }),
  check("truth-artifacts-internal", "Generated truth, benchmark and connector artifacts are internal build outputs and are not packed into npm.", [
    "artifacts/arena/run.json",
    "artifacts/benchmark-hardening.json",
    "artifacts/cognicodebench/scenarios.json",
    "artifacts/connector-certification.json",
    "artifacts/connector-maturity.json",
    "artifacts/connector-quality.json",
    "artifacts/connector-transport.json",
    "artifacts/connector-webhooks.json",
    "artifacts/harness-maturity.json",
    "artifacts/product-truth-audit.json",
    "artifacts/realworld-benchmark-protocol.json",
    "artifacts/realworld-blackbox.json",
    "artifacts/realworld-blackbox-openai-intelligence.json",
    "artifacts/runtime-status.json",
    "artifacts/vendor-api-specs.json",
    "artifacts/vendor-live-smoke.json"
  ].every((path) => !packageFiles.has(path)), "fail", {
    packageFiles: Array.from(packageFiles).filter((path) => path.startsWith("artifacts/"))
  }),
  check("truth-gate-release", "Release and verification gates run the code-first product truth audit.", files.packageJson.scripts?.["internal"] === "node scripts/internal/run-task.mjs" && files.packageJson.scripts?.["verify:ci"]?.includes("verify:nextgen") && files.releaseCheck.includes("audit:truth") && files.internalRunner.includes("audit-product-truth.mjs"), "fail", {
    scripts: ["internal:audit:truth", "verify:ci", "release:check"]
  }),
  check("release-contract-proof", "Public API routes and CLI commands have machine-readable stability levels and release gates enforce the contract.", files.internalRunner.includes("releaseContract.ts") && files.internalRunner.includes("verify:nextgen") && files.internalRunner.includes("release:contract") && files.releaseCheck.includes("release:contract") && files.releaseContract.summary?.failed === 0 && files.releaseContract.summary?.apiRoutes >= 100 && files.releaseContract.summary?.memctlCommands >= 100, "fail", {
    script: "internal:release:contract",
    artifact: "artifacts/release-contract-audit.json",
    summary: files.releaseContract.summary
  }),
  check("gap-storage-db-primary", "DB-primary MemoryRepository with granular SQLite/Postgres writes is implemented.", !storageIsSnapshotFirst && memoryRepositoryBoundary && dbRepositoryImplementations && !hardWiredServiceStore, "gap", {
    code: "src/api/service.ts, src/core/storageAdapter.ts, src/api/repositories/",
    observed: dbPrimaryStorage && memoryRepositoryBoundary && dbRepositoryImplementations && !hardWiredServiceStore ? "repository boundary and db-primary SQLite/Postgres row repositories detected" : "runtime still lacks repository boundary or DB repository implementations",
    dbPrimaryStorage,
    memoryRepositoryBoundary,
    dbRepositoryImplementations,
    hardWiredServiceStore
  }),
  check("gap-enterprise-authz", "Built-in OIDC/JWT validation and route-level RBAC are implemented.", oidcVerifierPresent, "gap", {
    code: "src/api/server.ts",
    observed: oidcVerifierPresent ? "JWT/OIDC verifier and route-level RBAC detected" : apiKeyAuthPresent ? "API-key/Bearer auth only" : "no API auth verifier detected"
  }),
  check("gap-default-deny-policy", "Production default-deny policy mode is implemented.", !defaultAllowPolicy, "gap", {
    code: "src/api/service.ts",
    observed: defaultAllowPolicy ? "no matching policy rule allows by default" : "default deny detected"
  }),
  check("gap-http-hardening", "HTTP hardening has configured CORS, body limits and rate limits.", !corsWildcard && requestRateLimitPresent && bodyLimitPresent, "gap", {
    code: "src/api/server.ts",
    corsWildcard,
    requestRateLimitPresent,
    bodyLimitPresent
  }),
  check("gap-connector-certification", "Connector certification workflow is implemented; tenant production certification remains externally credential-gated.", files.connectorCertification.passed === true && certificationRows.length >= 19 && (certificationCredentialBlockedRows.length >= 19 || productionCertifiedRows.length > 0), "gap", {
    artifact: "artifacts/connector-certification.json",
    credentialBlocked: certificationCredentialBlockedRows.length,
    tenantVerified: liveSmokeRows.length,
    productionCertified: productionCertifiedRows.length
  })
];

const failures = checks.filter((item) => item.severity === "fail" && !item.passed);
const gaps = checks.filter((item) => item.severity === "gap" && !item.passed);
const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  mode: "code_truth_audit",
  passed: failures.length === 0,
  planComplete: gaps.length === 0,
  summary: {
    checks: checks.length,
    passed: checks.filter((item) => item.passed).length,
    failures: failures.length,
    openGaps: gaps.length,
    realCompetitorRuns: realCompetitors.length,
    apiShapeCompetitors: apiShapeCompetitors.length,
    blockedCompetitors: blockedCompetitors.length,
    nativeConnectorRows: maturityRows.length,
    hermeticDrivers: hermeticRows.length,
    liveSmokeReadyConnectors: liveSmokeReadyRows.length,
    apiSpecVerifiedConnectors: apiSpecVerifiedRows.length,
    tenantLiveSmokes: liveSmokeRows.length,
    productionCertifiedConnectors: productionCertifiedRows.length,
    connectorCertificationRows: certificationRows.length,
    connectorCredentialBlockedRows: certificationCredentialBlockedRows.length,
    webhookVerifiedConnectors: webhookVerifiedRows.length,
    generatedHarnesses: generatedHarnessRows.length,
    harnessGoldenPaths: harnessGoldenPaths.length,
    operatorCliStable: checks.find((item) => item.id === "cli-operator-primary")?.passed === true,
    dockerOptional: checks.find((item) => item.id === "docker-optional")?.passed === true,
    selfHostedCandidate: runtimeStatus.summary.selfHostedCandidate,
    productionCertified: runtimeStatus.summary.productionCertified,
    dbPrimaryStorage,
    memoryRepositoryBoundary,
    hardWiredServiceStore,
    builtInOidcRbac: runtimeStatus.summary.builtInOidcRbac,
    defaultDenyPolicy: runtimeStatus.summary.defaultDenyPolicy,
    httpHardened: runtimeStatus.summary.httpHardened,
    realWorldLeaderboardEligibleArtifacts: realworldEligibleArtifacts.length,
    realWorldBlackboxBlockedSystems: realworldBlackboxBlocked.length,
    realWorldBlackboxJudgeBlocked: realworldBlackboxJudgeBlocked,
    realWorldThirdPartyOssEvents: realworldThirdPartyOssEvents.length,
    realWorldThirdPartyOssQueries: realworldThirdPartyOssQueries.length
  },
  truthTuples: [
    ["arena.cognibrain.proof", cognibrainArena?.proofLevel ?? "missing", "artifacts/arena/run.json"],
    ["arena.competitors.realRuns", realCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.apiShape", apiShapeCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.credentialBlocked", blockedCompetitors.length, "artifacts/arena/run.json"],
    ["benchmarks.realworld.leaderboardEligible", realworldEligibleArtifacts.length, "artifacts/realworld-benchmark-protocol.json"],
    ["benchmarks.realworld.blackboxBlocked", realworldBlackboxBlocked.length, "artifacts/realworld-blackbox.json"],
    ["benchmarks.realworld.qualityJudge", realworldBlackboxJudgeBlocked ? "missing-blocks-quality-claim" : realworldBlackboxCognibrain?.judge?.kind ?? "missing", "artifacts/realworld-blackbox.json"],
    ["benchmarks.realworld.thirdPartyOssEvents", realworldThirdPartyOssEvents.length, "artifacts/realworld-blackbox.json"],
    ["connectors.hermeticDrivers", hermeticRows.length, "artifacts/connector-maturity.json"],
    ["connectors.liveSmokeReady", liveSmokeReadyRows.length, "artifacts/connector-maturity.json"],
    ["connectors.apiSpecVerified", apiSpecVerifiedRows.length, "artifacts/vendor-api-specs.json"],
    ["connectors.certificationRows", certificationRows.length, "artifacts/connector-certification.json"],
    ["connectors.credentialBlocked", certificationCredentialBlockedRows.length, "artifacts/connector-certification.json"],
    ["connectors.tenantLiveSmokes", liveSmokeRows.length, "artifacts/vendor-live-smoke.json"],
    ["connectors.productionCertified", productionCertifiedRows.length, "artifacts/connector-maturity.json"],
    ["connectors.webhookVerified", webhookVerifiedRows.length, "artifacts/connector-webhooks.json"],
    ["harness.generated", generatedHarnessRows.length, "artifacts/harness-maturity.json"],
    ["harness.goldenPaths", harnessGoldenPaths.length, "artifacts/harness-maturity.json"],
    ["cli.surface", "stable-operator-cli", "bin/cognibrain.mjs"],
    ["runtime.selfHostedCandidate", runtimeStatus.summary.selfHostedCandidate, "artifacts/runtime-status.json"],
    ["runtime.certified", runtimeStatus.summary.productionCertified, "artifacts/runtime-status.json"],
    ["storage.mode", dbPrimaryStorage && memoryRepositoryBoundary && !hardWiredServiceStore ? "repository-db-primary" : dbPrimaryStorage ? "db-primary-projection" : storageIsSnapshotFirst ? "snapshot-first" : "unknown", "src/api/persistence.ts"],
    ["auth.mode", oidcVerifierPresent ? "oidc-jwt-rbac" : "api-key-or-open-local", "src/api/server.ts"],
    ["policy.default", defaultAllowPolicy ? "allow" : "deny", "src/api/service.ts"],
    ["docker.role", "optional", "docs/install.md"]
  ],
  checks,
  openGaps: gaps.map((item) => ({
    id: item.id,
    message: item.message,
    evidence: item.evidence
  }))
};

mkdirSync(dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);

for (const item of checks) {
  const state = item.passed ? "ok" : item.severity === "gap" ? "GAP" : "FAIL";
  console.log(`${state} ${item.id} - ${item.message}`);
}

console.log(`product truth audit ${report.passed ? "passed" : "failed"}: ${report.summary.passed}/${checks.length} checks, ${report.summary.openGaps} open implementation gaps`);
if (!report.passed) process.exit(1);

function check(id, message, assertion, severity, evidence = {}) {
  return { id, message, passed: Boolean(assertion), severity, evidence };
}

function docsContainAll(needles) {
  return needles.every((needle) => docsCorpus.includes(needle));
}

function countStatusRows(content) {
  return content.split(/\r?\n/).filter((line) => /^\| [A-Za-z0-9]/.test(line) && !line.startsWith("| Feature |")).length;
}

function findPositiveOverclaims(content) {
  const patterns = [
    ["production-certified-connectors", /\bproduction[- ]certified connectors?\b/i],
    ["tenant-verified-live-smokes", /\btenant[- ]verified live smokes?\b/i],
    ["managed-saas", /\bmanaged SaaS\b/i],
    ...(!dbPrimaryStorage ? [["db-primary", /\bDB-primary\b/i]] : [])
  ];
  return findPositiveClaims(content, patterns);
}

function findPositiveClaims(content, patterns) {
  const safeBoundary = /\b(?:not|no|0|does not|do not|future|gap|require|requires|required|unless|boundary|non-claims|not claimed|false|without)\b/i;
  return content
    .split(/\r?\n/)
    .flatMap((line, lineIndex) =>
      patterns
        .filter(([, pattern]) => pattern.test(line) && !safeBoundary.test(line))
        .map(([id]) => ({ id, line: lineIndex + 1, text: line.trim().slice(0, 180) }))
    );
}

function runtimeStatusReport() {
  const rows = [
    readinessRow("CLI", "Stable operator CLI and operator OS maturity artifact implemented", "status/proof/config/policy/retention commands", "Primary operator workbench", "n/a", "tests/cli.test.ts, tests/evaluation.test.ts", "bin/cognibrain.mjs, artifacts/operator-os-maturity.json", "self-hosted operator candidate", "Command-backed terminal paths are covered; commercial Operator UI remains optional."),
    readinessRow("Memory API and MCP", "Service, HTTP API, MCP server and SDK clients exist", "broad route surface with route-level RBAC", "memory/proof/status commands", "memory_context_pack, coding context, action guard, patch evidence", "tests/api.test.ts, tests/core.test.ts", "docs/reference.md", "local/team/enterprise-auth candidate", "JWT/OIDC verifier is optional and must be configured per deployment."),
    readinessRow("Storage", dbPrimaryStorage && memoryRepositoryBoundary && !hardWiredServiceStore ? "MemoryRepository runtime boundary with granular DB row upserts" : dbPrimaryStorage ? "DB row persistence detected, runtime repository boundary incomplete" : "DB-primary repository not detected", "storage reports and Postgres verifier", "connection adapters", "n/a", "tests/core.test.ts, src/eval/postgresLive.ts", "artifacts/postgres-live.json", dbPrimaryStorage && memoryRepositoryBoundary && !hardWiredServiceStore ? "production storage candidate" : "production gap", "Snapshots are backup/compaction artifacts, not the primary write path."),
    readinessRow("Security/Auth", oidcVerifierPresent ? "API keys plus optional JWT/OIDC verifier, actor scopes and RBAC" : "No JWT/OIDC verifier detected", "/health open, other routes protected by configured auth", "doctor/status", "agent tools inherit the API boundary", "tests/api.test.ts", "src/api/server.ts", oidcVerifierPresent ? "enterprise auth candidate" : "production gap", "Deployments still own issuer/audience/key configuration and TLS."),
    readinessRow("Policy/Tenant Isolation", defaultAllowPolicy ? "Policy engine exists, default allow without matching rule" : "Production policy mode default-denies", "policy evaluation routes", "policy and retention commands", "context pack policy decisions", "tests/core.test.ts", "src/api/service.ts", defaultAllowPolicy ? "production gap" : "production policy candidate", "DB-level row isolation is deployment-specific; service-level actor binding is implemented."),
    readinessRow("Connectors", `${maturityRows.length} connector rows, ${apiSpecVerifiedRows.length} API/spec verified, ${certificationRows.length} certification rows`, "connector sync/poll/writeback", "connections and connector commands", "connector actions through API/SDK", "tests/evaluation.test.ts", "artifacts/connector-certification.json", `${liveSmokeRows.length} tenant-verified, ${productionCertifiedRows.length} production-certified, ${certificationCredentialBlockedRows.length} credential-blocked`, "Native driver and implementation-ready certification do not equal customer production certification."),
    readinessRow("Harness Integrations", `${generatedHarnessRows.length} generated packages`, "HTTP fallback for non-MCP helpers", "config all/config refresh", `${harnessRows.filter((row) => row?.maturity?.mcp === true).length} MCP-capable targets`, "tests/cli.test.ts", "artifacts/harness-maturity.json", "generated plus simulator proof", "Vendor-native hooks are claimed only where a row proves them."),
    readinessRow("Benchmarks", "CogniCodeBench and Arena tooling plus hardening artifact exist", "publishable artifacts", "benchmark/proof commands", "n/a", "tests/evaluation.test.ts", "artifacts/benchmark-hardening.json", "immutable synthetic dataset plus public workflow fixtures", "Synthetic/API-shape rows are not vendor certification or field proof."),
    readinessRow("Operations", "Release check, doctor, services and optional Docker exist", "status, metrics and health routes", "service plan/install/status", "maintenance tools", "release:check", "artifacts/release-check.json", "self-hosted production candidate", "Managed SaaS, autoscaling, billing and hosted support are not claimed.")
  ];
  const criticalOpenGaps = [
    (!dbPrimaryStorage || !memoryRepositoryBoundary || hardWiredServiceStore) && "db-primary-storage",
    !oidcVerifierPresent && "oidc-jwt-rbac",
    defaultAllowPolicy && "default-deny-policy",
    corsWildcard && "configured-cors",
    !requestRateLimitPresent && "rate-limit",
    !bodyLimitPresent && "body-limit",
    files.connectorCertification.passed !== true && "connector-certification-workflow",
    files.operatorOs.passed !== true && "operator-os-maturity",
    files.benchmarkHardening.passed !== true && "benchmark-hardening"
  ].filter(Boolean);
  const externalBlockedGaps = [
    liveSmokeRows.length === 0 && "tenant-verified-connectors",
    productionCertifiedRows.length === 0 && "production-certified-connectors",
    productionCertifiedRows.length === 0 && "managed-production-certification"
  ].filter(Boolean);
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "runtime_status",
    summary: {
      selfHostedCandidate: true,
      productionCertified: criticalOpenGaps.length === 0 && externalBlockedGaps.length === 0,
      dbPrimaryStorage,
      memoryRepositoryBoundary,
      hardWiredServiceStore,
      builtInOidcRbac: oidcVerifierPresent,
      defaultDenyPolicy: !defaultAllowPolicy,
      httpHardened: !corsWildcard && requestRateLimitPresent && bodyLimitPresent,
      tenantVerifiedConnectors: liveSmokeRows.length,
      productionCertifiedConnectors: productionCertifiedRows.length,
      connectorCredentialBlockedRows: certificationCredentialBlockedRows.length,
      externalBlockedGaps,
      criticalOpenGaps
    },
    rows
  };
}

function readinessRow(feature, code, api, cliTui, mcp, tests, artifact, productionState, claimBoundary) {
  return { feature, code, api, cliTui, mcp, tests, artifact, productionState, claimBoundary };
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open, index + 1);
  }
  return source.slice(open);
}

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
}

function readMany(paths) {
  return paths.map((path) => read(path)).join("\n\n");
}

function readJson(path, fallback) {
  try {
    const fullPath = join(root, path);
    if (!existsSync(fullPath)) return fallback;
    return JSON.parse(readFileSync(fullPath, "utf8"));
  } catch {
    return fallback;
  }
}
