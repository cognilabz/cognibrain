import { readFileSync } from "node:fs";
import type { MemoryService } from "../../api/service";
import { buildLeaderboardArtifact } from "../../eval/leaderboard";
import { runNextgenBenchmarkSuites } from "../../eval/nextgenBenchmarks";
import {
  codebaseScopeFromEnv,
  csvList,
  engineeringKindFromEnv,
  fail,
  graphExplainStrategyFromEnv,
  isFeedbackKind,
  managedPlanFromEnv,
  managedTenantStatusFromEnv,
  metadataFromEnv,
  observationStyleFromEnv,
  optionValue,
  permissionsFromEnv,
  privacyComputeDimensionsFromEnv,
  privacyDefaultFromEnv,
  relationTypesFromEnv,
  retrievalModeFromEnv,
  searchFiltersFromEnv,
  summaryStyleFromEnv
} from "./env";

type CommandContext = { service: MemoryService; userId: string };

export async function handleMemoryCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "add": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl add <content>");
    const memory = service.add({ userId, content, source: { kind: "human", confidence: 0.95 } });
    console.log(JSON.stringify(memory, null, 2));
    return true;
  }
  case "list": {
    const limit = optionValue(args, "--limit") ? Number(optionValue(args, "--limit")) : process.env.MEMORY_LIMIT ? Number(process.env.MEMORY_LIMIT) : 20;
    console.log(JSON.stringify(service.listMemories(userId, {
      limit,
      includeArchived: args.includes("--include-archived")
    }), null, 2));
    return true;
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
    return true;
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
    return true;
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
    return true;
  }
  case "context-enrich": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl context-enrich <query>");
    console.log(JSON.stringify(await service.enrichContext({
      userId,
      query,
      limit: process.env.MEMORY_LIMIT ? Number(process.env.MEMORY_LIMIT) : 8,
      tokenBudget: process.env.MEMORY_TOKEN_BUDGET ? Number(process.env.MEMORY_TOKEN_BUDGET) : undefined,
      primaryIssueStore: process.env.MEMORY_PRIMARY_ISSUE_CONNECTOR,
      primaryKnowledgeStore: process.env.MEMORY_PRIMARY_KNOWLEDGE_CONNECTOR,
      defaultSearchConnectors: csvList(process.env.MEMORY_DEFAULT_CONTEXT_CONNECTORS),
      fetchReferenced: process.env.MEMORY_CONTEXT_FETCH_REFERENCES !== "false",
      searchPrimaryStores: process.env.MEMORY_CONTEXT_SEARCH_PRIMARY !== "false",
      persistFetched: process.env.MEMORY_CONTEXT_PERSIST_FETCHED === "true",
      maxExternalFetches: process.env.MEMORY_CONTEXT_MAX_FETCHES ? Number(process.env.MEMORY_CONTEXT_MAX_FETCHES) : undefined,
      maxExternalResults: process.env.MEMORY_CONTEXT_MAX_RESULTS ? Number(process.env.MEMORY_CONTEXT_MAX_RESULTS) : undefined,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID,
      codebaseScope: codebaseScopeFromEnv()
    }), null, 2));
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
  }
  case "inspect": {
    const id = args[0];
    if (!id) fail("Usage: memctl inspect <memory-id>");
    console.log(JSON.stringify(service.get(id), null, 2));
    return true;
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
    return true;
  }
  case "intent": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl intent <query>");
    console.log(JSON.stringify(service.classifyQueryIntent(query), null, 2));
    return true;
  }
  case "evidence":
  case "evidence-pack":
  case "why-used": {
    const query = args.join(" ");
    if (!query) fail(`Usage: memctl ${command} <query|context-pack-id>`);
    if (command === "evidence" && args.length === 1 && args[0].startsWith("ctx_")) {
      console.log(JSON.stringify(service.getEvidencePack(args[0]), null, 2));
      return true;
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
    return true;
  }
  }
  return false;
}
