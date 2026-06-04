import type { ContradictionDetector, Memory, MemoryClaim, ReflectionEvaluator, ReflectionMemoryEvaluation, ReflectionReport, ReflectionSummarizer } from "./types";
import { tokenize } from "./text";
import { clamp, MemoryStore } from "./store";
import { DEFAULT_LIFECYCLE_POLICY, normalizeLifecyclePolicy, type LifecyclePolicy } from "./config";

export class ReflectionEngine {
  private readonly policy: LifecyclePolicy;
  private readonly contradictionDetector?: ContradictionDetector;
  private readonly summarizer?: ReflectionSummarizer;
  private readonly evaluator?: ReflectionEvaluator;

  constructor(
    private readonly store: MemoryStore,
    options: Partial<LifecyclePolicy> & { contradictionDetector?: ContradictionDetector; summarizer?: ReflectionSummarizer; evaluator?: ReflectionEvaluator } = DEFAULT_LIFECYCLE_POLICY
  ) {
    this.policy = normalizeLifecyclePolicy(options);
    this.contradictionDetector = options.contradictionDetector;
    this.summarizer = options.summarizer;
    this.evaluator = options.evaluator;
  }

  run(userId: string, now = new Date()): ReflectionReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const evaluations = this.evaluateMemories(memories, now);
    const contradictions = this.resolveContradictions(memories, evaluations);
    const faded = this.fadeLowUtility(memories, now);
    const stale = this.scheduleStalenessReview(memories, now, evaluations);
    const activeForSummaries = this.activeMemories(userId);
    const created = [
      ...this.summarizeClusters(userId, activeForSummaries, now),
      ...this.summarizeTemporalPeriods(userId, activeForSummaries, now),
      ...this.extractBehavioralPatterns(userId, activeForSummaries, now, evaluations)
    ];
    const activeWithReflections = created.length ? this.activeMemories(userId) : activeForSummaries;
    const revalidatedPatterns = this.revalidateBehavioralPatterns(activeWithReflections, now);
    const reorganized = this.reorganizeMemories(activeWithReflections, now, evaluations);
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
          ...revalidatedPatterns.map((memory) => `revalidated behavioral pattern ${memory.id}`),
          ...reorganized.map((memory) => `reorganized memory ${memory.id} into ${memory.layer}/${memory.type}`)
        ]
      }
    };
  }

  private activeMemories(userId: string): Memory[] {
    return this.store.list(userId).filter((memory) => !memory.archivedAt);
  }

  private evaluateMemories(memories: Memory[], now: Date): Map<string, ReflectionMemoryEvaluation> {
    const evaluations = this.evaluator?.evaluateReflection({ memories, now }) ?? [];
    return new Map(evaluations.map((evaluation) => [evaluation.memoryId, evaluation]));
  }

  private fadeLowUtility(memories: Memory[], now: Date): { demoted: Memory[]; faded: Memory[]; archived: Memory[] } {
    const demoted: Memory[] = [];
    const faded: Memory[] = [];
    const archived: Memory[] = [];
    for (const memory of memories) {
      const current = this.store.get(memory.id);
      if (current.archivedAt || current.pinned) continue;
      if (this.isProtected(current)) continue;
      const ageDays = (now.getTime() - memory.createdAt.getTime()) / 86_400_000;
      const recentUseBoost = Math.log1p(memory.accessCount) / this.policy.accessBoostDivisor;
      const utility = memory.trust * memory.importance + recentUseBoost;
      const fadeAfterDays = memory.source.kind === "transcript" ? Math.min(this.policy.fadeAfterDays, this.policy.transcriptArchiveAfterDays / 2) : this.policy.fadeAfterDays;
      const archiveAfterDays = memory.source.kind === "transcript" ? Math.min(this.policy.archiveAfterDays, this.policy.transcriptArchiveAfterDays) : this.policy.archiveAfterDays;
      if (ageDays > fadeAfterDays && utility < this.policy.fadeUtilityThreshold) {
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
      if (ageDays > archiveAfterDays && refreshedUtility < this.policy.archiveUtilityThreshold) {
        const archivedMemory = this.store.archive(memory.id);
        demoted.push(archivedMemory);
        archived.push(archivedMemory);
      }
    }
    return { demoted: uniqueMemories(demoted), faded, archived };
  }

  private scheduleStalenessReview(memories: Memory[], now: Date, evaluations: Map<string, ReflectionMemoryEvaluation>): Memory[] {
    const scheduled: Memory[] = [];
    for (const memory of memories) {
      if (memory.pinned || memory.archivedAt || memory.temporal.verificationDueAt) continue;
      const lastConfirmed = memory.temporal.lastConfirmedAt ? new Date(memory.temporal.lastConfirmedAt) : memory.createdAt;
      const ageDays = (now.getTime() - lastConfirmed.getTime()) / 86_400_000;
      const timeSensitive = evaluations.get(memory.id)?.timeSensitive;
      const hasCurrentLanguage = Boolean(timeSensitive?.applies && (timeSensitive.confidence ?? 0) >= 0.65);
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
                reason: hasContradictionMarker ? "contradiction-marker" : (timeSensitive?.reason ?? "provider time-sensitive evaluation"),
                scheduledAt: now.toISOString()
              }
            }
          })
        );
      }
    }
    return scheduled;
  }

  private resolveContradictions(memories: Memory[], evaluations: Map<string, ReflectionMemoryEvaluation>): ReflectionReport["contradictions"] {
    const buckets = new Map<string, Array<{ memory: Memory; claim: ContradictionClaim }>>();
    for (const memory of memories) {
      if (memory.beliefState !== "active") continue;
      for (const claim of contradictionClaims(memory, evaluations.get(memory.id))) {
        const group = buckets.get(claim.key) ?? [];
        group.push({ memory, claim });
        buckets.set(claim.key, group);
      }
    }
    for (const pair of this.detectorCandidatePairs(memories)) {
      const classified = this.contradictionDetector?.classify({ a: pair[0], b: pair[1] });
      if (!classified || classified.label === "neutral") continue;
      const key = `external:${pair[0].id}:${pair[1].id}`;
      buckets.set(key, [
        { memory: pair[0], claim: { key, value: "a", label: "external", detector: "external", confidence: classified.confidence } },
        { memory: pair[1], claim: { key, value: classified.label === "contradiction" ? "b" : "a", label: "external", detector: "external", confidence: classified.confidence } }
      ]);
    }

    const resolved: ReflectionReport["contradictions"] = [];
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      const values = new Set(group.map((item) => item.claim.value));
      if (values.size < 2) continue;
      const ranked = [...group].sort((a, b) => evidenceWeight(b.memory) - evidenceWeight(a.memory));
      const kept = ranked[0];
      const nearest = ranked[1];
      if (!group.some((item) => item.claim.detector === "external") && nearest && shouldRequireOperatorReview(kept.memory, nearest.memory)) {
        const now = new Date().toISOString();
        const reviewMemoryIds: string[] = [];
        for (const item of ranked) {
          if (item.memory.pinned) continue;
          const updated = this.store.update(item.memory.id, {
            beliefState: item.memory.beliefState === "active" ? "needs_verification" : item.memory.beliefState,
            temporal: { ...item.memory.temporal, verificationDueAt: item.memory.temporal.verificationDueAt ?? now, stalenessRisk: Math.max(item.memory.temporal.stalenessRisk ?? 0, 0.78) },
            metadata: { conflictReview: { status: "needs_operator_review", at: now, claimKey: item.claim.key, reason: "conflicting claims have comparable evidence weight" } }
          });
          reviewMemoryIds.push(updated.id);
        }
        this.addConflictReviewSummary(kept.claim.key, reviewMemoryIds, now, kept.memory);
        continue;
      }
      for (const item of ranked.slice(1)) {
        const memory = item.memory;
        if (memory.id === kept.memory.id || memory.pinned) continue;
        const classified = this.contradictionDetector?.classify({ a: kept.memory, b: memory, key: kept.claim.key }) ?? {
          label: "contradiction" as const,
          confidence: Math.min(0.92, Math.max(kept.claim.confidence, item.claim.confidence)),
          reason: `${kept.claim.label} differs: ${kept.claim.value} vs ${item.claim.value}`
        };
        if (classified.label !== "contradiction") continue;
        if (classified.confidence < 0.6) {
          this.store.update(memory.id, {
            beliefState: "needs_verification",
            temporal: { ...memory.temporal, verificationDueAt: new Date().toISOString(), stalenessRisk: 0.7 },
            metadata: { contradictionReview: { reason: classified.reason ?? "low confidence contradiction", confidence: classified.confidence } }
          });
          continue;
        }
        const demoted = this.store.update(memory.id, {
          beliefState: "contradicted",
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

  private addConflictReviewSummary(claimKey: string, memoryIds: string[], now: string, exemplar: Memory): void {
    const existing = this.store.list(exemplar.userId).some((memory) => (memory.metadata.conflictReviewSummary as { claimKey?: string } | undefined)?.claimKey === claimKey);
    if (existing) return;
    this.store.add({
      userId: exemplar.userId,
      brainId: exemplar.brainId,
      sourceId: exemplar.sourceId,
      orgId: exemplar.orgId,
      projectId: exemplar.projectId,
      content: `Conflicting claims for ${claimKey} require operator review before use.`,
      type: "reference",
      layer: "reflection",
      source: { kind: "agent", confidence: 0.74 },
      tags: ["conflict-review", "needs-review"],
      entities: claimKey.split(":").filter(Boolean),
      timestamp: now,
      metadata: { conflictReviewSummary: { claimKey, memoryIds, status: "needs_operator_review", at: now } }
    });
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
      const generated = this.validGeneratedSummary(this.summarizer?.summarize({ theme, memories: group, now }), group);
      created.push(
        this.store.add({
          userId,
          content: generated?.content ?? `Reflection on ${theme}: ${facts.join(" | ")}`,
          type: "reference",
          layer: "reflection",
          source: { kind: "agent", confidence: generated?.confidence ?? 0.7 },
          tags: generated ? ["reflection", theme] : ["reflection", "needs-review", theme],
          entities: [theme],
          metadata: {
            theme,
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "cluster-summary",
            summaryMode: generated ? "external" : "deterministic",
            ...(generated
              ? {}
              : {
                  needsVerification: true,
                  reflectionReview: {
                    status: "pending",
                    reason: "deterministic reflection summary requires harness evidence judgement before injection"
                  }
                }),
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
          tags: ["reflection", "temporal", "needs-review", period],
          metadata: {
            period,
            summaryOf: group.map((memory) => memory.id),
            dreamedAt: now.toISOString(),
            dreamJob: "temporal-summary",
            summaryMode: "deterministic",
            needsVerification: true,
            reflectionReview: {
              status: "pending",
              reason: "deterministic temporal summary requires harness evidence judgement before injection"
            }
          }
        })
      );
    }
    return created;
  }

  private extractBehavioralPatterns(userId: string, memories: Memory[], now: Date, evaluations: Map<string, ReflectionMemoryEvaluation>): Memory[] {
    const groups = new Map<string, Memory[]>();
    for (const memory of memories) {
      if (memory.layer === "reflection" || memory.archivedAt) continue;
      const behavioral = evaluations.get(memory.id)?.behavioralEvidence;
      if (!behavioral?.applies || (behavioral.confidence ?? 0) < 0.65) continue;
      const theme = behavioral.theme ?? pickTheme(memory);
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
          tags: ["reflection", "pattern", "needs-review", theme],
          entities: [theme],
          metadata: {
            pattern: theme,
            patternType: "behavioral",
            patternReview: { status: "pending", reason: "inferred behavior requires operator approval" },
            needsVerification: true,
            recurrenceWindow: "observed-period",
            supportCount: group.length,
            confidence: Math.min(0.9, 0.45 + group.length * 0.1),
            summaryOf: group.map((memory) => memory.id),
            lastObservedAt: latestDate(group).toISOString(),
            dreamedAt: now.toISOString(),
            dreamJob: "behavior-pattern"
          }
        })
      );
    }
    return created;
  }

  private revalidateBehavioralPatterns(memories: Memory[], now: Date): Memory[] {
    const updated: Memory[] = [];
    const byId = new Map(memories.map((memory) => [memory.id, memory]));
    for (const pattern of memories) {
      if (pattern.metadata.dreamJob !== "behavior-pattern" || !Array.isArray(pattern.metadata.summaryOf)) continue;
      const support = pattern.metadata.summaryOf.map((id) => byId.get(String(id))).filter((memory): memory is Memory => Boolean(memory));
      const lastObservedAt = support.length ? latestDate(support) : pattern.createdAt;
      const quietDays = (now.getTime() - lastObservedAt.getTime()) / 86_400_000;
      if (quietDays < 45) continue;
      const confidence = Math.max(0.1, Number(pattern.metadata.confidence ?? 0.5) - Math.min(0.3, quietDays / 365));
      updated.push(
        this.store.update(pattern.id, {
          importance: clamp(pattern.importance - Math.min(0.12, quietDays / 900)),
          metadata: {
            confidence,
            lastRevalidatedAt: now.toISOString(),
            revalidationReason: "support not observed recently"
          }
        })
      );
    }
    return updated;
  }

  private reorganizeMemories(memories: Memory[], now: Date, evaluations: Map<string, ReflectionMemoryEvaluation>): Memory[] {
    const reorganized: Memory[] = [];
    for (const memory of memories) {
      if (memory.pinned || memory.layer === "reflection") continue;
      const lowerTags = new Set(memory.tags.map((tag) => tag.toLowerCase()));
      const organization = evaluations.get(memory.id)?.organization;
      const patch: Partial<Pick<Memory, "type" | "layer" | "metadata">> = {};
      if ((lowerTags.has("procedure") || lowerTags.has("workflow")) && memory.layer !== "procedural") {
        patch.layer = "procedural";
        patch.type = "procedural";
      } else if (organization && (organization.confidence ?? 0) >= 0.75 && (organization.layer || organization.type)) {
        if (organization.layer && organization.layer !== memory.layer) patch.layer = organization.layer;
        if (organization.type && organization.type !== memory.type) patch.type = organization.type;
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

  private isProtected(memory: Memory): boolean {
    if (this.policy.protectedLayers.includes(memory.layer)) return true;
    if (this.policy.protectedSourceKinds.includes(memory.source.kind)) return true;
    return memory.tags.some((tag) => this.policy.protectedTags.includes(tag));
  }

  private detectorCandidatePairs(memories: Memory[]): Array<[Memory, Memory]> {
    if (!this.contradictionDetector) return [];
    const active = memories.filter((memory) => !memory.archivedAt).slice(0, 80);
    const pairs: Array<[Memory, Memory]> = [];
    for (let index = 0; index < active.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < active.length; otherIndex += 1) {
        const a = active[index];
        const b = active[otherIndex];
        if (a.userId !== b.userId) continue;
        if (!sharesEvidenceSurface(a, b)) continue;
        pairs.push([a, b]);
      }
    }
    return pairs.slice(0, 120);
  }

  private validGeneratedSummary(
    generated: ReturnType<NonNullable<ReflectionSummarizer["summarize"]>> | undefined,
    memories: Memory[]
  ): ReturnType<NonNullable<ReflectionSummarizer["summarize"]>> | undefined {
    if (!generated) return undefined;
    const sourceText = memories.map((memory) => `${memory.content} ${memory.entities.join(" ")}`).join(" ").toLowerCase();
    const generatedStop = new Set(["generated", "summary", "reflection"]);
    const unsupported = [...new Set((generated.content.match(/\b[A-Z][A-Za-z0-9_-]{2,}\b/g) ?? []).map((item) => item.toLowerCase()))].filter(
      (entity) => !generatedStop.has(entity) && !sourceText.includes(entity)
    );
    if (!unsupported.length) return generated;
    return {
      content: `Reflection summary withheld: generated text introduced unsupported entities (${unsupported.join(", ")}).`,
      confidence: Math.min(generated.confidence ?? 0.4, 0.4),
      metadata: { ...(generated.metadata ?? {}), warnings: ["unsupported generated claim"], unsupportedEntities: unsupported }
    };
  }
}

function pickTheme(memory: Memory): string | undefined {
  return [...memory.tags, ...memory.entities, ...tokenize(memory.content)]
    .map((token) => token.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .find((token) => token.length > 3);
}

interface ContradictionClaim {
  key: string;
  value: string;
  label: string;
  detector: string;
  confidence: number;
}

function contradictionClaims(memory: Memory, evaluation?: ReflectionMemoryEvaluation): ContradictionClaim[] {
  const claims: ContradictionClaim[] = [];
  const structured = memory.metadata.claim as MemoryClaim | undefined;
  if (structured?.subject && structured.predicate && structured.object) {
    claims.push({
      key: `${structured.subject}:${structured.predicate}`.replace(/\s+/g, " ").trim().toLowerCase(),
      value: String(structured.object).replace(/\s+/g, " ").trim().toLowerCase(),
      label: "structured-claim",
      detector: "metadata:claim",
      confidence: structured.confidence ?? memory.confidence ?? memory.source.confidence
    });
  }
  for (const claim of evaluation?.claims ?? []) {
    const key = claim.key.replace(/\s+/g, " ").trim().toLowerCase();
    const value = claim.value.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || !value) continue;
    claims.push({
      key,
      value,
      label: claim.label ?? "provider-claim",
      detector: "provider:reflection",
      confidence: claim.confidence ?? 0.68
    });
  }
  return claims;
}

function evidenceWeight(memory: Memory): number {
  const recencyTieBreaker = memory.createdAt.getTime() / 10 ** 16;
  return memory.trust * 0.34 + memory.importance * 0.18 + memory.source.confidence * 0.16 + sourceQuality(memory) * 0.3 + recencyTieBreaker;
}

function shouldRequireOperatorReview(a: Memory, b: Memory): boolean {
  const weightGap = Math.abs(evidenceWeight(a) - evidenceWeight(b));
  if (weightGap > 0.035) return false;
  const aRef = a.provenance.sourceRef;
  const bRef = b.provenance.sourceRef;
  if (aRef?.connectorId && bRef?.connectorId && aRef.connectorId !== bRef.connectorId) return true;
  if (a.source.kind === b.source.kind && a.source.kind !== "agent") return true;
  return false;
}

function sourceQuality(memory: Memory): number {
  const tags = new Set(memory.tags.map((tag) => tag.toLowerCase()));
  const connectorId = memory.provenance.sourceRef?.connectorId?.toLowerCase() ?? "";
  const declaredQuality = typeof memory.metadata.sourceQuality === "string" ? memory.metadata.sourceQuality.toLowerCase() : undefined;
  if (declaredQuality === "ci" || declaredQuality === "test" || declaredQuality === "release-gate") return 0.94;
  if (declaredQuality === "adr" || declaredQuality === "spec") return 0.82;
  if (declaredQuality === "chat") return 0.62;
  const sourceKind = memory.source.kind;
  const engineeringKind = (memory.metadata.engineering as { kind?: string } | undefined)?.kind;
  if (sourceKind === "human" && (tags.has("correction") || tags.has("engineering-correction") || tags.has("user-correction") || engineeringKind === "review_correction")) return 1;
  if (connectorId.includes("github") || connectorId.includes("gitlab") || connectorId.includes("azure")) return 0.92;
  if (sourceKind === "tool" && (tags.has("harness-action") || tags.has("tests") || tags.has("test-failure") || tags.has("success-pattern") || engineeringKind === "tool_outcome")) return 0.88;
  if (sourceKind === "reviewed_code") return 0.86;
  if (connectorId.includes("confluence") || connectorId.includes("notion") || connectorId.includes("docs")) return 0.82;
  if (/\b(jira|linear|asana|clickup)\b/.test(connectorId)) return 0.74;
  if (/\b(slack|discord|teams)\b/.test(connectorId)) return 0.64;
  if (sourceKind === "human") return 0.78;
  if (sourceKind === "tool") return 0.72;
  if (sourceKind === "import") return 0.58;
  if (sourceKind === "agent") return 0.44;
  if (sourceKind === "transcript") return 0.28;
  return 0.5;
}

function sharesEvidenceSurface(a: Memory, b: Memory): boolean {
  const aEntities = new Set(a.entities);
  if (b.entities.some((entity) => aEntities.has(entity))) return true;
  const aTags = new Set(a.tags);
  return b.tags.some((tag) => aTags.has(tag));
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

function latestDate(memories: Memory[]): Date {
  return new Date(Math.max(...memories.map((memory) => (memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt).getTime())));
}
