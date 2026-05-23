import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "./service";
import type { Memory } from "../core";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const dreamCheckIntervalMinutes = Number(process.env.MEMORY_DREAM_CHECK_INTERVAL_MINUTES ?? 15);

const memoryInputSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  deviceId: z.string().optional(),
  runId: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
  layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
  source: z
    .object({
      kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
      uri: z.string().optional(),
      commit: z.string().optional(),
      lineStart: z.number().optional(),
      lineEnd: z.number().optional(),
      confidence: z.number().min(0).max(1)
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  relations: z
    .array(
      z.object({
        type: z.enum([
          "mentions",
          "calls",
          "imports",
          "defines",
          "extends",
          "depends_on",
          "works_for",
          "supersedes",
          "contradicts",
          "confirmed_by",
          "suggested_by",
          "executed_by"
        ]),
        targetId: z.string().optional(),
        targetEntity: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.string().optional()
      })
    )
    .optional(),
  consent: z
    .object({
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      allowTraining: z.boolean().optional(),
      retentionUntil: z.string().optional(),
      deleteOnRequest: z.boolean().optional()
    })
    .optional(),
  temporal: z.record(z.unknown()).optional(),
  pinned: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

const searchSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  runId: z.string().optional(),
  scopeMode: z.enum(["user", "session", "app", "org", "project", "all"]).optional(),
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
  includeArchived: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
  weights: z.record(z.number()).optional()
});

const extractSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  runId: z.string().optional(),
  events: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool", "system", "operator"]),
      content: z.string().min(1),
      timestamp: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  )
});

const feedbackSchema = z.object({
  memoryId: z.string().min(1),
  userId: z.string().optional(),
  kind: z.enum(["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable"]),
  note: z.string().optional(),
  timestamp: z.string().optional()
});

export const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    send(response, error instanceof z.ZodError ? 400 : 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const method = request.method ?? "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "OPTIONS") {
    send(response, 204, null);
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    send(response, 200, { ok: true, ...defaultService.health(url.searchParams.get("userId") ?? undefined) });
    return;
  }

  if (method === "GET" && url.pathname === "/maintenance") {
    send(response, 200, defaultService.maintenanceStatus());
    return;
  }

  if (method === "GET" && url.pathname === "/metrics") {
    send(response, 200, defaultService.metricsReport());
    return;
  }

  if (method === "POST" && url.pathname === "/memories") {
    const body = memoryInputSchema.parse(await json(request));
    send(response, 201, serialize(defaultService.add(body)));
    return;
  }

  if (method === "POST" && url.pathname === "/extract") {
    const body = extractSchema.parse(await json(request));
    const { events, ...scope } = body;
    const report = defaultService.extract(events, scope);
    send(response, 201, {
      memories: report.memories.map(serialize),
      entityLinks: report.entityLinks
    });
    return;
  }

  if (method === "GET" && url.pathname === "/memories") {
    send(response, 200, defaultService.list(url.searchParams.get("userId") ?? undefined).map(serialize));
    return;
  }

  if (parts[0] === "memories" && parts[1]) {
    if (method === "GET") {
      send(response, 200, serialize(defaultService.get(parts[1])));
      return;
    }
    if (method === "PATCH") {
      send(response, 200, serialize(defaultService.update(parts[1], memoryInputSchema.partial().parse(await json(request)))));
      return;
    }
    if (method === "DELETE") {
      send(response, defaultService.delete(parts[1]) ? 204 : 404, null);
      return;
    }
  }

  if (method === "POST" && url.pathname === "/search") {
    const body = searchSchema.parse(await json(request));
    send(
      response,
      200,
      defaultService.search(body).map((result) => ({
        ...result,
        memory: serialize(result.memory)
      }))
    );
    return;
  }

  if (method === "POST" && url.pathname === "/feedback") {
    const body = feedbackSchema.parse(await json(request));
    send(response, 202, serialize(defaultService.feedback(body)));
    return;
  }

  if (method === "GET" && parts[0] === "export" && parts[1]) {
    send(response, 200, defaultService.exportUser(parts[1]).map(serialize));
    return;
  }

  if (method === "DELETE" && parts[0] === "users" && parts[1] && parts[2] === "memories") {
    send(response, 200, { deleted: defaultService.deleteUser(parts[1]) });
    return;
  }

  if (method === "POST" && (url.pathname === "/reflection" || url.pathname === "/dream")) {
    const body = z.object({ userId: z.string().min(1) }).parse(await json(request));
    const report = url.pathname === "/dream" ? defaultService.dream(body.userId) : defaultService.reflect(body.userId);
    send(response, 202, {
      created: report.created.map(serialize),
      demoted: report.demoted.map(serialize),
      contradictions: report.contradictions.map((item) => ({
        kept: serialize(item.kept),
        demoted: serialize(item.demoted),
        reason: item.reason
      })),
      lifecycle: report.lifecycle
    });
    return;
  }

  if (method === "POST" && url.pathname === "/maintenance/dream-due") {
    send(response, 202, { dreamedUsers: defaultService.runDueDreams() });
    return;
  }

  send(response, 404, { error: "Not found" });
}

function json(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (status === 204 || payload === null) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload, null, 2));
}

function serialize(value: Memory) {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    lastAccessedAt: value.lastAccessedAt?.toISOString(),
    archivedAt: value.archivedAt?.toISOString()
  };
}

if (process.env.NODE_ENV !== "test") {
  server.listen(port, host, () => {
    console.log(`cognibrain API listening on http://${host}:${port}`);
  });
  if (dreamCheckIntervalMinutes > 0) {
    setInterval(
      () => defaultService.runDueDreams(),
      dreamCheckIntervalMinutes * 60_000
    ).unref();
  }
}
