import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

interface Check {
  id: string;
  passed: boolean;
  detail: string;
}

export function runNextgenEvaluation() {
  const service = new MemoryService();
  const checks: Check[] = [];

  const brain = service.createBrain({ name: "Nextgen Team Brain", ownerUserId: "bench", orgId: "org-bench", visibility: "team" });
  const source = service.createSource({ brainId: brain.id, name: "Benchmark Source", kind: "docs" });
  service.registerAgent({ id: "agent-bench", name: "Benchmark Agent", namespace: "eval", brainIds: [brain.id], permissions: ["read", "write", "share"] });
  service.registerWebhook({ url: "https://example.invalid/hooks/memory", events: ["memory.write", "inference.run", "memory.share"] });
  service.installMarketplaceModule({
    id: "persona-nextgen",
    kind: "persona",
    name: "Nextgen Persona",
    version: "1.0.0",
    description: "Evaluation persona for nextgen proof.",
    manifest: { id: "nextgen", label: "Nextgen", summaryStyle: "concise", privacyDefault: "private" }
  });

  const atlas = service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    agentId: "agent-bench",
    orgId: "org-bench",
    content: "Atlas depends on CacheClient for cache reads.",
    entities: ["atlas", "cacheclient"],
    relations: [{ type: "depends_on", sourceEntity: "atlas", targetEntity: "cacheclient", confidence: 0.91 }],
    consent: { visibility: "private", retentionUntil: "2024-01-01T00:00:00.000Z", deleteOnRequest: true },
    source: { kind: "human", confidence: 0.97 }
  });
  service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    agentId: "agent-bench",
    orgId: "org-bench",
    content: "CacheClient imports RedisAdapter for storage.",
    entities: ["cacheclient", "redisadapter"],
    relations: [{ type: "imports", sourceEntity: "cacheclient", targetEntity: "redisadapter", confidence: 0.89 }],
    source: { kind: "reviewed_code", confidence: 0.96 }
  });
  for (const timestamp of ["2026-05-01T09:00:00.000Z", "2026-05-08T09:00:00.000Z"]) {
    service.add({
      brainId: brain.id,
      sourceId: source.id,
      userId: "bench",
      agentId: "agent-bench",
      content: "Benchmark operator reviews graph reports on Friday.",
      tags: ["review", "graph"],
      entities: ["operator"],
      timestamp,
      temporal: { eventAt: timestamp },
      source: { kind: "human", confidence: 0.94 }
    });
  }

  const inference = service.runInference();
  const paths = service.graphPaths("atlas", "redisadapter", { userId: "bench", maxDepth: 3 });
  const query = service.graphQuery("MATCH (a)-[:transitive_depends_on]->(b) WHERE trust>0.8", "bench");
  const temporal = service.temporalQuery("bench", { after: "2026-05-01T00:00:00.000Z", before: "2026-05-09T00:00:00.000Z" });
  const patterns = service.behavioralPatterns("bench");
  service.promoteSharedMemory(atlas.id, "org-bench");
  const compliance = service.complianceReport(new Date("2026-01-01T00:00:00.000Z"));
  const events = service.eventFeed();

  checks.push({
    id: "graph-inference",
    passed: inference.inferred.some((item) => item.relation.type === "transitive_depends_on"),
    detail: `${inference.inferred.length} inferred relations`
  });
  checks.push({
    id: "path-explainer",
    passed: paths.some((path) => path.explanation.join(" ").includes("transitive_depends_on")),
    detail: `${paths.length} graph paths`
  });
  checks.push({
    id: "graph-query",
    passed: query.matches.some((match) => match.relation?.targetEntity === "redisadapter"),
    detail: `${query.matches.length} query matches`
  });
  checks.push({
    id: "multi-tenant-audit",
    passed: compliance.totals.brains === 1 && compliance.totals.sources === 1 && (compliance.auditByType["memory.write"] ?? 0) >= 1,
    detail: `${compliance.totals.auditEvents} audit events`
  });
  checks.push({
    id: "webhook-event-feed",
    passed: events.deliveries.some((delivery) => delivery.status === "queued"),
    detail: `${events.deliveries.length} queued deliveries`
  });
  checks.push({
    id: "compliance-retention",
    passed: compliance.retentionExpired === 1 && compliance.deleteOnRequest >= 1,
    detail: `${compliance.retentionExpired} expired retention entries, ${compliance.deleteOnRequest} delete-on-request entries`
  });
  checks.push({
    id: "temporal-patterns",
    passed: temporal.events.length >= 2 && patterns.patterns.some((pattern) => pattern.cadence === "weekly:friday"),
    detail: `${temporal.events.length} interval events, ${patterns.patterns.length} patterns`
  });
  checks.push({
    id: "marketplace-persona",
    passed: service.listMarketplaceModules().some((module) => module.id === "persona-nextgen" && module.installState === "installed") && service.listPersonas().some((persona) => persona.id === "nextgen"),
    detail: `${service.listMarketplaceModules().length} marketplace modules`
  });

  const report = {
    passed: checks.every((check) => check.passed),
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      passed: checks.filter((check) => check.passed).length,
      total: checks.length
    }
  };
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : "artifacts/nextgen-eval.json";
  const report = runNextgenEvaluation();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
