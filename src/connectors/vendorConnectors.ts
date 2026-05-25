import type { ConnectorManifest, ConnectorSyncRecord, MemoryExtractionEvent } from "../core";

export type ExternalVendorProvider = "github" | "slack" | "discord" | "jira" | "confluence" | "notion" | "linear";

export interface ExternalVendorListResult {
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  request?: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

export interface ExternalVendorPollResult {
  status: "applied" | "failed";
  events: Array<MemoryExtractionEvent & { externalId?: string }>;
  request?: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

export interface ExternalVendorWritebackResult {
  status: "applied" | "failed";
  request: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

type FetchLike = typeof fetch;

export function externalVendorProvider(manifest: ConnectorManifest): ExternalVendorProvider | undefined {
  if (manifest.vendor?.provider) return manifest.vendor.provider;
  if (manifest.id === "official-github") return "github";
  if (manifest.id === "official-slack") return "slack";
  if (manifest.id === "official-discord") return "discord";
  if (manifest.id === "official-jira") return "jira";
  if (manifest.id === "official-confluence") return "confluence";
  if (manifest.id === "official-notion") return "notion";
  if (manifest.id === "official-linear") return "linear";
  return undefined;
}

export function shouldUseExternalVendor(manifest: ConnectorManifest, endpoint?: string): boolean {
  return Boolean(endpoint?.startsWith("vendor://") || manifest.vendor?.provider);
}

export function externalVendorConfigured(provider: ExternalVendorProvider, env: NodeJS.ProcessEnv = process.env): { configured: boolean; missing: string[] } {
  const required = requiredVendorEnv(provider);
  const missing = required.filter((key) => !vendorEnv(env, key));
  return { configured: missing.length === 0, missing };
}

export async function listExternalVendorItems(
  manifest: ConnectorManifest,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
): Promise<ExternalVendorListResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) return { status: "failed", items: [], error: `No external vendor provider for ${manifest.id}` };
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) return { status: "failed", items: [], error: `Missing external vendor env: ${configured.missing.join(", ")}` };
  if (provider === "github") return listGitHub(fetchImpl, timeoutMs);
  if (provider === "slack") return listSlack(fetchImpl, timeoutMs);
  if (provider === "discord") return listDiscord(fetchImpl, timeoutMs);
  if (provider === "jira") return listJira(fetchImpl, timeoutMs);
  if (provider === "confluence") return listConfluence(fetchImpl, timeoutMs);
  if (provider === "notion") return listNotion(fetchImpl, timeoutMs);
  return listLinear(fetchImpl, timeoutMs);
}

export async function pollExternalVendorConnector(
  manifest: ConnectorManifest,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
): Promise<ExternalVendorPollResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) return { status: "failed", events: [], error: `No external vendor provider for ${manifest.id}` };
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) return { status: "failed", events: [], error: `Missing external vendor env: ${configured.missing.join(", ")}` };
  if (provider === "github") return pollGitHub(fetchImpl, timeoutMs);
  if (provider === "slack") return pollSlack(fetchImpl, timeoutMs);
  if (provider === "discord") return pollDiscord(fetchImpl, timeoutMs);
  if (provider === "jira") return pollJira(fetchImpl, timeoutMs);
  if (provider === "confluence") return pollConfluence(fetchImpl, timeoutMs);
  if (provider === "notion") return pollNotion(fetchImpl, timeoutMs);
  return pollLinear(fetchImpl, timeoutMs);
}

export async function writebackExternalVendorConnector(
  manifest: ConnectorManifest,
  record: ConnectorSyncRecord,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
  dryRun = false
): Promise<ExternalVendorWritebackResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) throw new Error(`No external vendor provider for ${manifest.id}`);
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) {
    return {
      status: "failed",
      request: { method: "POST", url: `vendor://${provider}/writeback`, headers: {}, body: JSON.stringify(record.payload ?? {}) },
      error: `Missing external vendor env: ${configured.missing.join(", ")}`
    };
  }
  if (provider === "github") return writeGitHub(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "slack") return writeSlack(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "discord") return writeDiscord(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "jira") return writeJira(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "confluence") return writeConfluence(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "notion") return writeNotion(record, fetchImpl, timeoutMs, dryRun);
  return writeLinear(record, fetchImpl, timeoutMs, dryRun);
}

function vendorEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  if (key === "MEMORY_SLACK_TOKEN") return env.MEMORY_SLACK_TOKEN || env.MEMORY_SLACK_BOT_TOKEN;
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return env.MEMORY_DISCORD_BOT_TOKEN || env.MEMORY_DISCORD_TOKEN;
  if (key === "MEMORY_GITHUB_TOKEN") return env.MEMORY_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (key === "MEMORY_JIRA_API_TOKEN") return env.MEMORY_JIRA_API_TOKEN || env.JIRA_API_TOKEN;
  if (key === "MEMORY_CONFLUENCE_API_TOKEN") return env.MEMORY_CONFLUENCE_API_TOKEN || env.CONFLUENCE_API_TOKEN || env.MEMORY_JIRA_API_TOKEN;
  if (key === "MEMORY_NOTION_TOKEN") return env.MEMORY_NOTION_TOKEN || env.NOTION_TOKEN;
  if (key === "MEMORY_LINEAR_API_KEY") return env.MEMORY_LINEAR_API_KEY || env.LINEAR_API_KEY;
  return env[key];
}

function requiredVendorEnv(provider: ExternalVendorProvider): string[] {
  if (provider === "github") return ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"];
  if (provider === "slack") return ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"];
  if (provider === "discord") return ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"];
  if (provider === "jira") return ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"];
  if (provider === "confluence") return ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"];
  if (provider === "notion") return ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"];
  return ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"];
}

function githubRepo(): { owner: string; repo: string } {
  const full = process.env.MEMORY_GITHUB_REPO ?? process.env.GITHUB_REPOSITORY ?? "";
  const [owner, repo] = full.split("/");
  if (!owner || !repo) throw new Error("MEMORY_GITHUB_REPO must be owner/repo");
  return { owner, repo };
}

function githubHeaders(): Record<string, string> {
  const token = vendorEnv(process.env, "MEMORY_GITHUB_TOKEN");
  return {
    accept: "application/vnd.github+json",
    "user-agent": "cognibrain-vendor-connector/0.1",
    "x-github-api-version": process.env.MEMORY_GITHUB_API_VERSION ?? "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

function slackHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, "MEMORY_SLACK_TOKEN")}`,
    "content-type": "application/json; charset=utf-8",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function discordHeaders(): Record<string, string> {
  const raw = vendorEnv(process.env, "MEMORY_DISCORD_BOT_TOKEN") ?? "";
  const authorization = /^(Bot|Bearer)\s+/i.test(raw) ? raw : `Bot ${raw}`;
  return {
    authorization,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function atlassianHeaders(product: "jira" | "confluence"): Record<string, string> {
  const emailKey = product === "jira" ? "MEMORY_JIRA_EMAIL" : "MEMORY_CONFLUENCE_EMAIL";
  const tokenKey = product === "jira" ? "MEMORY_JIRA_API_TOKEN" : "MEMORY_CONFLUENCE_API_TOKEN";
  const email = vendorEnv(process.env, emailKey) ?? "";
  const token = vendorEnv(process.env, tokenKey) ?? "";
  return {
    accept: "application/json",
    authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function notionHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, "MEMORY_NOTION_TOKEN")}`,
    "content-type": "application/json",
    "notion-version": process.env.MEMORY_NOTION_VERSION ?? "2022-06-28",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function linearHeaders(): Record<string, string> {
  return {
    authorization: vendorEnv(process.env, "MEMORY_LINEAR_API_KEY") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

async function listGitHub(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const { owner, repo } = githubRepo();
  const url = apiUrl(process.env.MEMORY_GITHUB_API_BASE ?? "https://api.github.com", `/repos/${owner}/${repo}/pulls`, {
    state: process.env.MEMORY_GITHUB_PULL_STATE ?? "open",
    per_page: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, githubHeaders());
  const response = await fetchJson<Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json) ? response.json.map(githubPullItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollGitHub(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGitHub(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  const pulls = list.items.map(githubPullEvent);
  const actions = await githubFailedWorkflowEvents(fetchImpl, timeoutMs).catch(() => []);
  return { status: "applied", events: [...pulls, ...actions], request: list.request, responseStatusCode: list.responseStatusCode };
}

async function githubFailedWorkflowEvents(fetchImpl: FetchLike, timeoutMs: number): Promise<Array<MemoryExtractionEvent & { externalId?: string }>> {
  if (process.env.MEMORY_GITHUB_INCLUDE_ACTIONS === "false") return [];
  const { owner, repo } = githubRepo();
  const url = apiUrl(process.env.MEMORY_GITHUB_API_BASE ?? "https://api.github.com", `/repos/${owner}/${repo}/actions/runs`, {
    status: "failure",
    per_page: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "10"
  });
  const response = await fetchJson<{ workflow_runs?: Array<Record<string, unknown>> }>(requestShape("GET", url, githubHeaders()), fetchImpl, timeoutMs);
  if (!response.ok || !Array.isArray(response.json?.workflow_runs)) return [];
  return response.json.workflow_runs.map((run) => {
    const name = str(run.name, "workflow");
    const branch = str(run.head_branch, "unknown branch");
    const runId = String(run.id ?? run.run_number ?? run.html_url ?? `${name}:${branch}`);
    return {
      role: "tool",
      content: `GitHub Actions failure in ${repo}: ${name} on ${branch}.`,
      externalId: `github-run-${runId}`,
      uri: str(run.html_url, undefined),
      source: { kind: "tool", confidence: 0.9 },
      metadata: { vendor: "github", eventType: "test_failure", repo: `${owner}/${repo}`, runId: run.id, status: run.status, conclusion: run.conclusion, command: name }
    };
  });
}

async function writeGitHub(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const { owner, repo } = githubRepo();
  const issueNumber = String(record.target?.pullRequest ?? record.target?.issueNumber ?? record.target?.externalId ?? "").replace(/^pr-/, "");
  if (!issueNumber) {
    return {
      status: "failed",
      request: { method: "POST", url: "vendor://github/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) },
      error: "GitHub writeback requires target.pullRequest, target.issueNumber, or target.externalId"
    };
  }
  const url = apiUrl(process.env.MEMORY_GITHUB_API_BASE ?? "https://api.github.com", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
  const request = requestShape("POST", url, { ...githubHeaders(), "content-type": "application/json" }, JSON.stringify({ body: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listSlack(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const url = apiUrl(process.env.MEMORY_SLACK_API_BASE ?? "https://slack.com/api", "/conversations.list", { limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "50" });
  const request = requestShape("GET", url, slackHeaders());
  const response = await fetchJson<{ ok?: boolean; channels?: Array<Record<string, unknown>>; error?: string }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.ok !== false;
  return {
    status: ok ? "applied" : "failed",
    items: ok && Array.isArray(response.json?.channels) ? response.json.channels.map((channel) => ({ externalId: channel.id, title: channel.name, isChannel: channel.is_channel })) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: ok ? undefined : response.json?.error ?? response.error
  };
}

async function pollSlack(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const channel = process.env.MEMORY_SLACK_CHANNEL_ID ?? "";
  const url = apiUrl(process.env.MEMORY_SLACK_API_BASE ?? "https://slack.com/api", "/conversations.history", { channel, limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20" });
  const request = requestShape("GET", url, slackHeaders());
  const response = await fetchJson<{ ok?: boolean; messages?: Array<Record<string, unknown>>; error?: string }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.ok !== false;
  return {
    status: ok ? "applied" : "failed",
    events: ok && Array.isArray(response.json?.messages) ? response.json.messages.map((message) => ({
      role: "user",
      content: `Slack message in ${channel}: ${str(message.text, "")}`,
      externalId: str(message.ts, undefined),
      uri: str(message.permalink, undefined),
      source: { kind: "transcript", confidence: 0.86 },
      metadata: { vendor: "slack", eventType: "thread_decision", channel, threadId: message.thread_ts, author: str(message.user, str(message.username, undefined)), reviewRequired: true, visibility: "org" }
    })) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: ok ? undefined : response.json?.error ?? response.error
  };
}

async function writeSlack(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const channel = str(record.target?.channel, process.env.MEMORY_SLACK_CHANNEL_ID ?? "");
  const body = JSON.stringify({ channel, text: str(record.payload?.text, "Cognibrain memory update."), thread_ts: record.target?.threadId });
  const request = requestShape("POST", apiUrl(process.env.MEMORY_SLACK_API_BASE ?? "https://slack.com/api", "/chat.postMessage"), slackHeaders(), body);
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<{ ok?: boolean; error?: string }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.ok !== false;
  return { status: ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: ok ? undefined : response.json?.error ?? response.error };
}

async function listDiscord(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const poll = await pollDiscord(fetchImpl, timeoutMs);
  return { status: poll.status, items: poll.events.map((event) => ({ externalId: event.externalId, title: event.content, channel: event.metadata?.channel })), request: poll.request, responseStatusCode: poll.responseStatusCode, error: poll.error };
}

async function pollDiscord(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const channel = process.env.MEMORY_DISCORD_CHANNEL_ID ?? "";
  const url = apiUrl(process.env.MEMORY_DISCORD_API_BASE ?? "https://discord.com/api/v10", `/channels/${channel}/messages`, { limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20" });
  const request = requestShape("GET", url, discordHeaders());
  const response = await fetchJson<Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    events: response.ok && Array.isArray(response.json) ? response.json.map((message) => ({
      role: "user",
      content: `Discord message in ${channel}: ${str(message.content, "")}`,
      externalId: str(message.id, undefined),
      uri: discordJumpUrl(message, channel),
      source: { kind: "transcript", confidence: 0.84 },
      metadata: { vendor: "discord", eventType: "thread_decision", channel, threadId: message.thread_id, author: str((message.author as Record<string, unknown> | undefined)?.username, undefined), reviewRequired: true, visibility: "org" }
    })) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function writeDiscord(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const channel = str(record.target?.channel, process.env.MEMORY_DISCORD_CHANNEL_ID ?? "");
  const body = JSON.stringify({ content: str(record.payload?.text, "Cognibrain memory update.").slice(0, 2000), allowed_mentions: { parse: [] } });
  const request = requestShape("POST", apiUrl(process.env.MEMORY_DISCORD_API_BASE ?? "https://discord.com/api/v10", `/channels/${channel}/messages`), discordHeaders(), body);
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listJira(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const project = process.env.MEMORY_JIRA_PROJECT ?? "";
  const url = apiUrl(process.env.MEMORY_JIRA_BASE_URL ?? "https://example.atlassian.net", "/rest/api/3/search", {
    jql: `project=${project} ORDER BY updated DESC`,
    maxResults: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    fields: "summary,status,labels,components,assignee,updated,comment,parent"
  });
  const request = requestShape("GET", url, atlassianHeaders("jira"));
  const response = await fetchJson<{ issues?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.issues) ? response.json.issues.map(jiraIssueItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollJira(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listJira(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.flatMap(jiraIssueEvents), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeJira(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueKey = String(record.target?.issueKey ?? record.target?.externalId ?? "");
  if (!issueKey) return { status: "failed", request: { method: "POST", url: "vendor://jira/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Jira writeback requires target.issueKey or target.externalId" };
  const url = apiUrl(process.env.MEMORY_JIRA_BASE_URL ?? "https://example.atlassian.net", `/rest/api/3/issue/${issueKey}/comment`);
  const request = requestShape("POST", url, atlassianHeaders("jira"), JSON.stringify({ body: adfDocument(str(record.payload?.text, "Cognibrain memory update.")) }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listConfluence(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const space = process.env.MEMORY_CONFLUENCE_SPACE ?? "";
  const url = apiUrl(process.env.MEMORY_CONFLUENCE_BASE_URL ?? "https://example.atlassian.net", "/wiki/rest/api/content", {
    spaceKey: space,
    type: "page",
    expand: "version,metadata.labels,body.storage",
    limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, atlassianHeaders("confluence"));
  const response = await fetchJson<{ results?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.results) ? response.json.results.map(confluencePageItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollConfluence(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listConfluence(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(confluencePageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeConfluence(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const pageId = String(record.target?.pageId ?? record.target?.externalId ?? "");
  if (!pageId) return { status: "failed", request: { method: "POST", url: "vendor://confluence/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Confluence writeback requires target.pageId or target.externalId" };
  const url = apiUrl(process.env.MEMORY_CONFLUENCE_BASE_URL ?? "https://example.atlassian.net", `/wiki/rest/api/content/${pageId}/child/comment`);
  const request = requestShape("POST", url, atlassianHeaders("confluence"), JSON.stringify({ type: "comment", container: { id: pageId, type: "page" }, body: { storage: { value: `<p>${escapeHtml(str(record.payload?.text, "Cognibrain memory update."))}</p>`, representation: "storage" } } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listNotion(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const databaseId = process.env.MEMORY_NOTION_DATABASE_ID ?? "";
  const request = requestShape("POST", apiUrl(process.env.MEMORY_NOTION_API_BASE ?? "https://api.notion.com", `/v1/databases/${databaseId}/query`), notionHeaders(), JSON.stringify({ page_size: Number(process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20") }));
  const response = await fetchJson<{ results?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.results) ? response.json.results.map(notionPageItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollNotion(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listNotion(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(notionPageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeNotion(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const blockId = String(record.target?.blockId ?? record.target?.pageId ?? record.target?.externalId ?? "");
  if (!blockId) return { status: "failed", request: { method: "POST", url: "vendor://notion/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Notion writeback requires target.blockId, target.pageId, or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_NOTION_API_BASE ?? "https://api.notion.com", `/v1/blocks/${blockId}/children`), notionHeaders(), JSON.stringify({ children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: str(record.payload?.text, "Cognibrain memory update.").slice(0, 1900) } }] } }] }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listLinear(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const query = `query CognibrainIssues($teamId: String!) { issues(first: 20, filter: { team: { id: { eq: $teamId } } }) { nodes { id identifier title url updatedAt state { name } assignee { name } labels { nodes { name } } comments(first: 5) { nodes { id body user { name } updatedAt } } } } }`;
  const request = requestShape("POST", process.env.MEMORY_LINEAR_API_BASE ?? "https://api.linear.app/graphql", linearHeaders(), JSON.stringify({ query, variables: { teamId: process.env.MEMORY_LINEAR_TEAM_ID ?? "" } }));
  const response = await fetchJson<{ data?: { issues?: { nodes?: Array<Record<string, unknown>> } }; errors?: unknown }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && !response.json?.errors;
  return {
    status: ok ? "applied" : "failed",
    items: ok && Array.isArray(response.json?.data?.issues?.nodes) ? response.json.data.issues.nodes.map(linearIssueItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: ok ? undefined : response.error ?? "Linear GraphQL error"
  };
}

async function pollLinear(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listLinear(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.flatMap(linearIssueEvents), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeLinear(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueId = String(record.target?.issueId ?? record.target?.externalId ?? "");
  if (!issueId) return { status: "failed", request: { method: "POST", url: "vendor://linear/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Linear writeback requires target.issueId or target.externalId" };
  const query = "mutation CognibrainComment($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id url } } }";
  const request = requestShape("POST", process.env.MEMORY_LINEAR_API_BASE ?? "https://api.linear.app/graphql", linearHeaders(), JSON.stringify({ query, variables: { issueId, body: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<{ data?: { commentCreate?: { success?: boolean } }; errors?: unknown }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.data?.commentCreate?.success !== false && !response.json?.errors;
  return { status: ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: ok ? undefined : response.error ?? "Linear GraphQL error" };
}

function jiraIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
  const fields = obj(issue.fields);
  const comments = arr(obj(fields.comment).comments).map((comment) => ({
    id: str(obj(comment).id, undefined),
    author: str(obj(obj(comment).author).displayName, undefined),
    updatedAt: str(obj(comment).updated, undefined),
    text: adfText(obj(comment).body)
  }));
  return {
    externalId: str(issue.key, str(issue.id, "")),
    issueId: str(issue.id, undefined),
    title: str(fields.summary, "Untitled Jira issue"),
    status: str(obj(fields.status).name, undefined),
    assignee: str(obj(fields.assignee).displayName, undefined),
    updatedAt: str(fields.updated, undefined),
    labels: arr(fields.labels).filter((item): item is string => typeof item === "string"),
    components: arr(fields.components).map((component) => str(obj(component).name, "")).filter(Boolean),
    parent: str(obj(fields.parent).key, undefined),
    issueType: str(obj(fields.issuetype).name, undefined),
    comments,
    url: jiraBrowseUrl(str(issue.key, undefined))
  };
}

function jiraIssueEvents(item: Record<string, unknown>): Array<MemoryExtractionEvent & { externalId?: string }> {
  const issueKey = str(item.externalId, "");
  const comments = arr(item.comments).map(obj);
  const latestComment = comments.at(-1);
  const latestText = str(latestComment?.text, "");
  const labels = arr(item.labels).filter((label): label is string => typeof label === "string");
  return [{
    role: "tool",
    content: [
      `Jira issue ${issueKey}: ${str(item.title, "Untitled issue")}.`,
      item.status ? `Status ${String(item.status)}.` : "",
      latestText ? `Latest comment: ${latestText}` : ""
    ].filter(Boolean).join(" "),
    externalId: issueKey,
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.9 },
    metadata: {
      vendor: "jira",
      eventType: correctionLike(`${item.title ?? ""} ${latestText}`) ? "issue_correction" : "issue_decision",
      project: process.env.MEMORY_JIRA_PROJECT,
      status: item.status,
      assignee: item.assignee,
      labels,
      components: item.components,
      parent: item.parent,
      issueType: item.issueType,
      author: str(latestComment?.author, undefined),
      visibility: "org"
    }
  }];
}

function confluencePageItem(page: Record<string, unknown>): Record<string, unknown> {
  const version = obj(page.version);
  const body = obj(obj(page.body).storage);
  const labels = arr(obj(obj(page.metadata).labels).results).map((label) => str(obj(label).name, "")).filter(Boolean);
  const links = obj(page._links);
  const webui = str(links.webui, undefined);
  const base = process.env.MEMORY_CONFLUENCE_BASE_URL ?? "";
  return {
    externalId: str(page.id, ""),
    title: str(page.title, "Untitled Confluence page"),
    space: str(obj(page.space).key, process.env.MEMORY_CONFLUENCE_SPACE),
    version: version.number,
    updatedAt: str(version.when, undefined),
    author: str(obj(version.by).displayName, undefined),
    labels,
    text: htmlText(str(body.value, "")),
    url: webui ? `${base.replace(/\/$/, "")}${webui}` : undefined
  };
}

function confluencePageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const text = str(item.text, "");
  return {
    role: "tool",
    content: `Confluence page ${str(item.title, "Untitled page")}: ${text.slice(0, 1200)}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.88 },
    metadata: {
      vendor: "confluence",
      eventType: /runbook/i.test(`${item.title ?? ""} ${text}`) ? "runbook" : "architecture_decision",
      space: item.space,
      version: String(item.version ?? ""),
      labels: item.labels,
      author: item.author,
      visibility: "org"
    }
  };
}

function notionPageItem(page: Record<string, unknown>): Record<string, unknown> {
  const properties = obj(page.properties);
  const title = notionTitle(properties) || str(page.url, "Untitled Notion page");
  return {
    externalId: str(page.id, ""),
    title,
    workspace: process.env.MEMORY_NOTION_WORKSPACE,
    updatedAt: str(page.last_edited_time, undefined),
    author: str(obj(page.last_edited_by).id, undefined),
    url: str(page.url, undefined),
    archived: Boolean(page.archived),
    properties: Object.keys(properties)
  };
}

function notionPageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Notion page ${str(item.title, "Untitled page")} was updated in the connected workspace.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.86 },
    metadata: {
      vendor: "notion",
      eventType: /adr|decision|architecture/i.test(str(item.title, "")) ? "architecture_decision" : "doc_decision",
      workspace: item.workspace,
      archived: item.archived,
      author: item.author,
      visibility: "org"
    }
  };
}

function linearIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
  const comments = arr(obj(issue.comments).nodes).map((comment) => ({
    id: str(obj(comment).id, undefined),
    author: str(obj(obj(comment).user).name, undefined),
    updatedAt: str(obj(comment).updatedAt, undefined),
    text: str(obj(comment).body, "")
  }));
  return {
    externalId: str(issue.id, ""),
    identifier: str(issue.identifier, undefined),
    title: str(issue.title, "Untitled Linear issue"),
    status: str(obj(issue.state).name, undefined),
    assignee: str(obj(issue.assignee).name, undefined),
    labels: arr(obj(issue.labels).nodes).map((label) => str(obj(label).name, "")).filter(Boolean),
    comments,
    updatedAt: str(issue.updatedAt, undefined),
    url: str(issue.url, undefined)
  };
}

function linearIssueEvents(item: Record<string, unknown>): Array<MemoryExtractionEvent & { externalId?: string }> {
  const comments = arr(item.comments).map(obj);
  const latestComment = comments.at(-1);
  const latestText = str(latestComment?.text, "");
  const identifier = str(item.identifier, str(item.externalId, ""));
  return [{
    role: "tool",
    content: [
      `Linear issue ${identifier}: ${str(item.title, "Untitled issue")}.`,
      item.status ? `Status ${String(item.status)}.` : "",
      latestText ? `Latest comment: ${latestText}` : ""
    ].filter(Boolean).join(" "),
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.89 },
    metadata: {
      vendor: "linear",
      eventType: correctionLike(`${item.title ?? ""} ${latestText}`) ? "issue_correction" : "issue_decision",
      identifier,
      status: item.status,
      assignee: item.assignee,
      labels: item.labels,
      author: str(latestComment?.author, undefined),
      visibility: "org"
    }
  }];
}

function githubPullItem(pull: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `pr-${pull.number}`,
    title: pull.title,
    state: pull.state,
    url: pull.html_url,
    author: (pull.user as Record<string, unknown> | undefined)?.login,
    updatedAt: pull.updated_at
  };
}

function githubPullEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const repo = process.env.MEMORY_GITHUB_REPO ?? "";
  return {
    role: "tool",
    content: `GitHub pull request ${item.externalId}: ${str(item.title, "untitled")} in ${repo}.`,
    externalId: String(item.externalId ?? ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.93 },
    metadata: { vendor: "github", eventType: "pr_decision", repo, pullRequest: Number(String(item.externalId ?? "").replace(/^pr-/, "")), author: item.author, state: item.state }
  };
}

function jiraBrowseUrl(issueKey: string | undefined): string | undefined {
  if (!issueKey) return undefined;
  const base = process.env.MEMORY_JIRA_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/browse/${encodeURIComponent(issueKey)}` : undefined;
}

function adfDocument(text: string): Record<string, unknown> {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }]
  };
}

function adfText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfText).filter(Boolean).join(" ");
  const value = node as Record<string, unknown>;
  if (typeof value.text === "string") return value.text;
  return arr(value.content).map(adfText).filter(Boolean).join(" ");
}

function notionTitle(properties: Record<string, unknown>): string {
  for (const value of Object.values(properties)) {
    const property = obj(value);
    const richText = Array.isArray(property.title) ? property.title : Array.isArray(property.rich_text) ? property.rich_text : [];
    const title = richText.map((part) => str(obj(part).plain_text, str(obj(part).text, ""))).join("").trim();
    if (title) return title;
  }
  return "";
}

function correctionLike(text: string): boolean {
  return /\b(correction|do not|don't|dont|never|use .* instead|must not|should not)\b/i.test(text);
}

function htmlText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requestShape(method: "GET" | "POST" | "PUT" | "PATCH", url: string, headers: Record<string, string>, body = ""): NonNullable<ConnectorSyncRecord["request"]> {
  return { method, url, headers, body };
}

function recordRequest(request: NonNullable<ConnectorSyncRecord["request"]>): NonNullable<ConnectorSyncRecord["request"]> {
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower.includes("token") || lower.includes("secret") || lower.includes("key")) return [key, "<redacted>"];
    return [key, value];
  }));
  return { ...request, headers };
}

async function fetchJson<T>(request: NonNullable<ConnectorSyncRecord["request"]>, fetchImpl: FetchLike, timeoutMs: number): Promise<{ ok: boolean; status: number; json?: T; error?: string }> {
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" ? undefined : request.body,
      signal: AbortSignal.timeout(Math.max(1, timeoutMs))
    });
    const json = await response.json().catch(() => undefined) as T | undefined;
    return { ok: response.ok, status: response.status, json, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : "vendor request failed" };
  }
}

function apiUrl(base: string, path: string, query: Record<string, string | undefined> = {}): string {
  const url = new URL(`${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") url.searchParams.set(key, value);
  return url.toString();
}

function discordJumpUrl(message: Record<string, unknown>, channel: string): string | undefined {
  const guildId = message.guild_id ?? "@me";
  const id = message.id;
  return id ? `https://discord.com/channels/${guildId}/${channel}/${id}` : undefined;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback: string | undefined): string {
  return typeof value === "string" && value.length ? value : fallback ?? "";
}
