import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

type VendorProvider = "github" | "slack" | "discord" | "jira" | "confluence" | "notion" | "linear";

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

const vendorConnectorIds = [
  "official-github",
  "official-slack",
  "official-discord",
  "official-jira",
  "official-confluence",
  "official-notion",
  "official-linear"
];

const secretSamples = ["gh_test_secret", "xoxb-test-secret", "discord_test_secret", "jira_test_secret", "confluence_test_secret", "notion_test_secret", "linear_test_secret"];

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
        authorizationScheme: authorizationScheme(request.headers.authorization),
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
    "MEMORY_JIRA_BASE_URL",
    "MEMORY_JIRA_EMAIL",
    "MEMORY_JIRA_API_TOKEN",
    "MEMORY_JIRA_PROJECT",
    "MEMORY_CONFLUENCE_BASE_URL",
    "MEMORY_CONFLUENCE_EMAIL",
    "MEMORY_CONFLUENCE_API_TOKEN",
    "MEMORY_CONFLUENCE_SPACE",
    "MEMORY_NOTION_TOKEN",
    "MEMORY_NOTION_DATABASE_ID",
    "MEMORY_NOTION_API_BASE",
    "MEMORY_LINEAR_API_KEY",
    "MEMORY_LINEAR_TEAM_ID",
    "MEMORY_LINEAR_API_BASE",
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
      MEMORY_JIRA_BASE_URL: `${base}/jira`,
      MEMORY_JIRA_EMAIL: "bot@example.com",
      MEMORY_JIRA_API_TOKEN: secretSamples[3],
      MEMORY_JIRA_PROJECT: "CB",
      MEMORY_CONFLUENCE_BASE_URL: `${base}/confluence`,
      MEMORY_CONFLUENCE_EMAIL: "bot@example.com",
      MEMORY_CONFLUENCE_API_TOKEN: secretSamples[4],
      MEMORY_CONFLUENCE_SPACE: "ENG",
      MEMORY_NOTION_TOKEN: secretSamples[5],
      MEMORY_NOTION_DATABASE_ID: "db123",
      MEMORY_NOTION_API_BASE: `${base}/notion`,
      MEMORY_LINEAR_API_KEY: secretSamples[6],
      MEMORY_LINEAR_TEAM_ID: "team123",
      MEMORY_LINEAR_API_BASE: `${base}/linear/graphql`,
      MEMORY_CONNECTOR_TIMEOUT_MS: "5000",
      MEMORY_VENDOR_PAGE_SIZE: "20"
    });

    const scope = { userId: "vendor-user", orgId: "org1", projectId: "cognibrain" };
    const initialHealth = service.connectorHealth().filter((item) => vendorConnectorIds.includes(item.connectorId));

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

    const jiraList = await service.listConnectorItems("official-jira");
    const jiraSync = await service.pollConnector("official-jira", scope);
    const jiraDryRunCallCount = calls.length;
    const jiraDryRun = await service.writebackConnector("official-jira", { operation: "comment", content: "Dry-run Jira memory.", target: { issueKey: "CB-42" }, dryRun: true });
    const jiraNoDryRunPost = calls.length === jiraDryRunCallCount;
    const jiraWriteback = await service.writebackConnector("official-jira", { operation: "comment", content: "Decision captured for review.", target: { issueKey: "CB-42" }, dryRun: false });

    const confluenceList = await service.listConnectorItems("official-confluence");
    const confluenceSync = await service.pollConnector("official-confluence", scope);
    const confluenceDryRunCallCount = calls.length;
    const confluenceDryRun = await service.writebackConnector("official-confluence", { operation: "comment", content: "Dry-run Confluence memory.", target: { pageId: "123" }, dryRun: true });
    const confluenceNoDryRunPost = calls.length === confluenceDryRunCallCount;
    const confluenceWriteback = await service.writebackConnector("official-confluence", { operation: "comment", content: "Decision captured for review.", target: { pageId: "123" }, dryRun: false });

    const notionList = await service.listConnectorItems("official-notion");
    const notionSync = await service.pollConnector("official-notion", scope);
    const notionDryRunCallCount = calls.length;
    const notionDryRun = await service.writebackConnector("official-notion", { operation: "comment", content: "Dry-run Notion memory.", target: { blockId: "page123" }, dryRun: true });
    const notionNoDryRunPost = calls.length === notionDryRunCallCount;
    const notionWriteback = await service.writebackConnector("official-notion", { operation: "comment", content: "Decision captured for review.", target: { blockId: "page123" }, dryRun: false });

    const linearList = await service.listConnectorItems("official-linear");
    const linearSync = await service.pollConnector("official-linear", scope);
    const linearDryRunCallCount = calls.length;
    const linearDryRun = await service.writebackConnector("official-linear", { operation: "comment", content: "Dry-run Linear memory.", target: { issueId: "lin_123" }, dryRun: true });
    const linearNoDryRunPost = calls.length === linearDryRunCallCount;
    const linearWriteback = await service.writebackConnector("official-linear", { operation: "comment", content: "Decision captured for review.", target: { issueId: "lin_123" }, dryRun: false });

    const memories = service.list("vendor-user");
    const records = service.listConnectorSyncRecords();
    const finalHealth = service.connectorHealth().filter((item) => vendorConnectorIds.includes(item.connectorId));
    const serializedState = JSON.stringify({ memories, records, finalHealth });
    const githubPrDecision = memories.find((memory) => memory.metadata.externalId === "pr-42");
    const githubTestFailure = memories.find((memory) => memory.metadata.externalId === "github-run-7");
    const slackDecision = memories.find((memory) => memory.metadata.externalId === "1710000000.000100");
    const discordDecision = memories.find((memory) => memory.metadata.externalId === "987654321");
    const jiraCorrection = memories.find((memory) => memory.metadata.externalId === "CB-42");
    const confluenceArchitecture = memories.find((memory) => memory.metadata.externalId === "123");
    const notionDecision = memories.find((memory) => memory.metadata.externalId === "page123");
    const linearCorrection = memories.find((memory) => memory.metadata.externalId === "lin_123");

    const applied = [
      githubList, githubSync, githubWriteback,
      slackList, slackSync, slackWriteback,
      discordList, discordSync, discordWriteback,
      jiraList, jiraSync, jiraWriteback,
      confluenceList, confluenceSync, confluenceWriteback,
      notionList, notionSync, notionWriteback,
      linearList, linearSync, linearWriteback
    ];
    const dryRuns = [githubDryRun, slackDryRun, discordDryRun, jiraDryRun, confluenceDryRun, notionDryRun, linearDryRun];

    const checks = {
      officialManifestsUseVendorEndpoints: initialHealth.length === vendorConnectorIds.length && initialHealth.every((item) => item.supports.externalVendor === true && item.externalVendor?.configured === true),
      githubUsesRestPulls: hasCall(calls, "github", "GET", "/github/repos/cognilabz/cognibrain/pulls", "Bearer"),
      githubUsesRestActions: hasCall(calls, "github", "GET", "/github/repos/cognilabz/cognibrain/actions/runs", "Bearer"),
      githubWritesIssueComment: hasCall(calls, "github", "POST", "/github/repos/cognilabz/cognibrain/issues/42/comments", "Bearer"),
      slackUsesConversationsList: hasCall(calls, "slack", "GET", "/slack/api/conversations.list", "Bearer"),
      slackUsesConversationsHistory: hasCall(calls, "slack", "GET", "/slack/api/conversations.history", "Bearer"),
      slackWritesChatPostMessage: hasCall(calls, "slack", "POST", "/slack/api/chat.postMessage", "Bearer"),
      discordUsesChannelMessages: hasCall(calls, "discord", "GET", "/discord/api/v10/channels/D123/messages", "Bot"),
      discordWritesChannelMessage: hasCall(calls, "discord", "POST", "/discord/api/v10/channels/D123/messages", "Bot"),
      jiraUsesSearch: hasCall(calls, "jira", "GET", "/jira/rest/api/3/search", "Basic"),
      jiraWritesComment: hasCall(calls, "jira", "POST", "/jira/rest/api/3/issue/CB-42/comment", "Basic"),
      confluenceUsesContent: hasCall(calls, "confluence", "GET", "/confluence/wiki/rest/api/content", "Basic"),
      confluenceWritesComment: hasCall(calls, "confluence", "POST", "/confluence/wiki/rest/api/content/123/child/comment", "Basic"),
      notionQueriesDatabase: hasCall(calls, "notion", "POST", "/notion/v1/databases/db123/query", "Bearer"),
      notionWritesBlock: hasCall(calls, "notion", "PATCH", "/notion/v1/blocks/page123/children", "Bearer"),
      linearUsesGraphQL: hasCall(calls, "linear", "POST", "/linear/graphql", "Raw"),
      linearWritesComment: calls.some((call) => call.provider === "linear" && call.path === "/linear/graphql" && call.body.includes("commentCreate")),
      listPollWritebackApplied: applied.every((item) => item.status === "applied"),
      dryRunDoesNotPost: githubNoDryRunPost && slackNoDryRunPost && discordNoDryRunPost && jiraNoDryRunPost && confluenceNoDryRunPost && notionNoDryRunPost && linearNoDryRunPost && dryRuns.every((item) => item.status === "queued"),
      authorizationHeadersRedactedInSyncRecords: records.every((record) => !record.request?.headers.authorization || record.request.headers.authorization === "<redacted>"),
      secretsNotRetained: secretSamples.every((secret) => !serializedState.includes(secret)),
      githubPrDecisionTagged: Boolean(githubPrDecision?.tags.includes("pr-decision") && githubPrDecision.provenance.sourceRef?.connectorId === "official-github"),
      githubActionsFailureTagged: Boolean(githubTestFailure?.tags.includes("test-failure") && githubTestFailure.tags.includes("harness-action")),
      slackDecisionNeedsReview: Boolean(slackDecision?.beliefState === "needs_verification" && slackDecision.consent.visibility === "org" && service.verificationQueue("vendor-user").items.some((item) => item.memoryId === slackDecision.id)),
      discordDecisionNeedsReview: Boolean(discordDecision?.beliefState === "needs_verification" && discordDecision.consent.visibility === "org" && service.verificationQueue("vendor-user").items.some((item) => item.memoryId === discordDecision.id)),
      jiraCorrectionTagged: Boolean(jiraCorrection?.tags.includes("engineering-correction") && jiraCorrection.tags.includes("jira")),
      confluenceArchitectureTagged: Boolean(confluenceArchitecture?.tags.includes("architecture-decision") && confluenceArchitecture.tags.includes("confluence")),
      notionDecisionTagged: Boolean(notionDecision?.tags.includes("architecture-decision") && notionDecision.tags.includes("notion")),
      linearCorrectionTagged: Boolean(linearCorrection?.tags.includes("engineering-correction") && linearCorrection.tags.includes("linear")),
      externalHealthRecordsVisible: finalHealth.length === vendorConnectorIds.length && finalHealth.every((item) => item.records > 0 && item.externalVendor?.configured === true)
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
  if (method === "GET" && url.pathname === "/jira/rest/api/3/search") {
    send(response, 200, {
      issues: [
        {
          id: "10042",
          key: "CB-42",
          fields: {
            summary: "Correction: do not read generated dist files for production evidence",
            status: { name: "In Progress" },
            labels: ["plan1_5", "connector"],
            components: [{ name: "memory" }],
            assignee: { displayName: "Maintainer" },
            updated: "2026-05-25T07:00:00.000Z",
            issuetype: { name: "Task" },
            comment: {
              comments: [
                {
                  id: "comment-1",
                  author: { displayName: "Reviewer" },
                  updated: "2026-05-25T07:01:00.000Z",
                  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Use source files instead and verify with npm run build." }] }] }
                }
              ]
            }
          }
        }
      ]
    });
    return;
  }
  if (method === "POST" && url.pathname === "/jira/rest/api/3/issue/CB-42/comment") {
    send(response, 201, { id: "jira-comment-1", body: readJson(body).body });
    return;
  }
  if (method === "GET" && url.pathname === "/confluence/wiki/rest/api/content") {
    send(response, 200, {
      results: [
        {
          id: "123",
          title: "ADR: Connector proof runs must stay hermetic",
          version: { number: 5, when: "2026-05-25T07:10:00.000Z", by: { displayName: "Architect" } },
          metadata: { labels: { results: [{ name: "runbook" }, { name: "architecture" }] } },
          body: { storage: { value: "<p>Architecture decision: vendor connector proof uses fixtures before tenant credentials.</p>", representation: "storage" } },
          _links: { webui: "/wiki/spaces/ENG/pages/123/Connector-proof" }
        }
      ]
    });
    return;
  }
  if (method === "POST" && url.pathname === "/confluence/wiki/rest/api/content/123/child/comment") {
    send(response, 200, { id: "confluence-comment-1", body: readJson(body).body });
    return;
  }
  if (method === "POST" && url.pathname === "/notion/v1/databases/db123/query") {
    send(response, 200, {
      results: [
        {
          id: "page123",
          url: "https://notion.so/page123",
          archived: false,
          last_edited_time: "2026-05-25T07:20:00.000Z",
          last_edited_by: { id: "user123" },
          properties: {
            Name: { title: [{ plain_text: "Architecture Decision Record: SaaS mode follows self-hosted core" }] }
          }
        }
      ]
    });
    return;
  }
  if (method === "PATCH" && url.pathname === "/notion/v1/blocks/page123/children") {
    send(response, 200, { object: "list", results: readJson(body).children ?? [] });
    return;
  }
  if (method === "POST" && url.pathname === "/linear/graphql") {
    const parsed = readJson(body);
    const query = String(parsed.query ?? "");
    if (query.includes("commentCreate")) {
      send(response, 200, { data: { commentCreate: { success: true, comment: { id: "linear-comment-1", url: "https://linear.app/cognibrain/issue/CB-42#comment" } } } });
      return;
    }
    send(response, 200, {
      data: {
        issues: {
          nodes: [
            {
              id: "lin_123",
              identifier: "CB-42",
              title: "Correction: do not skip connector compatibility proof",
              url: "https://linear.app/cognibrain/issue/CB-42",
              updatedAt: "2026-05-25T07:30:00.000Z",
              state: { name: "In Progress" },
              assignee: { name: "Maintainer" },
              labels: { nodes: [{ name: "plan1_5" }, { name: "connector" }] },
              comments: { nodes: [{ id: "lc1", body: "Use hermetic vendor fixtures instead and rerun the live verifier.", user: { name: "Reviewer" }, updatedAt: "2026-05-25T07:31:00.000Z" }] }
            }
          ]
        }
      }
    });
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
  if (pathname.startsWith("/jira/")) return "jira";
  if (pathname.startsWith("/confluence/")) return "confluence";
  if (pathname.startsWith("/notion/")) return "notion";
  if (pathname.startsWith("/linear/")) return "linear";
  return "github";
}

function authorizationScheme(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const first = raw.split(/\s+/)[0] || undefined;
  return raw.includes(" ") ? first : "Raw";
}

function hasCall(calls: VendorHttpCall[], provider: VendorProvider, method: string, path: string, authorizationSchemeName: string): boolean {
  return calls.some((call) =>
    call.provider === provider &&
    call.method === method &&
    call.path === path &&
    call.hasAuthorization &&
    call.authorizationScheme === authorizationSchemeName
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
