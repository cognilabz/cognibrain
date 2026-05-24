import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "./service";
import type { Memory } from "../core";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const dreamCheckIntervalMinutes = Number(process.env.MEMORY_DREAM_CHECK_INTERVAL_MINUTES ?? 15);

const relationTypeSchema = z.enum([
  "mentions",
  "calls",
  "imports",
  "defines",
  "extends",
  "depends_on",
  "transitive_depends_on",
  "works_for",
  "advisor_of",
  "supersedes",
  "contradicts",
  "confirmed_by",
  "suggested_by",
  "executed_by"
]);

const memoryInputSchema = z.object({
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  deviceId: z.string().optional(),
  runId: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
  layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
  source: z
    .object({
      kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
      uri: z.string().optional(),
      commit: z.string().optional(),
      lineStart: z.number().optional(),
      lineEnd: z.number().optional(),
      confidence: z.number().min(0).max(1)
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  relations: z
    .array(
      z.object({
        type: relationTypeSchema,
        sourceEntity: z.string().optional(),
        targetId: z.string().optional(),
        targetEntity: z.string().optional(),
        direction: z.enum(["out", "in", "undirected"]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.string().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional()
      })
    )
    .optional(),
  consent: z
    .object({
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      allowTraining: z.boolean().optional(),
      retentionUntil: z.string().optional(),
      deleteOnRequest: z.boolean().optional()
    })
    .optional(),
  temporal: z.record(z.unknown()).optional(),
  pinned: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

const searchSchema = z.object({
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  runId: z.string().optional(),
  scopeMode: z.enum(["user", "session", "app", "org", "project", "all"]).optional(),
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
  includeArchived: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
  includeLinkedIdentities: z.boolean().optional(),
  profileId: z.string().optional(),
  weights: z.record(z.number()).optional(),
  graphDepth: z.number().int().positive().max(8).optional(),
  relationTypes: z.array(relationTypeSchema).optional()
});

const graphExportSchema = z.object({
  userId: z.string().optional(),
  relationTypes: z.array(relationTypeSchema).optional(),
  minTrust: z.number().min(0).max(1).optional(),
  sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  format: z.enum(["json", "graphml"]).optional()
});

const inferenceRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  when: z.object({ left: relationTypeSchema, right: relationTypeSchema }),
  then: relationTypeSchema,
  confidence: z.number().min(0).max(1).optional()
});

const extractSchema = z.object({
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  deviceId: z.string().optional(),
  runId: z.string().optional(),
  events: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool", "system", "operator"]),
      content: z.string().min(1),
      timestamp: z.string().optional(),
      source: z
        .object({
          kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
          uri: z.string().optional(),
          commit: z.string().optional(),
          lineStart: z.number().optional(),
          lineEnd: z.number().optional(),
          confidence: z.number().min(0).max(1)
        })
        .optional(),
      mediaType: z.enum(["text", "code", "document", "audio", "image", "video"]).optional(),
      language: z.string().optional(),
      uri: z.string().optional(),
      mimeType: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  )
});

const entityMergeSchema = z.object({
  canonical: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  userId: z.string().optional()
});

const timelineSummarySchema = z.object({
  granularity: z.enum(["hour", "day", "week", "month", "all"]).optional(),
  persist: z.boolean().optional(),
  style: z.enum(["concise", "descriptive", "narrative"]).optional()
});

const feedbackSchema = z.object({
  memoryId: z.string().min(1),
  userId: z.string().optional(),
  kind: z.enum(["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable", "approve_pattern", "reject_pattern"]),
  note: z.string().optional(),
  timestamp: z.string().optional()
});

const trainingSampleSchema = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  selectedMemoryId: z.string().optional(),
  rejectedMemoryIds: z.array(z.string()).optional(),
  profileId: z.string().optional(),
  signals: z.record(z.number()).optional(),
  outcome: z.enum(["helpful", "wrong", "accepted", "rejected"]),
  timestamp: z.string().optional()
});

const retrievalProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weights: z.record(z.number()),
  scope: z
    .object({
      userId: z.string().optional(),
      projectId: z.string().optional(),
      appId: z.string().optional(),
      orgId: z.string().optional(),
      agentId: z.string().optional()
    })
    .optional(),
  learned: z.boolean().optional(),
  trainingSamples: z.number().optional(),
  benchmarkDelta: z.number().optional(),
  provenance: z.string().optional()
});

const identityLinkSchema = z.object({
  primaryUserId: z.string().min(1),
  linkedUserId: z.string().min(1),
  consentToken: z.string().min(8),
  consent: z.enum(["user", "org"]).optional()
});

const brainSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ownerUserId: z.string().min(1),
  orgId: z.string().optional(),
  visibility: z.enum(["private", "team", "org", "public"]),
  consentRequired: z.boolean().optional()
});

const sourceSchema = z.object({
  id: z.string().optional(),
  brainId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["manual", "chat", "code", "docs", "calendar", "connector", "import"]),
  uri: z.string().optional(),
  defaultConsent: z.record(z.unknown()).optional()
});

const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  namespace: z.string().min(1),
  brainIds: z.array(z.string()),
  permissions: z.array(z.enum(["read", "write", "share", "admin"])),
  personaId: z.string().optional()
});

const personaSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summaryStyle: z.enum(["concise", "descriptive", "narrative"]),
  retrievalWeights: z.record(z.number()).optional(),
  privacyDefault: z.enum(["private", "user", "org", "public"]).optional(),
  domain: z.string().optional()
});

const webhookSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  events: z.array(z.enum(["memory.write", "memory.update", "memory.delete", "memory.share", "extract.run", "reflect.run", "search.run", "webhook.register", "marketplace.install", "inference.run", "entity.merge", "entity.split"])),
  secretRef: z.string().optional()
});

const marketplaceModuleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["connector", "domain", "persona", "retrieval_profile"]),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  installState: z.enum(["available", "installed"]).optional(),
  manifest: z.record(z.unknown())
});

export const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    send(response, error instanceof z.ZodError ? 400 : 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const method = request.method ?? "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "OPTIONS") {
    send(response, 204, null);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    send(response, 200, { ok: true, ...defaultService.health(url.searchParams.get("userId") ?? undefined) });
    return;
  }

  if (method === "GET" && url.pathname === "/maintenance") {
    send(response, 200, defaultService.maintenanceStatus());
    return;
  }

  if (method === "GET" && url.pathname === "/metrics") {
    send(response, 200, defaultService.metricsReport());
    return;
  }

  if (method === "GET" && url.pathname === "/graph") {
    send(response, 200, defaultService.graph(url.searchParams.get("userId") ?? undefined));
    return;
  }

  if (method === "GET" && url.pathname === "/entities") {
    send(response, 200, defaultService.entityCatalog(url.searchParams.get("userId") ?? undefined));
    return;
  }

  if (method === "POST" && url.pathname === "/entities/merge") {
    const body = entityMergeSchema.parse(await json(request));
    send(response, 202, defaultService.mergeEntity(body.canonical, body.aliases, body.userId));
    return;
  }

  if (method === "POST" && url.pathname === "/entities/split") {
    const body = entityMergeSchema.parse(await json(request));
    const record = defaultService.splitEntity(body.canonical, body.aliases, body.userId);
    send(response, record ? 202 : 404, record ?? { error: "Entity not found" });
    return;
  }

  if (method === "GET" && url.pathname === "/graph/paths") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      send(response, 400, { error: "from and to are required" });
      return;
    }
    send(response, 200, defaultService.graphPaths(from, to, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return;
  }

  if (method === "GET" && url.pathname === "/graph/activate") {
    const query = url.searchParams.get("query");
    if (!query) {
      send(response, 400, { error: "query is required" });
      return;
    }
    send(response, 200, defaultService.graphActivation(query, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return;
  }

  if (method === "GET" && url.pathname === "/graph/export") {
    const format = url.searchParams.get("format") === "graphml" ? "graphml" : "json";
    const exported = defaultService.graphExport({
      userId: url.searchParams.get("userId") ?? undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes")),
      minTrust: url.searchParams.get("minTrust") ? Number(url.searchParams.get("minTrust")) : undefined,
      sourceKind: sourceKind(url.searchParams.get("sourceKind")),
      after: url.searchParams.get("after") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
      format
    });
    if (format === "graphml" && typeof exported === "string") {
      sendText(response, 200, exported, "application/graphml+xml");
      return;
    }
    send(response, 200, exported);
    return;
  }

  if (method === "POST" && url.pathname === "/graph/query") {
    const body = z.object({ query: z.string().min(1), userId: z.string().optional() }).parse(await json(request));
    send(response, 200, defaultService.graphQuery(body.query, body.userId));
    return;
  }

  if (method === "POST" && url.pathname === "/graph/infer") {
    const body = z.object({ rules: z.array(inferenceRuleSchema).optional() }).parse(await json(request));
    send(response, 202, defaultService.runInference(body.rules));
    return;
  }

  if (method === "GET" && url.pathname === "/brains") {
    send(response, 200, defaultService.listBrains());
    return;
  }

  if (method === "POST" && url.pathname === "/brains") {
    send(response, 201, defaultService.createBrain(brainSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/sources") {
    send(response, 200, defaultService.listSources(url.searchParams.get("brainId") ?? undefined));
    return;
  }

  if (method === "POST" && url.pathname === "/sources") {
    send(response, 201, defaultService.createSource(sourceSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/agents") {
    send(response, 200, defaultService.listAgents());
    return;
  }

  if (method === "POST" && url.pathname === "/agents") {
    send(response, 201, defaultService.registerAgent(agentSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/personas") {
    send(response, 200, defaultService.listPersonas());
    return;
  }

  if (method === "PUT" && url.pathname === "/personas") {
    send(response, 200, defaultService.setPersona(personaSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/events") {
    send(response, 200, defaultService.eventFeed());
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks") {
    send(response, 201, defaultService.registerWebhook(webhookSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/marketplace") {
    send(response, 200, defaultService.listMarketplaceModules());
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/install") {
    send(response, 202, defaultService.installMarketplaceModule(marketplaceModuleSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/compliance") {
    send(response, 200, defaultService.complianceReport());
    return;
  }

  if (method === "GET" && url.pathname === "/profiles") {
    send(response, 200, defaultService.getRetrievalProfiles());
    return;
  }

  if (method === "PUT" && url.pathname === "/profiles") {
    send(response, 200, defaultService.setRetrievalProfile(retrievalProfileSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/profiles/learn") {
    const body = z.object({ id: z.string().optional(), label: z.string().optional() }).parse(await json(request));
    send(response, 202, defaultService.learnRetrievalProfile(body.id, body.label));
    return;
  }

  if (method === "POST" && url.pathname === "/profiles/training-samples") {
    send(response, 201, defaultService.addTrainingSample(trainingSampleSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/memories") {
    const body = memoryInputSchema.parse(await json(request));
    send(response, 201, serialize(defaultService.add(body)));
    return;
  }

  if (method === "POST" && url.pathname === "/extract") {
    const body = extractSchema.parse(await json(request));
    const { events, ...scope } = body;
    const report = defaultService.extract(events, scope);
    send(response, 201, {
      memories: report.memories.map(serialize),
      entityLinks: report.entityLinks,
      stages: report.stages,
      failures: report.failures,
      enrichmentCandidates: report.enrichmentCandidates,
      learnedRules: report.learnedRules
    });
    return;
  }

  if (method === "GET" && url.pathname === "/memories") {
    send(response, 200, defaultService.list(url.searchParams.get("userId") ?? undefined).map(serialize));
    return;
  }

  if (parts[0] === "memories" && parts[1]) {
    if (method === "GET") {
      send(response, 200, serialize(defaultService.get(parts[1])));
      return;
    }
    if (method === "PATCH") {
      send(response, 200, serialize(defaultService.update(parts[1], memoryInputSchema.partial().parse(await json(request)))));
      return;
    }
    if (method === "DELETE") {
      send(response, defaultService.delete(parts[1]) ? 204 : 404, null);
      return;
    }
  }

  if (method === "POST" && url.pathname === "/search") {
    const body = searchSchema.parse(await json(request));
    send(
      response,
      200,
      defaultService.search(body).map((result) => ({
        ...result,
        memory: serialize(result.memory)
      }))
    );
    return;
  }

  if (method === "POST" && url.pathname === "/feedback") {
    const body = feedbackSchema.parse(await json(request));
    send(response, 202, serialize(defaultService.feedback(body)));
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "promote") {
    const body = z.object({ orgId: z.string().min(1) }).parse(await json(request));
    send(response, 202, serialize(defaultService.promoteSharedMemory(parts[1], body.orgId)));
    return;
  }

  if (method === "POST" && url.pathname === "/identity-links") {
    const body = identityLinkSchema.parse(await json(request));
    send(response, 201, defaultService.linkIdentity(body.primaryUserId, body.linkedUserId, body.consentToken, body.consent));
    return;
  }

  if (method === "DELETE" && parts[0] === "identity-links" && parts[1]) {
    send(response, 200, defaultService.unlinkIdentity(parts[1]));
    return;
  }

  if (method === "GET" && parts[0] === "timeline" && parts[1]) {
    send(response, 200, defaultService.timeline(parts[1]));
    return;
  }

  if (method === "POST" && parts[0] === "timeline" && parts[1] && parts[2] === "summarize") {
    send(response, 202, defaultService.summarizeTimeline(parts[1], timelineSummarySchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && parts[0] === "temporal" && parts[1]) {
    send(response, 200, defaultService.temporalQuery(parts[1], {
      after: url.searchParams.get("after") ?? undefined,
      before: url.searchParams.get("before") ?? undefined
    }));
    return;
  }

  if (method === "GET" && parts[0] === "patterns" && parts[1]) {
    send(response, 200, defaultService.behavioralPatterns(parts[1]));
    return;
  }

  if (method === "POST" && url.pathname === "/lifecycle/preview") {
    const body = z.object({ userId: z.string().min(1), policy: z.record(z.unknown()).optional() }).parse(await json(request));
    send(response, 200, defaultService.lifecyclePreview(body.userId, body.policy));
    return;
  }

  if (method === "POST" && url.pathname === "/domain/evaluate") {
    send(response, 202, defaultService.runDomainEvaluation());
    return;
  }

  if (method === "GET" && parts[0] === "export" && parts[1]) {
    send(response, 200, defaultService.exportUser(parts[1]).map(serialize));
    return;
  }

  if (method === "DELETE" && parts[0] === "users" && parts[1] && parts[2] === "memories") {
    send(response, 200, { deleted: defaultService.deleteUser(parts[1]) });
    return;
  }

  if (method === "POST" && (url.pathname === "/reflection" || url.pathname === "/dream")) {
    const body = z.object({ userId: z.string().min(1) }).parse(await json(request));
    const report = url.pathname === "/dream" ? defaultService.dream(body.userId) : defaultService.reflect(body.userId);
    send(response, 202, {
      created: report.created.map(serialize),
      demoted: report.demoted.map(serialize),
      contradictions: report.contradictions.map((item) => ({
        kept: serialize(item.kept),
        demoted: serialize(item.demoted),
        reason: item.reason
      })),
      lifecycle: report.lifecycle
    });
    return;
  }

  if (method === "POST" && url.pathname === "/maintenance/dream-due") {
    send(response, 202, { dreamedUsers: defaultService.runDueDreams() });
    return;
  }

  send(response, 404, { error: "Not found" });
}

function json(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (status === 204 || payload === null) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response: ServerResponse, status: number, payload: string, contentType = "text/plain"): void {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Content-Type", contentType);
  response.end(payload);
}

function parseRelationTypes(value: string | null): z.infer<typeof relationTypeSchema>[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((item) => relationTypeSchema.parse(item.trim())).filter(Boolean);
}

function sourceKind(value: string | null): "human" | "reviewed_code" | "tool" | "agent" | "transcript" | "import" | undefined {
  return value === "human" || value === "reviewed_code" || value === "tool" || value === "agent" || value === "transcript" || value === "import" ? value : undefined;
}

function serialize(value: Memory) {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    lastAccessedAt: value.lastAccessedAt?.toISOString(),
    archivedAt: value.archivedAt?.toISOString()
  };
}

if (process.env.NODE_ENV !== "test") {
  server.listen(port, host, () => {
    console.log(`cognibrain API listening on http://${host}:${port}`);
  });
  if (dreamCheckIntervalMinutes > 0) {
    setInterval(
      () => defaultService.runDueDreams(),
      dreamCheckIntervalMinutes * 60_000
    ).unref();
  }
}
