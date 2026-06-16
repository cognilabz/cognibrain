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
  docsHome: read("docs/index.md"),
  quickstart: read("docs/getting-started/quickstart.md"),
  install: read("docs/getting-started/installation.md"),
  connectors: read("docs/guides/connectors.md"),
  mcp: read("docs/guides/mcp-integration.md"),
  benchmarks: read("docs/benchmarks.md"),
  operations: read("docs/operations/index.md"),
  security: read("docs/operations/security.md"),
  reference: read("docs/reference/index.md"),
  cliReference: read("docs/reference/cli-commands.md"),
  package: read("package.json"),
  internalRunner: read("scripts/internal/run-task.mjs")
};

const checks = [
  check("canonical docs exist", [
    exists("docs/index.md"),
    exists("docs/getting-started/quickstart.md"),
    exists("docs/getting-started/installation.md"),
    exists("docs/guides/connectors.md"),
    exists("docs/guides/mcp-integration.md"),
    exists("docs/operations/security.md"),
    exists("docs/reference/cli-commands.md"),
    has(files.docsHome, "Self-hosted engineering memory for coding agents")
  ]),
  check("public docs expose the operator path", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.quickstart, "npx cognibrain"),
    has(files.install, "npm"),
    has(files.cliReference, "cognibrain"),
    has(files.mcp, "Model Context Protocol"),
    has(files.connectors, "First-Party Connectors"),
    has(files.operations, "Self-Hosting")
  ]),
  check("proof and claim boundaries remain visible", [
    has(files.benchmarks, "Current claim level: Local diagnostic evidence"),
    has(files.benchmarks, "Market leaderboard | Closed"),
    has(files.benchmarks, "No public best-product claim"),
    has(files.connectors, "Credential-blocked"),
    has(files.connectors, "Live-verified"),
    has(files.security, "Never run without auth in production")
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
