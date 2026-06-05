import { clamp } from "./store";
import { cosineLike, keywordCoverage, tokenize } from "./text";
import type { Memory, RetrievalWeights, SearchResult } from "./types";

export type MemoryRerankerSignal = keyof RetrievalWeights | "initial" | "coverage";

export interface MemoryRerankerProfile {
  id: string;
  label: string;
  weights: Partial<Record<MemoryRerankerSignal, number>>;
  minScore?: number;
  includeTags?: boolean;
  includeEntities?: boolean;
  explanationLabel?: string;
}

export interface RankedMemory {
  memory: Memory;
  score: number;
  signals: Record<MemoryRerankerSignal, number>;
}

export const BEAM_LOCAL_RERANKER_PROFILE: MemoryRerankerProfile = {
  id: "beam-local-retrieval-v1",
  label: "BEAM local retrieval diagnostic profile",
  weights: {
    semantic: 0.38,
    keyword: 0.34,
    entity: 0.14,
    trust: 0.08
  },
  minScore: 0.08,
  includeTags: true,
  includeEntities: true,
  explanationLabel: "beam local reranker"
};

export const LOCAL_CONTEXT_RERANKER_PROFILE: MemoryRerankerProfile = {
  id: "local-context-rerank-v1",
  label: "Local context rerank profile",
  weights: {
    initial: 0.72,
    coverage: 0.18,
    trust: 0.1
  },
  includeEntities: true,
  explanationLabel: "local rerank"
};

export function rankMemories(query: string, memories: Memory[], profile: MemoryRerankerProfile, now = new Date()): RankedMemory[] {
  const queryTokens = tokenize(query);
  return memories
    .map((memory) => scoreMemory(queryTokens, memory, profile, now))
    .filter((item) => item.score > (profile.minScore ?? 0))
    .sort((a, b) => b.score - a.score);
}

export function rerankSearchResults(query: string, results: SearchResult[], profile: MemoryRerankerProfile, now = new Date()): SearchResult[] {
  const queryTokens = tokenize(query);
  return [...results]
    .map((result) => {
      const ranked = scoreMemory(queryTokens, result.memory, profile, now, result.score, result.signals);
      return {
        ...result,
        score: ranked.score,
        explanation: [
          ...(result.explanation ?? []),
          `${profile.explanationLabel ?? "reranker"} coverage ${ranked.signals.coverage.toFixed(2)} profile ${profile.id}`
        ]
      };
    })
    .filter((result) => result.score > (profile.minScore ?? 0))
    .sort((a, b) => b.score - a.score);
}

function scoreMemory(
  queryTokens: string[],
  memory: Memory,
  profile: MemoryRerankerProfile,
  now: Date,
  initialScore = 0,
  existingSignals?: Partial<SearchResult["signals"]>
): RankedMemory {
  const memoryTokens = tokenize([
    memory.content,
    profile.includeTags === false ? "" : memory.tags.join(" "),
    profile.includeEntities === false ? "" : memory.entities.join(" ")
  ].join(" "));
  const queryText = queryTokens.join(" ");
  const queryEntities = new Set(queryTokens);
  const entityHits = memory.entities.filter((entity) => {
    const normalized = entity.toLowerCase();
    return queryEntities.has(normalized) || queryText.includes(normalized);
  }).length;
  const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
  const ageDays = Math.max(0, (now.getTime() - eventAt.getTime()) / 86_400_000);
  const signals: Record<MemoryRerankerSignal, number> = {
    initial: clamp(initialScore),
    semantic: clamp(existingSignals?.semantic ?? cosineLike(queryTokens, memoryTokens)),
    keyword: clamp(existingSignals?.keyword ?? keywordCoverage(queryTokens, memoryTokens)),
    entity: clamp(existingSignals?.entity ?? (memory.entities.length ? entityHits / Math.min(4, memory.entities.length) : 0)),
    temporal: clamp(existingSignals?.temporal ?? (memory.pinned ? 1 : Math.exp(-ageDays / 180))),
    behavioral: clamp(existingSignals?.behavioral ?? 0),
    trust: clamp(memory.trust * memory.importance),
    graph: clamp(existingSignals?.graph ?? 0),
    access: clamp(existingSignals?.access ?? Math.log1p(memory.accessCount) / 8),
    coverage: clamp(keywordCoverage(queryTokens, tokenize(`${memory.content} ${memory.entities.join(" ")}`)))
  };
  const weights = normalizeRerankerWeights(profile.weights);
  const score = clamp(Object.entries(weights).reduce((sum, [signal, weight]) => sum + signals[signal as MemoryRerankerSignal] * weight, 0));
  return { memory, score, signals };
}

function normalizeRerankerWeights(input: Partial<Record<MemoryRerankerSignal, number>>): Record<MemoryRerankerSignal, number> {
  const raw: Record<MemoryRerankerSignal, number> = {
    semantic: positive(input.semantic),
    keyword: positive(input.keyword),
    entity: positive(input.entity),
    temporal: positive(input.temporal),
    behavioral: positive(input.behavioral),
    trust: positive(input.trust),
    graph: positive(input.graph),
    access: positive(input.access),
    initial: positive(input.initial),
    coverage: positive(input.coverage)
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {
      semantic: 0.26,
      keyword: 0.24,
      entity: 0.16,
      temporal: 0.08,
      behavioral: 0.05,
      trust: 0.18,
      graph: 0.06,
      access: 0.02,
      initial: 0,
      coverage: 0
    };
  }
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total])) as Record<MemoryRerankerSignal, number>;
}

function positive(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
