import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type IncomingMessage } from "node:http";
import type { MemoryService } from "../api/service";
import { createMcpRuntimeToolHandlers } from "./mcpRuntimeClient";
import { registerMemoryMcpTools } from "./mcpTools";

export function createOpenMemoryMcpServer(service?: MemoryService) {
  const server = new McpServer({
    name: "cognibrain",
    version: "0.1.0"
  });
  registerMemoryMcpTools(server, service ? service : createMcpRuntimeToolHandlers());

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
