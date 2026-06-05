import type { FeedbackKind, MemoryScope, Provenance } from "./base";
import type { SearchResult } from "./memory";

export type EngineeringMemoryKind =
  | "repo_policy"
  | "architecture_decision"
  | "review_correction"
  | "tool_outcome"
  | "procedure"
  | "forbidden_action"
  | "migration_note"
  | "test_strategy"
  | "dependency_rule"
  | "generated_file_rule";

export interface CodebaseScope {
  org?: string;
  orgId?: string;
  repo?: string;
  repository?: string;
  branch?: string;
  commit?: string;
  commitRange?: string;
  packageName?: string;
  workspace?: string;
  directory?: string;
  filePattern?: string;
  language?: string;
  framework?: string;
  harness?: string;
  currentPath?: string;
}

export interface EngineeringMemoryMetadata {
  kind: EngineeringMemoryKind;
  codebase: CodebaseScope;
  confidence: number;
  correctionOfMemoryId?: string;
  previousWrongAction?: string;
  correctAction?: string;
  forbiddenAction?: string;
  command?: string;
  cwd?: string;
  envRequirements?: string[];
  environmentHints?: string[];
  exitCode?: number;
  durationMs?: number;
  outputSummary?: string;
  failureReason?: string;
  successReason?: string;
  successPattern?: string;
  filesChanged?: string[];
  filesTouched?: string[];
  testOutputSummary?: string;
  evidenceIds?: string[];
  verificationDueAt?: Date | string;
}

export interface EngineeringMemoryClassification {
  kind?: EngineeringMemoryKind;
  confidence?: number;
  previousWrongAction?: string;
  correctAction?: string;
  forbiddenAction?: string;
  command?: string;
  successPattern?: string;
  reason?: string;
}

export interface EngineeringMemoryClassifier {
  classifyEngineering(input: { content: string; metadata?: Record<string, unknown>; now: Date }): EngineeringMemoryClassification;
}

export interface CodingContextPack {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  query: string;
  userId: string;
  scope?: Partial<MemoryScope> & { codebase?: CodebaseScope };
  tokenBudget: number;
  context: string;
  sections: Array<{
    id:
      | "repo_policies"
      | "procedures_before_action"
      | "previous_corrections"
      | "known_pitfalls"
      | "architecture_decisions"
      | "tool_commands"
      | "forbidden_actions"
      | "graph_temporal_notes";
    title: string;
    evidence: Array<{
      memoryId: string;
      kind?: EngineeringMemoryKind;
      content: string;
	      score: number;
	      trust: number;
      source: Provenance;
      stale: boolean;
      unsafeToInject?: boolean;
      delivery?: "injectable" | "review_required";
      reviewReason?: string;
      verification?: SearchResult["verification"];
      truthExplanation?: string;
      graphPaths?: string[];
    }>;
  }>;
  excludedStaleRules: Array<{ memoryId: string; reason: string; kind?: EngineeringMemoryKind }>;
  evidencePackId?: string;
}

export interface ActionGuardReport {
  schemaVersion: "1.0";
  generatedAt: string;
  userId: string;
  action: string;
  allowed: boolean;
  severity: "allow" | "warn" | "block";
  warnings: string[];
  blockedBy: Array<{ memoryId: string; kind?: EngineeringMemoryKind; reason: string }>;
  alternatives: string[];
  evidenceIds: string[];
}

export interface PatchEvidenceTrail {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  userId: string;
  task: string;
  contextPackId?: string;
  memoryIds: string[];
  correctionIds: string[];
  procedureIds: string[];
  toolOutcomeIds: string[];
  graphPaths: string[];
  excludedStaleRules: Array<{ memoryId: string; reason: string }>;
  memoriesUsed: Array<{ memoryId: string; kind?: EngineeringMemoryKind; content: string; trust: number; citation: string; graphPaths: string[] }>;
  correctionsApplied: Array<{ memoryId: string; content: string; correctAction?: string }>;
  proceduresRecalled: Array<{ memoryId: string; content: string; command?: string }>;
  forbiddenActionsAvoided: Array<{ memoryId: string; content: string; forbiddenAction?: string; alternative?: string }>;
  toolOutcomes: Array<{ memoryId: string; command?: string; cwd?: string; exitCode?: number; durationMs?: number; outputSummary?: string; failureReason?: string; successReason?: string; filesTouched: string[] }>;
  staleMemoriesExcluded: Array<{ memoryId: string; reason: string }>;
  summary: {
    filesChanged: string[];
    commandsRun: string[];
    evidenceCount: number;
  };
}
