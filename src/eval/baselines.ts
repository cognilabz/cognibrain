import type { BenchmarkCase, BenchmarkResult, Memory } from "../core";
import { estimateTokens, keywordCoverage, tokenize } from "../core";

export type Retriever = (query: string, limit: number) => Memory[];

export function evaluateRetriever(name: string, cases: BenchmarkCase[], retriever: Retriever): BenchmarkResult {
  const started = performance.now();
  const details = cases.map((item) => {
    const retrieved = retriever(item.query, 4).map((memory) => memory.content);
    const joined = retrieved.join(" ").toLowerCase();
    const hasExpected =
      item.expectedIds.length === 0
        ? retrieved.length === 0 || !joined.includes("favorite database")
        : item.expectedIds.every((needle) => joined.includes(needle.toLowerCase()));
    const avoidsDisallowed = (item.disallowedIds ?? []).every((needle) => !joined.includes(needle.toLowerCase()));
    return {
      id: item.id,
      passed: hasExpected && avoidsDisallowed,
      retrieved,
      expected: item.expectedIds
    };
  });
  const totalTokens = details.reduce((sum, detail) => sum + estimateTokens(detail.retrieved.join("\n")), 0);
  const correct = details.filter((detail) => detail.passed).length;
  return {
    name,
    accuracy: correct / cases.length,
    correct,
    total: cases.length,
    meanTokens: totalTokens / cases.length,
    meanLatencyMs: (performance.now() - started) / cases.length,
    details
  };
}

export function vectorOnly(memories: Memory[]): Retriever {
  return (query, limit) => {
    const q = tokenize(query);
    return [...memories]
      .map((memory) => ({ memory, score: cosine(q, tokenize(memory.content)) }))
      .filter((item) => item.score > 0.05)
      .sort((a, b) => compareScoredMemories(a, b))
      .slice(0, limit)
      .map((item) => item.memory);
  };
}

export function keywordOnly(memories: Memory[]): Retriever {
  return (query, limit) => {
    const q = tokenize(query);
    return [...memories]
      .map((memory) => ({ memory, score: keywordCoverage(q, tokenize(`${memory.content} ${memory.tags.join(" ")}`)) }))
      .filter((item) => item.score > 0.12)
      .sort((a, b) => compareScoredMemories(a, b))
      .slice(0, limit)
      .map((item) => item.memory);
  };
}

export function recencyOnly(memories: Memory[]): Retriever {
  return (_query, limit) => [...memories].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

function cosine(a: string[], b: string[]): number {
  const bSet = new Set(b);
  const hits = a.filter((token) => bSet.has(token)).length;
  return hits / Math.sqrt(Math.max(1, a.length * b.length));
}

function compareScoredMemories(a: { memory: Memory; score: number }, b: { memory: Memory; score: number }): number {
  const score = b.score - a.score;
  if (score !== 0) return score;
  const created = b.memory.createdAt.getTime() - a.memory.createdAt.getTime();
  if (created !== 0) return created;
  const aSession = String(a.memory.metadata.sessionId ?? a.memory.id);
  const bSession = String(b.memory.metadata.sessionId ?? b.memory.id);
  return aSession.localeCompare(bSession);
}
