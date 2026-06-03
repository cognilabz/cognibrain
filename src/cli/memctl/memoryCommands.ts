import { readFileSync } from "node:fs";
import type { MemoryService } from "../../api/service";
import type { BeliefState, ConsentVisibility, MemoryInput, MemoryLayer, MemoryType, SourceKind } from "../../core";
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

const COMMAND_USAGE: Record<string, string> = {
  add: "Usage: memctl add <content> [--source-kind <kind>] [--source-confidence <n>] [--tags <a,b>] [--metadata-json <json>]",
  list: "Usage: memctl list [--limit <n>] [--include-archived]",
  extract: "Usage: memctl extract <conversation-or-event-text>",
  action: "Usage: memctl action <command-or-action-summary>",
  "coding-context": "Usage: memctl coding-context <query>",
  "context-enrich": "Usage: memctl context-enrich <query>",
  "code-correction": "Usage: memctl code-correction <correction>",
  "action-guard": "Usage: memctl action-guard <action>",
  "patch-evidence": "Usage: memctl patch-evidence <task>",
  search: "Usage: memctl search <query>",
  inspect: "Usage: memctl inspect <memory-id>",
  edit: "Usage: memctl edit <memory-id> <new-content>",
  archive: "Usage: memctl archive <memory-id>",
  route: "Usage: memctl route <query>",
  intent: "Usage: memctl intent <query>",
  evidence: "Usage: memctl evidence <query|context-pack-id>",
  "evidence-pack": "Usage: memctl evidence-pack <query|context-pack-id>",
  "why-used": "Usage: memctl why-used <query|context-pack-id>"
};

export async function handleMemoryCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  if (command && args.some((arg) => arg === "--help" || arg === "-h") && COMMAND_USAGE[command]) {
    console.log(COMMAND_USAGE[command]);
    return true;
  }
  switch (command) {
  case "add": {
    const input = parseAddInput(args, userId);
    if (!input.content) fail(COMMAND_USAGE.add);
    const memory = service.add(input);
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
  case "edit": {
    const [id, ...contentParts] = args;
    const content = contentParts.join(" ");
    if (!id || !content) fail("Usage: memctl edit <memory-id> <new-content>");
    console.log(JSON.stringify(service.update(id, { content, metadata: { ...metadataFromEnv(), editedBy: process.env.MEMORY_ACTOR_ID ?? "cli" } }), null, 2));
    return true;
  }
  case "archive": {
    const id = args[0];
    if (!id) fail("Usage: memctl archive <memory-id>");
    console.log(JSON.stringify(service.archive(id), null, 2));
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

function parseAddInput(args: string[], userId: string): MemoryInput {
  const content: string[] = [];
  const metadata = { ...(metadataFromEnv() ?? {}) };
  const tags = new Set<string>();
  const source: MemoryInput["source"] = { kind: "human", confidence: 0.95 };
  const input: MemoryInput = { userId, content: "", source, metadata };
  let sourceRef: NonNullable<MemoryInput["sourceRef"]> | undefined;
  let rawContent = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (rawContent) {
      content.push(arg);
      continue;
    }
    if (arg === "--") {
      rawContent = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      content.push(arg);
      continue;
    }

    const next = () => {
      const value = args[index + 1];
      if (value === undefined) fail(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    switch (arg) {
    case "--source-kind":
      source.kind = sourceKind(next(), arg);
      break;
    case "--source-confidence":
      source.confidence = boundedNumber(next(), arg);
      break;
    case "--source-uri":
      source.uri = next();
      break;
    case "--source-commit":
      source.commit = next();
      break;
    case "--line-start":
      source.lineStart = integerValue(next(), arg);
      break;
    case "--line-end":
      source.lineEnd = integerValue(next(), arg);
      break;
    case "--tags":
      for (const tag of csvList(next())) tags.add(tag);
      break;
    case "--tag":
      tags.add(next());
      break;
    case "--metadata-json":
    case "--metadata":
      Object.assign(metadata, parseJsonObject(next(), arg));
      break;
    case "--type":
      input.type = memoryType(next(), arg);
      break;
    case "--layer":
      input.layer = memoryLayer(next(), arg);
      break;
    case "--confidence":
      input.confidence = boundedNumber(next(), arg);
      break;
    case "--belief-state":
      input.beliefState = beliefState(next(), arg);
      break;
    case "--visibility":
      input.consent = { ...(input.consent ?? {}), visibility: consentVisibility(next(), arg) };
      break;
    case "--allow-training":
      input.consent = { ...(input.consent ?? {}), allowTraining: booleanValue(next(), arg) };
      break;
    case "--delete-on-request":
      input.consent = { ...(input.consent ?? {}), deleteOnRequest: booleanValue(next(), arg) };
      break;
    case "--source-ref-json":
      sourceRef = { ...(sourceRef ?? {}), ...parseJsonObject(next(), arg) } as NonNullable<MemoryInput["sourceRef"]>;
      break;
    case "--source-ref-connector-id":
      sourceRef = { ...(sourceRef ?? {}), connectorId: next() };
      break;
    case "--source-ref-external-id":
      sourceRef = { ...(sourceRef ?? {}), externalId: next() };
      break;
    case "--source-ref-url":
    case "--source-ref-uri":
      sourceRef = { ...(sourceRef ?? {}), url: next() };
      break;
    case "--source-ref-version":
      sourceRef = { ...(sourceRef ?? {}), version: next() };
      break;
    case "--source-ref-hash":
      sourceRef = { ...(sourceRef ?? {}), hash: next() };
      break;
    case "--brain-id":
      input.brainId = next();
      break;
    case "--source-id":
      input.sourceId = next();
      break;
    case "--agent-id":
      input.agentId = next();
      break;
    case "--session-id":
      input.sessionId = next();
      break;
    case "--app-id":
      input.appId = next();
      break;
    case "--org-id":
      input.orgId = next();
      break;
    case "--project-id":
      input.projectId = next();
      break;
    case "--device-id":
      input.deviceId = next();
      break;
    case "--run-id":
      input.runId = next();
      break;
    default:
      fail(`Unknown memctl add option ${arg}; use -- before literal content that starts with --`);
    }
  }

  input.content = content.join(" ").trim();
  input.tags = [...tags];
  if (!Object.keys(metadata).length) delete input.metadata;
  if (sourceRef && (sourceRef.connectorId || sourceRef.externalId || sourceRef.url)) input.sourceRef = sourceRef;
  return input;
}

function sourceKind(value: string, option: string): SourceKind {
  if (value === "human" || value === "reviewed_code" || value === "tool" || value === "agent" || value === "transcript" || value === "import") return value;
  fail(`${option} must be one of human, reviewed_code, tool, agent, transcript, import`);
}

function memoryType(value: string, option: string): MemoryType {
  if (value === "user" || value === "feedback" || value === "project" || value === "reference" || value === "episodic" || value === "procedural") return value;
  fail(`${option} must be one of user, feedback, project, reference, episodic, procedural`);
}

function memoryLayer(value: string, option: string): MemoryLayer {
  if (value === "working" || value === "episodic" || value === "long_term" || value === "procedural" || value === "reflection") return value;
  fail(`${option} must be one of working, episodic, long_term, procedural, reflection`);
}

function beliefState(value: string, option: string): BeliefState {
  if (value === "active" || value === "stale" || value === "superseded" || value === "contradicted" || value === "needs_verification" || value === "retracted" || value === "archived") return value;
  fail(`${option} must be one of active, stale, superseded, contradicted, needs_verification, retracted, archived`);
}

function consentVisibility(value: string, option: string): ConsentVisibility {
  if (value === "private" || value === "user" || value === "org" || value === "public") return value;
  fail(`${option} must be one of private, user, org, public`);
}

function boundedNumber(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) fail(`${option} must be a number from 0 to 1`);
  return parsed;
}

function integerValue(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) fail(`${option} must be a positive integer`);
  return parsed;
}

function booleanValue(value: string, option: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  fail(`${option} must be true or false`);
}

function parseJsonObject(value: string, option: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // fall through to the common error
  }
  fail(`${option} must be a JSON object`);
}
  return false;
}
