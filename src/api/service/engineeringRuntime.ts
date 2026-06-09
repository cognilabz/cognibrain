import { applyTruthGateDecision, buildPatchEvidenceTrail, citationFor, evaluateForbiddenAction, getEngineeringMetadata, type ActionGuardReport, type AsyncUnitOfWorkExecutor, type CodebaseScope, type EngineeringMemoryKind, type Memory, type MemoryInput, type PatchEvidenceTrail, type SearchResult } from "../../core";
import { clamp01, contentHash, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, normalizeActionPhrase, repoPolicyFromCorrection, safeGet } from "./helpers";

type CodeCorrectionInput = {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  };

export function recordCodeCorrection(service: any, input: CodeCorrectionInput): Memory {
    const providerDecision = input.kind ? undefined : service.defaultEngineeringClassifier?.classifyEngineering({ content: input.content, metadata: { codebase: input.codebase, evidenceIds: input.evidenceIds }, now: new Date() });
    const kind = input.kind ?? providerDecision?.kind ?? inferCorrectionKind(input.content);
    const previous = input.previousMemoryId ? safeGet(service.store, input.previousMemoryId) : undefined;
    const memory = service.add(codeCorrectionMemoryInput(input, kind, providerDecision, previous));
    service.applySupersession(memory);
    const derivedMemories = service.derivedCorrectionMemories(input, memory, previous);
    const finalMemory = derivedMemories.length
      ? service.update(memory.id, {
          metadata: {
            ...memory.metadata,
            correctionPipeline: {
              derivedMemoryIds: derivedMemories.map((item: Memory) => item.id),
              derivedKinds: derivedMemories.map((item: Memory) => getEngineeringMetadata(item)?.kind).filter(Boolean),
              previousMemoryId: previous?.id
            }
          }
        })
      : memory;
    service.recordAudit("memory.write", { userId: input.userId, memoryId: finalMemory.id, metadata: { resource: "engineering-correction", previousMemoryId: previous?.id, kind, derivedMemoryIds: derivedMemories.map((item: Memory) => item.id) } });
    return finalMemory;
  }

export async function recordCodeCorrectionAsync(service: any, input: CodeCorrectionInput): Promise<Memory> {
    const providerDecision = input.kind ? undefined : service.defaultEngineeringClassifier?.classifyEngineering({ content: input.content, metadata: { codebase: input.codebase, evidenceIds: input.evidenceIds }, now: new Date() });
    const kind = input.kind ?? providerDecision?.kind ?? inferCorrectionKind(input.content);
    const previous = input.previousMemoryId ? safeGet(service.store, input.previousMemoryId) : undefined;
    const memory = await service.addAsync(codeCorrectionMemoryInput(input, kind, providerDecision, previous));
    await applySupersessionAsync(service, memory);
    const derivedMemories: Memory[] = [];
    for (const item of derivedCorrectionInputs(service, input, memory, previous)) {
      derivedMemories.push(await service.addAsync(item));
    }
    const finalMemory = derivedMemories.length
      ? await service.updateAsync(memory.id, {
          metadata: {
            ...memory.metadata,
            correctionPipeline: {
              derivedMemoryIds: derivedMemories.map((item: Memory) => item.id),
              derivedKinds: derivedMemories.map((item: Memory) => getEngineeringMetadata(item)?.kind).filter(Boolean),
              previousMemoryId: previous?.id
            }
          }
        })
      : memory;
    service.recordAudit("memory.write", { userId: input.userId, memoryId: finalMemory.id, metadata: { resource: "engineering-correction", previousMemoryId: previous?.id, kind, derivedMemoryIds: derivedMemories.map((item: Memory) => item.id), productionUnitOfWork: true } });
    return finalMemory;
  }

export function derivedCorrectionMemories(service: any, input: CodeCorrectionInput, correction: Memory, previous?: Memory): Memory[] {
    return derivedCorrectionInputs(service, input, correction, previous).map((item) => service.add(item));
  }

function codeCorrectionMemoryInput(input: CodeCorrectionInput, kind: EngineeringMemoryKind, providerDecision: any, previous?: Memory): MemoryInput {
    return {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      content: input.content,
      type: kind === "review_correction" ? "feedback" : "project",
      layer: "long_term",
      source: input.source ?? { kind: "reviewed_code", confidence: 0.9 },
      tags: ["engineering-correction", "correction", `engineering:${kind}`],
      entities: [
        ...(input.codebase?.repo ? [input.codebase.repo] : []),
        ...(input.codebase?.branch ? [input.codebase.branch] : []),
        ...(input.codebase?.filePattern ? [input.codebase.filePattern] : [])
      ],
      temporal: { eventAt: input.timestamp ?? new Date().toISOString(), validFrom: input.timestamp ?? new Date().toISOString() },
      relations: previous ? [{ type: "supersedes", targetId: previous.id, confidence: 0.9, evidence: "review correction replaced the previous wrong coding action" }] : [],
      metadata: {
        engineering: {
          kind,
          codebase: input.codebase ?? { repo: input.projectId },
          correctionOfMemoryId: previous?.id,
          previousWrongAction: input.previousWrongAction ?? previous?.content,
          correctAction: input.correctAction ?? providerDecision?.correctAction,
          forbiddenAction: providerDecision?.forbiddenAction,
          command: providerDecision?.command,
          successPattern: providerDecision?.successPattern,
          confidence: providerDecision?.confidence ?? 0.9,
          evidenceIds: input.evidenceIds ?? []
        }
      }
    };
  }

async function applySupersessionAsync(service: any, memory: Memory): Promise<void> {
    const supersedes = memory.relations.filter((relation) => relation.type === "supersedes" && relation.targetId);
    if (!supersedes.length) return;
    const validUntil = new Date(memory.temporal.validFrom ?? memory.createdAt).toISOString();
    for (const relation of supersedes) {
      const target = safeGet(service.store, relation.targetId!);
      if (!target || target.beliefState === "retracted") continue;
      const updated = await service.updateAsync(target.id, {
        beliefState: "superseded",
        temporal: {
          ...target.temporal,
          validUntil,
          supersededAt: validUntil
        },
        metadata: {
          ...target.metadata,
          supersededBy: memory.id,
          supersessionReason: `Superseded by ${memory.id}`
        }
      });
      service.recordAudit("memory.update", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { action: "superseded", supersededBy: memory.id, productionUnitOfWork: true } });
    }
  }

function derivedCorrectionInputs(service: any, input: CodeCorrectionInput, correction: Memory, previous?: Memory): MemoryInput[] {
    const primaryKind = getEngineeringMetadata(correction)?.kind;
    const codebase = input.codebase ?? { repo: input.projectId };
    const source = input.source ?? { kind: "reviewed_code" as const, confidence: 0.88 };
    const timestamp = input.timestamp ?? new Date().toISOString();
    const providerDecision = service.defaultEngineeringClassifier?.classifyEngineering({ content: input.content, metadata: { codebase: input.codebase, evidenceIds: input.evidenceIds }, now: new Date() });
    const correctAction = input.correctAction ?? providerDecision?.correctAction ?? inferCorrectActionFromCorrection(input.content);
    const previousWrongAction = input.previousWrongAction ?? (previous ? getEngineeringMetadata(previous)?.command : undefined) ?? previous?.content;
    const forbiddenAction = providerDecision?.forbiddenAction ?? inferForbiddenActionFromCorrection(input.content, previousWrongAction);
    const scope = {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId
    };
    const baseMetadata = {
      correctionPipeline: { derivedFromCorrectionId: correction.id, previousMemoryId: previous?.id },
      evidenceIds: input.evidenceIds ?? []
    };
    const derived: MemoryInput[] = [];

    const repoPolicy = providerDecision?.kind === "repo_policy" ? normalizeActionPhrase(input.content) : repoPolicyFromCorrection(input.content, correctAction);
    if (repoPolicy && primaryKind !== "repo_policy") {
      derived.push({
        ...scope,
        content: `Repo policy${codebase.repo ? ` for ${codebase.repo}` : ""}: ${repoPolicy}`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:repo_policy", "correction-derived", "repo-policy"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.82, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "repo_policy", codebase, confidence: 0.86, correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (forbiddenAction && primaryKind !== "forbidden_action") {
      derived.push({
        ...scope,
        content: `Forbidden action${codebase.repo ? ` for ${codebase.repo}` : ""}: do not ${forbiddenAction}.`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:forbidden_action", "correction-derived", "forbidden-action"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.84, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "forbidden_action", codebase, confidence: 0.86, forbiddenAction, correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (providerDecision?.kind === "generated_file_rule" && primaryKind !== "generated_file_rule") {
      derived.push({
        ...scope,
        content: `Generated-file rule${codebase.repo ? ` for ${codebase.repo}` : ""}: do not edit generated files unless the generator is part of the task.`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:generated_file_rule", "correction-derived", "forbidden-action"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.84, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "generated_file_rule", codebase, confidence: 0.86, forbiddenAction: "edit generated files", correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (correctAction && primaryKind !== "procedure") {
      derived.push({
        ...scope,
        content: `Procedure${codebase.repo ? ` for ${codebase.repo}` : ""}: before the next related code change, use ${correctAction}.`,
        type: "procedural",
        layer: "procedural",
        source,
        tags: ["engineering-memory", "engineering:procedure", "correction-derived", "procedure"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.82, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "procedure", codebase, confidence: 0.84, command: correctAction, successPattern: correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    return derived;
  }

export function guardAction(service: any, input: {
    userId: string;
    action: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
  }): ActionGuardReport {
    const results = service.search({
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      query: `${input.action} forbidden action repo policy generated file procedure alternative`,
      limit: 12,
      codebaseScope: input.codebaseScope,
      filters: { engineeringKinds: ["forbidden_action", "generated_file_rule", "repo_policy", "procedure", "test_strategy"] }
    });
    const existingIds = new Set((results as SearchResult[]).map((result) => result.memory.id));
    const supplemental = (service.store.list(input.userId) as Memory[])
      .filter((memory) => !existingIds.has(memory.id))
      .filter((memory) => {
        const engineering = getEngineeringMetadata(memory);
        return Boolean(engineering && ["forbidden_action", "generated_file_rule", "repo_policy", "procedure", "test_strategy"].includes(engineering.kind) && engineeringActionMatches(input.action, engineering));
      })
      .map((memory) => applyTruthGateDecision({
        memory,
        score: 0.72,
        signals: { semantic: 0, keyword: 0.72, entity: 0, temporal: 0, trust: memory.trust, graph: 0, access: 0 },
        citation: citationFor(memory),
        stale: memory.beliefState === "stale" || memory.beliefState === "needs_verification",
        explanation: ["action guard supplemental engineering-memory match"]
      }, service.currentTruthForMemory(memory)));
    const report = evaluateForbiddenAction({ userId: input.userId, action: input.action, results: [...results, ...supplemental] });
    service.recordAudit(report.allowed ? "search.run" : "policy.violation", { userId: input.userId, metadata: { resource: "action-guard", action: input.action, allowed: report.allowed, evidenceIds: report.evidenceIds } });
    return report;
  }

function engineeringActionMatches(action: string, engineering: NonNullable<ReturnType<typeof getEngineeringMetadata>>): boolean {
  const normalizedAction = normalizeActionPhrase(action.toLowerCase());
  return [
    engineering.forbiddenAction,
    engineering.command,
    engineering.correctAction,
    engineering.successPattern,
    engineering.previousWrongAction
  ].some((candidate) => {
    if (!candidate) return false;
    const normalizedCandidate = normalizeActionPhrase(candidate.toLowerCase());
    return normalizedCandidate === normalizedAction || normalizedCandidate.includes(normalizedAction) || normalizedAction.includes(normalizedCandidate);
  });
}

export function patchEvidenceTrail(service: any, input: {
    userId: string;
    task: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
    filesChanged?: string[];
    commandsRun?: string[];
    memoryIds?: string[];
  }): PatchEvidenceTrail {
    const results: SearchResult[] = input.memoryIds?.length
      ? input.memoryIds.map((id) => safeGet(service.store, id)).filter((memory): memory is Memory => Boolean(memory)).map((memory) => ({
          memory,
          score: 1,
          signals: { semantic: 0, keyword: 0, entity: 0, temporal: 0, trust: memory.trust, graph: 0, access: 0 },
          citation: citationFor(memory),
          stale: memory.beliefState === "stale" || memory.beliefState === "needs_verification",
          explanation: ["explicit evidence memory id supplied"]
        }))
      : service.search({
          userId: input.userId,
          agentId: input.agentId,
          sessionId: input.sessionId,
          appId: input.appId,
          orgId: input.orgId,
          projectId: input.projectId,
          query: `${input.task} correction procedure tool outcome architecture policy`,
          limit: 18,
          codebaseScope: input.codebaseScope,
          filters: { engineeringKinds: ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "test_strategy", "dependency_rule", "migration_note"] }
        });
    const excludedStaleRules = results
      .filter((result) => result.memory.beliefState === "superseded" || result.memory.beliefState === "stale" || result.memory.beliefState === "needs_verification" || result.decision === "exclude")
      .map((result) => ({ memoryId: result.memory.id, reason: `belief=${result.memory.beliefState} decision=${result.decision ?? "include"}` }));
    const evidenceSource = results.find((result) => typeof getEngineeringMetadata(result.memory)?.evidenceIds?.[0] === "string");
    const trail = buildPatchEvidenceTrail({
      id: `patch_ev_${contentHash(`${input.userId}:${input.task}:${results.map((result) => result.memory.id).join(",")}`).slice(2, 14)}`,
      userId: input.userId,
      task: input.task,
      results,
      contextPackId: evidenceSource ? getEngineeringMetadata(evidenceSource.memory)?.evidenceIds?.[0] : undefined,
      filesChanged: input.filesChanged,
      commandsRun: input.commandsRun,
      excludedStaleRules
    });
    service.patchEvidenceTrails.set(trail.id, trail);
    service.recordAudit("search.run", { userId: input.userId, metadata: { resource: "patch-evidence-trail", trailId: trail.id, memories: trail.memoryIds.length } });
    service.persist();
    return trail;
  }

export async function patchEvidenceTrailAsync(service: any, input: {
    userId: string;
    task: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
    filesChanged?: string[];
    commandsRun?: string[];
    memoryIds?: string[];
  }): Promise<PatchEvidenceTrail> {
    const trail = patchEvidenceTrailData(service, input);
    const executor = service.productionAsyncRepository as AsyncUnitOfWorkExecutor | undefined;
    if (executor?.executeUnitOfWork) {
      await executor.executeUnitOfWork(async (uow) => {
        await uow.appendEvent({
          type: "patch_evidence.created",
          aggregateId: trail.id,
          occurredAt: trail.generatedAt,
          payload: trail
        });
        return trail;
      });
      service.patchEvidenceTrails.set(trail.id, trail);
      service.recordAudit("search.run", { userId: input.userId, metadata: { resource: "patch-evidence-trail", trailId: trail.id, memories: trail.memoryIds.length, productionUnitOfWork: true } });
      return trail;
    }
    const syncTrail = service.patchEvidenceTrail(input);
    if (typeof service.waitForProductionAsyncFlush === "function") await service.waitForProductionAsyncFlush();
    return syncTrail;
  }

function patchEvidenceTrailData(service: any, input: {
    userId: string;
    task: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
    filesChanged?: string[];
    commandsRun?: string[];
    memoryIds?: string[];
  }): PatchEvidenceTrail {
    const results: SearchResult[] = input.memoryIds?.length
      ? input.memoryIds.map((id) => safeGet(service.store, id)).filter((memory): memory is Memory => Boolean(memory)).map((memory) => ({
          memory,
          score: 1,
          signals: { semantic: 0, keyword: 0, entity: 0, temporal: 0, trust: memory.trust, graph: 0, access: 0 },
          citation: citationFor(memory),
          stale: memory.beliefState === "stale" || memory.beliefState === "needs_verification",
          explanation: ["explicit evidence memory id supplied"]
        }))
      : service.search({
          userId: input.userId,
          agentId: input.agentId,
          sessionId: input.sessionId,
          appId: input.appId,
          orgId: input.orgId,
          projectId: input.projectId,
          query: `${input.task} correction procedure tool outcome architecture policy`,
          limit: 18,
          codebaseScope: input.codebaseScope,
          filters: { engineeringKinds: ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "test_strategy", "dependency_rule", "migration_note"] }
        });
    const excludedStaleRules = results
      .filter((result) => result.memory.beliefState === "superseded" || result.memory.beliefState === "stale" || result.memory.beliefState === "needs_verification" || result.decision === "exclude")
      .map((result) => ({ memoryId: result.memory.id, reason: `belief=${result.memory.beliefState} decision=${result.decision ?? "include"}` }));
    const evidenceSource = results.find((result) => typeof getEngineeringMetadata(result.memory)?.evidenceIds?.[0] === "string");
    return buildPatchEvidenceTrail({
      id: `patch_ev_${contentHash(`${input.userId}:${input.task}:${results.map((result) => result.memory.id).join(",")}`).slice(2, 14)}`,
      userId: input.userId,
      task: input.task,
      results,
      contextPackId: evidenceSource ? getEngineeringMetadata(evidenceSource.memory)?.evidenceIds?.[0] : undefined,
      filesChanged: input.filesChanged,
      commandsRun: input.commandsRun,
      excludedStaleRules
    });
  }
