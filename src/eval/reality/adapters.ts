import { existsSync } from "node:fs";
import type { RealityAdapterKind, RealitySystemResult } from "./types";

export interface RealityAdapterContract {
  system: string;
  displayName: string;
  adapterKind: RealityAdapterKind;
  commandEnv?: string;
  packageName?: string;
  majorCompetitor: boolean;
  originalImplementation: boolean;
  profileModelForbidden?: boolean;
}

export const realityAdapters: RealityAdapterContract[] = [
  { system: "cognibrain", displayName: "Cognibrain", adapterKind: "official-cli", majorCompetitor: false, originalImplementation: true },
  { system: "mem0", displayName: "Mem0", adapterKind: "official-sdk", commandEnv: "MEMORY_REALITY_MEM0_COMMAND", packageName: "mem0ai", majorCompetitor: true, originalImplementation: true },
  { system: "zep", displayName: "Zep / Graphiti", adapterKind: "official-api", commandEnv: "MEMORY_REALITY_ZEP_COMMAND", majorCompetitor: true, originalImplementation: true },
  { system: "langmem", displayName: "LangMem / LangGraph", adapterKind: "official-sdk", commandEnv: "MEMORY_REALITY_LANGMEM_COMMAND", packageName: "langmem", majorCompetitor: true, originalImplementation: true },
  { system: "cognee", displayName: "Cognee", adapterKind: "official-sdk", commandEnv: "MEMORY_REALITY_COGNEE_COMMAND", packageName: "cognee", majorCompetitor: true, originalImplementation: true },
  { system: "basicmemory", displayName: "Basic Memory", adapterKind: "official-cli", commandEnv: "MEMORY_REALITY_BASIC_MEMORY_COMMAND", packageName: "basic-memory", majorCompetitor: true, originalImplementation: true },
  { system: "gbrain", displayName: "GBrain", adapterKind: "official-cli", commandEnv: "MEMORY_REALITY_GBRAIN_COMMAND", majorCompetitor: true, originalImplementation: true },
  { system: "projectmem", displayName: "ProjectMem", adapterKind: "official-api", commandEnv: "MEMORY_REALITY_PROJECTMEM_COMMAND", majorCompetitor: true, originalImplementation: true },
  { system: "keyword", displayName: "Keyword baseline", adapterKind: "local-baseline", majorCompetitor: false, originalImplementation: false },
  { system: "profile-model", displayName: "Capability profile model", adapterKind: "profile-model-forbidden", majorCompetitor: false, originalImplementation: false, profileModelForbidden: true }
];

export function configuredAdapters(requested: string[] = ["cognibrain", "mem0", "zep", "langmem", "cognee", "basicmemory", "gbrain", "keyword"]) {
  const wanted = new Set(requested.map((item) => item.trim()).filter(Boolean));
  return realityAdapters.filter((adapter) => wanted.has(adapter.system));
}

export function contractResult(adapter: RealityAdapterContract): Pick<RealitySystemResult, "adapterKind" | "adapterSource" | "blockingReasons" | "versions"> {
  if (adapter.profileModelForbidden) {
    return {
      adapterKind: "profile-model-forbidden",
      adapterSource: "capability-modeled profile, not an original product run",
      blockingReasons: ["Competitor behavior is capability-modeled, not an original product run."],
      versions: {}
    };
  }
  if (adapter.commandEnv && !process.env[adapter.commandEnv]) {
    return {
      adapterKind: "credential-blocked",
      adapterSource: `${adapter.commandEnv} not configured`,
      blockingReasons: [`${adapter.displayName} requires original implementation command via ${adapter.commandEnv}.`],
      versions: adapter.packageName ? packagePresence(adapter.packageName) : {}
    };
  }
  return {
    adapterKind: adapter.adapterKind,
    adapterSource: adapter.commandEnv ? `${adapter.commandEnv} configured` : "local deterministic baseline",
    blockingReasons: adapter.originalImplementation ? [] : ["Local baseline is diagnostic support, not original competitor evidence."],
    versions: adapter.packageName ? packagePresence(adapter.packageName) : {}
  };
}

function packagePresence(packageName: string) {
  return {
    package: packageName,
    installed: String(existsSync(`node_modules/${packageName}`))
  };
}
