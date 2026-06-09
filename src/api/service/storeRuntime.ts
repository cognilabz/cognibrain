import type { AsyncUnitOfWorkExecutor, ClaimRecord, DurabilityDecision, EpisodeInput, EpisodeRecord, ExtractionReport, Memory, MemoryClaim, MemoryExtractionEvent, MemoryInput, MemoryScope } from "../../core";
import { classifyDurability, extractAddOnlyMemories, extractClaim, withEngineeringMemoryMetadata } from "../../core";
import { applyRedactionPolicy } from "../../core/privacy";
import { enrichmentCandidatesFor, extractionConfidence, hasLocalMediaExtraction, learnedRuleSuggestions, markExtractionStage, normalizeMediaExtractionEvent, ruleExtractionFailures } from "../extractionPipeline";
import { contentHash, safeGet, syntheticExtractionEvent, withProceduralMetadata } from "./helpers";
import { linkStateChange } from "./engineering";

export function add(service: any, input: MemoryInput) {
    const checked = prepareMemoryForWrite(service, input);
    const memory = service.entities.ingest(service.storage.create(checked));
    service.registerMemoryClaim(memory);
    if (memory.metadata.archivedOnWrite) service.storage.archive(memory.id);
    service.metrics.memoriesAdded += 1;
    service.recordAudit("memory.write", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    service.afterWrite(memory.userId);
    return memory;
  }

export async function addAsync(service: any, input: MemoryInput): Promise<Memory> {
    const executor = service.productionAsyncRepository as AsyncUnitOfWorkExecutor | undefined;
    if (!executor?.executeUnitOfWork) {
      const memory = service.add(input);
      if (typeof service.waitForProductionAsyncFlush === "function") await service.waitForProductionAsyncFlush();
      return memory;
    }
    const checked = prepareMemoryForWrite(service, input);
    const claimsBefore = new Map(service.claims);
    const conflictSetsBefore = new Map(service.conflictSets);
    let claim: ClaimRecord | undefined;
    const memory = await executor.executeUnitOfWork(async (uow) => {
      let created = await uow.memoryRepository.create(checked);
      if (created.metadata.archivedOnWrite) {
        created = await uow.memoryRepository.update(created.id, {
          archivedAt: new Date().toISOString(),
          beliefState: "archived"
        } as any);
      }
      claim = claimRecordForMemory(service, created);
      if (claim) {
        service.claims.set(claim.id, claim);
        service.rebuildConflictSetFor(claim.subject, claim.predicate);
        const decision = service.currentTruthForClaim(claim);
        await uow.claimRepository.register(claim);
        await uow.truthRepository.decide(decision);
        const conflictSet = service.conflictSetFor(claim.subject, claim.predicate);
        if (conflictSet) await uow.conflictRepository.save(conflictSet);
      }
      return created;
    }).catch((error) => {
      service.claims = claimsBefore;
      service.conflictSets = conflictSetsBefore;
      throw error;
    });
    const memories = service.store.export().filter((item: Memory) => item.id !== memory.id);
    service.repository.import([...memories, memory]);
    service.syncReadModelFromRepository();
    service.entities.ingest(memory);
    if (claim) service.claims.set(claim.id, claim);
    service.metrics.memoriesAdded += 1;
    service.recordAudit("memory.write", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { productionUnitOfWork: true } });
    service.afterWrite(memory.userId);
    return memory;
  }

function prepareMemoryForWrite(service: any, input: MemoryInput): MemoryInput {
    const sourceDefaultConsent = input.sourceId ? service.sources.get(input.sourceId)?.defaultConsent : undefined;
    const agentPersona = input.agentId ? service.personaForAgent(input.agentId) : undefined;
    const personaConsent = agentPersona?.privacyDefault ? { visibility: agentPersona.privacyDefault } : undefined;
    const scopedInput = { ...input, consent: { ...personaConsent, ...sourceDefaultConsent, ...(input.consent ?? {}) } };
    const enriched = service.applyDomainEnrichment(scopedInput);
    const engineeringized = withEngineeringMemoryMetadata(enriched, service.defaultEngineeringClassifier);
    const proceduralized = withProceduralMetadata(engineeringized);
    service.ensureScopedAccess(proceduralized);
    const writeDecision = service.evaluatePolicy("write", proceduralized);
    if (!writeDecision.allowed) {
      service.recordAudit("policy.violation", { userId: proceduralized.userId, brainId: proceduralized.brainId, sourceId: proceduralized.sourceId, metadata: { operation: "write", decision: writeDecision } });
      throw new Error(`Memory write denied by policy: ${writeDecision.reasons.join("; ")}`);
    }
    const checked = applyRedactionPolicy(proceduralized, service.redactionPolicy);
    if (checked.rejected || !checked.input) {
      throw new Error(`Memory rejected by redaction policy: ${checked.matches.map((match) => match.detector).join(", ")}`);
    }
    return checked.input;
  }

function claimRecordForMemory(service: any, memory: Memory): ClaimRecord | undefined {
    const rawClaim = memory.metadata?.claim as MemoryClaim | undefined;
    const claim = rawClaim ?? extractClaim(memory.content, syntheticEventForMemory(memory), memory.scope, memory.source, memory.entities);
    if (!claim.subject || !claim.predicate || !claim.object) return undefined;
    const now = new Date().toISOString();
    const existing = [...service.claims.values()].find((item: ClaimRecord) => item.sourceMemoryId === memory.id);
    return {
      id: existing?.id ?? `claim_${contentHash(`${memory.id}:${claim.subject}:${claim.predicate}:${claim.object}`).slice(2, 18)}`,
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      qualifiers: claim.qualifiers ?? {},
      sourceMemoryId: memory.id,
      sourceRef: memory.provenance.sourceRef,
      validFrom: memory.temporal.validFrom ?? memory.createdAt,
      validUntil: memory.temporal.validUntil,
      confidence: claim.confidence,
      trust: memory.trust,
      state: claimStateForMemory(memory),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
  }

function syntheticEventForMemory(memory: Memory): MemoryExtractionEvent {
    return {
      role: "user",
      content: memory.content,
      timestamp: memory.createdAt,
      source: memory.source,
      sourceRef: memory.provenance.sourceRef
    };
  }

function claimStateForMemory(memory: Memory): ClaimRecord["state"] {
    if (memory.beliefState === "archived") return "needs_verification";
    if (memory.beliefState === "stale") return "needs_verification";
    if (memory.beliefState === "active") return "active";
    return memory.beliefState;
  }

export function createEpisode(service: any, input: EpisodeInput): EpisodeRecord {
    const now = new Date().toISOString();
    const hash = contentHash(JSON.stringify({ scope: input.scope, events: input.events, toolCalls: input.toolCalls ?? [], filesTouched: input.filesTouched ?? [] }));
    const episode: EpisodeRecord = {
      id: `ep_${hash.slice(2, 14)}`,
      userId: input.scope.userId,
      scope: input.scope,
      rawConversation: input.events,
      toolCalls: input.toolCalls ?? input.events.filter((event) => event.role === "tool").map((event) => ({ name: event.metadata?.toolName as string | undefined, output: event.content, timestamp: event.timestamp })),
      filesTouched: input.filesTouched ?? input.events.flatMap((event) => Array.isArray(event.metadata?.filesTouched) ? event.metadata.filesTouched.filter((item): item is string => typeof item === "string") : []),
      source: input.source ?? input.events.find((event) => event.source)?.source,
      hash,
      memoryIds: [],
      createdAt: now
    };
    service.episodes.set(episode.id, episode);
    service.recordAudit("memory.write", { userId: episode.userId, brainId: episode.scope.brainId, sourceId: episode.scope.sourceId, metadata: { resource: "episode", episodeId: episode.id, events: episode.rawConversation.length } });
    service.persist();
    return episode;
  }

export function listEpisodes(service: any, userId?: string): EpisodeRecord[] {
    return [...service.episodes.values()].filter((episode) => !userId || episode.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

export function getEpisode(service: any, id: string): EpisodeRecord {
    const episode = service.episodes.get(id);
    if (!episode) throw new Error(`Episode not found: ${id}`);
    return episode;
  }

export function extract(service: any, events: MemoryExtractionEvent[], scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "deviceId" | "runId">): ExtractionReport {
    const normalizedEvents = events.map(normalizeMediaExtractionEvent);
    const episode = service.createEpisode({ scope: scope as MemoryScope, events: normalizedEvents });
    const existing = service.store.list(scope.userId) as Memory[];
    const failures = ruleExtractionFailures(normalizedEvents);
    const needsProvider = Boolean(service.defaultExtractor);
    const providerInputs = needsProvider ? service.defaultExtractor?.extract({ events: normalizedEvents, scope, existing, now: new Date() }).map((input: MemoryInput) => markExtractionStage({ ...scope, ...input }, "provider")) ?? [] : [];
    const ruleInputs = providerInputs.length ? [] : extractAddOnlyMemories(normalizedEvents, scope).map((input: MemoryInput) => markExtractionStage(input, "rules"));
    const stages: ExtractionReport["stages"] = [
      ...(needsProvider
        ? [{ stage: "provider" as const, inputEvents: normalizedEvents.length, extracted: providerInputs.length, confidence: providerInputs.length ? 0.78 : 0.2, reason: providerInputs.length ? "provider extractor produced candidate memories" : "provider extractor returned no candidates" }]
        : []),
      { stage: "rules", inputEvents: normalizedEvents.length, extracted: ruleInputs.length, confidence: extractionConfidence(normalizedEvents, ruleInputs.length), reason: providerInputs.length ? "skipped because provider extraction succeeded" : "deterministic fallback rules" }
    ];
    const claims: MemoryClaim[] = [];
    const durabilityDecisions: DurabilityDecision[] = [];
    const classifiedInputs = [...ruleInputs, ...providerInputs].flatMap((input) => {
      const event = syntheticExtractionEvent(input);
      const providerStage = (input.metadata?.extraction as { stage?: unknown } | undefined)?.stage === "provider";
      const claim = (input.metadata?.claim as MemoryClaim | undefined) ?? (providerStage ? providerClaim(input, event, scope) : extractClaim(input.content, event, scope, input.source, input.entities ?? []));
      const decision = (input.metadata?.durabilityDecision as DurabilityDecision | undefined) ?? (providerStage ? providerDurability(input, claim) : classifyDurability(input.content, event, claim));
      claims.push(claim);
      durabilityDecisions.push(decision);
      if (decision.action === "ignore" || decision.action === "ask_user") return [];
      const next: MemoryInput = {
        ...input,
        layer: decision.action === "session_only" || decision.action === "working_memory" ? "working" as const : input.layer,
        tags: decision.action === "session_only" || decision.action === "working_memory" ? [...(input.tags ?? []), "session-only"] : input.tags,
        metadata: { ...(input.metadata ?? {}), claim, durabilityDecision: decision }
      };
      return [next];
    });
    const existingHashes = new Set(existing.map((memory) => memory.metadata.contentHash).filter(Boolean));
    const seenHashes = new Set<string>();
    const inputs = classifiedInputs.filter((input) => {
      const hash = contentHash(`${input.content}:${input.source?.kind ?? ""}:${input.timestamp ?? ""}`);
      input.metadata = { ...(input.metadata ?? {}), contentHash: hash, episodeId: episode.id };
      if (existingHashes.has(hash) || seenHashes.has(hash)) return false;
      seenHashes.add(hash);
      return true;
    });
    const memories = inputs.map((input) => service.add(linkStateChange(input, service.store.list(scope.userId))));
    for (const memory of memories) service.applySupersession(memory);
    service.episodes.set(episode.id, { ...episode, memoryIds: memories.map((memory) => memory.id) });
    service.persist();
    const enrichmentCandidates = enrichmentCandidatesFor(service.store.list(scope.userId));
    const learnedRules = learnedRuleSuggestions(normalizedEvents, failures);
    stages.push({
      stage: "enrichment",
      inputEvents: normalizedEvents.length,
      extracted: enrichmentCandidates.length,
      confidence: enrichmentCandidates.length ? 0.72 : 1,
      reason: enrichmentCandidates.length ? "entity attention threshold produced candidates" : "no entity crossed enrichment threshold"
    });
    service.recordAudit("extract.run", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { events: normalizedEvents.length, memories: memories.length, claims: claims.length, durabilityDecisions, stages, failures: failures.length, learnedRules: learnedRules.length } });
    const entityLinks: Record<string, string[]> = {};
    for (const memory of memories) {
      for (const entity of memory.entities) {
        entityLinks[entity] ??= [];
        entityLinks[entity].push(memory.id);
      }
    }
    return { memories, entityLinks, stages, failures, claims, durabilityDecisions, enrichmentCandidates, learnedRules };
  }

export function list(service: any, userId?: string) {
    return service.storage.list(userId);
  }

export function get(service: any, id: string) {
    return service.storage.get(id);
  }

export function update(service: any, id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }) {
    const before = service.storage.get(id);
    const memory = service.storage.update(id, patch);
    service.registerMemoryClaim(memory);
    service.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before, after: memory } });
    service.afterWrite(memory.userId);
    return memory;
  }

export function archive(service: any, id: string) {
    const before = service.storage.get(id);
    const memory = service.storage.archive(id);
    service.registerMemoryClaim(memory);
    service.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", before, after: memory } });
    service.afterWrite(memory.userId);
    return memory;
  }

export function deleteMemory(service: any, id: string) {
    const memory = service.storage.get(id);
    const deleted = service.storage.delete(id);
    if (deleted) service.recordAudit("memory.delete", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before: memory } });
    if (deleted) service.afterWrite(memory.userId);
    return deleted;
  }

export function listMemories(service: any, userId: string, options: { limit?: number; includeArchived?: boolean } = {}) {
    service.enforceRetention(new Date(), userId);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    return (service.store
      .list(userId)
      .filter((memory: Memory) => options.includeArchived || !memory.archivedAt)
      .slice(0, limit)) as Memory[];
  }

export function ingestMedia(service: any, event: MemoryExtractionEvent, scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">): ExtractionReport {
    const media = normalizeMediaExtractionEvent(event);
    const normalized = media.language && !/^en/i.test(media.language)
      ? { ...media, content: service.translateText(media.content, media.language, "en").translated, metadata: { ...(media.metadata ?? {}), translatedFrom: media.language, originalContent: media.content } }
      : media;
    return service.extract([normalized], scope);
  }

function providerClaim(input: MemoryInput, event: MemoryExtractionEvent, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): MemoryClaim {
  const source = input.source ?? event.source ?? { kind: "agent" as const, confidence: input.confidence ?? 0.62 };
  return {
    id: `claim_${contentHash(`${input.content}:${input.timestamp ?? ""}`).slice(2, 14)}`,
    subject: input.entities?.[0] ?? input.projectId ?? input.agentId ?? "provider-memory",
    predicate: "provider_extracted",
    object: input.content,
    qualifiers: {
      role: event.role,
      ...(event.mediaType ? { mediaType: event.mediaType } : {}),
      ...(event.language ? { language: event.language } : {})
    },
    time: event.timestamp,
    source,
    confidence: input.confidence ?? source.confidence,
    durability: "durable",
    sensitivity: "none",
    scope: {
      userId: scope.userId,
      brainId: scope.brainId,
      sourceId: scope.sourceId,
      agentId: scope.agentId,
      sessionId: scope.sessionId,
      appId: scope.appId,
      orgId: scope.orgId,
      projectId: scope.projectId,
      deviceId: scope.deviceId,
      runId: scope.runId
    }
  };
}

function providerDurability(input: MemoryInput, claim: MemoryClaim): DurabilityDecision {
  return {
    contentPreview: input.content.length > 120 ? `${input.content.slice(0, 117)}...` : input.content,
    action: input.layer === "working" ? "working_memory" : "store",
    reason: "provider extraction supplied durable memory candidate",
    durability: input.layer === "working" ? "session_only" : "durable",
    sensitivity: claim.sensitivity,
    confidence: input.confidence ?? claim.confidence
  };
}
