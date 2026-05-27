import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "../service";
import type { DreamCycleTrigger } from "../../core";
import { json, send, serialize, serializeDreamCycleReport, serializeHarnessLifecycleEvent } from "./helpers";

const dreamTriggerSchema = z.enum(["manual_reflect", "manual_dream", "auto_write_threshold", "auto_interval", "harness_session_end", "harness_handoff", "before_release", "after_connector_sync", "after_negative_feedback", "after_contradiction_detected"]);
const dreamModeSchema = z.enum(["reflect", "dream"]);
const dreamBudgetSchema = z.enum(["quick", "standard", "deep", "release"]);
const dreamScopeSchema = z.object({
  kind: z.enum(["session", "repo", "branch", "project", "connector", "user", "org"]).optional(),
  sessionId: z.string().optional(),
  projectId: z.string().optional(),
  orgId: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  connectorId: z.string().optional()
});
const dreamCycleBodySchema = z.object({
  userId: z.string().min(1),
  trigger: dreamTriggerSchema.optional(),
  mode: dreamModeSchema.optional(),
  scope: dreamScopeSchema.optional(),
  budget: dreamBudgetSchema.optional(),
  sourceRefresh: z.boolean().optional(),
  connectorIds: z.array(z.string()).optional(),
  harnessRunId: z.string().optional(),
  force: z.boolean().optional(),
  run: z.boolean().optional()
});
const dreamJobBodySchema = dreamCycleBodySchema.extend({
  jobId: z.string().optional()
});
const sourceRevalidationBodySchema = z.object({
  userId: z.string().min(1),
  memoryId: z.string().optional(),
  connectorIds: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(500).optional()
});
const connectorSyncStateBodySchema = z.object({
  connectorId: z.string().optional()
});
const harnessLifecycleEventBodySchema = z.object({
  userId: z.string().min(1),
  event: z.enum(["session_started", "context_injected", "tool_called", "tool_failed", "tool_succeeded", "user_corrected", "patch_created", "tests_failed", "tests_passed", "session_ended", "handoff", "release_candidate"]),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  harnessRunId: z.string().optional(),
  content: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  outputSummary: z.string().optional(),
  failureReason: z.string().optional(),
  successReason: z.string().optional(),
  filesChanged: z.array(z.string()).optional(),
  filesTouched: z.array(z.string()).optional(),
  tests: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]), output: z.string().optional() })).optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
  runDream: z.boolean().optional(),
  forceDream: z.boolean().optional(),
  budget: dreamBudgetSchema.optional(),
  sourceRefresh: z.boolean().optional(),
  connectorIds: z.array(z.string()).optional()
});

export async function handleDreamRoutes(input: {
  method: string;
  url: URL;
  parts: string[];
  request: IncomingMessage;
  response: ServerResponse;
}): Promise<boolean> {
  const { method, url, parts, request, response } = input;
    if (method === "POST" && url.pathname === "/dream/plan") {
      const body = dreamCycleBodySchema.parse(await json(request));
      send(response, 200, defaultService.dreamPlan(body));
      return true;
    }

    if (method === "POST" && url.pathname === "/dream/due") {
      const body = dreamCycleBodySchema.parse(await json(request));
      send(response, 200, defaultService.dreamPlan({ ...body, trigger: body.trigger ?? "auto_interval" }));
      return true;
    }

    if (method === "POST" && url.pathname === "/dream/run") {
      const body = dreamCycleBodySchema.parse(await json(request));
      send(response, 202, serializeDreamCycleReport(await defaultService.runDreamCycleAsync({ ...body, mode: body.mode ?? "dream", trigger: body.trigger ?? "manual_dream" })));
      return true;
    }

    if (method === "POST" && url.pathname === "/dream/jobs") {
      const body = dreamJobBodySchema.parse(await json(request));
      send(response, 202, await defaultService.startDreamJob({ ...body, mode: body.mode ?? "dream", trigger: body.trigger ?? "manual_dream" }));
      return true;
    }

    if (method === "GET" && url.pathname === "/dream/jobs") {
      send(response, 200, defaultService.dreamJobStatus(url.searchParams.get("jobId") ?? undefined));
      return true;
    }

    if (method === "POST" && parts[0] === "dream" && parts[1] === "jobs" && parts[2] && parts[3] === "cancel") {
      const body = z.object({ reason: z.string().optional() }).parse(await json(request).catch(() => ({})));
      send(response, 202, defaultService.cancelDreamJob(parts[2], body.reason));
      return true;
    }

    if (method === "POST" && parts[0] === "dream" && parts[1] === "jobs" && parts[2] && parts[3] === "retry") {
      send(response, 202, await defaultService.retryDreamJob(parts[2]));
      return true;
    }

    if (method === "POST" && url.pathname === "/sources/revalidate") {
      const body = sourceRevalidationBodySchema.parse(await json(request));
      send(response, 202, body.memoryId ? defaultService.revalidateMemory(body.memoryId, body.userId) : defaultService.revalidateSourceRefs(body.userId, { connectorIds: body.connectorIds, limit: body.limit }));
      return true;
    }

    if (method === "POST" && url.pathname === "/connectors/sync-state") {
      const body = connectorSyncStateBodySchema.parse(await json(request));
      send(response, 200, defaultService.connectorSyncState(body.connectorId));
      return true;
    }

    if (method === "POST" && url.pathname === "/verification/resolve") {
      const body = sourceRevalidationBodySchema.parse(await json(request));
      send(response, 202, defaultService.resolveVerificationQueue(body.userId, { connectorIds: body.connectorIds, limit: body.limit }));
      return true;
    }

    if (method === "POST" && url.pathname === "/harness/events") {
      send(response, 202, serializeHarnessLifecycleEvent(defaultService.recordHarnessLifecycleEvent(harnessLifecycleEventBodySchema.parse(await json(request)))));
      return true;
    }

    if (method === "POST" && (url.pathname === "/harness/session-end" || url.pathname === "/harness/handoff-prepare" || url.pathname === "/harness/release-prepare")) {
      const body = dreamCycleBodySchema.parse(await json(request));
      const trigger: DreamCycleTrigger = url.pathname === "/harness/session-end" ? "harness_session_end" : url.pathname === "/harness/handoff-prepare" ? "harness_handoff" : "before_release";
      const prepared = defaultService.prepareDream({
        ...body,
        mode: body.mode ?? "dream",
        trigger,
        budget: body.budget ?? (trigger === "before_release" ? "release" : undefined),
        sourceRefresh: body.sourceRefresh ?? trigger !== "harness_session_end",
        run: body.run
      });
      send(response, 202, {
        plan: prepared.plan,
        report: prepared.report ? serializeDreamCycleReport(prepared.report) : undefined
      });
      return true;
    }

    if (method === "POST" && (url.pathname === "/reflection" || url.pathname === "/dream")) {
      const body = z.object({ userId: z.string().min(1) }).parse(await json(request));
      const report = url.pathname === "/dream" ? defaultService.dream(body.userId) : defaultService.reflect(body.userId);
      send(response, 202, serializeDreamCycleReport(report));
      return true;
    }

    if (method === "GET" && parts[0] === "verification" && parts[1]) {
      send(response, 200, defaultService.verificationQueue(parts[1]));
      return true;
    }

    if (method === "POST" && parts[0] === "memories" && parts[1] && parts[2] === "confirm") {
      const body = z.object({ userId: z.string().optional() }).parse(await json(request));
      send(response, 200, serialize(defaultService.confirmMemory(parts[1], body.userId)));
      return true;
    }

    if (method === "POST" && parts[0] === "memories" && parts[1] && parts[2] === "retract") {
      const body = z.object({ userId: z.string().optional(), reason: z.string().optional() }).parse(await json(request));
      send(response, 200, serialize(defaultService.retractMemory(parts[1], body.userId, body.reason)));
      return true;
    }

    if (method === "POST" && url.pathname === "/maintenance/dream-due") {
      send(response, 202, { dreamedUsers: defaultService.runDueDreams() });
      return true;
    }
  return false;
}
