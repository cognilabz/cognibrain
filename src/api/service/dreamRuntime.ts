import type { DreamCycleInput, DreamCycleReport, DreamJob, DreamPlanReport, DreamPreparationReport, Memory } from "../../core";
import { budgetForTrigger, contentHash, modeForTrigger, productionPolicyMode, triggerForMode, uniqueStrings } from "./helpers";

export function reflect(service: any, userId: string): DreamCycleReport {
    return service.runDreamCycle({ userId, mode: "reflect", trigger: "manual_reflect" });
  }

export function dream(service: any, userId: string): DreamCycleReport {
    return service.runDreamCycle({ userId, mode: "dream", trigger: "manual_dream" });
  }

export function dreamPlan(service: any, input: DreamCycleInput): DreamPlanReport {
    const now = new Date();
    const mode = input.mode ?? modeForTrigger(input.trigger);
    const trigger = input.trigger ?? triggerForMode(mode);
    const budget = input.budget ?? budgetForTrigger(trigger);
    const status = service.userMaintenance(input.userId);
    const dueByWriteThreshold = status.writesSinceDream >= service.autoDream.writeThreshold;
    const hoursSinceLastDream = status.lastDreamAt ? (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000 : undefined;
    const dueByInterval = hoursSinceLastDream !== undefined && hoursSinceLastDream >= service.autoDream.intervalHours && status.writesSinceDream > 0;
    const canSkipMemoryScan = !input.force &&
      !input.sourceRefresh &&
      budget === "quick" &&
      status.writesSinceDream <= 0 &&
      !dueByWriteThreshold &&
      !dueByInterval &&
      (trigger === "harness_session_end" || trigger === "auto_interval");
    if (canSkipMemoryScan) {
      return {
        userId: input.userId,
        generatedAt: now.toISOString(),
        trigger,
        mode,
        scope: input.scope,
        budget,
        sourceRefresh: false,
        connectorIds: uniqueStrings(input.connectorIds ?? []),
        harnessRunId: input.harnessRunId,
        shouldDream: false,
        forced: false,
        reasons: ["dream not due"],
        recommendedActions: trigger === "harness_session_end" ? ["prepare session-end reflection plan"] : ["schedule verification queue from dream results"],
        releaseBlockers: [],
        signals: {
          activeMemories: 0,
          writesSinceDream: status.writesSinceDream,
          writeThreshold: service.autoDream.writeThreshold,
          dueByWriteThreshold,
          dueByInterval,
          hoursSinceLastDream,
          verificationQueue: 0,
          contradictions: 0,
          needsVerification: 0,
          staleSourceRefs: 0,
          sourceRefs: 0,
          connectorCandidates: (input.connectorIds ?? []).length,
          memoryScanSkipped: true,
          memoryScanReason: "quick dream plan is not due by maintenance counters"
        }
      };
    }
    const active = (service.store.list(input.userId) as Memory[]).filter((memory) => !memory.archivedAt);
    const verificationQueue = active.filter((memory) => memory.beliefState === "needs_verification" || memory.beliefState === "contradicted" || Boolean(memory.temporal.verificationDueAt && new Date(memory.temporal.verificationDueAt) <= now)).length;
    const contradictions = active.filter((memory) => memory.beliefState === "contradicted").length;
    const needsVerification = active.filter((memory) => memory.beliefState === "needs_verification").length;
    const sourceRefs = active.filter((memory) => memory.provenance.sourceRef).length;
    const staleSourceRefs = active.filter((memory) => {
      const sourceRef = memory.provenance.sourceRef;
      if (!sourceRef?.timestamp) return false;
      return (now.getTime() - new Date(sourceRef.timestamp).getTime()) / 86_400_000 > 14;
    }).length;
    const connectorIds = uniqueStrings([
      ...(input.connectorIds ?? []),
      ...active.map((memory) => memory.provenance.sourceRef?.connectorId).filter((item): item is string => Boolean(item))
    ]);
    const reasons: string[] = [];
    if (input.force) reasons.push("forced by caller");
    if (dueByWriteThreshold) reasons.push(`${status.writesSinceDream} writes since last dream meets threshold ${service.autoDream.writeThreshold}`);
    if (dueByInterval) reasons.push(`last dream was ${Math.round(hoursSinceLastDream ?? 0)} hours ago`);
    if (verificationQueue) reasons.push(`${verificationQueue} memories are due for verification`);
    if (contradictions) reasons.push(`${contradictions} active memories are contradicted`);
    if (needsVerification) reasons.push(`${needsVerification} active memories need verification`);
    if (staleSourceRefs) reasons.push(`${staleSourceRefs} source-backed memories have stale source timestamps`);
    if (trigger === "harness_session_end" && status.writesSinceDream > 0) reasons.push("harness session ended after memory writes");
    if (trigger === "harness_handoff" && active.length > 0) reasons.push("handoff needs a prepared memory state");
    if (trigger === "before_release") reasons.push("release preparation requires current memory evidence");
    if (trigger === "after_connector_sync" && connectorIds.length) reasons.push("connector sync changed source-backed evidence");
    if (trigger === "after_negative_feedback") reasons.push("negative feedback should be reflected before reuse");
    if (trigger === "after_contradiction_detected") reasons.push("contradiction signal requires belief revision");
    const releaseBlockers = trigger === "before_release"
      ? [
          ...(contradictions ? [`${contradictions} contradicted memories must be resolved before release`] : []),
          ...(needsVerification ? [`${needsVerification} memories need verification before release`] : []),
          ...(staleSourceRefs ? [`${staleSourceRefs} source-backed memories need source refresh before release`] : [])
        ]
      : [];

    const recommendedActions: string[] = [];
    if (input.sourceRefresh || budget === "deep" || budget === "release") {
      if (connectorIds.length) recommendedActions.push(`poll connectors: ${connectorIds.join(", ")}`);
      if (sourceRefs) recommendedActions.push(`revalidate ${sourceRefs} sourceRefs`);
    }
    if (verificationQueue || contradictions || needsVerification) recommendedActions.push("run belief revision");
    if (mode === "dream") recommendedActions.push("schedule verification queue from dream results");
    if (trigger === "harness_session_end") recommendedActions.push("prepare session-end reflection plan");
    if (trigger === "harness_handoff") recommendedActions.push("prepare handoff context pack evidence");
    if (trigger === "before_release") recommendedActions.push("run release-critical verification");
    if (!recommendedActions.length) recommendedActions.push(mode === "reflect" ? "run quick reflection" : "run standard dream cycle");

    const shouldDream = Boolean(
      input.force ||
      dueByWriteThreshold ||
      dueByInterval ||
      verificationQueue ||
      contradictions ||
      needsVerification ||
      trigger === "before_release" ||
      trigger === "after_negative_feedback" ||
      trigger === "after_contradiction_detected" ||
      (trigger === "after_connector_sync" && connectorIds.length > 0) ||
      (trigger === "harness_session_end" && status.writesSinceDream > 0) ||
      (trigger === "harness_handoff" && active.length > 0)
    );

    return {
      userId: input.userId,
      generatedAt: now.toISOString(),
      trigger,
      mode,
      scope: input.scope,
      budget,
      sourceRefresh: Boolean(input.sourceRefresh || budget === "deep" || budget === "release"),
      connectorIds,
      harnessRunId: input.harnessRunId,
      shouldDream,
      forced: Boolean(input.force),
      reasons: reasons.length ? reasons : ["dream not due"],
      recommendedActions,
      releaseBlockers,
      signals: {
        activeMemories: active.length,
        writesSinceDream: status.writesSinceDream,
        writeThreshold: service.autoDream.writeThreshold,
        dueByWriteThreshold,
        dueByInterval,
        hoursSinceLastDream,
        verificationQueue,
        contradictions,
        needsVerification,
        staleSourceRefs,
        sourceRefs,
        connectorCandidates: connectorIds.length
      }
    };
  }

export function prepareDream(service: any, input: DreamCycleInput & { run?: boolean }): DreamPreparationReport {
    const plan = service.dreamPlan(input);
    const shouldRun = Boolean(input.run && (plan.shouldDream || input.force));
    return {
      plan,
      report: shouldRun ? service.runDreamCycle({ ...input, mode: input.mode ?? plan.mode, trigger: plan.trigger }) : undefined
    };
  }

export function runDreamCycle(service: any, input: DreamCycleInput): DreamCycleReport {
    const mode = input.mode ?? modeForTrigger(input.trigger);
    const trigger = input.trigger ?? triggerForMode(mode);
    const plan = service.dreamPlan({ ...input, mode, trigger });
    const skipSyncSourceResolution = Boolean((input as DreamCycleInput & { __skipSyncSourceResolution?: boolean }).__skipSyncSourceResolution);
    service.enforceRetention(new Date(), input.userId);
    const blocked = service.memoriesDeniedForOperation(input.userId, "dream");
    if (blocked.length) {
      const report = service.blockedReflectionReport(input.userId, mode, blocked);
      return {
        ...report,
        dreamCycle: {
          trigger,
          mode,
          budget: plan.budget,
          sourceRefresh: plan.sourceRefresh,
          connectorIds: plan.connectorIds,
          harnessRunId: input.harnessRunId,
          blocked: true,
          verificationScheduled: 0,
          sourceRevalidation: undefined,
          plan
        }
      };
    }
    const shouldRevalidateSources = mode === "dream" && plan.budget !== "quick" && !skipSyncSourceResolution;
    const sourceRevalidation = shouldRevalidateSources
      ? service.revalidateSourceRefs(input.userId, {
        connectorIds: plan.connectorIds,
        scope: input.scope,
        onlyDue: plan.budget === "standard",
        limit: plan.budget === "standard" ? 100 : plan.budget === "deep" ? 500 : undefined
      })
      : undefined;
    const report = service.reflection.run(input.userId);
    const verificationScheduled = mode === "dream" ? service.scheduleVerificationFromDream(input.userId) : 0;
    const verificationResolution = mode === "dream" && plan.budget === "release" && !skipSyncSourceResolution
      ? service.resolveVerificationQueue(input.userId, { connectorIds: plan.connectorIds.length ? plan.connectorIds : undefined, limit: 250 })
      : undefined;
    if (sourceRevalidation?.evaluated) report.lifecycle.actions.push(`revalidated ${sourceRevalidation.evaluated} source-backed memories`);
    if (verificationScheduled) report.lifecycle.actions.push(`scheduled ${verificationScheduled} memories from dream verification queue`);
    if (verificationResolution?.resolved) report.lifecycle.actions.push(`resolved ${verificationResolution.resolved} verification queue items`);
    service.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    service.recordAudit("reflect.run", {
      userId: input.userId,
      metadata: {
        created: report.created.length,
        demoted: report.demoted.length,
        contradictions: report.contradictions.length,
        trigger,
        mode,
        budget: plan.budget,
        sourceRefresh: plan.sourceRefresh,
        connectorIds: plan.connectorIds,
        harnessRunId: input.harnessRunId,
        verificationScheduled,
        sourceRevalidation,
        verificationResolution
      }
    });
    service.markDreamed(input.userId);
    service.persist();
    return {
      ...report,
      dreamCycle: {
        trigger,
        mode,
        budget: plan.budget,
        sourceRefresh: plan.sourceRefresh,
        connectorIds: plan.connectorIds,
        harnessRunId: input.harnessRunId,
        blocked: false,
        verificationScheduled,
        sourceRevalidation,
        verificationResolution,
        plan
      }
    };
  }

export async function runDreamCycleAsync(service: any, input: DreamCycleInput, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<DreamCycleReport> {
    const mode = input.mode ?? modeForTrigger(input.trigger);
    const trigger = input.trigger ?? triggerForMode(mode);
    const plan = service.dreamPlan({ ...input, mode, trigger });
    const connectorRefresh = mode === "dream" && plan.sourceRefresh
      ? await service.refreshDreamSources({ ...input, mode, trigger }, plan, fetchImpl, timeoutMs)
      : undefined;
    const shouldRevalidateSources = mode === "dream" && plan.budget !== "quick";
    const liveSourceRevalidation = shouldRevalidateSources
      ? await service.revalidateSourceRefsAsync(input.userId, {
        connectorIds: plan.connectorIds,
        scope: input.scope,
        onlyDue: plan.budget === "standard",
        limit: plan.budget === "standard" ? 100 : plan.budget === "deep" ? 500 : undefined
      })
      : undefined;
    const report = service.runDreamCycle({ ...input, mode, trigger, connectorIds: plan.connectorIds, sourceRefresh: plan.sourceRefresh, __skipSyncSourceResolution: true });
    if (liveSourceRevalidation?.evaluated) {
      report.dreamCycle.sourceRevalidation = liveSourceRevalidation;
      report.lifecycle.actions.push(`live-revalidated ${liveSourceRevalidation.evaluated} source-backed memories`);
    }
    const liveVerificationResolution = mode === "dream" && plan.budget === "release"
      ? await service.resolveVerificationQueueAsync(input.userId, { connectorIds: plan.connectorIds.length ? plan.connectorIds : undefined, limit: 250 })
      : undefined;
    if (liveVerificationResolution?.resolved) {
      report.dreamCycle.verificationResolution = liveVerificationResolution;
      report.lifecycle.actions.push(`live-resolved ${liveVerificationResolution.resolved} verification queue items`);
    }
    if (connectorRefresh) {
      report.dreamCycle.connectorRefresh = connectorRefresh;
      if (connectorRefresh.attempted || connectorRefresh.skipped) {
        report.lifecycle.actions.push(`connector refresh applied ${connectorRefresh.applied}/${connectorRefresh.attempted} polls before dream`);
      }
      service.recordAudit("reflect.run", {
        userId: input.userId,
        metadata: {
          resource: "dream-source-refresh",
          trigger,
          mode,
          attempted: connectorRefresh.attempted,
          applied: connectorRefresh.applied,
          failed: connectorRefresh.failed,
          skipped: connectorRefresh.skipped
        }
      });
    }
    if (connectorRefresh || liveSourceRevalidation?.evaluated || liveVerificationResolution?.results.length) service.persist();
    return report;
  }

export async function startDreamJob(service: any, input: DreamCycleInput, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000), options: { wait?: boolean; queueOnly?: boolean } = {}): Promise<DreamJob> {
    const mode = input.mode ?? modeForTrigger(input.trigger);
    const trigger = input.trigger ?? triggerForMode(mode);
    const plan = service.dreamPlan({ ...input, mode, trigger });
    const queuedAt = new Date().toISOString();
    const job: DreamJob = {
      jobId: `dream_${contentHash(`${input.userId}:${trigger}:${Date.now()}:${service.dreamJobs.size}`).slice(2)}`,
      userId: input.userId,
      status: "queued",
      trigger,
      mode,
      queuedAt,
      priority: dreamJobPriority(plan.budget),
      attemptCount: 0,
      nextRunAt: queuedAt,
      progress: { connectorPolls: 0, memoriesEvaluated: 0, contradictions: 0, sourceRevalidations: 0, verificationScheduled: 0 },
      plan,
      input: { ...input, mode, trigger },
      logs: [{ at: queuedAt, level: "info", message: "dream job queued", payload: { trigger, mode, durable: true } }]
    };
    const repository = service.productionAsyncRepository?.dreamJobRepository;
    if (repository?.queue) {
      const queued = await repository.queue(job);
      service.dreamJobs.set(queued.jobId, queued);
      if (options.queueOnly) return queued;
      if (productionDreamWorkerMode()) return queued;
      if (options.wait) return (await runDreamJobWorkerOnce(service, fetchImpl, timeoutMs)) ?? queued;
      return queued;
    }
    assertProductionDreamRepositoryAvailable("queue dream jobs");
    service.dreamJobs.set(job.jobId, job);
    service.persist();
    if (options.queueOnly) return job;
    const execution = service.executeDreamJob(job, input, mode, trigger, fetchImpl, timeoutMs);
    if (options.wait) await execution;
    return job;
  }

export async function runDreamJobWorkerOnce(service: any, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000), options: { now?: string } = {}): Promise<DreamJob | undefined> {
    const repository = service.productionAsyncRepository?.dreamJobRepository;
    if (repository?.claimDueJob) {
      const workerId = process.env.MEMORY_DREAM_WORKER_ID ?? `pid-${process.pid}`;
      const claimed = await repository.claimDueJob({
        workerId,
        now: options.now,
        leaseMs: Number(process.env.MEMORY_DREAM_JOB_LEASE_MS ?? 300_000)
      });
      if (!claimed) return undefined;
      service.dreamJobs.set(claimed.jobId, claimed);
      const input = claimed.input ?? { userId: claimed.userId, trigger: claimed.trigger, mode: claimed.mode, budget: claimed.plan.budget, sourceRefresh: claimed.plan.sourceRefresh, connectorIds: claimed.plan.connectorIds };
      await service.executeDreamJob(claimed, input, claimed.mode, claimed.trigger, fetchImpl, timeoutMs, { alreadyLeased: true });
      const finished = service.dreamJobs.get(claimed.jobId) ?? claimed;
      if (repository.completeJob) await repository.completeJob(finished.jobId, finished);
      return finished;
    }
    assertProductionDreamRepositoryAvailable("claim and execute dream jobs");
    const now = options.now ? new Date(options.now).getTime() : Date.now();
    const due = [...service.dreamJobs.values()]
      .filter((job: DreamJob) => {
        if (job.status === "cancelled" || job.status === "done" || job.status === "failed") return false;
        const nextRunAt = job.nextRunAt ? new Date(job.nextRunAt).getTime() : new Date(job.queuedAt).getTime();
        if (nextRunAt > now) return false;
        if (job.status === "running" && job.leaseUntil && new Date(job.leaseUntil).getTime() > now) return false;
        return true;
      })
      .sort((a: DreamJob, b: DreamJob) => (b.priority ?? 0) - (a.priority ?? 0) || new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime())[0];
    if (!due) return undefined;
    const input = due.input ?? { userId: due.userId, trigger: due.trigger, mode: due.mode, budget: due.plan.budget, sourceRefresh: due.plan.sourceRefresh, connectorIds: due.plan.connectorIds };
    await service.executeDreamJob(due, input, due.mode, due.trigger, fetchImpl, timeoutMs);
    return service.dreamJobs.get(due.jobId) ?? due;
  }

export function dreamJobStatus(service: any, jobId?: string): DreamJob[] {
    return [...service.dreamJobs.values()]
      .filter((job) => !jobId || job.jobId === jobId)
      .sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime());
  }

function dreamJobPriority(budget: DreamPlanReport["budget"]): number {
  if (budget === "release") return 100;
  if (budget === "deep") return 75;
  if (budget === "standard") return 50;
  return 25;
}

export function productionDreamWorkerMode(): boolean {
  return productionPolicyMode()
    || process.env.COGNIBRAIN_SECURITY_MODE === "production"
    || process.env.COGNIBRAIN_PRODUCTION_MODE === "true";
}

function assertProductionDreamRepositoryAvailable(action: string): void {
  if (!productionDreamWorkerMode()) return;
  throw new Error(`Production dream jobs require a repository-backed worker queue to ${action}; in-process fallback is disabled.`);
}
