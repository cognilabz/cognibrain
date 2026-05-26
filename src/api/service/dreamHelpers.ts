import type { DreamCycleInput, DreamCycleTrigger, HarnessLifecycleEventInput, Memory, SourceRevalidationResult, SourceRevalidationStatus } from "../../core";
import { normalizeUrl } from "./helpers";

export function sourceRevalidationSummary(results: SourceRevalidationResult[]): Record<SourceRevalidationStatus, number> {
  const statuses: SourceRevalidationStatus[] = ["confirmed", "superseded", "contradicted", "source_missing", "source_updated", "needs_operator_review", "skipped"];
  return Object.fromEntries(statuses.map((status) => [status, results.filter((result) => result.status === status).length])) as Record<SourceRevalidationStatus, number>;
}

export function sourceRefsMatch(a?: Memory["provenance"]["sourceRef"], b?: Memory["provenance"]["sourceRef"]): boolean {
  if (!a || !b) return false;
  if (a.connectorId && b.connectorId && a.connectorId !== b.connectorId) return false;
  if (a.externalId && b.externalId) return a.externalId === b.externalId;
  if (a.url && b.url) return normalizeUrl(a.url) === normalizeUrl(b.url);
  return Boolean(a.hash && b.hash && a.hash === b.hash);
}

export function sourceRefChanged(previous: NonNullable<Memory["provenance"]["sourceRef"]>, current: NonNullable<Memory["provenance"]["sourceRef"]>): boolean {
  if (previous.version && current.version && previous.version !== current.version) return true;
  if (previous.hash && current.hash && previous.hash !== current.hash) return true;
  return false;
}

export function sourceEvidenceTime(memory: Memory): number {
  return new Date(memory.provenance.sourceRef?.timestamp ?? memory.temporal.eventAt ?? memory.createdAt).getTime();
}

export function dreamInputForHarnessEvent(input: HarnessLifecycleEventInput): DreamCycleInput {
  const trigger: DreamCycleTrigger =
    input.event === "session_ended" ? "harness_session_end" :
      input.event === "handoff" ? "harness_handoff" :
        input.event === "release_candidate" ? "before_release" :
          input.event === "user_corrected" ? "after_negative_feedback" :
            input.event === "tests_failed" || input.event === "tool_failed" ? "after_negative_feedback" :
              input.event === "context_injected" ? "manual_reflect" :
                "auto_interval";
  return {
    userId: input.userId,
    trigger,
    mode: trigger === "manual_reflect" ? "reflect" : "dream",
    budget: input.budget ?? (trigger === "before_release" ? "release" : trigger === "harness_handoff" ? "deep" : trigger === "manual_reflect" ? "quick" : "standard"),
    sourceRefresh: input.sourceRefresh ?? (trigger === "before_release" || trigger === "harness_handoff"),
    connectorIds: input.connectorIds,
    harnessRunId: input.harnessRunId,
    force: input.forceDream,
    scope: {
      kind: input.projectId ? "project" : input.orgId ? "org" : input.sessionId ? "session" : "user",
      sessionId: input.sessionId,
      projectId: input.projectId,
      orgId: input.orgId
    }
  };
}
