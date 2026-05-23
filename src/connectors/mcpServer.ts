import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage } from "node:http";
import { z } from "zod/v4";
import { createDefaultMemoryService } from "../api/service";
import { createMemoryToolHandlers, jsonText } from "./mcpHandlers";

export function createOpenMemoryMcpServer(service = createDefaultMemoryService()) {
  const server = new McpServer({
    name: "cognibrain",
    version: "0.1.0"
  });
  const handlers = createMemoryToolHandlers(service);

  server.registerTool(
    "memory_add",
    {
      title: "Add Memory",
      description: "Store a durable memory with provenance, tags, entities, and optional harness scope.",
      inputSchema: {
        userId: z.string().min(1),
        content: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
        layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
        sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
        sourceConfidence: z.number().min(0).max(1).optional(),
        tags: z.array(z.string()).optional(),
        entities: z.array(z.string()).optional(),
        pinned: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      }
    },
    async (args) => jsonText(handlers.add(args))
  );

  server.registerTool(
    "memory_search",
    {
      title: "Search Memories",
      description: "Retrieve ranked memories using semantic, keyword, entity, temporal, trust, and graph signals.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional()
      }
    },
    async (args) => jsonText(handlers.search(args))
  );

  server.registerTool(
    "memory_context_pack",
    {
      title: "Build Context Pack",
      description: "Retrieve memories and format them into a compact context block for a coding agent prompt.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional(),
        tokenBudget: z.number().int().positive().max(8000).optional()
      }
    },
    async (args) => jsonText(handlers.contextPack(args))
  );

  server.registerTool(
    "memory_list",
    {
      title: "List Memories",
      description: "List recent memories for a user or all users.",
      inputSchema: {
        userId: z.string().optional(),
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async (args) => jsonText(handlers.list(args))
  );

  server.registerTool(
    "memory_reflect",
    {
      title: "Reflect Memories",
      description: "Run reflection to summarize repeated themes, demote contradictions, fade stale memories, and report lifecycle quality.",
      inputSchema: {
        userId: z.string().min(1)
      }
    },
    async (args) => jsonText(handlers.reflect(args))
  );

  server.registerTool(
    "memory_dream",
    {
      title: "Dream Memory Lifecycle",
      description: "Run the full maintenance cycle: rethink, reevaluate, summarize, fade, reflect, and reorganize memories.",
      inputSchema: {
        userId: z.string().min(1)
      }
    },
    async (args) => jsonText(handlers.dream(args))
  );

  server.registerTool(
    "memory_health",
    {
      title: "Memory Health",
      description: "Return memory health metrics including freshness, average trust, coverage, and contradictions.",
      inputSchema: {
        userId: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.health(args))
  );

  server.registerTool(
    "memory_maintenance_status",
    {
      title: "Memory Maintenance Status",
      description: "Show automatic dream-cycle policy and per-user maintenance counters.",
      inputSchema: {}
    },
    async () => jsonText(handlers.maintenance())
  );

  server.registerPrompt(
    "memory_usage_policy",
    {
      title: "Memory Usage Policy",
      description: "A harness prompt snippet describing when to search, verify, store, and reflect memories.",
      argsSchema: {
        userId: z.string().optional()
      }
    },
    ({ userId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Use cognibrain for${userId ? ` user ${userId}` : " the current user"}.`,
              "Before long-running coding tasks, call memory_search or memory_context_pack with the task.",
              "Treat returned memories as evidence, not authority; verify drift-prone facts against current files or source systems.",
              "After durable discoveries, user corrections, benchmark results, or connector setup decisions, call memory_add with source metadata.",
              "Run memory_reflect after large sessions or when contradictions appear. Run memory_dream for a full maintenance cycle before handoff or release.",
              "Use memory_maintenance_status to confirm whether automatic dreaming is enabled for the local backend."
            ].join("\n")
          }
        }
      ]
    })
  );

  return server;
}

export async function runStdioMcpServer() {
  const server = createOpenMemoryMcpServer();
  await server.connect(new StdioServerTransport());
}

export function runHttpMcpServer(port = Number(process.env.MCP_PORT ?? 8788), host = process.env.MCP_HOST ?? "127.0.0.1") {
  const listener = createServer(async (request, response) => {
    if (request.url !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    if (request.method !== "POST") {
      response
        .writeHead(405, { "content-type": "application/json" })
        .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }));
      return;
    }
    const server = createOpenMemoryMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, await json(request));
      response.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      if (!response.headersSent) {
        response
          .writeHead(500, { "content-type": "application/json" })
          .end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: error instanceof Error ? error.message : "Internal server error" }, id: null }));
      }
    }
  });
  listener.listen(port, host, () => {
    console.error(`cognibrain Streamable HTTP MCP: http://${host}:${port}/mcp`);
  });
  return listener;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = process.argv.includes("--http") ? Promise.resolve(runHttpMcpServer()) : runStdioMcpServer();
  run.catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
