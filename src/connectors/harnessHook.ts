import { estimateTokens, type MemoryInput, type SearchResult } from "../core";

export interface HarnessContext {
  userId: string;
  agentId?: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryApi {
  add(input: MemoryInput): unknown;
  search(input: { userId: string; agentId?: string; query: string; limit: number }): SearchResult[];
}

export class HarnessMemoryHook {
  constructor(
    private readonly memory: MemoryApi,
    private readonly options: { maxMemories?: number; tokenBudget?: number } = {}
  ) {}

  beforeLlmCall(context: HarnessContext): HarnessContext & { memoryContext: string; memories: SearchResult[] } {
    const memories = this.memory.search({
      userId: context.userId,
      agentId: context.agentId,
      query: context.prompt,
      limit: this.options.maxMemories ?? 6
    });
    const memoryContext = formatMemoryContext(memories, this.options.tokenBudget ?? 900);
    return { ...context, memoryContext, memories };
  }

  afterLlmCall(context: HarnessContext, response: string): void {
    const content = `User asked: ${context.prompt}\nAssistant outcome: ${response}`;
    this.memory.add({
      userId: context.userId,
      agentId: context.agentId,
      content,
      type: "episodic",
      layer: "episodic",
      source: { kind: "agent", confidence: 0.6 },
      tags: ["harness-session"],
      metadata: context.metadata ?? {}
    });
  }
}

function formatMemoryContext(memories: SearchResult[], tokenBudget: number): string {
  const lines: string[] = [];
  let spent = 0;
  for (const result of memories) {
    const line = `[${result.memory.id}] trust=${result.memory.trust.toFixed(2)} ${result.memory.content}`;
    const tokens = estimateTokens(line);
    if (spent + tokens > tokenBudget) break;
    spent += tokens;
    lines.push(line);
  }
  return lines.join("\n");
}
