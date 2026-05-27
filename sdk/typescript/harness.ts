import type {
  ActionGuardReport,
  CodebaseScope,
  CodingContextPack,
  EngineeringMemoryKind,
  HarnessActionInput,
  HarnessLifecycleEventInput,
  HarnessLifecycleEventReport,
  Memory,
  MemoryInput,
  PatchEvidenceTrail
} from "../../src/core";
import { CognibrainClient, type CognibrainClientOptions } from "./client";

export interface HarnessContext {
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  prompt: string;
  codebaseScope?: CodebaseScope;
  metadata?: Record<string, unknown>;
}

export interface HarnessToolCall {
  name?: string;
  command?: string;
  action?: string;
  cwd?: string;
  envRequirements?: string[];
  environmentHints?: string[];
  filesChanged?: string[];
  filesTouched?: string[];
}

export interface HarnessToolOutcome extends HarnessToolCall {
  exitCode?: number;
  durationMs?: number;
  outputSummary?: string;
  failureReason?: string;
  successReason?: string;
  benchmarkScenarioId?: string;
  evidencePackId?: string;
  tests?: HarnessActionInput["tests"];
  pullRequest?: string;
  errorFixed?: string;
  content?: string;
}

export interface HarnessCorrection {
  content: string;
  previousMemoryId?: string;
  previousWrongAction?: string;
  correctAction?: string;
  kind?: EngineeringMemoryKind;
  source?: MemoryInput["source"];
  evidenceIds?: string[];
}

export interface HarnessPatchSummary {
  task?: string;
  filesChanged?: string[];
  commandsRun?: string[];
  memoryIds?: string[];
}

export class CognibrainHarnessSdk {
  readonly client: CognibrainClient;

  constructor(clientOrOptions: CognibrainClient | CognibrainClientOptions = {}) {
    this.client = clientOrOptions instanceof CognibrainClient ? clientOrOptions : new CognibrainClient(clientOrOptions);
  }

  async startSession(context: HarnessContext): Promise<{ context: HarnessContext; codingContextPack: CodingContextPack; event: HarnessLifecycleEventReport }> {
    const codingContextPack = await this.beforeLlmCall(context);
    const event = await this.client.recordHarnessLifecycleEvent({ ...scopeFields(context), event: "session_started", content: context.prompt, metadata: context.metadata });
    return { context, codingContextPack, event };
  }

  async beforeLlmCall(context: HarnessContext): Promise<CodingContextPack> {
    const pack = await this.client.codingContextPack({
      ...scopeFields(context),
      query: context.prompt,
      codebaseScope: context.codebaseScope
    });
    await this.client.recordHarnessLifecycleEvent({ ...scopeFields(context), event: "context_injected", content: context.prompt, metadata: context.metadata });
    return pack;
  }

  async beforeToolCall(context: HarnessContext, tool: HarnessToolCall): Promise<{ action: string; guard: ActionGuardReport; event: HarnessLifecycleEventReport }> {
    const action = tool.command ?? tool.action ?? tool.name ?? context.prompt;
    const guard = await this.client.guardAction({ ...scopeFields(context), action, codebaseScope: context.codebaseScope });
    const event = await this.client.recordHarnessLifecycleEvent({
        ...scopeFields(context),
        event: "tool_called",
        command: action,
        cwd: tool.cwd,
        filesChanged: tool.filesChanged,
        filesTouched: tool.filesTouched,
        metadata: { ...(context.metadata ?? {}), tool }
      });
    return { action, guard, event };
  }

  async afterToolCall(context: HarnessContext, outcome: HarnessToolOutcome): Promise<{ action: Memory; event: HarnessLifecycleEventReport }> {
    const command = outcome.command ?? outcome.action ?? outcome.name;
    const actionInput: HarnessActionInput = {
      ...scopeFields(context),
      command,
      cwd: outcome.cwd,
      envRequirements: outcome.envRequirements,
      environmentHints: outcome.environmentHints,
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
      outputSummary: outcome.outputSummary,
      failureReason: outcome.failureReason,
      successReason: outcome.successReason,
      benchmarkScenarioId: outcome.benchmarkScenarioId,
      evidencePackId: outcome.evidencePackId,
      filesChanged: outcome.filesChanged,
      filesTouched: outcome.filesTouched,
      tests: outcome.tests,
      pullRequest: outcome.pullRequest,
      errorFixed: outcome.errorFixed,
      content: outcome.content
    };
    const action = await this.client.recordAction(actionInput);
    const event = await this.client.recordHarnessLifecycleEvent({
        ...scopeFields(context),
        event: outcome.exitCode && outcome.exitCode !== 0 ? "tool_failed" : "tool_succeeded",
        command,
        cwd: outcome.cwd,
        exitCode: outcome.exitCode,
        durationMs: outcome.durationMs,
        outputSummary: outcome.outputSummary,
        failureReason: outcome.failureReason,
        successReason: outcome.successReason,
        filesChanged: outcome.filesChanged,
        filesTouched: outcome.filesTouched,
        tests: outcome.tests,
        content: outcome.content,
        metadata: context.metadata
      });
    return { action, event };
  }

  async captureCorrection(context: HarnessContext, correction: HarnessCorrection): Promise<{ correction: Memory; event: HarnessLifecycleEventReport }> {
    const memory = await this.client.recordCodeCorrection({
        ...scopeFields(context),
        content: correction.content,
        previousMemoryId: correction.previousMemoryId,
        previousWrongAction: correction.previousWrongAction,
        correctAction: correction.correctAction,
        kind: correction.kind,
        codebase: context.codebaseScope,
        evidenceIds: correction.evidenceIds
      });
    const event = await this.client.recordHarnessLifecycleEvent({
        ...scopeFields(context),
        event: "user_corrected",
        content: correction.content,
        metadata: { ...(context.metadata ?? {}), correction }
      });
    return { correction: memory, event };
  }

  async finishPatch(context: HarnessContext, patch: HarnessPatchSummary): Promise<{ trail: PatchEvidenceTrail; event: HarnessLifecycleEventReport }> {
    const trail = await this.client.patchEvidenceTrail({
        ...scopeFields(context),
        task: patch.task ?? context.prompt,
        codebaseScope: context.codebaseScope,
        filesChanged: patch.filesChanged,
        commandsRun: patch.commandsRun,
        memoryIds: patch.memoryIds
      });
    const event = await this.client.recordHarnessLifecycleEvent({
        ...scopeFields(context),
        event: "patch_created",
        content: patch.task ?? context.prompt,
        filesChanged: patch.filesChanged,
        metadata: { ...(context.metadata ?? {}), patch }
      });
    return { trail, event };
  }

  prepareHandoff(context: HarnessContext, event: Partial<Omit<HarnessLifecycleEventInput, "userId" | "event">> = {}): Promise<HarnessLifecycleEventReport> {
    return this.client.recordHarnessLifecycleEvent({ ...scopeFields(context), ...event, event: "handoff" });
  }

  prepareRelease(context: HarnessContext, event: Partial<Omit<HarnessLifecycleEventInput, "userId" | "event">> = {}): Promise<HarnessLifecycleEventReport> {
    return this.client.recordHarnessLifecycleEvent({ ...scopeFields(context), ...event, event: "release_candidate", forceDream: event.forceDream ?? true });
  }
}

function scopeFields(context: HarnessContext) {
  return {
    userId: context.userId,
    agentId: context.agentId,
    sessionId: context.sessionId,
    appId: context.appId,
    orgId: context.orgId,
    projectId: context.projectId
  };
}
