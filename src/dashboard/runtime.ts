import type { Memory, ReflectionReport, SearchResult } from "../core";
import type { MarketplaceModuleCard } from "./types";

export function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
}

export function reviveMemories(raw: unknown): Memory[] {
  return Array.isArray(raw) ? raw.map(reviveMemory) : [];
}

export function reviveMemory(raw: unknown): Memory {
  const memory = raw as Memory & { createdAt: string | Date; updatedAt: string | Date; lastAccessedAt?: string | Date; archivedAt?: string | Date };
  return {
    ...memory,
    createdAt: toDate(memory.createdAt),
    updatedAt: toDate(memory.updatedAt),
    lastAccessedAt: memory.lastAccessedAt ? toDate(memory.lastAccessedAt) : undefined,
    archivedAt: memory.archivedAt ? toDate(memory.archivedAt) : undefined
  };
}

export function reviveSearchResults(raw: unknown): SearchResult[] {
  return Array.isArray(raw)
    ? raw.map((result) => {
        const item = result as SearchResult & { memory: unknown };
        return { ...item, memory: reviveMemory(item.memory) };
      })
    : [];
}

export function reviveReflectionReport(raw: unknown): ReflectionReport {
  const report = raw as ReflectionReport;
  return {
    ...report,
    created: reviveMemories(report.created),
    demoted: reviveMemories(report.demoted),
    contradictions: (report.contradictions ?? []).map((item) => ({
      ...item,
      kept: reviveMemory(item.kept),
      demoted: reviveMemory(item.demoted)
    }))
  };
}

export function toDate(value: string | Date | undefined): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date();
}

export function healthFromMemories(memories: Memory[]) {
  const active = memories.filter((memory) => !memory.archivedAt);
  const averageTrust = active.length ? active.reduce((total, memory) => total + memory.trust, 0) / active.length : 1;
  const now = Date.now();
  const freshness = active.length
    ? active.reduce((total, memory) => total + Math.max(0, 1 - ((now - memory.updatedAt.getTime()) / (90 * 86_400_000))), 0) / active.length
    : 1;
  const healthScore = Math.max(0, Math.min(1, averageTrust * 0.7 + freshness * 0.3));
  return { active: active.length, averageTrust, freshness, healthScore };
}

export function mapMarketplaceModule(raw: unknown): MarketplaceModuleCard {
  const item = raw as {
    id?: string;
    kind?: MarketplaceModuleCard["kind"];
    name?: string;
    version?: string;
    description?: string;
    installState?: "available" | "installed";
    status?: "available" | "installed";
    manifest?: Record<string, unknown>;
    security?: { status?: string };
  };
  return {
    id: item.id ?? "unknown-module",
    kind: item.kind ?? "domain",
    name: item.name ?? item.id ?? "Unnamed module",
    version: item.version ?? "0.0.0",
    status: item.installState ?? item.status ?? "available",
    summary: item.description ?? "Runtime module from the marketplace API.",
    manifest: item.manifest ?? {},
    securityStatus: item.security?.status
  };
}

