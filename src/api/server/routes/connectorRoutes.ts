import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "../../service";
import { connectorFeedbackSchema, connectorManifestSchema, connectorOAuthBeginSchema, connectorOAuthCallbackSchema, connectorOAuthRevokeSchema, connectorPollSchema, connectorSyncSchema, connectorTelemetrySchema, connectorWritebackSchema } from "../../serverSchemas";
import { json, send, serialize } from "../helpers";
import { connectorConfigSummary, upsertConnectorConfigValues } from "../../../connectors/localConnectorConfig";
import { requiredVendorEnv } from "../../../connectors/vendorConfig";

type RouteContext = {
  method: string;
  url: URL;
  parts: string[];
  request: IncomingMessage;
  response: ServerResponse;
  auth?: { statusReport: Record<string, unknown> };
};
const vendorProviderSchema = z.enum(["github", "slack", "discord", "jira", "confluence", "notion", "linear", "gitlab", "azure-devops", "teams", "gmail", "google-drive", "google-calendar", "asana", "clickup", "sentry", "datadog", "pagerduty", "posthog"]);

export async function handleConnectorRoutes(context: RouteContext): Promise<boolean> {
  const { method, url, parts, request, response } = context;
  if (method === "GET" && url.pathname === "/connectors") {
    const kind = url.searchParams.get("kind");
    const parsedKind = kind ? connectorManifestSchema.shape.kind.parse(kind) : undefined;
    send(response, 200, defaultService.listConnectorManifests(parsedKind));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors") {
    send(response, 201, defaultService.registerConnectorManifest(connectorManifestSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/sync-records") {
    send(response, 200, defaultService.listConnectorSyncRecords(url.searchParams.get("connectorId") ?? undefined));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/review-queue") {
    const status = url.searchParams.get("status");
    send(response, 200, defaultService.listConnectorReviewQueue({
      connectorId: url.searchParams.get("connectorId") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      status: status ? z.enum(["pending", "approved", "rejected"]).parse(status) : undefined
    }).map(serialize));
    return true;
  }

  if (method === "POST" && parts[0] === "connectors" && parts[1] === "review-queue" && parts[2] && parts[3] === "review") {
    const body = z.object({
      decision: z.enum(["approve", "reject"]),
      reviewerId: z.string().optional(),
      reason: z.string().optional()
    }).parse(await json(request));
    send(response, 200, serialize(defaultService.reviewConnectorMemory(parts[2], body)));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/health") {
    send(response, 200, defaultService.connectorHealth(url.searchParams.get("connectorId") ?? undefined));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/config") {
    const provider = url.searchParams.get("provider");
    const keys = provider
      ? requiredVendorEnv(vendorProviderSchema.parse(provider))
      : [...new Set(defaultService.listConnectorManifests().flatMap((manifest) => manifest.vendor?.requiredEnv ?? []))];
    send(response, 200, connectorConfigSummary(keys));
    return true;
  }

  if ((method === "POST" || method === "PUT") && url.pathname === "/connectors/config") {
    const body = z.object({ values: z.record(z.string()) }).parse(await json(request));
    send(response, 202, upsertConnectorConfigValues(body.values));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/auth") {
    send(response, 200, defaultService.connectorAuthStatus(url.searchParams.get("connectorId") ?? undefined));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/begin") {
    const body = connectorOAuthBeginSchema.parse(await json(request));
    const { connectorId, ...input } = body;
    send(response, 202, defaultService.beginConnectorOAuth(connectorId, input));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/callback") {
    send(response, 202, defaultService.completeConnectorOAuth(connectorOAuthCallbackSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/revoke") {
    const body = connectorOAuthRevokeSchema.parse(await json(request));
    send(response, 202, defaultService.revokeConnectorAuth(body.connectorId, body.actorId));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/auth/refresh") {
    const body = connectorOAuthRevokeSchema.pick({ connectorId: true }).parse(await json(request));
    send(response, 202, defaultService.refreshConnectorOAuth(body.connectorId));
    return true;
  }

  if (method === "GET" && url.pathname === "/connectors/list") {
    const connectorId = url.searchParams.get("connectorId");
    if (!connectorId) {
      send(response, 400, { error: "connectorId is required" });
      return true;
    }
    send(response, 200, await defaultService.listConnectorItems(connectorId));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/sync") {
    const body = connectorSyncSchema.parse(await json(request));
    const { connectorId, events, ...scope } = body;
    send(response, 202, defaultService.syncConnectorEvents(connectorId, events, scope));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/poll") {
    const body = connectorPollSchema.parse(await json(request));
    const { connectorId, ...scope } = body;
    send(response, 202, await defaultService.pollConnector(connectorId, scope));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/writeback") {
    const body = connectorWritebackSchema.parse(await json(request));
    const { connectorId, ...input } = body;
    send(response, 202, await defaultService.writebackConnector(connectorId, input));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/feedback") {
    send(response, 202, defaultService.recordConnectorFeedback(connectorFeedbackSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/connectors/telemetry") {
    send(response, 202, defaultService.recordConnectorTelemetry(connectorTelemetrySchema.parse(await json(request))));
    return true;
  }

  return false;
}
