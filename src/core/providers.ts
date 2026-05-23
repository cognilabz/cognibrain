import { execFileSync } from "node:child_process";
import type { ContextReranker, ContextVerifier, ContradictionDetector, Memory, ReflectionSummarizer, SearchResult } from "./types";

export interface JsonCommandProviderOptions {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

type ProviderTask = "contradiction" | "rerank" | "verify" | "summarize";

export class JsonCommandMemoryIntelligence implements ContradictionDetector, ContextReranker, ContextVerifier, ReflectionSummarizer {
  constructor(private readonly options: JsonCommandProviderOptions) {}

  classify(input: { a: Memory; b: Memory; key?: string }) {
    const output = this.call("contradiction", {
      key: input.key,
      a: memoryForProvider(input.a),
      b: memoryForProvider(input.b)
    });
    const label = output.label === "entailment" || output.label === "contradiction" ? output.label : "neutral";
    return {
      label,
      confidence: boundedNumber(output.confidence, 0.5),
      reason: typeof output.reason === "string" ? output.reason : "provider classification"
    };
  }

  rerank(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[] {
    const output = this.call("rerank", {
      query: input.query,
      now: input.now.toISOString(),
      results: input.results.map(resultForProvider)
    });
    return applyProviderRanking(input.results, Array.isArray(output.ranking) ? output.ranking : []);
  }

  verify(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[] {
    const output = this.call("verify", {
      query: input.query,
      now: input.now.toISOString(),
      results: input.results.map(resultForProvider)
    });
    const decisions = new Map<string, { decision?: SearchResult["decision"]; reason?: string }>();
    if (Array.isArray(output.decisions)) {
      for (const item of output.decisions) {
        if (typeof item?.id !== "string") continue;
        decisions.set(item.id, {
          decision: item.decision === "exclude" || item.decision === "warn" || item.decision === "review" ? item.decision : "include",
          reason: typeof item.reason === "string" ? item.reason : undefined
        });
      }
    }
    return input.results.map((result) => {
      const decision = decisions.get(result.memory.id);
      if (!decision) return result;
      return {
        ...result,
        decision: decision.decision,
        explanation: [...(result.explanation ?? []), `provider verify: ${decision.reason ?? decision.decision}`]
      };
    });
  }

  summarize(input: { theme: string; memories: Memory[]; now: Date }) {
    const output = this.call("summarize", {
      theme: input.theme,
      now: input.now.toISOString(),
      memories: input.memories.map(memoryForProvider)
    });
    return {
      content: typeof output.content === "string" ? output.content.slice(0, 1200) : "",
      confidence: boundedNumber(output.confidence, 0.68),
      metadata: {
        provider: "json-command",
        ...(isRecord(output.metadata) ? output.metadata : {})
      }
    };
  }

  private call(task: ProviderTask, payload: Record<string, unknown>): Record<string, any> {
    try {
      const stdout = execFileSync(this.options.command, [...(this.options.args ?? []), task], {
        input: JSON.stringify({ task, ...payload }),
        encoding: "utf8",
        timeout: this.options.timeoutMs ?? 3500,
        maxBuffer: 1_000_000
      });
      const parsed = JSON.parse(stdout);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}

export function createJsonCommandIntelligenceFromEnv(): JsonCommandMemoryIntelligence | undefined {
  const command = process.env.MEMORY_INTELLIGENCE_COMMAND;
  if (!command) return undefined;
  return new JsonCommandMemoryIntelligence({
    command,
    args: process.env.MEMORY_INTELLIGENCE_ARGS ? process.env.MEMORY_INTELLIGENCE_ARGS.split(/\s+/).filter(Boolean) : undefined,
    timeoutMs: Number(process.env.MEMORY_INTELLIGENCE_TIMEOUT_MS ?? 3500)
  });
}

function applyProviderRanking(results: SearchResult[], ranking: unknown[]): SearchResult[] {
  const rank = new Map<string, number>();
  for (const [index, item] of ranking.entries()) {
    if (typeof item === "string") rank.set(item, index);
    if (isRecord(item) && typeof item.id === "string") rank.set(item.id, index);
  }
  return [...results].sort((a, b) => (rank.get(a.memory.id) ?? 999) - (rank.get(b.memory.id) ?? 999) || b.score - a.score);
}

function memoryForProvider(memory: Memory) {
  return {
    id: memory.id,
    content: memory.content,
    tags: memory.tags,
    entities: memory.entities,
    source: memory.source,
    trust: memory.trust,
    importance: memory.importance,
    createdAt: memory.createdAt.toISOString(),
    temporal: memory.temporal,
    metadata: memory.metadata
  };
}

function resultForProvider(result: SearchResult) {
  return {
    id: result.memory.id,
    score: result.score,
    signals: result.signals,
    explanation: result.explanation,
    memory: memoryForProvider(result.memory)
  };
}

function boundedNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
