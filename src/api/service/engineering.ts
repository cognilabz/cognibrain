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

export function linkStateChange(input: MemoryInput, existing: Memory[]): MemoryInput {
  const subject = input.entities?.[0];
  if (!subject) return input;
  const prior = existing.find((memory) => !memory.archivedAt && memory.entities.includes(subject) && memory.content !== input.content);
  if (!prior) return input;
  const lower = input.content.toLowerCase();
  const relationType = /\b(no longer|instead|now|currently|nicht mehr|jetzt)\b/.test(lower) ? "supersedes" : undefined;
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
    extractor: provider,
    queryExpander: provider,
    translator: provider
  };
}

export function inferCorrectionKind(content: string): EngineeringMemoryKind {
  const lower = content.toLowerCase();
  if (/\b(do not|don't|dont|never|must not|should not)\b.*\b(generated|\.generated\.|dist\/|build\/|vendor\/)\b/.test(lower)) return "generated_file_rule";
  if (/\b(use npm|don't use pnpm|dont use pnpm|never use pnpm|always use|repo policy|repository policy)\b/.test(lower)) return "repo_policy";
  if (/\b(validation|architecture|belongs in|lives in|layer|directory|folder|adr)\b/.test(lower)) return "architecture_decision";
  if (/\b(test|vitest|jest|pytest|go test|e2e)\b/.test(lower)) return "test_strategy";
  if (/\b(dependency|package|library|import)\b/.test(lower)) return "dependency_rule";
  if (/\b(migrat|deprecated|moved|renamed|now uses|formerly)\b/.test(lower)) return "migration_note";
  if (/\b(do not|don't|dont|never|must not|should not)\b/.test(lower)) return "forbidden_action";
  return "review_correction";
}

export function inferCorrectActionFromCorrection(content: string): string | undefined {
  const patterns = [
    /\buse\s+([^.;]+?)\s+instead\b/i,
    /\binstead[, ]+\s*([^.;]+)/i,
    /\bshould\s+(?:use|run|call)\s+([^.;]+)/i,
    /\brun\s+([^.;]+?)\s+(?:before|after|for|when|instead)\b/i
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern)?.[1]?.trim();
    if (match) return normalizeActionPhrase(match);
  }
  const command = content.match(/\b(?:npm|pnpm|yarn|pytest|go test|make)\b[^.;]*/i)?.[0]?.trim();
  return command ? normalizeActionPhrase(command) : undefined;
}

export function inferForbiddenActionFromCorrection(content: string, previousWrongAction?: string): string | undefined {
  if (previousWrongAction && previousWrongAction.length < 120) return normalizeActionPhrase(previousWrongAction);
  const match = content.match(/\b(?:do not|don't|dont|never|must not|should not)\s+([^.;]+)/i)?.[1]?.trim();
  if (!match) return undefined;
  return normalizeActionPhrase(match.replace(/\b(?:in this repo|for this repo|here)\b/gi, "").trim());
}

export function repoPolicyFromCorrection(content: string, correctAction?: string): string | undefined {
  const lower = content.toLowerCase();
  if (!/\b(repo|repository|always|never|do not|don't|dont|must|should|use|instead|policy|pnpm|npm|pytest|go test|generated)\b/.test(lower)) return undefined;
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 180) return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return correctAction ? `use ${correctAction} for matching changes.` : `${trimmed.slice(0, 177)}...`;
}

export function normalizeActionPhrase(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
}

export function codingActionOverlap(action: string, content: string): boolean {
  const actionTokens = new Set(action.toLowerCase().split(/\W+/).filter((token) => token.length > 2));
  const contentTokens = new Set(content.toLowerCase().split(/\W+/).filter((token) => token.length > 2));
  return [...actionTokens].some((token) => contentTokens.has(token));
}

export function withProceduralMetadata(input: MemoryInput): MemoryInput {
  const content = input.content.toLowerCase();
  const tags = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));
  const looksProcedural =
    input.type === "procedural" ||
    input.layer === "procedural" ||
    tags.has("procedure") ||
    tags.has("workflow") ||
    /\b(always|before|after|when|if|run|verify|deploy|release|test|checklist|procedure|workflow|must|should)\b/.test(content);
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
  const lower = content.toLowerCase();
  if (/\brelease|deploy|ship\b/.test(lower) || tags.includes("release")) triggers.add("before release or deploy work");
  if (/\btest|verify|ci|build\b/.test(lower) || tags.includes("test")) triggers.add("before validation or CI-sensitive changes");
  if (/\bpr|pull request|merge\b/.test(lower)) triggers.add("before pull-request or merge workflows");
  if (/\bwhen\s+([^,.]+)/i.test(content)) triggers.add(content.match(/\bwhen\s+([^,.]+)/i)?.[1]?.trim() ?? "conditional workflow");
  if (/\bif\s+([^,.]+)/i.test(content)) triggers.add(content.match(/\bif\s+([^,.]+)/i)?.[1]?.trim() ?? "conditional workflow");
  if (!triggers.size) triggers.add("matching workflow intent");
  return [...triggers];
}
