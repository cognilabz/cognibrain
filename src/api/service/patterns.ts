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

import { clamp01, contentHash } from "./base";

export function mineRecurringPatterns(memories: Memory[]): BehavioralPatternReport["patterns"] {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
    const weekday = eventAt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
    const anchors = [...memory.tags, ...memory.entities].filter((value) => value.length > 2).slice(0, 4);
    for (const anchor of anchors) {
      const key = `${weekday}:${anchor.toLowerCase()}`;
      const current = groups.get(key) ?? [];
      current.push(memory);
      groups.set(key, current);
    }
  }
  return [...groups.entries()]
    .filter(([, support]) => support.length >= 2)
    .map(([key, support]) => {
      const [weekday, anchor] = key.split(":");
      const lastObservedAt = new Date(Math.max(...support.map((memory) => (memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt).getTime()))).toISOString();
      return {
        key,
        label: `Recurring ${anchor} memory on ${weekday}s`,
        support: support.length,
        memoryIds: support.map((memory) => memory.id),
        confidence: Math.min(0.92, 0.45 + support.length * 0.12),
        cadence: `weekly:${weekday}`,
        pendingReview: true,
        lastObservedAt,
        falsePositiveRisk: clamp01(0.55 - support.length * 0.08)
      };
    });
}

export function mineRecurringSequences(memories: Memory[]): BehavioralPatternReport["patterns"] {
  const byDay = new Map<string, Memory[]>();
  for (const memory of memories.filter((item) => item.layer !== "reflection")) {
    const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
    const day = isoDay(eventAt);
    const current = byDay.get(day) ?? [];
    current.push(memory);
    byDay.set(day, current);
  }
  const sequenceGroups = new Map<string, Memory[]>();
  for (const dayMemories of byDay.values()) {
    const ordered = dayMemories.sort((a, b) => new Date(a.temporal.eventAt ?? a.createdAt).getTime() - new Date(b.temporal.eventAt ?? b.createdAt).getTime());
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const first = sequenceAnchor(ordered[index]);
      const second = sequenceAnchor(ordered[index + 1]);
      if (!first || !second || first === second) continue;
      const key = `${first}->${second}`;
      sequenceGroups.set(key, [...(sequenceGroups.get(key) ?? []), ordered[index], ordered[index + 1]]);
    }
  }
  return [...sequenceGroups.entries()]
    .map(([key, support]) => ({ key, support: dedupeMemories(support) }))
    .filter((item) => item.support.length >= 4)
    .map(({ key, support }) => ({
      key: `sequence:${key}`,
      label: `Recurring sequence: ${key.replace("->", " then ")}`,
      support: support.length,
      memoryIds: support.map((memory) => memory.id),
      confidence: Math.min(0.88, 0.42 + support.length * 0.08),
      cadence: "sequence",
      pendingReview: true,
      lastObservedAt: new Date(Math.max(...support.map((memory) => (memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt).getTime()))).toISOString(),
      falsePositiveRisk: clamp01(0.62 - support.length * 0.06)
    }));
}

export function sequenceAnchor(memory: Memory): string | undefined {
  return [...memory.tags, ...memory.entities].map((value) => value.toLowerCase()).find((value) => value.length > 2);
}

export function dedupeMemories(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    if (seen.has(memory.id)) return false;
    seen.add(memory.id);
    return true;
  });
}

export function observationClusters(memories: Memory[]): Array<{ label: string; memories: Memory[] }> {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const keys = [...memory.entities, ...memory.tags].filter((value) => value.length > 2).slice(0, 4);
    for (const key of keys.length ? keys : ["general"]) {
      const normalized = key.toLowerCase();
      groups.set(normalized, [...(groups.get(normalized) ?? []), memory]);
    }
  }
  return [...groups.entries()]
    .map(([label, group]) => ({ label, memories: dedupeMemories(group).sort((a, b) => b.trust * b.importance - a.trust * a.importance) }))
    .filter((cluster) => cluster.memories.length >= 2)
    .sort((a, b) => b.memories.length - a.memories.length || b.memories[0].trust - a.memories[0].trust);
}

export function policyRuleMatches(rule: MemoryPolicyRule, target: Memory | MemoryInput, actor: Partial<MemoryScope>): boolean {
  const scope = rule.scope;
  if (!scope) return true;
  const memory = "id" in target ? target : undefined;
  const metadata = (target.metadata ?? {}) as Record<string, unknown>;
  const consent = target.consent as Partial<ConsentPolicy> | undefined;
  const source = target.source;
  const value = {
    userId: target.userId ?? actor.userId,
    orgId: target.orgId ?? actor.orgId,
    brainId: target.brainId ?? actor.brainId,
    sourceId: target.sourceId ?? actor.sourceId,
    sourceKind: source?.kind,
    memoryType: target.type,
    connectorId: typeof metadata.connectorId === "string" ? metadata.connectorId : undefined,
    visibility: consent?.visibility,
    tags: target.tags ?? []
  };
  if (scope.userId && value.userId !== scope.userId) return false;
  if (scope.orgId && value.orgId !== scope.orgId) return false;
  if (scope.brainId && value.brainId !== scope.brainId) return false;
  if (scope.sourceId && value.sourceId !== scope.sourceId) return false;
  if (scope.sourceKind && value.sourceKind !== scope.sourceKind) return false;
  if (scope.memoryType && value.memoryType !== scope.memoryType) return false;
  if (scope.connectorId && value.connectorId !== scope.connectorId) return false;
  if (scope.visibility && value.visibility !== scope.visibility) return false;
  if (scope.tag && !value.tags.includes(scope.tag)) return false;
  if (memory && scope.visibility && memory.consent.visibility !== scope.visibility) return false;
  return true;
}

export function productionPolicyMode(): boolean {
  return process.env.MEMORY_POLICY_MODE === "production" || process.env.MEMORY_SECURITY_MODE === "production" || process.env.MEMORY_PRODUCTION_MODE === "true";
}

export function retentionRuleMatches(memory: Memory, rule: RetentionRule, now: Date): boolean {
  const scope = rule.scope ?? {};
  if (scope.userId && memory.userId !== scope.userId) return false;
  if (scope.brainId && memory.brainId !== scope.brainId) return false;
  if (scope.sourceId && memory.sourceId !== scope.sourceId) return false;
  if (scope.sourceKind && memory.source.kind !== scope.sourceKind) return false;
  if (scope.visibility && memory.consent.visibility !== scope.visibility) return false;
  if (scope.entity && !memory.entities.includes(scope.entity.toLowerCase())) return false;
  if (scope.relationType && !memory.relations.some((relation) => relation.type === scope.relationType)) return false;
  if (scope.tag && !memory.tags.includes(scope.tag)) return false;
  const effectiveDate = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
  const ageDays = (now.getTime() - effectiveDate.getTime()) / 86_400_000;
  return ageDays >= rule.retentionDays;
}

export function deterministicLaplaceNoise(seed: string, epsilon: number): number {
  const hash = contentHash(seed);
  const integer = Number.parseInt(hash.slice(0, 12), 36);
  const u = Math.min(0.999999, Math.max(0.000001, (integer % 1_000_000) / 1_000_000));
  const centered = u - 0.5;
  return -(Math.sign(centered) || 1) * Math.log(1 - 2 * Math.abs(centered)) / epsilon;
}

export function privacyComputeTokens(memory: Memory, dimensions: Array<"entities" | "tags" | "relations">): Array<{ dimension: "entities" | "tags" | "relations"; value: string }> {
  const tokens: Array<{ dimension: "entities" | "tags" | "relations"; value: string }> = [];
  if (dimensions.includes("entities")) {
    for (const entity of memory.entities) {
      const normalized = entity.trim().toLowerCase();
      if (normalized) tokens.push({ dimension: "entities", value: normalized });
    }
  }
  if (dimensions.includes("tags")) {
    for (const tag of memory.tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) tokens.push({ dimension: "tags", value: normalized });
    }
  }
  if (dimensions.includes("relations")) {
    for (const relation of memory.relations) tokens.push({ dimension: "relations", value: relation.type });
  }
  return tokens;
}

export function deterministicObservation(label: string, memories: Memory[], style: ObservationReport["style"]): string {
  const facts = memories
    .slice(0, style === "concise" ? 3 : 5)
    .map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 120));
  if (style === "narrative") return `Observation about ${label}: ${facts.join(" Then, ")}`;
  if (style === "descriptive") return `Observation about ${label}: ${facts.join(" | ")}`;
  return `${label}: ${facts.join(" | ")}`;
}

export function groupedPeriods(events: TimelineReport["events"], summaries: Map<string, string>): TimelineReport["periods"] {
  const groups = new Map<string, TimelineReport["periods"][number]>();
  for (const event of events) {
    const date = new Date(event.eventAt);
    for (const [granularity, period] of [
      ["hour", isoHour(date)],
      ["day", isoDay(date)],
      ["week", isoWeek(date)],
      ["month", isoMonth(date)]
    ] as const) {
      const key = `${granularity}:${period}`;
      const current = groups.get(key) ?? { granularity, period, memoryIds: [], summary: summaries.get(period) };
      current.memoryIds.push(event.memoryId);
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period) || a.granularity.localeCompare(b.granularity));
}

export function deterministicTimelineSummary(period: string, granularity: TimelineReport["periods"][number]["granularity"], memories: Memory[], style: "concise" | "descriptive" | "narrative"): string {
  const lead = style === "narrative" ? `During ${period}, the timeline shows` : style === "descriptive" ? `Timeline ${granularity} ${period} includes` : `Timeline summary for ${period}:`;
  const facts = memories
    .slice()
    .sort((a, b) => (b.trust * b.importance) - (a.trust * a.importance))
    .slice(0, style === "concise" ? 3 : 6)
    .map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 110));
  return `${lead} ${facts.join(" | ")}`;
}

export function intervalOverlaps(event: TimelineReport["events"][number], after?: Date, before?: Date): boolean {
  if (!after && !before) return true;
  const start = new Date(event.validFrom ?? event.eventAt);
  const end = event.validUntil ? new Date(event.validUntil) : new Date(event.eventAt);
  if (before && start >= before) return false;
  if (after && end < after) return false;
  return true;
}

export function evidenceDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function roundMetric(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

export function newestPathTime(path: { edges: Array<{ timestamp?: Date | string }> }): number {
  return Math.max(0, ...path.edges.map((edge) => edge.timestamp ? new Date(edge.timestamp).getTime() : 0));
}

export function averagePathTrust(path: { edges: Array<{ trust?: number }> }): number {
  if (!path.edges.length) return 0;
  return path.edges.reduce((sum, edge) => sum + (edge.trust ?? 0), 0) / path.edges.length;
}

export function isoHour(date: Date): string {
  return `${isoDay(date)}T${String(date.getUTCHours()).padStart(2, "0")}:00Z`;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isoMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
