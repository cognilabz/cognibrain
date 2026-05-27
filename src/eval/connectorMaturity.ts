import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type ConnectorProofLevel =
  | "manifest-only"
  | "cli-config"
  | "driver-code"
  | "hermetic-tested"
  | "live-smoke-ready"
  | "tenant-verified"
  | "production-certified";

interface ConnectorCatalogItem {
  provider: string;
  connectorId: string;
  status: string;
  docs: string;
  configured: boolean;
  addCommand: string;
}

interface ConnectorShow {
  provider: string;
  definition: {
    connectorId: string;
    status: string;
    docs: string;
    requiredEnv: string[];
    fields?: Array<{ name: string; secret?: boolean }>;
    sampleEvents?: string[];
  };
}

interface VendorApiSpecRow {
  provider: string;
  passed: boolean;
  endpoints?: Array<{ purpose?: string; matched?: boolean }>;
  capabilities?: {
    listOrPoll?: boolean;
    writeback?: boolean;
    authorization?: boolean;
  };
}

interface MaturityRow {
  provider: string;
  connectorId: string;
  category: string;
  status: string;
  proofLevel: ConnectorProofLevel;
  qualityScore: number;
  maturity: {
    listed: boolean;
    manifest: boolean;
    cliDefinition: boolean;
    requiredEnv: boolean;
    driver: boolean;
    listImplemented: boolean;
    pollImplemented: boolean;
    writebackImplemented: boolean;
    hermeticFixture: boolean;
    apiSpec: boolean;
    liveSmokeSupport: boolean;
    tenantVerified: boolean;
    tuiSetup: boolean;
    docs: boolean;
    productionCertified: boolean;
    fixture: boolean;
    liveSmoke: boolean;
    oauthOrSetupWizard: boolean;
    pollOrList: boolean;
    webhook: boolean;
    writeback: boolean;
  };
  quality: {
    eventExtraction: boolean;
    sourceRefCompleteness: boolean;
    memoryTypeClassification: boolean;
    scopeMapping: boolean;
    sensitiveDataHandling: boolean;
    duplicateSuppression: boolean;
    updateRevalidation: boolean;
    writebackDryRun: boolean;
  };
  evidence: {
    docs: string;
    addCommand: string;
    fixtureArtifact: string;
    apiSpecArtifact: string;
    liveSmokeArtifact: string;
    verification: string;
  };
  gaps: string[];
}

interface MaturityReport {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "connector-registry";
  proofLevels: ConnectorProofLevel[];
  artifacts: string[];
  rows: MaturityRow[];
  summary: {
    total: number;
    hermeticDrivers: number;
    apiSpecVerified: number;
    liveSmokeReady: number;
    credentialBlockedCertification: number;
    tenantVerified: number;
    productionCertified: number;
    webhookVerified: number;
    publicConnectorSdk: boolean;
    averageQualityScore: number;
  };
  passed: boolean;
}

interface ConnectorMaturityOptions {
  out?: string;
  markdown?: string;
  vendorContract?: string;
  apiSpecs?: string;
  liveSmoke?: string;
  webhookProof?: string;
  certification?: string;
}

const proofLevels: ConnectorProofLevel[] = [
  "manifest-only",
  "cli-config",
  "driver-code",
  "hermetic-tested",
  "live-smoke-ready",
  "tenant-verified",
  "production-certified"
];

const providerCategory: Record<string, string> = {
  github: "code",
  gitlab: "code",
  "azure-devops": "code",
  slack: "chat",
  discord: "chat",
  teams: "chat",
  jira: "planning-docs",
  confluence: "planning-docs",
  notion: "planning-docs",
  linear: "planning-docs",
  gmail: "google-workspace",
  "google-drive": "google-workspace",
  "google-calendar": "google-workspace",
  asana: "work-tracking",
  clickup: "work-tracking",
  sentry: "operations-product",
  datadog: "operations-product",
  pagerduty: "operations-product",
  posthog: "operations-product"
};

const updateRevalidationProviders = new Set(["jira", "confluence", "notion", "linear", "gitlab", "azure-devops", "asana", "clickup", "sentry", "datadog", "pagerduty", "posthog"]);
const webhookSupportedProviders = new Set(["github", "jira", "confluence", "notion", "linear", "gitlab", "slack", "teams", "sentry", "pagerduty"]);

export function generateConnectorMaturity(options: ConnectorMaturityOptions = {}): MaturityReport {
  const catalog = cliJson<ConnectorCatalogItem[]>(["connections", "connectors", "list", "--json"]);
  const shows = new Map(catalog.map((item) => [item.provider, cliJson<ConnectorShow>(["connector", "show", item.provider, "--json"])]));
  const artifactPaths = {
    vendorContract: options.vendorContract ?? "artifacts/vendor-connectors-live.json",
    apiSpecs: options.apiSpecs ?? "artifacts/vendor-api-specs.json",
    liveSmoke: options.liveSmoke ?? "artifacts/vendor-live-smoke.json",
    webhookProof: options.webhookProof ?? "artifacts/connector-webhooks.json",
    certification: options.certification ?? "artifacts/connector-certification.json",
    connectorsLive: "artifacts/connectors-live.json"
  };
  const vendorContract = readJson(artifactPaths.vendorContract, { passed: false, calls: [] }) as { passed?: boolean; calls?: Array<{ provider?: string; method?: string }> };
  const apiSpecs = readJson(artifactPaths.apiSpecs, { passed: false, rows: [] }) as { passed?: boolean; rows?: VendorApiSpecRow[] };
  const liveSmoke = readJson(artifactPaths.liveSmoke, { providers: [] }) as { providers?: Array<{ provider: string; configured: boolean; skipped: boolean; checks?: Record<string, boolean> }> };
  const webhookProof = readJson(artifactPaths.webhookProof, { rows: [] }) as { rows?: Array<{ provider?: string; passed?: boolean; checks?: Record<string, boolean> }> };
  const certification = readJson(artifactPaths.certification, { rows: [] }) as { rows?: Array<{ provider?: string; state?: string }> };
  const rows = catalog.map((item) => maturityRow(item, shows.get(item.provider), vendorContract, apiSpecs, liveSmoke, webhookProof, artifactPaths));
  const report: MaturityReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "connector-registry",
    proofLevels,
    artifacts: [artifactPaths.vendorContract, artifactPaths.apiSpecs, artifactPaths.liveSmoke, artifactPaths.webhookProof, artifactPaths.certification, artifactPaths.connectorsLive],
    rows,
    summary: {
      total: rows.length,
      hermeticDrivers: rows.filter((row) => row.maturity.hermeticFixture && row.maturity.apiSpec).length,
      apiSpecVerified: rows.filter((row) => row.maturity.apiSpec).length,
      liveSmokeReady: rows.filter((row) => row.proofLevel === "live-smoke-ready" || row.proofLevel === "tenant-verified" || row.proofLevel === "production-certified").length,
      credentialBlockedCertification: Array.isArray(certification.rows) ? certification.rows.filter((row) => row.state === "credential-blocked").length : 0,
      tenantVerified: rows.filter((row) => row.maturity.tenantVerified).length,
      productionCertified: rows.filter((row) => row.maturity.productionCertified).length,
      webhookVerified: rows.filter((row) => row.maturity.webhook).length,
      publicConnectorSdk: publicConnectorSdkReady(),
      averageQualityScore: roundedAverage(rows.map((row) => row.qualityScore))
    },
    passed: rows.length >= 19 && rows.every((row) =>
      row.maturity.listed &&
      row.maturity.manifest &&
      row.maturity.cliDefinition &&
      row.maturity.requiredEnv &&
      row.maturity.docs &&
      row.maturity.apiSpec &&
      row.maturity.liveSmokeSupport &&
      (row.maturity.webhook || !webhookSupportedProviders.has(row.provider)) &&
      publicConnectorSdkReady() &&
      row.gaps.includes("production-certified proof not claimed")
    )
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, renderMarkdown(report));
  }
  return report;
}

function maturityRow(
  item: ConnectorCatalogItem,
  show: ConnectorShow | undefined,
  vendorContract: { passed?: boolean; calls?: Array<{ provider?: string; method?: string }> },
  apiSpecs: { passed?: boolean; rows?: VendorApiSpecRow[] },
  liveSmoke: { providers?: Array<{ provider: string; configured: boolean; skipped: boolean; checks?: Record<string, boolean> }> },
  webhookProof: { rows?: Array<{ provider?: string; passed?: boolean; checks?: Record<string, boolean> }> },
  artifactPaths: {
    vendorContract: string;
    apiSpecs: string;
    liveSmoke: string;
    webhookProof: string;
  }
): MaturityRow {
  const calls = vendorContract.calls?.filter((call) => call.provider === item.provider) ?? [];
  const apiSpec = apiSpecs.rows?.find((row) => row.provider === item.provider);
  const live = liveSmoke.providers?.find((provider) => provider.provider === item.provider);
  const webhook = webhookProof.rows?.find((row) => row.provider === item.provider);
  const hasWrite = calls.some((call) => ["POST", "PATCH", "PUT"].includes(String(call.method ?? "").toUpperCase()));
  const hasRead = calls.some((call) => ["GET", "POST"].includes(String(call.method ?? "").toUpperCase()));
  const endpointPurpose = (purpose: string) => Boolean(apiSpec?.endpoints?.some((endpoint) => endpoint.purpose === purpose && endpoint.matched));
  const docsPath = item.docs.split("#")[0];
  const maturity = {
    listed: true,
    manifest: Boolean(item.connectorId),
    cliDefinition: Boolean(show?.definition.connectorId && show.definition.connectorId === item.connectorId),
    requiredEnv: Boolean(show?.definition.requiredEnv?.length),
    driver: item.status === "vendor-driver",
    listImplemented: endpointPurpose("list") || Boolean(apiSpec?.capabilities?.listOrPoll ?? hasRead),
    pollImplemented: endpointPurpose("poll") || Boolean(apiSpec?.capabilities?.listOrPoll ?? hasRead),
    writebackImplemented: endpointPurpose("writeback") || Boolean(apiSpec?.capabilities?.writeback ?? hasWrite),
    hermeticFixture: Boolean(vendorContract.passed && calls.length > 0),
    apiSpec: Boolean(apiSpec?.passed),
    liveSmokeSupport: Boolean(live && "liveSmokeOptedIn" in (live.checks ?? {})),
    tenantVerified: Boolean(live?.configured && !live.skipped && Object.values(live.checks ?? {}).every(Boolean)),
    tuiSetup: Boolean(show?.definition.fields?.length && item.addCommand),
    docs: existsSync(docsPath),
    productionCertified: false,
    fixture: Boolean(vendorContract.passed && calls.length > 0),
    liveSmoke: Boolean(live?.configured && !live.skipped && Object.values(live.checks ?? {}).every(Boolean)),
    oauthOrSetupWizard: Boolean(show?.definition.fields?.length && item.addCommand),
    pollOrList: endpointPurpose("list") || endpointPurpose("poll") || Boolean(apiSpec?.capabilities?.listOrPoll ?? hasRead),
    webhook: Boolean(webhook?.passed && Object.values(webhook.checks ?? {}).every(Boolean)),
    writeback: endpointPurpose("writeback") || Boolean(apiSpec?.capabilities?.writeback ?? hasWrite)
  };
  const quality = connectorQuality(item.provider, maturity, live);
  const qualityScore = roundedAverage(Object.values(quality).map((value) => value ? 1 : 0));
  const proofLevel = connectorProofLevel(maturity);
  const gaps = [
    ...(!maturity.apiSpec ? ["vendor API/spec contract not verified"] : []),
    ...(!maturity.liveSmokeSupport ? ["live-smoke harness not available"] : []),
    ...(!maturity.tenantVerified ? ["tenant live-smoke not run in checked artifact"] : []),
    ...(webhookSupportedProviders.has(item.provider) && !maturity.webhook ? ["webhook delivery not claimed for native vendor row"] : []),
    ...(!quality.updateRevalidation ? ["update/revalidation quality gate not complete"] : []),
    "production-certified proof not claimed"
  ];
  return {
    provider: item.provider,
    connectorId: item.connectorId,
    category: providerCategory[item.provider] ?? "custom",
    status: item.status,
    proofLevel,
    qualityScore,
    maturity,
    quality,
    evidence: {
      docs: item.docs,
      addCommand: item.addCommand,
      fixtureArtifact: artifactPaths.vendorContract,
      apiSpecArtifact: artifactPaths.apiSpecs,
      liveSmokeArtifact: artifactPaths.liveSmoke,
      verification: "npm run internal -- verify:vendor-connectors && npm run internal -- verify:vendor-api-specs && npm run internal -- verify:vendor-live && npm run internal -- connectors:webhooks"
    },
    gaps
  };
}

function connectorProofLevel(maturity: MaturityRow["maturity"]): ConnectorProofLevel {
  if (maturity.productionCertified) return "production-certified";
  if (maturity.tenantVerified) return "tenant-verified";
  if (maturity.driver && maturity.hermeticFixture && maturity.apiSpec && maturity.liveSmokeSupport) return "live-smoke-ready";
  if (maturity.driver && maturity.hermeticFixture && maturity.apiSpec) return "hermetic-tested";
  if (maturity.driver) return "driver-code";
  if (maturity.manifest && maturity.cliDefinition && maturity.tuiSetup) return "cli-config";
  return "manifest-only";
}

function connectorQuality(
  provider: string,
  maturity: MaturityRow["maturity"],
  live?: { provider: string; configured: boolean; skipped: boolean; checks?: Record<string, boolean> }
): MaturityRow["quality"] {
  return {
    eventExtraction: maturity.hermeticFixture && maturity.pollImplemented,
    sourceRefCompleteness: maturity.hermeticFixture && maturity.apiSpec,
    memoryTypeClassification: maturity.hermeticFixture && ["code", "chat", "planning-docs", "google-workspace", "work-tracking", "operations-product"].includes(providerCategory[provider] ?? ""),
    scopeMapping: maturity.requiredEnv && maturity.tuiSetup,
    sensitiveDataHandling: live?.checks?.noPlainTokenRetained === true || live?.skipped === true,
    duplicateSuppression: maturity.hermeticFixture,
    updateRevalidation: updateRevalidationProviders.has(provider) ? maturity.pollImplemented && maturity.apiSpec : maturity.pollImplemented,
    writebackDryRun: maturity.writebackImplemented && maturity.liveSmokeSupport
  };
}

function publicConnectorSdkReady(): boolean {
  if (!existsSync("sdk/typescript/connectors.ts") || !existsSync("sdk/typescript/index.ts") || !existsSync("bin/lib/cliRuntime.mjs")) return false;
  const connectors = readFileSync("sdk/typescript/connectors.ts", "utf8");
  const index = readFileSync("sdk/typescript/index.ts", "utf8");
  const cli = readFileSync("bin/lib/cliRuntime.mjs", "utf8");
  return [
    "createPlatformIntegration",
    "createConnectorManifest",
    "normalizeConnectorEvent",
    "runConnectorPoll",
    "createDryRunWritebackPlan"
  ].every((needle) => connectors.includes(needle)) &&
    index.includes("./connectors") &&
    cli.includes("sdk/typescript/index.ts");
}

function renderMarkdown(report: MaturityReport): string {
  const rows = report.rows
    .map((row) => `| ${row.provider} | ${row.category} | ${row.proofLevel} | ${score(row.qualityScore)} | ${mark(row.maturity.driver)} | ${mark(row.maturity.hermeticFixture)} | ${mark(row.maturity.apiSpec)} | ${mark(row.maturity.liveSmokeSupport)} | ${mark(row.maturity.webhook)} | ${mark(row.maturity.tenantVerified)} | ${mark(row.maturity.tuiSetup)} | ${mark(row.maturity.listImplemented)} | ${mark(row.maturity.pollImplemented)} | ${mark(row.maturity.writebackImplemented)} | ${mark(row.maturity.productionCertified)} |`)
    .join("\n");
  return `# Connector Maturity Matrix

Generated from the CLI connector registry and verification artifacts at ${report.generatedAt}.

Proof levels are ordered as: ${report.proofLevels.map((level) => `\`${level}\``).join(" -> ")}.

Native connector means there is a first-party connector manifest and driver path. It does not mean customer production certification unless the production-certified column is true. Marketing can make strong live-system claims only for \`tenant-verified\` or \`production-certified\` rows.

Current checked connector state: ${report.summary.hermeticDrivers} hermetic drivers, ${report.summary.apiSpecVerified} API/spec-verified drivers, ${report.summary.liveSmokeReady} live-smoke-ready drivers, ${report.summary.webhookVerified} webhook-verified priority drivers, public Connector SDK ${report.summary.publicConnectorSdk ? "present" : "missing"}, ${report.summary.credentialBlockedCertification} credential-blocked certification rows, ${report.summary.tenantVerified} tenant-verified live smokes, ${report.summary.productionCertified} production certifications, average quality score ${score(report.summary.averageQualityScore)}. Live-system proof requires tenant credentials plus \`MEMORY_VENDOR_LIVE_SMOKE=true npm run internal -- verify:vendor-live\`.

| Connector | Category | Proof level | Quality | Driver | Fixture | API/spec | Live-smoke ready | Webhook | Tenant verified | TUI setup | List | Poll | Writeback | Production-certified |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Evidence:

- \`artifacts/vendor-connectors-live.json\` proves hermetic driver/list/poll/writeback paths.
- \`artifacts/vendor-api-specs.json\` checks method, path shape, auth scheme and writeback calls against codified vendor API contracts.
- \`artifacts/vendor-live-smoke.json\` records whether tenant credentials were configured, whether live smoke was opted in, and whether token material was retained.
- \`artifacts/connector-webhooks.json\` proves signature validation, replay protection, normalization, source refs and review queues for priority webhook-capable connectors.
- \`artifacts/connector-certification.json\` separates implementation-ready rows from tenant-verified and production-certified rows.
- \`npm run internal -- connectors:maturity\` regenerates this page and \`artifacts/connector-maturity.json\`.
`;
}

function roundedAverage(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function mark(value: boolean): string {
  return value ? "yes" : "no";
}

function score(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function cliJson<T>(args: string[]): T {
  const result = spawnSync(process.execPath, ["bin/cognibrain.mjs", ...args], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`cognibrain ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout) as T;
}

function readJson(path: string, fallback: unknown): unknown {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const markdownIndex = process.argv.indexOf("--markdown");
  console.log(JSON.stringify(generateConnectorMaturity({
    out: outIndex >= 0 ? process.argv[outIndex + 1] : "artifacts/connector-maturity.json",
    markdown: markdownIndex >= 0 ? process.argv[markdownIndex + 1] : "artifacts/docs/connector-maturity.md"
  }), null, 2));
}
