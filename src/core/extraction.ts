import { extractEntities, unique } from "./text";
import type { MemoryExtractionEvent, MemoryInput, MemoryRelation, Provenance } from "./types";

export interface ExtractionOptions {
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  runId?: string;
}

export function extractAddOnlyMemories(events: MemoryExtractionEvent[], options: ExtractionOptions): MemoryInput[] {
  const inputs: MemoryInput[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    const facts = splitFacts(event.content);
    for (const fact of facts) {
      const key = `${event.role}:${fact.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entities = extractEntities(fact);
      inputs.push({
        ...options,
        content: fact,
        type: event.role === "tool" ? "procedural" : event.role === "assistant" ? "episodic" : "project",
        layer: event.role === "tool" ? "procedural" : "episodic",
        source: event.source ?? sourceForRole(event.role),
        tags: unique(["extracted", event.role]),
        entities,
        relations: relationHints(fact, entities, event.role),
        timestamp: event.timestamp,
        metadata: {
          ...(event.metadata ?? {}),
          extraction: {
            mode: "single-pass-add-only",
            role: event.role,
            extractedAt: new Date().toISOString()
          }
        }
      });
    }
  }
  return inputs;
}

function splitFacts(content: string): string[] {
  return content
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, 12);
}

function sourceForRole(role: MemoryExtractionEvent["role"]): Provenance {
  if (role === "user" || role === "operator") return { kind: "human", confidence: 0.9 };
  if (role === "tool") return { kind: "tool", confidence: 0.82 };
  if (role === "assistant") return { kind: "agent", confidence: 0.64 };
  return { kind: "import", confidence: 0.6 };
}

function relationHints(content: string, entities: string[], role: MemoryExtractionEvent["role"]): MemoryRelation[] {
  const lower = content.toLowerCase();
  const relations: MemoryRelation[] = [];
  if (role === "tool") relations.push({ type: "executed_by", targetEntity: "tool", confidence: 0.8 });
  if (role === "assistant") relations.push({ type: "suggested_by", targetEntity: "agent", confidence: 0.7 });
  if (/\b(imports?|from)\b/.test(lower)) pushEntityRelations(relations, "imports", entities);
  if (/\b(calls?|request|endpoint|api)\b/.test(lower)) pushEntityRelations(relations, "calls", entities);
  if (/\b(depends on|requires|uses)\b/.test(lower)) pushEntityRelations(relations, "depends_on", entities);
  if (/\b(confirms?|verified|passed)\b/.test(lower)) pushEntityRelations(relations, "confirmed_by", entities);
  return relations;
}

function pushEntityRelations(relations: MemoryRelation[], type: MemoryRelation["type"], entities: string[]): void {
  for (const entity of entities.slice(0, 4)) relations.push({ type, targetEntity: entity, confidence: 0.65 });
}
