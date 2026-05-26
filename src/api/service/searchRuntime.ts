import { buildCodingContextPackFromResults, buildPatchEvidenceTrail, citationFor, engineeringQueryWeights, normalizeRetrievalWeights, type CodingContextPack, type EngineeringMemoryKind, type EvidencePack, type FederatedSearchReport, type Memory, type MemoryRouteReport, type PolicyDecision, type QueryIntentReport, type RetrievalProfile, type SearchOptions, type SearchResult } from "../../core";
import { buildQueryPlan, contentHash, evidenceDate, rollingAverage, roundMetric, uniqueStrings } from "./helpers";

export function search(service: any, options: SearchOptions): SearchResult[] {
    const intent = service.classifyQueryIntent(options.query);
    const effectiveOptions = { ...options, mode: options.mode ?? intent.recommendedMode };
    service.enforceRetention(new Date(), effectiveOptions.userId);
    const persona = effectiveOptions.agentId ? service.personaForAgent(effectiveOptions.agentId) : undefined;
    const personaProfile = persona?.retrievalWeights
      ? {
          id: `persona:${persona.id}`,
          label: persona.label,
          weights: normalizeRetrievalWeights(persona.retrievalWeights),
          scope: { agentId: effectiveOptions.agentId },
          updatedAt: persona.updatedAt,
          provenance: "persona"
        }
      : undefined;
    const profile = effectiveOptions.profileId ? service.retrievalProfiles.get(effectiveOptions.profileId) : personaProfile ?? service.profileFor(effectiveOptions);
    const linkedUserIds = effectiveOptions.includeLinkedIdentities ? (service.identities.resolve(effectiveOptions.userId) as string[]).filter((id) => id !== effectiveOptions.userId) : [];
    const accessibleBrainIds = service.accessibleBrainIds(effectiveOptions);
    const requestedBrainIds = effectiveOptions.brainIds ?? (effectiveOptions.brainId ? [effectiveOptions.brainId] : undefined);
    const federatedBrainIds = effectiveOptions.includeSharedBrains
      ? (requestedBrainIds ? requestedBrainIds.filter((brainId) => accessibleBrainIds.includes(brainId)) : accessibleBrainIds)
      : effectiveOptions.brainIds;
    const queryExpansions = service.expandSearchQuery(effectiveOptions);
    const rawResults = service.retrieval.search({
      ...effectiveOptions,
      brainIds: federatedBrainIds,
      linkedUserIds,
      queryExpansions,
      weights: options.weights ?? profile?.weights ?? intent.recommendedWeights,
      reranker: effectiveOptions.reranker ?? service.defaultReranker,
      verifier: effectiveOptions.verifier ?? service.defaultVerifier,
      lexicalProvider: effectiveOptions.lexicalProvider ?? service.lexicalProviderForPersistence()
    });
    const plannedResults = (rawResults as SearchResult[]).map((result) => ({ ...result, queryPlan: intent.plan }));
    const denied: PolicyDecision[] = [];
    const results = plannedResults.filter((result) => {
      const decision = service.evaluatePolicy("retrieve", result.memory, { userId: effectiveOptions.userId, orgId: effectiveOptions.orgId, agentId: effectiveOptions.agentId });
      if (decision.allowed) return true;
      denied.push(decision);
      return false;
    });
    service.metrics.searches += 1;
    service.metrics.noHitSearches += results.length === 0 ? 1 : 0;
    service.metrics.lowConfidenceSearches = (service.metrics.lowConfidenceSearches ?? 0) + (results.some((result) => result.decision === "warn" || result.decision === "review") ? 1 : 0);
    service.metrics.averageSearchResults = rollingAverage(service.metrics.averageSearchResults, results.length, service.metrics.searches);
    service.recordSessionMetrics(effectiveOptions, results.length);
    service.searchEvents.push({
      timestamp: new Date().toISOString(),
      userId: effectiveOptions.userId,
      sessionId: effectiveOptions.sessionId,
      projectId: effectiveOptions.projectId,
      resultCount: results.length,
      lowConfidence: results.some((result) => result.decision === "warn" || result.decision === "review"),
      queryHash: contentHash(effectiveOptions.query)
    });
    if (denied.length) service.recordAudit("policy.violation", { userId: effectiveOptions.userId, brainId: effectiveOptions.brainId, sourceId: effectiveOptions.sourceId, metadata: { operation: "retrieve", denied: denied.length, decisions: denied } });
    service.recordAudit("search.run", { userId: effectiveOptions.userId, brainId: effectiveOptions.brainId, sourceId: effectiveOptions.sourceId, metadata: { resultCount: results.length, deniedByPolicy: denied.length, profileId: profile?.id, intent: intent.intent } });
    service.persist();
    return results;
  }

export function classifyQueryIntent(service: any, query: string): QueryIntentReport {
    const plan = buildQueryPlan(query);
    return {
      query,
      intent: plan.intent,
      confidence: plan.confidence,
      recommendedMode: plan.recommendedMode,
      recommendedWeights: plan.recommendedWeights,
      reasons: plan.explanation,
      plan
    };
  }

export function routeMemory(service: any, options: SearchOptions): MemoryRouteReport {
    const selectedScopes: MemoryRouteReport["selectedScopes"] = [{ kind: "user", id: options.userId, reason: "request user is always the base memory scope" }];
    const excludedScopes: MemoryRouteReport["excludedScopes"] = [];
    const reasoning: string[] = [];
    if (options.sessionId) selectedScopes.push({ kind: "session", id: options.sessionId, reason: "sessionId was provided by the harness" });
    if (options.appId) selectedScopes.push({ kind: "app", id: options.appId, reason: "appId narrows recall to the current application" });
    if (options.projectId) selectedScopes.push({ kind: "project", id: options.projectId, reason: "projectId narrows recall to the current project or repository" });
    if (options.orgId) selectedScopes.push({ kind: "org", id: options.orgId, reason: "orgId enables approved org-visible memory" });
    if (options.agentId) {
      selectedScopes.push({ kind: "agent", id: options.agentId, reason: "agentId selects agent-specific memories and persona defaults" });
      const persona = service.personaForAgent(options.agentId);
      if (persona) selectedScopes.push({ kind: "persona", id: persona.id, reason: "agent persona contributes retrieval defaults" });
    }
    const accessibleBrains = service.accessibleBrainIds(options);
    for (const brainId of accessibleBrains) selectedScopes.push({ kind: "brain", id: brainId, reason: "brain is accessible to the user, org, agent, or public visibility" });
    const requestedBrainIds = new Set(options.brainIds ?? (options.brainId ? [options.brainId] : []));
    for (const brainId of requestedBrainIds) {
      if (!accessibleBrains.includes(brainId)) excludedScopes.push({ kind: "brain", id: brainId, reason: "brain was requested but is not accessible for this user/agent/org" });
    }
    const privateMatches = (service.store.list() as Memory[]).filter((memory) => memory.userId !== options.userId && memory.consent.visibility === "private").length;
    if (privateMatches) excludedScopes.push({ kind: "private", id: `${privateMatches}`, reason: "private memories from other users are never routed without explicit identity linking" });
    if (options.brainId || options.brainIds?.length) reasoning.push("Brain routing was requested explicitly.");
    if (options.includeSharedBrains) reasoning.push("Shared brain retrieval is enabled, but still constrained by consent and accessible brain membership.");
    if (!options.includePrivate) reasoning.push("Private memory remains limited to the requesting user.");
    if (options.scopeMode) reasoning.push(`Scope mode ${options.scopeMode} will be enforced during retrieval.`);
    if (!reasoning.length) reasoning.push("Default route uses user memory plus any matching session/app/project/org/agent scopes present on memories.");
    return {
      query: options.query,
      userId: options.userId,
      selectedScopes,
      excludedScopes,
      reasoning,
      retrievalOptions: {
        userId: options.userId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        brainId: options.brainId,
        brainIds: options.brainIds,
        includeSharedBrains: options.includeSharedBrains,
        includeLinkedIdentities: options.includeLinkedIdentities,
        scopeMode: options.scopeMode,
        profileId: options.profileId,
        mode: options.mode
      }
    };
  }

export function evidencePack(service: any, options: SearchOptions & { tokenBudget?: number }): EvidencePack {
    const tokenBudget = options.tokenBudget ?? 900;
    const results = service.search(options) as SearchResult[];
    const context = service.retrieval.contextPack(results, tokenBudget);
    const includedResults = results.filter((result) => result.decision !== "exclude" && context.includes(`[${result.memory.id}]`));
    const id = `ctx_${contentHash(`${options.userId}:${options.query}:${includedResults.map((result) => result.memory.id).join(",")}:${tokenBudget}`).slice(2, 14)}`;
    const policyDecisions = results.map((result) => service.evaluatePolicy("retrieve", result.memory, { userId: options.userId, orgId: options.orgId, agentId: options.agentId }));
    const temporalState = {
      generatedAt: new Date().toISOString(),
      stale: includedResults.filter((result) => result.stale).length,
      valid: includedResults.filter((result) => !result.stale).length,
      needsVerification: includedResults.filter((result) => result.memory.beliefState === "needs_verification").length,
      contradicted: includedResults.filter((result) => result.memory.beliefState === "contradicted" || result.contradiction).length
    };
    const hash = contentHash(JSON.stringify({
      query: options.query,
      userId: options.userId,
      tokenBudget,
      resultIds: includedResults.map((result) => result.memory.id),
      policy: policyDecisions.map((decision) => ({ memoryId: decision.memoryId, allowed: decision.allowed, reasons: decision.reasons })),
      temporalState
    }));
    const pack: EvidencePack = {
      schemaVersion: "1.0",
      id,
      generatedAt: new Date().toISOString(),
      query: options.query,
      actor: { userId: options.userId, orgId: options.orgId, agentId: options.agentId },
      userId: options.userId,
      scope: {
        userId: options.userId,
        brainId: options.brainId,
        sourceId: options.sourceId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        deviceId: options.deviceId,
        runId: options.runId
      },
      profileId: options.profileId,
      retrievalProfile: options.profileId ? service.retrievalProfiles.get(options.profileId) : service.profileFor(options),
      queryIntent: service.classifyQueryIntent(options.query),
      tokenBudget,
      hash,
      context,
      results: includedResults.map((result) => {
        const policyDecision = policyDecisions.find((decision) => decision.memoryId === result.memory.id);
        const whyIncluded = [
          ...((result.explanation ?? []).length ? result.explanation ?? [] : [`final score ${roundMetric(result.score)} selected this memory`]),
          ...(result.graphPaths?.length ? [`graph path: ${result.graphPaths[0]}`] : []),
          ...(result.confidence !== undefined ? [`calibrated confidence ${roundMetric(result.confidence)}`] : [])
        ];
        const whyNotExcluded = [
          policyDecision?.allowed === false ? `policy denied: ${policyDecision.reasons.join("; ")}` : "policy allowed for actor and scope",
          result.unsafeToInject ? "unsafe-to-inject warning is present" : "above unsafe-to-inject threshold",
          result.stale ? "temporal state is stale but still surfaced with warning" : "temporal validity allows use",
          result.contradiction ? "contradiction warning requires review" : "no blocking contradiction"
        ];
        return {
        memoryId: result.memory.id,
        content: result.memory.content,
        source: result.memory.source,
        scope: {
          userId: result.memory.userId,
          brainId: result.memory.brainId,
          sourceId: result.memory.sourceId,
          agentId: result.memory.agentId,
          sessionId: result.memory.sessionId,
          appId: result.memory.appId,
          orgId: result.memory.orgId,
          projectId: result.memory.projectId,
          deviceId: result.memory.deviceId,
          runId: result.memory.runId
        },
        consent: result.memory.consent,
        trust: result.memory.trust,
        confidence: result.memory.confidence,
        importance: result.memory.importance,
        beliefState: result.memory.beliefState,
        provenance: result.memory.provenance,
        validity: {
          eventAt: evidenceDate(result.memory.temporal.eventAt),
          validFrom: evidenceDate(result.memory.temporal.validFrom),
          validUntil: evidenceDate(result.memory.temporal.validUntil),
          lastConfirmedAt: evidenceDate(result.memory.temporal.lastConfirmedAt),
          verificationDueAt: evidenceDate(result.memory.temporal.verificationDueAt),
          stale: result.stale,
          decision: result.decision
        },
        retrieval: {
          score: result.score,
          confidence: result.confidence,
          initialScore: result.initialScore,
          mode: result.retrievalMode,
          signals: result.signals,
          scoreBreakdown: {
            ...result.signals,
            finalScore: result.score,
            initialScore: result.initialScore,
            confidence: result.confidence
          },
          explanation: result.explanation ?? [],
          whyIncluded,
          whyNotExcluded,
          graphPaths: result.graphPaths ?? [],
          citation: result.citation,
          contradiction: result.contradiction,
          plan: result.queryPlan,
          unsafeToInject: result.unsafeToInject
        },
        policyDecision,
        contradictionWarnings: result.contradiction ? [result.contradiction.reason] : []
      }; }),
      excludedResults: results
        .filter((result) => result.decision === "exclude" || !context.includes(`[${result.memory.id}]`))
        .map((result) => ({
          memoryId: result.memory.id,
          reason: result.decision === "exclude"
            ? "retrieval decision excluded this memory"
            : (result.confidence ?? 1) < 0.5
              ? "calibrated confidence below injection threshold"
              : "token budget or reranking kept this memory outside the context body",
          decision: result.decision,
          policyDecision: policyDecisions.find((decision) => decision.memoryId === result.memory.id),
          score: result.score
        })),
      policyDecisions,
      graphPaths: [...new Set(includedResults.flatMap((result) => result.graphPaths ?? []))] as string[],
      temporalState,
      summary: {
        included: includedResults.filter((result) => !result.decision || result.decision === "include").length,
        warnings: includedResults.filter((result) => result.decision === "warn" || result.decision === "review").length,
        excluded: results.filter((result) => result.decision === "exclude").length,
        stale: includedResults.filter((result) => result.stale).length,
        contradictions: includedResults.filter((result) => result.contradiction).length
      }
    };
    service.evidencePacks.set(pack.id, pack);
    service.recordAudit("search.run", { userId: options.userId, metadata: { resource: "evidence-pack", contextPackId: pack.id, query: options.query, memories: pack.results.length } });
    service.persist();
    return pack;
  }

export function getEvidencePack(service: any, id: string): EvidencePack {
    const pack = service.evidencePacks.get(id);
    if (!pack) throw new Error(`Evidence pack not found: ${id}`);
    return pack;
  }

export function codingContextPack(service: any, options: SearchOptions & { tokenBudget?: number }): CodingContextPack {
    const tokenBudget = options.tokenBudget ?? 900;
    const intent = service.classifyQueryIntent(options.query);
    const preferredKinds = Object.keys(engineeringQueryWeights(intent.plan.queryType)) as EngineeringMemoryKind[];
    const allEngineeringKinds: EngineeringMemoryKind[] = ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"];
    const engineeringKinds: EngineeringMemoryKind[] = options.filters?.engineeringKind
      ? [options.filters.engineeringKind]
      : options.filters?.engineeringKinds?.length
        ? options.filters.engineeringKinds
        : [...new Set([...preferredKinds, ...allEngineeringKinds])];
    const results = service.search({
      ...options,
      limit: options.limit ?? 18,
      expandQuery: true,
      filters: { ...(options.filters ?? {}), engineeringKinds },
      query: `${options.query} repo policy procedure correction forbidden architecture tool outcome migration generated file`
    }) as SearchResult[];
    const evidence = service.evidencePack({ ...options, limit: options.limit ?? 18, tokenBudget });
    const id = `code_ctx_${contentHash(`${options.userId}:${options.query}:${results.map((result) => result.memory.id).join(",")}:${tokenBudget}`).slice(2, 14)}`;
    const pack = buildCodingContextPackFromResults({
      id,
      query: options.query,
      userId: options.userId,
      results,
      tokenBudget,
      scope: {
        userId: options.userId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        codebase: options.codebaseScope
      },
      evidencePackId: evidence.id
    });
    service.codingContextPacks.set(pack.id, pack);
    service.recordAudit("search.run", { userId: options.userId, metadata: { resource: "coding-context-pack", contextPackId: pack.id, query: options.query, sections: pack.sections.length, memories: pack.sections.reduce((sum, section) => sum + section.evidence.length, 0) } });
    service.persist();
    return pack;
  }

export function getCodingContextPack(service: any, id: string): CodingContextPack {
    const pack = service.codingContextPacks.get(id);
    if (!pack) throw new Error(`Coding context pack not found: ${id}`);
    return pack;
  }

export function federatedSearch(service: any, options: SearchOptions & { brainIds: string[] }): FederatedSearchReport {
    const allowed = new Set(service.accessibleBrainIds(options));
    const requested = [...new Set(options.brainIds)];
    const searchedBrainIds = requested.filter((id) => allowed.has(id));
    const blockedBrainIds = requested.filter((id) => !allowed.has(id));
    const results = searchedBrainIds.length
      ? service.search({ ...options, brainIds: searchedBrainIds, includeSharedBrains: true })
      : [];
    return {
      query: options.query,
      userId: options.userId,
      requestedBrainIds: requested,
      searchedBrainIds,
      blockedBrainIds,
      results
    };
  }
