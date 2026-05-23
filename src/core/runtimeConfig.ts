import { existsSync, readFileSync } from "node:fs";
import type { LifecyclePolicy } from "./config";
import type { RedactionPolicy } from "./privacy";
import type { RetrievalProfile, RetrievalWeights } from "./types";

export interface RuntimeConfig {
  retrievalWeights?: Partial<RetrievalWeights>;
  retrievalProfiles?: RetrievalProfile[];
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  entityAliases?: Record<string, string[]>;
}

export function loadRuntimeConfig(path = process.env.MEMORY_CONFIG_PATH): RuntimeConfig {
  if (!path || !existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return isRecord(parsed) ? (parsed as RuntimeConfig) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
