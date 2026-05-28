#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);
const packageJson = JSON.parse(read("package.json"));
const packageFiles = Array.isArray(packageJson.files) ? packageJson.files : [];

const files = {
  readme: read("README.md"),
  docsHome: read("docs/README.md"),
  evidence: read("docs/evidence.md"),
  status: read("docs/status.md"),
  benchmarks: read("docs/benchmarks.md"),
  reference: read("docs/reference.md"),
  integrations: read("docs/integrations.md"),
  operations: read("docs/operations.md"),
  package: read("package.json"),
  internalRunner: read("scripts/internal/run-task.mjs")
};

const checks = [
  check("canonical docs exist", [
    exists("docs/install.md"),
    exists("docs/benchmarks.md"),
    exists("docs/integrations.md"),
    exists("docs/status.md"),
    exists("docs/operations.md"),
    exists("docs/reference.md"),
    exists("docs/evidence.md"),
    has(files.docsHome, "Documentation Standard")
  ]),
  check("evidence register is present", [
    has(files.evidence, "| Area | Evidence anchor | Notes |"),
    countEvidenceRows(files.evidence) >= 8,
    has(files.evidence, "CogniCodeBench"),
    has(files.evidence, "Arena"),
    has(files.status, "Runtime Status"),
    has(files.evidence, "Storage boundary"),
    has(files.evidence, "not a product narrative"),
    has(files.readme, "docs/evidence.md"),
    has(files.readme, "docs/status.md")
  ]),
  check("public docs are bounded by evidence", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.readme, "Benchmark results are documented from the checked artifacts"),
    has(files.evidence, "not a product narrative"),
    has(files.benchmarks, "This page records the current checked benchmark artifacts"),
    has(files.benchmarks, "same-run-api-shape"),
    has(files.benchmarks, "credential-blocked"),
    has(files.status, "Runtime Status"),
    has(files.status, "MemoryRepository paths for SQLite and Postgres"),
    has(files.status, "JWT/OIDC verifier"),
    has(files.status, "route-level RBAC"),
    has(files.status, "Generated artifacts are local review outputs"),
    has(files.integrations, "MCP first for agents"),
    has(files.reference, "For MCP-native agents, use MCP")
  ]),
  check("generated outputs stay internal", [
    packageFiles.every((path) => !path.startsWith("artifacts/")),
    !packageFiles.includes("public/benchmark-arena/"),
    !packageFiles.includes("public/leaderboard/"),
    has(files.package, "\"internal\""),
    has(files.internalRunner, "verify:status"),
    has(files.internalRunner, "audit:docs"),
    !has(files.package, "audit:plan1_")
  ])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks);
if (failed.length) {
  console.error(`status verification failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`status verification passed: ${checks.length}/${checks.length} checks`);

function check(name, assertions) {
  const failed = assertions.map((value, index) => ({ value, index })).filter((item) => !item.value).map((item) => `assertion ${item.index + 1}`);
  return { name, passed: failed.length === 0, failed };
}

function countEvidenceRows(content) {
  return content.split(/\r?\n/).filter((line) => /^\| [A-Za-z]/.test(line)).length;
}

function writeReport(items) {
  const path = join(root, "artifacts", "status-verification.json");
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
