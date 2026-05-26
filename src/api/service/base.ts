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

export function redactionModeFromEnv(value: string | undefined): RedactionPolicy["mode"] {
  if (value === "off" || value === "reject" || value === "archive" || value === "encrypt") return value;
  return "redact";
}

export function deploymentModeFromEnv(publicUrl?: string): TransportSecurityReport["mode"] {
  const raw = process.env.MEMORY_DEPLOYMENT_MODE;
  if (raw === "managed" || raw === "self_hosted" || raw === "production" || raw === "local") return raw;
  if (!publicUrl) return "local";
  try {
    const host = new URL(publicUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" ? "local" : "production";
  } catch {
    return "production";
  }
}

export function feedbackDelta(kind: FeedbackEvent["kind"]): { trust: number; importance: number } {
  switch (kind) {
    case "helpful":
      return { trust: 0.04, importance: 0.06 };
    case "always_include":
      return { trust: 0.06, importance: 0.12 };
    case "wrong":
      return { trust: -0.18, importance: -0.08 };
    case "stale":
      return { trust: -0.1, importance: -0.04 };
    case "never_include":
      return { trust: -0.25, importance: -0.18 };
    default:
      return { trust: 0, importance: 0 };
  }
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function rollingAverage(current: number, sample: number, count: number): number {
  return current + (sample - current) / Math.max(1, count);
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function modeForTrigger(trigger?: DreamCycleTrigger): DreamCycleMode {
  return trigger === "manual_reflect" ? "reflect" : "dream";
}

export function triggerForMode(mode: DreamCycleMode): DreamCycleTrigger {
  return mode === "reflect" ? "manual_reflect" : "manual_dream";
}

export function budgetForTrigger(trigger: DreamCycleTrigger): DreamBudget {
  if (trigger === "before_release") return "release";
  if (trigger === "harness_handoff" || trigger === "after_connector_sync") return "deep";
  if (trigger === "auto_write_threshold" || trigger === "auto_interval") return "standard";
  return "quick";
}

export function contentHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `c_${(hash >>> 0).toString(36)}`;
}

export function syntheticExtractionEvent(input: MemoryInput): MemoryExtractionEvent {
  return {
    role: input.source?.kind === "tool" ? "tool" : input.source?.kind === "agent" ? "assistant" : "user",
    content: input.content,
    timestamp: input.timestamp,
    source: input.source,
    uri: input.source?.uri,
    metadata: input.metadata
  };
}

export function auditEventForHash(event: AuditEvent): Record<string, unknown> {
  const { hash: _hash, payloadHash: _payloadHash, ...rest } = event;
  return rest;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function canonicalAuditJournalType(event: AuditEvent): AuditJournalEvent["journalType"] {
  if (event.type === "memory.write" && event.memoryId) return "memory.created";
  if (event.type === "memory.update" || event.type === "memory.consent" || event.type === "memory.revert") {
    if (event.metadata?.action === "archive") return "memory.archived";
    if (event.metadata?.action === "retract") return "memory.retracted";
    const after = event.metadata?.after as Memory | undefined;
    if (after?.beliefState === "superseded") return "memory.superseded";
    return "memory.updated";
  }
  if (event.type === "memory.delete") return "memory.deleted";
  if (event.type === "search.run") return event.metadata?.resource === "evidence-pack" ? "context_pack.created" : "memory.retrieved";
  if (event.type === "policy.violation") return "policy.denied";
  if (event.type === "reflect.run" || event.type === "retention.enforce") return "dream.action";
  if (event.type === "connector.sync") return "connector.ingested";
  return "system.event";
}

export function applyMemoryJournalEvent(current: AuditReplayMemoryState, event: AuditJournalEvent): AuditReplayMemoryState {
  const next: AuditReplayMemoryState = {
    ...current,
    userId: current.userId ?? event.userId,
    brainId: current.brainId ?? event.brainId,
    sourceId: current.sourceId ?? event.sourceId,
    lastEventId: event.id,
    lastHash: event.hash,
    versions: current.versions + (event.journalType === "memory.retrieved" ? 0 : 1)
  };
  if (event.journalType === "memory.created" || event.journalType === "memory.updated") return { ...next, exists: true };
  if (event.journalType === "memory.archived") return { ...next, exists: true, archived: true };
  if (event.journalType === "memory.retracted") return { ...next, exists: true, retracted: true };
  if (event.journalType === "memory.superseded") return { ...next, exists: true, superseded: true };
  if (event.journalType === "memory.deleted") return { ...next, exists: false };
  return next;
}

export function safeGet(store: MemoryStore, id: string): Memory | undefined {
  try {
    return store.get(id);
  } catch {
    return undefined;
  }
}
