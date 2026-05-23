import type { LifecyclePolicy } from "./config";
import type { RedactionPolicy } from "./privacy";
import type { MemoryInput, RetrievalWeights } from "./types";

export interface DomainModule {
  id: string;
  label: string;
  retrievalWeights?: Partial<RetrievalWeights>;
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  enrich?(input: MemoryInput): MemoryInput;
}

export const GENERAL_DOMAIN_MODULE: DomainModule = {
  id: "general",
  label: "General assistant"
};

export const CODING_DOMAIN_MODULE: DomainModule = {
  id: "coding",
  label: "Coding and developer tools",
  retrievalWeights: { entity: 0.2, graph: 0.1, trust: 0.2 },
  enrich(input) {
    const extraTags = /(?:api|cli|function|class|test|repo|package|endpoint|import)/i.test(input.content) ? ["coding"] : [];
    return { ...input, tags: [...(input.tags ?? []), ...extraTags] };
  }
};

export const STRICT_PRIVACY_DOMAIN_MODULE: DomainModule = {
  id: "strict-privacy",
  label: "Privacy-sensitive assistant",
  redactionPolicy: { mode: "reject" },
  lifecyclePolicy: { archiveAfterDays: 30, fadeAfterDays: 14 }
};
