#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const json = (path) => JSON.parse(read(path));
const has = (content, needle) => content.includes(needle);

const files = {
  package: read("package.json"),
  bootstrap: read("bootstrap.sh"),
  readme: read("README.md"),
  production: read("docs/production-readiness.md"),
  connectors: read("docs/connectors.md"),
  status: read("docs/implementation-status.md"),
  claims: exists("docs/claims.md") ? read("docs/claims.md") : ""
};

const checks = [
  check("one-command self-hosted install is documented and wired", [
    has(files.package, "setup:selfhosted"),
    has(files.package, "verify:selfhosted"),
    has(files.bootstrap, "--self-hosted"),
    has(files.readme, "npx cognibrain setup --self-hosted"),
    has(files.production, "setup --self-hosted")
  ]),
  check("connector compatibility gates are present", [
    has(files.package, "verify:compatibility"),
    has(files.package, "verify:vendor-live"),
    has(files.connectors, "Connector Compatibility"),
    has(files.connectors, "vendor-live-smoke"),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true && (report.harnesses ?? []).length >= 8),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true),
    artifact("artifacts/vendor-live-smoke.json", (report) => report.passed === true && report.mode === "credential_smoke")
  ]),
  check("Postgres self-hosted hardening proof is fresh enough", [
    artifact("artifacts/postgres-live.json", (report) =>
      report.passed === true &&
      report.acceptance?.startsWithPostgresBackend === true &&
      report.acceptance?.multiUserIsolation === true &&
      report.acceptance?.idempotentMigrations === true &&
      report.acceptance?.indexedLexicalSearch === true &&
      report.acceptance?.transactionRollback === true &&
      report.acceptance?.encryptionKeyConfigured === true &&
      report.acceptance?.backupRecovery === true
    ),
    has(files.claims, "Postgres proof must be rerun for target deployments")
  ]),
  check("SaaS is future track, not current self-hosted claim", [
    has(files.status, "SaaS remains a future track"),
    has(files.claims, "Managed SaaS readiness"),
    has(files.production, "not a managed SaaS certification")
  ])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks);
if (failed.length) {
  console.error(`self-hosted verification failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`self-hosted verification passed: ${checks.length}/${checks.length} checks`);

function check(name, assertions) {
  const failed = assertions.map((value, index) => ({ value, index })).filter((item) => !item.value).map((item) => `assertion ${item.index + 1}`);
  return { name, passed: failed.length === 0, failed };
}

function artifact(path, predicate) {
  if (!exists(path)) return false;
  try {
    return predicate(json(path));
  } catch {
    return false;
  }
}

function writeReport(items) {
  const path = join(root, "artifacts/selfhosted-verification.json");
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      passed: items.filter((item) => item.passed).length,
      failed: items.filter((item) => !item.passed).length
    },
    checks: items
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
