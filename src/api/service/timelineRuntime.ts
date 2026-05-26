import { citationFor, type AdaptiveDreamPolicyReport, type BehavioralPatternReport, type Memory, type ObservationReport, type PredictionReport, type TemporalQueryReport, type TimelineReport, type TimelineSummaryReport } from "../../core";
import { deterministicObservation, deterministicTimelineSummary, evidenceDate, groupedPeriods, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, mineRecurringPatterns, mineRecurringSequences, observationClusters, safeGet, sequenceAnchor } from "./helpers";

export function timeline(service: any, userId: string): TimelineReport {
    const memories = (service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt);
    const events = memories
      .map((memory) => ({
        memoryId: memory.id,
        content: memory.content,
        eventAt: memory.temporal.eventAt ?? memory.createdAt,
        validFrom: memory.temporal.validFrom,
        validUntil: memory.temporal.validUntil,
        supersededAt: memory.temporal.supersededAt,
        entities: memory.entities
      }))
      .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
    const summaries = new Map<string, string>(memories.filter((memory) => memory.metadata.period).map((memory) => [String(memory.metadata.period), memory.content]));
    return {
      userId,
      events,
      periods: groupedPeriods(events, summaries)
    };
  }

export function summarizeTimeline(service: any, userId: string, options: { granularity?: TimelineSummaryReport["granularity"]; persist?: boolean; style?: "concise" | "descriptive" | "narrative" } = {}): TimelineSummaryReport {
    const now = new Date();
    const granularity = options.granularity ?? "all";
    const periods = (service.timeline(userId).periods as TimelineReport["periods"]).filter((period) => granularity === "all" || period.granularity === granularity);
    const existingSummaryIds = new Set(
      (service.store
        .list(userId) as Memory[])
        .filter((memory) => memory.metadata.dreamJob === "timeline-summary")
        .map((memory) => `${memory.metadata.granularity}:${memory.metadata.period}`)
    );
    const summaries: TimelineSummaryReport["summaries"] = [];
    for (const period of periods) {
      const memories = period.memoryIds.map((id) => safeGet(service.store, id)).filter((memory): memory is Memory => Boolean(memory && !memory.archivedAt && memory.layer !== "reflection"));
      if (!memories.length) continue;
      const generated = service.defaultSummarizer?.summarize({ theme: `timeline ${period.granularity} ${period.period}`, memories, now });
      const providerContent = generated?.content?.trim();
      const content = providerContent
        ? providerContent.slice(0, 1200)
        : deterministicTimelineSummary(period.period, period.granularity, memories, options.style ?? "concise");
      const mode = providerContent ? "provider" : "deterministic";
      let summaryMemoryId: string | undefined;
      const key = `${period.granularity}:${period.period}`;
      if (options.persist && !existingSummaryIds.has(key)) {
        const summary = service.add({
          userId,
          content,
          type: "episodic",
          layer: "reflection",
          source: { kind: mode === "provider" ? "agent" : "tool", confidence: generated?.confidence ?? 0.76 },
          tags: ["timeline-summary", period.granularity, period.period],
          entities: [...new Set(memories.flatMap((memory) => memory.entities))].slice(0, 12),
          timestamp: now.toISOString(),
          metadata: {
            summaryOf: memories.map((memory) => memory.id),
            period: period.period,
            granularity: period.granularity,
            dreamJob: "timeline-summary",
            summaryMode: mode,
            summaryStyle: options.style ?? "concise",
            generatedAt: now.toISOString(),
            provider: generated?.metadata?.provider
          }
        });
        summaryMemoryId = summary.id;
        existingSummaryIds.add(key);
      }
      summaries.push({
        period: period.period,
        granularity: period.granularity,
        content,
        memoryIds: memories.map((memory) => memory.id),
        summaryMemoryId,
        confidence: generated?.confidence ?? 0.76,
        mode
      });
    }
    service.recordAudit("reflect.run", { userId, metadata: { resource: "timeline-summary", granularity, persisted: Boolean(options.persist), summaries: summaries.length } });
    service.persist();
    return { userId, generatedAt: now.toISOString(), granularity, persisted: Boolean(options.persist), summaries };
  }

export function temporalQuery(service: any, userId: string, options: { after?: Date | string; before?: Date | string } = {}): TemporalQueryReport {
    const after = options.after ? new Date(options.after) : undefined;
    const before = options.before ? new Date(options.before) : undefined;
    const events = (service.timeline(userId).events as TimelineReport["events"]).filter((event) => {
      return intervalOverlaps(event, after, before);
    });
    const byEntity = new Map<string, { memoryIds: string[]; dates: Date[] }>();
    for (const event of events) {
      for (const entity of event.entities) {
        const current = byEntity.get(entity) ?? { memoryIds: [], dates: [] };
        current.memoryIds.push(event.memoryId);
        current.dates.push(new Date(event.eventAt));
        byEntity.set(entity, current);
      }
    }
    return {
      userId,
      after: options.after,
      before: options.before,
      events,
      changedEntities: [...byEntity.entries()].map(([entity, value]) => ({
        entity,
        memoryIds: [...new Set(value.memoryIds)],
        firstAt: new Date(Math.min(...value.dates.map((date) => date.getTime()))).toISOString(),
        lastAt: new Date(Math.max(...value.dates.map((date) => date.getTime()))).toISOString()
      }))
    };
  }

export function behavioralPatterns(service: any, userId: string): BehavioralPatternReport {
    const memories = (service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt);
    const generated = memories
      .filter((memory) => memory.metadata.dreamJob === "behavior-pattern")
      .map((memory) => ({
        key: String(memory.metadata.pattern ?? memory.id),
        label: memory.content,
        support: Array.isArray(memory.metadata.summaryOf) ? memory.metadata.summaryOf.length : 1,
        memoryIds: Array.isArray(memory.metadata.summaryOf) ? memory.metadata.summaryOf.map(String) : [memory.id],
        confidence: Number(memory.metadata.confidence ?? memory.trust),
        cadence: String(memory.metadata.recurrenceWindow ?? "observed-period"),
        pendingReview: (memory.metadata.patternReview as { status?: string } | undefined)?.status === "pending",
        lastObservedAt: String(memory.metadata.lastObservedAt ?? memory.createdAt.toISOString()),
        falsePositiveRisk: Number(memory.metadata.falsePositiveRisk ?? 0.2)
      }));
    const mined = [...mineRecurringPatterns(memories), ...mineRecurringSequences(memories)];
    return { userId, patterns: [...generated, ...mined].sort((a, b) => b.confidence - a.confidence || b.support - a.support) };
  }

export function adaptiveDreamPolicy(service: any, userId: string): AdaptiveDreamPolicyReport {
    const health = service.health(userId);
    const active = (service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt);
    const reviewMemories = active.filter((memory) => memory.trust < 0.55 || memory.tags.includes("needs-review") || memory.source.kind === "transcript").length;
    const feedback = (service.feedbackEvents as Array<{ userId?: string; kind: string }>).filter((event) => !event.userId || event.userId === userId);
    const negativeFeedback = feedback.filter((event) => event.kind === "wrong" || event.kind === "never_include" || event.kind === "stale" || event.kind === "reject_pattern").length;
    const writesSinceDream = service.userMaintenance(userId).writesSinceDream;
    const pressure = Math.min(1, reviewMemories / Math.max(1, active.length) + negativeFeedback / Math.max(4, feedback.length || 1) + (1 - health.healthScore));
    const recommended = {
      intervalHours: Math.max(1, Math.round(service.autoDream.intervalHours * (pressure > 0.75 ? 0.45 : pressure > 0.45 ? 0.7 : 1.15))),
      writeThreshold: Math.max(3, Math.round(service.autoDream.writeThreshold * (pressure > 0.75 ? 0.45 : pressure > 0.45 ? 0.7 : 1.1))),
      summaryDepth: pressure > 0.65 ? 5 : pressure > 0.35 ? 4 : 3,
      fadeAfterDays: pressure > 0.65 ? 30 : 45,
      archiveAfterDays: pressure > 0.65 ? 60 : 90
    };
    const rationale = [
      `health=${health.healthScore.toFixed(2)}`,
      `${reviewMemories} active memories need review`,
      `${negativeFeedback}/${feedback.length} feedback events are negative`,
      `${writesSinceDream} writes since last dream`
    ];
    return {
      userId,
      generatedAt: new Date().toISOString(),
      recommended,
      signals: {
        healthScore: health.healthScore,
        activeMemories: active.length,
        reviewMemories,
        feedbackVolume: feedback.length,
        negativeFeedback,
        writesSinceDream,
        searches: service.metrics.searches
      },
      rationale
    };
  }

export function generateObservations(service: any, userId: string, options: { style?: ObservationReport["style"]; persist?: boolean; limit?: number } = {}): ObservationReport {
    const now = new Date();
    const style = options.style ?? "concise";
    const clusters = observationClusters((service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt && memory.layer !== "reflection")).slice(0, options.limit ?? 4);
    const observations: ObservationReport["observations"] = [];
    for (const cluster of clusters) {
      const generated = service.defaultSummarizer?.summarize({ theme: cluster.label, memories: cluster.memories, now });
      const providerContent = generated?.content?.trim();
      const content = providerContent || deterministicObservation(cluster.label, cluster.memories, style);
      let observationMemoryId: string | undefined;
      if (options.persist) {
        const memory = service.add({
          userId,
          content,
          type: "reference",
          layer: "reflection",
          source: { kind: providerContent ? "agent" : "tool", confidence: generated?.confidence ?? 0.78 },
          tags: ["observation", style, cluster.label],
          entities: [cluster.label],
          metadata: {
            summaryOf: cluster.memories.map((memory) => memory.id),
            observation: true,
            observationStyle: style,
            generatedAt: now.toISOString(),
            summaryMode: providerContent ? "provider" : "deterministic",
            provider: generated?.metadata?.provider
          }
        });
        observationMemoryId = memory.id;
      }
      observations.push({
        content,
        memoryIds: cluster.memories.map((memory) => memory.id),
        citations: cluster.memories.map(citationFor),
        confidence: generated?.confidence ?? Math.min(0.92, 0.55 + cluster.memories.length * 0.08),
        mode: providerContent ? "provider" : "deterministic",
        observationMemoryId
      });
    }
    service.recordAudit("reflect.run", { userId, metadata: { resource: "observations", style, persisted: Boolean(options.persist), observations: observations.length } });
    service.persist();
    return { userId, generatedAt: now.toISOString(), style, persisted: Boolean(options.persist), observations };
  }

export function predictionReport(service: any, userId: string, options: { query?: string; limit?: number } = {}): PredictionReport {
    const patterns = service.behavioralPatterns(userId).patterns.slice(0, options.limit ?? 4);
    const predictions = patterns.map((pattern: BehavioralPatternReport["patterns"][number]) => ({
      label: pattern.label,
      confidence: pattern.confidence,
      reason: `${pattern.cadence} with ${pattern.support} supporting memories`,
      memoryIds: pattern.memoryIds,
      suggestedQuery: options.query ?? pattern.label.replace(/^Inferred pattern:\s*/i, "").slice(0, 160)
    }));
    const prefetchQuery = predictions[0]?.suggestedQuery ?? options.query ?? "recent memory workflow";
    const prefetch = service.search({ userId, query: prefetchQuery, limit: 5, includePrivate: true, expandQuery: true });
    const now = Date.now();
    const anomalies: PredictionReport["anomalies"] = [];
    for (const memory of (service.store.list(userId) as Memory[]).filter((item) => !item.archivedAt)) {
      const ageDays = (now - memory.createdAt.getTime()) / 86_400_000;
      if (memory.metadata.patternReview && (memory.metadata.patternReview as { status?: string }).status === "pending") anomalies.push({ kind: "pending_pattern_review", memoryId: memory.id, message: `Pattern ${memory.id} awaits operator review.` });
      if (ageDays < 14 && memory.trust < 0.55) anomalies.push({ kind: "low_trust_recent_memory", memoryId: memory.id, message: `Recent memory ${memory.id} has low trust.` });
      if (ageDays > 30 && !memory.temporal.lastConfirmedAt && memory.pinned) anomalies.push({ kind: "missing_recent_confirmation", memoryId: memory.id, message: `Pinned memory ${memory.id} has no recent confirmation.` });
    }
    return { userId, generatedAt: new Date().toISOString(), predictions, prefetch, anomalies: anomalies.slice(0, 12) };
  }
