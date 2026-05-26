#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
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
  harnessMaturity: readJson("artifacts/harness-maturity.json", { rows: [], summary: {} }),
  vendorApiSpecs: readJson("artifacts/vendor-api-specs.json", { rows: [], summary: {} }),
  vendorLive: readJson("artifacts/vendor-live-smoke.json", { liveRequested: false, writebackEnabled: false, providers: [] }),
  postgresLive: readJson("artifacts/postgres-live.json", { acceptance: {} }),
  releaseCheck: read("scripts/release-check.mjs"),
  cli: read("bin/cognibrain.mjs"),
  server: read("src/api/server.ts"),
  service: read("src/api/service.ts"),
  persistence: read("src/api/persistence.ts"),
  readme: read("README.md"),
  docsHome: read("docs/README.md"),
  install: read("docs/install.md"),
  benchmarks: read("docs/benchmarks.md"),
  integrations: read("docs/integrations.md"),
  operations: read("docs/operations.md"),
  claims: read("docs/claims.md"),
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
const hermeticRows = maturityRows.filter((row) => row?.maturity?.hermeticFixture === true && row?.maturity?.apiSpec === true);
const liveSmokeReadyRows = maturityRows.filter((row) => ["live-smoke-ready", "tenant-verified", "production-certified"].includes(row?.proofLevel));
const apiSpecVerifiedRows = maturityRows.filter((row) => row?.maturity?.apiSpec === true);
const vendorLiveProviders = Array.isArray(files.vendorLive.providers) ? files.vendorLive.providers : [];
const vendorLiveAttempted = vendorLiveProviders.filter((provider) => provider && provider.skipped === false);
const storageIsSnapshotFirst = files.persistence.includes("insert into cognibrain_snapshots") && files.persistence.includes("truncate table cognibrain_context_packs");
const dbPrimaryStorage = !storageIsSnapshotFirst && files.persistence.includes("DB-primary repository") && files.persistence.includes("memory.created") && files.persistence.includes("memory.updated") && files.persistence.includes("memory.deleted");
const postgresVerifierPassed = files.postgresLive?.acceptance?.startsWithPostgresBackend === true;
const oidcVerifierPresent = /\bjwks\b|\bopenid-client\b|\bjose\b|verifyJwt|verifyOidc|issuer.+audience/i.test(files.server);
const apiKeyAuthPresent = files.server.includes("MEMORY_API_KEYS") && files.server.includes("Bearer");
const defaultAllowPolicy = files.service.includes('const allowed = decisive ? decisive.effect === "allow" : true');
const corsWildcard = files.server.includes('Access-Control-Allow-Origin", "*"');
const requestRateLimitPresent = /rateLimit|rate limit|429|too_many_requests/i.test(files.server);
const bodyLimitPresent = /bodyLimit|maxBody|payload too large|413/i.test(files.server);
const docsCorpus = [files.readme, files.docsHome, files.install, files.benchmarks, files.integrations, files.operations, files.claims, files.status, files.sameBenchmark].join("\n\n");
const positiveOidcClaims = oidcVerifierPresent ? [] : findPositiveClaims(docsCorpus, [
  ["oidc-jwt-rbac", /\b(?:built-in|native|first-party|supports?)\b[^\n.]{0,80}\b(?:OIDC|JWT|RBAC)\b/i]
]);
const positiveOverclaims = findPositiveOverclaims(docsCorpus);
const productionReadiness = productionReadinessReport();
mkdirSync(join(root, "artifacts"), { recursive: true });
writeFileSync(join(root, "artifacts", "production-readiness.json"), `${JSON.stringify(productionReadiness, null, 2)}\n`);

const screenshotAssets = ["cli-home.svg", "cli-connections.svg", "cli-service.svg", "cli-config.svg", "cli-sdk.svg"].filter((file) => existsSync(join(root, "docs", "assets", file)));
const packageFiles = new Set(Array.isArray(files.packageJson.files) ? files.packageJson.files : []);

const checks = [
  check("arena-cognibrain-full", "Cognibrain row is a real local full-system benchmark run.", cognibrainArena?.proofLevel === "same-run-full" && cognibrainArena?.adapterMode === "full-local", "fail", {
    artifact: "artifacts/arena/run.json",
    observed: `${cognibrainArena?.proofLevel ?? "missing"} / ${cognibrainArena?.adapterMode ?? "missing"}`
  }),
  check("arena-competitor-real-runs", "Checked artifacts contain at least one real competitor system run; other competitors remain modeled or credential-blocked unless their proof level says otherwise.", realCompetitors.length > 0, "gap", {
    artifact: "artifacts/arena/run.json",
    realCompetitorRuns: realCompetitors.map((system) => `${system.displayName ?? system.system}:${system.proofLevel}`),
    apiShapeCompetitors: apiShapeCompetitors.map((system) => system.displayName ?? system.system)
  }),
  check("arena-proof-levels-known", "Every competitor row uses a known proof level.", unsupportedCompetitorLevels.length === 0, "fail", {
    unsupported: unsupportedCompetitorLevels.map((system) => `${system.displayName ?? system.system}:${system.proofLevel}`)
  }),
  check("benchmark-docs-boundary", "Benchmark docs explicitly separate full local proof from API-shape, native, cloud, CLI and vendor-certified rows.", docsContainAll([
    "Generated proof outputs are internal build artifacts",
    "same-run-api-shape",
    "API-shape rows are compatibility models"
  ]), "fail", {
    docs: ["README.md", "docs/benchmarks.md", "docs/claims.md"]
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
    "Native connector drivers exist",
    "0 tenant-verified live smokes",
    "0 production certifications"
  ]), "fail", {
    docs: ["README.md", "docs/integrations.md", "docs/status.md", "docs/claims.md"]
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
  check("status-matrix-current", "A current compact implementation status matrix exists with feature/state/verification/boundary columns.", files.status.includes("| Feature | Current state | Verification | Claim boundary |") && countStatusRows(files.status) >= 8 && files.readme.includes("docs/status.md") && files.docsHome.includes("status.md"), "fail", {
    docs: ["docs/status.md", "README.md", "docs/README.md"],
    rows: countStatusRows(files.status)
  }),
  check("production-readiness-artifact", "Production readiness is exported as an internal machine-readable artifact and kept out of the npm package.", productionReadiness.summary.selfHostedCandidate === true && productionReadiness.summary.productionCertified === false && productionReadiness.rows.length >= 8 && !packageFiles.has("artifacts/production-readiness.json"), "fail", {
    artifact: "artifacts/production-readiness.json",
    selfHostedCandidate: productionReadiness.summary.selfHostedCandidate,
    productionCertified: productionReadiness.summary.productionCertified
  }),
  check("storage-boundary", "Storage docs and code identify DB-primary row persistence with snapshots as backup/compaction.", dbPrimaryStorage && postgresVerifierPassed && docsContainAll([
    "DB-primary row persistence",
    "Snapshots are retained only as backup/compaction artifacts"
  ]), "fail", {
    code: "src/api/persistence.ts",
    verifier: "artifacts/postgres-live.json",
    postgresVerifierPassed,
    dbPrimaryStorage
  }),
  check("api-auth-boundary", "Docs and code expose API-key auth plus optional JWT/OIDC verifier, actor-bound scopes and route-level RBAC.", apiKeyAuthPresent && oidcVerifierPresent && positiveOidcClaims.length === 0 && docsContainAll([
    "JWT/OIDC verifier",
    "route-level RBAC",
    "actor-bound scopes"
  ]), "fail", {
    code: "src/api/server.ts",
    oidcVerifierPresent,
    positiveOidcClaims
  }),
  check("policy-tenant-boundary", "Production policy mode default-denies when no rule matches and docs keep DB-level isolation boundaries visible.", !defaultAllowPolicy && docsContainAll([
    "Production policy mode default-denies",
    "DB-level row isolation is still deployment-specific"
  ]), "fail", {
    code: "src/api/service.ts",
    defaultAllowPolicy
  }),
  check("positive-overclaim-scan", "Docs avoid positive production-certified, tenant-verified, managed-SaaS and DB-primary claims without matching artifacts.", positiveOverclaims.length === 0, "fail", {
    scannedDocs: ["README.md", "docs/README.md", "docs/install.md", "docs/integrations.md", "docs/operations.md", "docs/claims.md", "docs/status.md"],
    matches: positiveOverclaims
  }),
  check("harness-maturity-proof", "Harness maturity artifact separates generated packages, native hooks and simulator proof for common and external-agent modes.", harnessRows.length >= 16 && generatedHarnessRows.length >= 16 && harnessGoldenPaths.length >= 16 && docsContainAll([
    "MCP is the default integration path for agents",
    "SDK/HTTP is for custom integrations"
  ]), "fail", {
    artifact: "artifacts/harness-maturity.json",
    total: harnessRows.length,
    generated: generatedHarnessRows.length,
    goldenPaths: harnessGoldenPaths.length
  }),
  check("cli-ink-primary", "The installable CLI has Ink/React dependencies, CLI render paths and checked screenshot assets.", Boolean(files.packageJson.dependencies?.ink) && files.cli.includes("await import(\"ink\")") && files.cli.includes("case \"proof\"") && screenshotAssets.length >= 5, "fail", {
    source: "bin/cognibrain.mjs",
    screenshots: screenshotAssets.length
  }),
  check("operator-os-proof", "The terminal operator OS maturity artifact covers memory, connectors, runtime, config, benchmarks, policy, retention, logs and docs.", files.operatorOs.passed === true && Array.isArray(files.operatorOs.rows) && files.operatorOs.rows.length >= 10, "fail", {
    artifact: "artifacts/operator-os-maturity.json",
    rows: files.operatorOs.rows?.length ?? 0
  }),
  check("benchmark-hardening-proof", "Benchmark hardening artifact pins CogniCodeBench scenarios with hashes, schema evidence, real-repo workflow fixtures and native competitor boundaries.", files.benchmarkHardening.passed === true && files.benchmarkHardening.dataset?.sha256?.length === 64 && files.benchmarkHardening.dataset?.scenarioCount >= 100, "fail", {
    artifact: "artifacts/benchmark-hardening.json",
    scenarioCount: files.benchmarkHardening.dataset?.scenarioCount ?? 0
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
    "artifacts/production-readiness.json",
    "artifacts/vendor-api-specs.json",
    "artifacts/vendor-live-smoke.json"
  ].every((path) => !packageFiles.has(path)), "fail", {
    packageFiles: Array.from(packageFiles).filter((path) => path.startsWith("artifacts/"))
  }),
  check("truth-gate-release", "Release and verification gates run the code-first product truth audit.", files.packageJson.scripts?.["audit:truth"] === "node scripts/audit-product-truth.mjs" && files.packageJson.scripts?.["verify:nextgen"]?.includes("audit:truth") && files.releaseCheck.includes("audit:truth"), "fail", {
    scripts: ["audit:truth", "verify:nextgen", "release:check"]
  }),
  check("gap-storage-db-primary", "DB-primary MemoryRepository with granular writes is implemented.", !storageIsSnapshotFirst, "gap", {
    code: "src/api/persistence.ts",
    observed: dbPrimaryStorage ? "db-primary row persistence detected" : "snapshot-first persistence plus SQL projection"
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
    cliScreenshots: screenshotAssets.length,
    dockerOptional: checks.find((item) => item.id === "docker-optional")?.passed === true,
    selfHostedCandidate: productionReadiness.summary.selfHostedCandidate,
    productionCertified: productionReadiness.summary.productionCertified,
    dbPrimaryStorage,
    builtInOidcRbac: productionReadiness.summary.builtInOidcRbac,
    defaultDenyPolicy: productionReadiness.summary.defaultDenyPolicy,
    httpHardened: productionReadiness.summary.httpHardened
  },
  truthTuples: [
    ["arena.cognibrain.proof", cognibrainArena?.proofLevel ?? "missing", "artifacts/arena/run.json"],
    ["arena.competitors.realRuns", realCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.apiShape", apiShapeCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.credentialBlocked", blockedCompetitors.length, "artifacts/arena/run.json"],
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
    ["cli.inkScreenshots", screenshotAssets.length, "docs/assets/cli-*.svg"],
    ["production.selfHostedCandidate", productionReadiness.summary.selfHostedCandidate, "artifacts/production-readiness.json"],
    ["production.certified", productionReadiness.summary.productionCertified, "artifacts/production-readiness.json"],
    ["storage.mode", dbPrimaryStorage ? "db-primary" : storageIsSnapshotFirst ? "snapshot-first" : "unknown", "src/api/persistence.ts"],
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

function productionReadinessReport() {
  const rows = [
    readinessRow("CLI/TUI", "Ink CLI and operator OS maturity artifact implemented", "status/proof/config/policy/retention commands", "Primary operator workbench", "n/a", "tests/cli.test.ts, tests/evaluation.test.ts", "docs/assets/cli-*.svg, artifacts/operator-os-maturity.json", "self-hosted operator candidate", "Command-backed terminal paths are covered; browser dashboard remains optional."),
    readinessRow("Memory API and MCP", "Service, HTTP API, MCP server and SDK clients exist", "broad route surface with route-level RBAC", "memory/proof/status commands", "memory_context_pack, coding context, action guard, patch evidence", "tests/api.test.ts, tests/core.test.ts", "docs/reference.md", "local/team/enterprise-auth candidate", "JWT/OIDC verifier is optional and must be configured per deployment."),
    readinessRow("Storage", dbPrimaryStorage ? "DB-primary repository with granular row upserts" : "DB-primary repository not detected", "storage reports and Postgres verifier", "connection adapters", "n/a", "tests/core.test.ts, src/eval/postgresLive.ts", "artifacts/postgres-live.json", dbPrimaryStorage ? "production storage candidate" : "production gap", "Snapshots are backup/compaction artifacts, not the primary write path."),
    readinessRow("Security/Auth", oidcVerifierPresent ? "API keys plus optional JWT/OIDC verifier, actor scopes and RBAC" : "No JWT/OIDC verifier detected", "/health open, other routes protected by configured auth", "doctor/status", "agent tools inherit the API boundary", "tests/api.test.ts", "src/api/server.ts", oidcVerifierPresent ? "enterprise auth candidate" : "production gap", "Deployments still own issuer/audience/key configuration and TLS."),
    readinessRow("Policy/Tenant Isolation", defaultAllowPolicy ? "Policy engine exists, default allow without matching rule" : "Production policy mode default-denies", "policy evaluation routes", "policy and retention commands", "context pack policy decisions", "tests/core.test.ts", "src/api/service.ts", defaultAllowPolicy ? "production gap" : "production policy candidate", "DB-level row isolation is deployment-specific; service-level actor binding is implemented."),
    readinessRow("Connectors", `${maturityRows.length} connector rows, ${apiSpecVerifiedRows.length} API/spec verified, ${certificationRows.length} certification rows`, "connector sync/poll/writeback", "connections and connector commands", "connector actions through API/SDK", "tests/evaluation.test.ts", "artifacts/connector-certification.json", `${liveSmokeRows.length} tenant-verified, ${productionCertifiedRows.length} production-certified, ${certificationCredentialBlockedRows.length} credential-blocked`, "Native driver and implementation-ready certification do not equal customer production certification."),
    readinessRow("Harness Integrations", `${generatedHarnessRows.length} generated packages`, "HTTP fallback for non-MCP helpers", "config all/config refresh", `${harnessRows.filter((row) => row?.maturity?.mcp === true).length} MCP-capable targets`, "tests/cli.test.ts", "artifacts/harness-maturity.json", "generated plus simulator proof", "Vendor-native hooks are claimed only where a row proves them."),
    readinessRow("Benchmarks", "CogniCodeBench and Arena tooling plus hardening artifact exist", "publishable artifacts", "benchmark/proof commands", "n/a", "tests/evaluation.test.ts", "artifacts/benchmark-hardening.json", "immutable synthetic dataset plus public workflow fixtures", "Synthetic/API-shape rows are not vendor certification or field proof."),
    readinessRow("Operations", "Release check, doctor, services and optional Docker exist", "status, metrics and health routes", "service plan/install/status", "maintenance tools", "release:check", "artifacts/release-check.json", "self-hosted production candidate", "Managed SaaS, autoscaling, billing and hosted support are not claimed.")
  ];
  const criticalOpenGaps = [
    !dbPrimaryStorage && "db-primary-storage",
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
    mode: "production_readiness_status",
    summary: {
      selfHostedCandidate: true,
      productionCertified: criticalOpenGaps.length === 0 && externalBlockedGaps.length === 0,
      dbPrimaryStorage,
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

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
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
