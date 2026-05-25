#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);

const files = {
  readme: read("README.md"),
  status: read("docs/implementation-status.md"),
  claims: exists("docs/claims.md") ? read("docs/claims.md") : "",
  package: read("package.json"),
  apiDocs: read("docs/api-reference.md"),
  benchDocs: read("docs/benchmarks/cognicodebench.md")
};

const checks = [
  check("status matrix exists and has plan1_3 production columns", [
    has(files.status, "| Feature | Code implemented | API exposed | CLI exposed | MCP exposed | Dashboard exposed | Tests | Docs | Production ready? |"),
    has(files.status, "Plan1_3 implementation issues #310-#315"),
    has(files.status, "verify:status"),
    has(files.readme, "docs/implementation-status.md")
  ]),
  check("claim-to-test mapping is present", [
    exists("docs/claims.md"),
    has(files.claims, "| Claim ID | Public claim | Evidence gate | Artifact or test | Claim boundary |"),
    countClaimRows(files.claims) >= 10,
    has(files.claims, "CB-CLAIM-COGNICODE"),
    has(files.claims, "CB-CLAIM-PRODUCTION"),
    has(files.readme, "docs/claims.md")
  ]),
  check("marketing claims are bounded by evidence", [
    has(files.readme, "self-hosted production candidate"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.claims, "Do not claim managed SaaS"),
    has(files.claims, "Explicit Non-Claims"),
    has(files.status, "Strict Plan1_3 re-audit"),
    has(files.status, "self-hosted production readiness"),
    has(files.status, "SaaS remains a future track"),
    has(files.status, "synthetic Engineering Memory proof"),
    has(files.claims, "benchmark:cognicode"),
    has(files.apiDocs, "/openapi.json"),
    has(files.benchDocs, "CogniCodeBench")
  ]),
  check("plan1_3 status reflects current proof level", [
    has(files.status, "50 coding-agent intent cases"),
    has(files.status, "legacy-repo layouts"),
    has(files.status, "real tenant vendor connector smokes"),
    has(files.claims, "measured no-memory"),
    has(files.status, "Postgres operation through a deployment pooler")
  ]),
  check("verification scripts are wired", [
    has(files.package, "\"verify:status\""),
    has(files.package, "\"audit:plan1_3\""),
    has(files.package, "npm run verify:status"),
    has(files.package, "npm run audit:plan1_3")
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
  return content.split(/\r?\n/).filter((line) => /^\| CB-CLAIM-/.test(line)).length;
}

function writeReport(items) {
  const path = join(root, "artifacts/status-verification.json");
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
