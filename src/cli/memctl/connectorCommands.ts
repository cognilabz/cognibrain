import type { MemoryService } from "../../api/service";
import {
  connectorKindFromEnv,
  connectorOperationFromEnv,
  csvList,
  fail,
  isConnectorFeedbackKind,
  isConnectorTelemetryKind,
  mediaTypeFromEnv,
  metadataFromEnv
} from "./env";

export async function handleConnectorCommand(
  command: string | undefined,
  args: string[],
  context: { service: MemoryService; userId: string }
): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "connectors": {
    const kind = connectorKindFromEnv();
    console.log(JSON.stringify(service.listConnectorManifests(kind), null, 2));
    return true;
  }
  case "connector-register": {
    const manifestJson = args.join(" ");
    if (!manifestJson) fail("Usage: memctl connector-register '<manifest-json>'");
    console.log(JSON.stringify(service.registerConnectorManifest(JSON.parse(manifestJson)), null, 2));
    return true;
  }
  case "connector-sync": {
    const [connectorId, ...contentParts] = args;
    if (!connectorId || contentParts.length === 0) fail("Usage: memctl connector-sync <connector-id> <content>");
    console.log(
      JSON.stringify(
        service.syncConnectorEvents(
          connectorId,
          [{
            role: "user",
            content: contentParts.join(" "),
            externalId: process.env.MEMORY_EXTERNAL_ID,
            mediaType: mediaTypeFromEnv(),
            language: process.env.MEMORY_LANGUAGE,
            uri: process.env.MEMORY_SOURCE_URI,
            mimeType: process.env.MEMORY_MIME_TYPE,
            metadata: metadataFromEnv()
          }],
          {
            userId,
            agentId: process.env.MEMORY_AGENT_ID,
            sessionId: process.env.MEMORY_SESSION_ID,
            appId: process.env.MEMORY_APP_ID,
            orgId: process.env.MEMORY_ORG_ID,
            projectId: process.env.MEMORY_PROJECT_ID,
            brainId: process.env.MEMORY_BRAIN_ID,
            sourceId: process.env.MEMORY_SOURCE_ID
          }
        ),
        null,
        2
      )
    );
    return true;
  }
  case "connector-sync-records": {
    console.log(JSON.stringify(service.listConnectorSyncRecords(args[0]), null, 2));
    return true;
  }
  case "connector-health": {
    console.log(JSON.stringify(service.connectorHealth(args[0]), null, 2));
    return true;
  }

  case "connector-auth": {
    console.log(JSON.stringify(service.connectorAuthStatus(args[0]), null, 2));
    return true;
  }

  case "connector-auth-begin": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-auth-begin <connector-id>");
    console.log(JSON.stringify(service.beginConnectorOAuth(connectorId, {
      redirectUri: process.env.MEMORY_OAUTH_REDIRECT_URI,
      scopes: process.env.MEMORY_OAUTH_SCOPES?.split(",").map((item) => item.trim()).filter(Boolean),
      stateSalt: process.env.MEMORY_OAUTH_STATE_SALT
    }), null, 2));
    return true;
  }

  case "connector-auth-callback": {
    const [connectorId, state, codeOrTokenRef] = args;
    if (!connectorId || !state || !codeOrTokenRef) fail("Usage: memctl connector-auth-callback <connector-id> <state> <code-or-token-ref>");
    console.log(JSON.stringify(service.completeConnectorOAuth({
      connectorId,
      state,
      code: process.env.MEMORY_OAUTH_TOKEN_REF ? undefined : codeOrTokenRef,
      tokenRef: process.env.MEMORY_OAUTH_TOKEN_REF ?? (codeOrTokenRef.startsWith("oauth://") ? codeOrTokenRef : undefined),
      error: process.env.MEMORY_OAUTH_ERROR
    }), null, 2));
    return true;
  }
  case "connector-auth-revoke": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-auth-revoke <connector-id>");
    console.log(JSON.stringify(service.revokeConnectorAuth(connectorId, process.env.MEMORY_ACTOR_ID ?? "cli"), null, 2));
    return true;
  }
  case "connector-list": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-list <connector-id>");
    console.log(JSON.stringify(await service.listConnectorItems(connectorId), null, 2));
    return true;
  }
  case "connector-poll": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-poll <connector-id>");
    console.log(
      JSON.stringify(
        await service.pollConnector(connectorId, {
          userId,
          agentId: process.env.MEMORY_AGENT_ID,
          sessionId: process.env.MEMORY_SESSION_ID,
          appId: process.env.MEMORY_APP_ID,
          orgId: process.env.MEMORY_ORG_ID,
          projectId: process.env.MEMORY_PROJECT_ID,
          brainId: process.env.MEMORY_BRAIN_ID,
          sourceId: process.env.MEMORY_SOURCE_ID
        }),
        null,
        2
      )
    );
    return true;
  }
  case "connector-writeback": {
    const [connectorId, ...contentParts] = args;
    if (!connectorId) fail("Usage: memctl connector-writeback <connector-id> [content]");
    const target = process.env.MEMORY_CONNECTOR_TARGET_JSON ? JSON.parse(process.env.MEMORY_CONNECTOR_TARGET_JSON) : {};
    console.log(
      JSON.stringify(
        await service.writebackConnector(connectorId, {
          operation: connectorOperationFromEnv(),
          memoryIds: process.env.MEMORY_MEMORY_IDS?.split(",").map((item) => item.trim()).filter(Boolean),
          externalId: process.env.MEMORY_EXTERNAL_ID,
          content: contentParts.join(" ") || undefined,
          target,
          metadata: metadataFromEnv(),
          dryRun: process.env.MEMORY_CONNECTOR_DRY_RUN !== "false"
        }),
        null,
        2
      )
    );
    return true;
  }
  case "connector-feedback": {
    const [connectorId, kind, ...contentParts] = args;
    if (!connectorId || !kind || contentParts.length === 0 || !isConnectorFeedbackKind(kind)) fail("Usage: memctl connector-feedback <connector-id> <accepted_change|rejected_suggestion|failing_test|user_correction> <content>");
    console.log(
      JSON.stringify(
        service.recordConnectorFeedback({
          connectorId,
          userId,
          kind,
          content: contentParts.join(" "),
          memoryIds: process.env.MEMORY_MEMORY_IDS?.split(",").map((item) => item.trim()).filter(Boolean),
          externalId: process.env.MEMORY_EXTERNAL_ID,
          metadata: metadataFromEnv()
        }),
        null,
        2
      )
    );
    return true;
  }
  case "connector-telemetry": {
    const [connectorId, kind, ...contentParts] = args;
    if (!connectorId || !kind || !isConnectorTelemetryKind(kind)) fail("Usage: memctl connector-telemetry <connector-id> <accepted_suggestion|rejected_suggestion|context_pack_feedback|tool_outcome> [content]");
    console.log(
      JSON.stringify(
        service.recordConnectorTelemetry({
          connectorId,
          userId,
          harnessId: process.env.MEMORY_HARNESS_ID ?? process.env.MEMORY_AGENT_ID,
          kind,
          content: contentParts.join(" ") || undefined,
          query: process.env.MEMORY_QUERY,
          memoryIds: csvList(process.env.MEMORY_MEMORY_IDS),
          acceptedMemoryIds: csvList(process.env.MEMORY_ACCEPTED_IDS),
          rejectedMemoryIds: csvList(process.env.MEMORY_REJECTED_IDS),
          command: process.env.MEMORY_COMMAND,
          filesChanged: csvList(process.env.MEMORY_FILES_CHANGED),
          tests: process.env.MEMORY_TESTS_JSON ? JSON.parse(process.env.MEMORY_TESTS_JSON) : undefined,
          externalId: process.env.MEMORY_EXTERNAL_ID,
          metadata: metadataFromEnv()
        }),
        null,
        2
      )
    );
    return true;
  }
  case "media-ingest": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl media-ingest <content-or-transcript>");
    console.log(
      JSON.stringify(
        service.ingestMedia(
          {
            role: "user",
            content,
            mediaType: mediaTypeFromEnv() ?? "document",
            language: process.env.MEMORY_LANGUAGE,
            uri: process.env.MEMORY_SOURCE_URI,
            mimeType: process.env.MEMORY_MIME_TYPE,
            metadata: metadataFromEnv()
          },
          {
            userId,
            agentId: process.env.MEMORY_AGENT_ID,
            sessionId: process.env.MEMORY_SESSION_ID,
            appId: process.env.MEMORY_APP_ID,
            orgId: process.env.MEMORY_ORG_ID,
            projectId: process.env.MEMORY_PROJECT_ID,
            brainId: process.env.MEMORY_BRAIN_ID,
            sourceId: process.env.MEMORY_SOURCE_ID
          }
        ),
        null,
        2
      )
    );
    return true;
  }
  case "webhook-deliver": {
    const failDelivery = args[0] === "fail";
    console.log(JSON.stringify(process.env.MEMORY_WEBHOOK_REAL_HTTP === "true" ? await service.deliverWebhookQueueHttp() : service.deliverWebhookQueue(() => ({ ok: !failDelivery, error: failDelivery ? "cli simulated failure" : undefined })), null, 2));
    return true;
  }
    default:
      return false;
  }
}
