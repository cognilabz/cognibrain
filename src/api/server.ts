import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { defaultService, initializeDefaultMemoryService } from "./service";
import type { ManagedMigrationBundle, Memory, MemoryPolicyOperation } from "../core";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const dreamCheckIntervalMinutes = Number(process.env.MEMORY_DREAM_CHECK_INTERVAL_MINUTES ?? 15);
export type AuthMode = "open-local-dev" | "api-key" | "jwt-oidc";
export type AuthStatusReport = {
  mode: AuthMode;
  protected: boolean;
  actorId?: string;
  userId?: string;
  orgId?: string;
  projectId?: string;
  scopes?: string[];
  warning?: string;
};
export type AuthResult = {
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
import {
  ActorScopeError,
  PayloadTooLargeError,
  actorScopeViolation,
  applyRequestHeaders,
  authenticate,
  authorizeResource,
  authorizeRoute,
  checkRateLimit,
  json,
  parseRelationTypes,
  rememberRequestAuth,
  routePermission,
  send,
  sendText,
  serialize,
  serializeExtractionReport,
  sourceKind
} from "./server/helpers";
import { handleDreamRoutes } from "./server/dreamRoutes";
import { handleGraphRoutes } from "./server/routes/graphRoutes";
import { handlePlatformRoutes } from "./server/routes/platformRoutes";
import { handleConnectorRoutes } from "./server/routes/connectorRoutes";
import { handleMemoryRoutes } from "./server/routes/memoryRoutes";
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
  rememberRequestAuth(request, auth);
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
  const route = routePermission(method, url.pathname);
  if (route) {
    const lookedUpScope = defaultService.resourceAuthorizationScope({
      resource: route.resource,
      path: url.pathname,
      userId: url.searchParams.get("userId") ?? undefined,
      orgId: url.searchParams.get("orgId") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      connectorId: url.searchParams.get("connectorId") ?? (parts[0] === "connectors" ? parts[1] : undefined),
      memoryId: parts[0] === "memories" || parts[0] === "connectors" && parts[1] === "review-queue" ? parts[1] === "review-queue" ? parts[2] : parts[1] : undefined,
      contextPackId: parts[0] === "context-packs" || parts[0] === "coding-context-packs" ? parts[1] : undefined,
      evidencePackId: parts[0] === "evidence-pack" ? parts[1] : undefined,
      dreamJobId: parts[0] === "dream" && parts[1] === "jobs" ? parts[2] : undefined,
      policyRuleId: parts[0] === "policy" || parts[0] === "retention" ? parts[2] : undefined
    });
    const resourceDecision = authorizeResource(auth.statusReport, route.action, {
      resource: route.resource,
      action: route.action,
      path: url.pathname,
      userId: lookedUpScope?.userId ?? url.searchParams.get("userId") ?? undefined,
      orgId: lookedUpScope?.orgId ?? url.searchParams.get("orgId") ?? undefined,
      projectId: lookedUpScope?.projectId ?? url.searchParams.get("projectId") ?? undefined,
      connectorId: url.searchParams.get("connectorId") ?? parts[1],
      memoryId: parts[1],
      contextPackId: parts[1],
      evidencePackId: parts[1],
      dreamJobId: parts[2],
      found: lookedUpScope?.found,
      lookupReason: lookedUpScope?.lookupReason
    });
    if (!resourceDecision.allowed) {
      defaultService.recordSecurityEvent({ actorId: auth.statusReport.actorId, userId: auth.statusReport.userId, path: url.pathname, method, status: 403, code: "resource_scope_forbidden" });
      send(response, 403, { error: resourceDecision.reason, code: "resource_scope_forbidden", requestId: response.getHeader("X-Request-ID") });
      return;
    }
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

  if (method === "GET" && url.pathname === "/metrics/prometheus") {
    sendText(response, 200, defaultService.prometheusMetrics(), "text/plain; version=0.0.4");
    return;
  }

  if (await handleGraphRoutes({ method, url, parts, request, response })) return;

  if (await handlePlatformRoutes({ method, url, parts, request, response, auth })) return;

  if (await handleConnectorRoutes({ method, url, parts, request, response })) return;

  if (await handleMemoryRoutes({ method, url, parts, request, response })) return;

  if (await handleDreamRoutes({ method, url, parts, request, response })) return;

  send(response, 404, { error: "Not found" });
}

if (process.env.NODE_ENV !== "test") {
  await initializeDefaultMemoryService();
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
