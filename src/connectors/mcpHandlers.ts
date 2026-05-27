import { MemoryService } from "../api/service";
import type { CodebaseScope, DreamBudget, DreamCycleInput, DreamCycleMode, DreamCycleScope, DreamCycleTrigger, DreamCycleReport, EngineeringMemoryKind, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, Memory, MemoryInput, MemoryPolicyOperation, Provenance, SearchResult } from "../core";

export interface MemoryAddArgs {
  userId: string;
  content: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  type?: MemoryInput["type"];
  layer?: MemoryInput["layer"];
  sourceKind?: Provenance["kind"];
  sourceConfidence?: number;
  tags?: string[];
  entities?: string[];
  pinned?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchArgs {
  userId: string;
  query: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  limit?: number;
  includeArchived?: boolean;
}

export interface MemoryContextPackArgs extends MemorySearchArgs {
  tokenBudget?: number;
  codebaseScope?: CodebaseScope;
}

export interface MemoryCodeCorrectionArgs {
  userId: string;
  content: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  previousMemoryId?: string;
  previousWrongAction?: string;
  correctAction?: string;
  kind?: EngineeringMemoryKind;
  codebase?: CodebaseScope;
  evidenceIds?: string[];
}

export interface MemoryActionGuardArgs {
  userId: string;
  action: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  codebaseScope?: CodebaseScope;
}

export interface MemoryPatchEvidenceArgs {
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
}

export interface MemoryListArgs {
  userId?: string;
  limit?: number;
}

export interface MemoryReflectArgs {
  userId: string;
}

export interface MemoryDreamCycleArgs {
  userId: string;
  trigger?: DreamCycleTrigger;
  mode?: DreamCycleMode;
  scope?: DreamCycleScope;
  budget?: DreamBudget;
  sourceRefresh?: boolean;
  connectorIds?: string[];
  harnessRunId?: string;
  force?: boolean;
}

export interface MemoryDreamPrepareArgs extends MemoryDreamCycleArgs {
  run?: boolean;
}

export interface MemoryDreamJobArgs extends MemoryDreamCycleArgs {
  jobId?: string;
}

export interface MemoryDreamJobStatusArgs {
  jobId?: string;
}

export interface MemoryDreamJobControlArgs {
  jobId: string;
  reason?: string;
}

export interface MemoryRevalidateArgs {
  userId: string;
  memoryId?: string;
  connectorIds?: string[];
  limit?: number;
}

export interface ConnectorSyncStateArgs {
  connectorId?: string;
}

export interface MemoryConflictListArgs {
  status?: "open" | "resolved" | "operator_review";
}

export interface MemoryConflictResolveArgs {
  conflictSetId: string;
  selectedClaimId: string;
  reason: string;
  resolvedBy?: "system" | "operator" | "source_revalidation";
}

export interface ConnectorReviewQueueArgs {
  connectorId?: string;
  userId?: string;
  status?: "pending" | "approved" | "rejected";
}

export interface ConnectorReviewDecisionArgs {
  memoryId: string;
  decision: "approve" | "reject";
  reviewerId?: string;
  reason?: string;
}

export interface MemoryHarnessEventArgs extends HarnessLifecycleEventInput {}

export interface MemoryHealthArgs {
  userId?: string;
}

export interface MemoryEvidenceArgs extends Partial<MemoryContextPackArgs> {
  contextPackId?: string;
}

export interface MemoryGraphPathArgs {
  from: string;
  to: string;
  userId?: string;
  maxDepth?: number;
  limit?: number;
  validAt?: string;
}

export interface MemoryGraphQueryArgs {
  query: string;
  userId?: string;
}

export interface MemoryGraphActivationArgs {
  query: string;
  userId?: string;
  maxDepth?: number;
  limit?: number;
  validAt?: string;
}

export interface MemoryPolicyCheckArgs {
  operation: MemoryPolicyOperation;
  memoryId?: string;
  input?: Partial<MemoryInput>;
  actor?: Record<string, unknown>;
}

export interface MemoryVerifyClaimArgs extends Omit<MemorySearchArgs, "query"> {
  claim: string;
  tokenBudget?: number;
}

export interface MemoryProcedureRecallArgs extends MemorySearchArgs {
  limit?: number;
}

export interface MemoryRetentionReviewArgs {
  userId?: string;
  now?: string;
}

export function createMemoryToolHandlers(service = new MemoryService()) {
  return {
    add(args: MemoryAddArgs) {
      return serializeMemory(
        service.add({
          userId: args.userId,
          agentId: args.agentId,
          sessionId: args.sessionId,
          appId: args.appId,
          orgId: args.orgId,
          projectId: args.projectId,
          content: args.content,
          type: args.type,
          layer: args.layer,
          tags: args.tags,
          entities: args.entities,
          pinned: args.pinned,
          metadata: args.metadata,
          source: {
            kind: args.sourceKind ?? "human",
            confidence: args.sourceConfidence ?? 0.9
          }
        })
      );
    },

    search(args: MemorySearchArgs) {
      const results = service.search({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived
      });
      return results.map(serializeSearchResult);
    },

    contextPack(args: MemoryContextPackArgs) {
      const pack = service.evidencePack({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived,
        tokenBudget: args.tokenBudget ?? 900
      });
      return {
        context: pack.context,
        evidencePack: pack,
        results: pack.results
      };
    },

    codingContextPack(args: MemoryContextPackArgs) {
      return service.codingContextPack({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived,
        tokenBudget: args.tokenBudget ?? 900,
        codebaseScope: args.codebaseScope
      });
    },

    codeCorrection(args: MemoryCodeCorrectionArgs) {
      return serializeMemory(service.recordCodeCorrection(args));
    },

    actionGuard(args: MemoryActionGuardArgs) {
      return service.guardAction(args);
    },

    patchEvidence(args: MemoryPatchEvidenceArgs) {
      return service.patchEvidenceTrail(args);
    },

    evidencePack(args: MemoryEvidenceArgs) {
      if (args.contextPackId) return service.getEvidencePack(args.contextPackId);
      if (!args.userId || !args.query) throw new Error("memory_evidence_pack requires contextPackId or userId plus query");
      return service.evidencePack({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived,
        tokenBudget: args.tokenBudget ?? 900
      });
    },

    graphPath(args: MemoryGraphPathArgs) {
      return service.graphPaths(args.from, args.to, {
        userId: args.userId,
        maxDepth: args.maxDepth,
        limit: args.limit,
        validAt: args.validAt
      });
    },

    graphQuery(args: MemoryGraphQueryArgs) {
      return service.graphQuery(args.query, args.userId);
    },

    graphActivation(args: MemoryGraphActivationArgs) {
      return service.graphActivation(args.query, {
        userId: args.userId,
        maxDepth: args.maxDepth,
        limit: args.limit,
        validAt: args.validAt
      });
    },

    explainConnection(args: MemoryGraphPathArgs) {
      return service.graphExplain(args.from, args.to, {
        userId: args.userId,
        maxDepth: args.maxDepth,
        limit: args.limit,
        validAt: args.validAt
      });
    },

    policyCheck(args: MemoryPolicyCheckArgs) {
      const target = args.memoryId ? service.get(args.memoryId) : args.input;
      if (!target) throw new Error("memory_policy_check requires memoryId or input");
      return service.evaluatePolicy(args.operation, target as Memory | MemoryInput, args.actor as Partial<MemoryInput> ?? {});
    },

    retentionReview(args: MemoryRetentionReviewArgs) {
      return service.retentionReview(args.now ? new Date(args.now) : new Date(), args.userId);
    },

    verifyClaim(args: MemoryVerifyClaimArgs) {
      const pack = service.evidencePack({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.claim,
        limit: args.limit ?? 5,
        includeArchived: args.includeArchived,
        tokenBudget: args.tokenBudget ?? 900
      });
      const top = pack.results[0];
      const contradicted = pack.results.some((result) => result.beliefState === "contradicted" || result.retrieval.contradiction);
      const supported = Boolean(top && top.retrieval.score >= 0.2 && !contradicted);
      return {
        claim: args.claim,
        verdict: contradicted ? "contradicted" : supported ? "supported" : "insufficient_evidence",
        confidence: top ? Math.min(1, Math.max(0, top.retrieval.score)) : 0,
        evidencePackId: pack.id,
        evidence: pack.results.map((result) => ({
          memoryId: result.memoryId,
          content: result.content,
          citation: result.retrieval.citation,
          score: result.retrieval.score,
          explanation: result.retrieval.explanation,
          beliefState: result.beliefState,
          policyDecision: pack.policyDecisions?.find((decision) => decision.memoryId === result.memoryId)
        })),
        warnings: [
          ...(contradicted ? ["claim has contradictory evidence"] : []),
          ...(pack.excludedResults?.length ? [`${pack.excludedResults.length} evidence candidates were excluded`] : [])
        ]
      };
    },

    procedureRecall(args: MemoryProcedureRecallArgs) {
      return service.search({
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.query,
        limit: args.limit ?? 5,
        filters: { type: "procedural" },
        includeArchived: args.includeArchived
      }).map(serializeSearchResult);
    },

    actionRecord(args: HarnessActionInput) {
      return serializeMemory(service.recordHarnessAction(args));
    },

    actionOutcome(args: HarnessActionInput) {
      return serializeMemory(service.recordHarnessAction(args));
    },

    list(args: MemoryListArgs) {
      return service
        .list(args.userId)
        .slice(0, args.limit ?? 50)
        .map(serializeMemory);
    },

    reflect(args: MemoryReflectArgs) {
      return serializeDreamCycleReport(service.reflect(args.userId));
    },

    dream(args: MemoryReflectArgs) {
      return serializeDreamCycleReport(service.dream(args.userId));
    },

    dreamPlan(args: MemoryDreamCycleArgs) {
      return service.dreamPlan(dreamCycleInput(args));
    },

    dreamDue(args: MemoryDreamCycleArgs) {
      return service.dreamPlan(dreamCycleInput({ ...args, trigger: args.trigger ?? "auto_interval" }));
    },

    async dreamRun(args: MemoryDreamCycleArgs) {
      return serializeDreamCycleReport(await service.runDreamCycleAsync(dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" })));
    },

    async dreamJobStart(args: MemoryDreamJobArgs) {
      return service.startDreamJob(dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" }));
    },

    dreamJobStatus(args: MemoryDreamJobStatusArgs) {
      return service.dreamJobStatus(args.jobId);
    },

    dreamJobCancel(args: MemoryDreamJobControlArgs) {
      return service.cancelDreamJob(args.jobId, args.reason);
    },

    async dreamJobRetry(args: MemoryDreamJobControlArgs) {
      return service.retryDreamJob(args.jobId);
    },

    sessionEnd(args: MemoryDreamPrepareArgs) {
      return serializeDreamPreparation(service.prepareDream({ ...dreamCycleInput({ ...args, trigger: "harness_session_end", mode: args.mode ?? "dream" }), run: args.run }));
    },

    handoffPrepare(args: MemoryDreamPrepareArgs) {
      return serializeDreamPreparation(service.prepareDream({ ...dreamCycleInput({ ...args, trigger: "harness_handoff", mode: args.mode ?? "dream", sourceRefresh: args.sourceRefresh ?? true }), run: args.run }));
    },

    releasePrepare(args: MemoryDreamPrepareArgs) {
      return serializeDreamPreparation(service.prepareDream({ ...dreamCycleInput({ ...args, trigger: "before_release", mode: args.mode ?? "dream", budget: args.budget ?? "release", sourceRefresh: args.sourceRefresh ?? true }), run: args.run }));
    },

    revalidateSourceRefs(args: MemoryRevalidateArgs) {
      return args.memoryId ? service.revalidateMemory(args.memoryId, args.userId) : service.revalidateSourceRefs(args.userId, { connectorIds: args.connectorIds, limit: args.limit });
    },

    resolveVerification(args: MemoryRevalidateArgs) {
      return service.resolveVerificationQueue(args.userId, { connectorIds: args.connectorIds, limit: args.limit });
    },

    connectorSyncState(args: ConnectorSyncStateArgs) {
      return service.connectorSyncState(args.connectorId);
    },

    conflictSets(args: MemoryConflictListArgs) {
      return service.listConflictSets(args.status);
    },

    conflictResolve(args: MemoryConflictResolveArgs) {
      return service.resolveConflictSet(args.conflictSetId, {
        selectedClaimId: args.selectedClaimId,
        reason: args.reason,
        resolvedBy: args.resolvedBy
      });
    },

    connectorReviewQueue(args: ConnectorReviewQueueArgs) {
      return service.listConnectorReviewQueue(args).map(serializeMemory);
    },

    connectorReviewDecision(args: ConnectorReviewDecisionArgs) {
      return serializeMemory(service.reviewConnectorMemory(args.memoryId, {
        decision: args.decision,
        reviewerId: args.reviewerId,
        reason: args.reason
      }));
    },

    harnessEvent(args: MemoryHarnessEventArgs) {
      return serializeHarnessLifecycleEvent(service.recordHarnessLifecycleEvent(args));
    },

    health(args: MemoryHealthArgs) {
      return service.health(args.userId);
    },

    maintenance() {
      return service.maintenanceStatus();
    }
  };
}

export function serializeMemory(memory: Memory) {
  return {
    ...memory,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    lastAccessedAt: memory.lastAccessedAt?.toISOString(),
    archivedAt: memory.archivedAt?.toISOString()
  };
}

function serializeSearchResult(result: SearchResult) {
  return {
    ...result,
    memory: serializeMemory(result.memory)
  };
}

function serializeDreamCycleReport(report: DreamCycleReport) {
  return {
    created: report.created.map(serializeMemory),
    demoted: report.demoted.map(serializeMemory),
    contradictions: report.contradictions.map((item) => ({
      kept: serializeMemory(item.kept),
      demoted: serializeMemory(item.demoted),
      reason: item.reason
    })),
    lifecycle: report.lifecycle,
    dreamCycle: report.dreamCycle
  };
}

function serializeDreamPreparation(report: ReturnType<MemoryService["prepareDream"]>) {
  return {
    plan: report.plan,
    report: report.report ? serializeDreamCycleReport(report.report) : undefined
  };
}

function serializeHarnessLifecycleEvent(report: HarnessLifecycleEventReport) {
  return {
    eventMemory: serializeMemory(report.eventMemory),
    actionMemory: report.actionMemory ? serializeMemory(report.actionMemory) : undefined,
    dream: serializeDreamPreparation(report.dream)
  };
}

function dreamCycleInput(args: MemoryDreamCycleArgs): DreamCycleInput {
  return {
    userId: args.userId,
    trigger: args.trigger,
    mode: args.mode,
    scope: args.scope,
    budget: args.budget,
    sourceRefresh: args.sourceRefresh,
    connectorIds: args.connectorIds,
    harnessRunId: args.harnessRunId,
    force: args.force
  };
}

export function jsonText(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
