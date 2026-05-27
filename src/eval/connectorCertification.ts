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

interface ConnectorCertificationOptions {
  out?: string;
  markdown?: string;
  maturityInput?: string;
  liveSmokeInput?: string;
  transportInput?: string;
  qualityInput?: string;
}

const priorityWebhookProviders = new Set(["github", "jira", "confluence", "notion", "linear", "gitlab", "slack", "teams", "sentry", "pagerduty"]);

export function generateConnectorCertification(options: ConnectorCertificationOptions = {}): ConnectorCertificationReport {
  const artifactPaths = {
    maturity: options.maturityInput ?? "artifacts/connector-maturity.json",
    liveSmoke: options.liveSmokeInput ?? "artifacts/vendor-live-smoke.json",
    transport: options.transportInput ?? "artifacts/connector-transport.json",
    quality: options.qualityInput ?? "artifacts/connector-quality.json"
  };
  const maturity = readJson(artifactPaths.maturity, { rows: [] }) as { rows?: Array<Record<string, unknown>> };
  const live = readJson(artifactPaths.liveSmoke, { liveRequested: false, writebackEnabled: false, providers: [] }) as { liveRequested?: boolean; writebackEnabled?: boolean; providers?: Array<Record<string, unknown>> };
  const transport = readJson(artifactPaths.transport, { passed: false }) as { passed?: boolean };
  const quality = readJson(artifactPaths.quality, { rows: [] }) as { rows?: Array<Record<string, unknown>> };
  const qualityByProvider = new Map((quality.rows ?? []).map((row) => [String(row.provider), row]));
  const liveByProvider = new Map((live.providers ?? []).map((row) => [String(row.provider), row]));
  const rows = (maturity.rows ?? []).map((row) => certificationRow(row, liveByProvider.get(String(row.provider)), qualityByProvider.get(String(row.provider)), live, transport, artifactPaths));
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
  transport: { passed?: boolean },
  artifactPaths: {
    maturity: string;
    liveSmoke: string;
    transport: string;
    quality: string;
  }
): CertificationRow {
  const provider = String(row.provider ?? "unknown");
  const maturity = object(row.maturity);
  const liveChecks = object(liveRow?.checks);
  const tenantVerified = maturity.tenantVerified === true;
  const productionCertified = maturity.productionCertified === true;
  const webhookNeeded = priorityWebhookProviders.has(provider);
  const maturityEvidence = object(row.evidence);
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
      maturity: artifactPaths.maturity,
      apiSpec: String(maturityEvidence.apiSpecArtifact ?? "artifacts/vendor-api-specs.json"),
      liveSmoke: artifactPaths.liveSmoke,
      quality: artifactPaths.quality,
      transport: provider === "github" ? artifactPaths.transport : "covered-by-shared-transport-path"
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

function cliOptions(argv: string[]): ConnectorCertificationOptions {
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  const maturityIndex = argv.indexOf("--maturity-input");
  const liveSmokeIndex = argv.indexOf("--live-smoke-input");
  const transportIndex = argv.indexOf("--transport-input");
  const qualityIndex = argv.indexOf("--quality-input");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/connector-certification.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/connector-certification.md",
    maturityInput: maturityIndex >= 0 ? argv[maturityIndex + 1] : undefined,
    liveSmokeInput: liveSmokeIndex >= 0 ? argv[liveSmokeIndex + 1] : undefined,
    transportInput: transportIndex >= 0 ? argv[transportIndex + 1] : undefined,
    qualityInput: qualityIndex >= 0 ? argv[qualityIndex + 1] : undefined
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateConnectorCertification(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
