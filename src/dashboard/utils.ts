import type { Memory, SearchResult } from "../core";
import type { EngineeringKindFilter, MemoryFilter, RoutePreview, TimeZoom, ViewId } from "./types";

export function filterMemories(memories: Memory[], filter: MemoryFilter, engineeringFilter: EngineeringKindFilter): Memory[] {
  const byStatus = filter === "all"
    ? memories
    : filter === "archived"
      ? memories.filter((memory) => memory.archivedAt)
      : filter === "needs-review"
        ? memories.filter((memory) => !memory.archivedAt && needsReview(memory))
        : memories.filter((memory) => !memory.archivedAt);
  if (engineeringFilter === "all") return byStatus;
  return byStatus.filter((memory) => {
    const engineering = memory.metadata.engineering as { kind?: string } | undefined;
    return engineering?.kind === engineeringFilter;
  });
}

export function needsReview(memory: Memory): boolean {
  const patternReview = memory.metadata.patternReview as { status?: string } | undefined;
  const privacy = memory.metadata.privacy as { action?: string } | undefined;
  return !memory.archivedAt && (memory.trust < 0.55 || memory.source.kind === "transcript" || memory.tags.includes("needs-review") || patternReview?.status === "pending" || privacy?.action === "encrypt");
}

export function reviewReason(memory: Memory): string {
  if (memory.archivedAt) return "This memory is archived and will not be injected.";
  if (memory.pinned) return "Pinned memory. It will survive cleanup unless explicitly changed.";
  if (memory.source.kind === "transcript") return "Transcript source: verify with a human before injecting.";
  if ((memory.metadata.patternReview as { status?: string } | undefined)?.status === "pending") return "Inferred behavioral pattern: approve before treating it as stable.";
  if ((memory.metadata.privacy as { action?: string } | undefined)?.action === "encrypt") return "Encrypted sensitive memory: review policy before use.";
  if (memory.trust < 0.55) return "Low trust: archive, verify, or replace with better evidence.";
  if (memory.tags.includes("needs-review")) return "Tagged for review.";
  return "Ready for context injection.";
}

export function supersessionLabel(memory: Memory): string {
  if (memory.beliefState === "superseded") return "superseded by newer correction";
  if (memory.beliefState === "contradicted") return "contradiction warning";
  if (memory.beliefState === "stale") return "stale rule";
  if (memory.beliefState === "needs_verification") return "needs verification";
  if (memory.temporal.supersededAt) return `superseded ${new Date(memory.temporal.supersededAt).toLocaleDateString()}`;
  return "current rule";
}

export function itemLabel(item: MemoryFilter): string {
  return item === "needs-review" ? "Needs review" : item[0].toUpperCase() + item.slice(1);
}

export function shortId(memory: Memory): string {
  return memory.id.slice(0, 8);
}

export function scopeLabel(memory: Memory): string {
  return [memory.orgId, memory.appId, memory.sessionId, memory.projectId].filter(Boolean).join(" / ") || "user";
}

export function previewRoute(query: string, memories: Memory[], results: SearchResult[]): RoutePreview {
  const selected = new Map<string, { kind: string; id: string; reason: string }>();
  const excluded = new Map<string, { kind: string; id: string; reason: string }>();
  const topMemories = results.map((result) => result.memory);
  const addSelected = (kind: string, id: string | undefined, reason: string) => {
    if (!id) return;
    selected.set(`${kind}:${id}`, { kind, id, reason });
  };
  const addExcluded = (kind: string, id: string | undefined, reason: string) => {
    if (!id) return;
    excluded.set(`${kind}:${id}`, { kind, id, reason });
  };

  addSelected("user", "demo", "demo user is the base route");
  for (const memory of topMemories) {
    addSelected("session", memory.sessionId, "top evidence contains this session scope");
    addSelected("app", memory.appId, "top evidence contains this app scope");
    addSelected("project", memory.projectId, "top evidence contains this project scope");
    addSelected("org", memory.orgId, "top evidence contains this org scope");
    addSelected("brain", memory.brainId, "top evidence contains this brain scope");
    addSelected("agent", memory.agentId, "top evidence contains this agent scope");
    addSelected("persona", typeof memory.metadata.personaId === "string" ? memory.metadata.personaId : undefined, "top evidence contains this persona scope");
  }

  const privateOffRoute = memories
    .filter((memory) => !topMemories.some((top) => top.id === memory.id))
    .filter((memory) => memory.consent.visibility === "private" && query.toLowerCase().includes("team"))
    .slice(0, 3);
  for (const memory of privateOffRoute) addExcluded("private", shortId(memory), "private memory is held back from team-style routing");

  const reasoning = [
    topMemories.some((memory) => memory.projectId || memory.brainId) ? "Project and brain scopes are selected from ranked evidence." : "Base route uses user memory plus matching evidence scopes.",
    query.toLowerCase().includes("team") ? "Team wording keeps private memories out unless consent allows sharing." : "Consent gates are checked before context injection."
  ];
  return { selectedScopes: [...selected.values()], excludedScopes: [...excluded.values()], reasoning };
}

export function ageLabel(date: Date): string {
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export function findMemory(memories: Memory[], id: string): Memory | null {
  return memories.find((memory) => memory.id === id) ?? null;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clusterEntities(memories: Memory[]): Array<{ entity: string; count: number }> {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    for (const entity of memory.entities) counts.set(entity, (counts.get(entity) ?? 0) + 1);
  }
  return [...counts.entries()].map(([entity, count]) => ({ entity, count })).sort((a, b) => b.count - a.count || a.entity.localeCompare(b.entity));
}

export function timelineEvents(memories: Memory[], zoom: TimeZoom, tagFilter: string): Array<{ day: string; memory: Memory }> {
  const cutoffDays = zoom === "day" ? 1 : zoom === "week" ? 7 : zoom === "month" ? 31 : 10_000;
  const cutoff = Date.now() - cutoffDays * 86_400_000;
  return memories
    .filter((memory) => !memory.archivedAt)
    .filter((memory) => memory.createdAt.getTime() >= cutoff)
    .filter((memory) => tagFilter === "all" || memory.tags.includes(tagFilter))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((memory) => ({ day: memory.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), memory }));
}

export function viewTitle(view: ViewId): string {
  if (view === "memories") return "Memory workbench";
  if (view === "recall") return "Recall tuning";
  if (view === "graph") return "Knowledge graph";
  if (view === "timeline") return "Temporal patterns";
  if (view === "dream") return "Dream and cleanup";
  if (view === "marketplace") return "Marketplace setup";
  return "Benchmark proof";
}

export function viewSubtitle(view: ViewId): string {
  if (view === "memories") return "Inspect every memory, understand trust, and remove anything that should not shape agent behavior.";
  if (view === "recall") return "Preview ranked context, tune signal weights, and roll back unsafe recall changes.";
  if (view === "graph") return "Trace entity paths, source filters, clusters, and activation before injecting multi-hop evidence.";
  if (view === "timeline") return "Inspect memory chronology, recurring patterns, and review annotations.";
  if (view === "dream") return "Run memory hygiene and inspect each summary, demotion, archive, and reorganization.";
  if (view === "marketplace") return "Browse modules, personas, connectors, and retrieval profiles before installation.";
  return "Validate benchmark claims and inspect public proof artifacts.";
}

