import {
  activateGraph,
  exportMemoryGraph,
  findGraphPaths,
  inferGraphRelations,
  queryMemoryGraph,
  type GraphActivationResult,
  type GraphExplainReport,
  type GraphExportOptions,
  type GraphExportResult,
  type RelationType
} from "../../core";
import { averagePathTrust, newestPathTime } from "./helpers";

export function graphPaths(service: any, from: string, to: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }) {
  const memories = service.store.list(options?.userId).filter((memory: any) => !memory.archivedAt);
  return findGraphPaths(memories, from, to, options);
}

export function graphExplain(service: any, from: string, to: string, options: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string; strategy?: GraphExplainReport["strategy"] } = {}): GraphExplainReport {
  const strategy = options.strategy ?? "strongest";
  const paths = service.graphPaths(from, to, { ...options, limit: Math.max(options.limit ?? 5, 8) });
  const ranked = [...paths].sort((a, b) => {
    if (strategy === "shortest") return a.edges.length - b.edges.length || b.score - a.score;
    if (strategy === "most_recent") return newestPathTime(b) - newestPathTime(a) || b.score - a.score;
    if (strategy === "highest_trust") return averagePathTrust(b) - averagePathTrust(a) || b.score - a.score;
    return b.score - a.score || a.edges.length - b.edges.length;
  });
  return { from, to, strategy, validAt: options.validAt, paths: ranked.slice(0, options.limit ?? 5) };
}

export function graphQuery(service: any, query: string, userId?: string) {
  return queryMemoryGraph(service.store.list(userId).filter((memory: any) => !memory.archivedAt), query);
}

export function graphActivation(service: any, query: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }): GraphActivationResult {
  return activateGraph(service.store.list(options?.userId).filter((memory: any) => !memory.archivedAt), query, options);
}

export function graphExport(service: any, options: GraphExportOptions = {}): GraphExportResult | string {
  return exportMemoryGraph(service.store.list(options.userId).filter((memory: any) => !memory.archivedAt), options);
}

export function runInference(service: any, rules?: Parameters<typeof inferGraphRelations>[1]): ReturnType<typeof inferGraphRelations> {
  const report = inferGraphRelations(service.store.list().filter((memory: any) => !memory.archivedAt), rules);
  for (const item of report.inferred) {
    const memory = service.store.get(item.memoryId);
    service.store.update(item.memoryId, { relations: [...memory.relations, item.relation] });
  }
  service.recordAudit("inference.run", { metadata: { rulesEvaluated: report.rulesEvaluated, inferred: report.inferred.length } });
  service.persist();
  return report;
}
