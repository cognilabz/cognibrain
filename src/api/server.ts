import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { defaultService } from "./service";
import type { ExtractionReport, ManagedMigrationBundle, Memory } from "../core";

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
  confidence: z.number().min(0).max(1).optional(),
  beliefState: z.enum(["active", "stale", "superseded", "contradicted", "needs_verification", "retracted"]).optional(),
  metadata: z.record(z.unknown()).optional()
});

const searchSchema = z.object({
  brainId: z.string().optional(),
  brainIds: z.array(z.string()).optional(),
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
  mode: z.enum(["hybrid", "rrf", "graph", "path"]).optional(),
  expandQuery: z.boolean().optional(),
  queryExpansions: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
  includeArchived: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
  includeLinkedIdentities: z.boolean().optional(),
  includeSharedBrains: z.boolean().optional(),
  profileId: z.string().optional(),
  weights: z.record(z.number()).optional(),
  graphDepth: z.number().int().positive().max(8).optional(),
  relationTypes: z.array(relationTypeSchema).optional()
});

const evidencePackSchema = searchSchema.extend({
  tokenBudget: z.number().int().positive().max(8000).optional()
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

const extractionEventSchema = z.object({
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
  events: z.array(extractionEventSchema)
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

const injectionFeedbackSchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(1),
  injectedMemoryIds: z.array(z.string().min(1)).min(1),
  acceptedMemoryIds: z.array(z.string().min(1)).optional(),
  rejectedMemoryIds: z.array(z.string().min(1)).optional(),
  outcome: z.enum(["helpful", "wrong", "accepted", "rejected"]),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  note: z.string().optional(),
  signals: z.record(z.number()).optional(),
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
  memberUserIds: z.array(z.string()).optional(),
  allowedAgentIds: z.array(z.string()).optional(),
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
  personaId: z.string().optional(),
  subscriptions: z
    .object({
      events: z.array(z.lazy(() => auditTypeSchema)).optional(),
      brainIds: z.array(z.string()).optional(),
      sourceIds: z.array(z.string()).optional()
    })
    .optional()
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
  events: z.array(z.enum(["memory.write", "memory.update", "memory.delete", "memory.share", "memory.share.request", "memory.share.revoke", "memory.revert", "memory.consent", "agent.register", "persona.set", "connector.register", "connector.auth", "connector.sync", "provider.call", "extract.run", "reflect.run", "search.run", "sync.queue", "sync.run", "webhook.register", "marketplace.submit", "marketplace.scan", "marketplace.review", "marketplace.publish", "marketplace.install", "managed.tenant", "privacy.compute", "inference.run", "entity.merge", "entity.split"])),
  secretRef: z.string().optional()
});

const marketplaceModuleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["connector", "domain", "persona", "retrieval_profile"]),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  installState: z.enum(["available", "installed"]).optional(),
  security: z
    .object({
      scannedAt: z.string(),
      status: z.enum(["passed", "warning", "blocked"]),
      permissions: z.array(z.string()),
      risks: z.array(z.string())
    })
    .optional(),
  manifest: z.record(z.unknown()),
  trustSignals: z.record(z.unknown()).optional()
});

const marketplaceSubmissionSchema = z.object({
  module: marketplaceModuleSchema,
  submitter: z.string().min(1),
  sourceUrl: z.string().url().optional()
});

const marketplaceReviewSchema = z.object({
  reviewer: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  approve: z.boolean().optional(),
  requestChanges: z.boolean().optional(),
  reject: z.boolean().optional()
});

const migrationExportSchema = z.object({
  target: z.enum(["self_hosted", "managed", "backup"]).optional(),
  backupRef: z.string().optional(),
  ssoProvider: z.string().optional(),
  secretManager: z.string().optional()
});

const migrationImportSchema = z.object({
  generatedAt: z.union([z.string(), z.date()]),
  target: z.enum(["self_hosted", "managed", "backup"]),
  counts: z.record(z.number()),
  backup: z.record(z.unknown()),
  placeholders: z.record(z.unknown()),
  deployment: z.record(z.unknown()).optional(),
  manifest: z.record(z.unknown())
}).passthrough();

const managedTenantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  orgId: z.string().min(1),
  plan: z.enum(["developer", "team", "enterprise"]).optional(),
  region: z.string().optional(),
  status: z.enum(["provisioning", "active", "paused"]).optional(),
  ssoProvider: z.string().optional(),
  secretManager: z.string().optional(),
  dataResidency: z.string().optional(),
  autoscaling: z.object({
    minReplicas: z.number().int().min(0),
    maxReplicas: z.number().int().min(1),
    targetCpuUtilization: z.number().min(1).max(100)
  }).optional(),
  backup: z.object({
    enabled: z.boolean(),
    backupRef: z.string().optional(),
    lastVerifiedAt: z.union([z.string(), z.date()]).optional()
  }).optional()
});

const crossBrainPrivacyComputeSchema = z.object({
  brainIds: z.array(z.string().min(1)).min(2),
  salt: z.string().optional(),
  minK: z.number().int().min(2).optional(),
  dimensions: z.array(z.enum(["entities", "tags", "relations"])).optional()
});

const connectorManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage", "custom"]),
  version: z.string().min(1),
  direction: z.enum(["ingest", "export", "two_way"]),
  capabilities: z.array(z.enum(["ingest", "export", "webhook", "poll", "writeback", "media", "translation"])).min(1),
  auth: z.enum(["none", "api_key", "oauth", "token"]),
  defaultSourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
  metadataMapping: z.record(z.string()),
  privacyPolicy: z.enum(["personal", "project", "team", "never_store"]).optional(),
  list: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["GET", "POST"]).optional(),
      authRef: z.string().optional()
    })
    .optional(),
  poll: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["GET", "POST"]).optional(),
      authRef: z.string().optional()
    })
    .optional(),
  writeback: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["POST", "PUT", "PATCH"]).optional(),
      authRef: z.string().optional(),
      operations: z.array(z.enum(["tag", "comment", "status", "summary", "memory_link"])).optional()
    })
    .optional(),
  oauth: z
    .object({
      authorizeUrl: z.string().url(),
      tokenUrl: z.string().url().optional(),
      clientIdRef: z.string().optional(),
      scopes: z.array(z.string()).optional(),
      redirectUri: z.string().url().optional()
    })
    .optional()
});

const connectorOAuthBeginSchema = z.object({
  connectorId: z.string().min(1),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  stateSalt: z.string().optional()
});

const connectorOAuthCallbackSchema = z.object({
  connectorId: z.string().min(1),
  state: z.string().min(1),
  code: z.string().optional(),
  tokenRef: z.string().optional(),
  error: z.string().optional()
});

const connectorSyncSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  events: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool", "system", "operator"]),
      content: z.string().min(1),
      externalId: z.string().optional(),
      timestamp: z.string().optional(),
      mediaType: z.enum(["text", "code", "document", "audio", "image", "video"]).optional(),
      language: z.string().optional(),
      uri: z.string().optional(),
      mimeType: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  )
});

const connectorWritebackSchema = z.object({
  connectorId: z.string().min(1),
  operation: z.enum(["tag", "comment", "status", "summary", "memory_link"]).optional(),
  memoryIds: z.array(z.string()).optional(),
  externalId: z.string().optional(),
  content: z.string().optional(),
  target: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional()
});

const connectorFeedbackSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  kind: z.enum(["accepted_change", "rejected_suggestion", "failing_test", "user_correction"]),
  content: z.string().min(1),
  memoryIds: z.array(z.string()).optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

const connectorPollSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional()
});

const auditTypeSchema = z.enum(["memory.write", "memory.update", "memory.delete", "memory.share", "memory.share.request", "memory.share.revoke", "memory.revert", "memory.consent", "agent.register", "persona.set", "connector.register", "connector.auth", "connector.sync", "provider.call", "extract.run", "reflect.run", "search.run", "sync.queue", "sync.run", "webhook.register", "marketplace.submit", "marketplace.scan", "marketplace.review", "marketplace.publish", "marketplace.install", "managed.tenant", "inference.run", "entity.merge", "entity.split", "retention.enforce", "security.key.rotate", "privacy.insights", "privacy.compute"]);

const retentionRuleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  retentionDays: z.number().min(0),
  action: z.enum(["archive", "delete"]),
  scope: z
    .object({
      userId: z.string().optional(),
      brainId: z.string().optional(),
      sourceId: z.string().optional(),
      sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      entity: z.string().optional(),
      relationType: relationTypeSchema.optional(),
      tag: z.string().optional()
    })
    .optional()
});

const keyRotationSchema = z.object({
  keyId: z.string().min(1),
  keyVersion: z.string().min(1),
  backupRef: z.string().optional(),
  actorId: z.string().optional()
});

const offlineOperationSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["add", "update", "delete", "consent"]),
  userId: z.string().min(1),
  memoryId: z.string().optional(),
  clientMutationId: z.string().optional(),
  occurredAt: z.string().optional(),
  input: memoryInputSchema.optional(),
  patch: memoryInputSchema.partial().optional(),
  consent: z
    .object({
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      allowTraining: z.boolean().optional(),
      retentionUntil: z.string().optional(),
      deleteOnRequest: z.boolean().optional()
    })
    .optional()
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
      validAt: url.searchParams.get("validAt") ?? undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return;
  }

  if (method === "GET" && url.pathname === "/graph/explain") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      send(response, 400, { error: "from and to are required" });
      return;
    }
    const strategy = url.searchParams.get("strategy");
    send(response, 200, defaultService.graphExplain(from, to, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      validAt: url.searchParams.get("validAt") ?? undefined,
      strategy: strategy === "shortest" || strategy === "strongest" || strategy === "most_recent" || strategy === "highest_trust" ? strategy : undefined,
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
      validAt: url.searchParams.get("validAt") ?? undefined,
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
      validAt: url.searchParams.get("validAt") ?? undefined,
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

  if (method === "POST" && parts[0] === "agents" && parts[1] && parts[2] === "persona") {
    const body = z.object({ personaId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.assignAgentPersona(parts[1], body.personaId));
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
    send(response, 200, defaultService.eventFeed({
      agentId: url.searchParams.get("agentId") ?? undefined,
      brainId: url.searchParams.get("brainId") ?? undefined,
      sourceId: url.searchParams.get("sourceId") ?? undefined,
      type: url.searchParams.get("type") ? auditTypeSchema.parse(url.searchParams.get("type")) : undefined
    }));
    return;
  }

  if (method === "GET" && url.pathname === "/audit") {
    send(response, 200, defaultService.auditTrail({
      userId: url.searchParams.get("userId") ?? undefined,
      memoryId: url.searchParams.get("memoryId") ?? undefined,
      type: url.searchParams.get("type") ? auditTypeSchema.parse(url.searchParams.get("type")) : undefined
    }));
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks") {
    send(response, 201, defaultService.registerWebhook(webhookSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/webhooks/deliveries") {
    send(response, 200, defaultService.eventFeed().deliveries);
    return;
  }

  if (method === "POST" && url.pathname === "/webhooks/deliver") {
    const body = z.object({ fail: z.boolean().optional(), error: z.string().optional(), real: z.boolean().optional() }).parse(await json(request));
    send(response, 202, body.real ? await defaultService.deliverWebhookQueueHttp() : defaultService.deliverWebhookQueue(() => ({ ok: body.fail !== true, error: body.error ?? "simulated delivery failure" })));
    return;
  }

  if (method === "GET" && url.pathname === "/marketplace/submissions") {
    const status = url.searchParams.get("status") as Parameters<typeof defaultService.listMarketplaceSubmissions>[0] | null;
    send(response, 200, defaultService.listMarketplaceSubmissions(status ?? undefined));
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/submissions") {
    send(response, 202, defaultService.submitMarketplaceModule(marketplaceSubmissionSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/scan") {
    const body = z.object({ submissionId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.scanMarketplaceSubmission(body.submissionId));
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/review") {
    const body = z.object({ submissionId: z.string().min(1), review: marketplaceReviewSchema }).parse(await json(request));
    send(response, 202, defaultService.reviewMarketplaceSubmission(body.submissionId, body.review));
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/publish") {
    const body = z.object({ submissionId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.publishMarketplaceSubmission(body.submissionId));
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/rate") {
    const body = z.object({ moduleId: z.string().min(1), review: marketplaceReviewSchema.pick({ reviewer: true, rating: true, comment: true }) }).parse(await json(request));
    send(response, 202, defaultService.rateMarketplaceModule(body.moduleId, body.review));
    return;
  }

  if (method === "GET" && url.pathname === "/marketplace") {
    send(response, 200, defaultService.listMarketplaceModules());
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/install") {
    const body = (await json(request)) as Record<string, unknown>;
    if (typeof body?.id === "string" && !body.kind) {
      send(response, 202, defaultService.installMarketplaceModuleById(body.id));
    } else {
      send(response, 202, defaultService.installMarketplaceModule(marketplaceModuleSchema.parse(body)));
    }
    return;
  }

  if (method === "POST" && url.pathname === "/marketplace/plan") {
    const body = (await json(request)) as Record<string, unknown>;
    send(response, 200, typeof body?.id === "string" && !body.kind ? defaultService.marketplaceInstallPlan(body.id) : defaultService.marketplaceInstallPlan(marketplaceModuleSchema.parse(body)));
    return;
  }

  if (method === "GET" && url.pathname === "/sdk/openapi") {
    send(response, 200, defaultService.apiDescription());
    return;
  }

  if (method === "GET" && url.pathname === "/benchmarks/trend") {
    const path = url.searchParams.get("path") ?? "artifacts/benchmark-trend.json";
    send(response, 200, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { points: [] });
    return;
  }

  if (method === "GET" && url.pathname === "/benchmarks/leaderboard") {
    const path = url.searchParams.get("path") ?? "artifacts/leaderboard.json";
    send(response, 200, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schemaVersion: "1.0", generatedAt: new Date().toISOString(), project: "cognibrain", privacy: { anonymized: true, noRawPrompts: true, noRawEvidence: true }, entries: [], publication: { anonymized: true, claimScope: "No leaderboard artifact has been generated yet." } });
    return;
  }

  if (method === "POST" && url.pathname === "/migration/export") {
    send(response, 202, defaultService.managedMigrationBundle(migrationExportSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/migration/import") {
    send(response, 202, defaultService.importMigrationBundle(migrationImportSchema.parse(await json(request)) as unknown as ManagedMigrationBundle));
    return;
  }

  if (method === "POST" && url.pathname === "/backup/verify") {
    const body = await json(request).catch(() => undefined);
    send(response, 200, body ? defaultService.verifyBackupRecovery(migrationImportSchema.parse(body) as unknown as ManagedMigrationBundle) : defaultService.verifyBackupRecovery());
    return;
  }

  if (method === "GET" && url.pathname === "/compliance") {
    send(response, 200, defaultService.complianceReport());
    return;
  }

  if (method === "GET" && url.pathname === "/compliance/export") {
    send(response, 200, defaultService.complianceReport());
    return;
  }

  if (method === "GET" && url.pathname === "/retention/rules") {
    send(response, 200, defaultService.listRetentionRules());
    return;
  }

  if (method === "POST" && url.pathname === "/retention/rules") {
    send(response, 202, defaultService.setRetentionRule(retentionRuleSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/retention/enforce") {
    const body = z.object({ userId: z.string().optional(), now: z.string().optional() }).parse(await json(request));
    send(response, 202, defaultService.enforceRetention(body.now ? new Date(body.now) : new Date(), body.userId));
    return;
  }

  if (method === "GET" && url.pathname === "/security/keys") {
    send(response, 200, defaultService.securityKeyReport());
    return;
  }

  if (method === "GET" && url.pathname === "/security/key-provider") {
    send(response, 200, defaultService.keyProviderReport());
    return;
  }

  if (method === "GET" && url.pathname === "/security/transport") {
    send(response, 200, defaultService.transportSecurityReport());
    return;
  }

  if (method === "POST" && url.pathname === "/security/key-rotation") {
    send(response, 202, defaultService.rotateEncryptionKeyMetadata(keyRotationSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/privacy/insights") {
    send(response, 200, defaultService.privacyInsights({
      epsilon: url.searchParams.get("epsilon") ? Number(url.searchParams.get("epsilon")) : undefined,
      kAnonymity: url.searchParams.get("k") ? Number(url.searchParams.get("k")) : undefined,
      includeExact: url.searchParams.get("includeExact") === "true"
    }));
    return;
  }

  if (method === "POST" && url.pathname === "/privacy/cross-brain-compute") {
    send(response, 200, defaultService.privacyPreservingCrossBrainCompute(crossBrainPrivacyComputeSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/storage") {
    send(response, 200, defaultService.storageStatus());
    return;
  }

  if (method === "GET" && url.pathname === "/managed/tenants") {
    send(response, 200, defaultService.listManagedTenants());
    return;
  }

  if (method === "POST" && url.pathname === "/managed/tenants") {
    send(response, 201, defaultService.createManagedTenant(managedTenantSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/managed/control-plane") {
    send(response, 200, defaultService.managedControlPlaneReport());
    return;
  }

  if (method === "GET" && url.pathname === "/providers") {
    send(response, 200, defaultService.providerStatus());
    return;
  }

  if (method === "POST" && url.pathname === "/translate") {
    const body = z.object({ text: z.string().min(1), sourceLanguage: z.string().optional(), targetLanguage: z.string().optional() }).parse(await json(request));
    send(response, 200, defaultService.translateText(body.text, body.sourceLanguage, body.targetLanguage));
    return;
  }

  if (method === "GET" && url.pathname === "/connectors") {
    const kind = url.searchParams.get("kind");
    const parsedKind = kind ? connectorManifestSchema.shape.kind.parse(kind) : undefined;
    send(response, 200, defaultService.listConnectorManifests(parsedKind));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors") {
    send(response, 201, defaultService.registerConnectorManifest(connectorManifestSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/connectors/sync-records") {
    send(response, 200, defaultService.listConnectorSyncRecords(url.searchParams.get("connectorId") ?? undefined));
    return;
  }

  if (method === "GET" && url.pathname === "/connectors/health") {
    send(response, 200, defaultService.connectorHealth(url.searchParams.get("connectorId") ?? undefined));
    return;
  }

  if (method === "GET" && url.pathname === "/connectors/auth") {
    send(response, 200, defaultService.connectorAuthStatus(url.searchParams.get("connectorId") ?? undefined));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/begin") {
    const body = connectorOAuthBeginSchema.parse(await json(request));
    const { connectorId, ...input } = body;
    send(response, 202, defaultService.beginConnectorOAuth(connectorId, input));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/callback") {
    send(response, 202, defaultService.completeConnectorOAuth(connectorOAuthCallbackSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && url.pathname === "/connectors/list") {
    const connectorId = url.searchParams.get("connectorId");
    if (!connectorId) {
      send(response, 400, { error: "connectorId is required" });
      return;
    }
    send(response, 200, await defaultService.listConnectorItems(connectorId));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/sync") {
    const body = connectorSyncSchema.parse(await json(request));
    const { connectorId, events, ...scope } = body;
    send(response, 202, defaultService.syncConnectorEvents(connectorId, events, scope));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/poll") {
    const body = connectorPollSchema.parse(await json(request));
    const { connectorId, ...scope } = body;
    send(response, 202, await defaultService.pollConnector(connectorId, scope));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/writeback") {
    const body = connectorWritebackSchema.parse(await json(request));
    const { connectorId, ...input } = body;
    send(response, 202, await defaultService.writebackConnector(connectorId, input));
    return;
  }

  if (method === "POST" && url.pathname === "/connectors/feedback") {
    send(response, 202, defaultService.recordConnectorFeedback(connectorFeedbackSchema.parse(await json(request))));
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
    const body = z
      .object({
        id: z.string().optional(),
        label: z.string().optional(),
        scope: z
          .object({
            userId: z.string().optional(),
            projectId: z.string().optional(),
            appId: z.string().optional(),
            orgId: z.string().optional(),
            agentId: z.string().optional()
          })
          .optional()
      })
      .parse(await json(request));
    send(response, 202, defaultService.learnRetrievalProfile(body.id, body.label, { scope: body.scope }));
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
    send(response, 201, serializeExtractionReport(report));
    return;
  }

  if (method === "POST" && url.pathname === "/ingest/media") {
    const body = z
      .object({
        brainId: z.string().optional(),
        sourceId: z.string().optional(),
        userId: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        event: extractionEventSchema
      })
      .parse(await json(request));
    const { event, ...scope } = body;
    send(response, 201, serializeExtractionReport(defaultService.ingestMedia(event, scope)));
    return;
  }

  if (method === "GET" && url.pathname === "/memories") {
    send(response, 200, defaultService.list(url.searchParams.get("userId") ?? undefined).map(serialize));
    return;
  }

  if (method === "GET" && url.pathname === "/episodes") {
    send(response, 200, defaultService.listEpisodes(url.searchParams.get("userId") ?? undefined));
    return;
  }

  if (method === "GET" && parts[0] === "episodes" && parts[1]) {
    send(response, 200, defaultService.getEpisode(parts[1]));
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
    if (method === "POST" && parts[2] === "consent") {
      const body = z
        .object({
          visibility: z.enum(["private", "user", "org", "public"]).optional(),
          allowTraining: z.boolean().optional(),
          retentionUntil: z.string().optional(),
          deleteOnRequest: z.boolean().optional()
        })
        .parse(await json(request));
      send(response, 202, serialize(defaultService.updateConsent(parts[1], body)));
      return;
    }
    if (method === "POST" && parts[2] === "revert") {
      const body = z.object({ auditEventId: z.string().optional() }).parse(await json(request));
      send(response, 202, serialize(defaultService.revertMemory(parts[1], body.auditEventId)));
      return;
    }
    if (method === "DELETE") {
      send(response, defaultService.delete(parts[1]) ? 204 : 404, null);
      return;
    }
  }

  if (method === "GET" && url.pathname === "/sync/status") {
    send(response, 200, defaultService.syncStatus());
    return;
  }

  if (method === "POST" && url.pathname === "/sync/offline-operations") {
    send(response, 201, defaultService.queueOfflineOperation(offlineOperationSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/sync/run") {
    send(response, 202, defaultService.syncOfflineOperations());
    return;
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

  if (method === "POST" && url.pathname === "/route") {
    send(response, 200, defaultService.routeMemory(searchSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/intent") {
    const body = z.object({ query: z.string().min(1) }).parse(await json(request));
    send(response, 200, defaultService.classifyQueryIntent(body.query));
    return;
  }

  if (method === "POST" && url.pathname === "/evidence-pack") {
    send(response, 200, defaultService.evidencePack(evidencePackSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/federation/search") {
    const body = searchSchema.extend({ brainIds: z.array(z.string()).min(1) }).parse(await json(request));
    const report = defaultService.federatedSearch(body);
    send(response, 200, {
      ...report,
      results: report.results.map((result) => ({ ...result, memory: serialize(result.memory) }))
    });
    return;
  }

  if (method === "POST" && url.pathname === "/feedback") {
    const body = feedbackSchema.parse(await json(request));
    send(response, 202, serialize(defaultService.feedback(body)));
    return;
  }

  if (method === "POST" && url.pathname === "/feedback/injection") {
    const report = defaultService.recordInjectionFeedback(injectionFeedbackSchema.parse(await json(request)));
    send(response, 202, {
      ...report,
      updatedMemories: report.updatedMemories.map(serialize)
    });
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "promote") {
    const body = z.object({ orgId: z.string().min(1) }).parse(await json(request));
    send(response, 202, serialize(defaultService.promoteSharedMemory(parts[1], body.orgId)));
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "share-request") {
    const body = z.object({ orgId: z.string().min(1), requestedBy: z.string().optional(), note: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(defaultService.requestSharedMemory(parts[1], body.orgId, body.requestedBy, body.note)));
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "share-revoke") {
    const body = z.object({ actorId: z.string().optional(), reason: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(defaultService.revokeSharedMemory(parts[1], body.actorId, body.reason)));
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

  if (method === "GET" && parts[0] === "learning" && parts[1] === "dream-policy" && parts[2]) {
    send(response, 200, defaultService.adaptiveDreamPolicy(parts[2]));
    return;
  }

  if (method === "POST" && parts[0] === "learning" && parts[1] === "observations" && parts[2]) {
    const body = z.object({ style: z.enum(["concise", "descriptive", "narrative"]).optional(), persist: z.boolean().optional(), limit: z.number().int().positive().max(12).optional() }).parse(await json(request));
    send(response, 202, defaultService.generateObservations(parts[2], body));
    return;
  }

  if (method === "GET" && parts[0] === "learning" && parts[1] === "predictions" && parts[2]) {
    const report = defaultService.predictionReport(parts[2], {
      query: url.searchParams.get("query") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
    });
    send(response, 200, {
      ...report,
      prefetch: report.prefetch.map((result) => ({ ...result, memory: serialize(result.memory) }))
    });
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

  if (method === "GET" && parts[0] === "verification" && parts[1]) {
    send(response, 200, defaultService.verificationQueue(parts[1]));
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[1] && parts[2] === "confirm") {
    const body = z.object({ userId: z.string().optional() }).parse(await json(request));
    send(response, 200, serialize(defaultService.confirmMemory(parts[1], body.userId)));
    return;
  }

  if (method === "POST" && parts[0] === "memories" && parts[1] && parts[2] === "retract") {
    const body = z.object({ userId: z.string().optional(), reason: z.string().optional() }).parse(await json(request));
    send(response, 200, serialize(defaultService.retractMemory(parts[1], body.userId, body.reason)));
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

function serializeExtractionReport(report: ExtractionReport) {
  return {
    memories: report.memories.map(serialize),
    entityLinks: report.entityLinks,
    stages: report.stages,
    failures: report.failures,
    enrichmentCandidates: report.enrichmentCandidates,
    learnedRules: report.learnedRules
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
