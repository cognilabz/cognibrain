#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);

const files = {
  readme: read("README.md"),
  docsHome: read("docs/README.md"),
  claims: read("docs/claims.md"),
  benchmarks: read("docs/benchmarks.md"),
  reference: read("docs/reference.md"),
  package: read("package.json")
};

const checks = [
  check("canonical docs exist", [
    exists("docs/install.md"),
    exists("docs/benchmarks.md"),
    exists("docs/integrations.md"),
    exists("docs/operations.md"),
    exists("docs/reference.md"),
    exists("docs/claims.md"),
    has(files.docsHome, "Claim Boundary")
  ]),
  check("claim-to-test mapping is present", [
    has(files.claims, "| Claim ID | Claim | Evidence gate | Artifact or source | Boundary |"),
    countClaimRows(files.claims) >= 8,
    has(files.claims, "CB-COGNICODE"),
    has(files.claims, "CB-ARENA"),
    has(files.claims, "Explicit Non-Claims"),
    has(files.readme, "docs/claims.md")
  ]),
  check("marketing claims are bounded by evidence", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.readme, "Boundary: competitor rows are local API-shape compatibility adapters"),
    has(files.claims, "does not currently claim Managed SaaS uptime"),
    has(files.benchmarks, "not vendor-hosted certifications"),
    has(files.reference, "/openapi.json")
  ]),
  check("verification scripts are wired to canonical docs", [
    has(files.package, "\"verify:status\""),
    has(files.package, "\"audit:docs\""),
    has(files.package, "npm run verify:status"),
    has(files.package, "npm run audit:docs"),
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

function countClaimRows(content) {
  return content.split(/\r?\n/).filter((line) => /^\| CB-/.test(line)).length;
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
