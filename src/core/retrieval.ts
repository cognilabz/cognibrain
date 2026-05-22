import type { Memory, SearchOptions, SearchResult } from "./types";
import { cosineLike, estimateTokens, keywordCoverage, tokenize } from "./text";
import { clamp, MemoryStore } from "./store";

const STALE_DAYS = 30;

export class RetrievalEngine {
  constructor(private readonly store: MemoryStore) {}

  search(options: SearchOptions): SearchResult[] {
    const now = options.now ?? new Date();
    const queryTokens = tokenize(options.query);
    const queryEntities = new Set(queryTokens);
    const candidates = this.store.list(options.userId).filter((memory) => {
      if (!options.includeArchived && memory.archivedAt) return false;
      if (options.agentId && memory.agentId && memory.agentId !== options.agentId) return false;
      if (options.filters?.type && memory.type !== options.filters.type) return false;
      if (options.filters?.layer && memory.layer !== options.filters.layer) return false;
      if (options.filters?.minTrust && memory.trust < options.filters.minTrust) return false;
      if (options.filters?.tags?.length && !options.filters.tags.every((tag) => memory.tags.includes(tag))) return false;
      return true;
    });

    const graphBoosts = this.graphBoosts(candidates, queryTokens);
    const results = candidates
      .map((memory) => this.score(memory, queryTokens, queryEntities, now, graphBoosts.get(memory.id) ?? 0))
      .filter((result) => result.score > 0.05 && relevanceEvidence(result) > 0.08)
      .sort((a, b) => b.score - a.score)
      .filter((result, _index, all) => !isSuppressedContradiction(result, all))
      .slice(0, options.limit ?? 8);

    for (const result of results) this.store.markAccessed(result.memory.id);
    return results;
  }

  contextPack(results: SearchResult[], tokenBudget = 900): string {
    const lines: string[] = [];
    let spent = 0;
    for (const result of results) {
      const stale = result.stale ? " stale=true" : "";
      const line = `[${result.memory.id}] trust=${result.memory.trust.toFixed(2)} score=${result.score.toFixed(2)}${stale} ${result.memory.content}`;
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
    now: Date,
    graph: number
  ): SearchResult {
    const memoryTokens = tokenize(`${memory.content} ${memory.tags.join(" ")} ${memory.entities.join(" ")}`);
    const semantic = cosineLike(queryTokens, memoryTokens);
    const keyword = keywordCoverage(queryTokens, memoryTokens);
    const entityHits = memory.entities.filter((entity) => queryEntities.has(entity) || queryTokens.includes(entity)).length;
    const entity = memory.entities.length ? clamp(entityHits / Math.min(4, memory.entities.length)) : 0;
    const ageDays = Math.max(0, (now.getTime() - memory.createdAt.getTime()) / 86_400_000);
    const temporal = memory.pinned ? 1 : Math.exp(-ageDays / 180);
    const trust = memory.trust * memory.importance;
    const accessBoost = clamp(Math.log1p(memory.accessCount) / 8);
    const score = clamp(
      semantic * 0.26 +
        keyword * 0.24 +
        entity * 0.16 +
        temporal * 0.08 +
        trust * 0.18 +
        graph * 0.06 +
        accessBoost * 0.02
    );

    return {
      memory,
      score,
      signals: { semantic, keyword, entity, temporal, trust, graph },
      citation: citationFor(memory),
      stale: ageDays > STALE_DAYS && !memory.pinned
    };
  }

  private graphBoosts(candidates: Memory[], queryTokens: string[]): Map<string, number> {
    const boosts = new Map<string, number>();
    const entityFrequency = new Map<string, number>();
    for (const memory of candidates) {
      for (const entity of new Set(memory.entities)) entityFrequency.set(entity, (entityFrequency.get(entity) ?? 0) + 1);
    }
    const commonEntityThreshold = Math.max(3, Math.ceil(candidates.length * 0.12));
    const matched = candidates.filter((memory) => {
      const tokens = tokenize(`${memory.content} ${memory.entities.join(" ")}`);
      return keywordCoverage(queryTokens, tokens) > 0;
    });
    for (const direct of matched) {
      const directEntities = new Set(direct.entities.filter((entity) => (entityFrequency.get(entity) ?? 0) <= commonEntityThreshold));
      for (const memory of candidates) {
        if (memory.id === direct.id) continue;
        const overlap = memory.entities.filter((entity) => directEntities.has(entity)).length;
        if (overlap > 0) boosts.set(memory.id, Math.max(boosts.get(memory.id) ?? 0, clamp(overlap / 3)));
      }
    }
    return boosts;
  }
}

function relevanceEvidence(result: SearchResult): number {
  return result.signals.semantic + result.signals.keyword + result.signals.entity + result.signals.graph;
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
