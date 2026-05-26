import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type CertificationState = "implementation-ready" | "credential-blocked" | "tenant-verified" | "production-certified" | "failed";

interface CertificationRow {
  provider: string;
  connectorId: string;
  state: CertificationState;
  checks: Record<string, boolean>;
  evidence: Record<string, string>;
  blockedBy: string[];
  canBecomeTenantVerified: boolean;
  canBecomeProductionCertified: boolean;
}

interface ConnectorCertificationReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "connector-certification";
  rows: CertificationRow[];
  summary: {
    total: number;
    implementationReady: number;
    credentialBlocked: number;
    tenantVerified: number;
    productionCertified: number;
    failed: number;
  };
  passed: boolean;
}

const priorityWebhookProviders = new Set(["github", "jira", "confluence", "notion", "linear", "gitlab", "slack", "teams", "sentry", "pagerduty"]);

export function generateConnectorCertification(options: { out?: string; markdown?: string } = {}): ConnectorCertificationReport {
  const maturity = readJson("artifacts/connector-maturity.json", { rows: [] }) as { rows?: Array<Record<string, unknown>> };
  const live = readJson("artifacts/vendor-live-smoke.json", { liveRequested: false, writebackEnabled: false, providers: [] }) as { liveRequested?: boolean; writebackEnabled?: boolean; providers?: Array<Record<string, unknown>> };
  const transport = readJson("artifacts/connector-transport.json", { passed: false }) as { passed?: boolean };
  const quality = readJson("artifacts/connector-quality.json", { rows: [] }) as { rows?: Array<Record<string, unknown>> };
  const qualityByProvider = new Map((quality.rows ?? []).map((row) => [String(row.provider), row]));
  const liveByProvider = new Map((live.providers ?? []).map((row) => [String(row.provider), row]));
  const rows = (maturity.rows ?? []).map((row) => certificationRow(row, liveByProvider.get(String(row.provider)), qualityByProvider.get(String(row.provider)), live, transport));
  const summary = {
    total: rows.length,
    implementationReady: rows.filter((row) => row.state === "implementation-ready").length,
    credentialBlocked: rows.filter((row) => row.state === "credential-blocked").length,
    tenantVerified: rows.filter((row) => row.state === "tenant-verified").length,
    productionCertified: rows.filter((row) => row.state === "production-certified").length,
    failed: rows.filter((row) => row.state === "failed").length
  };
  const report: ConnectorCertificationReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "connector-certification",
    rows,
    summary,
    passed: rows.length >= 19 && summary.failed === 0 && rows.every((row) => row.canBecomeTenantVerified)
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

function certificationRow(
  row: Record<string, unknown>,
  liveRow: Record<string, unknown> | undefined,
  qualityRow: Record<string, unknown> | undefined,
  liveReport: { liveRequested?: boolean; writebackEnabled?: boolean },
  transport: { passed?: boolean }
): CertificationRow {
  const provider = String(row.provider ?? "unknown");
  const maturity = object(row.maturity);
  const liveChecks = object(liveRow?.checks);
  const tenantVerified = maturity.tenantVerified === true;
  const productionCertified = maturity.productionCertified === true;
  const webhookNeeded = priorityWebhookProviders.has(provider);
  const checks = {
    hermeticDriver: maturity.hermeticFixture === true,
    apiSpec: maturity.apiSpec === true,
    liveSmokeHarness: maturity.liveSmokeSupport === true,
    webhookSecurity: webhookNeeded ? maturity.webhook === true : true,
    semanticQuality: qualityRow?.passed === true,
    transportRetryPagination: provider === "github" ? transport.passed === true : true,
    dryRunByDefault: liveReport.writebackEnabled !== true,
    noPlainTokenRetained: liveChecks.noPlainTokenRetained === true || liveRow?.skipped === true,
    tenantLiveSmoke: tenantVerified,
    productionCertification: productionCertified
  };
  const implementationReady = checks.hermeticDriver && checks.apiSpec && checks.liveSmokeHarness && checks.webhookSecurity && checks.semanticQuality && checks.transportRetryPagination && checks.dryRunByDefault && checks.noPlainTokenRetained;
  const blockedBy = [
    ...(!implementationReady ? Object.entries(checks).filter(([name, passed]) => !passed && !["tenantLiveSmoke", "productionCertification"].includes(name)).map(([name]) => name) : []),
    ...(!tenantVerified ? ["tenant credentials and MEMORY_VENDOR_LIVE_SMOKE=true artifact"] : []),
    ...(!productionCertified ? ["deployment owner production certification artifact"] : [])
  ];
  const state: CertificationState = productionCertified
    ? "production-certified"
    : tenantVerified
      ? "tenant-verified"
      : implementationReady
        ? "credential-blocked"
        : "failed";
  return {
    provider,
    connectorId: String(row.connectorId ?? ""),
    state,
    checks,
    evidence: {
      maturity: "artifacts/connector-maturity.json",
      apiSpec: "artifacts/vendor-api-specs.json",
      liveSmoke: "artifacts/vendor-live-smoke.json",
      quality: "artifacts/connector-quality.json",
      transport: provider === "github" ? "artifacts/connector-transport.json" : "covered-by-shared-transport-path"
    },
    blockedBy,
    canBecomeTenantVerified: implementationReady,
    canBecomeProductionCertified: implementationReady && tenantVerified
  };
}

function renderMarkdown(report: ConnectorCertificationReport): string {
  const rows = report.rows
    .map((row) => `| ${row.provider} | ${row.state} | ${row.canBecomeTenantVerified ? "yes" : "no"} | ${row.checks.tenantLiveSmoke ? "yes" : "no"} | ${row.checks.productionCertification ? "yes" : "no"} | ${row.blockedBy.join("; ")} |`)
    .join("\n");
  return `# Connector Certification

Generated at ${report.generatedAt}.

This page is the production-certification boundary. A row can be implementation-ready without being tenant-verified. Tenant verification requires real customer or deployment credentials and \`MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live\`. Production certification requires an owner-approved deployment artifact; it is not inferred from hermetic fixtures.

| Provider | State | Can become tenant verified | Tenant live smoke | Production certified | Blocked by |
| --- | --- | ---: | ---: | ---: | --- |
${rows}
`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readJson(path: string, fallback: unknown): unknown {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function cliOptions(argv: string[]): { out?: string; markdown?: string } {
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/connector-certification.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/connector-certification.md"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateConnectorCertification(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
