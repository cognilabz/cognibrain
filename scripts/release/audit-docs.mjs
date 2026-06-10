#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);

const canonicalDocs = [
  "docs/README.md",
  "docs/install.md",
  "docs/benchmarks.md",
  "docs/integrations.md",
  "docs/status.md",
  "docs/operations.md",
  "docs/reference.md",
  "docs/evidence.md"
];
const generatedDocPatterns = [
  /^docs\/benchmarks\/(?:hardening|latest-arena|landscape)\.md$/,
  /^docs\/integrations\/(?:connector-certification|connector-quality|connector-maturity|harness-maturity)\.md$/,
  /^docs\/operations\/operator-os\.md$/,
  /^docs\/roadmap\//,
  /^docs\/market\//
];
const markdownDocs = walk("docs").filter((path) => path.endsWith(".md")).sort();
const rootMarkdown = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
const files = {
  readme: read("README.md"),
  docsHome: read("docs/README.md"),
  dashboard: exists("operator-ui/src/main.tsx") ? read("operator-ui/src/main.tsx") : "",
  package: read("package.json"),
  install: read("docs/install.md"),
  benchmarks: read("docs/benchmarks.md"),
  integrations: read("docs/integrations.md"),
  status: read("docs/status.md"),
  operations: read("docs/operations.md"),
  reference: read("docs/reference.md"),
  evidence: read("docs/evidence.md")
};
const docsCorpus = [files.readme, files.docsHome, files.install, files.benchmarks, files.integrations, files.status, files.operations, files.reference, files.evidence].join("\n\n");
const packageJson = JSON.parse(files.package);
const packageFiles = Array.isArray(packageJson.files) ? packageJson.files : [];
const connectorCertification = exists("artifacts/connector-certification.json") ? JSON.parse(read("artifacts/connector-certification.json")) : { rows: [] };

const checks = [
  check("documentation is compact and canonical", [
    canonicalDocs.every(exists),
    rootMarkdown.every(exists),
    markdownDocs.every((path) => canonicalDocs.includes(path) || path.startsWith("docs/schemas/") || path.startsWith("docs/adr/")),
    generatedDocPatterns.every((pattern) => !markdownDocs.some((path) => pattern.test(path))),
    !exists("PRODUCT.md"),
    !exists("DESIGN.md"),
    !exists("plan1_5.md"),
    !exists("nextplan.md")
  ]),
  check("README is product-first, not proof-artifact-first", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.readme, "npm i @cognilabz/cognibrain"),
    has(files.readme, "## Public Surface"),
    has(files.readme, "## Current Proof Snapshot"),
    has(files.readme, "Product truth audit"),
    has(files.readme, "CogniCodeBench"),
    has(files.readme, "Real-world black-box harness"),
    has(files.readme, "## Market Position"),
    has(files.readme, "Use MCP for MCP-native agents"),
    has(files.readme, "Use SDK/HTTP for product integrations and custom runtimes"),
    has(files.readme, "## What Cognibrain Is"),
    has(files.readme, "## Honest Boundaries"),
    has(files.readme, "memory feedback-injection"),
    has(files.readme, "unsafeToInject"),
    has(files.readme, "Benchmark results are documented from the checked artifacts"),
    has(files.readme, "docs/status.md"),
    has(files.readme, "docs/evidence.md")
  ]),
  check("operator CLI docs are text-first", [
    has(files.readme, "stable operator CLI"),
    has(files.install, "stable operator CLI"),
    !has(files.package, "\"docs:cli-screenshots\""),
    !exists("scripts/release/render-cli-screenshots.mjs"),
    !exists("src/cli/inkApp.mjs")
  ]),
  check("artifacts are internal outputs, not package content", [
    has(files.benchmarks, "This page records the current checked benchmark artifacts"),
    has(files.operations, "`artifacts/` is ignored by git"),
    has(files.status, "Generated artifacts are local review outputs under `artifacts/`"),
    !/(^|[^A-Za-z0-9_/-])public\/benchmark-arena/.test(files.dashboard),
    !/(^|[^A-Za-z0-9_/-])public\/leaderboard/.test(files.dashboard),
    packageFiles.every((path) => !path.startsWith("artifacts/")),
    packageFiles.every((path) => !path.startsWith("operator-ui")),
    !packageFiles.includes("public/benchmark-arena/"),
    !packageFiles.includes("public/leaderboard/")
  ]),
  check("communication contract is simple", [
    has(files.integrations, "MCP first for agents"),
    has(files.integrations, "CLI for humans and automation"),
    has(files.integrations, "SDK/HTTP only for app and connector integrations"),
    has(files.reference, "For MCP-native agents, use MCP"),
    has(files.reference, "For operators, use the CLI"),
    has(files.reference, "For product integrations, use SDK/HTTP"),
    has(files.reference, "## Context Lifecycle"),
    has(files.reference, "memory feedback-injection"),
    has(files.reference, "Use delivered context first"),
    !has(files.reference, "| `/context-pack` |")
  ]),
  check("runtime status stays evidence-backed", [
    has(files.status, "Runtime Status"),
    has(files.status, "MemoryRepository paths for SQLite and Postgres"),
    has(files.status, "JWT/OIDC verifier"),
    has(files.status, "route-level RBAC"),
    has(files.status, "Evidence anchor"),
    has(files.evidence, "Evidence Register"),
    has(files.evidence, "not a product narrative"),
    has(files.evidence, "artifacts/cognicodebench/run.json"),
    has(files.evidence, "artifacts/arena/run.json"),
    has(files.evidence, "Memory OS comparison follow-up"),
    has(files.evidence, "Market readiness"),
    has(files.docsHome, "## Market Readiness"),
    has(files.benchmarks, "Market Readiness Summary"),
    has(files.benchmarks, "Diagnostic signal; pass gate false"),
    has(files.benchmarks, "No overall \"best memory solution on the market\" claim"),
    has(files.evidence, "Deferred: optional Qdrant retrieval backend")
  ]),
  check("legacy plan-era docs are gone", [
    !/(plan1_|nextplan|Plan1_|Plan1)/.test(docsCorpus),
    !has(files.package, "audit:plan1_"),
    !has(files.package, "demo:plan1_"),
    !exists("scripts/audit-plan1_5.mjs"),
    !exists("scripts/demo-plan1_5.mjs")
  ]),
  check("local markdown links resolve", [localMarkdownLinks().broken.length === 0]),
  check("connector certification claims do not exceed artifact", connectorCertificationClaims())
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

function connectorCertificationClaims() {
  const rows = Array.isArray(connectorCertification.rows) ? connectorCertification.rows : [];
  const proofGate = connectorCertification.proofGate && typeof connectorCertification.proofGate === "object" ? connectorCertification.proofGate : {};
  const tenantClaimAllowed = proofGate.tenantClaimAllowed === true && proofGate.status !== "credential-blocked";
  const productionClaimAllowed = proofGate.productionClaimAllowed === true && proofGate.status === "production-certified";
  const tenantVerifiedProviders = new Set(rows.filter((row) => tenantClaimAllowed && (row?.state === "tenant-verified" || row?.state === "production-certified")).map((row) => String(row.provider).toLowerCase()));
  const productionCertifiedProviders = new Set(rows.filter((row) => productionClaimAllowed && row?.state === "production-certified").map((row) => String(row.provider).toLowerCase()));
  const providers = [...new Set(rows.map((row) => String(row.provider ?? "").toLowerCase()).filter(Boolean))];
  const assertions = [
    !positiveConnectorClaim(docsCorpus, /\bproduction[- ]certified connectors?\b/i) || productionCertifiedProviders.size > 0,
    !positiveConnectorClaim(docsCorpus, /\btenant[- ]verified connectors?\b/i) || tenantVerifiedProviders.size > 0
  ];
  for (const provider of providers) {
    assertions.push(!positiveConnectorClaim(docsCorpus, new RegExp(`\\b${escapeRegExp(provider)}\\b[^\\n.]{0,80}\\bproduction[- ]certified\\b`, "i")) || productionCertifiedProviders.has(provider));
    assertions.push(!positiveConnectorClaim(docsCorpus, new RegExp(`\\b${escapeRegExp(provider)}\\b[^\\n.]{0,80}\\btenant[- ]verified\\b`, "i")) || tenantVerifiedProviders.has(provider));
  }
  return assertions;
}

function positiveConnectorClaim(content, pattern) {
  for (const match of content.matchAll(new RegExp(pattern.source, `${pattern.flags.includes("i") ? "i" : ""}g`))) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(content.length, match.index + match[0].length + 80);
    const window = content.slice(start, end).toLowerCase();
    if (/\b(no|not|without|unless|requires|required|cannot|blocked|credential-blocked|does not mean|never)\b/.test(window)) continue;
    return true;
  }
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
