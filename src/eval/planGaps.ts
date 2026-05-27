import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PlanGapArea =
  | "storage"
  | "security"
  | "truth"
  | "dream"
  | "connectors"
  | "harness"
  | "operator"
  | "benchmarks"
  | "enterprise";

export interface PlanGapCheck {
  id: string;
  area: PlanGapArea;
  description: string;
  passed: boolean;
  evidence: string[];
  gaps: string[];
}

export interface PlanGapAuditReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "full-plan-gap-audit";
  checks: PlanGapCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  passed: boolean;
}

type FileMap = Record<string, string>;

export function generatePlanGapAudit(options: { out?: string; markdown?: string } = {}): PlanGapAuditReport {
  const files: FileMap = {
    packageJson: read("package.json"),
    postgres: read("src/api/repositories/postgresRepository.ts"),
    persistenceFactory: read("src/api/persistence/factory.ts"),
    service: read("src/api/service.ts"),
    server: read("src/api/server.ts"),
    helpers: read("src/api/server/helpers.ts"),
    serverSchemas: read("src/api/serverSchemas.ts"),
    connectors: read("src/api/service/connectorRuntime.ts"),
    marketplace: read("src/api/service/marketplace.ts"),
    dreamTypes: read("src/core/types/dream.ts"),
    dreamRuntime: read("src/api/service/dreamRuntime.ts"),
    searchRuntime: read("src/api/service/searchRuntime.ts"),
    memctl: read("src/cli/memctl.ts"),
    memoryCommands: read("src/cli/memctl/memoryCommands.ts"),
    reflectionCommands: read("src/cli/memctl/reflectionCommands.ts"),
    connectorCommands: read("src/cli/memctl/connectorCommands.ts"),
    governanceCommands: read("src/cli/memctl/governanceCommands.ts"),
    opsCommands: read("src/cli/memctl/opsCommands.ts"),
    operationsRuntime: read("src/api/service/operationsRuntime.ts"),
    opsRuntime: read("src/api/service/opsRuntime.ts"),
    cliRuntime: read("bin/lib/cliRuntime.mjs"),
    releaseContract: read("src/api/releaseContract.ts"),
    harnessMaturity: read("src/eval/harnessMaturity.ts"),
    operatorMaturity: read("src/eval/operatorOsMaturity.ts"),
    connectorCertification: read("src/eval/connectorCertification.ts"),
    benchmarkRelease: read("src/eval/benchmarkRelease.ts"),
    postgresLive: read("src/eval/postgresLive.ts"),
    productionCertifier: read("scripts/release/certify-production.mjs"),
    testsApi: read("tests/api.test.ts"),
    testsCore: read("tests/core.test.ts"),
    testsCoreIntegrations: read("tests/core-integrations.test.ts"),
    testsEvaluation: read("tests/evaluation.test.ts")
  };
  const all = Object.values(files).join("\n");
  const checks: PlanGapCheck[] = [
    check("storage.async-postgres-pool", "storage", "Postgres production repository uses a long-lived pg.Pool, prepared statements, migrations and RLS.", files, [
      ["src/api/repositories/postgresRepository.ts", "export class AsyncPostgresMemoryRepository"],
      ["src/api/repositories/postgresRepository.ts", "new Pool"],
      ["src/api/repositories/postgresRepository.ts", "name: \"cognibrain_async_upsert_memory_v1\""],
      ["src/api/repositories/postgresRepository.ts", "cognibrain_schema_migrations"],
      ["src/api/repositories/postgresRepository.ts", "checksumSql"],
      ["src/api/repositories/postgresRepository.ts", "enable row level security"]
    ]),
    check("storage.async-production-startup", "storage", "HTTP production startup initializes async repositories before listening and keeps production Postgres aliases on the primary repository path.", files, [
      ["src/api/service.ts", "createProductionMemoryService"],
      ["src/api/service.ts", "initializeDefaultMemoryService"],
      ["src/api/server.ts", "await initializeDefaultMemoryService()"],
      ["src/api/service.ts", "postgres-production"],
      ["src/api/service.ts", "postgres-async"],
      ["src/api/service.ts", "new PostgresMemoryRepository(process.env.MEMORY_POSTGRES_URL)"],
      ["src/api/persistence/factory.ts", "DB-primary MemoryRepository backend"],
      ["src/eval/postgresLive.ts", "new PostgresMemoryRepository(url)"],
      ["src/eval/postgresLive.ts", "storage.active === \"postgres-repository\""],
      ["tests/core.test.ts", "does not route DB-primary Postgres aliases through the legacy remote persistence factory"]
    ]),
    check("security.resource-aware-auth", "security", "Resource authorization loads resource scope and recursively denies cross-scope bodies.", files, [
      ["src/api/server/helpers.ts", "authorizeResource"],
      ["src/api/server/helpers.ts", "collectScopedValues"],
      ["src/api/service.ts", "resourceAuthorizationScope"],
      ["src/api/server.ts", "resourceAuthorizationScope"],
      ["tests/api.test.ts", "cross-org"],
      ["tests/api.test.ts", "nested body"]
    ]),
    check("security.enterprise-identity", "security", "Enterprise identity supports JWKS, multiple issuers, tenant constraints and role mapping.", files, [
      ["src/api/server/helpers.ts", "jwksUrl"],
      ["src/api/server/helpers.ts", "kid"],
      ["src/api/server/helpers.ts", "tenantAuthConfig"],
      ["src/api/server/helpers.ts", "roleToScopes"],
      ["src/api/server/helpers.ts", "service-account"]
    ]),
    check("truth.first-class-persistence", "truth", "Truth engine persists claims, conflict sets, evidence and truth resolutions in first-class tables/APIs.", files, [
      ["src/api/repositories/postgresRepository.ts", "cognibrain_claims"],
      ["src/api/repositories/postgresRepository.ts", "cognibrain_conflict_sets"],
      ["src/api/repositories/postgresRepository.ts", "cognibrain_claim_evidence"],
      ["src/api/repositories/postgresRepository.ts", "cognibrain_truth_resolutions"],
      ["src/api/service/searchRuntime.ts", "suppressedClaimIds"],
      ["tests/core.test.ts", "suppressedClaimIds"]
    ]),
    check("retrieval.risk-aware", "truth", "Retrieval and action guard expose truth and risk decisions for destructive/release-critical tasks.", files, [
      ["src/api/service/searchRuntime.ts", "riskLevel"],
      ["src/api/service/searchRuntime.ts", "verificationRequests"],
      ["src/api/service/searchRuntime.ts", "release-critical"],
      ["src/api/service/searchRuntime.ts", "truthReason"],
      ["tests/core.test.ts", "release-critical"]
    ]),
    check("dream.durable-source-aware", "dream", "Dreaming has durable jobs, logs, retry/cancel, release blockers and provider SourceResolver v2 with live async fetch revalidation.", files, [
      ["src/api/repositories/postgresRepository.ts", "cognibrain_dream_jobs"],
      ["src/api/repositories/postgresRepository.ts", "cognibrain_dream_job_logs"],
      ["src/core/types/dream.ts", "supports?("],
      ["src/core/types/dream.ts", "fetch?("],
      ["src/api/service.ts", "registerDefaultSourceResolvers"],
      ["src/api/service.ts", "revalidateSourceRefsAsync"],
      ["src/api/service.ts", "await resolver.fetch"],
      ["src/api/service.ts", "listExternalVendorItems"],
      ["tests/core.test.ts", "default GitHub source resolver fetches current provider state"],
      ["src/api/service.ts", "releaseBlockers"],
      ["tests/core.test.ts", "releaseBlockers"]
    ]),
    check("connectors.oauth-secret-store", "connectors", "OAuth code exchange, refresh and revoke use TokenSecretStore refs and hashes only.", files, [
      ["src/api/service/connectorRuntime.ts", "TokenSecretStore"],
      ["src/api/service/connectorRuntime.ts", "refreshConnectorOAuth"],
      ["src/api/service/connectorRuntime.ts", "revokeToken"],
      ["src/api/service/connectorRuntime.ts", "secretRef"],
      ["tests/core-integrations.test.ts", "raw-access-token"],
      ["tests/core-integrations.test.ts", "refreshConnectorOAuth"]
    ]),
    check("connectors.signed-certification", "connectors", "Tenant verification and production certification require signed live artifacts and owner approval.", files, [
      ["src/eval/connectorCertification.ts", "signedLiveSmoke"],
      ["src/eval/connectorCertification.ts", "ownerApproval"],
      ["src/eval/connectorCertification.ts", "hermetic fixtures may never"],
      ["tests/evaluation.test.ts", "tenantVerified"]
    ]),
    check("harness.certified-lifecycle", "harness", "Harness maturity checks full lifecycle events and proof levels, not binary support.", files, [
      ["src/eval/harnessMaturity.ts", "memory_coding_context_pack"],
      ["src/eval/harnessMaturity.ts", "memory_action_guard"],
      ["src/eval/harnessMaturity.ts", "memory_patch_evidence"],
      ["src/eval/harnessMaturity.ts", "dream lifecycle"],
      ["src/eval/harnessMaturity.ts", "proofLevel"]
    ]),
    check("operator.workbenches", "operator", "Operator workbenches cover memory, connector, dream, benchmark and production certification commands.", files, [
      ["src/cli/memctl/memoryCommands.ts", "case \"edit\""],
      ["src/cli/memctl/memoryCommands.ts", "case \"archive\""],
      ["src/cli/memctl/connectorCommands.ts", "case \"connector-configure\""],
      ["src/cli/memctl/connectorCommands.ts", "case \"connector-approve\""],
      ["src/cli/memctl/reflectionCommands.ts", "case \"dream-verify\""],
      ["src/cli/memctl/opsCommands.ts", "case \"benchmark-proof\""],
      ["src/cli/memctl/opsCommands.ts", "case \"production-certify\""]
    ]),
    check("benchmarks.immutable-release", "benchmarks", "Benchmark releases include immutable manifests, hashes, generator commit, split metadata and proof levels.", files, [
      ["src/eval/benchmarkRelease.ts", "cognicodebench-v2.0"],
      ["src/eval/benchmarkRelease.ts", "generatorCommit"],
      ["src/eval/benchmarkRelease.ts", "sha256"],
      ["src/eval/benchmarkRelease.ts", "hidden-eval-placeholder"],
      ["package.json", "\"benchmark:release\""],
      ["tests/evaluation.test.ts", "generateBenchmarkRelease"]
    ]),
    check("enterprise.production-hardening", "enterprise", "Enterprise hardening has Prometheus metrics, structured logs/tracing, backup replay and production certification artifacts.", files, [
      ["src/api/server.ts", "/metrics/prometheus"],
      ["src/api/service.ts", "prometheusMetrics"],
      ["src/api/service/operationsRuntime.ts", "structuredLog"],
      ["src/api/service/opsRuntime.ts", "verifyBackupReplay"],
      ["scripts/release/certify-production.mjs", "audit:plan-gaps"]
    ])
  ];
  const report: PlanGapAuditReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "full-plan-gap-audit",
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((item) => item.passed).length,
      failed: checks.filter((item) => !item.passed).length
    },
    passed: checks.every((item) => item.passed)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, markdown(report));
  }
  return report;
}

function check(id: string, area: PlanGapArea, description: string, files: FileMap, needles: Array<[string, string]>): PlanGapCheck {
  const gaps = needles
    .filter(([path, needle]) => !files[keyForPath(path)]?.includes(needle))
    .map(([path, needle]) => `${path} missing ${needle}`);
  return {
    id,
    area,
    description,
    passed: gaps.length === 0,
    evidence: needles.map(([path, needle]) => `${path}:${needle}`),
    gaps
  };
}

function keyForPath(path: string): string {
  const entry = Object.entries({
    packageJson: "package.json",
    postgres: "src/api/repositories/postgresRepository.ts",
    persistenceFactory: "src/api/persistence/factory.ts",
    service: "src/api/service.ts",
    server: "src/api/server.ts",
    helpers: "src/api/server/helpers.ts",
    serverSchemas: "src/api/serverSchemas.ts",
    connectors: "src/api/service/connectorRuntime.ts",
    marketplace: "src/api/service/marketplace.ts",
    dreamTypes: "src/core/types/dream.ts",
    dreamRuntime: "src/api/service/dreamRuntime.ts",
    searchRuntime: "src/api/service/searchRuntime.ts",
    memctl: "src/cli/memctl.ts",
    memoryCommands: "src/cli/memctl/memoryCommands.ts",
    reflectionCommands: "src/cli/memctl/reflectionCommands.ts",
    connectorCommands: "src/cli/memctl/connectorCommands.ts",
    governanceCommands: "src/cli/memctl/governanceCommands.ts",
    opsCommands: "src/cli/memctl/opsCommands.ts",
    operationsRuntime: "src/api/service/operationsRuntime.ts",
    opsRuntime: "src/api/service/opsRuntime.ts",
    cliRuntime: "bin/lib/cliRuntime.mjs",
    releaseContract: "src/api/releaseContract.ts",
    harnessMaturity: "src/eval/harnessMaturity.ts",
    operatorMaturity: "src/eval/operatorOsMaturity.ts",
    connectorCertification: "src/eval/connectorCertification.ts",
    benchmarkRelease: "src/eval/benchmarkRelease.ts",
    postgresLive: "src/eval/postgresLive.ts",
    productionCertifier: "scripts/release/certify-production.mjs",
    testsApi: "tests/api.test.ts",
    testsCore: "tests/core.test.ts",
    testsCoreIntegrations: "tests/core-integrations.test.ts",
    testsEvaluation: "tests/evaluation.test.ts"
  }).find(([, value]) => value === path);
  return entry?.[0] ?? path;
}

function markdown(report: PlanGapAuditReport): string {
  const rows = report.checks
    .map((check) => `| ${check.area} | ${check.id} | ${check.passed ? "yes" : "no"} | ${check.gaps.length ? check.gaps.join("; ") : "none"} |`)
    .join("\n");
  return `# Full Plan Gap Audit

Generated at ${report.generatedAt}.

This audit is intentionally code-backed. Documentation text alone is not accepted as evidence.

| Area | Check | Passed | Gaps |
| --- | --- | ---: | --- |
${rows}
`;
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function cliOptions(argv: string[]): { out?: string; markdown?: string } {
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/plan-gaps-audit.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/plan-gaps.md"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generatePlanGapAudit(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
