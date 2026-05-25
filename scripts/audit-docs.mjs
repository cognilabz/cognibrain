#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);

const docs = [
  "docs/README.md",
  "docs/install.md",
  "docs/benchmarks.md",
  "docs/integrations.md",
  "docs/operations.md",
  "docs/reference.md",
  "docs/claims.md"
];
const markdownDocs = walk("docs").filter((path) => path.endsWith(".md")).sort();
const rootMarkdown = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
const files = {
  readme: read("README.md"),
  package: read("package.json"),
  install: read("docs/install.md"),
  benchmarks: read("docs/benchmarks.md"),
  integrations: read("docs/integrations.md"),
  operations: read("docs/operations.md"),
  reference: read("docs/reference.md"),
  claims: read("docs/claims.md")
};

const checks = [
  check("documentation is compact and canonical", [
    docs.every(exists),
    markdownDocs.length === docs.length,
    rootMarkdown.every(exists),
    !exists("PRODUCT.md"),
    !exists("DESIGN.md"),
    !exists("plan1_5.md"),
    !exists("nextplan.md")
  ]),
  check("README represents the product clearly", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.readme, "npm i @cognilabz/cognibrain"),
    has(files.readme, "Benchmark Arena"),
    has(files.readme, "Current local Benchmark Arena result"),
    has(files.readme, "Boundary: competitor rows are local API-shape compatibility adapters"),
    has(files.readme, "docs/assets/cli-home.svg"),
    has(files.readme, "docs/operations.md")
  ]),
  check("screenshots are real checked assets", [
    exists("docs/assets/cli-home.svg"),
    exists("docs/assets/cli-connections.svg"),
    exists("docs/assets/cli-service.svg"),
    exists("docs/assets/cli-config.svg"),
    exists("docs/assets/cli-sdk.svg"),
    exists("docs/assets/dashboard-workbench.png"),
    exists("docs/assets/dashboard-benchmarks.png"),
    has(files.package, "\"docs:cli-screenshots\"")
  ]),
  check("benchmark claims are bounded by artifacts", [
    has(files.benchmarks, "artifacts/arena/run.json"),
    has(files.benchmarks, "0.9722"),
    has(files.benchmarks, "same-run-full"),
    has(files.benchmarks, "same-run-api-shape"),
    has(files.benchmarks, "not vendor-hosted certifications"),
    exists("artifacts/arena/run.json"),
    exists("artifacts/cognicodebench/run.json")
  ]),
  check("install and service docs cover self-hosting", [
    has(files.install, "npx cognibrain init"),
    has(files.install, "npx cognibrain service install --activate"),
    has(files.install, "systemd"),
    has(files.install, "launchd"),
    has(files.install, "Task Scheduler"),
    has(files.operations, "self-hosted operation first"),
    has(files.operations, "managed SaaS")
  ]),
  check("connectors, adapters and SDK are discoverable", [
    has(files.integrations, "Native Connectors"),
    has(files.integrations, "GitHub, GitLab, Azure DevOps"),
    has(files.integrations, "Sentry, Datadog, PagerDuty and PostHog"),
    has(files.integrations, "Platform SDK"),
    has(files.integrations, "cognibrain sdk platform"),
    has(files.reference, "cognibrain connections add"),
    has(files.reference, "/openapi.json")
  ]),
  check("claim map keeps marketing honest", [
    countClaimRows(files.claims) >= 8,
    has(files.claims, "CB-CLI-INK"),
    has(files.claims, "CB-ARENA"),
    has(files.claims, "Explicit Non-Claims"),
    has(files.claims, "vendor-certified competitor benchmark results"),
    has(files.readme, "does not claim managed SaaS uptime")
  ]),
  check("legacy plan-era wording is gone from product docs and scripts", [
    !/(plan1_|nextplan|Plan1_|Plan1)/.test(files.readme),
    !/(plan1_|nextplan|Plan1_|Plan1)/.test(docs.map(read).join("\n")),
    !has(files.package, "audit:plan1_"),
    !has(files.package, "demo:plan1_"),
    !exists("scripts/audit-plan1_5.mjs"),
    !exists("scripts/demo-plan1_5.mjs")
  ]),
  check("local markdown links resolve", [localMarkdownLinks().broken.length === 0])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks);
if (failed.length) {
  console.error(`docs audit failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`docs audit passed: ${checks.length}/${checks.length} checks`);

function check(name, assertions) {
  const failed = assertions.map((value, index) => ({ value, index })).filter((item) => !item.value).map((item) => `assertion ${item.index + 1}`);
  return { name, passed: failed.length === 0, failed };
}

function countClaimRows(content) {
  return content.split(/\r?\n/).filter((line) => /^\| CB-/.test(line)).length;
}

function localMarkdownLinks() {
  const filesToCheck = [...rootMarkdown, ...markdownDocs, "sdk/python/README.md"].filter(exists);
  const broken = [];
  for (const path of filesToCheck) {
    const content = read(path);
    const links = content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g);
    for (const match of links) {
      let link = match[1].trim();
      if (!link || link.startsWith("http") || link.startsWith("mailto:") || link.startsWith("#")) continue;
      link = link.split("#")[0].replace(/^<|>$/g, "");
      if (!link) continue;
      const target = normalize(join(root, dirname(path), link));
      if (!existsSync(target)) broken.push({ path, link });
    }
  }
  return { broken };
}

function writeReport(items) {
  const path = join(root, "artifacts", "docs-audit.json");
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      passed: items.filter((item) => item.passed).length,
      failed: items.filter((item) => !item.passed).length
    },
    markdownDocs,
    checks: items
  };
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}

function walk(dir) {
  if (!exists(dir)) return [];
  const entries = [];
  for (const name of readdirSafe(join(root, dir))) {
    const full = join(root, dir, name);
    const relative = join(dir, name);
    const stat = statSafe(full);
    if (!stat) continue;
    if (stat.isDirectory()) entries.push(...walk(relative));
    else entries.push(relative);
  }
  return entries;
}

function readdirSafe(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function statSafe(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
