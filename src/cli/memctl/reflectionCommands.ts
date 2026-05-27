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

export async function handleReflectionCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "truth-conflicts": {
    const status = args[0];
    if (status && !["open", "resolved", "operator_review"].includes(status)) fail("Usage: memctl truth-conflicts [open|resolved|operator_review]");
    console.log(JSON.stringify(service.listConflictSets(status as "open" | "resolved" | "operator_review" | undefined), null, 2));
    return true;
  }
  case "truth-current": {
    const memoryId = args[0];
    if (!memoryId) fail("Usage: memctl truth-current <memory-id>");
    console.log(JSON.stringify(service.currentTruthForMemory(service.get(memoryId)), null, 2));
    return true;
  }
  case "truth-resolve": {
    const [conflictSetId, selectedClaimId, ...reasonParts] = args;
    if (!conflictSetId || !selectedClaimId) fail("Usage: memctl truth-resolve <conflict-set-id> <selected-claim-id> [reason]");
    console.log(JSON.stringify(service.resolveConflictSet(conflictSetId, {
      selectedClaimId,
      reason: reasonParts.join(" ") || "resolved from CLI truth workbench",
      resolvedBy: "operator"
    }), null, 2));
    return true;
  }
  case "dream-plan": {
    console.log(JSON.stringify(service.dreamPlan({
      userId,
      trigger: dreamTriggerFromArgs(args),
      mode: args.includes("--reflect") ? "reflect" : "dream",
      budget: dreamBudgetFromArgs(args),
      sourceRefresh: args.includes("--source-refresh"),
      force: args.includes("--force"),
      connectorIds: csvList(optionValue(args, "--connectors") ?? process.env.MEMORY_CONNECTOR_IDS)
    }), null, 2));
    return true;
  }
  case "dream-run": {
    console.log(JSON.stringify(await service.runDreamCycleAsync({
      userId,
      trigger: dreamTriggerFromArgs(args),
      mode: args.includes("--reflect") ? "reflect" : "dream",
      budget: dreamBudgetFromArgs(args),
      sourceRefresh: args.includes("--source-refresh"),
      force: args.includes("--force"),
      connectorIds: csvList(optionValue(args, "--connectors") ?? process.env.MEMORY_CONNECTOR_IDS)
    }), null, 2));
    return true;
  }
  case "dream-jobs": {
    console.log(JSON.stringify(service.dreamJobStatus(args[0]), null, 2));
    return true;
  }
  case "dream-start": {
    console.log(JSON.stringify(await service.startDreamJob({
      userId,
      trigger: dreamTriggerFromArgs(args),
      mode: args.includes("--reflect") ? "reflect" : "dream",
      budget: dreamBudgetFromArgs(args),
      sourceRefresh: args.includes("--source-refresh"),
      force: args.includes("--force"),
      connectorIds: csvList(optionValue(args, "--connectors") ?? process.env.MEMORY_CONNECTOR_IDS)
    }, fetch, Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000), { wait: args.includes("--wait") }), null, 2));
    return true;
  }
  case "dream-cancel": {
    const jobId = args[0];
    if (!jobId) fail("Usage: memctl dream-cancel <job-id> [reason]");
    console.log(JSON.stringify(service.cancelDreamJob(jobId, args.slice(1).join(" ") || undefined), null, 2));
    return true;
  }
  case "dream-retry": {
    const jobId = args[0];
    if (!jobId) fail("Usage: memctl dream-retry <job-id> [--wait]");
    console.log(JSON.stringify(await service.retryDreamJob(jobId, fetch, Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000), { wait: args.includes("--wait") }), null, 2));
    return true;
  }
  case "dream-verify": {
    console.log(JSON.stringify(service.resolveVerificationQueue(userId, { connectorIds: csvList(optionValue(args, "--connectors") ?? process.env.MEMORY_CONNECTOR_IDS) }), null, 2));
    return true;
  }
  case "dream-conflicts": {
    console.log(JSON.stringify(service.listConflictSets("open"), null, 2));
    return true;
  }
  case "dream-resolve": {
    const [conflictSetId, selectedClaimId, ...reasonParts] = args;
    if (!conflictSetId || !selectedClaimId) fail("Usage: memctl dream-resolve <conflict-set-id> <selected-claim-id> [reason]");
    console.log(JSON.stringify(service.resolveConflictSet(conflictSetId, { selectedClaimId, reason: reasonParts.join(" ") || "resolved from CLI dream workbench", resolvedBy: "operator" }), null, 2));
    return true;
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
    return true;
  }
  case "health": {
    console.log(JSON.stringify(service.health(userId), null, 2));
    return true;
  }
  case "maintenance": {
    console.log(JSON.stringify(service.maintenanceStatus(), null, 2));
    return true;
  }
  case "verify": {
    console.log(JSON.stringify(service.verificationQueue(userId), null, 2));
    return true;
  }
  case "confirm": {
    const memoryId = args[0];
    if (!memoryId) fail("Usage: memctl confirm <memory-id>");
    console.log(JSON.stringify(service.confirmMemory(memoryId, userId), null, 2));
    return true;
  }
  case "retract": {
    const [memoryId, ...reason] = args;
    if (!memoryId) fail("Usage: memctl retract <memory-id> [reason]");
    console.log(JSON.stringify(service.retractMemory(memoryId, userId, reason.join(" ") || undefined), null, 2));
    return true;
  }
  case "feedback": {
    const [memoryId, kind, ...note] = args;
    if (!memoryId || !kind) fail("Usage: memctl feedback <memory-id> <helpful|wrong|stale|always_include|never_include|private|shareable|approve_pattern|reject_pattern> [note]");
    if (!isFeedbackKind(kind)) {
      fail(`Unsupported feedback kind: ${kind}`);
    }
    console.log(JSON.stringify(service.feedback({ memoryId, kind, userId, note: note.join(" ") || undefined }), null, 2));
    return true;
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
    return true;
  }
  case "metrics": {
    console.log(JSON.stringify(service.metricsReport(), null, 2));
    return true;
  }
  case "profiles": {
    console.log(JSON.stringify(service.getRetrievalProfiles(), null, 2));
    return true;
  }
  case "profile-set": {
    const [id, json] = args;
    if (!id || !json) fail("Usage: memctl profile-set <id> '<weights-json>'");
    console.log(JSON.stringify(service.setRetrievalProfile({ id, label: id, weights: JSON.parse(json), provenance: "cli" }), null, 2));
    return true;
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
    return true;
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
    return true;
  }
  case "identity-link": {
    const [primaryUserId, linkedUserId, consentToken] = args;
    if (!primaryUserId || !linkedUserId || !consentToken) fail("Usage: memctl identity-link <primary-user-id> <linked-user-id> <consent-token>");
    console.log(JSON.stringify(service.linkIdentity(primaryUserId, linkedUserId, consentToken), null, 2));
    return true;
  }
  case "timeline": {
    console.log(JSON.stringify(service.timeline(userId), null, 2));
    return true;
  }
  case "timeline-summarize": {
    const granularity = args[0];
    if (granularity && !["hour", "day", "week", "month", "all"].includes(granularity)) fail("Usage: memctl timeline-summarize [hour|day|week|month|all]");
    console.log(JSON.stringify(service.summarizeTimeline(userId, { granularity: granularity as "hour" | "day" | "week" | "month" | "all" | undefined, persist: process.env.MEMORY_PERSIST_SUMMARIES === "true" }), null, 2));
    return true;
  }
  case "temporal": {
    console.log(JSON.stringify(service.temporalQuery(userId, { after: process.env.MEMORY_AFTER, before: process.env.MEMORY_BEFORE }), null, 2));
    return true;
  }
  case "patterns": {
    console.log(JSON.stringify(service.behavioralPatterns(userId), null, 2));
    return true;
  }
  case "graph": {
    console.log(JSON.stringify(service.graph(userId), null, 2));
    return true;
  }
  case "entities": {
    console.log(JSON.stringify(service.entityCatalog(userId), null, 2));
    return true;
  }
  case "entity-enrich": {
    const entity = args.join(" ");
    if (!entity) fail("Usage: memctl entity-enrich <entity>");
    console.log(JSON.stringify(service.runEntityEnrichment({ userId, entity, approveExternal: process.env.MEMORY_APPROVE_EXTERNAL === "true", sourceUri: process.env.MEMORY_SOURCE_URI }), null, 2));
    return true;
  }
  case "entity-merge": {
    const [canonical, ...aliases] = args;
    if (!canonical || aliases.length === 0) fail("Usage: memctl entity-merge <canonical> <alias...>");
    console.log(JSON.stringify(service.mergeEntity(canonical, aliases, userId), null, 2));
    return true;
  }
  case "entity-split": {
    const [canonical, ...aliases] = args;
    if (!canonical || aliases.length === 0) fail("Usage: memctl entity-split <canonical> <alias...>");
    console.log(JSON.stringify(service.splitEntity(canonical, aliases, userId), null, 2));
    return true;
  }
  case "graph-path": {
    const [from, to] = args;
    if (!from || !to) fail("Usage: memctl graph-path <from-entity-or-node> <to-entity-or-node>");
    console.log(JSON.stringify(service.graphPaths(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 5), validAt: process.env.MEMORY_VALID_AT }), null, 2));
    return true;
  }
  case "explain": {
    const [from, to] = args;
    if (!from || !to) fail("Usage: memctl explain <from-entity-or-node> <to-entity-or-node>");
    const strategy = graphExplainStrategyFromEnv();
    console.log(JSON.stringify(service.graphExplain(from, to, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 5), validAt: process.env.MEMORY_VALID_AT, strategy }), null, 2));
    return true;
  }
  case "graph-activate": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-activate <query>");
    console.log(JSON.stringify(service.graphActivation(query, { userId, maxDepth: Number(process.env.MEMORY_GRAPH_DEPTH ?? 3), relationTypes: relationTypesFromEnv(), limit: Number(process.env.MEMORY_GRAPH_LIMIT ?? 10), validAt: process.env.MEMORY_VALID_AT }), null, 2));
    return true;
  }
  case "graph-export": {
    const format = args[0] === "graphml" ? "graphml" : "json";
    console.log(
      typeof service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined }) === "string"
        ? service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined })
        : JSON.stringify(service.graphExport({ userId, format, relationTypes: relationTypesFromEnv(), minTrust: process.env.MEMORY_MIN_TRUST ? Number(process.env.MEMORY_MIN_TRUST) : undefined }), null, 2)
    );
    return true;
  }
  case "graph-query": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl graph-query <query>");
    console.log(JSON.stringify(service.graphQuery(query, userId), null, 2));
    return true;
  }
  case "graph-changes": {
    console.log(JSON.stringify(service.temporalQuery(userId, { after: process.env.MEMORY_AFTER ?? args[0], before: process.env.MEMORY_BEFORE }), null, 2));
    return true;
  }
  case "infer": {
    const rules = process.env.MEMORY_INFERENCE_RULES_JSON ? JSON.parse(process.env.MEMORY_INFERENCE_RULES_JSON) : undefined;
    console.log(JSON.stringify(service.runInference(rules), null, 2));
    return true;
  }
  }
  return false;
}

function dreamTriggerFromArgs(args: string[]) {
  const trigger = optionValue(args, "--trigger") ?? process.env.MEMORY_DREAM_TRIGGER;
  if (!trigger) return undefined;
  const allowed = ["manual_reflect", "manual_dream", "auto_write_threshold", "auto_interval", "harness_session_end", "harness_handoff", "before_release", "after_connector_sync", "after_negative_feedback", "after_contradiction_detected"];
  if (!allowed.includes(trigger)) fail(`Unsupported dream trigger: ${trigger}`);
  return trigger as "manual_reflect" | "manual_dream" | "auto_write_threshold" | "auto_interval" | "harness_session_end" | "harness_handoff" | "before_release" | "after_connector_sync" | "after_negative_feedback" | "after_contradiction_detected";
}

function dreamBudgetFromArgs(args: string[]) {
  const budget = optionValue(args, "--budget") ?? process.env.MEMORY_DREAM_BUDGET;
  if (!budget) return undefined;
  if (!["quick", "standard", "deep", "release"].includes(budget)) fail(`Unsupported dream budget: ${budget}`);
  return budget as "quick" | "standard" | "deep" | "release";
}
