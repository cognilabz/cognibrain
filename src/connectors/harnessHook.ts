import {
  estimateTokens,
  type ActionGuardReport,
  type CodebaseScope,
  type CodingContextPack,
  type EngineeringMemoryKind,
  type HarnessActionInput,
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
  filesChanged?: string[];
}

export interface HarnessToolOutcome extends HarnessToolCall {
  exitCode?: number;
  failureReason?: string;
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
        exitCode: outcome.exitCode,
        failureReason: outcome.failureReason,
        benchmarkScenarioId: outcome.benchmarkScenarioId,
        evidencePackId: outcome.evidencePackId,
        filesChanged: outcome.filesChanged,
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
