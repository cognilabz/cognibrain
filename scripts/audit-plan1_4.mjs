#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const json = (path) => JSON.parse(read(path));
const has = (content, needle) => content.includes(needle);
const files = {
  package: read("package.json"),
  readme: read("README.md"),
  product: read("PRODUCT.md"),
  claims: read("docs/claims.md"),
  status: read("docs/implementation-status.md"),
  connectors: read("docs/connectors.md"),
  production: read("docs/production-readiness.md"),
  api: read("docs/api-reference.md"),
  types: read("src/core/types.ts"),
  engineering: read("src/core/engineeringMemory.ts"),
  service: read("src/api/service.ts"),
  cli: read("src/cli/memctl.ts"),
  mcp: read("src/connectors/mcpServer.ts"),
  dashboard: read("src/dashboard/main.tsx"),
  tests: read("tests/core.test.ts"),
  ccb: read("docs/benchmarks/cognicodebench.md"),
  githubIntegration: read("docs/integrations/github.md")
};

const requiredDocs = [
  "docs/marketing/messaging.md",
  "docs/marketing/launch-narrative.md",
  "docs/marketing/social-snippets.md",
  "docs/marketing/claims.md",
  "docs/getting-started/quickstart.md",
  "docs/getting-started/local-install.md",
  "docs/getting-started/self-hosted-install.md",
  "docs/getting-started/first-engineering-memory.md",
  "docs/concepts/engineering-memory.md",
  "docs/concepts/evidence-pack.md",
  "docs/concepts/context-pack.md",
  "docs/concepts/corrections.md",
  "docs/concepts/tool-outcomes.md",
  "docs/concepts/procedure-memory.md",
  "docs/concepts/temporal-belief-graph.md",
  "docs/concepts/policy-aware-retrieval.md",
  "docs/integrations/claude-code.md",
  "docs/integrations/codex.md",
  "docs/integrations/cursor.md",
  "docs/integrations/github-copilot.md",
  "docs/integrations/vscode.md",
  "docs/integrations/opencode.md",
  "docs/integrations/langgraph.md",
  "docs/integrations/crewai.md",
  "docs/integrations/github.md",
  "docs/integrations/slack-discord.md",
  "docs/integrations/mcp.md",
  "docs/benchmarks/cognicodebench.md",
  "docs/benchmarks/methodology.md",
  "docs/benchmarks/results.md",
  "docs/benchmarks/ablations.md",
  "docs/production/overview.md",
  "docs/production/storage.md",
  "docs/production/auth.md",
  "docs/production/policy.md",
  "docs/production/backup-restore.md",
  "docs/production/observability.md",
  "docs/production/migrations.md",
  "docs/production/security.md",
  "docs/production/release-checklist.md",
  "docs/production/badges.md",
  "docs/compare/mem0.md",
  "docs/compare/gbrain.md",
  "docs/compare/hindsight.md",
  "docs/compare/zep.md",
  "docs/compare/cognee.md",
  "docs/market/why-engineering-memory-os.md",
  "docs/market/stop-fixing-same-agent-mistake.md",
  "docs/market/cognicodebench-proof.md",
  "docs/market/evidence-grade-memory.md",
  "docs/market/cognibrain-vs-cognee.md",
  "docs/status.md",
  "docs/README.md",
  "fixtures/cognicodebench/demo-repos.json",
  "fixtures/connectors/github-review-demo.json",
  "scripts/demo-plan1_4.mjs",
  "artifacts/demos/why-used.json",
  "artifacts/demos/cognicodebench-demo-replay.json",
  "artifacts/demos/github-review.json",
  "artifacts/demos/plan1_4-demos.json"
];

const claimIds = [
  "CB-CLAIM-CONTEXT",
  "CB-CLAIM-EVIDENCE",
  "CB-CLAIM-PATCH-EVIDENCE",
  "CB-CLAIM-COGNICODE",
  "CB-CLAIM-ABLATION",
  "CB-CLAIM-GUARD",
  "CB-CLAIM-PLANNER",
  "CB-CLAIM-MCP",
  "CB-CLAIM-STORAGE",
  "CB-CLAIM-STATUS",
  "CB-CLAIM-CONNECTORS",
  "CB-CLAIM-CONNECTOR-MATURITY",
  "CB-CLAIM-PRODUCTION",
  "CB-CLAIM-OBSERVABILITY",
  "CB-CLAIM-RELEASE",
  "CB-CLAIM-MARKET"
];

const checks = [
  check("plan1_4 docs information architecture exists", requiredDocs.map((path) => exists(path))),
  check("local markdown links resolve", [localMarkdownLinks().broken.length === 0]),
  check("canonical marketing and README alignment", [
    has(read("docs/marketing/messaging.md"), "Stop fixing the same agent mistake twice"),
    has(files.readme, "Stop fixing the same agent mistake twice"),
    has(files.product, "docs/marketing/messaging.md"),
    has(files.readme, "docs/marketing/messaging.md"),
    claimIds.every((id) => has(files.claims, id))
  ]),
  check("comparison and market pages are bounded", [
    ["mem0", "gbrain", "hindsight", "zep", "cognee"].every((name) => exists(`docs/compare/${name}.md`)),
    has(read("docs/compare/mem0.md"), "Benchmark Boundary"),
    has(read("docs/compare/cognee.md"), "Honest Limitations"),
    has(files.claims, "Do not claim vendor leadership")
  ]),
  check("CogniCodeBench is flagship proof with baselines and demos", [
    has(files.ccb, "Latest Baseline Table"),
    has(files.ccb, "Real Demo Repo Scenarios"),
    has(files.ccb, "npm run demo:cognicodebench"),
    artifact("artifacts/cognicodebench/run.json", (report) => report.passed === true && report.scenarioCount >= 100 && report.ablation?.cognibrain_full?.score === 1),
    artifact("fixtures/cognicodebench/demo-repos.json", (report) => (report.demos ?? []).length === 5),
    artifact("artifacts/demos/cognicodebench-demo-replay.json", (report) => report.passed === true && report.scenarioCount === 5)
  ]),
  check("evidence and patch trail product surfaces are complete", [
    has(files.types, "memoriesUsed"),
    has(files.types, "correctionsApplied"),
    has(files.types, "forbiddenActionsAvoided"),
    has(files.types, "toolOutcomes"),
    has(files.engineering, "staleMemoriesExcluded"),
    has(files.service, "patchEvidenceTrail"),
    has(files.api, "Patch Evidence Trails"),
    has(files.mcp, "memory_patch_evidence"),
    has(files.cli, "patch-evidence"),
    has(files.cli, "searchFiltersFromEnv"),
    has(files.dashboard, "Patch Evidence Trail"),
    has(files.dashboard, "Export evidence JSON"),
    has(files.dashboard, "engineering-kind-filter"),
    artifact("artifacts/demos/why-used.json", (report) => report.passed === true && report.trail?.forbiddenActionsAvoided?.length > 0)
  ]),
  check("engineering correction and tool-outcome pipeline is implemented", [
    has(files.service, "derivedCorrectionMemories"),
    has(files.service, "correctionPipeline"),
    has(files.service, "durationMs"),
    has(files.service, "outputSummary"),
    has(files.service, "successReason"),
    has(files.service, "environmentHints"),
    has(files.tests, "derivedMemoryIds"),
    has(files.tests, "filesTouched"),
    has(files.tests, "runs a retrieval and patch-evidence loop for every engineering memory type")
  ]),
  check("connector docs and maturity matrix are present", [
    has(files.connectors, "Connector Maturity Matrix"),
    has(files.connectors, "vendor-smoke required"),
    has(files.connectors, "integrations/github.md"),
    has(files.githubIntegration, "npm run demo:github-review"),
    artifact("artifacts/demos/github-review.json", (report) => report.passed === true && report.connectorId === "official-github" && String(report.reviewCommentUrl).includes("discussion_r1")),
    artifact("artifacts/connectors-live.json", (report) => report.passed === true),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true),
    artifact("artifacts/vendor-live-smoke.json", (report) => report.passed === true)
  ]),
  check("architecture diagrams cover plan lifecycles", [
    has(files.readme, "Memory Router"),
    has(read("docs/concepts/corrections.md"), "Future action guard"),
    has(files.connectors, "SourceRef provenance"),
    has(read("docs/lifecycle.md"), "Dream due check"),
    has(read("docs/concepts/policy-aware-retrieval.md"), "Policy rule evaluation"),
    has(files.ccb, "Scenario score")
  ]),
  check("production docs, observability and boundary badges are explicit", [
    has(files.production, "not a managed SaaS certification"),
    has(read("docs/production/observability.md"), "/metrics"),
    has(read("docs/production/badges.md"), "managed SaaS future"),
    has(files.status, "Plan1_4 tracking issue #322"),
    has(files.claims, "Metrics are local operational aggregates")
  ]),
  check("release automation is wired", [
    has(files.package, "\"release:check\""),
    has(files.package, "\"audit:plan1_4\""),
    has(files.package, "\"demo:plan1_4\""),
    exists("scripts/release-check.mjs"),
    exists("scripts/audit-plan1_4.mjs"),
    has(files.production, "npm run release:check"),
    has(read("docs/production/release-checklist.md"), "artifacts/release-check.json")
  ])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks);
if (failed.length) {
  console.error(`plan1_4 audit failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`plan1_4 audit passed: ${checks.length}/${checks.length} checks`);

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
  const path = join(root, "artifacts/plan1_4-audit.json");
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

function localMarkdownLinks() {
  const markdownFiles = ["README.md", "PRODUCT.md", ...walk("docs").filter((path) => path.endsWith(".md"))];
  const broken = [];
  for (const path of markdownFiles) {
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

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    if (name === "node_modules" || name === ".git" || name === "dist") return [];
    const path = join(dir, name);
    const absolute = join(root, path);
    return statSync(absolute).isDirectory() ? walk(path) : [path];
  });
}
