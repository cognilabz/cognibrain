import { createHmac } from "node:crypto";
import { createJsonCommandIntelligenceFromEnv } from "../../core/providers";
import type { RedactionPolicy } from "../../core/privacy";
import { DOMAIN_MODULES, citationFor, normalizeRetrievalWeights, type MemoryStore } from "../../core";
import type { ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryServiceOptions } from "../service";
import type {
  AdaptiveDreamPolicyReport,
  AuditEvent,
  AuditJournalEvent,
  AuditReplayMemoryState,
  BehavioralPatternReport,
  ConnectorManifest,
  ConnectorSyncRecord,
  ConsentPolicy,
  ConsentVisibility,
  ContextReference,
  DreamBudget,
  DreamCycleMode,
  DreamCycleTrigger,
  EngineeringMemoryKind,
  ExternalContextEvidence,
  FeedbackEvent,
  MarketplaceModule,
  MarketplaceReview,
  Memory,
  MemoryExtractionEvent,
  MemoryInput,
  MemoryPolicyRule,
  MemoryScope,
  ObservationReport,
  PersonaProfile,
  ProceduralMemoryMetadata,
  QueryIntentReport,
  QueryPlan,
  QueryPlanStrategy,
  RetentionRule,
  RetrievalProfile,
  RetrievalTrainingSample,
  RetrievalWeights,
  TimelineReport,
  TransportSecurityReport
} from "../../core";

const COGNIBRAIN_VERSION = "0.1.0";

export function deterministicTranslate(text: string, sourceLanguage?: string, targetLanguage = "en"): string {
  if (targetLanguage !== "en" || !sourceLanguage || /^en/i.test(sourceLanguage)) return text;
  const dictionary: Record<string, string> = {
    speicher: "memory",
    erinnerung: "memory",
    fehler: "bug",
    veröffentlichung: "release",
    freigabe: "release",
    benutzer: "user",
    werkzeug: "tool",
    soll: "should",
    nicht: "not"
  };
  return text
    .split(/(\W+)/)
    .map((part) => dictionary[part.toLowerCase()] ?? part)
    .join("");
}

export function baseSignalTemplate(): RetrievalWeights {
  return normalizeRetrievalWeights();
}

export function profileLoss(weights: RetrievalWeights, samples: RetrievalTrainingSample[]): number | undefined {
  if (!samples.length) return undefined;
  let total = 0;
  for (const sample of samples) {
    const score = dot(weights, sample.signals ?? {});
    const target = sample.outcome === "helpful" || sample.outcome === "accepted" ? 1 : 0;
    total += (target - score) ** 2;
  }
  return total / samples.length;
}

export function dot(weights: RetrievalWeights, signals: Partial<RetrievalWeights>): number {
  return (Object.keys(weights) as Array<keyof RetrievalWeights>).reduce((sum, key) => sum + weights[key] * (signals[key] ?? 0), 0);
}

export function memoryMatchesProfileScope(memory: Memory, scope: RetrievalProfile["scope"] | undefined): boolean {
  if (!scope) return true;
  return (
    (!scope.userId || memory.userId === scope.userId) &&
    (!scope.projectId || memory.projectId === scope.projectId) &&
    (!scope.appId || memory.appId === scope.appId) &&
    (!scope.orgId || memory.orgId === scope.orgId) &&
    (!scope.agentId || memory.agentId === scope.agentId)
  );
}

export function sampleMatchesProfileScope(sample: RetrievalTrainingSample, scope: RetrievalProfile["scope"] | undefined): boolean {
  if (!scope) return true;
  return !scope.userId || sample.userId === scope.userId;
}

export function buildQueryPlan(query: string): QueryPlan {
  const text = query.toLowerCase();
  const rules: Array<{
    queryType: string;
    pattern: RegExp;
    intent: QueryIntentReport["intent"];
    strategies: QueryPlanStrategy[];
    confidence: number;
    recommendedMode?: QueryIntentReport["recommendedMode"];
    recommendedWeights?: Partial<RetrievalWeights>;
    reason: string;
  }> = [
    { queryType: "command_selection", pattern: /\b(what command should i run|which command|test command|run tests|run before|npm|pnpm|yarn|pytest|go test|cargo test|command)\b/, intent: "preference_procedural", strategies: ["repo_policy", "procedure", "tool_outcome", "keyword", "evidence"], confidence: 0.86, recommendedWeights: { trust: 0.3, keyword: 0.22, temporal: 0.18, entity: 0.16 }, reason: "coding command-selection language detected" },
    { queryType: "change_location", pattern: /\b(where should|where does|which file|which folder|which directory|what file|add validation|place this|belongs in|change go)\b/, intent: "project_context", strategies: ["architecture", "repo_policy", "scope", "keyword", "evidence"], confidence: 0.84, recommendedWeights: { entity: 0.28, trust: 0.24, keyword: 0.2, graph: 0.14 }, reason: "coding change-location language detected" },
    { queryType: "reviewer_correction", pattern: /\b(review corrected|reviewer|requested changes|what did .* correct|correction|feedback|wrong last time|korrigiert)\b/, intent: "preference_procedural", strategies: ["correction", "repo_policy", "procedure", "temporal", "evidence"], confidence: 0.86, recommendedWeights: { trust: 0.3, temporal: 0.22, keyword: 0.18, graph: 0.16 }, reason: "review correction language detected" },
    { queryType: "dangerous_file", pattern: /\b(dangerous file|do not edit|generated file|forbidden file|safe to edit|should i edit|lockfile|dist\/|build\/)\b/, intent: "preference_procedural", strategies: ["guard", "policy", "repo_policy", "keyword", "evidence"], confidence: 0.88, recommendedWeights: { trust: 0.34, keyword: 0.22, entity: 0.16, temporal: 0.12 }, reason: "forbidden-file or action-guard language detected" },
    { queryType: "architecture_decision", pattern: /\b(architecture|architecture decision|adr|module boundary|directory convention|validation architecture|dependency rule|existing pattern)\b/, intent: "project_context", strategies: ["architecture", "graph_path", "entity", "evidence"], confidence: 0.84, recommendedMode: "path", recommendedWeights: { graph: 0.32, entity: 0.24, trust: 0.22, keyword: 0.12 }, reason: "architecture decision language detected" },
    { queryType: "failed_last_time", pattern: /\b(failed last time|what failed|last failure|previous command failed|ci failed|test failed|exit code|failure reason)\b/, intent: "temporal_question", strategies: ["tool_outcome", "timeline", "temporal", "keyword", "evidence"], confidence: 0.86, recommendedWeights: { temporal: 0.3, trust: 0.24, keyword: 0.2, entity: 0.12 }, reason: "previous tool-outcome language detected" },
    { queryType: "repo_change", pattern: /\b(what changed in this repo|repo changed|repository changed|migrated|test migration|dependency migration|architecture migration|deprecated|new convention|branch rule|package changed|ci config changed)\b/, intent: "temporal_question", strategies: ["timeline", "engineering_memory", "repo_policy", "temporal", "evidence"], confidence: 0.84, recommendedWeights: { temporal: 0.32, trust: 0.22, keyword: 0.18, graph: 0.14 }, reason: "repo-state change language detected" },
    { queryType: "temporal_recent", pattern: /\b(today|yesterday|last week|recent|latest|now)\b/, intent: "temporal_question", strategies: ["temporal", "keyword"], confidence: 0.8, recommendedWeights: { temporal: 0.3, trust: 0.22, keyword: 0.18 }, reason: "recent-time language detected" },
    { queryType: "temporal_range", pattern: /\b(before|after|since|between|from .* to|valid until|gültig|seit|vor|nach)\b/, intent: "temporal_question", strategies: ["temporal", "timeline"], confidence: 0.8, recommendedWeights: { temporal: 0.34, trust: 0.2, semantic: 0.16 }, reason: "time-window language detected" },
    { queryType: "change_summary", pattern: /\b(what changed|changed|history|timeline|changelog|difference|diff|was hat sich geändert)\b/, intent: "temporal_question", strategies: ["timeline", "temporal", "entity"], confidence: 0.78, reason: "change-summary language detected" },
    { queryType: "connection_explanation", pattern: /\b(connected|related|relationship|path|how.*connect|between|zusammenhang|verbunden)\b/, intent: "connection_explanation", strategies: ["graph_path", "activation", "entity"], confidence: 0.84, recommendedMode: "path", recommendedWeights: { graph: 0.42, entity: 0.22, trust: 0.18 }, reason: "connection language detected" },
    { queryType: "graph_multi_hop", pattern: /\b(multi[- ]?hop|linked through|über .* verbunden|transitive)\b/, intent: "multi_hop_question", strategies: ["graph_path", "activation"], confidence: 0.82, recommendedMode: "path", recommendedWeights: { graph: 0.4, entity: 0.22, semantic: 0.16 }, reason: "multi-hop graph language detected" },
    { queryType: "dependency_path", pattern: /\b(depends on|dependency|imports|calls|blocked by|requires|abhängig)\b/, intent: "multi_hop_question", strategies: ["graph_path", "entity", "keyword"], confidence: 0.82, recommendedMode: "path", recommendedWeights: { graph: 0.38, entity: 0.24, keyword: 0.18 }, reason: "dependency language detected" },
    { queryType: "procedure_recall", pattern: /\b(how do i|procedure|workflow|runbook|steps|before i|wie mache ich|ablauf)\b/, intent: "preference_procedural", strategies: ["procedure", "keyword", "semantic"], confidence: 0.78, recommendedWeights: { trust: 0.26, keyword: 0.22, entity: 0.18, semantic: 0.18 }, reason: "procedural language detected" },
    { queryType: "checklist_release", pattern: /\b(checklist|before release|deploy|ship|release gate|run tests|verify before)\b/, intent: "preference_procedural", strategies: ["procedure", "pattern", "policy"], confidence: 0.78, recommendedWeights: { trust: 0.28, keyword: 0.22, temporal: 0.16 }, reason: "release/checklist language detected" },
    { queryType: "contradiction_check", pattern: /\b(contradict|conflict|disagree|widerspruch|conflicting)\b/, intent: "contradiction_check", strategies: ["contradiction", "temporal", "entity"], confidence: 0.84, recommendedWeights: { trust: 0.3, temporal: 0.22, entity: 0.18 }, reason: "contradiction language detected" },
    { queryType: "stale_or_outdated", pattern: /\b(outdated|stale|superseded|old|no longer|nicht mehr|veraltet)\b/, intent: "contradiction_check", strategies: ["contradiction", "temporal", "timeline"], confidence: 0.82, recommendedWeights: { temporal: 0.3, trust: 0.22, entity: 0.16 }, reason: "staleness language detected" },
    { queryType: "person_entity", pattern: /\b(who|person|owner|author|maintainer|contact|wer|person)\b/, intent: "personal_context", strategies: ["entity", "keyword", "semantic"], confidence: 0.74, reason: "person/entity language detected" },
    { queryType: "project_state", pattern: /\b(repo|repository|project|workspace|codebase|branch|milestone|projekt)\b/, intent: "project_context", strategies: ["project", "keyword", "temporal"], confidence: 0.74, reason: "project context language detected" },
    { queryType: "team_memory", pattern: /\b(team|org|shared|everyone|company|kollektiv|firma)\b/, intent: "team_context", strategies: ["team", "policy", "keyword"], confidence: 0.74, reason: "team context language detected" },
    { queryType: "personal_preference", pattern: /\b(my|me|i prefer|preference|always use|never use|ich bevorzuge|immer|nie)\b/, intent: "personal_context", strategies: ["personal", "pattern", "trust"], confidence: 0.76, reason: "personal preference language detected" },
    { queryType: "source_provenance", pattern: /\b(source|citation|evidence|where did|provenance|beweis|quelle)\b/, intent: "fact_lookup", strategies: ["source", "keyword", "entity"], confidence: 0.76, reason: "source/provenance language detected" },
    { queryType: "policy_permission", pattern: /\b(allowed|permission|policy|consent|private|public|dürfen|erlaubt)\b/, intent: "team_context", strategies: ["policy", "team", "source"], confidence: 0.78, reason: "policy/permission language detected" },
    { queryType: "pattern_behavior", pattern: /\b(pattern|habit|usually|recurring|often|typical|gewöhnlich)\b/, intent: "preference_procedural", strategies: ["pattern", "temporal", "semantic"], confidence: 0.76, reason: "behavioral pattern language detected" },
    { queryType: "incident_root_cause", pattern: /\b(root cause|why did|incident|failure|regression|broken|warum.*kaputt)\b/, intent: "multi_hop_question", strategies: ["graph_path", "timeline", "source"], confidence: 0.8, recommendedMode: "path", reason: "incident/root-cause language detected" },
    { queryType: "action_history", pattern: /\b(what did i do|actions|commits|changed by me|last action|was habe ich gemacht)\b/, intent: "temporal_question", strategies: ["timeline", "source", "personal"], confidence: 0.78, reason: "action-history language detected" },
    { queryType: "direct_fact", pattern: /\b(what is|which|tell me|show me|fact|value|status|was ist|welche)\b/, intent: "fact_lookup", strategies: ["semantic", "keyword"], confidence: 0.68, reason: "direct fact language detected" }
  ];
  const matches = rules.filter((rule) => rule.pattern.test(text));
  const selected = matches[0] ?? rules.at(-1)!;
  const secondaryTypes = matches.slice(1).map((rule) => rule.queryType);
  const strategies = [...new Set((matches.length ? matches : [selected]).flatMap((rule) => rule.strategies))];
  if (!strategies.includes("semantic")) strategies.push("semantic");
  const recommendedMode = selected.recommendedMode ?? (strategies.includes("graph_path") ? "path" : "hybrid");
  return {
    query,
    queryType: selected.queryType,
    secondaryTypes,
    intent: selected.intent,
    recommendedMode,
    strategies,
    recommendedWeights: selected.recommendedWeights,
    explanation: matches.length ? matches.map((rule) => rule.reason) : ["default direct fact lookup"],
    confidence: selected.confidence
  };
}

export function deterministicQueryExpansions(query: string): string[] {
  const lower = query.toLowerCase();
  const groups = [
    ["cli", "command line", "terminal", "shell"],
    ["ui", "dashboard", "frontend", "operator console"],
    ["bug", "issue", "defect", "regression"],
    ["memory", "recall", "context", "knowledge"],
    ["auth", "login", "session", "identity"],
    ["database", "storage", "persistence", "store"],
    ["sync", "replay", "offline", "replication"],
    ["release", "launch", "deployment", "ship"]
  ];
  const expansions = new Set<string>();
  for (const group of groups) {
    if (!group.some((term) => lower.includes(term))) continue;
    for (const term of group) expansions.add(query.replace(new RegExp(group.find((item) => lower.includes(item)) ?? group[0], "i"), term));
    expansions.add(`${query} ${group.join(" ")}`);
  }
  return [...expansions];
}
