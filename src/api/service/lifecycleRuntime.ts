import type { FeedbackEvent, FeedbackKind, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, InjectionFeedbackEvent, InjectionFeedbackReport, Memory, MemoryInput, SourceRevalidationResult, VerificationQueueReport, VerificationResolutionReport } from "../../core";
import { clamp01, contentHash, feedbackDelta, safeGet } from "./helpers";
import { dreamInputForHarnessEvent, sourceRevalidationSummary } from "./dreamHelpers";

export function verificationQueue(service: any, userId: string): VerificationQueueReport {
    const now = new Date();
    const items = (service.store.list(userId) as Memory[])
      .filter((memory) => !memory.archivedAt)
      .filter((memory) => memory.beliefState === "needs_verification" || memory.beliefState === "contradicted" || Boolean(memory.temporal.verificationDueAt && new Date(memory.temporal.verificationDueAt) <= now))
      .map((memory) => ({
        memoryId: memory.id,
        content: memory.content,
        beliefState: memory.beliefState,
        trust: memory.trust,
        importance: memory.importance,
        verificationDueAt: memory.temporal.verificationDueAt,
        reason: memory.beliefState === "contradicted" ? "contradiction needs operator review" : memory.beliefState === "needs_verification" ? "belief state requires verification" : "verification due date elapsed"
      }))
      .sort((a, b) => (b.importance * b.trust) - (a.importance * a.trust));
    return { userId, generatedAt: now.toISOString(), items };
  }

export function revalidateMemory(service: any, memoryId: string, userId?: string): SourceRevalidationResult {
    return service.revalidateMemorySourceRef(memoryId, userId);
  }

export function resolveVerificationQueue(service: any, userId: string, options: { limit?: number; connectorIds?: string[] } = {}): VerificationResolutionReport {
    const connectorIds = new Set(options.connectorIds ?? []);
    const queue = (service.verificationQueue(userId).items as VerificationQueueReport["items"])
      .filter((item) => {
        const memory = service.store.get(item.memoryId);
        const connectorId = memory.provenance.sourceRef?.connectorId;
        return !connectorIds.size || connectorIds.has(connectorId ?? "");
      })
      .slice(0, options.limit ?? 100);
    const results = queue.map((item) => service.revalidateMemorySourceRef(item.memoryId, userId) as SourceRevalidationResult);
    const resolved = results.filter((result) => result.status === "confirmed" || result.status === "superseded" || result.status === "contradicted" || result.status === "source_missing" || result.status === "source_updated").length;
    const report: VerificationResolutionReport = { userId, generatedAt: new Date().toISOString(), resolved, results };
    service.recordAudit("reflect.run", { userId, metadata: { resource: "verification-resolver", evaluated: results.length, resolved, summary: sourceRevalidationSummary(results) } });
    service.persist();
    return report;
  }

export function confirmMemory(service: any, memoryId: string, userId?: string): Memory {
    const memory = service.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot confirm memory ${memoryId}`);
    const confirmed = service.update(memoryId, {
      beliefState: "active",
      temporal: { ...memory.temporal, lastConfirmedAt: new Date().toISOString(), verificationDueAt: undefined, stalenessRisk: 0 },
      metadata: { verification: { status: "confirmed", at: new Date().toISOString() } }
    });
    service.recordAudit("memory.update", { userId: confirmed.userId, memoryId, metadata: { action: "confirm" } });
    return confirmed;
  }

export function recordHarnessAction(service: any, input: HarnessActionInput): Memory {
    return service.add(harnessActionMemoryInput(input));
  }

export async function recordHarnessActionAsync(service: any, input: HarnessActionInput): Promise<Memory> {
    return service.addAsync(harnessActionMemoryInput(input));
  }

function harnessActionMemoryInput(input: HarnessActionInput): MemoryInput {
    const passed = input.tests?.filter((test) => test.status === "passed").map((test) => test.name) ?? [];
    const failed = input.tests?.filter((test) => test.status === "failed").map((test) => test.name) ?? [];
    const content = input.content ?? [
      input.command ? `Command executed: ${input.command}.` : undefined,
      input.cwd ? `Working directory: ${input.cwd}.` : undefined,
      input.envRequirements?.length ? `Environment requirements: ${input.envRequirements.join(", ")}.` : undefined,
      input.environmentHints?.length ? `Environment hints: ${input.environmentHints.join(", ")}.` : undefined,
      typeof input.exitCode === "number" ? `Exit code: ${input.exitCode}.` : undefined,
      typeof input.durationMs === "number" ? `Duration: ${input.durationMs}ms.` : undefined,
      input.outputSummary ? `Output summary: ${input.outputSummary}.` : undefined,
      input.failureReason ? `Failure reason: ${input.failureReason}.` : undefined,
      input.successReason ? `Success reason: ${input.successReason}.` : undefined,
      input.filesChanged?.length ? `Files changed: ${input.filesChanged.join(", ")}.` : undefined,
      input.filesTouched?.length ? `Files touched: ${input.filesTouched.join(", ")}.` : undefined,
      passed.length ? `Tests passed: ${passed.join(", ")}.` : undefined,
      failed.length ? `Tests failed: ${failed.join(", ")}.` : undefined,
      input.pullRequest ? `Pull request created: ${input.pullRequest}.` : undefined,
      input.errorFixed ? `Fixed error: ${input.errorFixed}.` : undefined
    ].filter(Boolean).join(" ");
    return {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      content: content || "Harness action completed.",
      type: "episodic",
      layer: "episodic",
      source: { kind: "tool", confidence: failed.length ? 0.72 : 0.9 },
      tags: [
        "harness-action",
        "engineering:tool_outcome",
        ...(input.command ? ["command"] : []),
        ...(input.tests?.length ? ["tests"] : []),
        ...(failed.length || (typeof input.exitCode === "number" && input.exitCode !== 0) ? ["test-failure"] : []),
        ...(passed.length && !failed.length && (input.exitCode ?? 0) === 0 ? ["success-pattern"] : []),
        ...(input.errorFixed ? ["fix"] : [])
      ],
      entities: [...(input.filesChanged ?? []), ...(input.command ? [firstCommandToken(input.command)] : [])],
      temporal: { eventAt: input.timestamp ?? new Date().toISOString(), lastConfirmedAt: failed.length ? undefined : new Date().toISOString(), verificationDueAt: failed.length ? new Date(Date.now() + 7 * 86_400_000).toISOString() : undefined },
      metadata: {
        action: {
          command: input.command,
          cwd: input.cwd,
          envRequirements: input.envRequirements ?? [],
          environmentHints: input.environmentHints ?? [],
          exitCode: input.exitCode,
          durationMs: input.durationMs,
          outputSummary: input.outputSummary,
          failureReason: input.failureReason,
          successReason: input.successReason,
          filesChanged: input.filesChanged ?? [],
          filesTouched: input.filesTouched ?? input.filesChanged ?? [],
          tests: input.tests ?? [],
          pullRequest: input.pullRequest,
          errorFixed: input.errorFixed,
          benchmarkScenarioId: input.benchmarkScenarioId,
          evidencePackId: input.evidencePackId
        },
        engineering: {
          kind: "tool_outcome",
          codebase: { repo: input.projectId, harness: input.agentId, currentPath: input.cwd },
          confidence: failed.length ? 0.72 : 0.9,
          command: input.command,
          cwd: input.cwd,
          envRequirements: input.envRequirements ?? [],
          environmentHints: input.environmentHints ?? [],
          exitCode: input.exitCode,
          durationMs: input.durationMs,
          outputSummary: input.outputSummary,
          failureReason: input.failureReason,
          successReason: input.successReason,
          successPattern: input.successReason ?? (passed.length && !failed.length ? `Command ${input.command ?? "tool"} passed ${passed.join(", ")}` : undefined),
          filesChanged: input.filesChanged ?? [],
          filesTouched: input.filesTouched ?? input.filesChanged ?? [],
          testOutputSummary: [...passed.map((name) => `passed:${name}`), ...failed.map((name) => `failed:${name}`)].join(", "),
          evidenceIds: input.evidencePackId ? [input.evidencePackId] : []
        }
      }
    };
  }

export function recordHarnessLifecycleEvent(service: any, input: HarnessLifecycleEventInput): HarnessLifecycleEventReport {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const eventLabel = input.event.replace(/_/g, " ");
    const content = input.content ?? [
      `Harness event: ${eventLabel}.`,
      input.command ? `Command: ${input.command}.` : undefined,
      input.cwd ? `Working directory: ${input.cwd}.` : undefined,
      typeof input.exitCode === "number" ? `Exit code: ${input.exitCode}.` : undefined,
      input.failureReason ? `Failure reason: ${input.failureReason}.` : undefined,
      input.successReason ? `Success reason: ${input.successReason}.` : undefined,
      input.filesChanged?.length ? `Files changed: ${input.filesChanged.join(", ")}.` : undefined,
      input.tests?.length ? `Tests: ${input.tests.map((test) => `${test.status}:${test.name}`).join(", ")}.` : undefined,
      input.outputSummary ? `Output summary: ${input.outputSummary}.` : undefined
    ].filter(Boolean).join(" ");
    const eventMemory = service.add({
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      content,
      type: input.event === "user_corrected" ? "feedback" : "episodic",
      layer: input.event === "user_corrected" ? "long_term" : "episodic",
      source: { kind: input.event === "user_corrected" ? "human" : "tool", confidence: input.event === "user_corrected" ? 0.95 : 0.82 },
      tags: [
        "harness-event",
        `harness:${input.event}`,
        ...(input.event.includes("failed") ? ["test-failure"] : []),
        ...(input.event === "user_corrected" ? ["engineering-correction", "correction"] : []),
        ...(input.event === "release_candidate" ? ["release"] : [])
      ],
      entities: [...(input.filesChanged ?? []), ...(input.command ? [firstCommandToken(input.command)] : [])],
      temporal: { eventAt: timestamp },
      metadata: {
        harnessEvent: {
          event: input.event,
          harnessRunId: input.harnessRunId,
          command: input.command,
          cwd: input.cwd,
          exitCode: input.exitCode,
          durationMs: input.durationMs,
          filesChanged: input.filesChanged ?? [],
          filesTouched: input.filesTouched ?? [],
          tests: input.tests ?? [],
          metadata: input.metadata ?? {}
        }
      }
    });
    const shouldRecordAction = Boolean(input.command || input.tests?.length || input.filesChanged?.length || input.failureReason || input.successReason);
    const actionMemory = shouldRecordAction
      ? service.recordHarnessAction({
        userId: input.userId,
        agentId: input.agentId,
        sessionId: input.sessionId,
        appId: input.appId,
        orgId: input.orgId,
        projectId: input.projectId,
        command: input.command ?? input.event,
        cwd: input.cwd,
        exitCode: input.exitCode,
        durationMs: input.durationMs,
        outputSummary: input.outputSummary,
        failureReason: input.failureReason,
        successReason: input.successReason,
        filesChanged: input.filesChanged,
        filesTouched: input.filesTouched,
        tests: input.tests,
        timestamp,
        content: input.event === "tool_called" ? undefined : content
      })
      : undefined;
    const dreamInput = dreamInputForHarnessEvent(input);
    const dream = service.prepareDream({
      ...dreamInput,
      run: input.runDream,
      force: input.forceDream ?? dreamInput.force
    });
    service.recordAudit("reflect.run", { userId: input.userId, memoryId: eventMemory.id, metadata: { resource: "harness-lifecycle-event", event: input.event, dreamShouldRun: dream.plan.shouldDream, ranDream: Boolean(dream.report) } });
    service.persist();
    return { eventMemory, actionMemory, dream };
  }

export function retractMemory(service: any, memoryId: string, userId?: string, reason?: string): Memory {
    const memory = service.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot retract memory ${memoryId}`);
    const retracted = service.update(memoryId, {
      beliefState: "retracted",
      trust: 0,
      metadata: { verification: { status: "retracted", at: new Date().toISOString(), reason } }
    });
    service.recordAudit("memory.update", { userId: retracted.userId, memoryId, metadata: { action: "retract", reason } });
    return retracted;
  }

export function feedback(service: any, event: FeedbackEvent): Memory {
    const memory = service.store.get(event.memoryId);
    const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
    const delta = feedbackDelta(event.kind);
    const updated = service.store.update(event.memoryId, {
      trust: clamp01(memory.trust + delta.trust),
      importance: clamp01(memory.importance + delta.importance),
      pinned: event.kind === "always_include" ? true : memory.pinned,
      consent:
        event.kind === "private"
          ? { ...memory.consent, visibility: "private" }
          : event.kind === "shareable"
            ? { ...memory.consent, visibility: "org" }
            : memory.consent,
      metadata: {
        feedback: [...((memory.metadata.feedback as unknown[]) ?? []), { ...event, timestamp }],
        ...(event.kind === "approve_pattern"
          ? { patternReview: { status: "approved", reviewedAt: timestamp, note: event.note } }
          : event.kind === "reject_pattern"
            ? { patternReview: { status: "rejected", reviewedAt: timestamp, note: event.note } }
            : {})
      }
    });
    if (event.kind === "reject_pattern") service.store.archive(event.memoryId);
    service.feedbackEvents.push({ ...event, timestamp });
    service.metrics.feedback += 1;
    service.persist();
    return updated;
  }

export function recordInjectionFeedback(service: any, event: InjectionFeedbackEvent): InjectionFeedbackReport {
    const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
    const accepted = new Set(event.acceptedMemoryIds ?? (event.outcome === "helpful" || event.outcome === "accepted" ? event.injectedMemoryIds : []));
    const rejected = new Set(event.rejectedMemoryIds ?? (event.outcome === "wrong" || event.outcome === "rejected" ? event.injectedMemoryIds : []));
    const updatedMemories: Memory[] = [];
    for (const memoryId of event.injectedMemoryIds) {
      const kind: FeedbackKind | undefined = accepted.has(memoryId) ? "helpful" : rejected.has(memoryId) ? "wrong" : undefined;
      if (!kind || !safeGet(service.store, memoryId)) continue;
      updatedMemories.push(service.feedback({ memoryId, userId: event.userId, kind, note: event.note, timestamp }));
    }
    const trainingSample = service.addTrainingSample({
      query: event.query,
      userId: event.userId,
      selectedMemoryId: event.acceptedMemoryIds?.[0] ?? (event.outcome === "helpful" || event.outcome === "accepted" ? event.injectedMemoryIds[0] : undefined),
      rejectedMemoryIds: event.rejectedMemoryIds ?? (event.outcome === "wrong" || event.outcome === "rejected" ? event.injectedMemoryIds : undefined),
      profileId: event.profileId,
      signals: event.signals,
      outcome: event.outcome,
      timestamp
    });
    const learnedProfile = service.learnRetrievalProfile(event.profileId ?? "learned-injection", "Learned injection feedback", { scope: { userId: event.userId } });
    service.recordAudit("provider.call", { userId: event.userId, metadata: { task: "injection-feedback", query: event.query, injected: event.injectedMemoryIds.length, outcome: event.outcome, learnedSamples: learnedProfile.samples } });
    service.persist();
    return { event: { ...event, timestamp }, updatedMemories, trainingSample, learnedProfile };
  }

function firstCommandToken(command: string): string {
  const trimmed = command.trim();
  for (let index = 0; index < trimmed.length; index += 1) {
    const code = trimmed.charCodeAt(index);
    if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) return trimmed.slice(0, index);
  }
  return trimmed;
}
