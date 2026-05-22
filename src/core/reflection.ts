import type { Memory, ReflectionReport } from "./types";
import { tokenize } from "./text";
import { clamp, MemoryStore } from "./store";

export class ReflectionEngine {
  constructor(private readonly store: MemoryStore) {}

  run(userId: string, now = new Date()): ReflectionReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const contradictions = this.resolveContradictions(memories);
    const faded = this.fadeLowUtility(memories, now);
    const created = this.summarizeClusters(userId, this.activeMemories(userId), now);
    const reorganized = this.reorganizeMemories(this.activeMemories(userId), now);
    const activeAfter = this.activeMemories(userId);
    const evaluation = evaluateMemoryQuality(activeAfter, now);
    const demoted = uniqueMemories([...contradictions.map((item) => item.demoted), ...faded.demoted]);
    return {
      created,
      demoted,
      contradictions,
      lifecycle: {
        evaluated: memories.length,
        summarized: created.length,
        faded: faded.faded.length,
        archived: faded.archived.length,
        reorganized: reorganized.length,
        qualityScore: evaluation.qualityScore,
        issues: evaluation.issues,
        actions: [
          ...contradictions.map((item) => `resolved contradiction by keeping ${item.kept.id}`),
          ...faded.faded.map((memory) => `faded stale low-utility memory ${memory.id}`),
          ...faded.archived.map((memory) => `archived stale low-utility memory ${memory.id}`),
          ...created.map((memory) => `created reflection summary ${memory.id}`),
          ...reorganized.map((memory) => `reorganized memory ${memory.id} into ${memory.layer}/${memory.type}`)
        ]
      }
    };
  }

  private activeMemories(userId: string): Memory[] {
    return this.store.list(userId).filter((memory) => !memory.archivedAt);
  }

  private fadeLowUtility(memories: Memory[], now: Date): { demoted: Memory[]; faded: Memory[]; archived: Memory[] } {
    const demoted: Memory[] = [];
    const faded: Memory[] = [];
    const archived: Memory[] = [];
    for (const memory of memories) {
      const current = this.store.get(memory.id);
      if (current.archivedAt || current.pinned) continue;
      const ageDays = (now.getTime() - memory.createdAt.getTime()) / 86_400_000;
      const recentUseBoost = Math.log1p(memory.accessCount) / 10;
      const utility = memory.trust * memory.importance + recentUseBoost;
      if (ageDays > 45 && utility < 0.5) {
        const updated = this.store.update(memory.id, {
          trust: clamp(memory.trust - Math.min(0.18, ageDays / 900)),
          importance: clamp(memory.importance - Math.min(0.14, ageDays / 1200)),
          metadata: { fadedAt: now.toISOString(), fadeReason: "stale low-utility memory" }
        });
        demoted.push(updated);
        faded.push(updated);
      }
      const refreshed = this.store.get(memory.id);
      const refreshedUtility = refreshed.trust * refreshed.importance + recentUseBoost;
      if (ageDays > 90 && refreshedUtility < 0.34) {
        const archivedMemory = this.store.archive(memory.id);
        demoted.push(archivedMemory);
        archived.push(archivedMemory);
      }
    }
    return { demoted: uniqueMemories(demoted), faded, archived };
  }

  private resolveContradictions(memories: Memory[]): Array<{ kept: Memory; demoted: Memory; reason: string }> {
    const buckets = new Map<string, Memory[]>();
    for (const memory of memories) {
      const key = contradictionKey(memory.content);
      if (!key) continue;
      const group = buckets.get(key) ?? [];
      group.push(memory);
      buckets.set(key, group);
    }

    const resolved: Array<{ kept: Memory; demoted: Memory; reason: string }> = [];
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      const ranked = [...group].sort((a, b) => evidenceWeight(b) - evidenceWeight(a));
      const kept = ranked[0];
      for (const memory of ranked.slice(1)) {
        if (memory.id === kept.id || memory.pinned) continue;
        const demoted = this.store.update(memory.id, {
          trust: clamp(memory.trust - 0.35),
          metadata: { contradiction: `Superseded by ${kept.id}` }
        });
        if (demoted.trust < 0.4) this.store.archive(demoted.id);
        resolved.push({ kept, demoted: this.store.get(demoted.id), reason: "lower trust or older contradictory claim" });
      }
    }
    return resolved;
  }

  private summarizeClusters(userId: string, memories: Memory[], now: Date): Memory[] {
    const clusters = new Map<string, Memory[]>();
    for (const memory of memories) {
      if (memory.layer === "reflection") continue;
      const theme = pickTheme(memory);
      if (!theme) continue;
      const group = clusters.get(theme) ?? [];
      group.push(memory);
      clusters.set(theme, group);
    }

    const created: Memory[] = [];
    for (const [theme, group] of clusters.entries()) {
      if (group.length < 3) continue;
      const existing = memories.some((memory) => memory.layer === "reflection" && memory.metadata.theme === theme);
      if (existing) continue;
      const facts = group
        .sort((a, b) => b.trust * b.importance - a.trust * a.importance)
        .slice(0, 3)
        .map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 120));
      created.push(
        this.store.add({
          userId,
          content: `Reflection on ${theme}: ${facts.join(" | ")}`,
          type: "reference",
          layer: "reflection",
          source: { kind: "agent", confidence: 0.7 },
          tags: ["reflection", theme],
          entities: [theme],
          metadata: {
            theme,
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "cluster-summary"
          }
        })
      );
    }
    return created;
  }

  private reorganizeMemories(memories: Memory[], now: Date): Memory[] {
    const reorganized: Memory[] = [];
    for (const memory of memories) {
      if (memory.pinned || memory.layer === "reflection") continue;
      const lowerTags = new Set(memory.tags.map((tag) => tag.toLowerCase()));
      const content = memory.content.toLowerCase();
      const patch: Partial<Pick<Memory, "type" | "layer" | "metadata">> = {};
      if ((lowerTags.has("procedure") || lowerTags.has("workflow") || /\b(run|verify|use|call|start|deploy)\b/.test(content)) && memory.layer !== "procedural") {
        patch.layer = "procedural";
        patch.type = "procedural";
      } else if (memory.source.kind === "transcript" && memory.layer !== "working") {
        patch.layer = "working";
        patch.type = "episodic";
      } else if (memory.trust > 0.82 && memory.importance > 0.55 && memory.layer === "episodic") {
        patch.layer = "long_term";
      }
      if (patch.layer || patch.type) {
        reorganized.push(
          this.store.update(memory.id, {
            ...patch,
            metadata: {
              reorganizedAt: now.toISOString(),
              reorganizedFrom: `${memory.layer}/${memory.type}`
            }
          })
        );
      }
    }
    return reorganized;
  }
}

function pickTheme(memory: Memory): string | undefined {
  return [...memory.tags, ...memory.entities, ...tokenize(memory.content)]
    .map((token) => token.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .find((token) => token.length > 3 && !["project", "memory", "should", "would", "could"].includes(token));
}

function contradictionKey(content: string): string | undefined {
  const normalized = content.toLowerCase();
  const health = normalized.match(/\b(?:has|have|does not have|do not have)\s+([a-z0-9_./-]+\s+[a-z0-9_./-]+)/);
  if (health) return `health:${health[1].replace(/\b(?:pain|issue|problem)\b/g, "").trim()}`;
  const match = normalized.match(/\b(?:prefers?|uses?|must use|should use|runs on|target repo is)\s+([a-z0-9_./-]+)/);
  if (!match) return undefined;
  const subject = normalized.split(match[0])[0].split(/\s+/).slice(-5).join(" ");
  return `${subject}:${match[0].replace(match[1], "")}`;
}

function evidenceWeight(memory: Memory): number {
  return memory.trust * 0.55 + memory.importance * 0.25 + memory.source.confidence * 0.2 + memory.createdAt.getTime() / 10 ** 14;
}

function evaluateMemoryQuality(memories: Memory[], now: Date): { qualityScore: number; issues: string[] } {
  const issues: string[] = [];
  const lowTrust = memories.filter((memory) => memory.trust < 0.45);
  const stale = memories.filter((memory) => !memory.pinned && (now.getTime() - memory.updatedAt.getTime()) / 86_400_000 > 120);
  const unsupportedReflections = memories.filter(
    (memory) => memory.layer === "reflection" && !Array.isArray(memory.metadata.summaryOf)
  );
  const contradictionMarkers = memories.filter((memory) => typeof memory.metadata.contradiction === "string");

  if (lowTrust.length) issues.push(`${lowTrust.length} active low-trust memories need review or more evidence`);
  if (stale.length) issues.push(`${stale.length} active stale memories should be refreshed or archived`);
  if (unsupportedReflections.length) issues.push(`${unsupportedReflections.length} reflection memories lack summary provenance`);
  if (contradictionMarkers.length) issues.push(`${contradictionMarkers.length} contradiction markers remain active`);

  const penalty =
    Math.min(0.28, lowTrust.length * 0.05) +
    Math.min(0.24, stale.length * 0.04) +
    Math.min(0.18, unsupportedReflections.length * 0.06) +
    Math.min(0.2, contradictionMarkers.length * 0.08);
  return { qualityScore: clamp(1 - penalty), issues };
}

function uniqueMemories(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    if (seen.has(memory.id)) return false;
    seen.add(memory.id);
    return true;
  });
}
