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
  plan: exists("plan1_5.md") ? read("plan1_5.md") : "",
  service: read("src/api/service.ts"),
  types: read("src/core/types.ts"),
  vendorConnectors: read("src/connectors/vendorConnectors.ts"),
  vendorLive: read("src/eval/vendorConnectorsLive.ts"),
  vendorSmoke: read("src/eval/vendorCredentialSmoke.ts"),
  arena: read("src/eval/arena.ts"),
  cli: read("bin/cognibrain.mjs"),
  dashboard: read("src/dashboard/main.tsx"),
  connectors: read("docs/connectors.md"),
  claims: read("docs/claims.md"),
  messaging: read("docs/marketing/messaging.md"),
  sameBenchmark: read("docs/market/same-benchmark.md"),
  landscape: read("docs/benchmarks/landscape.md"),
  proofLevels: read("docs/benchmarks/proof-levels.md"),
  arenaDocs: read("docs/benchmarks/arena.md"),
  publicResults: read("public/benchmark-arena/results.json"),
  publicHtml: read("public/benchmark-arena/index.html")
};

const vendorIds = ["official-github", "official-slack", "official-discord", "official-jira", "official-confluence", "official-notion", "official-linear"];
const vendorProviders = ["github", "slack", "discord", "jira", "confluence", "notion", "linear"];
const plannedConnectorIds = ["official-gitlab", "official-azure-devops", "official-microsoft-teams", "official-google-drive", "official-gmail", "official-google-calendar"];
const checks = [
  check("plan1_5 tracking issue list is present", [
    exists("plan1_5.md") && has(files.plan, "nächster Plan"),
    has(files.plan, "Benchmark Arena"),
    has(files.plan, "Jira") && has(files.plan, "Confluence") && has(files.plan, "Notion") && has(files.plan, "Linear")
  ]),
  check("first-class vendor drivers are implemented", [
    vendorIds.every((id) => has(files.service, id)),
    vendorProviders.every((provider) => has(files.types, `"${provider}"`)),
    ["listJira", "writeJira", "listConfluence", "writeConfluence", "listNotion", "writeNotion", "listLinear", "writeLinear"].every((symbol) => has(files.vendorConnectors, symbol)),
    ["MEMORY_JIRA_BASE_URL", "MEMORY_CONFLUENCE_BASE_URL", "MEMORY_NOTION_DATABASE_ID", "MEMORY_LINEAR_TEAM_ID"].every((env) => has(files.vendorConnectors, env))
  ]),
  check("planned connector contracts are explicit", [
    plannedConnectorIds.every((id) => has(files.service, id)),
    has(files.connectors, "GitLab vendor"),
    has(files.connectors, "Azure DevOps vendor"),
    has(files.connectors, "Microsoft Teams vendor"),
    has(files.connectors, "| Gmail vendor |"),
    has(files.connectors, "| Google Drive vendor |"),
    has(files.connectors, "| Google Calendar vendor |"),
    has(files.connectors, "| planned |")
  ]),
  check("vendor verification covers every provider", [
    vendorIds.every((id) => has(files.vendorLive, id)),
    ["jiraUsesSearch", "confluenceUsesContent", "notionQueriesDatabase", "linearUsesGraphQL"].every((checkName) => has(files.vendorLive, checkName)),
    ["jiraCorrectionTagged", "confluenceArchitectureTagged", "notionDecisionTagged", "linearCorrectionTagged"].every((checkName) => has(files.vendorLive, checkName)),
    vendorProviders.every((provider) => has(files.vendorSmoke, provider)),
    artifact("artifacts/vendor-connectors-live.json", (report) => report.passed === true && ["jiraUsesSearch", "confluenceUsesContent", "notionQueriesDatabase", "linearUsesGraphQL"].every((name) => report.checks?.[name] === true))
  ]),
  check("guided self-hosted install is wired", [
    has(files.cli, "case \"init\""),
    has(files.cli, "connector add"),
    has(files.cli, "doctor --fix"),
    has(files.cli, "writeSetupState"),
    has(files.cli, "writeConnectorConfig"),
    has(files.package, "\"demo:first-win\""),
    artifact("artifacts/demos/first-win.json", (report) => report.passed === true && report.install?.profile === "solo-dev")
  ]),
  check("benchmark arena is replayable and public", [
    has(files.package, "\"benchmark:arena\""),
    has(files.arena, "MemorySystemAdapter"),
    has(files.arena, "same-run-full"),
    has(files.arena, "same-run-api-shape"),
    ["mem0", "graphiti", "cognee", "langmem", "gbrain"].every((system) => has(files.arena, system)),
    artifact("artifacts/arena/run.json", (report) => report.passed === true && report.systems?.some((system) => system.system === "cognibrain" && system.proofLevel === "same-run-full") && report.leaderboard?.[0]?.system === "Cognibrain"),
    exists("public/benchmark-arena/index.html"),
    exists("public/benchmark-arena/results.json")
  ]),
  check("marketing and claim boundaries are updated", [
    has(files.claims, "CB-CLAIM-BENCHMARK-ARENA"),
    has(files.messaging, "Same-benchmark proof"),
    has(files.sameBenchmark, "Same Benchmark, No Slogan"),
    has(files.landscape, "Benchmark Landscape"),
    has(files.proofLevels, "same-run-api-shape"),
    has(files.arenaDocs, "Benchmark Arena"),
    has(files.readme, "Benchmark Arena"),
    has(files.publicHtml, "same-run-full")
  ]),
  check("dashboard exposes arena proof", [
    has(files.dashboard, "Benchmark Arena"),
    has(files.dashboard, "benchmarkArenaProof"),
    has(files.dashboard, "BenchmarkArena"),
    has(files.dashboard, "artifacts/arena/run.json")
  ]),
  check("plan1_5 scripts are release-wired", [
    has(files.package, "\"audit:plan1_5\""),
    has(files.package, "\"verify:nextgen\"") && has(files.package, "audit:plan1_5") && has(files.package, "benchmark:arena"),
    exists("scripts/audit-plan1_5.mjs")
  ]),
  check("local markdown links resolve", [localMarkdownLinks().broken.length === 0])
];

const failed = checks.filter((item) => !item.passed);
for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}${item.failed.length ? ` -> ${item.failed.join(", ")}` : ""}`);
writeReport(checks);
if (failed.length) {
  console.error(`plan1_5 audit failed: ${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`plan1_5 audit passed: ${checks.length}/${checks.length} checks`);

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
  const path = join(root, "artifacts/plan1_5-audit.json");
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
