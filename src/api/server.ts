import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, createVerify, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { defaultService } from "./service";
import type { ExtractionReport, ManagedMigrationBundle, Memory, MemoryPolicyOperation } from "../core";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const dreamCheckIntervalMinutes = Number(process.env.MEMORY_DREAM_CHECK_INTERVAL_MINUTES ?? 15);
const requestAuth = new WeakMap<IncomingMessage, AuthResult>();
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type AuthMode = "open-local-dev" | "api-key" | "jwt-oidc";
type AuthStatusReport = {
  mode: AuthMode;
  protected: boolean;
  actorId?: string;
  userId?: string;
  orgId?: string;
  projectId?: string;
  scopes?: string[];
  warning?: string;
};
type AuthResult = {
  allowed: boolean;
  status: number;
  error?: string;
  code?: string;
  statusReport: AuthStatusReport;
};

import {
  relationTypeSchema,
  memoryInputSchema,
  searchSchema,
  evidencePackSchema,
  contextEnrichmentSchema,
  harnessActionSchema,
  codeCorrectionSchema,
  actionGuardSchema,
  patchEvidenceSchema,
  graphExportSchema,
  inferenceRuleSchema,
  extractionEventSchema,
  extractSchema,
  entityMergeSchema,
  entityEnrichmentSchema,
  timelineSummarySchema,
  feedbackSchema,
  injectionFeedbackSchema,
  trainingSampleSchema,
  retrievalProfileSchema,
  identityLinkSchema,
  brainSchema,
  sourceSchema,
  agentSchema,
  personaSchema,
  webhookSchema,
  marketplaceModuleSchema,
  marketplaceSubmissionSchema,
  marketplaceReviewSchema,
  migrationExportSchema,
  migrationImportSchema,
  managedTenantSchema,
  crossBrainPrivacyComputeSchema,
  connectorManifestSchema,
  connectorOAuthBeginSchema,
  connectorOAuthCallbackSchema,
  connectorOAuthRevokeSchema,
  connectorSyncSchema,
  connectorWritebackSchema,
  connectorFeedbackSchema,
  connectorTelemetrySchema,
  connectorPollSchema,
  auditTypeSchema,
  policyRuleSchema,
  retentionRuleSchema,
  keyRotationSchema,
  offlineOperationSchema
} from "./serverSchemas";
export const server = createServer(async (request, response) => {
  applyRequestHeaders(request, response);
  try {
    await route(request, response);
  } catch (error) {
    const status = error instanceof PayloadTooLargeError ? 413 : error instanceof ActorScopeError ? 403 : error instanceof z.ZodError ? 400 : 500;
    send(response, status, {
      requestId: response.getHeader("X-Request-ID"),
      code: error instanceof PayloadTooLargeError ? "payload_too_large" : error instanceof ActorScopeError ? "actor_scope_forbidden" : error instanceof z.ZodError ? "validation_error" : "internal_error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname === "/v1") url.pathname = "/";
  if (url.pathname.startsWith("/v1/")) url.pathname = url.pathname.slice(3) || "/";
  const method = request.method ?? "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "OPTIONS") {
    send(response, 204, null);
    return;
  }

  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    send(response, 429, { error: "Rate limit exceeded", code: "rate_limit_exceeded", requestId: response.getHeader("X-Request-ID"), retryAfterMs: Math.max(0, rate.resetAt - Date.now()) });
    return;
  }

  const auth = authenticate(request, url.pathname);
  requestAuth.set(request, auth);
  if (!auth.allowed) {
    defaultService.recordSecurityEvent({ actorId: auth.statusReport.actorId, userId: auth.statusReport.userId, path: url.pathname, method, status: auth.status, code: auth.code ?? "auth_denied" });
    send(response, auth.status, { error: auth.error, code: auth.code, requestId: response.getHeader("X-Request-ID") });
    return;
  }
  const scopeViolation = actorScopeViolation(auth.statusReport, Object.fromEntries(url.searchParams.entries()));
  if (scopeViolation) {
    defaultService.recordSecurityEvent({ actorId: auth.statusReport.actorId, userId: auth.statusReport.userId, path: url.pathname, method, status: 403, code: "actor_scope_forbidden" });
    send(response, 403, { error: scopeViolation, code: "actor_scope_forbidden", requestId: response.getHeader("X-Request-ID") });
    return;
  }
  const permission = authorizeRoute(method, url.pathname, auth.statusReport);
  if (!permission.allowed) {
    defaultService.recordSecurityEvent({ actorId: auth.statusReport.actorId, userId: auth.statusReport.userId, path: url.pathname, method, status: 403, code: "rbac_forbidden" });
    send(response, 403, { error: permission.reason, code: "rbac_forbidden", requestId: response.getHeader("X-Request-ID") });
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    send(response, 200, { ok: true, auth: auth.statusReport, ...defaultService.health(url.searchParams.get("userId") ?? undefined) });
    return;
  }

  if (method === "GET" && url.pathname === "/auth/status") {
    send(response, 200, auth.statusReport);
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

  if (method === "POST" && url.pathname === "/entities/enrich") {
    send(response, 202, defaultService.runEntityEnrichment(entityEnrichmentSchema.parse(await json(request))));
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

  if (method === "GET" && url.pathname === "/audit/chain") {
    send(response, 200, defaultService.auditChain({
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

  if (method === "GET" && (url.pathname === "/sdk/openapi" || url.pathname === "/openapi.json" || url.pathname === "/v1/openapi.json")) {
    send(response, 200, defaultService.apiDescription(auth.statusReport));
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

  if (method === "GET" && url.pathname === "/policy/rules") {
    send(response, 200, defaultService.listPolicyRules());
    return;
  }

  if (method === "POST" && url.pathname === "/policy/rules") {
    send(response, 202, defaultService.setPolicyRule(policyRuleSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/policy/evaluate") {
    const body = z
      .object({
        operation: z.enum(["write", "retrieve", "dream", "export", "delete", "all"]),
        memoryId: z.string().optional(),
        input: memoryInputSchema.partial().optional(),
        actor: z.record(z.unknown()).optional()
      })
      .parse(await json(request));
    const target = body.memoryId ? defaultService.get(body.memoryId) : body.input;
    if (!target) throw new Error("policy evaluation requires memoryId or input");
    send(response, 200, defaultService.evaluatePolicy(body.operation as MemoryPolicyOperation, target as Memory, body.actor ?? {}));
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

  if (method === "GET" && url.pathname === "/retention/review") {
    const now = url.searchParams.get("now");
    send(response, 200, defaultService.retentionReview(now ? new Date(now) : new Date(), url.searchParams.get("userId") ?? undefined));
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

  if (method === "POST" && url.pathname === "/connectors/auth/revoke") {
    const body = connectorOAuthRevokeSchema.parse(await json(request));
    send(response, 202, defaultService.revokeConnectorAuth(body.connectorId, body.actorId));
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

  if (method === "POST" && url.pathname === "/connectors/telemetry") {
    send(response, 202, defaultService.recordConnectorTelemetry(connectorTelemetrySchema.parse(await json(request))));
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

  if (method === "POST" && url.pathname === "/actions") {
    send(response, 201, serialize(defaultService.recordHarnessAction(harnessActionSchema.parse(await json(request)))));
    return;
  }

  if (method === "POST" && url.pathname === "/code/corrections") {
    send(response, 201, serialize(defaultService.recordCodeCorrection(codeCorrectionSchema.parse(await json(request)))));
    return;
  }

  if (method === "POST" && url.pathname === "/code/action-guard") {
    send(response, 200, defaultService.guardAction(actionGuardSchema.parse(await json(request))));
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
    if (method === "POST" && parts[2] === "archive") {
      send(response, 202, serialize(defaultService.archive(parts[1])));
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

  if (method === "POST" && url.pathname === "/context/enrich") {
    send(response, 200, await defaultService.enrichContext(contextEnrichmentSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/coding-context-pack") {
    send(response, 200, defaultService.codingContextPack(evidencePackSchema.parse(await json(request))));
    return;
  }

  if (method === "POST" && url.pathname === "/patch-evidence") {
    send(response, 200, defaultService.patchEvidenceTrail(patchEvidenceSchema.parse(await json(request))));
    return;
  }

  if (method === "GET" && parts[0] === "evidence-pack" && parts[1]) {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
    return;
  }

  if (method === "GET" && parts[0] === "context-packs" && parts[1] && parts[2] === "evidence") {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
    return;
  }

  if (method === "GET" && parts[0] === "coding-context-packs" && parts[1]) {
    send(response, 200, defaultService.getCodingContextPack(parts[1]));
    return;
  }

  if (method === "GET" && parts[0] === "context-packs" && parts[1]) {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
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
    const body = z.object({ orgId: z.string().min(1), reviewerId: z.string().optional(), note: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(body.reviewerId ? defaultService.reviewSharedMemory(parts[1], { orgId: body.orgId, reviewerId: body.reviewerId, decision: "approve", note: body.note }) : defaultService.promoteSharedMemory(parts[1], body.orgId)));
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

class PayloadTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
  }
}

class ActorScopeError extends Error {}

function json(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    const limit = requestBodyLimitBytes();
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(new PayloadTooLargeError(limit));
      }
    });
    request.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const violation = actorScopeViolation(requestAuth.get(request)?.statusReport, parsed);
        if (violation) reject(new ActorScopeError(violation));
        else resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  setCommonHeaders(response);
  if (status === 204 || payload === null) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response: ServerResponse, status: number, payload: string, contentType = "text/plain"): void {
  response.statusCode = status;
  setCommonHeaders(response);
  response.setHeader("Content-Type", contentType);
  response.end(payload);
}

function applyRequestHeaders(request: IncomingMessage, response: ServerResponse): void {
  response.setHeader("X-Request-ID", request.headers["x-request-id"]?.toString() || randomUUID());
  applyCors(request, response);
}

function setCommonHeaders(response: ServerResponse): void {
  if (!response.hasHeader("Access-Control-Allow-Origin")) response.setHeader("Access-Control-Allow-Origin", corsDefaultOrigin());
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-api-key, x-actor-id, x-request-id");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin?.toString();
  const allowed = configuredCorsOrigins();
  if (!origin) {
    response.setHeader("Access-Control-Allow-Origin", corsDefaultOrigin());
    return;
  }
  if (!allowed.length || allowed.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", allowed.length ? origin : corsDefaultOrigin());
    response.setHeader("Vary", "Origin");
    return;
  }
  response.setHeader("Access-Control-Allow-Origin", "null");
}

function corsDefaultOrigin(): string {
  const allowed = configuredCorsOrigins();
  return allowed[0] ?? String.fromCharCode(42);
}

function configuredCorsOrigins(): string[] {
  return (process.env.MEMORY_CORS_ORIGINS ?? process.env.MEMORY_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function checkRateLimit(request: IncomingMessage): { allowed: boolean; resetAt: number } {
  const max = Number(process.env.MEMORY_RATE_LIMIT_MAX ?? (productionMode() ? 120 : 0));
  if (!max) return { allowed: true, resetAt: Date.now() };
  const windowMs = Number(process.env.MEMORY_RATE_LIMIT_WINDOW_MS ?? 60_000);
  const key = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || request.socket.remoteAddress || "local";
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }
  current.count += 1;
  return { allowed: current.count <= max, resetAt: current.resetAt };
}

function requestBodyLimitBytes(): number {
  return Number(process.env.MEMORY_REQUEST_BODY_LIMIT_BYTES ?? (productionMode() ? 1_048_576 : 10_485_760));
}

function productionMode(): boolean {
  return process.env.MEMORY_SECURITY_MODE === "production" || process.env.MEMORY_PRODUCTION_MODE === "true";
}

function authenticate(request: IncomingMessage, pathname: string): AuthResult {
  const configured = configuredApiKeys();
  const jwtConfigured = jwtVerifierConfigured();
  const requiresAuth = process.env.MEMORY_REQUIRE_AUTH === "true" || configured.length > 0 || jwtConfigured || productionMode();
  const statusReport = requiresAuth
    ? { mode: jwtConfigured ? "jwt-oidc" as const : "api-key" as const, protected: true, actorId: request.headers["x-actor-id"]?.toString() }
    : { mode: "open-local-dev" as const, protected: false, warning: "API authentication is disabled for local development. Set MEMORY_API_KEYS or MEMORY_REQUIRE_AUTH=true before exposing this server." };
  if (!requiresAuth || pathname === "/health") return { allowed: true, status: 200, statusReport };
  const token = request.headers["x-api-key"]?.toString() ?? bearerToken(request.headers.authorization);
  if (!token) return { allowed: false, status: 401, error: "API key required", code: "auth_required", statusReport };
  if (jwtConfigured && bearerToken(request.headers.authorization)) {
    const verified = verifyJwt(token);
    if (!verified.valid) return { allowed: false, status: 403, error: verified.error ?? "Invalid JWT", code: "jwt_invalid", statusReport };
    return {
      allowed: true,
      status: 200,
      statusReport: {
        mode: "jwt-oidc",
        protected: true,
        actorId: verified.actorId,
        userId: verified.userId,
        orgId: verified.orgId,
        projectId: verified.projectId,
        scopes: verified.scopes
      }
    };
  }
  if (!configured.length) return { allowed: false, status: 403, error: "No API keys or JWT verifier are configured", code: "auth_not_configured", statusReport };
  if (!configured.some((key) => secureEqual(key, token))) return { allowed: false, status: 403, error: "Invalid API key", code: "auth_invalid", statusReport };
  return { allowed: true, status: 200, statusReport: { ...statusReport, actorId: request.headers["x-actor-id"]?.toString() ?? "api-key" } };
}

function configuredApiKeys(): string[] {
  return (process.env.MEMORY_API_KEYS ?? process.env.MEMORY_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function bearerToken(header?: string): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function jwtVerifierConfigured(): boolean {
  return Boolean(process.env.MEMORY_JWT_ISSUER && process.env.MEMORY_JWT_AUDIENCE && (process.env.MEMORY_JWT_HS256_SECRET || process.env.MEMORY_JWT_PUBLIC_KEY || process.env.MEMORY_JWT_PUBLIC_KEY_BASE64));
}

function verifyJwt(token: string): { valid: boolean; error?: string; actorId?: string; userId?: string; orgId?: string; projectId?: string; scopes?: string[] } {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, error: "JWT must have three segments" };
  const [encodedHeader, encodedPayload, signature] = parts;
  let header: { alg?: string; typ?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as { alg?: string; typ?: string };
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as Record<string, unknown>;
  } catch {
    return { valid: false, error: "JWT header or payload is not valid JSON" };
  }
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBytes = base64UrlDecode(signature);
  const verified = header.alg === "HS256"
    ? verifyHs256(signingInput, signatureBytes)
    : header.alg === "RS256"
      ? verifyRs256(signingInput, signatureBytes)
      : false;
  if (!verified) return { valid: false, error: `Unsupported or invalid JWT signature (${header.alg ?? "missing alg"})` };
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) return { valid: false, error: "JWT expired" };
  if (typeof payload.nbf === "number" && payload.nbf > now) return { valid: false, error: "JWT not active yet" };
  if (process.env.MEMORY_JWT_ISSUER && payload.iss !== process.env.MEMORY_JWT_ISSUER) return { valid: false, error: "JWT issuer mismatch" };
  const expectedAudience = process.env.MEMORY_JWT_AUDIENCE;
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud.map(String) : typeof aud === "string" ? [aud] : [];
  if (expectedAudience && !audiences.includes(expectedAudience)) return { valid: false, error: "JWT audience mismatch" };
  const scopes = jwtScopes(payload);
  const userId = stringClaim(payload, "userId") ?? stringClaim(payload, "sub");
  return {
    valid: true,
    actorId: stringClaim(payload, "actorId") ?? userId,
    userId,
    orgId: stringClaim(payload, "orgId") ?? stringClaim(payload, "org_id"),
    projectId: stringClaim(payload, "projectId") ?? stringClaim(payload, "project_id"),
    scopes
  };
}

function verifyHs256(signingInput: string, signature: Buffer): boolean {
  const secret = process.env.MEMORY_JWT_HS256_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  return buffersEqual(expected, signature);
}

function verifyRs256(signingInput: string, signature: Buffer): boolean {
  const key = process.env.MEMORY_JWT_PUBLIC_KEY ?? (process.env.MEMORY_JWT_PUBLIC_KEY_BASE64 ? Buffer.from(process.env.MEMORY_JWT_PUBLIC_KEY_BASE64, "base64").toString("utf8") : undefined);
  if (!key) return false;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(key, signature);
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function buffersEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function secureEqual(a: string, b: string): boolean {
  return buffersEqual(Buffer.from(a), Buffer.from(b));
}

function stringClaim(payload: Record<string, unknown>, key: string): string | undefined {
  return typeof payload[key] === "string" && payload[key] ? payload[key] : undefined;
}

function jwtScopes(payload: Record<string, unknown>): string[] {
  const raw = payload.scope ?? payload.scp ?? payload.scopes;
  if (typeof raw === "string") return raw.split(/\s+/).filter(Boolean);
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

function authorizeRoute(method: string, pathname: string, auth: AuthStatusReport): { allowed: boolean; reason?: string } {
  if (auth.mode !== "jwt-oidc") return { allowed: true };
  const scopes = new Set(auth.scopes ?? []);
  if (scopes.has("admin") || scopes.has("memory:admin")) return { allowed: true };
  const needed = routeScope(method, pathname);
  if (!needed || scopes.has(needed)) return { allowed: true };
  return { allowed: false, reason: `Missing required scope: ${needed}` };
}

function routeScope(method: string, pathname: string): string | undefined {
  if (pathname === "/health" || pathname === "/auth/status" || pathname === "/openapi.json" || pathname === "/sdk/openapi") return undefined;
  if (method === "GET") return "memory:read";
  if (pathname.includes("/policy") || pathname.includes("/retention") || pathname.includes("/security")) return "memory:admin";
  return "memory:write";
}

function actorScopeViolation(auth: AuthStatusReport | undefined, value: unknown): string | undefined {
  if (!auth || auth.mode !== "jwt-oidc") return undefined;
  if (auth.scopes?.some((scope) => scope === "admin" || scope === "memory:admin" || scope === "memory:all")) return undefined;
  if (!value || typeof value !== "object") return undefined;
  const body = value as Record<string, unknown>;
  const checks: Array<[keyof AuthStatusReport, string]> = [["userId", "userId"], ["orgId", "orgId"], ["projectId", "projectId"]];
  for (const [authKey, bodyKey] of checks) {
    const expected = auth[authKey];
    const observed = body[bodyKey];
    if (expected && typeof observed === "string" && observed && observed !== expected) {
      return `${bodyKey} must match authenticated actor scope`;
    }
  }
  return undefined;
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
    claims: report.claims,
    durabilityDecisions: report.durabilityDecisions,
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
