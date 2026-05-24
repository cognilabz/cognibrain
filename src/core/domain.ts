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

export const RESEARCH_DOMAIN_MODULE: DomainModule = {
  id: "research",
  label: "Research and citations",
  retrievalWeights: { semantic: 0.3, trust: 0.24, temporal: 0.12 },
  aliases: { paper: ["publication", "study"], citation: ["source", "reference"] },
  enrich(input) {
    return /(?:paper|study|citation|source|doi|arxiv)/i.test(input.content) ? { ...input, tags: [...(input.tags ?? []), "research"] } : input;
  }
};

export const LEGAL_DOMAIN_MODULE: DomainModule = {
  id: "legal",
  label: "Legal and contracts",
  retrievalWeights: { trust: 0.3, temporal: 0.18, keyword: 0.24 },
  redactionPolicy: { mode: "redact" },
  aliases: { contract: ["agreement", "clause"], regulation: ["law", "statute"] },
  enrich(input) {
    return /(?:contract|clause|regulation|statute|gdpr|policy)/i.test(input.content) ? { ...input, tags: [...(input.tags ?? []), "legal"] } : input;
  }
};

export const FINANCE_DOMAIN_MODULE: DomainModule = {
  id: "finance",
  label: "Finance and controls",
  retrievalWeights: { trust: 0.28, temporal: 0.2, entity: 0.2 },
  aliases: { invoice: ["bill", "payment"], revenue: ["arr", "mrr"] },
  enrich(input) {
    return /(?:invoice|revenue|payment|forecast|budget|audit)/i.test(input.content) ? { ...input, tags: [...(input.tags ?? []), "finance"] } : input;
  }
};

export const SALES_DOMAIN_MODULE: DomainModule = {
  id: "sales",
  label: "Sales and customer revenue",
  retrievalWeights: { entity: 0.22, temporal: 0.18, trust: 0.22, keyword: 0.2 },
  aliases: {
    account: ["customer", "prospect", "client"],
    opportunity: ["deal", "pipeline"],
    champion: ["buyer", "sponsor"]
  },
  evaluationCases: [
    {
      id: "sales-opportunity-owner",
      query: "Who owns the renewal opportunity for Acme?",
      expected: ["Acme", "renewal", "Mira"],
      memories: [
        {
          userId: "domain-eval",
          content: "Mira owns the Acme renewal opportunity and tracks the champion in the enterprise pipeline.",
          source: { kind: "human", confidence: 0.94 },
          tags: ["sales"]
        }
      ]
    }
  ],
  enrich(input) {
    return /(?:account|customer|prospect|client|opportunity|deal|pipeline|renewal|champion|buyer|sponsor|sales)/i.test(input.content)
      ? { ...input, tags: [...(input.tags ?? []), "sales"] }
      : input;
  }
};

export const SUPPORT_DOMAIN_MODULE: DomainModule = {
  id: "support",
  label: "Support and customer operations",
  retrievalWeights: { temporal: 0.22, trust: 0.24, entity: 0.2, keyword: 0.2 },
  aliases: {
    ticket: ["case", "issue"],
    incident: ["outage", "escalation"],
    customer: ["user", "requester"]
  },
  evaluationCases: [
    {
      id: "support-escalation-status",
      query: "Which support case is escalated?",
      expected: ["ticket", "escalated", "Atlas"],
      memories: [
        {
          userId: "domain-eval",
          content: "Support ticket Atlas-42 is escalated after the customer reported a failed sync.",
          source: { kind: "transcript", confidence: 0.9 },
          tags: ["support"]
        }
      ]
    }
  ],
  enrich(input) {
    return /(?:support|ticket|case|issue|incident|outage|escalation|sla|customer|requester)/i.test(input.content)
      ? { ...input, tags: [...(input.tags ?? []), "support"] }
      : input;
  }
};

export const HEALTHCARE_DOMAIN_MODULE: DomainModule = {
  id: "healthcare",
  label: "Healthcare privacy",
  retrievalWeights: { trust: 0.32, temporal: 0.18, semantic: 0.22 },
  redactionPolicy: { mode: "redact" },
  lifecyclePolicy: { archiveAfterDays: 45, fadeAfterDays: 21 },
  aliases: { patient: ["member", "subject"], medication: ["medicine", "drug"] },
  enrich(input) {
    return /(?:patient|diagnosis|medication|treatment|clinic|hipaa)/i.test(input.content) ? { ...input, tags: [...(input.tags ?? []), "healthcare"] } : input;
  }
};

export const SECURITY_DOMAIN_MODULE: DomainModule = {
  id: "security",
  label: "Security operations",
  retrievalWeights: { trust: 0.26, temporal: 0.18, graph: 0.12 },
  redactionPolicy: { mode: "redact" },
  aliases: { incident: ["alert", "finding"], vulnerability: ["cve", "weakness"] },
  enrich(input) {
    return /(?:incident|alert|vulnerability|cve|secret|token|iam)/i.test(input.content) ? { ...input, tags: [...(input.tags ?? []), "security"] } : input;
  }
};

export const DOMAIN_MODULES: DomainModule[] = [
  GENERAL_DOMAIN_MODULE,
  CODING_DOMAIN_MODULE,
  RESEARCH_DOMAIN_MODULE,
  LEGAL_DOMAIN_MODULE,
  SALES_DOMAIN_MODULE,
  SUPPORT_DOMAIN_MODULE,
  FINANCE_DOMAIN_MODULE,
  HEALTHCARE_DOMAIN_MODULE,
  SECURITY_DOMAIN_MODULE,
  STRICT_PRIVACY_DOMAIN_MODULE
];
