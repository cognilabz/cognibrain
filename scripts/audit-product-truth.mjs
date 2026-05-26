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
  vendorApiSpecs: readJson("artifacts/vendor-api-specs.json", { rows: [], summary: {} }),
  vendorLive: readJson("artifacts/vendor-live-smoke.json", { liveRequested: false, writebackEnabled: false, providers: [] }),
  releaseCheck: read("scripts/release-check.mjs"),
  cli: read("bin/cognibrain.mjs"),
  readme: read("README.md"),
  install: read("docs/install.md"),
  benchmarks: read("docs/benchmarks.md"),
  integrations: read("docs/integrations.md"),
  claims: read("docs/claims.md"),
  sameBenchmark: read("docs/market/same-benchmark.md")
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
const liveSmokeRows = maturityRows.filter((row) => row?.maturity?.liveSmoke === true);
const productionCertifiedRows = maturityRows.filter((row) => row?.maturity?.productionCertified === true);
const hermeticRows = maturityRows.filter((row) => row?.proofLevel === "hermetic-driver" || row?.proofLevel === "vendor-smoke" || row?.proofLevel === "production-certified");
const apiSpecVerifiedRows = maturityRows.filter((row) => row?.maturity?.apiSpec === true);
const vendorLiveProviders = Array.isArray(files.vendorLive.providers) ? files.vendorLive.providers : [];
const vendorLiveAttempted = vendorLiveProviders.filter((provider) => provider && provider.skipped === false);

const docsCorpus = [files.readme, files.install, files.benchmarks, files.integrations, files.claims, files.sameBenchmark].join("\n\n");
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
  check("benchmark-docs-boundary", "Benchmark docs explicitly separate real native/CLI rows from credential-blocked rows.", docsContainAll([
    "Mem0 and LangMem are now checked through real same-run-native package runners",
    "GBrain is checked as a real same-run-cli competitor row",
    "Graphiti/Zep and Cognee are credential-blocked unless LLM/vendor credentials are supplied"
  ]), "fail", {
    docs: ["README.md", "docs/benchmarks.md", "docs/claims.md", "docs/market/same-benchmark.md"]
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
  check("connector-live-smoke", "Checked artifacts contain no tenant live-smoke certification unless credentials were supplied and attempted.", liveSmokeRows.length > 0, "gap", {
    artifact: "artifacts/vendor-live-smoke.json",
    liveRequested: Boolean(files.vendorLive.liveRequested),
    attempted: vendorLiveAttempted.map((provider) => provider.provider),
    liveSmokeReady: liveSmokeRows.length
  }),
  check("connector-docs-boundary", "Connector docs state the checked artifact level: hermetic drivers, API/spec verification, no tenant live-smoke, no production certification.", docsContainAll([
    "Current checked connector state:",
    "19 API/spec-verified drivers",
    "0 tenant live smokes",
    "0 production certifications"
  ]), "fail", {
    docs: ["README.md", "docs/integrations.md", "docs/integrations/connector-maturity.md", "docs/claims.md"]
  }),
  check("cli-ink-primary", "The installable CLI has Ink/React dependencies, CLI render paths and checked screenshot assets.", Boolean(files.packageJson.dependencies?.ink) && files.cli.includes("await import(\"ink\")") && files.cli.includes("case \"proof\"") && screenshotAssets.length >= 5, "fail", {
    source: "bin/cognibrain.mjs",
    screenshots: screenshotAssets.length
  }),
  check("docker-optional", "Docker is present only as an optional deployment artifact, not the required product path.", docsContainAll([
    "Docker is optional",
    "The CLI is the required control plane"
  ]) && !/Docker is required|docker compose is required|required Docker|required docker/i.test(docsCorpus), "fail", {
    packageIncludesDocker: Array.isArray(files.packageJson.files) && files.packageJson.files.includes("docker/")
  }),
  check("truth-artifacts-packaged", "The npm package carries the checked truth inputs used by the CLI proof workbench.", [
    "artifacts/arena/run.json",
    "artifacts/connector-maturity.json",
    "artifacts/product-truth-audit.json",
    "artifacts/vendor-api-specs.json",
    "artifacts/vendor-live-smoke.json"
  ].every((path) => packageFiles.has(path) && existsSync(join(root, path))), "fail", {
    packageFiles: ["artifacts/arena/run.json", "artifacts/connector-maturity.json", "artifacts/product-truth-audit.json", "artifacts/vendor-live-smoke.json"]
  }),
  check("truth-gate-release", "Release and verification gates run the code-first product truth audit.", files.packageJson.scripts?.["audit:truth"] === "node scripts/audit-product-truth.mjs" && files.packageJson.scripts?.["verify:nextgen"]?.includes("audit:truth") && files.releaseCheck.includes("audit:truth"), "fail", {
    scripts: ["audit:truth", "verify:nextgen", "release:check"]
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
    apiSpecVerifiedConnectors: apiSpecVerifiedRows.length,
    tenantLiveSmokes: liveSmokeRows.length,
    productionCertifiedConnectors: productionCertifiedRows.length,
    cliScreenshots: screenshotAssets.length,
    dockerOptional: checks.find((item) => item.id === "docker-optional")?.passed === true
  },
  truthTuples: [
    ["arena.cognibrain.proof", cognibrainArena?.proofLevel ?? "missing", "artifacts/arena/run.json"],
    ["arena.competitors.realRuns", realCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.apiShape", apiShapeCompetitors.length, "artifacts/arena/run.json"],
    ["arena.competitors.credentialBlocked", blockedCompetitors.length, "artifacts/arena/run.json"],
    ["connectors.hermeticDrivers", hermeticRows.length, "artifacts/connector-maturity.json"],
    ["connectors.apiSpecVerified", apiSpecVerifiedRows.length, "artifacts/vendor-api-specs.json"],
    ["connectors.tenantLiveSmokes", liveSmokeRows.length, "artifacts/vendor-live-smoke.json"],
    ["connectors.productionCertified", productionCertifiedRows.length, "artifacts/connector-maturity.json"],
    ["cli.inkScreenshots", screenshotAssets.length, "docs/assets/cli-*.svg"],
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
