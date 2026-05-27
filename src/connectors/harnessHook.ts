import {
  estimateTokens,
  type ActionGuardReport,
  type CodebaseScope,
  type CodingContextPack,
  type EngineeringMemoryKind,
  type HarnessActionInput,
  type HarnessLifecycleEventInput,
  type HarnessLifecycleEventReport,
  type Memory,
  type MemoryInput,
  type PatchEvidenceTrail,
  type SearchResult
} from "../core";

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

export interface MemoryApi {
  add(input: MemoryInput): unknown;
  search(input: { userId: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; query: string; limit: number; codebaseScope?: CodebaseScope }): SearchResult[];
  codingContextPack?(input: { userId: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; query: string; limit?: number; tokenBudget?: number; codebaseScope?: CodebaseScope }): CodingContextPack;
  guardAction?(input: { userId: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; action: string; codebaseScope?: CodebaseScope }): ActionGuardReport;
  recordHarnessAction?(input: HarnessActionInput): Memory;
  recordHarnessLifecycleEvent?(input: HarnessLifecycleEventInput): HarnessLifecycleEventReport;
  recordCodeCorrection?(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    evidenceIds?: string[];
  }): Memory;
  patchEvidenceTrail?(input: { userId: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; task: string; codebaseScope?: CodebaseScope; filesChanged?: string[]; commandsRun?: string[]; memoryIds?: string[] }): PatchEvidenceTrail;
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

export interface HarnessToolDecision {
  action: string;
  decision: "allow" | "warn" | "block";
  procedures: SearchResult[];
  memoryContext: string;
  guard?: ActionGuardReport;
  overrideMemory?: Memory;
}

export class HarnessMemoryHook {
  constructor(
    private readonly memory: MemoryApi,
    private readonly options: { maxMemories?: number; tokenBudget?: number } = {}
  ) {}

  beforeLlmCall(context: HarnessContext): HarnessContext & { memoryContext: string; memories: SearchResult[] } {
    const memories = this.memory.search({
      ...scopeFields(context),
      query: context.prompt,
      limit: this.options.maxMemories ?? 6,
      codebaseScope: context.codebaseScope
    });
    const memoryContext = formatMemoryContext(memories, this.options.tokenBudget ?? 900);
    return { ...context, memoryContext, memories };
  }

  startSession(context: HarnessContext): HarnessContext & { memoryContext: string; memories: SearchResult[]; codingContextPack?: CodingContextPack } {
    const prepared = this.beforeLlmCall(context);
    const codingContextPack = this.memory.codingContextPack?.({
      ...scopeFields(context),
      query: context.prompt,
      codebaseScope: context.codebaseScope,
      tokenBudget: this.options.tokenBudget ?? 900,
      limit: this.options.maxMemories ?? 12
    });
    return { ...prepared, codingContextPack };
  }

  beforeToolCall(context: HarnessContext, tool: HarnessToolCall): { action: string; procedures: SearchResult[]; memoryContext: string; guard?: ActionGuardReport } {
    const action = tool.command ?? tool.action ?? tool.name ?? context.prompt;
    const procedures = this.memory.search({
      ...scopeFields(context),
      query: `before ${action} procedure repo policy tool outcome correction forbidden action`,
      limit: this.options.maxMemories ?? 6,
      codebaseScope: context.codebaseScope
    });
    const guard = this.memory.guardAction?.({
      ...scopeFields(context),
      action,
      codebaseScope: context.codebaseScope
    });
    return {
      action,
      procedures,
      memoryContext: formatMemoryContext(procedures, this.options.tokenBudget ?? 900),
      guard
    };
  }

  beforeToolCallDecision(context: HarnessContext, tool: HarnessToolCall, options: { overrideReason?: string; overrideBy?: string } = {}): HarnessToolDecision {
    const prepared = this.beforeToolCall(context, tool);
    const decision = prepared.guard?.severity ?? "allow";
    if (decision !== "block" || !options.overrideReason) {
      return { ...prepared, decision };
    }
    const overrideMemory = this.memory.add({
      ...scopeFields(context),
      content: `Action guard override: ${prepared.action}. Reason: ${options.overrideReason}.`,
      type: "feedback",
      layer: "long_term",
      source: { kind: "human", confidence: 0.9 },
      tags: ["harness-action-guard", "guard-override", "engineering:review_correction"],
      metadata: {
        ...(context.metadata ?? {}),
        actionGuardOverride: {
          action: prepared.action,
          reason: options.overrideReason,
          overrideBy: options.overrideBy,
          guard: prepared.guard
        }
      }
    }) as Memory | undefined;
    return { ...prepared, decision: "warn", overrideMemory };
  }

  afterLlmCall(context: HarnessContext, response: string): void {
    const content = `User asked: ${context.prompt}\nAssistant outcome: ${response}`;
    this.memory.add({
      ...scopeFields(context),
      content,
      type: "episodic",
      layer: "episodic",
      source: { kind: "agent", confidence: 0.6 },
      tags: ["harness-session"],
      metadata: context.metadata ?? {}
    });
  }

  afterToolCall(context: HarnessContext, outcome: HarnessToolOutcome): Memory | undefined {
    const command = outcome.command ?? outcome.action ?? outcome.name;
    if (this.memory.recordHarnessAction) {
      return this.memory.recordHarnessAction({
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
      });
    }
    return this.memory.add({
      ...scopeFields(context),
      content: outcome.content ?? `Harness tool outcome: ${command ?? "tool"} exit=${outcome.exitCode ?? "unknown"}.`,
      type: "episodic",
      layer: "episodic",
      source: { kind: "tool", confidence: outcome.exitCode === 0 ? 0.86 : 0.7 },
      tags: ["harness-action", "engineering:tool_outcome"],
      metadata: { ...(context.metadata ?? {}), action: outcome }
    }) as Memory | undefined;
  }

  captureCorrection(context: HarnessContext, correction: HarnessCorrection): Memory | undefined {
    if (this.memory.recordCodeCorrection) {
      return this.memory.recordCodeCorrection({
        ...scopeFields(context),
        content: correction.content,
        previousMemoryId: correction.previousMemoryId,
        previousWrongAction: correction.previousWrongAction,
        correctAction: correction.correctAction,
        kind: correction.kind,
        codebase: context.codebaseScope,
        source: correction.source,
        evidenceIds: correction.evidenceIds
      });
    }
    return this.memory.add({
      ...scopeFields(context),
      content: correction.content,
      type: "feedback",
      layer: "long_term",
      source: correction.source ?? { kind: "reviewed_code", confidence: 0.86 },
      tags: ["engineering-correction", "correction"],
      metadata: { ...(context.metadata ?? {}), correction }
    }) as Memory | undefined;
  }

  finishPatch(context: HarnessContext, patch: HarnessPatchSummary): PatchEvidenceTrail | undefined {
    return this.memory.patchEvidenceTrail?.({
      ...scopeFields(context),
      task: patch.task ?? context.prompt,
      codebaseScope: context.codebaseScope,
      filesChanged: patch.filesChanged,
      commandsRun: patch.commandsRun,
      memoryIds: patch.memoryIds
    });
  }

  finishSession(context: HarnessContext, event: Omit<HarnessLifecycleEventInput, "userId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">): HarnessLifecycleEventReport | Memory | undefined {
    const input = { ...scopeFields(context), ...event };
    if (this.memory.recordHarnessLifecycleEvent) return this.memory.recordHarnessLifecycleEvent(input);
    return this.memory.add({
      ...scopeFields(context),
      content: event.content ?? `Harness event: ${event.event}.`,
      type: event.event === "user_corrected" ? "feedback" : "episodic",
      layer: event.event === "user_corrected" ? "long_term" : "episodic",
      source: { kind: event.event === "user_corrected" ? "human" : "tool", confidence: event.event === "user_corrected" ? 0.95 : 0.82 },
      tags: ["harness-event", `harness:${event.event}`],
      metadata: { ...(context.metadata ?? {}), harnessEvent: event }
    }) as Memory | undefined;
  }

  prepareHandoff(context: HarnessContext, event: Partial<Omit<HarnessLifecycleEventInput, "userId" | "event">> = {}): HarnessLifecycleEventReport | Memory | undefined {
    return this.finishSession(context, { ...event, event: "handoff", runDream: event.runDream ?? false });
  }

  prepareRelease(context: HarnessContext, event: Partial<Omit<HarnessLifecycleEventInput, "userId" | "event">> = {}): HarnessLifecycleEventReport | Memory | undefined {
    return this.finishSession(context, { ...event, event: "release_candidate", runDream: event.runDream ?? false, forceDream: event.forceDream ?? true });
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

function formatMemoryContext(memories: SearchResult[], tokenBudget: number): string {
  const lines: string[] = [];
  let spent = 0;
  for (const result of memories) {
    const line = `[${result.memory.id}] trust=${result.memory.trust.toFixed(2)} ${result.memory.content}`;
    const tokens = estimateTokens(line);
    if (spent + tokens > tokenBudget) break;
    spent += tokens;
    lines.push(line);
  }
  return lines.join("\n");
}
