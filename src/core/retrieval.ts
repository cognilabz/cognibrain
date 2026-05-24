import { normalizeRetrievalWeights } from "./config";
import { activateGraph } from "./graphReasoning";
import { clamp, MemoryStore } from "./store";
import { cosineLike, estimateTokens, keywordCoverage, tokenize } from "./text";
import type { Memory, RetrievalWeights, SearchOptions, SearchResult } from "./types";

const STALE_DAYS = 30;

export class RetrievalEngine {
  constructor(private readonly store: MemoryStore, private readonly defaultWeights?: Partial<RetrievalWeights>) {}

  search(options: SearchOptions): SearchResult[] {
    const now = options.now ?? new Date();
    const queryTokens = tokenize(options.query);
    const queryEntities = new Set(queryTokens);
    const temporalConstraint = parseTemporalConstraint(options.query, now);
    const userIds = new Set([options.userId, ...((options as SearchOptions & { linkedUserIds?: string[] }).linkedUserIds ?? [])]);
    const sharedBrainIds = new Set(options.brainIds ?? (options.brainId ? [options.brainId] : []));
    const candidates = this.store.list().filter((memory) => {
      const directOrLinkedUser = userIds.has(memory.userId);
      const sharedBrainCandidate = Boolean(options.includeSharedBrains && memory.brainId && sharedBrainIds.has(memory.brainId));
      if (!directOrLinkedUser && !sharedBrainCandidate) return false;
      if (options.brainId && memory.brainId && memory.brainId !== options.brainId) return false;
      if (options.brainIds?.length && memory.brainId && !sharedBrainIds.has(memory.brainId)) return false;
      if (options.sourceId && memory.sourceId && memory.sourceId !== options.sourceId) return false;
      if (!options.includeArchived && memory.archivedAt) return false;
      if (options.agentId && memory.agentId && memory.agentId !== options.agentId) return false;
      if (!scopeMatches(memory, options)) return false;
      if (!consentAllows(memory, options, now)) return false;
      if (!temporalAllows(memory, temporalConstraint)) return false;
      if (options.filters?.type && memory.type !== options.filters.type) return false;
      if (options.filters?.layer && memory.layer !== options.filters.layer) return false;
      if (options.filters?.minTrust && memory.trust < options.filters.minTrust) return false;
      if (options.filters?.tags?.length && !options.filters.tags.every((tag) => memory.tags.includes(tag))) return false;
      return true;
    });

    const queryText = queryTokens.join(" ");
    const weights = normalizeRetrievalWeights({ ...this.defaultWeights, ...(options.weights ?? {}) });
    const graphBoosts = this.graphBoosts(candidates, queryTokens, queryText, options);
    const results = candidates
      .map((memory) => {
        const graph = graphBoosts.get(memory.id);
        return this.score(memory, queryTokens, queryEntities, queryText, now, graph?.score ?? 0, graph?.paths ?? [], weights);
      })
      .filter((result) => result.score > 0.05 && relevanceEvidence(result) > 0.08)
      .sort((a, b) => b.score - a.score)
      .filter((result, _index, all) => !isSuppressedContradiction(result, all))
      .slice(0, options.limit ?? 8);

    const reranked = options.reranker ? options.reranker.rerank({ query: options.query, results, now }) : heuristicRerank(options.query, results);
    const verified = options.verifier ? options.verifier.verify({ query: options.query, results: reranked, now }) : heuristicVerify(options.query, reranked);

    for (const result of verified) this.store.markAccessed(result.memory.id);
    return verified;
  }

  contextPack(results: SearchResult[], tokenBudget = 900): string {
    const lines: string[] = [];
    let spent = 0;
    for (const result of results) {
      if (result.decision === "exclude") continue;
      const stale = result.stale ? " stale=true" : "";
      const decision = result.decision && result.decision !== "include" ? ` decision=${result.decision}` : "";
      const line = `[${result.memory.id}] trust=${result.memory.trust.toFixed(2)} score=${result.score.toFixed(2)}${stale}${decision} ${result.memory.content}`;
      const tokens = estimateTokens(line);
      if (spent + tokens > tokenBudget) break;
      spent += tokens;
      lines.push(line);
    }
    return lines.join("\n");
  }

  private score(
    memory: Memory,
    queryTokens: string[],
    queryEntities: Set<string>,
    queryText: string,
    now: Date,
    graph: number,
    graphPaths: string[],
    weights: RetrievalWeights
  ): SearchResult {
    const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")}`);
    const semantic = cosineLike(queryTokens, memoryTokens);
    const keyword = keywordCoverage(queryTokens, memoryTokens);
    const entityHits = memory.entities.filter((entity) => entityMatchesQuery(entity, queryEntities, queryText)).length;
    const entity = memory.entities.length ? clamp(entityHits / Math.min(4, memory.entities.length)) : 0;
    const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
    const ageDays = Math.max(0, (now.getTime() - eventAt.getTime()) / 86_400_000);
    const temporal = memory.pinned ? 1 : Math.exp(-ageDays / 180);
    const behavioral = behavioralRelevance(memory, queryTokens, queryText, eventAt, now);
    const trust = memory.trust * memory.importance;
    const access = clamp(Math.log1p(memory.accessCount) / 8);
    const score = clamp(
      semantic * weights.semantic +
        keyword * weights.keyword +
        entity * weights.entity +
        temporal * weights.temporal +
        behavioral * weights.behavioral +
        trust * weights.trust +
        graph * weights.graph +
        access * weights.access
    );

    return {
      memory,
      score,
      initialScore: score,
      decision: "include",
      explanation: explainSignals({ semantic, keyword, entity, temporal, behavioral, trust, graph, access }, graphPaths),
      signals: { semantic, keyword, entity, temporal, behavioral, trust, graph, access },
      graphPaths,
      citation: citationFor(memory),
      stale: ageDays > STALE_DAYS && !memory.pinned
    };
  }

  private graphBoosts(candidates: Memory[], queryTokens: string[], queryText: string, options: SearchOptions): Map<string, { score: number; paths: string[] }> {
    const boosts = new Map<string, { score: number; paths: string[] }>();
    const entityFrequency = new Map<string, number>();
    const entityToMemoryIds = new Map<string, string[]>();
    const relationToMemoryIds = new Map<string, string[]>();
    const queryEntities = new Set(queryTokens);
    for (const memory of candidates) {
      for (const entity of new Set(memory.entities)) {
        entityFrequency.set(entity, (entityFrequency.get(entity) ?? 0) + 1);
        const ids = entityToMemoryIds.get(entity) ?? [];
        ids.push(memory.id);
        entityToMemoryIds.set(entity, ids);
      }
      for (const relation of memory.relations) {
        if (options.relationTypes?.length && !options.relationTypes.includes(relation.type)) continue;
        const key = relation.targetEntity ? `${relation.type}:${relation.targetEntity}` : undefined;
        if (!key) continue;
        const ids = relationToMemoryIds.get(key) ?? [];
        ids.push(memory.id);
        relationToMemoryIds.set(key, ids);
      }
    }
    const commonEntityThreshold = Math.max(3, Math.ceil(candidates.length * 0.12));
    const matched = candidates.filter((memory) => {
      const tokens = tokenize(`${memory.content} ${memory.entities.join(" ")}`);
      return keywordCoverage(queryTokens, tokens) > 0;
    });
    for (const direct of matched) {
      const linkedCounts = new Map<string, number>();
      const linkedPaths = new Map<string, string[]>();
      for (const entity of direct.entities) {
        if ((entityFrequency.get(entity) ?? 0) > commonEntityThreshold) continue;
        if (isCompoundEntity(entity) && !entityMatchesQuery(entity, queryEntities, queryText)) continue;
        for (const id of entityToMemoryIds.get(entity) ?? []) {
          if (id === direct.id) continue;
          linkedCounts.set(id, (linkedCounts.get(id) ?? 0) + 1);
          addPath(linkedPaths, id, `shared entity: ${entity}`);
        }
      }
      for (const relation of direct.relations) {
        if (options.relationTypes?.length && !options.relationTypes.includes(relation.type)) continue;
        if (!relation.targetEntity || !entityMatchesQuery(relation.targetEntity, queryEntities, queryText)) continue;
        for (const id of relationToMemoryIds.get(`${relation.type}:${relation.targetEntity}`) ?? []) {
          if (id === direct.id) continue;
          linkedCounts.set(id, (linkedCounts.get(id) ?? 0) + 1.25);
          addPath(linkedPaths, id, `${relation.type}: ${relation.targetEntity}`);
        }
      }
      for (const [id, count] of linkedCounts) {
        const existing = boosts.get(id);
        boosts.set(id, {
          score: Math.max(existing?.score ?? 0, clamp(count / 3)),
          paths: [...(existing?.paths ?? []), ...(linkedPaths.get(id) ?? [])].slice(0, 4)
        });
      }
    }
    const activation = activateGraph(candidates, queryText, { maxDepth: options.graphDepth ?? 2, relationTypes: options.relationTypes, limit: Math.max(10, candidates.length) });
    for (const node of activation.ranked) {
      const memoryIds = node.memoryId ? [node.memoryId] : candidates.filter((memory) => memory.entities.includes(node.label.toLowerCase())).map((memory) => memory.id);
      for (const id of memoryIds) {
        const existing = boosts.get(id);
        boosts.set(id, {
          score: Math.max(existing?.score ?? 0, clamp(node.score)),
          paths: [...(existing?.paths ?? []), ...node.explanation].slice(0, 4)
        });
      }
    }
    return boosts;
  }
}

function parseTemporalConstraint(query: string, now: Date): { after?: Date; before?: Date } {
  const normalized = query.toLowerCase();
  const iso = normalized.match(/\b(20\d{2})(?:-(\d{2})(?:-(\d{2}))?)?\b/);
  const date = iso ? new Date(Date.UTC(Number(iso[1]), Number(iso[2] ?? "1") - 1, Number(iso[3] ?? "1"))) : undefined;
  if (date && /\b(before|vor)\b/.test(normalized)) return { before: date };
  if (date && /\b(after|since|nach|seit)\b/.test(normalized)) return { after: date };
  if (/\blast week|letzte woche\b/.test(normalized)) {
    const before = new Date(now);
    const after = new Date(now);
    after.setUTCDate(after.getUTCDate() - 7);
    return { after, before };
  }
  return {};
}

function temporalAllows(memory: Memory, constraint: { after?: Date; before?: Date }): boolean {
  if (!constraint.after && !constraint.before) return true;
  const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
  if (constraint.after && eventAt < constraint.after) return false;
  if (constraint.before && eventAt >= constraint.before) return false;
  return true;
}

function entityMatchesQuery(entity: string, queryEntities: Set<string>, queryText: string): boolean {
  if (queryEntities.has(entity) || queryText.includes(entity)) return true;
  const entityTokens = tokenize(entity);
  return entityTokens.length === 1 && queryEntities.has(entityTokens[0]);
}

function isCompoundEntity(entity: string): boolean {
  return /\s/.test(entity.trim());
}

function behavioralRelevance(memory: Memory, queryTokens: string[], queryText: string, eventAt: Date, now: Date): number {
  const queryWeekday = weekdayInQuery(queryText) ?? (/\btoday|heute\b/.test(queryText) ? weekdayName(now) : undefined);
  const eventWeekday = weekdayName(eventAt);
  const memoryText = `${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`.toLowerCase();
  const coverage = keywordCoverage(queryTokens, tokenize(memoryText));
  const cadence = typeof memory.metadata.cadence === "string" ? memory.metadata.cadence : typeof memory.metadata.recurrenceWindow === "string" ? memory.metadata.recurrenceWindow : undefined;
  const isPattern = memory.metadata.dreamJob === "behavior-pattern" || memory.metadata.patternType === "behavioral";
  const patternApproved = (memory.metadata.patternReview as { status?: string } | undefined)?.status === "approved";
  const patternPending = (memory.metadata.patternReview as { status?: string } | undefined)?.status === "pending";
  let score = 0;
  if (queryWeekday && eventWeekday === queryWeekday && coverage > 0) score = Math.max(score, 0.45 + coverage * 0.35);
  if (queryWeekday && cadence?.includes(queryWeekday)) score = Math.max(score, 0.72);
  if (isPattern && coverage > 0) score = Math.max(score, patternApproved ? 0.95 : patternPending ? 0.68 : 0.78);
  if (isPattern && queryWeekday && cadence?.includes(queryWeekday)) score = Math.max(score, patternApproved ? 1 : 0.82);
  return clamp(score);
}

function weekdayInQuery(queryText: string): string | undefined {
  for (const weekday of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    if (queryText.includes(weekday)) return weekday;
  }
  const german: Record<string, string> = {
    montag: "monday",
    dienstag: "tuesday",
    mittwoch: "wednesday",
    donnerstag: "thursday",
    freitag: "friday",
    samstag: "saturday",
    sonntag: "sunday"
  };
  for (const [word, weekday] of Object.entries(german)) if (queryText.includes(word)) return weekday;
  return undefined;
}

function weekdayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
}

function scopeMatches(memory: Memory, options: SearchOptions): boolean {
  if (options.scopeMode === "all") return true;
  if (options.sessionId && memory.sessionId && memory.sessionId !== options.sessionId) return false;
  if (options.appId && memory.appId && memory.appId !== options.appId) return false;
  if (options.orgId && memory.orgId && memory.orgId !== options.orgId) return false;
  if (options.projectId && memory.projectId && memory.projectId !== options.projectId) return false;
  if (options.runId && memory.runId && memory.runId !== options.runId) return false;
  if (options.scopeMode === "session") return !memory.sessionId || memory.sessionId === options.sessionId;
  if (options.scopeMode === "app") return !memory.appId || memory.appId === options.appId;
  if (options.scopeMode === "org") return !memory.orgId || memory.orgId === options.orgId;
  if (options.scopeMode === "project") return !memory.projectId || memory.projectId === options.projectId;
  return true;
}

function consentAllows(memory: Memory, options: SearchOptions, now: Date): boolean {
  const retentionUntil = memory.consent.retentionUntil ? new Date(memory.consent.retentionUntil) : undefined;
  if (retentionUntil && retentionUntil.getTime() <= now.getTime()) return false;
  const linkedUserIds = (options as SearchOptions & { linkedUserIds?: string[] }).linkedUserIds ?? [];
  const directOrLinkedUser = memory.userId === options.userId || linkedUserIds.includes(memory.userId);
  if (memory.consent.visibility === "private") return directOrLinkedUser && options.includePrivate === true;
  if (memory.consent.visibility === "user") return directOrLinkedUser;
  if (memory.consent.visibility === "org") return !!options.orgId && memory.orgId === options.orgId;
  return true;
}

function addPath(paths: Map<string, string[]>, id: string, path: string): void {
  const current = paths.get(id) ?? [];
  current.push(path);
  paths.set(id, current);
}

function explainSignals(signals: SearchResult["signals"], graphPaths: string[]): string[] {
  const entries = Object.entries(signals)
    .filter(([, value]) => typeof value === "number" && value > 0.05)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3)
    .map(([name, value]) => `${name} ${Number(value).toFixed(2)}`);
  if (graphPaths.length) entries.push(`graph ${graphPaths[0]}`);
  return entries;
}

function heuristicVerify(query: string, results: SearchResult[]): SearchResult[] {
  const queryTokens = tokenize(query);
  return results.map((result) => {
    const coverage = keywordCoverage(queryTokens, tokenize(result.memory.content));
    if (result.stale && coverage < 0.2) {
      return { ...result, decision: "warn" as const, explanation: [...(result.explanation ?? []), "stale low-overlap candidate"] };
    }
    if (coverage === 0 && result.signals.entity === 0 && result.signals.graph === 0) {
      return { ...result, decision: "exclude" as const, explanation: [...(result.explanation ?? []), "no direct relevance after verification"] };
    }
    if (typeof result.memory.metadata.contradiction === "string") {
      return { ...result, decision: "review" as const, explanation: [...(result.explanation ?? []), "contradiction marker present"] };
    }
    return result;
  });
}

function heuristicRerank(query: string, results: SearchResult[]): SearchResult[] {
  const queryTokens = tokenize(query);
  return [...results]
    .map((result) => {
      const coverage = keywordCoverage(queryTokens, tokenize(`${result.memory.content} ${result.memory.entities.join(" ")}`));
      const verifiedScore = clamp(result.score * 0.72 + coverage * 0.18 + result.memory.trust * 0.1);
      return {
        ...result,
        score: verifiedScore,
        explanation: [...(result.explanation ?? []), `rerank coverage ${coverage.toFixed(2)}`]
      };
    })
    .sort((a, b) => b.score - a.score);
}

function relevanceEvidence(result: SearchResult): number {
  return result.signals.semantic + result.signals.keyword + result.signals.entity + result.signals.graph + (result.signals.behavioral ?? 0);
}

function isSuppressedContradiction(result: SearchResult, all: SearchResult[]): boolean {
  const text = result.memory.content.toLowerCase();
  if (!text.includes("never confirmed") && !text.includes("transcript")) return false;
  const entities = new Set(result.memory.entities);
  return all.some((other) => {
    if (other.memory.id === result.memory.id) return false;
    if (other.memory.trust <= result.memory.trust) return false;
    if (!other.memory.entities.some((entity) => entities.has(entity))) return false;
    const otherText = other.memory.content.toLowerCase();
    return otherText.includes("confirmed") || otherText.includes("does not") || otherText.includes("correction");
  });
}

export function citationFor(memory: Memory): string {
  const source = memory.source.uri ?? memory.source.kind;
  const lines = memory.source.lineStart ? `:${memory.source.lineStart}${memory.source.lineEnd ? `-${memory.source.lineEnd}` : ""}` : "";
  return `${source}${lines}`;
}
