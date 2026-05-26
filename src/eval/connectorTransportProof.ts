import { createServer, type ServerResponse } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

interface TransportCall {
  method: string;
  path: string;
  search: string;
  statusCode: number;
}

interface ConnectorTransportReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "transport-fixture";
  provider: "github";
  checks: Record<string, boolean>;
  calls: TransportCall[];
  listItems: number;
  pollEvents: number;
  passed: boolean;
}

export async function runConnectorTransportProof(options: { out?: string } = {}): Promise<ConnectorTransportReport> {
  const calls: TransportCall[] = [];
  let fixtureBase = "";
  let pullsHits = 0;
  let actionsHits = 0;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";
    if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/pulls") {
      pullsHits += 1;
      if (pullsHits === 1) {
        calls.push({ method, path: url.pathname, search: url.search, statusCode: 429 });
        return send(response, 429, { message: "secondary rate limit" }, { "retry-after": "0" });
      }
      if (url.searchParams.get("page") === "2") {
        calls.push({ method, path: url.pathname, search: url.search, statusCode: 200 });
        return send(response, 200, [
          { number: 43, title: "Second page: connector pagination proof", state: "open", html_url: "https://github.com/cognilabz/cognibrain/pull/43", user: { login: "reviewer" }, updated_at: "2026-05-26T08:00:00.000Z" }
        ]);
      }
      calls.push({ method, path: url.pathname, search: url.search, statusCode: 200 });
      const next = `${fixtureBase}/github/repos/cognilabz/cognibrain/pulls?state=open&per_page=1&page=2`;
      return send(response, 200, [
        { number: 42, title: "First page: connector retry proof", state: "open", html_url: "https://github.com/cognilabz/cognibrain/pull/42", user: { login: "reviewer" }, updated_at: "2026-05-26T07:00:00.000Z" }
      ], { link: `<${next}>; rel="next"` });
    }
    if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/actions/runs") {
      actionsHits += 1;
      if (actionsHits === 1) {
        calls.push({ method, path: url.pathname, search: url.search, statusCode: 503 });
        return send(response, 503, { message: "temporary upstream failure" }, { "retry-after": "0" });
      }
      calls.push({ method, path: url.pathname, search: url.search, statusCode: 200 });
      return send(response, 200, {
        workflow_runs: [{ id: 7, name: "npm test", head_branch: "main", html_url: "https://github.com/cognilabz/cognibrain/actions/runs/7", status: "completed", conclusion: "failure" }]
      });
    }
    calls.push({ method, path: url.pathname, search: url.search, statusCode: 404 });
    send(response, 404, { error: `No fixture for ${method} ${url.pathname}` });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousEnv = snapshotEnv([
    "MEMORY_GITHUB_REPO",
    "MEMORY_GITHUB_TOKEN",
    "MEMORY_GITHUB_API_BASE",
    "MEMORY_VENDOR_PAGE_SIZE",
    "MEMORY_VENDOR_MAX_PAGES",
    "MEMORY_VENDOR_RETRY_ATTEMPTS",
    "MEMORY_CONNECTOR_TIMEOUT_MS",
    "MEMORY_GITHUB_INCLUDE_ACTIONS"
  ]);

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP fixture address.");
    fixtureBase = `http://127.0.0.1:${address.port}`;
    Object.assign(process.env, {
      MEMORY_GITHUB_REPO: "cognilabz/cognibrain",
      MEMORY_GITHUB_TOKEN: "github-transport-secret",
      MEMORY_GITHUB_API_BASE: `${fixtureBase}/github`,
      MEMORY_VENDOR_PAGE_SIZE: "1",
      MEMORY_VENDOR_MAX_PAGES: "3",
      MEMORY_VENDOR_RETRY_ATTEMPTS: "2",
      MEMORY_CONNECTOR_TIMEOUT_MS: "5000",
      MEMORY_GITHUB_INCLUDE_ACTIONS: "true"
    });

    const service = new MemoryService();
    const listed = await service.listConnectorItems("official-github");
    const polled = await service.pollConnector("official-github", { userId: "transport-proof", orgId: "org1", projectId: "cognibrain" });
    const records = JSON.stringify(service.listConnectorSyncRecords());
    const checks = {
      rateLimitBackoff: pullsHits >= 2 && calls.some((call) => call.statusCode === 429),
      cursorPagination: calls.some((call) => call.path.endsWith("/pulls") && call.search.includes("page=2")),
      transientRetry: actionsHits >= 2 && calls.some((call) => call.statusCode === 503),
      listStillApplied: listed.status === "applied" && listed.items.length >= 2,
      pollStillApplied: polled.status === "applied" && polled.memoryIds.length >= 3,
      authorizationRedacted: !records.includes("github-transport-secret")
    };
    const report: ConnectorTransportReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      mode: "transport-fixture",
      provider: "github",
      checks,
      calls,
      listItems: listed.items.length,
      pollEvents: polled.memoryIds.length,
      passed: Object.values(checks).every(Boolean)
    };
    if (options.out) {
      mkdirSync(dirname(options.out), { recursive: true });
      writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
    }
    return report;
  } finally {
    restoreEnv(previousEnv);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function send(response: ServerResponse, statusCode: number, payload: unknown, headers: Record<string, string> = {}): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  response.end(JSON.stringify(payload));
}

function snapshotEnv(keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(previous: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function cliOptions(argv: string[]): { out?: string } {
  const outIndex = argv.indexOf("--out");
  return { out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/connector-transport.json" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runConnectorTransportProof(cliOptions(process.argv.slice(2)))
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
