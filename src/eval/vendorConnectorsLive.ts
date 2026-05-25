import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

type VendorProvider =
  | "github"
  | "slack"
  | "discord"
  | "jira"
  | "confluence"
  | "notion"
  | "linear"
  | "gitlab"
  | "azure-devops"
  | "teams"
  | "gmail"
  | "google-drive"
  | "google-calendar"
  | "asana"
  | "clickup"
  | "sentry"
  | "datadog"
  | "pagerduty"
  | "posthog";

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

const vendorTargets: Array<{
  provider: VendorProvider;
  connectorId: string;
  operation: "comment" | "summary";
  target: Record<string, unknown>;
}> = [
  { provider: "github", connectorId: "official-github", operation: "comment", target: { pullRequest: 42 } },
  { provider: "slack", connectorId: "official-slack", operation: "summary", target: { channel: "C123", threadId: "1710000000.000100" } },
  { provider: "discord", connectorId: "official-discord", operation: "summary", target: { channel: "D123" } },
  { provider: "jira", connectorId: "official-jira", operation: "comment", target: { issueKey: "CB-42" } },
  { provider: "confluence", connectorId: "official-confluence", operation: "comment", target: { pageId: "123" } },
  { provider: "notion", connectorId: "official-notion", operation: "comment", target: { blockId: "page123" } },
  { provider: "linear", connectorId: "official-linear", operation: "comment", target: { issueId: "lin_123" } },
  { provider: "gitlab", connectorId: "official-gitlab", operation: "comment", target: { mergeRequestIid: 42 } },
  { provider: "azure-devops", connectorId: "official-azure-devops", operation: "comment", target: { repositoryId: "repo123", pullRequestId: 42 } },
  { provider: "teams", connectorId: "official-microsoft-teams", operation: "summary", target: { channel: "channel123" } },
  { provider: "gmail", connectorId: "official-gmail", operation: "summary", target: { messageId: "msg123" } },
  { provider: "google-drive", connectorId: "official-google-drive", operation: "summary", target: { fileId: "file123" } },
  { provider: "google-calendar", connectorId: "official-google-calendar", operation: "summary", target: { eventId: "event123" } },
  { provider: "asana", connectorId: "official-asana", operation: "comment", target: { taskId: "task123" } },
  { provider: "clickup", connectorId: "official-clickup", operation: "comment", target: { taskId: "click123" } },
  { provider: "sentry", connectorId: "official-sentry", operation: "comment", target: { issueId: "sentry123" } },
  { provider: "datadog", connectorId: "official-datadog", operation: "comment", target: { tags: ["env:test"] } },
  { provider: "pagerduty", connectorId: "official-pagerduty", operation: "comment", target: { incidentId: "pd123" } },
  { provider: "posthog", connectorId: "official-posthog", operation: "summary", target: { flagId: "flag123" } }
];

const vendorConnectorIds = vendorTargets.map((item) => item.connectorId);
const secretSamples = [
  "gh_test_secret",
  "xoxb-test-secret",
  "discord_test_secret",
  "jira_test_secret",
  "confluence_test_secret",
  "notion_test_secret",
  "linear_test_secret",
  "gitlab_test_secret",
  "azure_test_secret",
  "teams_test_secret",
  "google_test_secret",
  "asana_test_secret",
  "clickup_test_secret",
  "sentry_test_secret",
  "datadog_api_secret",
  "datadog_app_secret",
  "pagerduty_test_secret",
  "posthog_test_secret"
];

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
        hasAuthorization: hasAuthHeader(request.headers),
        authorizationScheme: authorizationScheme(request.headers),
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
    "MEMORY_GITLAB_PROJECT",
    "MEMORY_GITLAB_TOKEN",
    "MEMORY_GITLAB_API_BASE",
    "MEMORY_AZURE_DEVOPS_ORG",
    "MEMORY_AZURE_DEVOPS_PROJECT",
    "MEMORY_AZURE_DEVOPS_TOKEN",
    "MEMORY_AZURE_DEVOPS_BASE_URL",
    "MEMORY_TEAMS_TEAM_ID",
    "MEMORY_TEAMS_CHANNEL_ID",
    "MEMORY_TEAMS_TOKEN",
    "MEMORY_TEAMS_GRAPH_BASE",
    "MEMORY_GMAIL_ACCOUNT",
    "MEMORY_GOOGLE_TOKEN",
    "MEMORY_GOOGLE_DRIVE_ROOT",
    "MEMORY_GOOGLE_CALENDAR_ID",
    "MEMORY_GOOGLE_API_BASE",
    "MEMORY_ASANA_WORKSPACE",
    "MEMORY_ASANA_PROJECT",
    "MEMORY_ASANA_TOKEN",
    "MEMORY_ASANA_API_BASE",
    "MEMORY_CLICKUP_LIST_ID",
    "MEMORY_CLICKUP_TOKEN",
    "MEMORY_CLICKUP_API_BASE",
    "MEMORY_SENTRY_ORG",
    "MEMORY_SENTRY_PROJECT",
    "MEMORY_SENTRY_TOKEN",
    "MEMORY_SENTRY_API_BASE",
    "MEMORY_DATADOG_SITE",
    "MEMORY_DATADOG_API_KEY",
    "MEMORY_DATADOG_APP_KEY",
    "MEMORY_PAGERDUTY_ACCOUNT",
    "MEMORY_PAGERDUTY_SERVICE_ID",
    "MEMORY_PAGERDUTY_TOKEN",
    "MEMORY_PAGERDUTY_API_BASE",
    "MEMORY_POSTHOG_PROJECT",
    "MEMORY_POSTHOG_TOKEN",
    "MEMORY_POSTHOG_BASE_URL",
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
      MEMORY_GITLAB_PROJECT: "cognilabz/cognibrain",
      MEMORY_GITLAB_TOKEN: secretSamples[7],
      MEMORY_GITLAB_API_BASE: `${base}/gitlab`,
      MEMORY_AZURE_DEVOPS_ORG: "org",
      MEMORY_AZURE_DEVOPS_PROJECT: "project",
      MEMORY_AZURE_DEVOPS_TOKEN: secretSamples[8],
      MEMORY_AZURE_DEVOPS_BASE_URL: `${base}/azure`,
      MEMORY_TEAMS_TEAM_ID: "team123",
      MEMORY_TEAMS_CHANNEL_ID: "channel123",
      MEMORY_TEAMS_TOKEN: secretSamples[9],
      MEMORY_TEAMS_GRAPH_BASE: `${base}/teams`,
      MEMORY_GMAIL_ACCOUNT: "me",
      MEMORY_GOOGLE_TOKEN: secretSamples[10],
      MEMORY_GOOGLE_DRIVE_ROOT: "root",
      MEMORY_GOOGLE_CALENDAR_ID: "primary",
      MEMORY_GOOGLE_API_BASE: `${base}/google`,
      MEMORY_ASANA_WORKSPACE: "workspace123",
      MEMORY_ASANA_PROJECT: "project123",
      MEMORY_ASANA_TOKEN: secretSamples[11],
      MEMORY_ASANA_API_BASE: `${base}/asana`,
      MEMORY_CLICKUP_LIST_ID: "list123",
      MEMORY_CLICKUP_TOKEN: secretSamples[12],
      MEMORY_CLICKUP_API_BASE: `${base}/clickup`,
      MEMORY_SENTRY_ORG: "org",
      MEMORY_SENTRY_PROJECT: "project",
      MEMORY_SENTRY_TOKEN: secretSamples[13],
      MEMORY_SENTRY_API_BASE: `${base}/sentry`,
      MEMORY_DATADOG_SITE: `${base}/datadog`,
      MEMORY_DATADOG_API_KEY: secretSamples[14],
      MEMORY_DATADOG_APP_KEY: secretSamples[15],
      MEMORY_PAGERDUTY_ACCOUNT: "account",
      MEMORY_PAGERDUTY_SERVICE_ID: "service123",
      MEMORY_PAGERDUTY_TOKEN: secretSamples[16],
      MEMORY_PAGERDUTY_API_BASE: `${base}/pagerduty`,
      MEMORY_POSTHOG_PROJECT: "1",
      MEMORY_POSTHOG_TOKEN: secretSamples[17],
      MEMORY_POSTHOG_BASE_URL: `${base}/posthog`,
      MEMORY_CONNECTOR_TIMEOUT_MS: "5000",
      MEMORY_VENDOR_PAGE_SIZE: "20"
    });

    const scope = { userId: "vendor-user", orgId: "org1", projectId: "cognibrain" };
    const initialHealth = service.connectorHealth().filter((item) => vendorConnectorIds.includes(item.connectorId));
    const applied: Array<{ status: string }> = [];
    const dryRuns: Array<{ status: string }> = [];
    const dryRunNoPost: boolean[] = [];

    for (const target of vendorTargets) {
      applied.push(await service.listConnectorItems(target.connectorId));
      applied.push(await service.pollConnector(target.connectorId, scope));
      const dryRunCallCount = calls.length;
      const dryRun = await service.writebackConnector(target.connectorId, { operation: target.operation, content: `Dry-run ${target.provider} memory.`, target: target.target, dryRun: true });
      dryRuns.push(dryRun);
      dryRunNoPost.push(calls.length === dryRunCallCount);
      applied.push(await service.writebackConnector(target.connectorId, { operation: target.operation, content: `Decision captured for ${target.provider}.`, target: target.target, dryRun: false }));
    }

    const memories = service.list("vendor-user");
    const records = service.listConnectorSyncRecords();
    const finalHealth = service.connectorHealth().filter((item) => vendorConnectorIds.includes(item.connectorId));
    const serializedState = JSON.stringify({ memories, records, finalHealth });

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
      gitlabUsesMergeRequests: hasCall(calls, "gitlab", "GET", "/gitlab/api/v4/projects/cognilabz%2Fcognibrain/merge_requests", "Token"),
      gitlabWritesNote: hasCall(calls, "gitlab", "POST", "/gitlab/api/v4/projects/cognilabz%2Fcognibrain/merge_requests/42/notes", "Token"),
      azureDevOpsUsesPullRequests: hasCall(calls, "azure-devops", "GET", "/azure/org/project/_apis/git/pullrequests", "Basic"),
      azureDevOpsWritesThread: hasCall(calls, "azure-devops", "POST", "/azure/org/project/_apis/git/repositories/repo123/pullRequests/42/threads", "Basic"),
      teamsUsesChannelMessages: hasCall(calls, "teams", "GET", "/teams/v1.0/teams/team123/channels/channel123/messages", "Bearer"),
      teamsWritesChannelMessage: hasCall(calls, "teams", "POST", "/teams/v1.0/teams/team123/channels/channel123/messages", "Bearer"),
      gmailUsesMessageList: hasCall(calls, "gmail", "GET", "/google/gmail/v1/users/me/messages", "Bearer"),
      gmailWritesMessageModify: hasCall(calls, "gmail", "POST", "/google/gmail/v1/users/me/messages/msg123/modify", "Bearer"),
      googleDriveUsesFilesList: hasCall(calls, "google-drive", "GET", "/google/drive/v3/files", "Bearer"),
      googleDriveWritesFileMetadata: hasCall(calls, "google-drive", "PATCH", "/google/drive/v3/files/file123", "Bearer"),
      googleCalendarUsesEventsList: hasCall(calls, "google-calendar", "GET", "/google/calendar/v3/calendars/primary/events", "Bearer"),
      googleCalendarWritesEvent: hasCall(calls, "google-calendar", "PATCH", "/google/calendar/v3/calendars/primary/events/event123", "Bearer"),
      asanaUsesTasks: hasCall(calls, "asana", "GET", "/asana/api/1.0/tasks", "Bearer"),
      asanaWritesStory: hasCall(calls, "asana", "POST", "/asana/api/1.0/tasks/task123/stories", "Bearer"),
      clickupUsesTasks: hasCall(calls, "clickup", "GET", "/clickup/api/v2/list/list123/task", "Raw"),
      clickupWritesComment: hasCall(calls, "clickup", "POST", "/clickup/api/v2/task/click123/comment", "Raw"),
      sentryUsesProjectIssues: hasCall(calls, "sentry", "GET", "/sentry/api/0/projects/org/project/issues/", "Bearer"),
      sentryWritesComment: hasCall(calls, "sentry", "POST", "/sentry/api/0/issues/sentry123/comments/", "Bearer"),
      datadogUsesMonitors: hasCall(calls, "datadog", "GET", "/datadog/api/v1/monitor", "DD"),
      datadogWritesEvent: hasCall(calls, "datadog", "POST", "/datadog/api/v1/events", "DD"),
      pagerDutyUsesIncidents: hasCall(calls, "pagerduty", "GET", "/pagerduty/incidents", "Bearer"),
      pagerDutyWritesNote: hasCall(calls, "pagerduty", "POST", "/pagerduty/incidents/pd123/notes", "Bearer"),
      posthogUsesFeatureFlags: hasCall(calls, "posthog", "GET", "/posthog/api/projects/1/feature_flags/", "Bearer"),
      posthogWritesFeatureFlag: hasCall(calls, "posthog", "PATCH", "/posthog/api/projects/1/feature_flags/flag123/", "Bearer"),
      listPollWritebackApplied: applied.every((item) => item.status === "applied"),
      dryRunDoesNotPost: dryRunNoPost.every(Boolean) && dryRuns.every((item) => item.status === "queued"),
      authorizationHeadersRedactedInSyncRecords: records.every((record) => !record.request?.headers.authorization || record.request.headers.authorization === "<redacted>"),
      secretsNotRetained: secretSamples.every((secret) => !serializedState.includes(secret)),
      memoryTagsCoverProviders: vendorTargets.every((target) => memories.some((memory) => memory.provenance.sourceRef?.connectorId === target.connectorId && memory.tags.includes(target.provider))),
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
  if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/pulls") return send(response, 200, [{ number: 42, title: "Release gate approved: Atlas depends on CacheClient", state: "open", html_url: "https://github.com/cognilabz/cognibrain/pull/42", user: { login: "reviewer" }, updated_at: "2026-05-25T06:00:00.000Z" }]);
  if (method === "GET" && url.pathname === "/github/repos/cognilabz/cognibrain/actions/runs") return send(response, 200, { workflow_runs: [{ id: 7, name: "npm test", head_branch: "main", html_url: "https://github.com/cognilabz/cognibrain/actions/runs/7", status: "completed", conclusion: "failure" }] });
  if (method === "POST" && url.pathname === "/github/repos/cognilabz/cognibrain/issues/42/comments") return send(response, 201, { id: 9001, body: readJson(body).body });
  if (method === "GET" && url.pathname === "/slack/api/conversations.list") return send(response, 200, { ok: true, channels: [{ id: "C123", name: "release-decisions", is_channel: true }] });
  if (method === "GET" && url.pathname === "/slack/api/conversations.history") return send(response, 200, { ok: true, messages: [{ ts: "1710000000.000100", thread_ts: "1710000000.000100", user: "U123", text: "Slack decision: Team decided Atlas must use Postgres before release." }] });
  if (method === "POST" && url.pathname === "/slack/api/chat.postMessage") return send(response, 200, { ok: true, channel: readJson(body).channel, ts: "1710000000.000200" });
  if (method === "GET" && url.pathname === "/discord/api/v10/channels/D123/messages") return send(response, 200, [{ id: "987654321", channel_id: "D123", guild_id: "G123", content: "Discord decision: Support bot should cite evidence before action.", author: { username: "operator" } }]);
  if (method === "POST" && url.pathname === "/discord/api/v10/channels/D123/messages") return send(response, 200, { id: "987654322", channel_id: "D123", content: readJson(body).content });
  if (method === "GET" && url.pathname === "/jira/rest/api/3/search") return send(response, 200, { issues: [{ id: "10042", key: "CB-42", fields: { summary: "Correction: do not read generated dist files for production evidence", status: { name: "In Progress" }, labels: ["release", "connector"], components: [{ name: "memory" }], assignee: { displayName: "Maintainer" }, updated: "2026-05-25T07:00:00.000Z", issuetype: { name: "Task" }, comment: { comments: [{ id: "comment-1", author: { displayName: "Reviewer" }, updated: "2026-05-25T07:01:00.000Z", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Use source files instead and verify with npm run build." }] }] } }] } } }] });
  if (method === "POST" && url.pathname === "/jira/rest/api/3/issue/CB-42/comment") return send(response, 201, { id: "jira-comment-1", body: readJson(body).body });
  if (method === "GET" && url.pathname === "/confluence/wiki/rest/api/content") return send(response, 200, { results: [{ id: "123", title: "ADR: Connector proof runs must stay hermetic", version: { number: 5, when: "2026-05-25T07:10:00.000Z", by: { displayName: "Architect" } }, metadata: { labels: { results: [{ name: "runbook" }, { name: "architecture" }] } }, body: { storage: { value: "<p>Architecture decision: vendor connector proof uses fixtures before tenant credentials.</p>", representation: "storage" } }, _links: { webui: "/wiki/spaces/ENG/pages/123/Connector-proof" } }] });
  if (method === "POST" && url.pathname === "/confluence/wiki/rest/api/content/123/child/comment") return send(response, 200, { id: "confluence-comment-1", body: readJson(body).body });
  if (method === "POST" && url.pathname === "/notion/v1/databases/db123/query") return send(response, 200, { results: [{ id: "page123", url: "https://notion.so/page123", archived: false, last_edited_time: "2026-05-25T07:20:00.000Z", last_edited_by: { id: "user123" }, properties: { Name: { title: [{ plain_text: "Architecture Decision Record: SaaS mode follows self-hosted core" }] } } }] });
  if (method === "PATCH" && url.pathname === "/notion/v1/blocks/page123/children") return send(response, 200, { object: "list", results: readJson(body).children ?? [] });
  if (method === "POST" && url.pathname === "/linear/graphql") {
    const query = String(readJson(body).query ?? "");
    if (query.includes("commentCreate")) return send(response, 200, { data: { commentCreate: { success: true, comment: { id: "linear-comment-1", url: "https://linear.app/cognibrain/issue/CB-42#comment" } } } });
    return send(response, 200, { data: { issues: { nodes: [{ id: "lin_123", identifier: "CB-42", title: "Correction: do not skip connector compatibility proof", url: "https://linear.app/cognibrain/issue/CB-42", updatedAt: "2026-05-25T07:30:00.000Z", state: { name: "In Progress" }, assignee: { name: "Maintainer" }, labels: { nodes: [{ name: "release" }, { name: "connector" }] }, comments: { nodes: [{ id: "lc1", body: "Use hermetic vendor fixtures instead and rerun the live verifier.", user: { name: "Reviewer" }, updatedAt: "2026-05-25T07:31:00.000Z" }] } }] } } });
  }
  if (method === "GET" && url.pathname === "/gitlab/api/v4/projects/cognilabz%2Fcognibrain/merge_requests") return send(response, 200, [{ iid: 42, title: "Release MR: keep connector evidence replayable", state: "opened", web_url: "https://gitlab.com/cognilabz/cognibrain/-/merge_requests/42", author: { username: "reviewer" }, labels: ["connector"], updated_at: "2026-05-25T08:00:00.000Z" }]);
  if (method === "POST" && url.pathname === "/gitlab/api/v4/projects/cognilabz%2Fcognibrain/merge_requests/42/notes") return send(response, 201, { id: "gitlab-note-1", body: readJson(body).body });
  if (method === "GET" && url.pathname === "/azure/org/project/_apis/git/pullrequests") return send(response, 200, { value: [{ pullRequestId: 42, title: "Azure PR: connector install proof", status: "active", url: "https://dev.azure.com/org/project/_git/repo/pullrequest/42", createdBy: { displayName: "Reviewer" }, repository: { id: "repo123" }, creationDate: "2026-05-25T08:10:00.000Z" }] });
  if (method === "POST" && url.pathname === "/azure/org/project/_apis/git/repositories/repo123/pullRequests/42/threads") return send(response, 200, { id: "azure-thread-1", comments: readJson(body).comments });
  if (method === "GET" && url.pathname === "/teams/v1.0/teams/team123/channels/channel123/messages") return send(response, 200, { value: [{ id: "teams123", body: { content: "Teams decision: rollout requires connector smoke evidence." }, from: { user: { displayName: "Operator" } }, createdDateTime: "2026-05-25T08:20:00.000Z", webUrl: "https://teams.microsoft.com/l/message/teams123" }] });
  if (method === "POST" && url.pathname === "/teams/v1.0/teams/team123/channels/channel123/messages") return send(response, 201, { id: "teams124", body: readJson(body).body });
  if (method === "GET" && url.pathname === "/google/gmail/v1/users/me/messages") return send(response, 200, { messages: [{ id: "msg123", threadId: "thread123" }] });
  if (method === "POST" && url.pathname === "/google/gmail/v1/users/me/messages/msg123/modify") return send(response, 200, { id: "msg123", labelIds: readJson(body).addLabelIds });
  if (method === "GET" && url.pathname === "/google/drive/v3/files") return send(response, 200, { files: [{ id: "file123", name: "Connector Runbook", mimeType: "application/vnd.google-apps.document", webViewLink: "https://drive.google.com/file123", modifiedTime: "2026-05-25T08:30:00.000Z", owners: [{ displayName: "Maintainer" }], description: "Architecture decision: connect external systems through native drivers." }] });
  if (method === "PATCH" && url.pathname === "/google/drive/v3/files/file123") return send(response, 200, { id: "file123", description: readJson(body).description });
  if (method === "GET" && url.pathname === "/google/calendar/v3/calendars/primary/events") return send(response, 200, { items: [{ id: "event123", summary: "Incident review", description: "Decision: add PagerDuty and Datadog memory sync.", htmlLink: "https://calendar.google.com/event123", start: { dateTime: "2026-05-25T09:00:00.000Z" }, updated: "2026-05-25T08:40:00.000Z", organizer: { email: "ops@example.com" } }] });
  if (method === "PATCH" && url.pathname === "/google/calendar/v3/calendars/primary/events/event123") return send(response, 200, { id: "event123", description: readJson(body).description });
  if (method === "GET" && url.pathname === "/asana/api/1.0/tasks") return send(response, 200, { data: [{ gid: "task123", name: "Correction: do not ship connector names without drivers", completed: false, permalink_url: "https://app.asana.com/0/task123", assignee: { name: "Maintainer" }, modified_at: "2026-05-25T08:50:00.000Z", notes: "Use native REST integration and hermetic proof.", memberships: [{ project: { name: "Cognibrain" } }] }] });
  if (method === "POST" && url.pathname === "/asana/api/1.0/tasks/task123/stories") return send(response, 201, { data: { gid: "story123", text: readJson(readJson(body).data as string).text ?? readJson(body).data } });
  if (method === "GET" && url.pathname === "/clickup/api/v2/list/list123/task") return send(response, 200, { tasks: [{ id: "click123", name: "Correction: verify connector compatibility", status: { status: "in progress" }, url: "https://app.clickup.com/t/click123", assignees: [{ username: "maintainer" }], date_updated: "2026-05-25T09:00:00.000Z", markdown_description: "Use the live verifier before claiming readiness." }] });
  if (method === "POST" && url.pathname === "/clickup/api/v2/task/click123/comment") return send(response, 201, { id: "click-comment-1", comment_text: readJson(body).comment_text });
  if (method === "GET" && url.pathname === "/sentry/api/0/projects/org/project/issues/") return send(response, 200, [{ id: "sentry123", title: "TypeError in connector writeback", status: "unresolved", level: "error", permalink: "https://sentry.io/issues/sentry123", lastSeen: "2026-05-25T09:10:00.000Z", count: "12", userCount: 3 }]);
  if (method === "POST" && url.pathname === "/sentry/api/0/issues/sentry123/comments/") return send(response, 201, { id: "sentry-comment-1", text: readJson(body).text });
  if (method === "GET" && url.pathname === "/datadog/api/v1/monitor") return send(response, 200, [{ id: 123, name: "Connector latency monitor", overall_state: "Alert", type: "query alert", query: "avg(last_5m):...", url: "https://app.datadoghq.com/monitors/123", tags: ["service:cognibrain"] }]);
  if (method === "POST" && url.pathname === "/datadog/api/v1/events") return send(response, 202, { id: "event123", text: readJson(body).text });
  if (method === "GET" && url.pathname === "/pagerduty/incidents") return send(response, 200, { incidents: [{ id: "pd123", title: "Connector smoke failed", status: "triggered", urgency: "high", html_url: "https://pagerduty.com/incidents/pd123", service: { summary: "Cognibrain" }, updated_at: "2026-05-25T09:20:00.000Z" }] });
  if (method === "POST" && url.pathname === "/pagerduty/incidents/pd123/notes") return send(response, 201, { note: readJson(body).note });
  if (method === "GET" && url.pathname === "/posthog/api/projects/1/feature_flags/") return send(response, 200, { results: [{ id: "flag123", key: "memory-connectors", name: "Memory connectors", active: true, updated_at: "2026-05-25T09:30:00.000Z", created_by: { email: "product@example.com" } }] });
  if (method === "PATCH" && url.pathname === "/posthog/api/projects/1/feature_flags/flag123/") return send(response, 200, { id: "flag123", description: readJson(body).description });
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
  if (pathname.startsWith("/gitlab/")) return "gitlab";
  if (pathname.startsWith("/azure/")) return "azure-devops";
  if (pathname.startsWith("/teams/")) return "teams";
  if (pathname.startsWith("/google/gmail/")) return "gmail";
  if (pathname.startsWith("/google/drive/")) return "google-drive";
  if (pathname.startsWith("/google/calendar/")) return "google-calendar";
  if (pathname.startsWith("/asana/")) return "asana";
  if (pathname.startsWith("/clickup/")) return "clickup";
  if (pathname.startsWith("/sentry/")) return "sentry";
  if (pathname.startsWith("/datadog/")) return "datadog";
  if (pathname.startsWith("/pagerduty/")) return "pagerduty";
  if (pathname.startsWith("/posthog/")) return "posthog";
  return "github";
}

function hasAuthHeader(headers: IncomingHttpHeaders): boolean {
  return Boolean(headers.authorization || headers["private-token"] || headers["dd-api-key"]);
}

function authorizationScheme(headers: IncomingHttpHeaders): string | undefined {
  const raw = Array.isArray(headers.authorization) ? headers.authorization[0] : headers.authorization;
  if (raw) {
    const first = raw.split(/\s+/)[0] || undefined;
    return raw.includes(" ") ? first : "Raw";
  }
  if (headers["private-token"]) return "Token";
  if (headers["dd-api-key"]) return "DD";
  return undefined;
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

function readJson(body: unknown): Record<string, unknown> {
  if (typeof body !== "string") return {};
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
