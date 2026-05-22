import { MemoryService } from "../api/service";
import type { Memory, MemoryInput, Provenance, SearchResult } from "../core";

export interface MemoryAddArgs {
  userId: string;
  content: string;
  agentId?: string;
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

export function createMemoryToolHandlers(service = new MemoryService()) {
  return {
    add(args: MemoryAddArgs) {
      return serializeMemory(
        service.add({
          userId: args.userId,
          agentId: args.agentId,
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
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived
      });
      return results.map(serializeSearchResult);
    },

    contextPack(args: MemoryContextPackArgs) {
      const results = service.search({
        userId: args.userId,
        agentId: args.agentId,
        query: args.query,
        limit: args.limit ?? 8,
        includeArchived: args.includeArchived
      });
      return {
        context: service.retrieval.contextPack(results, args.tokenBudget ?? 900),
        results: results.map(serializeSearchResult)
      };
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
