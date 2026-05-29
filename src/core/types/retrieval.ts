import type { ConsentPolicy, FeedbackKind, MemoryScope, PolicyDecision, Provenance, SourceKind, SourceRef } from "./base";
import type { EvidencePack, Memory, MemoryInput, SearchResult } from "./memory";
import type { MemoryExtractionEvent } from "./extraction";

export interface ContextReference {
  type:
    | "github_issue"
    | "github_pull_request"
    | "gitlab_merge_request"
    | "jira_issue"
    | "confluence_page"
    | "url"
    | "issue_or_pr";
  raw: string;
  value: string;
  url?: string;
  connectorHint?: string;
  confidence: number;
}

export interface ExternalContextEvidence {
  id: string;
  connectorId: string;
  source: "reference" | "primary_issue_store" | "primary_knowledge_store" | "default_search";
  reference?: string;
  externalId?: string;
  title: string;
  content: string;
  uri?: string;
  score: number;
  fetchedAt: string;
  provenance: {
    connectorId: string;
    reference?: string;
    sourceUri?: string;
    fetchMode: "list-filter" | "search";
  };
}

export interface ContextEnrichmentReport {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  query: string;
  userId: string;
  references: ContextReference[];
  localEvidence: EvidencePack;
  externalEvidence: ExternalContextEvidence[];
  searchedConnectors: Array<{ connectorId: string; reason: string; status: "applied" | "failed" | "skipped"; items?: number; error?: string }>;
  context: string;
  warnings: string[];
  summary: {
    localMemories: number;
    externalItems: number;
    referencesDetected: number;
    persistedExternalItems: number;
  };
}

export interface RetrievalWeights {
  semantic: number;
  keyword: number;
  entity: number;
  temporal: number;
  behavioral: number;
  trust: number;
  graph: number;
  access: number;
}

export interface RetrievalProfile {
  id: string;
  label: string;
  weights: RetrievalWeights;
  scope?: Partial<Pick<MemoryScope, "userId" | "projectId" | "appId" | "orgId" | "agentId">>;
  learned?: boolean;
  trainingSamples?: number;
  benchmarkDelta?: number;
  updatedAt: Date | string;
  provenance?: string;
}

export interface LearnedProfileReport {
  profile: RetrievalProfile;
  samples: number;
  positiveSignals: Partial<RetrievalWeights>;
  negativeSignals: Partial<RetrievalWeights>;
  lossBefore?: number;
  lossAfter?: number;
}

export interface RetrievalTrainingSample {
  query: string;
  userId: string;
  selectedMemoryId?: string;
  rejectedMemoryIds?: string[];
  profileId?: string;
  signals?: Partial<RetrievalWeights>;
  outcome: "helpful" | "wrong" | "accepted" | "rejected";
  timestamp?: Date | string;
}

export interface ContextVerifier {
  verify(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[];
}

export interface ContextReranker {
  rerank(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[];
}

export interface EvidenceJudgement {
  answerable: boolean;
  confidence: number;
  reason?: string;
  requiredEvidence?: string[];
  decisions?: Array<{
    id: string;
    decision?: SearchResult["decision"];
    confidence?: number;
    reason?: string;
  }>;
}

export interface ContextEvidenceJudge {
  judgeEvidence(input: { query: string; results: SearchResult[]; now: Date }): EvidenceJudgement;
}

export interface ContradictionDetector {
  classify(input: { a: Memory; b: Memory; key?: string }): {
    label: "entailment" | "neutral" | "contradiction";
    confidence: number;
    reason?: string;
  };
}

export interface ReflectionSummarizer {
  summarize(input: { theme: string; memories: Memory[]; now: Date }): {
    content: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface ReflectionEvaluationClaim {
  key: string;
  value: string;
  label?: string;
  confidence?: number;
  reason?: string;
}

export interface ReflectionMemoryEvaluation {
  memoryId: string;
  claims?: ReflectionEvaluationClaim[];
  timeSensitive?: {
    applies: boolean;
    confidence?: number;
    reason?: string;
  };
  behavioralEvidence?: {
    applies: boolean;
    theme?: string;
    confidence?: number;
    reason?: string;
  };
  organization?: {
    layer?: Memory["layer"];
    type?: Memory["type"];
    confidence?: number;
    reason?: string;
  };
}

export interface ReflectionEvaluator {
  evaluateReflection(input: { memories: Memory[]; now: Date }): ReflectionMemoryEvaluation[];
}

export interface MemoryExtractor {
  extract(input: {
    events: MemoryExtractionEvent[];
    scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">;
    existing: Memory[];
    now: Date;
  }): MemoryInput[];
}

export interface EpisodeRecord {
  id: string;
  userId: string;
  scope: MemoryScope;
  rawConversation: MemoryExtractionEvent[];
  toolCalls: Array<{ name?: string; input?: unknown; output?: unknown; timestamp?: Date | string }>;
  filesTouched: string[];
  source?: Provenance;
  hash: string;
  memoryIds: string[];
  createdAt: Date | string;
  retention?: {
    action: "archive" | "delete";
    at: Date | string;
    ruleId?: string;
    reason: string;
    memoryIds: string[];
  };
}

export interface EpisodeInput {
  scope: MemoryScope;
  events: MemoryExtractionEvent[];
  toolCalls?: EpisodeRecord["toolCalls"];
  filesTouched?: string[];
  source?: Provenance;
}

export interface HarnessActionInput {
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  command?: string;
  cwd?: string;
  envRequirements?: string[];
  environmentHints?: string[];
  exitCode?: number;
  durationMs?: number;
  outputSummary?: string;
  failureReason?: string;
  successReason?: string;
  benchmarkScenarioId?: string;
  evidencePackId?: string;
  filesChanged?: string[];
  filesTouched?: string[];
  tests?: Array<{ name: string; status: "passed" | "failed" | "skipped"; output?: string }>;
  pullRequest?: string;
  errorFixed?: string;
  content?: string;
  timestamp?: Date | string;
}
