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
    const results = service.search({ userId, query, limit: 5, profileId: process.env.MEMORY_PROFILE_ID, includeLinkedIdentities: process.env.MEMORY_INCLUDE_LINKED === "true" });
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
    console.log(JSON.stringify(service.learnRetrievalProfile(args[0] ?? "learned"), null, 2));
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
    console.log(JSON.stringify(service.graphPaths(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3) }), null, 2));
    break;
  }
  case "graph-query": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-query <query>");
    console.log(JSON.stringify(service.graphQuery(query, userId), null, 2));
    break;
  }
  case "infer": {
    console.log(JSON.stringify(service.runInference(), null, 2));
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
    console.log(JSON.stringify(service.eventFeed(), null, 2));
    break;
  }
  case "compliance": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
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
    fail("Usage: memctl <add|extract|search|reflect|dream|health|maintenance|feedback|metrics|profiles|profile-set|profile-learn|profile-sample|identity-link|timeline|timeline-summarize|temporal|patterns|graph|entities|entity-merge|entity-split|graph-path|graph-query|infer|brain-create|brains|source-create|events|compliance|lifecycle-preview|export|delete-user> ...");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isFeedbackKind(value: string): value is FeedbackKind {
  return ["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable", "approve_pattern", "reject_pattern"].includes(value);
}
