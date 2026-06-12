#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const has = (content, needle) => content.includes(needle);

const canonicalDocs = [
  "docs/index.md",
  "docs/getting-started/quickstart.md",
  "docs/getting-started/installation.md",
  "docs/guides/connectors.md",
  "docs/guides/mcp-integration.md",
  "docs/guides/harness-lifecycle.md",
  "docs/guides/memory-management.md",
  "docs/operations/security.md",
  "docs/operations/self-hosting.md",
  "docs/reference/cli-commands.md",
  "docs/reference/mcp-tools.md",
  "docs/reference/sdk-typescript.md",
  "docs/reference/sdk-python.md",
  "docs/benchmarks.md"
];
const markdownDocs = walk("docs").filter((path) => path.endsWith(".md")).sort();
const rootMarkdown = ["README.md", "CONTRIBUTING.md", "SECURITY.md"];
const files = {
  readme: read("README.md"),
  docsHome: read("docs/index.md"),
  quickstart: read("docs/getting-started/quickstart.md"),
  install: read("docs/getting-started/installation.md"),
  connectors: read("docs/guides/connectors.md"),
  mcp: read("docs/guides/mcp-integration.md"),
  harness: read("docs/guides/harness-lifecycle.md"),
  memory: read("docs/guides/memory-management.md"),
  benchmarks: read("docs/benchmarks.md"),
  operations: read("docs/operations/index.md"),
  security: read("docs/operations/security.md"),
  reference: read("docs/reference/index.md"),
  cliReference: read("docs/reference/cli-commands.md"),
  mcpReference: read("docs/reference/mcp-tools.md"),
  package: read("package.json")
};
const docsCorpus = [
  files.readme,
  files.docsHome,
  files.quickstart,
  files.install,
  files.connectors,
  files.mcp,
  files.harness,
  files.memory,
  files.benchmarks,
  files.operations,
  files.security,
  files.reference,
  files.cliReference,
  files.mcpReference
].join("\n\n");
const packageJson = JSON.parse(files.package);
const packageFiles = Array.isArray(packageJson.files) ? packageJson.files : [];
const connectorCertification = exists("artifacts/connector-certification.json") ? JSON.parse(read("artifacts/connector-certification.json")) : { rows: [] };

const checks = [
  check("documentation is mkdocs-structured and canonical", [
    canonicalDocs.every(exists),
    rootMarkdown.every(exists),
    exists("mkdocs.yml"),
    markdownDocs.every((path) =>
      path.startsWith("docs/getting-started/") ||
      path.startsWith("docs/guides/") ||
      path.startsWith("docs/reference/") ||
      path.startsWith("docs/operations/") ||
      path.startsWith("docs/concepts/") ||
      path.startsWith("docs/contributing/") ||
      path.startsWith("docs/adr/") ||
      path === "docs/index.md" ||
      path === "docs/benchmarks.md"
    ),
    !exists("docs/README.md"),
    !exists("docs/integrations.md"),
    !exists("PRODUCT.md"),
    !exists("DESIGN.md"),
    !exists("plan1_5.md"),
    !exists("nextplan.md")
  ]),
  check("README points users to the public docs site", [
    has(files.readme, "Self-hosted engineering memory for coding agents"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.readme, "npm i @cognilabz/cognibrain"),
    has(files.readme, "cognibrain.cognilabz.com"),
    has(files.readme, "MCP Integration"),
    has(files.readme, "Self-Hosting")
  ]),
  check("operator and integration docs cover the supported surfaces", [
    has(files.cliReference, "cognibrain"),
    has(files.mcp, "MCP-native agents"),
    has(files.mcpReference, "context"),
    has(files.harness, "Harness"),
    has(files.connectors, "First-Party Connectors"),
    has(files.connectors, "Credential-blocked"),
    has(files.memory, "memory")
  ]),
  check("proof boundaries are visible", [
    has(files.benchmarks, "# Benchmark Evidence"),
    has(files.benchmarks, "_Current claim level: Local diagnostic evidence_"),
    has(files.benchmarks, "_Market leaderboard: Not open_"),
    has(files.benchmarks, "Each visible number above is backed by a generated timestamp and artifact path."),
    has(files.benchmarks, "They remain available in `artifacts/` and generated benchmark reports"),
    has(files.security, "Never run without auth in production"),
    has(files.security, "Connector tokens are stored as `env:` references")
  ]),
  check("artifacts are internal outputs, not package content", [
    packageFiles.every((path) => !path.startsWith("artifacts/")),
    packageFiles.every((path) => !path.startsWith("operator-ui")),
    !packageFiles.includes("public/benchmark-arena/"),
    !packageFiles.includes("public/leaderboard/")
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
    if (/\b(no|not|without|unless|requires|required|cannot|blocked|credential-blocked|does not mean|never|needs)\b/.test(window)) continue;
    return true;
  }
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function walk(dir) {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).flatMap((entry) => {
    const path = join(dir, entry);
    const fullPath = join(root, path);
    if (statSync(fullPath).isDirectory()) return walk(path);
    return [path];
  });
}
