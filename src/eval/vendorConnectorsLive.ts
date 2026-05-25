import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

type VendorProvider = "github" | "slack" | "discord";

interface VendorHttpCall {
  provider: VendorProvider;
  method: string;
  path: string;
  search: string;
  hasAuthorization: boolean;
  authorizationScheme?: string;
  contentType?: string;
  body: string;
}

interface VendorConnectorLiveReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "contract";
  checks: Record<string, boolean>;
  calls: VendorHttpCall[];
  memoryCount: number;
  syncRecordCount: number;
  passed: boolean;
}

const secretSamples = ["gh_test_secret", "xoxb-test-secret", "discord_test_secret"];

export async function runVendorConnectorVerification(out?: string): Promise<VendorConnectorLiveReport> {
  const service = new MemoryService();
  const calls: VendorHttpCall[] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const provider = providerForPath(url.pathname);
      calls.push({
        provider,
        method: request.method ?? "GET",
        path: url.pathname,
        search: url.search,
        hasAuthorization: Boolean(request.headers.authorization),
        authorizationScheme: String(request.headers.authorization ?? "").split(/\s+/)[0] || undefined,
        contentType: typeof request.headers["content-type"] === "string" ? request.headers["content-type"] : undefined,
        body
      });
      response.setHeader("content-type", "application/json");
      routeVendorFixture(url, request.method ?? "GET", body, response);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previousEnv = snapshotEnv([
    "MEMORY_GITHUB_REPO",
    "MEMORY_GITHUB_TOKEN",
    "MEMORY_GITHUB_API_BASE",
    "MEMORY_SLACK_TOKEN",
    "MEMORY_SLACK_CHANNEL_ID",
    "MEMORY_SLACK_API_BASE",
    "MEMORY_DISCORD_BOT_TOKEN",
    "MEMORY_DISCORD_CHANNEL_ID",
    "MEMORY_DISCORD_API_BASE",
    "MEMORY_CONNECTOR_TIMEOUT_MS",
    "MEMORY_VENDOR_PAGE_SIZE"
  ]);

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
    const base = `http://127.0.0.1:${address.port}`;
    Object.assign(process.env, {
      MEMORY_GITHUB_REPO: "cognilabz/cognibrain",
      MEMORY_GITHUB_TOKEN: secretSamples[0],
      MEMORY_GITHUB_API_BASE: `${base}/github`,
      MEMORY_SLACK_TOKEN: secretSamples[1],
      MEMORY_SLACK_CHANNEL_ID: "C123",
      MEMORY_SLACK_API_BASE: `${base}/slack/api`,
      MEMORY_DISCORD_BOT_TOKEN: secretSamples[2],
      MEMORY_DISCORD_CHANNEL_ID: "D123",
      MEMORY_DISCORD_API_BASE: `${base}/discord/api/v10`,
      MEMORY_CONNECTOR_TIMEOUT_MS: "5000",
      MEMORY_VENDOR_PAGE_SIZE: "20"
    });

    const scope = { userId: "vendor-user", orgId: "org1", projectId: "cognibrain" };
    const initialHealth = service.connectorHealth().filter((item) => ["official-github", "official-slack", "official-discord"].includes(item.connectorId));

    const githubList = await service.listConnectorItems("official-github");
    const githubSync = await service.pollConnector("official-github", scope);
    const githubDryRunCallCount = calls.length;
    const githubDryRun = await service.writebackConnector("official-github", { operation: "comment", content: "Dry-run release memory.", target: { pullRequest: 42 }, dryRun: true });
    const githubNoDryRunPost = calls.length === githubDryRunCallCount;
    const githubWriteback = await service.writebackConnector("official-github", { operation: "comment", content: "Memory-linked release decision.", target: { pullRequest: 42 }, dryRun: false });

    const slackList = await service.listConnectorItems("official-slack");
    const slackSync = await service.pollConnector("official-slack", scope);
    const slackDryRunCallCount = calls.length;
    const slackDryRun = await service.writebackConnector("official-slack", { operation: "summary", content: "Dry-run Slack memory.", target: { channel: "C123", threadId: "1710000000.000100" }, dryRun: true });
    const slackNoDryRunPost = calls.length === slackDryRunCallCount;
    const slackWriteback = await service.writebackConnector("official-slack", { operation: "summary", content: "Decision captured for review.", target: { channel: "C123", threadId: "1710000000.000100" }, dryRun: false });

    const discordList = await service.listConnectorItems("official-discord");
    const discordSync = await service.pollConnector("official-discord", scope);
    const discordDryRunCallCount = calls.length;
    const discordDryRun = await service.writebackConnector("official-discord", { operation: "summary", content: "Dry-run Discord memory.", target: { channel: "D123" }, dryRun: true });
    const discordNoDryRunPost = calls.length === discordDryRunCallCount;
    const discordWriteback = await service.writebackConnector("official-discord", { operation: "summary", content: "Decision captured for review.", target: { channel: "D123" }, dryRun: false });

    const memories = service.list("vendor-user");
    const records = service.listConnectorSyncRecords();
    const finalHealth = service.connectorHealth().filter((item) => ["official-github", "official-slack", "official-discord"].includes(item.connectorId));
    const serializedState = JSON.stringify({ memories, records, finalHealth });
    const githubPrDecision = memories.find((memory) => memory.metadata.externalId === "pr-42");
    const githubTestFailure = memories.find((memory) => memory.metadata.externalId === "github-run-7");
    const slackDecision = memories.find((memory) => memory.metadata.externalId === "1710000000.000100");
    const discordDecision = memories.find((memory) => memory.metadata.externalId === "987654321");

    const checks = {
      officialManifestsUseVendorEndpoints: initialHealth.every((item) => item.supports.externalVendor === true && item.externalVendor?.configured === true),
      githubUsesRestPulls: hasCall(calls, "github", "GET", "/github/repos/cognilabz/cognibrain/pulls", "Bearer"),
      githubUsesRestActions: hasCall(calls, "github", "GET", "/github/repos/cognilabz/cognibrain/actions/runs", "Bearer"),
      githubWritesIssueComment: hasCall(calls, "github", "POST", "/github/repos/cognilabz/cognibrain/issues/42/comments", "Bearer"),
      slackUsesConversationsList: hasCall(calls, "slack", "GET", "/slack/api/conversations.list", "Bearer"),
      slackUsesConversationsHistory: hasCall(calls, "slack", "GET", "/slack/api/conversations.history", "Bearer"),
      slackWritesChatPostMessage: hasCall(calls, "slack", "POST", "/slack/api/chat.postMessage", "Bearer"),
      discordUsesChannelMessages: hasCall(calls, "discord", "GET", "/discord/api/v10/channels/D123/messages", "Bot"),
      discordWritesChannelMessage: hasCall(calls, "discord", "POST", "/discord/api/v10/channels/D123/messages", "Bot"),
      listPollWritebackApplied: [githubList, githubSync, githubWriteback, slackList, slackSync, slackWriteback, discordList, discordSync, discordWriteback].every((item) => item.status === "applied"),
      dryRunDoesNotPost: githubNoDryRunPost && slackNoDryRunPost && discordNoDryRunPost && [githubDryRun, slackDryRun, discordDryRun].every((item) => item.status === "queued"),
      authorizationHeadersRedactedInSyncRecords: records.every((record) => !record.request?.headers.authorization || record.request.headers.authorization === "<redacted>"),
      secretsNotRetained: secretSamples.every((secret) => !serializedState.includes(secret)),
      githubPrDecisionTagged: Boolean(githubPrDecision?.tags.includes("pr-decision") && githubPrDecision.provenance.sourceRef?.connectorId === "official-github"),
      githubActionsFailureTagged: Boolean(githubTestFailure?.tags.includes("test-failure") && githubTestFailure.tags.includes("harness-action")),
      slackDecisionNeedsReview: Boolean(slackDecision?.beliefState === "needs_verification" && slackDecision.consent.visibility === "org" && service.verificationQueue("vendor-user").items.some((item) => item.memoryId === slackDecision.id)),
      discordDecisionNeedsReview: Boolean(discordDecision?.beliefState === "needs_verification" && discordDecision.consent.visibility === "org" && service.verificationQueue("vendor-user").items.some((item) => item.memoryId === discordDecision.id)),
      externalHealthRecordsVisible: finalHealth.every((item) => item.records > 0 && item.externalVendor?.configured === true)
    };

    const report: VendorConnectorLiveReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      mode: "contract",
      checks,
      calls,
      memoryCount: memories.length,
      syncRecordCount: records.length,
      passed: Object.values(checks).every(Boolean)
    };
    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(report, null, 2));
    }
    return report;
  } finally {
    restoreEnv(previousEnv);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function routeVendorFixture(url: URL, method: string, body: string, response: ServerResponse): void {
  if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/pulls") {
    send(response, 200, [
      {
        number: 42,
        title: "Release gate approved: Atlas depends on CacheClient",
        state: "open",
        html_url: "https://github.com/cognilabz/cognibrain/pull/42",
        user: { login: "reviewer" },
        updated_at: "2026-05-25T06:00:00.000Z"
      }
    ]);
    return;
  }
  if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/actions/runs") {
    send(response, 200, {
      workflow_runs: [
        {
          id: 7,
          name: "npm test",
          head_branch: "main",
          html_url: "https://github.com/cognilabz/cognibrain/actions/runs/7",
          status: "completed",
          conclusion: "failure"
        }
      ]
    });
    return;
  }
  if (method === "POST" && url.pathname === "/github/repos/cognilabz/cognibrain/issues/42/comments") {
    send(response, 201, { id: 9001, body: readJson(body).body });
    return;
  }
  if (method === "GET" && url.pathname === "/slack/api/conversations.list") {
    send(response, 200, { ok: true, channels: [{ id: "C123", name: "release-decisions", is_channel: true }] });
    return;
  }
  if (method === "GET" && url.pathname === "/slack/api/conversations.history") {
    send(response, 200, {
      ok: true,
      messages: [
        {
          ts: "1710000000.000100",
          thread_ts: "1710000000.000100",
          user: "U123",
          text: "Slack decision: Team decided Atlas must use Postgres before release."
        }
      ]
    });
    return;
  }
  if (method === "POST" && url.pathname === "/slack/api/chat.postMessage") {
    send(response, 200, { ok: true, channel: readJson(body).channel, ts: "1710000000.000200" });
    return;
  }
  if (method === "GET" && url.pathname === "/discord/api/v10/channels/D123/messages") {
    send(response, 200, [
      {
        id: "987654321",
        channel_id: "D123",
        guild_id: "G123",
        content: "Discord decision: Support bot should cite evidence before action.",
        author: { username: "operator" }
      }
    ]);
    return;
  }
  if (method === "POST" && url.pathname === "/discord/api/v10/channels/D123/messages") {
    send(response, 200, { id: "987654322", channel_id: "D123", content: readJson(body).content });
    return;
  }
  send(response, 404, { error: `No vendor fixture for ${method} ${url.pathname}` });
}

function send(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.end(JSON.stringify(payload));
}

function providerForPath(pathname: string): VendorProvider {
  if (pathname.startsWith("/github/")) return "github";
  if (pathname.startsWith("/slack/")) return "slack";
  if (pathname.startsWith("/discord/")) return "discord";
  return "github";
}

function hasCall(calls: VendorHttpCall[], provider: VendorProvider, method: string, path: string, authorizationScheme: string): boolean {
  return calls.some((call) =>
    call.provider === provider &&
    call.method === method &&
    call.path === path &&
    call.hasAuthorization &&
    call.authorizationScheme === authorizationScheme
  );
}

function readJson(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
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
  const index = argv.indexOf("--out");
  return { out: index >= 0 ? argv[index + 1] : "artifacts/vendor-connectors-live.json" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVendorConnectorVerification(cliOptions(process.argv.slice(2)).out)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
