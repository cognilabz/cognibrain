import { normalizeRetrievalWeights } from "./config";
import { cosineVector, embeddingsDisabled } from "./embeddings";
import { codebaseScopeMatches, getEngineeringMetadata } from "./engineeringMemory";
import { activateGraph } from "./graphReasoning";
import { clamp, MemoryStore } from "./store";
import { bestConceptMatch, conceptScore } from "./semantic";
import { cosineLike, estimateTokens, keywordCoverage, tokenize } from "./text";
import type { EvidenceJudgement, LexicalScoreProvider, Memory, MemoryClaim, RetrievalWeights, SearchOptions, SearchResult } from "./types";

const STALE_DAYS = 30;
const INJECTION_CONFIDENCE_THRESHOLD = 0.5;

export class RetrievalEngine {
  constructor(private readonly store: MemoryStore, private readonly defaultWeights?: Partial<RetrievalWeights>) {}

  search(options: SearchOptions): SearchResult[] {
    const now = options.now ?? new Date();
    const expandedQueries = queryVariants(options);
    const expandedQueryText = expandedQueries.join(" ");
    const queryTokens = tokenize(expandedQueryText);
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
      if (memory.beliefState === "retracted") return false;
      if (memory.beliefState === "superseded" && !options.includeArchived) return false;
      if (memory.beliefState === "contradicted" && !options.includeArchived) return false;
      if (options.agentId && memory.agentId && memory.agentId !== options.agentId) return false;
      if (!scopeMatches(memory, options)) return false;
      if (!consentAllows(memory, options, now)) return false;
      if (!temporalAllows(memory, temporalConstraint)) return false;
      if (options.filters?.type && memory.type !== options.filters.type) return false;
      if (options.filters?.layer && memory.layer !== options.filters.layer) return false;
      const engineeringKind = getEngineeringMetadata(memory)?.kind;
      if (options.filters?.engineeringKind && engineeringKind !== options.filters.engineeringKind) return false;
      if (options.filters?.engineeringKinds?.length && (!engineeringKind || !options.filters.engineeringKinds.includes(engineeringKind))) return false;
      if (options.filters?.minTrust && memory.trust < options.filters.minTrust) return false;
      if (options.filters?.tags?.length && !options.filters.tags.every((tag) => memory.tags.includes(tag))) return false;
      if (!codebaseScopeMatches(memory, options.codebaseScope).matches) return false;
      return true;
    });

    const queryText = queryTokens.join(" ");
    const mode = options.mode ?? "hybrid";
    const weights = weightsForMode(mode, normalizeRetrievalWeights({ ...this.defaultWeights, ...(options.weights ?? {}) }));
    const graphBoosts = this.graphBoosts(candidates, queryTokens, queryText, options);
    const bm25 = bm25Index(candidates, queryTokens);
    const lexical = lexicalProviderScores(options.lexicalProvider, expandedQueryText, candidates, options.limit);
    const vectorSemantic = vectorSemanticScores(options, queryText, candidates);
    const scored = candidates
      .map((memory) => {
        const graph = graphBoosts.get(memory.id);
        const vectorScore = vectorSemantic.get(memory.id);
        const result = this.score(memory, queryTokens, queryEntities, queryText, now, graph?.score ?? 0, graph?.paths ?? [], weights, mode, expandedQueries, bm25, lexical, vectorScore, vectorScore === undefined ? undefined : options.embeddingProvider?.id);
        const scope = codebaseScopeMatches(memory, options.codebaseScope);
        return scope.warnings.length
          ? { ...result, decision: "warn" as const, explanation: [...(result.explanation ?? []), ...scope.warnings], stale: true }
          : result;
      })
      .filter((result) => result.score > 0.05 && relevanceEvidence(result) > 0.08)
      .sort((a, b) => b.score - a.score)
      .filter((result, _index, all) => !isSuppressedContradiction(result, all));

    const results = fuseResults(scored, mode).slice(0, options.limit ?? 8);

    const reranked = options.reranker ? options.reranker.rerank({ query: options.query, results, now }) : heuristicRerank(options.query, results);
    const contradicted = applyContradictionDecisions(reranked);
    const verified = options.verifier ? options.verifier.verify({ query: options.query, results: contradicted, now }) : heuristicVerify(options.query, contradicted);
    const evidenceJudged = options.evidenceJudge ? applyEvidenceJudgement(options.evidenceJudge.judgeEvidence({ query: options.query, results: verified, now }), verified) : verified;
    const calibrated = calibrateResults(evidenceJudged);

    for (const result of calibrated) this.store.markAccessed(result.memory.id);
    return calibrated;
  }

  contextPack(results: SearchResult[], tokenBudget = 900): string {
    const lines: string[] = [];
    let spent = 0;
    for (const result of results) {
      if (result.decision === "exclude") continue;
      if (result.unsafeToInject) continue;
      if ((result.confidence ?? 1) < INJECTION_CONFIDENCE_THRESHOLD) continue;
      const stale = result.stale ? " stale=true" : "";
      const decision = result.decision && result.decision !== "include" ? ` decision=${result.decision}` : "";
      const confidence = typeof result.confidence === "number" ? ` confidence=${result.confidence.toFixed(2)}` : "";
      const unsafe = result.unsafeToInject ? " unsafe=true" : "";
      const line = `[${result.memory.id}] trust=${result.memory.trust.toFixed(2)} score=${result.score.toFixed(2)}${confidence}${unsafe}${stale}${decision} ${result.memory.content}`;
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
    weights: RetrievalWeights,
    mode: NonNullable<SearchOptions["mode"]>,
    expandedQueries: string[],
    bm25: Map<string, number>,
    lexical: Map<string, { score: number; explanation?: string; providerId?: string }>,
    vectorSemantic?: number,
    vectorProviderId?: string
  ): SearchResult {
    const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")}`);
    const semantic = vectorSemantic ?? cosineLike(queryTokens, memoryTokens);
    const lexicalScore = lexical.get(memory.id);
    const keyword = Math.max(keywordCoverage(queryTokens, memoryTokens), bm25.get(memory.id) ?? 0, lexicalScore?.score ?? 0);
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
      explanation: [
        ...explainSignals({ semantic, keyword, entity, temporal, behavioral, trust, graph, access }, graphPaths),
        ...(lexicalScore?.providerId ? [`lexical ${lexicalScore.providerId}${lexicalScore.explanation ? ` ${lexicalScore.explanation}` : ""}`] : []),
        ...(vectorProviderId ? [`vector ${vectorProviderId}`] : []),
        ...(expandedQueries.length > 1 ? [`expanded ${expandedQueries.slice(1, 3).join(" | ")}`] : []),
        `mode ${mode}`
      ],
      retrievalMode: mode,
      expandedQueries: expandedQueries.length > 1 ? expandedQueries : undefined,
      fusion: { strategy: mode, scoreBeforeFusion: score, components: { semantic, keyword, entity, temporal, behavioral, trust, graph, access } },
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

function applyEvidenceJudgement(judgement: EvidenceJudgement, results: SearchResult[]): SearchResult[] {
  const decisions = new Map((judgement.decisions ?? []).map((decision) => [decision.id, decision]));
  return results.map((result) => {
    const decision = decisions.get(result.memory.id);
    const providerDecision = decision?.decision ?? (judgement.answerable ? undefined : "exclude");
    return {
      ...result,
      confidence: decision?.confidence ?? result.confidence,
      decision: providerDecision ?? result.decision,
      unsafeToInject: result.unsafeToInject || !judgement.answerable,
      evidence: judgement,
      explanation: [
        ...(result.explanation ?? []),
        `provider evidence: ${judgement.answerable ? "answerable" : "not answerable"}${judgement.reason ? ` ${judgement.reason}` : ""}`,
        ...(decision?.reason ? [`provider evidence memory: ${decision.reason}`] : [])
      ]
    };
  });
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

function queryVariants(options: SearchOptions): string[] {
  const variants = [options.query, ...((options.expandQuery ? deterministicQueryExpansions(options.query) : [])), ...(options.queryExpansions ?? [])];
  return [...new Set(variants.map((variant) => variant.trim()).filter(Boolean))].slice(0, 12);
}

function deterministicQueryExpansions(query: string): string[] {
  const groups = [
    { id: "cli", examples: ["cli", "command line", "terminal", "shell"] },
    { id: "ui", examples: ["ui", "dashboard", "frontend", "operator console"] },
    { id: "bug", examples: ["bug", "issue", "defect", "regression"] },
    { id: "memory", examples: ["memory", "recall", "context", "knowledge"] },
    { id: "auth", examples: ["auth", "login", "session", "identity"] },
    { id: "database", examples: ["database", "storage", "persistence", "store"] },
    { id: "sync", examples: ["sync", "replay", "offline", "replication"] },
    { id: "release", examples: ["release", "launch", "deployment", "ship"] }
  ];
  const expansions = new Set<string>();
  for (const group of groups) {
    const matched = bestConceptMatch(query, [{ id: group.id, examples: group.examples, threshold: 0.72 }]);
    if (!matched?.matchedExample) continue;
    for (const term of group.examples) expansions.add(replaceCaseInsensitiveOnce(query, matched.matchedExample, term));
    expansions.add(`${query} ${group.examples.join(" ")}`);
  }
  return [...expansions];
}

function weightsForMode(mode: NonNullable<SearchOptions["mode"]>, weights: RetrievalWeights): RetrievalWeights {
  if (mode === "graph" || mode === "path") return normalizeRetrievalWeights({ ...weights, graph: weights.graph + 0.35, entity: weights.entity + 0.12 });
  if (mode === "rrf") return normalizeRetrievalWeights({ ...weights, semantic: weights.semantic + 0.05, keyword: weights.keyword + 0.05, graph: weights.graph + 0.08 });
  return weights;
}

function fuseResults(results: SearchResult[], mode: NonNullable<SearchOptions["mode"]>): SearchResult[] {
  if (mode !== "rrf") return results.map((result, index) => ({ ...result, fusion: { ...(result.fusion ?? { strategy: mode }), strategy: mode, rank: index + 1 } }));
  const signalKeys: Array<keyof RetrievalWeights> = ["semantic", "keyword", "entity", "temporal", "behavioral", "trust", "graph", "access"];
  const totals = new Map<string, number>();
  for (const key of signalKeys) {
    const ranked = [...results].sort((a, b) => Number(b.signals[key] ?? 0) - Number(a.signals[key] ?? 0));
    for (const [index, result] of ranked.entries()) {
      if (Number(result.signals[key] ?? 0) <= 0) continue;
      totals.set(result.memory.id, (totals.get(result.memory.id) ?? 0) + 1 / (60 + index + 1));
    }
  }
  return [...results]
    .map((result) => ({ ...result, score: clamp((totals.get(result.memory.id) ?? 0) * 8), fusion: { ...(result.fusion ?? { strategy: mode }), strategy: mode, scoreBeforeFusion: result.score } }))
    .sort((a, b) => b.score - a.score)
    .map((result, index) => ({ ...result, fusion: { ...(result.fusion ?? { strategy: mode }), strategy: mode, rank: index + 1 }, explanation: [...(result.explanation ?? []), `rrf rank ${index + 1}`] }));
}

function applyContradictionDecisions(results: SearchResult[]): SearchResult[] {
  return results.map((result) => {
    const conflict = results.find((other) => other.memory.id !== result.memory.id && isLikelyContradiction(result.memory, other.memory) && other.memory.trust >= result.memory.trust);
    if (!conflict) return result;
    const action = conflict.memory.trust - result.memory.trust > 0.08 ? "exclude" : "review";
    return {
      ...result,
      decision: action,
      contradiction: { memoryId: conflict.memory.id, reason: "higher-trust conflicting memory selected in same context", action },
      explanation: [...(result.explanation ?? []), `contradiction with ${conflict.memory.id}`]
    };
  });
}

function isLikelyContradiction(a: Memory, b: Memory): boolean {
  if (hasContradictionRelation(a, b) || hasContradictionRelation(b, a)) return true;
  const left = structuredClaim(a);
  const right = structuredClaim(b);
  return Boolean(left && right && left.subject === right.subject && left.predicate === right.predicate && left.object !== right.object);
}

function hasContradictionRelation(source: Memory, target: Memory): boolean {
  return source.relations.some((relation) => relation.type === "contradicts" && (relation.targetId === target.id || (relation.targetEntity && target.entities.includes(relation.targetEntity))));
}

function structuredClaim(memory: Memory): Pick<MemoryClaim, "subject" | "predicate" | "object"> | undefined {
  const claim = memory.metadata.claim as Partial<MemoryClaim> | undefined;
  if (typeof claim?.subject !== "string" || typeof claim.predicate !== "string" || typeof claim.object !== "string") return undefined;
  return { subject: claim.subject.trim().toLowerCase(), predicate: claim.predicate.trim().toLowerCase(), object: claim.object.trim().toLowerCase() };
}

function replaceCaseInsensitiveOnce(value: string, search: string, replacement: string): string {
  const index = value.toLowerCase().indexOf(search.toLowerCase());
  if (index < 0) return value;
  return `${value.slice(0, index)}${replacement}${value.slice(index + search.length)}`;
}

function temporalAllows(memory: Memory, constraint: { after?: Date; before?: Date }): boolean {
  if (!constraint.after && !constraint.before) return true;
  const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
  if (constraint.after && eventAt < constraint.after) return false;
  if (constraint.before && eventAt >= constraint.before) return false;
  return true;
}

function entityMatchesQuery(entity: string, queryEntities: Set<string>, queryText: string): boolean {
  if (queryEntities.has(entity) || conceptScore(queryText, [entity]).score >= 0.9) return true;
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

function bm25Index(memories: Memory[], queryTokens: string[]): Map<string, number> {
  const documents = memories.map((memory) => ({ id: memory.id, tokens: tokenize(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`) }));
  if (!documents.length) return new Map();
  const avgLength = documents.reduce((sum, document) => sum + document.tokens.length, 0) / documents.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const document of documents) {
    for (const token of new Set(document.tokens)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  const raw = new Map<string, number>();
  let max = 0;
  const k1 = 1.2;
  const b = 0.75;
  for (const document of documents) {
    const tf = new Map<string, number>();
    for (const token of document.tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    let score = 0;
    for (const token of new Set(queryTokens)) {
      const count = tf.get(token) ?? 0;
      if (!count) continue;
      const df = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const denominator = count + k1 * (1 - b + b * (document.tokens.length / avgLength));
      score += idf * ((count * (k1 + 1)) / denominator);
    }
    raw.set(document.id, score);
    max = Math.max(max, score);
  }
  return new Map([...raw.entries()].map(([id, score]) => [id, max ? clamp(score / max) : 0]));
}

function lexicalProviderScores(provider: LexicalScoreProvider | undefined, query: string, memories: Memory[], limit?: number): Map<string, { score: number; explanation?: string; providerId?: string }> {
  if (!provider || !memories.length) return new Map();
  const allowed = new Set(memories.map((memory) => memory.id));
  const hits = provider.search({ query, memories, limit: Math.max(limit ?? 8, Math.min(memories.length, 1000)) }).filter((hit) => allowed.has(hit.memoryId));
  const max = hits.reduce((current, hit) => Math.max(current, hit.score), 0);
  return new Map(
    hits.map((hit) => [
      hit.memoryId,
      {
        score: max ? clamp(hit.score / max) : clamp(hit.score),
        explanation: hit.explanation,
        providerId: provider.id
      }
    ])
  );
}

function vectorSemanticScores(options: SearchOptions, queryText: string, memories: Memory[]): Map<string, number> {
  if (!options.embeddingProvider || embeddingsDisabled(options)) return new Map();
  const queryEmbedding = options.embeddingProvider.embed(queryText);
  const raw = new Map<string, number>();
  let max = 0;
  for (const memory of memories) {
    const embedding = options.embeddingProvider.embed(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`);
    const score = cosineVector(queryEmbedding, embedding);
    raw.set(memory.id, score);
    max = Math.max(max, score);
  }
  return new Map([...raw.entries()].map(([id, score]) => [id, max ? clamp(score / max) : 0]));
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
    if (result.memory.beliefState === "contradicted" || result.memory.beliefState === "needs_verification") {
      return { ...result, decision: "review" as const, explanation: [...(result.explanation ?? []), `belief state ${result.memory.beliefState}`] };
    }
    if (result.memory.beliefState === "stale") {
      return { ...result, decision: "warn" as const, explanation: [...(result.explanation ?? []), "belief state stale"] };
    }
    return result;
  });
}

function calibrateResults(results: SearchResult[]): SearchResult[] {
  return results.map((result) => {
    const confidence = calibrateConfidence(result);
    const unsafeToInject = confidence < INJECTION_CONFIDENCE_THRESHOLD || result.decision === "exclude" || result.decision === "review";
    return {
      ...result,
      confidence,
      unsafeToInject,
      explanation: unsafeToInject ? [...(result.explanation ?? []), `calibration unsafe confidence ${confidence.toFixed(2)}`] : [...(result.explanation ?? []), `calibration confidence ${confidence.toFixed(2)}`]
    };
  });
}

function calibrateConfidence(result: SearchResult): number {
  const evidence = clamp(relevanceEvidence(result) / 2.5);
  const trust = clamp(result.memory.trust * result.memory.importance);
  const source = clamp(result.memory.source.confidence);
  const score = clamp(result.score);
  const decisionPenalty = result.decision === "exclude" ? 0.45 : result.decision === "review" ? 0.25 : result.decision === "warn" ? 0.12 : 0;
  const stalePenalty = result.stale ? 0.08 : 0;
  return clamp(score * 0.44 + evidence * 0.2 + trust * 0.2 + source * 0.16 - decisionPenalty - stalePenalty);
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
  if (!hasSuppressionEvidence(result.memory)) return false;
  const entities = new Set(result.memory.entities);
  return all.some((other) => {
    if (other.memory.id === result.memory.id) return false;
    if (other.memory.trust <= result.memory.trust) return false;
    if (!other.memory.entities.some((entity) => entities.has(entity))) return false;
    return hasContradictionRelation(result.memory, other.memory) || hasContradictionRelation(other.memory, result.memory) || claimConflicts(result.memory, other.memory);
  });
}

function hasSuppressionEvidence(memory: Memory): boolean {
  return memory.tags.includes("needs-review") || memory.beliefState === "needs_verification" || Boolean(memory.metadata.needsVerification);
}

function claimConflicts(a: Memory, b: Memory): boolean {
  const left = structuredClaim(a);
  const right = structuredClaim(b);
  return Boolean(left && right && left.subject === right.subject && left.predicate === right.predicate && left.object !== right.object);
}

export function citationFor(memory: Memory): string {
  const source = memory.source.uri ?? memory.source.kind;
  const lines = memory.source.lineStart ? `:${memory.source.lineStart}${memory.source.lineEnd ? `-${memory.source.lineEnd}` : ""}` : "";
  return `${source}${lines}`;
}
