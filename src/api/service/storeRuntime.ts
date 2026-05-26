import type { DurabilityDecision, EpisodeInput, EpisodeRecord, ExtractionReport, Memory, MemoryClaim, MemoryExtractionEvent, MemoryInput, MemoryScope } from "../../core";
import { classifyDurability, extractAddOnlyMemories, extractClaim, withEngineeringMemoryMetadata } from "../../core";
import { applyRedactionPolicy } from "../../core/privacy";
import { enrichmentCandidatesFor, extractionConfidence, hasLocalMediaExtraction, learnedRuleSuggestions, markExtractionStage, normalizeMediaExtractionEvent, ruleExtractionFailures } from "../extractionPipeline";
import { contentHash, safeGet, syntheticExtractionEvent, withProceduralMetadata } from "./helpers";
import { linkStateChange } from "./engineering";

export function add(service: any, input: MemoryInput) {
    const sourceDefaultConsent = input.sourceId ? service.sources.get(input.sourceId)?.defaultConsent : undefined;
    const agentPersona = input.agentId ? service.personaForAgent(input.agentId) : undefined;
    const personaConsent = agentPersona?.privacyDefault ? { visibility: agentPersona.privacyDefault } : undefined;
    const scopedInput = { ...input, consent: { ...personaConsent, ...sourceDefaultConsent, ...(input.consent ?? {}) } };
    const enriched = service.applyDomainEnrichment(scopedInput);
    const engineeringized = withEngineeringMemoryMetadata(enriched);
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
    const memory = service.entities.ingest(service.storage.create(checked.input));
    if (memory.metadata.archivedOnWrite) service.storage.archive(memory.id);
    service.metrics.memoriesAdded += 1;
    service.recordAudit("memory.write", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    service.afterWrite(memory.userId);
    return memory;
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
    const ruleInputs = extractAddOnlyMemories(normalizedEvents, scope).map((input: MemoryInput) => markExtractionStage(input, "rules"));
    const needsProvider = Boolean(service.defaultExtractor && (ruleInputs.length === 0 || failures.length > 0 || normalizedEvents.some((event) => event.mediaType && !["text", "code", "document"].includes(event.mediaType) && !hasLocalMediaExtraction(event))));
    const providerInputs = needsProvider ? service.defaultExtractor?.extract({ events: normalizedEvents, scope, existing, now: new Date() }).map((input: MemoryInput) => markExtractionStage({ ...scope, ...input }, "provider")) ?? [] : [];
    const stages: ExtractionReport["stages"] = [
      { stage: "rules", inputEvents: normalizedEvents.length, extracted: ruleInputs.length, confidence: extractionConfidence(normalizedEvents, ruleInputs.length), reason: "single-pass add-only rules" },
      ...(needsProvider
        ? [{ stage: "provider" as const, inputEvents: normalizedEvents.length, extracted: providerInputs.length, confidence: providerInputs.length ? 0.78 : 0.2, reason: providerInputs.length ? "fallback extractor produced candidate memories" : "fallback extractor returned no candidates" }]
        : [])
    ];
    const claims: MemoryClaim[] = [];
    const durabilityDecisions: DurabilityDecision[] = [];
    const classifiedInputs = [...ruleInputs, ...providerInputs].flatMap((input) => {
      const event = syntheticExtractionEvent(input);
      const claim = (input.metadata?.claim as MemoryClaim | undefined) ?? extractClaim(input.content, event, scope, input.source, input.entities ?? []);
      const decision = (input.metadata?.durabilityDecision as DurabilityDecision | undefined) ?? classifyDurability(input.content, event, claim);
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
    service.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before, after: memory } });
    service.afterWrite(memory.userId);
    return memory;
  }

export function archive(service: any, id: string) {
    const before = service.storage.get(id);
    const memory = service.storage.archive(id);
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
