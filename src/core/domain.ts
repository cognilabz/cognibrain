import type { LifecyclePolicy } from "./config";
import type { RedactionPolicy } from "./privacy";
import type { DomainEvaluationCase, MemoryInput, RetrievalWeights } from "./types";

export interface DomainModule {
  id: string;
  label: string;
  retrievalWeights?: Partial<RetrievalWeights>;
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  aliases?: Record<string, string[]>;
  evaluationCases?: DomainEvaluationCase[];
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
  aliases: {
    api: ["endpoint", "route"],
    cli: ["command", "terminal"],
    repository: ["repo"],
    package: ["module", "dependency"]
  },
  evaluationCases: [
    {
      id: "coding-api-symbol",
      query: "Which endpoint does CacheClient call?",
      expected: ["/v1/cache", "CacheClient"],
      memories: [
        {
          userId: "domain-eval",
          content: "CacheClient.get calls GET /v1/cache from @scope/pkg.",
          source: { kind: "reviewed_code", confidence: 0.95 },
          tags: ["coding"]
        }
      ]
    }
  ],
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
