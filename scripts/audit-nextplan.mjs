#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const files = {
  readme: read("README.md"),
  package: read("package.json"),
  service: read("src/api/service.ts"),
  server: read("src/api/server.ts"),
  cli: read("src/cli/memctl.ts"),
  coreTypes: read("src/core/types.ts"),
  retrieval: read("src/core/retrieval.ts"),
  reflection: read("src/core/reflection.ts"),
  domain: read("src/core/domain.ts"),
  dashboard: read("src/dashboard/main.tsx"),
  docsAdvanced: read("docs/advanced-features.md"),
  docsConnectors: read("docs/connectors.md"),
  docsMarket: read("docs/market-comparison.md"),
  docsAudit: read("docs/market-analysis-implementation-audit.md"),
  nextplan: read("nextplan.md")
};

const checks = [
  {
    id: "WP 1.1",
    name: "Agent Memory OS positioning",
    tests: [
      includes(files.readme, "Inspectable Agent Memory OS"),
      includes(files.readme, "Memory Router"),
      includes(files.readme, "cognibrain position"),
      exists("docs/market-comparison.md"),
      includes(files.readme, "first-five-minutes proof surface")
    ]
  },
  {
    id: "WP 1.2",
    name: "Why-used evidence demo",
    tests: [
      includes(files.cli, "why-used"),
      includes(files.cli, "evidence-pack"),
      includes(files.readme, "memory evidence <context-pack-id>"),
      includes(files.server, "getEvidencePack"),
      includes(files.dashboard, "Context Pack Preview"),
      exists("docs/assets/dashboard-recall.png")
    ]
  },
  {
    id: "WP 2.1",
    name: "MemoryRecordV2 canonical schema",
    tests: [
      includes(files.coreTypes, "MemoryRecordV2"),
      exists("docs/schemas/memory-record-v2.schema.json"),
      includes(files.cli, "inspect"),
      includes(files.service, "schemaVersion")
    ]
  },
  {
    id: "WP 2.2",
    name: "Validity and belief state",
    tests: ["active", "stale", "superseded", "contradicted", "needs_verification", "retracted"].map((state) => includes(files.coreTypes + files.reflection + files.retrieval, state))
  },
  {
    id: "WP 3.1",
    name: "Temporal graph core",
    tests: [
      includes(files.coreTypes, "validFrom"),
      includes(files.coreTypes, "validUntil"),
      includes(files.cli, "graph-query"),
      includes(files.cli, "graph-changes"),
      includes(files.server, "/graph/explain")
    ]
  },
  {
    id: "WP 3.2",
    name: "Multi-hop retrieval strategy",
    tests: [
      includes(files.retrieval, "graphDepth"),
      includes(files.cli, "graph-path"),
      includes(files.package, "benchmark:nextgen"),
      includes(files.docsAdvanced, "graph path")
    ]
  },
  {
    id: "WP 3.3",
    name: "Connection explainer",
    tests: [
      includes(files.server, "/graph/explain"),
      includes(files.cli, "explain"),
      includes(files.dashboard, "Graph Explorer"),
      includes(files.docsMarket + files.docsAdvanced, "connection explanation")
    ]
  },
  {
    id: "WP 4.1",
    name: "Brain/source/agent/persona router",
    tests: [
      includes(files.service, "routeMemory"),
      includes(files.coreTypes, "MemoryRouteReport"),
      includes(files.cli, "route"),
      includes(files.dashboard, "Route Preview"),
      includes(files.coreTypes, "persona")
    ]
  },
  {
    id: "WP 4.2",
    name: "Shared team memory workflow",
    tests: [
      includes(files.service, "requestSharedMemory"),
      includes(files.service, "promoteSharedMemory"),
      includes(files.service, "revokeSharedMemory"),
      includes(files.cli, "promote"),
      includes(files.cli, "review")
    ]
  },
  {
    id: "WP 5.1",
    name: "Multi-strategy retrieval fusion",
    tests: ["semantic", "keyword", "entity", "temporal", "behavioral", "trust", "graph", "access", "rrf"].map((signal) => includes(files.retrieval + files.dashboard, signal))
  },
  {
    id: "WP 5.2",
    name: "Query intent classifier",
    tests: [
      includes(files.service, "classifyQueryIntent"),
      includes(files.cli, "intent"),
      includes(files.coreTypes, "multi_hop_question"),
      includes(files.coreTypes, "temporal_question")
    ]
  },
  {
    id: "WP 5.3",
    name: "Retrieval learning",
    tests: [
      includes(files.service, "recordInjectionFeedback"),
      includes(files.service, "learnRetrievalProfile"),
      includes(files.cli, "profile-learn"),
      includes(files.cli, "feedback-injection")
    ]
  },
  {
    id: "WP 6.1",
    name: "Episode store",
    tests: [
      includes(files.coreTypes, "EpisodeRecord"),
      includes(files.service, "createEpisode"),
      includes(read("src/core/store.ts") + files.docsAdvanced + read("docs/api-reference.md"), "extractedFromEpisodeId"),
      includes(files.cli, "episode")
    ]
  },
  {
    id: "WP 6.2",
    name: "Evidence pack export",
    tests: [
      includes(files.coreTypes, "EvidencePack"),
      includes(files.service, "evidencePacks"),
      includes(files.service, "getEvidencePack"),
      includes(files.readme + read("docs/api-reference.md"), "evidence <context-pack-id>"),
      includes(files.server, "getEvidencePack")
    ]
  },
  {
    id: "WP 7.1",
    name: "Dream as belief revision",
    tests: [
      includes(files.reflection + files.service + files.retrieval, "superseded"),
      includes(files.reflection, "contradiction"),
      includes(files.reflection, "pattern"),
      includes(files.cli, "dream"),
      includes(files.dashboard, "Run dream cycle")
    ]
  },
  {
    id: "WP 7.2",
    name: "Verification queue",
    tests: [
      includes(files.service, "verificationQueue"),
      includes(files.cli, "verify"),
      includes(files.cli, "confirm"),
      includes(files.cli, "retract"),
      includes(files.coreTypes, "VerificationQueueReport")
    ]
  },
  {
    id: "WP 8.1",
    name: "Procedural memory",
    tests: [
      includes(files.coreTypes, "ProceduralMemoryMetadata"),
      includes(files.coreTypes + files.service, "triggerConditions"),
      includes(files.service, "procedural"),
      includes(files.service + files.reflection + files.cli, "procedural")
    ]
  },
  {
    id: "WP 8.2",
    name: "Harness action memory",
    tests: [
      includes(files.coreTypes, "HarnessActionInput"),
      includes(files.service, "recordHarnessAction"),
      includes(files.cli, "action"),
      includes(files.docsConnectors, "tool_outcome")
    ]
  },
  {
    id: "WP 9.1",
    name: "Official connector packages",
    tests: [
      exists("templates/codex/AGENTS.md"),
      exists("templates/claude/settings.json"),
      exists("templates/copilot/copilot-instructions.md"),
      exists("templates/cursor/open-memory.mdc"),
      includes(read("bin/cognibrain.mjs"), ".vscode"),
      exists("templates/opencode/cognibrain.md"),
      exists("templates/openclaw/cognibrain.md"),
      exists("templates/langgraph/langgraph-cognibrain.ts"),
      exists("templates/crewai/crewai_cognibrain.py"),
      includes(read("bin/cognibrain-connect.mjs"), "langgraph")
    ]
  },
  {
    id: "WP 9.2",
    name: "Two-way system connectors",
    tests: ["official-github", "official-jira", "official-linear", "official-slack", "official-notion", "official-google-drive", "official-gmail", "official-google-calendar", "writebackConnector"].map((item) => includes(files.service + files.docsConnectors, item))
  },
  {
    id: "WP 10.1",
    name: "Consent and policy engine",
    tests: [
      includes(files.coreTypes, "MemoryPolicyRule"),
      includes(files.service, "policyRules"),
      includes(files.cli, "policy-evaluate"),
      includes(files.service, "privacyPolicy")
    ]
  },
  {
    id: "WP 10.2",
    name: "Encrypted memory vault",
    tests: [
      includes(read("src/core/privacy.ts") + read("docs/configuration.md"), "AES-GCM"),
      includes(files.service, "rotateEncryptionKeyMetadata"),
      includes(files.cli, "key-rotate"),
      includes(files.cli, "backup-verify")
    ]
  },
  {
    id: "WP 11.1",
    name: "Full answer benchmarks",
    tests: [
      includes(files.package, "benchmark:locomo"),
      includes(files.package, "benchmark:longmemeval"),
      includes(files.package, "benchmark:beam"),
      includes(files.package, "benchmark:answer-generation"),
      includes(files.docsMarket, "per-question")
    ]
  },
  {
    id: "WP 11.2",
    name: "USP benchmarks",
    tests: [
      includes(read("src/eval/nextgenBenchmarks.ts"), "usp-evidence-pack"),
      includes(files.package, "leaderboard"),
      includes(files.package, "benchmark:market"),
      includes(files.dashboard, "Artifact Inspector")
    ]
  },
  {
    id: "WP 12.1",
    name: "Domain modules",
    tests: ["coding", "research", "legal", "sales", "support", "finance", "healthcare"].map((domain) => includes(files.domain, `id: "${domain}"`))
  },
  {
    id: "WP 12.2",
    name: "Marketplace governance",
    tests: [
      includes(files.service, "marketplaceInstallPlan"),
      includes(files.service, "signature"),
      includes(files.service, "security"),
      includes(files.cli, "marketplace-review"),
      includes(files.dashboard, "Marketplace")
    ]
  }
];

const planMarkers = ["EPIC 1", "EPIC 2", "EPIC 3", "EPIC 4", "EPIC 5", "EPIC 6", "EPIC 7", "EPIC 8", "EPIC 9", "EPIC 10", "EPIC 11", "EPIC 12"];
const missingPlanMarkers = planMarkers.filter((marker) => !files.nextplan.includes(marker));
if (missingPlanMarkers.length) {
  console.error(`nextplan.md is missing expected markers: ${missingPlanMarkers.join(", ")}`);
  process.exit(1);
}

const failures = checks
  .map((check) => ({ ...check, failed: check.tests.filter((passed) => !passed).length }))
  .filter((check) => check.failed);

if (failures.length) {
  console.error("nextplan audit failed");
  for (const failure of failures) console.error(`- ${failure.id} ${failure.name}: ${failure.failed} missing checks`);
  process.exit(1);
}

console.log(`nextplan audit passed: ${checks.length} workpackages verified`);

function includes(content, needle) {
  return content.includes(needle);
}
