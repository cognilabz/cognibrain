import { MemoryService } from "../api/service";
import type { HarnessActionInput, Memory, MemoryInput, MemoryPolicyOperation, Provenance, SearchResult } from "../core";

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
}

export interface MemoryListArgs {
  userId?: string;
  limit?: number;
}

export interface MemoryReflectArgs {
  userId: string;
}

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
      const report = service.reflect(args.userId);
      return {
        created: report.created.map(serializeMemory),
        demoted: report.demoted.map(serializeMemory),
        contradictions: report.contradictions.map((item) => ({
          kept: serializeMemory(item.kept),
          demoted: serializeMemory(item.demoted),
          reason: item.reason
        })),
        lifecycle: report.lifecycle
      };
    },

    dream(args: MemoryReflectArgs) {
      const report = service.dream(args.userId);
      return {
        created: report.created.map(serializeMemory),
        demoted: report.demoted.map(serializeMemory),
        contradictions: report.contradictions.map((item) => ({
          kept: serializeMemory(item.kept),
          demoted: serializeMemory(item.demoted),
          reason: item.reason
        })),
        lifecycle: report.lifecycle
      };
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
