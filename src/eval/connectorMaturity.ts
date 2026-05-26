import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

interface MaturityRow {
  provider: string;
  connectorId: string;
  category: string;
  status: string;
  proofLevel: "listed" | "manifest" | "driver" | "hermetic-driver" | "vendor-smoke" | "production-certified";
  maturity: {
    listed: boolean;
    manifest: boolean;
    driver: boolean;
    fixture: boolean;
    liveSmoke: boolean;
    oauthOrSetupWizard: boolean;
    pollOrList: boolean;
    webhook: boolean;
    writeback: boolean;
    docs: boolean;
    productionCertified: boolean;
  };
  evidence: {
    docs: string;
    addCommand: string;
    fixtureArtifact: string;
    liveSmokeArtifact: string;
    verification: string;
  };
  gaps: string[];
}

interface MaturityReport {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "connector-registry";
  artifacts: string[];
  rows: MaturityRow[];
  summary: {
    total: number;
    hermeticDrivers: number;
    liveSmokeReady: number;
    productionCertified: number;
  };
  passed: boolean;
}

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

export function generateConnectorMaturity(options: { out?: string; markdown?: string } = {}): MaturityReport {
  const catalog = cliJson<ConnectorCatalogItem[]>(["connections", "connectors", "list", "--json"]);
  const shows = new Map(catalog.map((item) => [item.provider, cliJson<ConnectorShow>(["connector", "show", item.provider, "--json"])]));
  const vendorContract = readJson("artifacts/vendor-connectors-live.json", { passed: false, calls: [] }) as { passed?: boolean; calls?: Array<{ provider?: string; method?: string }> };
  const liveSmoke = readJson("artifacts/vendor-live-smoke.json", { providers: [] }) as { providers?: Array<{ provider: string; configured: boolean; skipped: boolean; checks?: Record<string, boolean> }> };
  const rows = catalog.map((item) => maturityRow(item, shows.get(item.provider), vendorContract, liveSmoke));
  const report: MaturityReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "connector-registry",
    artifacts: ["artifacts/vendor-connectors-live.json", "artifacts/vendor-live-smoke.json", "artifacts/connectors-live.json"],
    rows,
    summary: {
      total: rows.length,
      hermeticDrivers: rows.filter((row) => row.proofLevel === "hermetic-driver" || row.proofLevel === "vendor-smoke" || row.proofLevel === "production-certified").length,
      liveSmokeReady: rows.filter((row) => row.maturity.liveSmoke).length,
      productionCertified: rows.filter((row) => row.maturity.productionCertified).length
    },
    passed: rows.length >= 19 && rows.every((row) => row.maturity.listed && row.maturity.manifest && row.maturity.docs && row.gaps.includes("production-certified proof not claimed"))
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
  liveSmoke: { providers?: Array<{ provider: string; configured: boolean; skipped: boolean; checks?: Record<string, boolean> }> }
): MaturityRow {
  const calls = vendorContract.calls?.filter((call) => call.provider === item.provider) ?? [];
  const live = liveSmoke.providers?.find((provider) => provider.provider === item.provider);
  const hasWrite = calls.some((call) => ["POST", "PATCH", "PUT"].includes(String(call.method ?? "").toUpperCase()));
  const hasRead = calls.some((call) => ["GET", "POST"].includes(String(call.method ?? "").toUpperCase()));
  const docsPath = item.docs.split("#")[0];
  const maturity = {
    listed: true,
    manifest: Boolean(item.connectorId),
    driver: item.status === "vendor-driver",
    fixture: Boolean(vendorContract.passed && calls.length > 0),
    liveSmoke: Boolean(live?.configured && !live.skipped),
    oauthOrSetupWizard: Boolean(show?.definition.fields?.length && item.addCommand),
    pollOrList: hasRead,
    webhook: false,
    writeback: hasWrite,
    docs: existsSync(docsPath),
    productionCertified: false
  };
  const proofLevel = maturity.productionCertified ? "production-certified" : maturity.liveSmoke ? "vendor-smoke" : maturity.fixture ? "hermetic-driver" : maturity.driver ? "driver" : maturity.manifest ? "manifest" : "listed";
  const gaps = [
    ...(!maturity.liveSmoke ? ["tenant live-smoke not run in checked artifact"] : []),
    ...(!maturity.webhook ? ["webhook delivery not claimed for native vendor row"] : []),
    "production-certified proof not claimed"
  ];
  return {
    provider: item.provider,
    connectorId: item.connectorId,
    category: providerCategory[item.provider] ?? "custom",
    status: item.status,
    proofLevel,
    maturity,
    evidence: {
      docs: item.docs,
      addCommand: item.addCommand,
      fixtureArtifact: "artifacts/vendor-connectors-live.json",
      liveSmokeArtifact: "artifacts/vendor-live-smoke.json",
      verification: "npm run verify:vendor-connectors && npm run verify:vendor-live"
    },
    gaps
  };
}

function renderMarkdown(report: MaturityReport): string {
  const rows = report.rows
    .map((row) => `| ${row.provider} | ${row.category} | ${row.proofLevel} | ${mark(row.maturity.driver)} | ${mark(row.maturity.fixture)} | ${mark(row.maturity.liveSmoke)} | ${mark(row.maturity.oauthOrSetupWizard)} | ${mark(row.maturity.pollOrList)} | ${mark(row.maturity.writeback)} | ${mark(row.maturity.productionCertified)} |`)
    .join("\n");
  return `# Connector Maturity Matrix

Generated from the CLI connector registry and verification artifacts at ${report.generatedAt}.

Native connector means there is a first-party connector manifest and driver path. It does not mean customer production certification unless the production-certified column is true.

Current checked connector state: ${report.summary.hermeticDrivers} hermetic drivers, ${report.summary.liveSmokeReady} tenant live smokes, ${report.summary.productionCertified} production certifications. Live-system proof requires tenant credentials plus \`MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live\`.

| Connector | Category | Proof level | Driver | Fixture | Live smoke | Setup wizard | Poll/list | Writeback | Production-certified |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

Evidence:

- \`artifacts/vendor-connectors-live.json\` proves hermetic driver/list/poll/writeback paths.
- \`artifacts/vendor-live-smoke.json\` records whether tenant credentials were configured and live smoke was opted in.
- \`npm run connectors:maturity\` regenerates this page and \`artifacts/connector-maturity.json\`.
`;
}

function mark(value: boolean): string {
  return value ? "yes" : "no";
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
    markdown: markdownIndex >= 0 ? process.argv[markdownIndex + 1] : "docs/integrations/connector-maturity.md"
  }), null, 2));
}
