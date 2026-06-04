import type { IncomingMessage, ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { z } from "zod";
import { defaultService } from "../service";
import type { DreamCycleTrigger } from "../../core";
import { sanitizedRuntimeEnv } from "../../core/runtimeEnv";
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
const harnessExecuteBodySchema = z.object({
  userId: z.string().min(1),
  command: z.string().min(1).max(2000).refine((value) => !/[\r\n]/.test(value), "command must be a single line"),
  cwd: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional()
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
      send(response, 202, body.memoryId ? await defaultService.revalidateMemoryAsync(body.memoryId, body.userId) : await defaultService.revalidateSourceRefsAsync(body.userId, { connectorIds: body.connectorIds, limit: body.limit }));
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

    if (method === "POST" && url.pathname === "/harness/execute") {
      const body = harnessExecuteBodySchema.parse(await json(request));
      if (!allowedHarnessCommand(body.command)) {
        send(response, 400, { error: "Only Cognibrain harness commands can be executed from the Operator UI." });
        return true;
      }
      const result = await executeHarnessCommand(body.command, {
        cwd: body.cwd ?? process.cwd(),
        timeoutMs: body.timeoutMs ?? 30_000
      });
      const event = defaultService.recordHarnessLifecycleEvent({
        userId: body.userId,
        event: result.exitCode === 0 ? "tool_succeeded" : "tool_failed",
        command: body.command,
        cwd: result.cwd,
        exitCode: result.exitCode ?? undefined,
        durationMs: result.durationMs,
        outputSummary: summarizeHarnessOutput(result.stdout, result.stderr),
        failureReason: result.exitCode === 0 ? undefined : result.timedOut ? "Command timed out." : result.stderr || result.stdout || "Command failed.",
        successReason: result.exitCode === 0 ? "Command completed successfully." : undefined,
        metadata: { source: "operator-ui", timedOut: result.timedOut }
      });
      send(response, 202, { ...result, event: serializeHarnessLifecycleEvent(event) });
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

type HarnessExecutionResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
};

function allowedHarnessCommand(command: string): boolean {
  const trimmed = command.trim();
  return [
    "npx cognibrain",
    "npm run setup",
    "npm run mcp",
    "npm run skill:install",
    "node bin/cognibrain.mjs",
    `${process.execPath} bin/cognibrain.mjs`
  ].some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix} `));
}

function executeHarnessCommand(command: string, options: { cwd: string; timeoutMs: number }): Promise<HarnessExecutionResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(command, {
      cwd: options.cwd,
      shell: true,
      env: sanitizedRuntimeEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, String(chunk));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command,
        cwd: options.cwd,
        exitCode: timedOut ? null : code,
        timedOut,
        durationMs: Date.now() - started,
        stdout,
        stderr
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        command,
        cwd: options.cwd,
        exitCode: 1,
        timedOut,
        durationMs: Date.now() - started,
        stdout,
        stderr: appendBounded(stderr, error.message)
      });
    });
  });
}

function appendBounded(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length > 40_000 ? next.slice(-40_000) : next;
}

function summarizeHarnessOutput(stdout: string, stderr: string): string {
  const text = `${stdout}\n${stderr}`.trim().replace(/\s+/g, " ");
  return text.length > 600 ? `${text.slice(0, 597)}...` : text;
}
