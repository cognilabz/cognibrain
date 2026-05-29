import { createHmac } from "node:crypto";
import { createJsonCommandIntelligenceFromEnv } from "../../core/providers";
import type { RedactionPolicy } from "../../core/privacy";
import { DOMAIN_MODULES, citationFor, conceptScore, normalizeRetrievalWeights, type MemoryStore } from "../../core";
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

export function linkStateChange(input: MemoryInput, existing: Memory[]): MemoryInput {
  const subject = input.entities?.[0];
  if (!subject) return input;
  const prior = existing.find((memory) => !memory.archivedAt && memory.entities.includes(subject) && memory.content !== input.content);
  if (!prior) return input;
  const relationType = input.metadata?.supersedes === true || input.relations?.some((relation) => relation.type === "supersedes") ? "supersedes" : undefined;
  if (!relationType) return input;
  return {
    ...input,
    relations: [...(input.relations ?? []), { type: relationType, targetId: prior.id, targetEntity: subject, confidence: 0.62 }],
    temporal: { ...(input.temporal ?? {}), validFrom: input.timestamp ?? new Date().toISOString() }
  };
}

export function providerFromEnv(): NonNullable<MemoryServiceOptions["intelligence"]> {
  const provider = createJsonCommandIntelligenceFromEnv();
  if (!provider) return {};
  return {
    reranker: provider,
    verifier: provider,
    contradictionDetector: provider,
    summarizer: provider,
    evaluator: provider,
    engineeringClassifier: provider,
    extractor: provider,
    queryExpander: provider,
    translator: provider
  };
}

export function inferCorrectionKind(content: string): EngineeringMemoryKind {
  void content;
  return "review_correction";
}

export function inferCorrectActionFromCorrection(content: string): string | undefined {
  void content;
  return undefined;
}

export function inferForbiddenActionFromCorrection(content: string, previousWrongAction?: string): string | undefined {
  void content;
  if (previousWrongAction && previousWrongAction.length < 120) return normalizeActionPhrase(previousWrongAction);
  return undefined;
}

export function repoPolicyFromCorrection(content: string, correctAction?: string): string | undefined {
  void content;
  return correctAction ? `Use ${correctAction} for matching changes.` : undefined;
}

export function normalizeActionPhrase(value: string): string {
  const collapsed = collapseWhitespace(value).trim();
  let end = collapsed.length;
  while (end > 0 && collapsed[end - 1] === ".") end -= 1;
  return collapsed.slice(0, end);
}

export function codingActionOverlap(action: string, content: string): boolean {
  const normalizedAction = normalizeActionPhrase(action.toLowerCase());
  const normalizedContent = normalizeActionPhrase(content.toLowerCase());
  return Boolean(
    normalizedAction &&
    normalizedContent &&
    conceptScore(normalizedAction, [normalizedContent]).score >= 0.82
  );
}

export function withProceduralMetadata(input: MemoryInput): MemoryInput {
  const tags = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));
  const engineeringKind = (input.metadata?.engineering as { kind?: unknown } | undefined)?.kind;
  const looksProcedural =
    input.type === "procedural" ||
    input.layer === "procedural" ||
    engineeringKind === "procedure" ||
    engineeringKind === "test_strategy" ||
    tags.has("procedure") ||
    tags.has("workflow");
  if (!looksProcedural) return input;
  const previous = input.metadata?.procedure as Partial<ProceduralMemoryMetadata> | undefined;
  const tests = Array.isArray((input.metadata?.action as { tests?: unknown } | undefined)?.tests)
    ? ((input.metadata?.action as { tests?: Array<{ status?: string }> }).tests ?? [])
    : [];
  const passed = tests.filter((test) => test.status === "passed").length;
  const failed = tests.filter((test) => test.status === "failed").length;
  const at = input.timestamp ?? new Date().toISOString();
  const triggerConditions = previous?.triggerConditions?.length
    ? previous.triggerConditions
    : inferProcedureTriggers(input.content, input.tags ?? []);
  const procedure: ProceduralMemoryMetadata = {
    triggerConditions,
    applicabilityScope: {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      brainId: input.brainId,
      sourceId: input.sourceId
    },
    confidence: previous?.confidence ?? input.confidence ?? input.source?.confidence ?? 0.72,
    lastOutcome: failed ? "failure" : passed ? "success" : previous?.lastOutcome ?? "unknown",
    successCount: (previous?.successCount ?? 0) + passed,
    failureCount: (previous?.failureCount ?? 0) + failed,
    lastSuccessAt: passed ? at : previous?.lastSuccessAt,
    lastFailureAt: failed ? at : previous?.lastFailureAt,
    feedback: previous?.feedback?.length ? previous.feedback : [{ kind: "observed", at }]
  };
  return {
    ...input,
    type: input.type ?? "procedural",
    layer: input.layer ?? "procedural",
    tags: Array.from(new Set([...(input.tags ?? []), "procedure"])),
    metadata: { ...(input.metadata ?? {}), procedure }
  };
}

export function inferProcedureTriggers(content: string, tags: string[]): string[] {
  const triggers = new Set<string>();
  const signal = `${content} ${tags.join(" ")}`;
  if (conceptScore(signal, ["release", "deploy production rollback migration"]).score >= 0.4) triggers.add("before release or deploy work");
  if (conceptScore(signal, ["test", "validation ci build verify"]).score >= 0.4) triggers.add("before validation or CI-sensitive changes");
  if (conceptScore(signal, ["pull request", "pr merge code review"]).score >= 0.4) triggers.add("before pull-request or merge workflows");
  if (!triggers.size) triggers.add("matching workflow intent");
  return [...triggers];
}

function collapseWhitespace(value: string): string {
  let output = "";
  let previousWasWhitespace = false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    const whitespace = code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32;
    if (whitespace) {
      if (!previousWasWhitespace) output += " ";
      previousWasWhitespace = true;
      continue;
    }
    output += char;
    previousWasWhitespace = false;
  }
  return output;
}
