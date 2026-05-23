import type { Memory, ReflectionReport } from "./types";
import { tokenize } from "./text";
import { clamp, MemoryStore } from "./store";
import { DEFAULT_LIFECYCLE_POLICY, normalizeLifecyclePolicy, type LifecyclePolicy } from "./config";

export class ReflectionEngine {
  private readonly policy: LifecyclePolicy;

  constructor(private readonly store: MemoryStore, policy: Partial<LifecyclePolicy> = DEFAULT_LIFECYCLE_POLICY) {
    this.policy = normalizeLifecyclePolicy(policy);
  }

  run(userId: string, now = new Date()): ReflectionReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const contradictions = this.resolveContradictions(memories);
    const faded = this.fadeLowUtility(memories, now);
    const stale = this.scheduleStalenessReview(this.activeMemories(userId), now);
    const created = [
      ...this.summarizeClusters(userId, this.activeMemories(userId), now),
      ...this.summarizeTemporalPeriods(userId, this.activeMemories(userId), now),
      ...this.extractBehavioralPatterns(userId, this.activeMemories(userId), now)
    ];
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
          ...stale.map((memory) => `scheduled stale memory verification ${memory.id}`),
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
      const recentUseBoost = Math.log1p(memory.accessCount) / this.policy.accessBoostDivisor;
      const utility = memory.trust * memory.importance + recentUseBoost;
      if (ageDays > this.policy.fadeAfterDays && utility < this.policy.fadeUtilityThreshold) {
        const updated = this.store.update(memory.id, {
          trust: clamp(memory.trust - Math.min(0.18, ageDays / this.policy.trustDecayRate)),
          importance: clamp(memory.importance - Math.min(0.14, ageDays / this.policy.importanceDecayRate)),
          metadata: { fadedAt: now.toISOString(), fadeReason: "stale low-utility memory" }
        });
        demoted.push(updated);
        faded.push(updated);
      }
      const refreshed = this.store.get(memory.id);
      const refreshedUtility = refreshed.trust * refreshed.importance + recentUseBoost;
      if (ageDays > this.policy.archiveAfterDays && refreshedUtility < this.policy.archiveUtilityThreshold) {
        const archivedMemory = this.store.archive(memory.id);
        demoted.push(archivedMemory);
        archived.push(archivedMemory);
      }
    }
    return { demoted: uniqueMemories(demoted), faded, archived };
  }

  private scheduleStalenessReview(memories: Memory[], now: Date): Memory[] {
    const scheduled: Memory[] = [];
    for (const memory of memories) {
      if (memory.pinned || memory.archivedAt || memory.temporal.verificationDueAt) continue;
      const lastConfirmed = memory.temporal.lastConfirmedAt ? new Date(memory.temporal.lastConfirmedAt) : memory.createdAt;
      const ageDays = (now.getTime() - lastConfirmed.getTime()) / 86_400_000;
      const hasCurrentLanguage = /\b(current|currently|now|active|latest|today|tomorrow|yesterday)\b/i.test(memory.content);
      const hasContradictionMarker = typeof memory.metadata.contradiction === "string";
      if ((hasCurrentLanguage && ageDays > this.policy.verificationAfterDays) || hasContradictionMarker) {
        scheduled.push(
          this.store.update(memory.id, {
            temporal: {
              ...memory.temporal,
              stalenessRisk: clamp((memory.temporal.stalenessRisk ?? 0.2) + (hasContradictionMarker ? 0.5 : 0.25)),
              verificationDueAt: now.toISOString()
            },
            metadata: {
              staleness: {
                reason: hasContradictionMarker ? "contradiction-marker" : "time-sensitive-language",
                scheduledAt: now.toISOString()
              }
            }
          })
        );
      }
    }
    return scheduled;
  }

  private resolveContradictions(memories: Memory[]): ReflectionReport["contradictions"] {
    const buckets = new Map<string, Memory[]>();
    for (const memory of memories) {
      const key = contradictionKey(memory.content);
      if (!key) continue;
      const group = buckets.get(key) ?? [];
      group.push(memory);
      buckets.set(key, group);
    }

    const resolved: ReflectionReport["contradictions"] = [];
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
        resolved.push({
          kept,
          demoted: this.store.get(demoted.id),
          reason: "lower trust or older contradictory claim",
          detector: "pattern",
          confidence: 0.78
        });
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

  private summarizeTemporalPeriods(userId: string, memories: Memory[], now: Date): Memory[] {
    const periods = new Map<string, Memory[]>();
    for (const memory of memories) {
      if (memory.layer === "reflection" || memory.archivedAt) continue;
      const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
      const key = `${eventAt.getUTCFullYear()}-${String(eventAt.getUTCMonth() + 1).padStart(2, "0")}`;
      const group = periods.get(key) ?? [];
      group.push(memory);
      periods.set(key, group);
    }
    const created: Memory[] = [];
    for (const [period, group] of periods) {
      if (group.length < 4) continue;
      const existing = memories.some((memory) => memory.layer === "reflection" && memory.metadata.period === period);
      if (existing) continue;
      created.push(
        this.store.add({
          userId,
          content: `Temporal summary for ${period}: ${group.slice(0, 4).map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 90)).join(" | ")}`,
          type: "reference",
          layer: "reflection",
          source: { kind: "agent", confidence: 0.68 },
          tags: ["reflection", "temporal", period],
          metadata: {
            period,
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "temporal-summary"
          }
        })
      );
    }
    return created;
  }

  private extractBehavioralPatterns(userId: string, memories: Memory[], now: Date): Memory[] {
    const groups = new Map<string, Memory[]>();
    for (const memory of memories) {
      if (memory.layer === "reflection" || memory.archivedAt) continue;
      const content = memory.content.toLowerCase();
      if (!/\b(prefers|orders|uses|runs|chooses|likes|asks|works)\b/.test(content)) continue;
      const theme = pickTheme(memory);
      if (!theme) continue;
      const group = groups.get(theme) ?? [];
      group.push(memory);
      groups.set(theme, group);
    }
    const created: Memory[] = [];
    for (const [theme, group] of groups) {
      if (group.length < 3) continue;
      const existing = memories.some((memory) => memory.layer === "reflection" && memory.metadata.pattern === theme);
      if (existing) continue;
      created.push(
        this.store.add({
          userId,
          content: `Behavioral pattern for ${theme}: repeated evidence across ${group.length} memories suggests a stable preference or habit.`,
          type: "reference",
          layer: "reflection",
          source: { kind: "agent", confidence: 0.66 },
          tags: ["reflection", "pattern", theme],
          entities: [theme],
          metadata: {
            pattern: theme,
            supportCount: group.length,
            confidence: Math.min(0.9, 0.45 + group.length * 0.1),
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "behavior-pattern"
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
