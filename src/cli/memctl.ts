#!/usr/bin/env node
import { resolve } from "node:path";
import { MemoryService } from "../api/service";
import type { FeedbackKind } from "../core";

const userId = process.env.MEMORY_USER_ID ?? process.env.USER ?? "local";
const dbPath = resolve(process.env.MEMORY_DB_PATH ?? ".memory-harness.json");
const service = new MemoryService({
  persistencePath: dbPath,
  autoDream: {
    enabled: process.env.MEMORY_AUTO_DREAM !== "false",
    intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
    writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
  },
  configPath: process.env.MEMORY_CONFIG_PATH
});

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "add": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl add <content>");
    const memory = service.add({ userId, content, source: { kind: "human", confidence: 0.95 } });
    console.log(JSON.stringify(memory, null, 2));
    break;
  }
  case "extract": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl extract <conversation-or-event-text>");
    const mediaType = process.env.MEMORY_MEDIA_TYPE;
    const report = service.extract([{
      role: "user",
      content,
      mediaType: mediaType === "code" || mediaType === "document" || mediaType === "audio" || mediaType === "image" || mediaType === "video" ? mediaType : "text",
      language: process.env.MEMORY_LANGUAGE,
      uri: process.env.MEMORY_SOURCE_URI,
      mimeType: process.env.MEMORY_MIME_TYPE
    }], {
      userId,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      brainId: process.env.MEMORY_BRAIN_ID,
      sourceId: process.env.MEMORY_SOURCE_ID,
      deviceId: process.env.MEMORY_DEVICE_ID
    });
    console.log(JSON.stringify(report, null, 2));
    break;
  }
  case "search": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl search <query>");
    const results = service.search({
      userId,
      query,
      limit: 5,
      profileId: process.env.MEMORY_PROFILE_ID,
      includeLinkedIdentities: process.env.MEMORY_INCLUDE_LINKED === "true",
      includeSharedBrains: process.env.MEMORY_INCLUDE_SHARED_BRAINS === "true",
      brainIds: process.env.MEMORY_BRAIN_IDS ? process.env.MEMORY_BRAIN_IDS.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      orgId: process.env.MEMORY_ORG_ID,
      mode: retrievalModeFromEnv(),
      expandQuery: process.env.MEMORY_EXPAND_QUERY === "true",
      queryExpansions: process.env.MEMORY_QUERY_EXPANSIONS ? process.env.MEMORY_QUERY_EXPANSIONS.split("|").map((item) => item.trim()).filter(Boolean) : undefined
    });
    console.log(
      results
        .map((result, index) => `${index + 1}. ${result.score.toFixed(2)} ${result.memory.content}\n   ${result.citation}`)
        .join("\n")
    );
    break;
  }
  case "reflect":
  case "dream": {
    const report = command === "dream" ? service.dream(userId) : service.reflect(userId);
    console.log(
      [
        `created=${report.created.length}`,
        `demoted=${report.demoted.length}`,
        `contradictions=${report.contradictions.length}`,
        `faded=${report.lifecycle.faded}`,
        `archived=${report.lifecycle.archived}`,
        `reorganized=${report.lifecycle.reorganized}`,
        `quality=${report.lifecycle.qualityScore.toFixed(2)}`
      ].join(" ")
    );
    break;
  }
  case "health": {
    console.log(JSON.stringify(service.health(userId), null, 2));
    break;
  }
  case "maintenance": {
    console.log(JSON.stringify(service.maintenanceStatus(), null, 2));
    break;
  }
  case "feedback": {
    const [memoryId, kind, ...note] = args;
    if (!memoryId || !kind) fail("Usage: memctl feedback <memory-id> <helpful|wrong|stale|always_include|never_include|private|shareable|approve_pattern|reject_pattern> [note]");
    if (!isFeedbackKind(kind)) {
      fail(`Unsupported feedback kind: ${kind}`);
    }
    console.log(JSON.stringify(service.feedback({ memoryId, kind, userId, note: note.join(" ") || undefined }), null, 2));
    break;
  }
  case "metrics": {
    console.log(JSON.stringify(service.metricsReport(), null, 2));
    break;
  }
  case "profiles": {
    console.log(JSON.stringify(service.getRetrievalProfiles(), null, 2));
    break;
  }
  case "profile-set": {
    const [id, json] = args;
    if (!id || !json) fail("Usage: memctl profile-set <id> '<weights-json>'");
    console.log(JSON.stringify(service.setRetrievalProfile({ id, label: id, weights: JSON.parse(json), provenance: "cli" }), null, 2));
    break;
  }
  case "profile-learn": {
    console.log(
      JSON.stringify(
        service.learnRetrievalProfile(args[0] ?? "learned", args[1] ?? "Learned feedback profile", {
          scope: {
            userId: process.env.MEMORY_PROFILE_USER_ID,
            projectId: process.env.MEMORY_PROJECT_ID,
            appId: process.env.MEMORY_APP_ID,
            orgId: process.env.MEMORY_ORG_ID,
            agentId: process.env.MEMORY_AGENT_ID
          }
        }),
        null,
        2
      )
    );
    break;
  }
  case "profile-sample": {
    const [query, outcome, signalsJson] = args;
    if (!query || !outcome) fail("Usage: memctl profile-sample <query> <helpful|wrong|accepted|rejected> [signals-json]");
    if (!["helpful", "wrong", "accepted", "rejected"].includes(outcome)) fail(`Unsupported outcome: ${outcome}`);
    console.log(
      JSON.stringify(
        service.addTrainingSample({
          userId,
          query,
          outcome: outcome as "helpful" | "wrong" | "accepted" | "rejected",
          signals: signalsJson ? JSON.parse(signalsJson) : undefined
        }),
        null,
        2
      )
    );
    break;
  }
  case "identity-link": {
    const [primaryUserId, linkedUserId, consentToken] = args;
    if (!primaryUserId || !linkedUserId || !consentToken) fail("Usage: memctl identity-link <primary-user-id> <linked-user-id> <consent-token>");
    console.log(JSON.stringify(service.linkIdentity(primaryUserId, linkedUserId, consentToken), null, 2));
    break;
  }
  case "timeline": {
    console.log(JSON.stringify(service.timeline(userId), null, 2));
    break;
  }
  case "timeline-summarize": {
    const granularity = args[0];
    if (granularity && !["hour", "day", "week", "month", "all"].includes(granularity)) fail("Usage: memctl timeline-summarize [hour|day|week|month|all]");
    console.log(JSON.stringify(service.summarizeTimeline(userId, { granularity: granularity as "hour" | "day" | "week" | "month" | "all" | undefined, persist: process.env.MEMORY_PERSIST_SUMMARIES === "true" }), null, 2));
    break;
  }
  case "temporal": {
    console.log(JSON.stringify(service.temporalQuery(userId, { after: process.env.MEMORY_AFTER, before: process.env.MEMORY_BEFORE }), null, 2));
    break;
  }
  case "patterns": {
    console.log(JSON.stringify(service.behavioralPatterns(userId), null, 2));
    break;
  }
  case "graph": {
    console.log(JSON.stringify(service.graph(userId), null, 2));
    break;
  }
  case "entities": {
    console.log(JSON.stringify(service.entityCatalog(userId), null, 2));
    break;
  }
  case "entity-merge": {
    const [canonical, ...aliases] = args;
    if (!canonical || aliases.length === 0) fail("Usage: memctl entity-merge <canonical> <alias...>");
    console.log(JSON.stringify(service.mergeEntity(canonical, aliases, userId), null, 2));
    break;
  }
  case "entity-split": {
    const [canonical, ...aliases] = args;
    if (!canonical || aliases.length === 0) fail("Usage: memctl entity-split <canonical> <alias...>");
    console.log(JSON.stringify(service.splitEntity(canonical, aliases, userId), null, 2));
    break;
  }
  case "graph-path": {
    const [from, to] = args;
    if (!from || !to) fail("Usage: memctl graph-path <from-entity-or-node> <to-entity-or-node>");
    console.log(JSON.stringify(service.graphPaths(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 5) }), null, 2));
    break;
  }
  case "graph-activate": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-activate <query>");
    console.log(JSON.stringify(service.graphActivation(query, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 10) }), null, 2));
    break;
  }
  case "graph-export": {
    const format = args[0] === "graphml" ? "graphml" : "json";
    console.log(
      typeof service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined }) === "string"
        ? service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined })
        : JSON.stringify(service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined }), null, 2)
    );
    break;
  }
  case "graph-query": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-query <query>");
    console.log(JSON.stringify(service.graphQuery(query, userId), null, 2));
    break;
  }
  case "infer": {
    const rules = process.env.MEMORY_INFERENCE_RULES_JSON ? JSON.parse(process.env.MEMORY_INFERENCE_RULES_JSON) : undefined;
    console.log(JSON.stringify(service.runInference(rules), null, 2));
    break;
  }
  case "agent-register": {
    const [id, namespace = "default", ...brainIds] = args;
    if (!id || brainIds.length === 0) fail("Usage: memctl agent-register <agent-id> [namespace] <brain-id...>");
    console.log(
      JSON.stringify(
        service.registerAgent({
          id,
          name: process.env.MEMORY_AGENT_NAME ?? id,
          namespace,
          brainIds,
          permissions: permissionsFromEnv(),
          personaId: process.env.MEMORY_PERSONA_ID,
          subscriptions: process.env.MEMORY_AGENT_SUBSCRIPTIONS_JSON ? JSON.parse(process.env.MEMORY_AGENT_SUBSCRIPTIONS_JSON) : undefined
        }),
        null,
        2
      )
    );
    break;
  }
  case "agents": {
    console.log(JSON.stringify(service.listAgents(), null, 2));
    break;
  }
  case "agent-persona": {
    const [agentId, personaId] = args;
    if (!agentId || !personaId) fail("Usage: memctl agent-persona <agent-id> <persona-id>");
    console.log(JSON.stringify(service.assignAgentPersona(agentId, personaId), null, 2));
    break;
  }
  case "persona-set": {
    const [id, label = id] = args;
    if (!id) fail("Usage: memctl persona-set <persona-id> [label]");
    console.log(
      JSON.stringify(
        service.setPersona({
          id,
          label,
          summaryStyle: summaryStyleFromEnv(),
          retrievalWeights: process.env.MEMORY_PERSONA_WEIGHTS_JSON ? JSON.parse(process.env.MEMORY_PERSONA_WEIGHTS_JSON) : undefined,
          privacyDefault: privacyDefaultFromEnv(),
          domain: process.env.MEMORY_PERSONA_DOMAIN
        }),
        null,
        2
      )
    );
    break;
  }
  case "personas": {
    console.log(JSON.stringify(service.listPersonas(), null, 2));
    break;
  }
  case "brain-create": {
    const [name, visibility = "private"] = args;
    if (!name || !["private", "team", "org", "public"].includes(visibility)) fail("Usage: memctl brain-create <name> [private|team|org|public]");
    console.log(JSON.stringify(service.createBrain({ name, ownerUserId: userId, orgId: process.env.MEMORY_ORG_ID, visibility: visibility as "private" | "team" | "org" | "public" }), null, 2));
    break;
  }
  case "brains": {
    console.log(JSON.stringify(service.listBrains(), null, 2));
    break;
  }
  case "source-create": {
    const [brainId, name, kind = "manual"] = args;
    if (!brainId || !name || !["manual", "chat", "code", "docs", "calendar", "connector", "import"].includes(kind)) fail("Usage: memctl source-create <brain-id> <name> [manual|chat|code|docs|calendar|connector|import]");
    console.log(JSON.stringify(service.createSource({ brainId, name, kind: kind as "manual" | "chat" | "code" | "docs" | "calendar" | "connector" | "import" }), null, 2));
    break;
  }
  case "events": {
    console.log(JSON.stringify(service.eventFeed({ agentId: process.env.MEMORY_AGENT_ID, brainId: process.env.MEMORY_BRAIN_ID, sourceId: process.env.MEMORY_SOURCE_ID }), null, 2));
    break;
  }
  case "federated-search": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl federated-search <query>");
    const brainIds = process.env.MEMORY_BRAIN_IDS?.split(",").map((item) => item.trim()).filter(Boolean);
    if (!brainIds?.length) fail("Set MEMORY_BRAIN_IDS for federated-search");
    console.log(JSON.stringify(service.federatedSearch({ userId, query, brainIds, orgId: process.env.MEMORY_ORG_ID, agentId: process.env.MEMORY_AGENT_ID, includeSharedBrains: true }), null, 2));
    break;
  }
  case "share-request": {
    const [memoryId, orgId, ...note] = args;
    if (!memoryId || !orgId) fail("Usage: memctl share-request <memory-id> <org-id> [note]");
    console.log(JSON.stringify(service.requestSharedMemory(memoryId, orgId, process.env.MEMORY_AGENT_ID ?? userId, note.join(" ") || undefined), null, 2));
    break;
  }
  case "share-approve": {
    const [memoryId, orgId] = args;
    if (!memoryId || !orgId) fail("Usage: memctl share-approve <memory-id> <org-id>");
    console.log(JSON.stringify(service.promoteSharedMemory(memoryId, orgId), null, 2));
    break;
  }
  case "share-revoke": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl share-revoke <memory-id> [reason]");
    console.log(JSON.stringify(service.revokeSharedMemory(memoryId, process.env.MEMORY_AGENT_ID ?? userId, reason.join(" ") || undefined), null, 2));
    break;
  }
  case "audit": {
    console.log(JSON.stringify(service.auditTrail({ memoryId: args[0], userId: process.env.MEMORY_AUDIT_USER_ID }), null, 2));
    break;
  }
  case "compliance": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
    break;
  }
  case "storage": {
    console.log(JSON.stringify(service.storageStatus(), null, 2));
    break;
  }
  case "provider-status": {
    console.log(JSON.stringify(service.providerStatus(), null, 2));
    break;
  }
  case "translate": {
    const text = args.join(" ");
    if (!text) fail("Usage: memctl translate <text>");
    console.log(JSON.stringify(service.translateText(text, process.env.MEMORY_LANGUAGE, process.env.MEMORY_TARGET_LANGUAGE ?? "en"), null, 2));
    break;
  }
  case "connectors": {
    const kind = connectorKindFromEnv();
    console.log(JSON.stringify(service.listConnectorManifests(kind), null, 2));
    break;
  }
  case "connector-register": {
    const manifestJson = args.join(" ");
    if (!manifestJson) fail("Usage: memctl connector-register '<manifest-json>'");
    console.log(JSON.stringify(service.registerConnectorManifest(JSON.parse(manifestJson)), null, 2));
    break;
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
    break;
  }
  case "connector-sync-records": {
    console.log(JSON.stringify(service.listConnectorSyncRecords(args[0]), null, 2));
    break;
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
    break;
  }
  case "webhook-deliver": {
    const failDelivery = args[0] === "fail";
    console.log(JSON.stringify(service.deliverWebhookQueue(() => ({ ok: !failDelivery, error: failDelivery ? "cli simulated failure" : undefined })), null, 2));
    break;
  }
  case "consent": {
    const [memoryId, visibility] = args;
    if (!memoryId || !["private", "user", "org", "public"].includes(visibility)) fail("Usage: memctl consent <memory-id> <private|user|org|public>");
    console.log(JSON.stringify(service.updateConsent(memoryId, { visibility: visibility as "private" | "user" | "org" | "public" }), null, 2));
    break;
  }
  case "revert": {
    const [memoryId, auditEventId] = args;
    if (!memoryId) fail("Usage: memctl revert <memory-id> [audit-event-id]");
    console.log(JSON.stringify(service.revertMemory(memoryId, auditEventId), null, 2));
    break;
  }
  case "offline-add": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl offline-add <content>");
    console.log(
      JSON.stringify(
        service.queueOfflineOperation({
          type: "add",
          userId,
          clientMutationId: process.env.MEMORY_CLIENT_MUTATION_ID,
          input: {
            userId,
            content,
            brainId: process.env.MEMORY_BRAIN_ID,
            sourceId: process.env.MEMORY_SOURCE_ID,
            orgId: process.env.MEMORY_ORG_ID,
            source: { kind: "human", confidence: 0.9 }
          }
        }),
        null,
        2
      )
    );
    break;
  }
  case "offline-update": {
    const [memoryId, ...contentParts] = args;
    if (!memoryId || contentParts.length === 0) fail("Usage: memctl offline-update <memory-id> <content>");
    console.log(JSON.stringify(service.queueOfflineOperation({ type: "update", userId, memoryId, patch: { content: contentParts.join(" ") } }), null, 2));
    break;
  }
  case "sync": {
    console.log(JSON.stringify(service.syncOfflineOperations(), null, 2));
    break;
  }
  case "sync-status": {
    console.log(JSON.stringify(service.syncStatus(), null, 2));
    break;
  }
  case "lifecycle-preview": {
    console.log(JSON.stringify(service.lifecyclePreview(userId), null, 2));
    break;
  }
  case "export": {
    console.log(JSON.stringify(service.exportUser(userId), null, 2));
    break;
  }
  case "delete-user": {
    console.log(JSON.stringify({ deleted: service.deleteUser(userId) }, null, 2));
    break;
  }
  default:
    fail("Usage: memctl <add|extract|search|reflect|dream|health|maintenance|feedback|metrics|profiles|profile-set|profile-learn|profile-sample|identity-link|timeline|timeline-summarize|temporal|patterns|graph|entities|entity-merge|entity-split|graph-path|graph-activate|graph-export|graph-query|infer|agent-register|agents|agent-persona|persona-set|personas|brain-create|brains|source-create|events|federated-search|share-request|share-approve|share-revoke|audit|compliance|storage|provider-status|translate|connectors|connector-register|connector-sync|connector-sync-records|media-ingest|webhook-deliver|consent|revert|offline-add|offline-update|sync|sync-status|lifecycle-preview|export|delete-user> ...");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isFeedbackKind(value: string): value is FeedbackKind {
  return ["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable", "approve_pattern", "reject_pattern"].includes(value);
}

function relationTypesFromEnv() {
  return process.env.MEMORY_RELATION_TYPES ? process.env.MEMORY_RELATION_TYPES.split(",").map((item) => item.trim()).filter(Boolean) as any : undefined;
}

function retrievalModeFromEnv() {
  const value = process.env.MEMORY_RETRIEVAL_MODE;
  return value === "rrf" || value === "graph" || value === "path" || value === "hybrid" ? value : undefined;
}

function permissionsFromEnv() {
  const values = (process.env.MEMORY_AGENT_PERMISSIONS ?? "read,write").split(",").map((item) => item.trim()).filter(Boolean);
  return values.filter((value): value is "read" | "write" | "share" | "admin" => value === "read" || value === "write" || value === "share" || value === "admin");
}

function summaryStyleFromEnv() {
  const value = process.env.MEMORY_PERSONA_SUMMARY_STYLE;
  return value === "descriptive" || value === "narrative" ? value : "concise";
}

function privacyDefaultFromEnv() {
  const value = process.env.MEMORY_PERSONA_PRIVACY;
  return value === "private" || value === "org" || value === "public" ? value : value === "user" ? value : undefined;
}

function connectorKindFromEnv() {
  const value = process.env.MEMORY_CONNECTOR_KIND;
  return value === "email" || value === "chat" || value === "project_management" || value === "docs" || value === "code" || value === "calendar" || value === "cloud_storage" || value === "custom" ? value : undefined;
}

function mediaTypeFromEnv() {
  const value = process.env.MEMORY_MEDIA_TYPE;
  return value === "text" || value === "code" || value === "document" || value === "audio" || value === "image" || value === "video" ? value : undefined;
}

function metadataFromEnv() {
  return process.env.MEMORY_METADATA_JSON ? JSON.parse(process.env.MEMORY_METADATA_JSON) : undefined;
}
