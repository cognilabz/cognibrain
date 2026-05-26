import { normalizeLifecyclePolicy, runDomainEvaluation as runDomainEvaluationCore, type DomainEvaluationReport, type DomainModule, type EnrichmentCandidate, type EntityMergeSuggestion, type EntityRecord, type GraphReport, type LifecyclePolicy, type Memory } from "../../core";
import { enrichmentCandidatesFor } from "../extractionPipeline";

export function graph(service: any, userId?: string): GraphReport {
    const memories = (service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt);
    return service.entities.graph(memories);
  }

export function entityCatalog(service: any, userId?: string): { entities: EntityRecord[]; mergeSuggestions: EntityMergeSuggestion[]; enrichmentCandidates: EnrichmentCandidate[] } {
    const memories = (service.store.list(userId) as Memory[]).filter((memory) => !memory.archivedAt);
    return {
      entities: service.entities.graph(memories).entities,
      mergeSuggestions: service.entities.suggestMerges(memories),
      enrichmentCandidates: enrichmentCandidatesFor(memories)
    };
  }

export function runEntityEnrichment(service: any, input: { userId: string; entity: string; approveExternal?: boolean; sourceUri?: string }) {
    const candidates = service.entityCatalog(input.userId).enrichmentCandidates;
    const candidate = candidates.find((item: EnrichmentCandidate) => item.entity.toLowerCase() === input.entity.toLowerCase());
    const externalAllowed = input.approveExternal === true || process.env.MEMORY_ENRICHMENT_ALLOW_NETWORK === "true";
    if (!candidate) return { status: "skipped" as const, entity: input.entity, reason: "entity has not crossed enrichment threshold", memories: [] as Memory[] };
    if (!externalAllowed) return { status: "blocked" as const, entity: candidate.entity, reason: "external enrichment requires approval or MEMORY_ENRICHMENT_ALLOW_NETWORK=true", candidate, memories: [] as Memory[] };
    if (!service.defaultExtractor) return { status: "skipped" as const, entity: candidate.entity, reason: "no provider extractor configured for enrichment", candidate, memories: [] as Memory[] };
    const extracted = service.defaultExtractor.extract({
      events: [{
        role: "operator",
        content: `Enrich entity ${candidate.entity} with approved external source facts.`,
        source: { kind: "import", uri: input.sourceUri, confidence: 0.7 },
        metadata: { enrichment: { entity: candidate.entity, action: candidate.suggestedAction, memoryIds: candidate.memoryIds } }
      }],
      scope: { userId: input.userId },
      existing: service.store.list(input.userId) as Memory[],
      now: new Date()
    });
    const memories = extracted.map((memory: any) =>
      service.add({
        ...memory,
        userId: input.userId,
        type: memory.type ?? "reference",
        layer: memory.layer ?? "long_term",
        source: memory.source ?? { kind: "import", uri: input.sourceUri, confidence: 0.72 },
        tags: [...new Set([...(memory.tags ?? []), "external-enrichment", candidate.entity])],
        entities: [...new Set([...(memory.entities ?? []), candidate.entity])],
        metadata: {
          ...(memory.metadata ?? {}),
          enrichment: { entity: candidate.entity, action: candidate.suggestedAction, sourceUri: input.sourceUri, sourceMemoryIds: candidate.memoryIds },
          addOnly: true
        }
      })
    );
    service.recordAudit("provider.call", { userId: input.userId, metadata: { task: "entity-enrichment", entity: candidate.entity, status: memories.length ? "applied" : "empty", memories: memories.map((memory: Memory) => memory.id) } });
    service.persist();
    return { status: memories.length ? "applied" as const : "empty" as const, entity: candidate.entity, candidate, memories };
  }

export function mergeEntity(service: any, canonical: string, aliases: string[], userId?: string): EntityRecord {
    const memories = service.store.list(userId) as Memory[];
    const record = service.entities.merge(canonical, aliases, memories);
    for (const memory of memories) service.recanonicalizeMemory(memory);
    service.recordAudit("entity.merge", { userId, metadata: { canonical: record.canonical, aliases: record.aliases } });
    service.persist();
    return record;
  }

export function splitEntity(service: any, canonical: string, aliases: string[], userId?: string): EntityRecord | undefined {
    const record = service.entities.split(canonical, aliases);
    if (!record) return undefined;
    for (const memory of service.store.list(userId) as Memory[]) service.recanonicalizeMemory(memory);
    service.recordAudit("entity.split", { userId, metadata: { canonical: record.canonical, aliases } });
    service.persist();
    return record;
  }

export function lifecyclePreview(service: any, userId: string, policy?: Partial<LifecyclePolicy>) {
    const normalized = normalizeLifecyclePolicy(policy);
    const now = new Date();
    return (service.store.list(userId) as Memory[]).map((memory) => {
      const ageDays = (now.getTime() - memory.createdAt.getTime()) / 86_400_000;
      const utility = memory.trust * memory.importance + Math.log1p(memory.accessCount) / normalized.accessBoostDivisor;
      return {
        memoryId: memory.id,
        action:
          memory.pinned || normalized.protectedSourceKinds.includes(memory.source.kind) || normalized.protectedLayers.includes(memory.layer)
            ? "protect"
            : ageDays > normalized.archiveAfterDays && utility < normalized.archiveUtilityThreshold
              ? "archive"
              : ageDays > normalized.fadeAfterDays && utility < normalized.fadeUtilityThreshold
                ? "fade"
                : "keep",
        utility
      };
    });
  }

export function runDomainEvaluation(service: any, domain?: DomainModule): DomainEvaluationReport {
    const effectiveDomain = domain ?? service.domainModule;
    if (!effectiveDomain) throw new Error("No domain module configured");
    const report = runDomainEvaluationCore(effectiveDomain);
    service.domainEvaluations.push(report);
    service.metrics.benchmarkRuns = (service.metrics.benchmarkRuns ?? 0) + 1;
    service.persist();
    return report;
  }
