import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type {
  ContextReranker,
  ContextEvidenceJudge,
  ContextVerifier,
  ContradictionDetector,
  EngineeringMemoryClassifier,
  EngineeringMemoryKind,
  EvidenceJudgement,
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
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  compactPayloads?: boolean;
}

type ProviderTask = "contradiction" | "rerank" | "verify" | "evidence" | "summarize" | "reflect" | "engineering" | "extract" | "expand" | "translate";

export class JsonCommandMemoryIntelligence implements ContradictionDetector, ContextReranker, ContextVerifier, ContextEvidenceJudge, ReflectionSummarizer, ReflectionEvaluator, EngineeringMemoryClassifier, MemoryExtractor, QueryExpander, TranslationProvider {
  private readonly cache = new Map<string, { expiresAt: number; value: Record<string, any> }>();

  constructor(private readonly options: JsonCommandProviderOptions) {}

  classify(input: { a: Memory; b: Memory; key?: string }) {
    const output = this.call("contradiction", {
      key: input.key,
      a: memoryForProvider(input.a, this.compactPayloads()),
      b: memoryForProvider(input.b, this.compactPayloads())
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
      results: input.results.map((result) => resultForProvider(result, this.compactPayloads()))
    });
    return applyProviderRanking(input.results, Array.isArray(output.ranking) ? output.ranking : []);
  }

  verify(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[] {
    const output = this.call("verify", {
      query: input.query,
      now: input.now.toISOString(),
      results: input.results.map((result) => resultForProvider(result, this.compactPayloads()))
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
      results: input.results.map((result) => resultForProvider(result, this.compactPayloads()))
    });
    return normalizeEvidenceJudgementOutput(output, input.results.map((result) => result.memory.id));
  }

  summarize(input: { theme: string; memories: Memory[]; now: Date }) {
    const output = this.call("summarize", {
      theme: input.theme,
      now: input.now.toISOString(),
      memories: input.memories.map((memory) => memoryForProvider(memory))
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
      memories: input.memories.map((memory) => memoryForProvider(memory))
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
      existing: input.existing.slice(0, 50).map((memory) => memoryForProvider(memory))
    });
    if (!Array.isArray(output.memories)) return [];
    return output.memories.flatMap((item) => normalizeProviderMemory(item, input.scope));
  }

  expand(input: { query: string; userId: string; now: Date; memories?: Memory[] }): string[] {
    const output = this.call("expand", {
      query: input.query,
      userId: input.userId,
      now: input.now.toISOString(),
      memories: (input.memories ?? []).slice(0, 25).map((memory) => memoryForProvider(memory))
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
    const cacheKey = this.cacheKey(task, payload);
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) return cloneRecord(hit.value);
      if (hit) this.cache.delete(cacheKey);
    }
    try {
      const stdout = execFileSync(this.options.command, [...(this.options.args ?? []), task], {
        input: JSON.stringify({ task, ...payload }),
        encoding: "utf8",
        timeout: this.options.timeoutMs ?? 3500,
        maxBuffer: 1_000_000
      });
      const parsed = JSON.parse(stdout);
      const output = isRecord(parsed) ? parsed : {};
      if (cacheKey) this.remember(cacheKey, output);
      return output;
    } catch {
      return {};
    }
  }

  private compactPayloads(): boolean {
    return this.options.compactPayloads !== false;
  }

  private cacheKey(task: ProviderTask, payload: Record<string, unknown>): string | undefined {
    const ttlMs = this.options.cacheTtlMs ?? 0;
    const maxEntries = this.options.cacheMaxEntries ?? 0;
    if (ttlMs <= 0 || maxEntries <= 0) return undefined;
    return createHash("sha256").update(stableProviderJson({ task, payload: cacheComparablePayload(payload) })).digest("hex");
  }

  private remember(key: string, value: Record<string, any>): void {
    const ttlMs = this.options.cacheTtlMs ?? 0;
    const maxEntries = this.options.cacheMaxEntries ?? 0;
    if (ttlMs <= 0 || maxEntries <= 0) return;
    while (this.cache.size >= maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: Date.now() + ttlMs, value: cloneRecord(value) });
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
    timeoutMs: Number(process.env.MEMORY_INTELLIGENCE_TIMEOUT_MS ?? 3500),
    cacheTtlMs: Number(process.env.MEMORY_INTELLIGENCE_CACHE_TTL_MS ?? 30_000),
    cacheMaxEntries: Number(process.env.MEMORY_INTELLIGENCE_CACHE_MAX_ENTRIES ?? 128),
    compactPayloads: process.env.MEMORY_INTELLIGENCE_COMPACT_PAYLOADS !== "0" && process.env.MEMORY_INTELLIGENCE_COMPACT_PAYLOADS !== "false"
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

function normalizeEvidenceJudgementOutput(output: Record<string, any>, resultIds: string[]): EvidenceJudgement {
  const answerable = output.answerable === true;
  const requiredEvidence = Array.isArray(output.requiredEvidence) ? output.requiredEvidence.filter((item): item is string => typeof item === "string").slice(0, 8) : undefined;
  if (!answerable) {
    return {
      answerable: false,
      confidence: boundedNumber(output.confidence, 0.62),
      reason: stringField(output.reason) ?? "provider evidence judgement",
      requiredEvidence,
      decisions: normalizeOptionalEvidenceDecisions(output.decisions, new Set(resultIds))
    };
  }
  try {
    return {
      answerable: true,
      confidence: strictRatioNumber(output.confidence, "provider evidence confidence"),
      reason: stringField(output.reason) ?? "provider evidence judgement",
      requiredEvidence,
      decisions: normalizeRequiredEvidenceDecisions(output.decisions, resultIds)
    };
  } catch (error) {
    return failClosedEvidenceJudgement(error instanceof Error ? error.message : String(error), resultIds);
  }
}

function normalizeRequiredEvidenceDecisions(value: unknown, resultIds: string[]): NonNullable<EvidenceJudgement["decisions"]> {
  if (!Array.isArray(value)) throw new Error("answerable provider evidence output must include decisions array");
  const expectedIds = new Set(resultIds);
  const seen = new Set<string>();
  const decisions = value.map((item) => normalizeStrictEvidenceDecision(item, expectedIds));
  for (const decision of decisions) {
    if (seen.has(decision.id)) throw new Error(`answerable provider evidence output returned duplicate decision for ${decision.id}`);
    seen.add(decision.id);
  }
  const missing = resultIds.filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`answerable provider evidence output missed decisions for ${missing.join(", ")}`);
  return resultIds.map((id) => decisions.find((decision) => decision.id === id)!);
}

function normalizeOptionalEvidenceDecisions(value: unknown, expectedIds: Set<string>): EvidenceJudgement["decisions"] {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  return value.flatMap((item) => {
    try {
      const decision = normalizeStrictEvidenceDecision(item, expectedIds);
      if (seen.has(decision.id)) return [];
      seen.add(decision.id);
      return [decision];
    } catch {
      return [];
    }
  });
}

function normalizeStrictEvidenceDecision(item: unknown, expectedIds: Set<string>): NonNullable<EvidenceJudgement["decisions"]>[number] {
  if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim()) throw new Error("provider evidence decision must include memory id");
  if (!expectedIds.has(item.id)) throw new Error(`provider evidence decision returned unknown memory id ${item.id}`);
  const decision = item.decision;
  if (decision !== "include" && decision !== "warn" && decision !== "review" && decision !== "exclude") throw new Error(`provider evidence decision for ${item.id} must be include, warn, review, or exclude`);
  return {
    id: item.id,
    decision,
    confidence: strictRatioNumber(item.confidence, `provider evidence decision confidence for ${item.id}`),
    reason: stringField(item.reason)
  };
}

function failClosedEvidenceJudgement(reason: string, resultIds: string[]): EvidenceJudgement {
  const safeReason = `provider evidence contract invalid: ${reason.slice(0, 500)}`;
  return {
    answerable: false,
    confidence: 0.99,
    reason: safeReason,
    decisions: resultIds.map((id) => ({
      id,
      decision: "exclude",
      confidence: 0.99,
      reason: safeReason
    }))
  };
}

function memoryForProvider(memory: Memory, compact = false) {
  return {
    id: memory.id,
    content: truncateString(memory.content, compact ? 1200 : 8000),
    tags: compact ? memory.tags.slice(0, 24) : memory.tags,
    entities: compact ? memory.entities.slice(0, 32) : memory.entities,
    source: compact ? compactRecord(memory.source, 2) : memory.source,
    trust: memory.trust,
    importance: memory.importance,
    createdAt: memory.createdAt.toISOString(),
    temporal: memory.temporal,
    metadata: compact ? compactRecord(memory.metadata, 2) : memory.metadata
  };
}

function resultForProvider(result: SearchResult, compact = false) {
  return {
    id: result.memory.id,
    score: result.score,
    signals: compact ? compactRecord(result.signals, 1) : result.signals,
    explanation: compact ? result.explanation?.slice(0, 8).map((item) => truncateString(item, 180)) : result.explanation,
    memory: memoryForProvider(result.memory, compact)
  };
}

function boundedNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function strictRatioNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be a finite number in [0,1]`);
  return value;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateString(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function compactRecord(value: unknown, depth: number): unknown {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return truncateString(value, 300);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return depth <= 0 ? undefined : value.slice(0, 12).map((item) => compactRecord(item, depth - 1)).filter((item) => item !== undefined);
  if (!isRecord(value) || depth <= 0) return undefined;
  const entries = Object.entries(value).slice(0, 24).flatMap(([key, item]) => {
    const compacted = compactRecord(item, depth - 1);
    return compacted === undefined ? [] : [[key, compacted] as const];
  });
  return Object.fromEntries(entries);
}

function cacheComparablePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cacheComparablePayload);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "now" && typeof item === "string") {
      output[key] = minuteBucket(item);
      continue;
    }
    output[key] = cacheComparablePayload(item);
  }
  return output;
}

function minuteBucket(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  return new Date(Math.floor(time / 60_000) * 60_000).toISOString();
}

function stableProviderJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableProviderJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(null);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableProviderJson(value[key])}`).join(",")}}`;
}

function cloneRecord(value: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(value));
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
