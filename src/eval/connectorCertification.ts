import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

type CertificationState = "not_certified" | "implementation-ready" | "credential-blocked" | "tenant-verified" | "production-certified" | "failed";
type CertificationLevel = "L0-driver-present" | "L1-mock-contract-tested" | "L2-sandbox-live-smoke" | "L3-tenant-verified" | "L4-production-certified";

interface CertificationRow {
  provider: string;
  connectorId: string;
  state: CertificationState;
  level: CertificationLevel;
  list: boolean;
  poll: boolean;
  writeback: boolean;
  oauth: boolean;
  webhook: boolean;
  sourceResolverCoverage: number;
  semanticMappingScore: number;
  liveSmokeRunId?: string;
  artifactHash: string;
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
  proofGate: ConnectorCertificationProofGate;
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

interface ConnectorCertificationProofGate {
  status: "credential-blocked" | "tenant-verified" | "production-certified";
  artifactHash: string;
  rowHashes: string[];
  tenantVerifiedRows: number;
  productionCertifiedRows: number;
  signedTenantProofRows: number;
  ownerApprovedProductionRows: number;
  requiredForTenantVerification: string[];
  requiredForProductionCertification: string[];
  blockers: string[];
  tenantClaimAllowed: boolean;
  productionClaimAllowed: boolean;
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
const certificationBoundary = "hermetic fixtures may never produce tenant-verified or production-certified rows";

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
  const proofGate = connectorCertificationProofGate(rows, artifactPaths);
  const report: ConnectorCertificationReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "connector-certification",
    rows,
    proofGate,
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
  const signedLiveSmoke = liveArtifactSigned(liveRow);
  const ownerApproved = productionOwnerApproved(liveRow);
  const tenantVerified = maturity.tenantVerified === true && signedLiveSmoke;
  const productionCertified = maturity.productionCertified === true && tenantVerified && ownerApproved;
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
    signedLiveSmokeArtifact: signedLiveSmoke,
    ownerApprovedProductionArtifact: ownerApproved,
    tenantLiveSmoke: tenantVerified,
    productionCertification: productionCertified
  };
  const implementationReady = checks.hermeticDriver && checks.apiSpec && checks.liveSmokeHarness && checks.webhookSecurity && checks.semanticQuality && checks.transportRetryPagination && checks.dryRunByDefault && checks.noPlainTokenRetained;
  const certificationOnlyChecks = new Set(["signedLiveSmokeArtifact", "ownerApprovedProductionArtifact", "tenantLiveSmoke", "productionCertification"]);
  const blockedBy = [
    ...(!implementationReady ? Object.entries(checks).filter(([name, passed]) => !passed && !certificationOnlyChecks.has(name)).map(([name]) => name) : []),
    ...(!tenantVerified ? ["signed tenant live-smoke artifact with MEMORY_VENDOR_LIVE_SMOKE=true"] : []),
    ...(!productionCertified ? ["signed deployment owner production certification artifact"] : [])
  ];
  const state: CertificationState = productionCertified
    ? "production-certified"
    : tenantVerified
      ? "tenant-verified"
      : implementationReady
        ? "credential-blocked"
        : "failed";
  const capabilities = connectorCapabilities(row, qualityRow, webhookNeeded, signedLiveSmoke);
  const level = certificationLevel(state, checks);
  const evidence = {
    maturity: artifactPaths.maturity,
    apiSpec: String(maturityEvidence.apiSpecArtifact ?? "artifacts/vendor-api-specs.json"),
    liveSmoke: artifactPaths.liveSmoke,
    quality: artifactPaths.quality,
    transport: provider === "github" ? artifactPaths.transport : "covered-by-shared-transport-path"
  };
  const liveSmokeRunId = stringValue(liveRow?.runId) ?? stringValue(object(liveRow?.artifact).runId);
  const artifactHash = hashCertificationRow({
    provider,
    connectorId: String(row.connectorId ?? ""),
    state,
    level,
    checks,
    capabilities,
    evidence,
    blockedBy,
    liveSmokeRunId
  });
  return {
    provider,
    connectorId: String(row.connectorId ?? ""),
    state,
    level,
    ...capabilities,
    liveSmokeRunId,
    artifactHash,
    checks,
    evidence,
    blockedBy,
    canBecomeTenantVerified: implementationReady,
    canBecomeProductionCertified: implementationReady && tenantVerified
  };
}

function connectorCertificationProofGate(
  rows: CertificationRow[],
  artifactPaths: {
    maturity: string;
    liveSmoke: string;
    transport: string;
    quality: string;
  }
): ConnectorCertificationProofGate {
  const tenantRows = rows.filter((row) => row.state === "tenant-verified" || row.state === "production-certified");
  const productionRows = rows.filter((row) => row.state === "production-certified");
  const signedTenantProofRows = rows.filter((row) => row.checks.signedLiveSmokeArtifact && row.checks.tenantLiveSmoke).length;
  const ownerApprovedProductionRows = rows.filter((row) => row.checks.ownerApprovedProductionArtifact && row.checks.productionCertification).length;
  const tenantClaimAllowed = tenantRows.length > 0 && tenantRows.length === signedTenantProofRows;
  const productionClaimAllowed = productionRows.length > 0 && productionRows.length === ownerApprovedProductionRows && productionRows.every((row) => row.checks.tenantLiveSmoke);
  const blockers = [
    ...(!tenantClaimAllowed ? ["no signed tenant live-smoke row is claimable"] : []),
    ...(!productionClaimAllowed ? ["no owner-approved production certification row is claimable"] : []),
    ...rows.filter((row) => row.state === "failed").map((row) => `${row.provider}: ${row.blockedBy.join(", ")}`)
  ];
  const rowHashes = rows.map((row) => row.artifactHash).sort();
  const artifactHash = hashCertificationRow({
    schemaVersion: "1.0",
    mode: "connector-certification-proof-gate",
    rowHashes,
    tenantVerifiedRows: tenantRows.length,
    productionCertifiedRows: productionRows.length,
    signedTenantProofRows,
    ownerApprovedProductionRows,
    artifactPaths
  });
  return {
    status: productionClaimAllowed ? "production-certified" : tenantClaimAllowed ? "tenant-verified" : "credential-blocked",
    artifactHash,
    rowHashes,
    tenantVerifiedRows: tenantRows.length,
    productionCertifiedRows: productionRows.length,
    signedTenantProofRows,
    ownerApprovedProductionRows,
    requiredForTenantVerification: [
      "MEMORY_VENDOR_LIVE_SMOKE=true",
      "provider credentials configured outside the artifact",
      "live-smoke provider row with signature.status=verified"
    ],
    requiredForProductionCertification: [
      "tenant verification proof",
      "ownerApproval.status=approved",
      "ownerApproval.actor",
      "ownerApproval.signedAt"
    ],
    blockers,
    tenantClaimAllowed,
    productionClaimAllowed
  };
}

function connectorCapabilities(
  row: Record<string, unknown>,
  qualityRow: Record<string, unknown> | undefined,
  webhookNeeded: boolean,
  signedLiveSmoke: boolean
): Pick<CertificationRow, "list" | "poll" | "writeback" | "oauth" | "webhook" | "sourceResolverCoverage" | "semanticMappingScore"> {
  const maturity = object(row.maturity);
  const quality = object(qualityRow);
  const qualityChecks = object(quality.checks);
  const semanticScore = numberValue(quality.score) ?? scoreFromChecks(qualityChecks);
  return {
    list: maturity.listImplemented === true || maturity.pollOrList === true,
    poll: maturity.pollImplemented === true || maturity.pollOrList === true,
    writeback: maturity.writebackImplemented === true || maturity.writeback === true,
    oauth: maturity.oauthOrSetupWizard === true,
    webhook: webhookNeeded ? maturity.webhook === true : false,
    sourceResolverCoverage: signedLiveSmoke ? 0.95 : maturity.liveSmokeSupport === true ? 0.75 : 0,
    semanticMappingScore: semanticScore
  };
}

function certificationLevel(state: CertificationState, checks: Record<string, boolean>): CertificationLevel {
  if (state === "production-certified") return "L4-production-certified";
  if (state === "tenant-verified") return "L3-tenant-verified";
  if (checks.liveSmokeHarness) return "L2-sandbox-live-smoke";
  if (checks.hermeticDriver && checks.apiSpec) return "L1-mock-contract-tested";
  return "L0-driver-present";
}

function scoreFromChecks(checks: Record<string, unknown>): number {
  const values = Object.values(checks).filter((value): value is boolean => typeof value === "boolean");
  if (!values.length) return 0;
  return Number((values.filter(Boolean).length / values.length).toFixed(2));
}

function hashCertificationRow(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function liveArtifactSigned(liveRow: Record<string, unknown> | undefined): boolean {
  if (!liveRow || liveRow.skipped === true) return false;
  const signature = object(liveRow.signature);
  if (signature.status === "verified" || signature.verified === true) return true;
  const artifact = object(liveRow.artifact);
  const artifactSignature = object(artifact.signature);
  return artifactSignature.status === "verified" || artifactSignature.verified === true;
}

function productionOwnerApproved(liveRow: Record<string, unknown> | undefined): boolean {
  const approval = object(liveRow?.ownerApproval);
  if (approval.status === "approved" && typeof approval.signedAt === "string" && typeof approval.actor === "string") return true;
  const artifact = object(liveRow?.artifact);
  const artifactApproval = object(artifact.ownerApproval);
  return artifactApproval.status === "approved" && typeof artifactApproval.signedAt === "string" && typeof artifactApproval.actor === "string";
}

function renderMarkdown(report: ConnectorCertificationReport): string {
  const rows = report.rows
    .map((row) => `| ${row.provider} | ${row.state} | ${row.canBecomeTenantVerified ? "yes" : "no"} | ${row.checks.tenantLiveSmoke ? "yes" : "no"} | ${row.checks.productionCertification ? "yes" : "no"} | ${row.blockedBy.join("; ")} |`)
    .join("\n");
  return `# Connector Certification

Generated at ${report.generatedAt}.

This page is the production-certification boundary. A row can be implementation-ready without being tenant-verified. Tenant verification requires real customer or deployment credentials and \`MEMORY_VENDOR_LIVE_SMOKE=true npm run internal -- verify:vendor-live\`. Production certification requires an owner-approved deployment artifact; ${certificationBoundary}.

Proof gate: \`${report.proofGate.status}\`; artifact hash \`${report.proofGate.artifactHash}\`; tenant claims ${report.proofGate.tenantClaimAllowed ? "allowed" : "blocked"}; production claims ${report.proofGate.productionClaimAllowed ? "allowed" : "blocked"}.

| Provider | State | Can become tenant verified | Tenant live smoke | Production certified | Blocked by |
| --- | --- | ---: | ---: | ---: | --- |
${rows}
`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
