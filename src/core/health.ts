import type { HealthReport, Memory } from "./types";
import { MemoryStore } from "./store";

export function healthReport(store: MemoryStore, userId?: string, now = new Date()): HealthReport {
  const memories = store.list(userId);
  const active = memories.filter((memory) => !memory.archivedAt);
  const archived = memories.length - active.length;
  const fresh = active.filter((memory) => {
    const last = memory.lastAccessedAt ?? memory.createdAt;
    return (now.getTime() - last.getTime()) / 86_400_000 <= 30;
  }).length;
  const averageTrust = average(active.map((memory) => memory.trust));
  const coveredTypes = new Set(active.map((memory) => memory.type)).size;
  const coverage = coveredTypes / 6;
  const contradictions = active.filter((memory) => typeof memory.metadata.contradiction === "string").length;
  const freshness = active.length ? fresh / active.length : 1;
  const healthScore = clampScore(freshness * 0.28 + averageTrust * 0.32 + coverage * 0.22 + (1 - Math.min(1, contradictions / 5)) * 0.18);
  return { total: memories.length, active: active.length, archived, freshness, averageTrust, coverage, contradictions, healthScore };
}

function average(values: number[]): number {
  if (!values.length) return 1;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function graphReachability(memories: Memory[]): number {
  if (memories.length < 2) return 1;
  let linked = 0;
  for (const memory of memories) {
    const entities = new Set(memory.entities);
    if (memories.some((other) => other.id !== memory.id && other.entities.some((entity) => entities.has(entity)))) {
      linked += 1;
    }
  }
  return linked / memories.length;
}
