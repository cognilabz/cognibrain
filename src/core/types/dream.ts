import type { ReflectionReport } from "./evaluation";
import type { Memory } from "./memory";

export type DreamCycleMode = "reflect" | "dream";
export type DreamCycleTrigger =
  | "manual_reflect"
  | "manual_dream"
  | "auto_write_threshold"
  | "auto_interval"
  | "harness_session_end"
  | "harness_handoff"
  | "before_release"
  | "after_connector_sync"
  | "after_negative_feedback"
  | "after_contradiction_detected";
export type DreamBudget = "quick" | "standard" | "deep" | "release";
export type DreamScopeKind = "session" | "repo" | "branch" | "project" | "connector" | "user" | "org";

export interface DreamCycleScope {
  kind?: DreamScopeKind;
  sessionId?: string;
  projectId?: string;
  orgId?: string;
  repo?: string;
  branch?: string;
  connectorId?: string;
}

export interface DreamCycleInput {
  userId: string;
  trigger?: DreamCycleTrigger;
  mode?: DreamCycleMode;
  scope?: DreamCycleScope;
  budget?: DreamBudget;
  sourceRefresh?: boolean;
  connectorIds?: string[];
  harnessRunId?: string;
  force?: boolean;
}

export interface DreamPlanReport {
  userId: string;
  generatedAt: Date | string;
  trigger: DreamCycleTrigger;
  mode: DreamCycleMode;
  scope?: DreamCycleScope;
  budget: DreamBudget;
  sourceRefresh: boolean;
  connectorIds: string[];
  harnessRunId?: string;
  shouldDream: boolean;
  forced: boolean;
  reasons: string[];
  recommendedActions: string[];
  releaseBlockers?: string[];
  signals: {
    activeMemories: number;
    writesSinceDream: number;
    writeThreshold: number;
    dueByWriteThreshold: boolean;
    dueByInterval: boolean;
    hoursSinceLastDream?: number;
    verificationQueue: number;
    contradictions: number;
    needsVerification: number;
    staleSourceRefs: number;
    sourceRefs: number;
    connectorCandidates: number;
  };
}

export interface DreamCycleSummary {
  trigger: DreamCycleTrigger;
  mode: DreamCycleMode;
  budget: DreamBudget;
  sourceRefresh: boolean;
  connectorIds: string[];
  harnessRunId?: string;
  blocked: boolean;
  verificationScheduled: number;
  connectorRefresh?: DreamConnectorRefreshReport;
  sourceRevalidation?: SourceRevalidationReport;
  verificationResolution?: VerificationResolutionReport;
  plan: DreamPlanReport;
}

export interface DreamCycleReport extends ReflectionReport {
  dreamCycle: DreamCycleSummary;
}

export interface DreamPreparationReport {
  plan: DreamPlanReport;
  report?: DreamCycleReport;
}

export interface DreamJob {
  jobId: string;
  userId: string;
  status: "queued" | "running" | "done" | "succeeded" | "failed" | "cancelled" | "retrying";
  trigger: DreamCycleTrigger;
  mode: DreamCycleMode;
  queuedAt: Date | string;
  startedAt?: Date | string;
  finishedAt?: Date | string;
  progress: {
    connectorPolls: number;
    connectorPollFailures?: number;
    connectorPollSkipped?: number;
    memoriesEvaluated: number;
    contradictions: number;
    sourceRevalidations: number;
    verificationScheduled: number;
  };
  plan: DreamPlanReport;
  input?: DreamCycleInput;
  retryOf?: string;
  report?: DreamCycleReport;
  error?: string;
  logs?: Array<{ at: Date | string; level: "info" | "warn" | "error"; message: string; payload?: Record<string, unknown> }>;
}

export interface DreamConnectorRefreshReport {
  generatedAt: Date | string;
  attempted: number;
  applied: number;
  failed: number;
  skipped: number;
  records: Array<{
    connectorId: string;
    recordId?: string;
    status: "queued" | "applied" | "failed";
    memoryIds: string[];
    externalIds: string[];
    error?: string;
    responseStatusCode?: number;
  }>;
  skippedConnectors: Array<{
    connectorId: string;
    reason: string;
  }>;
}

export interface ConnectorSyncState {
  connectorId: string;
  cursor?: string;
  lastSuccessfulPollAt?: Date | string;
  lastExternalUpdatedAt?: Date | string;
  etag?: string;
  sourceVersion?: string;
  lastRecordId?: string;
  lastStatus: "queued" | "applied" | "failed" | "never_run";
  records: number;
}

export type SourceRevalidationStatus =
  | "confirmed"
  | "superseded"
  | "contradicted"
  | "source_missing"
  | "source_updated"
  | "needs_operator_review"
  | "skipped";

export interface SourceRevalidationResult {
  memoryId: string;
  connectorId?: string;
  externalId?: string;
  status: SourceRevalidationStatus;
  reason: string;
  sourceMemoryId?: string;
  syncRecordId?: string;
  previousHash?: string;
  currentHash?: string;
  previousVersion?: string;
  currentVersion?: string;
}

export interface SourceRecord {
  sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>;
  content?: string;
  title?: string;
  updatedAt?: Date | string;
  version?: string;
  hash?: string;
  status?: "found" | "missing";
  metadata?: Record<string, unknown>;
}

export interface SourceValidationDecision {
  status: SourceRevalidationStatus;
  reason: string;
  sourceRecord?: SourceRecord;
  beliefState?: Memory["beliefState"];
}

export interface SourceResolver {
  connectorId: string;
  id?: string;
  supports?(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>): boolean;
  fetch?(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): Promise<SourceRecord | { missing: true }>;
  get(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): SourceRecord | undefined;
  compare?(memory: Memory, sourceRecord: SourceRecord): SourceValidationDecision;
}

export interface SourceRevalidationReport {
  userId: string;
  generatedAt: Date | string;
  evaluated: number;
  results: SourceRevalidationResult[];
  summary: Record<SourceRevalidationStatus, number>;
}

export interface VerificationResolutionReport {
  userId: string;
  generatedAt: Date | string;
  resolved: number;
  results: SourceRevalidationResult[];
}

export type HarnessLifecycleEventType =
  | "session_started"
  | "context_injected"
  | "tool_called"
  | "tool_failed"
  | "tool_succeeded"
  | "user_corrected"
  | "patch_created"
  | "tests_failed"
  | "tests_passed"
  | "session_ended"
  | "handoff"
  | "release_candidate";

export interface HarnessLifecycleEventInput {
  userId: string;
  event: HarnessLifecycleEventType;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  harnessRunId?: string;
  content?: string;
  command?: string;
  cwd?: string;
  exitCode?: number;
  durationMs?: number;
  outputSummary?: string;
  failureReason?: string;
  successReason?: string;
  filesChanged?: string[];
  filesTouched?: string[];
  tests?: Array<{ name: string; status: "passed" | "failed" | "skipped"; output?: string }>;
  metadata?: Record<string, unknown>;
  timestamp?: Date | string;
  runDream?: boolean;
  forceDream?: boolean;
  budget?: DreamBudget;
  sourceRefresh?: boolean;
  connectorIds?: string[];
}

export interface HarnessLifecycleEventReport {
  eventMemory: Memory;
  actionMemory?: Memory;
  dream: DreamPreparationReport;
}
