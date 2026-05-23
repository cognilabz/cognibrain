import type { ContradictionDetector, Memory, ReflectionReport, ReflectionSummarizer } from "./types";
import { tokenize } from "./text";
import { clamp, MemoryStore } from "./store";
import { DEFAULT_LIFECYCLE_POLICY, normalizeLifecyclePolicy, type LifecyclePolicy } from "./config";

export class ReflectionEngine {
  private readonly policy: LifecyclePolicy;
  private readonly contradictionDetector?: ContradictionDetector;
  private readonly summarizer?: ReflectionSummarizer;

  constructor(
    private readonly store: MemoryStore,
    options: Partial<LifecyclePolicy> & { contradictionDetector?: ContradictionDetector; summarizer?: ReflectionSummarizer } = DEFAULT_LIFECYCLE_POLICY
  ) {
    this.policy = normalizeLifecyclePolicy(options);
    this.contradictionDetector = options.contradictionDetector;
    this.summarizer = options.summarizer;
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
    const buckets = new Map<string, Array<{ memory: Memory; claim: ContradictionClaim }>>();
    for (const memory of memories) {
      for (const claim of contradictionClaims(memory.content)) {
        const group = buckets.get(claim.key) ?? [];
        group.push({ memory, claim });
        buckets.set(claim.key, group);
      }
    }

    const resolved: ReflectionReport["contradictions"] = [];
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      const values = new Set(group.map((item) => item.claim.value));
      if (values.size < 2) continue;
      const ranked = [...group].sort((a, b) => evidenceWeight(b.memory) - evidenceWeight(a.memory));
      const kept = ranked[0];
      for (const item of ranked.slice(1)) {
        const memory = item.memory;
        if (memory.id === kept.memory.id || memory.pinned) continue;
        const classified = this.contradictionDetector?.classify({ a: kept.memory, b: memory, key: kept.claim.key }) ?? {
          label: "contradiction" as const,
          confidence: Math.min(0.92, Math.max(kept.claim.confidence, item.claim.confidence)),
          reason: `${kept.claim.label} differs: ${kept.claim.value} vs ${item.claim.value}`
        };
        if (classified.label !== "contradiction" || classified.confidence < 0.6) continue;
        const demoted = this.store.update(memory.id, {
          trust: clamp(memory.trust - 0.35),
          metadata: { contradiction: `Superseded by ${kept.memory.id}`, contradictionKey: kept.claim.key }
        });
        if (demoted.trust < 0.4) this.store.archive(demoted.id);
        resolved.push({
          kept: kept.memory,
          demoted: this.store.get(demoted.id),
          reason: classified.reason ?? "lower trust or older contradictory claim",
          detector: this.contradictionDetector ? "external" : item.claim.detector,
          confidence: classified.confidence
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
      const generated = this.summarizer?.summarize({ theme, memories: group, now });
      created.push(
        this.store.add({
          userId,
          content: generated?.content ?? `Reflection on ${theme}: ${facts.join(" | ")}`,
          type: "reference",
          layer: "reflection",
          source: { kind: "agent", confidence: generated?.confidence ?? 0.7 },
          tags: ["reflection", theme],
          entities: [theme],
          metadata: {
            theme,
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "cluster-summary",
            summaryMode: generated ? "external" : "deterministic",
            ...(generated?.metadata ?? {})
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

interface ContradictionClaim {
  key: string;
  value: string;
  label: string;
  detector: string;
  confidence: number;
}

const CLAIM_PATTERNS: Array<{
  label: string;
  detector: string;
  pattern: RegExp;
  key: (match: RegExpMatchArray, normalized: string) => string;
  value: (match: RegExpMatchArray) => string;
  confidence: number;
}> = [
  {
    label: "preference",
    detector: "pattern:preference-multilingual",
    pattern: /\b(?:prefers?|likes?|bevorzugt|mag)\s+([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,3})/i,
    key: (match, normalized) => `${subjectBefore(normalized, match[0])}:preference`,
    value: (match) => normalizeClaimValue(match[1]),
    confidence: 0.78
  },
  {
    label: "tooling",
    detector: "pattern:tooling-multilingual",
    pattern: /\b(?:uses?|should use|must use|nutzt|verwendet|benutzt|soll(?:te)? nutzen|muss nutzen|soll(?:te)? verwenden|muss verwenden)\s+([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,3})/i,
    key: (match, normalized) => `${subjectBefore(normalized, match[0])}:uses`,
    value: (match) => normalizeClaimValue(match[1]),
    confidence: 0.82
  },
  {
    label: "runtime",
    detector: "pattern:runtime-multilingual",
    pattern: /\b(?:runs on|läuft auf|laeuft auf)\s+([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,2})/i,
    key: (match, normalized) => `${subjectBefore(normalized, match[0])}:runs-on`,
    value: (match) => normalizeClaimValue(match[1]),
    confidence: 0.82
  },
  {
    label: "target repository",
    detector: "pattern:target-repo-multilingual",
    pattern: /\b(?:target repo is|target repository is|ziel repo ist|zielrepository ist|arbeitsrepo ist)\s+([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,2})/i,
    key: () => "workspace:target-repository",
    value: (match) => normalizeClaimValue(match[1]),
    confidence: 0.86
  },
  {
    label: "health",
    detector: "pattern:health-negation-multilingual",
    pattern: /(?<!not )\b(?:has|have|hat)\s+(?:kein(?:e|en|er|es)?\s+)?([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,2})/i,
    key: (match, normalized) => `health:${normalizeClaimValue(match[1]).replace(/\b(?:pain|issue|problem|schmerz|schmerzen|problem)\b/g, "").trim()}`,
    value: (match) => (/kein|keine|keinen|keiner|keines|does not|do not|no\b/i.test(match[0]) ? "absent" : "present"),
    confidence: 0.74
  },
  {
    label: "health",
    detector: "pattern:health-negation-multilingual",
    pattern: /\b(?:does not have|do not have|has no|have no|ohne)\s+([a-z0-9äöüß_./-]+(?:\s+[a-z0-9äöüß_./-]+){0,2})/i,
    key: (match) => `health:${normalizeClaimValue(match[1]).replace(/\b(?:pain|issue|problem|schmerz|schmerzen|problem)\b/g, "").trim()}`,
    value: () => "absent",
    confidence: 0.82
  }
];

function contradictionClaims(content: string): ContradictionClaim[] {
  const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
  const claims: ContradictionClaim[] = [];
  for (const rule of CLAIM_PATTERNS) {
    const match = normalized.match(rule.pattern);
    if (!match) continue;
    const key = rule.key(match, normalized).replace(/\s+/g, " ").trim();
    const value = rule.value(match).replace(/\s+/g, " ").trim();
    if (!key || !value) continue;
    claims.push({ key, value, label: rule.label, detector: rule.detector, confidence: rule.confidence });
  }
  return claims;
}

function subjectBefore(normalized: string, phrase: string): string {
  return normalized.split(phrase)[0].split(/\s+/).filter(Boolean).slice(-5).join(" ") || "user";
}

function normalizeClaimValue(value: string): string {
  return tokenize(value).join(" ") || value.toLowerCase().trim();
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
