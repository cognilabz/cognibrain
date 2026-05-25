#!/usr/bin/env node
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createPersistenceFromEnv } from "../api/persistence";
import { MemoryService } from "../api/service";
import { buildLeaderboardArtifact } from "../eval/leaderboard";
import { runNextgenBenchmarkSuites } from "../eval/nextgenBenchmarks";
import type { CodebaseScope, EngineeringMemoryKind, FeedbackKind } from "../core";

const userId = process.env.MEMORY_USER_ID ?? process.env.USER ?? "local";
const dbPath = resolve(process.env.MEMORY_DB_PATH ?? ".memory-harness.json");
const service = new MemoryService({
  persistence: createPersistenceFromEnv(dbPath),
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
  case "action": {
    const commandText = args.join(" ");
    if (!commandText) fail("Usage: memctl action <command-or-action-summary>");
    console.log(JSON.stringify(service.recordHarnessAction({
      userId,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      command: commandText,
      cwd: process.env.MEMORY_CWD,
      filesChanged: csvList(process.env.MEMORY_FILES_CHANGED),
      filesTouched: csvList(process.env.MEMORY_FILES_TOUCHED),
      envRequirements: csvList(process.env.MEMORY_ENV_REQUIREMENTS),
      environmentHints: csvList(process.env.MEMORY_ENVIRONMENT_HINTS),
      exitCode: process.env.MEMORY_EXIT_CODE ? Number(process.env.MEMORY_EXIT_CODE) : undefined,
      durationMs: process.env.MEMORY_DURATION_MS ? Number(process.env.MEMORY_DURATION_MS) : undefined,
      outputSummary: process.env.MEMORY_OUTPUT_SUMMARY,
      failureReason: process.env.MEMORY_FAILURE_REASON,
      successReason: process.env.MEMORY_SUCCESS_REASON,
      tests: process.env.MEMORY_TESTS_JSON ? JSON.parse(process.env.MEMORY_TESTS_JSON) : undefined,
      pullRequest: process.env.MEMORY_PULL_REQUEST,
      errorFixed: process.env.MEMORY_ERROR_FIXED
    }), null, 2));
    break;
  }
  case "coding-context": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl coding-context <query>");
    console.log(JSON.stringify(service.codingContextPack({
      userId,
      query,
      limit: process.env.MEMORY_LIMIT ? Number(process.env.MEMORY_LIMIT) : 12,
      tokenBudget: process.env.MEMORY_TOKEN_BUDGET ? Number(process.env.MEMORY_TOKEN_BUDGET) : undefined,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      codebaseScope: codebaseScopeFromEnv()
    }), null, 2));
    break;
  }
  case "code-correction": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl code-correction <correction>");
    console.log(JSON.stringify(service.recordCodeCorrection({
      userId,
      content,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      previousMemoryId: process.env.MEMORY_PREVIOUS_MEMORY_ID,
      previousWrongAction: process.env.MEMORY_PREVIOUS_WRONG_ACTION,
      correctAction: process.env.MEMORY_CORRECT_ACTION,
      kind: engineeringKindFromEnv(),
      codebase: codebaseScopeFromEnv(),
      evidenceIds: csvList(process.env.MEMORY_EVIDENCE_IDS)
    }), null, 2));
    break;
  }
  case "action-guard": {
    const action = args.join(" ");
    if (!action) fail("Usage: memctl action-guard <action>");
    console.log(JSON.stringify(service.guardAction({
      userId,
      action,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      codebaseScope: codebaseScopeFromEnv()
    }), null, 2));
    break;
  }
  case "patch-evidence": {
    const task = args.join(" ");
    if (!task) fail("Usage: memctl patch-evidence <task>");
    console.log(JSON.stringify(service.patchEvidenceTrail({
      userId,
      task,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      codebaseScope: codebaseScopeFromEnv(),
      filesChanged: csvList(process.env.MEMORY_FILES_CHANGED),
      commandsRun: csvList(process.env.MEMORY_COMMANDS_RUN),
      memoryIds: csvList(process.env.MEMORY_MEMORY_IDS)
    }), null, 2));
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
      queryExpansions: process.env.MEMORY_QUERY_EXPANSIONS ? process.env.MEMORY_QUERY_EXPANSIONS.split("|").map((item) => item.trim()).filter(Boolean) : undefined,
      filters: searchFiltersFromEnv()
    });
    console.log(
      results
        .map((result, index) => `${index + 1}. ${result.score.toFixed(2)} ${result.memory.content}\n   ${result.citation}`)
        .join("\n")
    );
    break;
  }
  case "inspect": {
    const id = args[0];
    if (!id) fail("Usage: memctl inspect <memory-id>");
    console.log(JSON.stringify(service.get(id), null, 2));
    break;
  }
  case "route": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl route <query>");
    console.log(JSON.stringify(service.routeMemory({
      userId,
      query,
      profileId: process.env.MEMORY_PROFILE_ID,
      includeLinkedIdentities: process.env.MEMORY_INCLUDE_LINKED === "true",
      includeSharedBrains: process.env.MEMORY_INCLUDE_SHARED_BRAINS === "true",
      brainId: process.env.MEMORY_BRAIN_ID,
      brainIds: process.env.MEMORY_BRAIN_IDS ? process.env.MEMORY_BRAIN_IDS.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      mode: retrievalModeFromEnv()
    }), null, 2));
    break;
  }
  case "intent": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl intent <query>");
    console.log(JSON.stringify(service.classifyQueryIntent(query), null, 2));
    break;
  }
  case "evidence":
  case "evidence-pack":
  case "why-used": {
    const query = args.join(" ");
    if (!query) fail(`Usage: memctl ${command} <query|context-pack-id>`);
    if (command === "evidence" && args.length === 1 && args[0].startsWith("ctx_")) {
      console.log(JSON.stringify(service.getEvidencePack(args[0]), null, 2));
      break;
    }
    console.log(JSON.stringify(service.evidencePack({
      userId,
      query,
      limit: process.env.MEMORY_LIMIT ? Number(process.env.MEMORY_LIMIT) : 5,
      tokenBudget: process.env.MEMORY_TOKEN_BUDGET ? Number(process.env.MEMORY_TOKEN_BUDGET) : undefined,
      profileId: process.env.MEMORY_PROFILE_ID,
      includeLinkedIdentities: process.env.MEMORY_INCLUDE_LINKED === "true",
      includeSharedBrains: process.env.MEMORY_INCLUDE_SHARED_BRAINS === "true",
      brainIds: process.env.MEMORY_BRAIN_IDS ? process.env.MEMORY_BRAIN_IDS.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      orgId: process.env.MEMORY_ORG_ID,
      mode: retrievalModeFromEnv(),
      expandQuery: process.env.MEMORY_EXPAND_QUERY === "true",
      filters: searchFiltersFromEnv()
    }), null, 2));
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
  case "verify": {
    console.log(JSON.stringify(service.verificationQueue(userId), null, 2));
    break;
  }
  case "confirm": {
    const memoryId = args[0];
    if (!memoryId) fail("Usage: memctl confirm <memory-id>");
    console.log(JSON.stringify(service.confirmMemory(memoryId, userId), null, 2));
    break;
  }
  case "retract": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl retract <memory-id> [reason]");
    console.log(JSON.stringify(service.retractMemory(memoryId, userId, reason.join(" ") || undefined), null, 2));
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
  case "feedback-injection": {
    const [query, outcome, memoryIdsCsv, signalsJson, acceptedCsv, rejectedCsv] = args;
    if (!query || !outcome || !memoryIdsCsv) fail("Usage: memctl feedback-injection <query> <helpful|wrong|accepted|rejected> <memory-id,...> [signals-json] [accepted-id,...] [rejected-id,...]");
    if (!["helpful", "wrong", "accepted", "rejected"].includes(outcome)) fail(`Unsupported outcome: ${outcome}`);
    const injectedMemoryIds = csvList(memoryIdsCsv);
    const acceptedMemoryIds = csvList(acceptedCsv ?? process.env.MEMORY_ACCEPTED_IDS);
    const rejectedMemoryIds = csvList(rejectedCsv ?? process.env.MEMORY_REJECTED_IDS);
    console.log(
      JSON.stringify(
        service.recordInjectionFeedback({
          userId,
          query,
          outcome: outcome as "helpful" | "wrong" | "accepted" | "rejected",
          injectedMemoryIds,
          acceptedMemoryIds: acceptedMemoryIds.length ? acceptedMemoryIds : undefined,
          rejectedMemoryIds: rejectedMemoryIds.length ? rejectedMemoryIds : undefined,
          signals: signalsJson ? JSON.parse(signalsJson) : undefined,
          sessionId: process.env.MEMORY_SESSION_ID,
          profileId: process.env.MEMORY_PROFILE_ID
        }),
        null,
        2
      )
    );
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
  case "entity-enrich": {
    const entity = args.join(" ");
    if (!entity) fail("Usage: memctl entity-enrich <entity>");
    console.log(JSON.stringify(service.runEntityEnrichment({ userId, entity, approveExternal: process.env.MEMORY_APPROVE_EXTERNAL === "true", sourceUri: process.env.MEMORY_SOURCE_URI }), null, 2));
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
    console.log(JSON.stringify(service.graphPaths(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 5), validAt: process.env.MEMORY_VALID_AT }), null, 2));
    break;
  }
  case "explain": {
    const [from, to] = args;
    if (!from || !to) fail("Usage: memctl explain <from-entity-or-node> <to-entity-or-node>");
    const strategy = graphExplainStrategyFromEnv();
    console.log(JSON.stringify(service.graphExplain(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 5), validAt: process.env.MEMORY_VALID_AT, strategy }), null, 2));
    break;
  }
  case "graph-activate": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-activate <query>");
    console.log(JSON.stringify(service.graphActivation(query, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 10), validAt: process.env.MEMORY_VALID_AT }), null, 2));
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
  case "graph-changes": {
    console.log(JSON.stringify(service.temporalQuery(userId, { after: process.env.MEMORY_AFTER ?? args[0], before: process.env.MEMORY_BEFORE }), null, 2));
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
  case "episodes": {
    console.log(JSON.stringify(service.listEpisodes(userId), null, 2));
    break;
  }
  case "episode": {
    const id = args[0];
    if (!id) fail("Usage: memctl episode <episode-id>");
    console.log(JSON.stringify(service.getEpisode(id), null, 2));
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
    const [memoryId, orgId, ...note] = args;
    if (!memoryId || !orgId) fail("Usage: memctl share-approve <memory-id> <org-id>");
    const reviewerId = process.env.MEMORY_REVIEWER_ID ?? process.env.MEMORY_AGENT_ID ?? userId;
    console.log(JSON.stringify(service.reviewSharedMemory(memoryId, { orgId, reviewerId, decision: "approve", note: note.join(" ") || undefined }), null, 2));
    break;
  }
  case "promote":
  case "review": {
    const [memoryId, orgId = process.env.MEMORY_ORG_ID ?? "org", ...note] = args;
    if (!memoryId || !orgId) fail(`Usage: memctl ${command} <memory-id> <org-id>`);
    const reviewerId = process.env.MEMORY_REVIEWER_ID ?? process.env.MEMORY_AGENT_ID ?? userId;
    console.log(JSON.stringify(service.reviewSharedMemory(memoryId, { orgId, reviewerId, decision: "approve", note: note.join(" ") || undefined }), null, 2));
    break;
  }
  case "share-revoke": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl share-revoke <memory-id> [reason]");
    console.log(JSON.stringify(service.revokeSharedMemory(memoryId, process.env.MEMORY_AGENT_ID ?? userId, reason.join(" ") || undefined), null, 2));
    break;
  }
  case "revoke": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl revoke <memory-id> [reason]");
    console.log(JSON.stringify(service.revokeSharedMemory(memoryId, process.env.MEMORY_AGENT_ID ?? userId, reason.join(" ") || undefined), null, 2));
    break;
  }
  case "audit": {
    console.log(JSON.stringify(service.auditTrail({ memoryId: args[0], userId: process.env.MEMORY_AUDIT_USER_ID }), null, 2));
    break;
  }
  case "audit-chain": {
    console.log(JSON.stringify(service.auditChain({ memoryId: args[0], userId: process.env.MEMORY_AUDIT_USER_ID }), null, 2));
    break;
  }
  case "compliance": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
    break;
  }
  case "compliance-export": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
    break;
  }
  case "policy-rules": {
    console.log(JSON.stringify(service.listPolicyRules(), null, 2));
    break;
  }
  case "policy-rule": {
    const [label, effect, operations, scopeJson] = args;
    if (!label || (effect !== "allow" && effect !== "deny") || !operations) fail("Usage: memctl policy-rule <label> <allow|deny> <operation[,operation]> [scope-json]");
    console.log(JSON.stringify(service.setPolicyRule({
      label,
      effect,
      operations: operations.split(",").map((item) => item.trim()).filter(Boolean) as Array<"write" | "retrieve" | "dream" | "export" | "delete" | "all">,
      scope: scopeJson ? JSON.parse(scopeJson) : undefined,
      priority: process.env.MEMORY_POLICY_PRIORITY ? Number(process.env.MEMORY_POLICY_PRIORITY) : undefined,
      reason: process.env.MEMORY_POLICY_REASON
    }), null, 2));
    break;
  }
  case "policy-evaluate": {
    const [operation, memoryId] = args;
    if (!operation || !memoryId) fail("Usage: memctl policy-evaluate <write|retrieve|dream|export|delete> <memory-id>");
    console.log(JSON.stringify(service.evaluatePolicy(operation as "write" | "retrieve" | "dream" | "export" | "delete", service.get(memoryId), { userId }), null, 2));
    break;
  }
  case "retention-rule": {
    const [label, days, action, scopeJson] = args;
    if (!label || !days || !action) fail("Usage: memctl retention-rule <label> <retention-days> <archive|delete> [scope-json]");
    if (action !== "archive" && action !== "delete") fail(`Unsupported retention action: ${action}`);
    console.log(JSON.stringify(service.setRetentionRule({ label, retentionDays: Number(days), action, scope: scopeJson ? JSON.parse(scopeJson) : undefined }), null, 2));
    break;
  }
  case "retention-rules": {
    console.log(JSON.stringify(service.listRetentionRules(), null, 2));
    break;
  }
  case "retention-enforce": {
    console.log(JSON.stringify(service.enforceRetention(args[0] ? new Date(args[0]) : new Date(), process.env.MEMORY_RETENTION_USER_ID ?? userId), null, 2));
    break;
  }
  case "retention-review": {
    console.log(JSON.stringify(service.retentionReview(args[0] ? new Date(args[0]) : new Date(), process.env.MEMORY_RETENTION_USER_ID ?? userId), null, 2));
    break;
  }
  case "key-report": {
    console.log(JSON.stringify(service.securityKeyReport(), null, 2));
    break;
  }
  case "key-provider": {
    console.log(JSON.stringify(service.keyProviderReport(), null, 2));
    break;
  }
  case "key-rotate": {
    const [keyId, keyVersion, backupRef] = args;
    if (!keyId || !keyVersion) fail("Usage: memctl key-rotate <key-id> <key-version> [backup-ref]");
    console.log(JSON.stringify(service.rotateEncryptionKeyMetadata({ keyId, keyVersion, backupRef, actorId: process.env.MEMORY_AGENT_ID ?? userId }), null, 2));
    break;
  }
  case "privacy-insights": {
    console.log(JSON.stringify(service.privacyInsights({ epsilon: args[0] ? Number(args[0]) : undefined, kAnonymity: args[1] ? Number(args[1]) : undefined, includeExact: process.env.MEMORY_PRIVACY_INCLUDE_EXACT === "true" }), null, 2));
    break;
  }
  case "privacy-cross-brain": {
    const brainIds = args.length ? args : csvList(process.env.MEMORY_BRAIN_IDS);
    if (brainIds.length < 2) fail("Usage: memctl privacy-cross-brain <brain-id> <brain-id> [...]");
    console.log(JSON.stringify(service.privacyPreservingCrossBrainCompute({
      brainIds,
      salt: process.env.MEMORY_PRIVACY_COMPUTE_SALT,
      minK: process.env.MEMORY_PRIVACY_COMPUTE_MIN_K ? Number(process.env.MEMORY_PRIVACY_COMPUTE_MIN_K) : undefined,
      dimensions: privacyComputeDimensionsFromEnv()
    }), null, 2));
    break;
  }
  case "storage": {
    console.log(JSON.stringify(service.storageStatus(), null, 2));
    break;
  }
  case "marketplace": {
    console.log(JSON.stringify(service.listMarketplaceModules(), null, 2));
    break;
  }
  case "marketplace-plan": {
    const id = args[0];
    if (!id) fail("Usage: memctl marketplace-plan <module-id>");
    console.log(JSON.stringify(service.marketplaceInstallPlan(id), null, 2));
    break;
  }
  case "marketplace-install": {
    const idOrJson = args[0];
    if (!idOrJson) fail("Usage: memctl marketplace-install <module-id|module-json>");
    const module = idOrJson.trim().startsWith("{") ? service.installMarketplaceModule(JSON.parse(idOrJson)) : service.installMarketplaceModuleById(idOrJson);
    console.log(JSON.stringify(module, null, 2));
    break;
  }

  case "marketplace-submit": {
    const [submitter, moduleJson, sourceUrl] = args;
    if (!submitter || !moduleJson) fail("Usage: memctl marketplace-submit <submitter> '<module-json>' [source-url]");
    console.log(JSON.stringify(service.submitMarketplaceModule({ submitter, module: JSON.parse(moduleJson), sourceUrl }), null, 2));
    break;
  }

  case "marketplace-submissions": {
    console.log(JSON.stringify(service.listMarketplaceSubmissions(args[0] as Parameters<typeof service.listMarketplaceSubmissions>[0]), null, 2));
    break;
  }

  case "marketplace-scan": {
    const submissionId = args[0];
    if (!submissionId) fail("Usage: memctl marketplace-scan <submission-id>");
    console.log(JSON.stringify(service.scanMarketplaceSubmission(submissionId), null, 2));
    break;
  }

  case "marketplace-review": {
    const [submissionId, reviewer, rating, ...commentParts] = args;
    if (!submissionId || !reviewer || !rating) fail("Usage: memctl marketplace-review <submission-id> <reviewer> <rating> [comment]");
    console.log(JSON.stringify(service.reviewMarketplaceSubmission(submissionId, { reviewer, rating: Number(rating), comment: commentParts.join(" ") || undefined, approve: process.env.MEMORY_MARKETPLACE_APPROVE !== "false" }), null, 2));
    break;
  }

  case "marketplace-publish": {
    const submissionId = args[0];
    if (!submissionId) fail("Usage: memctl marketplace-publish <submission-id>");
    console.log(JSON.stringify(service.publishMarketplaceSubmission(submissionId), null, 2));
    break;
  }

  case "marketplace-rate": {
    const [moduleId, reviewer, rating, ...commentParts] = args;
    if (!moduleId || !reviewer || !rating) fail("Usage: memctl marketplace-rate <module-id> <reviewer> <rating> [comment]");
    console.log(JSON.stringify(service.rateMarketplaceModule(moduleId, { reviewer, rating: Number(rating), comment: commentParts.join(" ") || undefined }), null, 2));
    break;
  }
  case "api-spec": {
    console.log(JSON.stringify(service.apiDescription(), null, 2));
    break;
  }
  case "migration-export": {
    const target = args[0] === "self_hosted" || args[0] === "managed" || args[0] === "backup" ? args[0] : undefined;
    console.log(JSON.stringify(service.managedMigrationBundle({ target, backupRef: process.env.MEMORY_BACKUP_REF, ssoProvider: process.env.MEMORY_SSO_PROVIDER, secretManager: process.env.MEMORY_SECRET_MANAGER }), null, 2));
    break;
  }
  case "managed-tenant-create": {
    const [name, orgId] = args;
    if (!name || !orgId) fail("Usage: memctl managed-tenant-create <name> <org-id>");
    console.log(JSON.stringify(service.createManagedTenant({
      name,
      orgId,
      plan: managedPlanFromEnv(),
      region: process.env.MEMORY_REGION,
      status: managedTenantStatusFromEnv(),
      ssoProvider: process.env.MEMORY_SSO_PROVIDER,
      secretManager: process.env.MEMORY_SECRET_MANAGER,
      dataResidency: process.env.MEMORY_DATA_RESIDENCY,
      backup: {
        enabled: process.env.MEMORY_BACKUP_ENABLED !== "false" && Boolean(process.env.MEMORY_BACKUP_REF),
        backupRef: process.env.MEMORY_BACKUP_REF
      }
    }), null, 2));
    break;
  }
  case "managed-tenants": {
    console.log(JSON.stringify(service.listManagedTenants(), null, 2));
    break;
  }
  case "managed-control-plane": {
    console.log(JSON.stringify(service.managedControlPlaneReport(), null, 2));
    break;
  }
  case "migration-import": {
    const path = args[0];
    if (!path) fail("Usage: memctl migration-import <bundle-json-path>");
    console.log(JSON.stringify(service.importMigrationBundle(JSON.parse(readFileSync(path, "utf8"))), null, 2));
    break;
  }
  case "backup-verify": {
    const path = args[0];
    const bundle = path ? JSON.parse(readFileSync(path, "utf8")) : undefined;
    console.log(JSON.stringify(service.verifyBackupRecovery(bundle), null, 2));
    break;
  }
  case "transport-security": {
    console.log(JSON.stringify(service.transportSecurityReport(), null, 2));
    break;
  }
  case "benchmark-nextgen": {
    console.log(JSON.stringify(runNextgenBenchmarkSuites(args[0] ?? "artifacts/nextgen-benchmarks.json", process.env.MEMORY_BENCHMARK_TREND_PATH ?? "artifacts/benchmark-trend.json"), null, 2));
    break;
  }
  case "leaderboard": {
    console.log(JSON.stringify(buildLeaderboardArtifact({ outputPath: args[0] ?? "artifacts/leaderboard.json", nextgenPath: process.env.MEMORY_NEXTGEN_BENCHMARK_PATH, evaluationPath: process.env.MEMORY_EVALUATION_REPORT_PATH }), null, 2));
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
  case "connector-health": {
    console.log(JSON.stringify(service.connectorHealth(args[0]), null, 2));
    break;
  }

  case "connector-auth": {
    console.log(JSON.stringify(service.connectorAuthStatus(args[0]), null, 2));
    break;
  }

  case "connector-auth-begin": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-auth-begin <connector-id>");
    console.log(JSON.stringify(service.beginConnectorOAuth(connectorId, {
      redirectUri: process.env.MEMORY_OAUTH_REDIRECT_URI,
      scopes: process.env.MEMORY_OAUTH_SCOPES?.split(",").map((item) => item.trim()).filter(Boolean),
      stateSalt: process.env.MEMORY_OAUTH_STATE_SALT
    }), null, 2));
    break;
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
    break;
  }
  case "connector-auth-revoke": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-auth-revoke <connector-id>");
    console.log(JSON.stringify(service.revokeConnectorAuth(connectorId, process.env.MEMORY_ACTOR_ID ?? "cli"), null, 2));
    break;
  }
  case "connector-list": {
    const connectorId = args[0];
    if (!connectorId) fail("Usage: memctl connector-list <connector-id>");
    console.log(JSON.stringify(await service.listConnectorItems(connectorId), null, 2));
    break;
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
    break;
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
    break;
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
    break;
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
    console.log(JSON.stringify(process.env.MEMORY_WEBHOOK_REAL_HTTP === "true" ? await service.deliverWebhookQueueHttp() : service.deliverWebhookQueue(() => ({ ok: !failDelivery, error: failDelivery ? "cli simulated failure" : undefined })), null, 2));
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
  case "dream-policy": {
    console.log(JSON.stringify(service.adaptiveDreamPolicy(userId), null, 2));
    break;
  }
  case "observations": {
    console.log(JSON.stringify(service.generateObservations(userId, { style: observationStyleFromEnv(), persist: process.env.MEMORY_PERSIST_OBSERVATIONS === "true", limit: process.env.MEMORY_OBSERVATION_LIMIT ? Number(process.env.MEMORY_OBSERVATION_LIMIT) : undefined }), null, 2));
    break;
  }
  case "predictions": {
    console.log(JSON.stringify(service.predictionReport(userId, { query: args.join(" ") || undefined, limit: process.env.MEMORY_PREDICTION_LIMIT ? Number(process.env.MEMORY_PREDICTION_LIMIT) : undefined }), null, 2));
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
    fail("Usage: memctl <add|extract|action|coding-context|code-correction|action-guard|patch-evidence|search|inspect|route|intent|evidence|evidence-pack|why-used|reflect|dream|health|maintenance|verify|confirm|retract|feedback|feedback-injection|metrics|profiles|profile-set|profile-learn|profile-sample|identity-link|timeline|timeline-summarize|temporal|patterns|graph|entities|entity-enrich|entity-merge|entity-split|graph-path|explain|graph-activate|graph-export|graph-query|graph-changes|infer|agent-register|agents|agent-persona|persona-set|personas|brain-create|brains|source-create|events|episodes|episode|federated-search|share-request|share-approve|promote|review|share-revoke|revoke|audit|audit-chain|compliance|compliance-export|policy-rules|policy-rule|policy-evaluate|retention-rule|retention-rules|retention-review|retention-enforce|key-report|key-rotate|privacy-insights|privacy-cross-brain|storage|marketplace|marketplace-plan|marketplace-install|marketplace-submit|marketplace-submissions|marketplace-scan|marketplace-review|marketplace-publish|marketplace-rate|api-spec|migration-export|managed-tenant-create|managed-tenants|managed-control-plane|benchmark-nextgen|leaderboard|provider-status|translate|connectors|connector-register|connector-sync|connector-sync-records|connector-health|connector-auth|connector-auth-begin|connector-auth-callback|connector-list|connector-poll|connector-writeback|connector-feedback|connector-telemetry|media-ingest|webhook-deliver|consent|revert|offline-add|offline-update|sync|sync-status|lifecycle-preview|dream-policy|observations|predictions|export|delete-user> ...");
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

function graphExplainStrategyFromEnv() {
  const value = process.env.MEMORY_GRAPH_STRATEGY;
  return value === "shortest" || value === "strongest" || value === "most_recent" || value === "highest_trust" ? value : undefined;
}

function permissionsFromEnv() {
  const values = (process.env.MEMORY_AGENT_PERMISSIONS ?? "read,write").split(",").map((item) => item.trim()).filter(Boolean);
  return values.filter((value): value is "read" | "write" | "share" | "admin" => value === "read" || value === "write" || value === "share" || value === "admin");
}

function summaryStyleFromEnv() {
  const value = process.env.MEMORY_PERSONA_SUMMARY_STYLE;
  return value === "descriptive" || value === "narrative" ? value : "concise";
}

function observationStyleFromEnv() {
  const value = process.env.MEMORY_OBSERVATION_STYLE;
  return value === "descriptive" || value === "narrative" ? value : "concise";
}

function csvList(value?: string) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function codebaseScopeFromEnv(): CodebaseScope | undefined {
  if (process.env.MEMORY_CODEBASE_JSON) return JSON.parse(process.env.MEMORY_CODEBASE_JSON) as CodebaseScope;
  const scope: CodebaseScope = {
    repo: process.env.MEMORY_REPO,
    branch: process.env.MEMORY_BRANCH,
    commit: process.env.MEMORY_COMMIT,
    workspace: process.env.MEMORY_WORKSPACE,
    directory: process.env.MEMORY_DIRECTORY,
    filePattern: process.env.MEMORY_FILE_PATTERN,
    language: process.env.MEMORY_LANGUAGE,
    framework: process.env.MEMORY_FRAMEWORK,
    harness: process.env.MEMORY_HARNESS,
    currentPath: process.env.MEMORY_CURRENT_PATH
  };
  return Object.values(scope).some(Boolean) ? scope : undefined;
}

function engineeringKindFromEnv(): EngineeringMemoryKind | undefined {
  const value = process.env.MEMORY_ENGINEERING_KIND;
  return value === "repo_policy" || value === "architecture_decision" || value === "review_correction" || value === "tool_outcome" || value === "procedure" || value === "forbidden_action" || value === "migration_note" || value === "test_strategy" || value === "dependency_rule" || value === "generated_file_rule" ? value : undefined;
}

function searchFiltersFromEnv() {
  const engineeringKind = engineeringKindFromEnv();
  return engineeringKind ? { engineeringKind } : undefined;
}

function privacyDefaultFromEnv() {
  const value = process.env.MEMORY_PERSONA_PRIVACY;
  return value === "private" || value === "org" || value === "public" ? value : value === "user" ? value : undefined;
}

function connectorKindFromEnv() {
  const value = process.env.MEMORY_CONNECTOR_KIND;
  return value === "email" || value === "chat" || value === "project_management" || value === "docs" || value === "code" || value === "calendar" || value === "cloud_storage" || value === "custom" ? value : undefined;
}

function connectorOperationFromEnv() {
  const value = process.env.MEMORY_CONNECTOR_OPERATION;
  return value === "tag" || value === "comment" || value === "status" || value === "summary" || value === "memory_link" ? value : undefined;
}

function isConnectorFeedbackKind(value: string): value is "accepted_change" | "rejected_suggestion" | "failing_test" | "user_correction" {
  return value === "accepted_change" || value === "rejected_suggestion" || value === "failing_test" || value === "user_correction";
}

function isConnectorTelemetryKind(value: string): value is "accepted_suggestion" | "rejected_suggestion" | "context_pack_feedback" | "tool_outcome" {
  return value === "accepted_suggestion" || value === "rejected_suggestion" || value === "context_pack_feedback" || value === "tool_outcome";
}

function mediaTypeFromEnv() {
  const value = process.env.MEMORY_MEDIA_TYPE;
  return value === "text" || value === "code" || value === "document" || value === "audio" || value === "image" || value === "video" ? value : undefined;
}

function managedPlanFromEnv() {
  const value = process.env.MEMORY_MANAGED_PLAN;
  return value === "developer" || value === "team" || value === "enterprise" ? value : undefined;
}

function managedTenantStatusFromEnv() {
  const value = process.env.MEMORY_MANAGED_TENANT_STATUS;
  return value === "provisioning" || value === "active" || value === "paused" ? value : undefined;
}

function privacyComputeDimensionsFromEnv() {
  const values = csvList(process.env.MEMORY_PRIVACY_COMPUTE_DIMENSIONS);
  const dimensions = values.filter((value): value is "entities" | "tags" | "relations" => value === "entities" || value === "tags" || value === "relations");
  return dimensions.length ? dimensions : undefined;
}

function metadataFromEnv() {
  return process.env.MEMORY_METADATA_JSON ? JSON.parse(process.env.MEMORY_METADATA_JSON) : undefined;
}
