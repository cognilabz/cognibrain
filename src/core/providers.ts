import { execFileSync } from "node:child_process";
import type {
  ContextReranker,
  ContextEvidenceJudge,
  ContextVerifier,
  ContradictionDetector,
  EngineeringMemoryClassifier,
  EngineeringMemoryKind,
  Memory,
  MemoryExtractionEvent,
  MemoryExtractor,
  MemoryInput,
  MemoryScope,
  QueryExpander,
  ReflectionEvaluator,
  ReflectionSummarizer,
  SearchResult,
  SourceKind,
  TranslationProvider
} from "./types";

export interface JsonCommandProviderOptions {
  command: string;
  args?: string[];
  timeoutMs?: number;
}

type ProviderTask = "contradiction" | "rerank" | "verify" | "evidence" | "summarize" | "reflect" | "engineering" | "extract" | "expand" | "translate";

export class JsonCommandMemoryIntelligence implements ContradictionDetector, ContextReranker, ContextVerifier, ContextEvidenceJudge, ReflectionSummarizer, ReflectionEvaluator, EngineeringMemoryClassifier, MemoryExtractor, QueryExpander, TranslationProvider {
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

  judgeEvidence(input: { query: string; results: SearchResult[]; now: Date }) {
    const output = this.call("evidence", {
      query: input.query,
      now: input.now.toISOString(),
      results: input.results.map(resultForProvider)
    });
    const decisions = Array.isArray(output.decisions)
      ? output.decisions.flatMap((item) => {
          if (!isRecord(item) || typeof item.id !== "string") return [];
          return [{
            id: item.id,
            decision: item.decision === "exclude" || item.decision === "warn" || item.decision === "review" ? item.decision : item.decision === "include" ? "include" : undefined,
            confidence: typeof item.confidence === "number" ? boundedNumber(item.confidence, 0.5) : undefined,
            reason: stringField(item.reason)
          }];
        })
      : undefined;
    return {
      answerable: output.answerable === true,
      confidence: boundedNumber(output.confidence, output.answerable === true ? 0.72 : 0.62),
      reason: stringField(output.reason) ?? "provider evidence judgement",
      requiredEvidence: Array.isArray(output.requiredEvidence) ? output.requiredEvidence.filter((item): item is string => typeof item === "string").slice(0, 8) : undefined,
      decisions
    };
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

  evaluateReflection(input: { memories: Memory[]; now: Date }) {
    const output = this.call("reflect", {
      now: input.now.toISOString(),
      memories: input.memories.map(memoryForProvider)
    });
    const evaluations = Array.isArray(output.evaluations) ? output.evaluations : [];
    return evaluations.flatMap((item) => normalizeReflectionEvaluation(item));
  }

  classifyEngineering(input: { content: string; metadata?: Record<string, unknown>; now: Date }) {
    const output = this.call("engineering", {
      content: input.content,
      metadata: input.metadata ?? {},
      now: input.now.toISOString()
    });
    return {
      kind: validEngineeringKind(output.kind),
      confidence: boundedNumber(output.confidence, 0.68),
      previousWrongAction: stringField(output.previousWrongAction),
      correctAction: stringField(output.correctAction),
      forbiddenAction: stringField(output.forbiddenAction),
      command: stringField(output.command),
      successPattern: stringField(output.successPattern),
      reason: stringField(output.reason)
    };
  }

  extract(input: { events: MemoryExtractionEvent[]; scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">; existing: Memory[]; now: Date }): MemoryInput[] {
    const output = this.call("extract", {
      now: input.now.toISOString(),
      scope: input.scope,
      events: input.events,
      existing: input.existing.slice(0, 50).map(memoryForProvider)
    });
    if (!Array.isArray(output.memories)) return [];
    return output.memories.flatMap((item) => normalizeProviderMemory(item, input.scope));
  }

  expand(input: { query: string; userId: string; now: Date; memories?: Memory[] }): string[] {
    const output = this.call("expand", {
      query: input.query,
      userId: input.userId,
      now: input.now.toISOString(),
      memories: (input.memories ?? []).slice(0, 25).map(memoryForProvider)
    });
    return Array.isArray(output.expansions) ? output.expansions.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8) : [];
  }

  translate(input: { text: string; sourceLanguage?: string; targetLanguage: string }) {
    const output = this.call("translate", input);
    return {
      translated: typeof output.translated === "string" && output.translated.trim() ? output.translated.slice(0, 8000) : input.text,
      confidence: boundedNumber(output.confidence, 0.45),
      provider: "json-command"
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

function normalizeProviderMemory(item: unknown, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): MemoryInput[] {
  if (!isRecord(item) || typeof item.content !== "string" || !item.content.trim()) return [];
  return [
    {
      ...scope,
      content: item.content.trim().slice(0, 4000),
      type: validMemoryType(item.type),
      layer: validLayer(item.layer),
      source: isRecord(item.source) && typeof item.source.confidence === "number"
        ? { kind: validSourceKind(item.source.kind), confidence: boundedNumber(item.source.confidence, 0.62), uri: typeof item.source.uri === "string" ? item.source.uri : undefined }
        : { kind: "agent", confidence: boundedNumber(item.confidence, 0.62) },
      tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : ["extracted", "provider"],
      entities: Array.isArray(item.entities) ? item.entities.filter((entity): entity is string => typeof entity === "string") : undefined,
      relations: Array.isArray(item.relations) ? item.relations.filter(isRecord).map((relation) => ({
        type: validRelationType(relation.type),
        sourceEntity: typeof relation.sourceEntity === "string" ? relation.sourceEntity : undefined,
        targetId: typeof relation.targetId === "string" ? relation.targetId : undefined,
        targetEntity: typeof relation.targetEntity === "string" ? relation.targetEntity : undefined,
        direction: relation.direction === "in" || relation.direction === "undirected" ? relation.direction : "out",
        confidence: boundedNumber(relation.confidence, 0.62),
        evidence: typeof relation.evidence === "string" ? relation.evidence : undefined
      })) : undefined,
      temporal: isRecord(item.temporal) ? item.temporal : undefined,
      timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined,
      consent: isRecord(item.consent) ? item.consent : undefined,
      metadata: {
        ...(isRecord(item.metadata) ? item.metadata : {}),
        provider: "json-command",
        extraction: { mode: "provider", provider: "json-command" }
      }
    }
  ];
}

function normalizeReflectionEvaluation(item: unknown): ReturnType<ReflectionEvaluator["evaluateReflection"]> {
  if (!isRecord(item) || typeof item.memoryId !== "string" || !item.memoryId.trim()) return [];
  const claims = Array.isArray(item.claims)
    ? item.claims.flatMap((claim) => {
        if (!isRecord(claim) || typeof claim.key !== "string" || typeof claim.value !== "string") return [];
        return [{
          key: claim.key.slice(0, 160),
          value: claim.value.slice(0, 160),
          label: stringField(claim.label),
          confidence: boundedNumber(claim.confidence, 0.68),
          reason: stringField(claim.reason)
        }];
      })
    : undefined;
  const timeSensitive = isRecord(item.timeSensitive)
    ? {
        applies: item.timeSensitive.applies === true,
        confidence: boundedNumber(item.timeSensitive.confidence, 0.68),
        reason: stringField(item.timeSensitive.reason)
      }
    : undefined;
  const behavioralEvidence = isRecord(item.behavioralEvidence)
    ? {
        applies: item.behavioralEvidence.applies === true,
        theme: stringField(item.behavioralEvidence.theme),
        confidence: boundedNumber(item.behavioralEvidence.confidence, 0.68),
        reason: stringField(item.behavioralEvidence.reason)
      }
    : undefined;
  const organization = isRecord(item.organization)
    ? {
        layer: validLayer(item.organization.layer),
        type: validMemoryType(item.organization.type),
        confidence: boundedNumber(item.organization.confidence, 0.68),
        reason: stringField(item.organization.reason)
      }
    : undefined;
  return [{ memoryId: item.memoryId, claims, timeSensitive, behavioralEvidence, organization }];
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

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validMemoryType(value: unknown): MemoryInput["type"] {
  return value === "user" || value === "feedback" || value === "project" || value === "reference" || value === "episodic" || value === "procedural" ? value : "project";
}

function validLayer(value: unknown): MemoryInput["layer"] {
  return value === "working" || value === "episodic" || value === "long_term" || value === "procedural" || value === "reflection" ? value : "episodic";
}

function validSourceKind(value: unknown): SourceKind {
  return value === "human" || value === "reviewed_code" || value === "tool" || value === "agent" || value === "transcript" || value === "import" ? value : "agent";
}

function validEngineeringKind(value: unknown): EngineeringMemoryKind | undefined {
  return value === "repo_policy" ||
    value === "architecture_decision" ||
    value === "review_correction" ||
    value === "tool_outcome" ||
    value === "procedure" ||
    value === "forbidden_action" ||
    value === "migration_note" ||
    value === "test_strategy" ||
    value === "dependency_rule" ||
    value === "generated_file_rule"
    ? value
    : undefined;
}

function validRelationType(value: unknown): NonNullable<MemoryInput["relations"]>[number]["type"] {
  if (
    value === "mentions" ||
    value === "calls" ||
    value === "imports" ||
    value === "defines" ||
    value === "extends" ||
    value === "depends_on" ||
    value === "transitive_depends_on" ||
    value === "works_for" ||
    value === "advisor_of" ||
    value === "supersedes" ||
    value === "contradicts" ||
    value === "confirmed_by" ||
    value === "suggested_by" ||
    value === "executed_by"
  ) {
    return value;
  }
  return "mentions";
}
