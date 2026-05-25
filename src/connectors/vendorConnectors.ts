import type { ConnectorManifest, ConnectorSyncRecord, MemoryExtractionEvent } from "../core";

export type ExternalVendorProvider =
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

const providerByConnectorId: Record<string, ExternalVendorProvider> = {
  "official-github": "github",
  "official-slack": "slack",
  "official-discord": "discord",
  "official-jira": "jira",
  "official-confluence": "confluence",
  "official-notion": "notion",
  "official-linear": "linear",
  "official-gitlab": "gitlab",
  "official-azure-devops": "azure-devops",
  "official-microsoft-teams": "teams",
  "official-gmail": "gmail",
  "official-google-drive": "google-drive",
  "official-google-calendar": "google-calendar",
  "official-asana": "asana",
  "official-clickup": "clickup",
  "official-sentry": "sentry",
  "official-datadog": "datadog",
  "official-pagerduty": "pagerduty",
  "official-posthog": "posthog"
};

export function externalVendorProvider(manifest: ConnectorManifest): ExternalVendorProvider | undefined {
  if (manifest.vendor?.provider) return manifest.vendor.provider;
  return providerByConnectorId[manifest.id];
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
  if (provider === "linear") return listLinear(fetchImpl, timeoutMs);
  if (provider === "gitlab") return listGitLab(fetchImpl, timeoutMs);
  if (provider === "azure-devops") return listAzureDevOps(fetchImpl, timeoutMs);
  if (provider === "teams") return listTeams(fetchImpl, timeoutMs);
  if (provider === "gmail") return listGmail(fetchImpl, timeoutMs);
  if (provider === "google-drive") return listGoogleDrive(fetchImpl, timeoutMs);
  if (provider === "google-calendar") return listGoogleCalendar(fetchImpl, timeoutMs);
  if (provider === "asana") return listAsana(fetchImpl, timeoutMs);
  if (provider === "clickup") return listClickUp(fetchImpl, timeoutMs);
  if (provider === "sentry") return listSentry(fetchImpl, timeoutMs);
  if (provider === "datadog") return listDatadog(fetchImpl, timeoutMs);
  if (provider === "pagerduty") return listPagerDuty(fetchImpl, timeoutMs);
  return listPostHog(fetchImpl, timeoutMs);
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
  if (provider === "linear") return pollLinear(fetchImpl, timeoutMs);
  if (provider === "gitlab") return pollGitLab(fetchImpl, timeoutMs);
  if (provider === "azure-devops") return pollAzureDevOps(fetchImpl, timeoutMs);
  if (provider === "teams") return pollTeams(fetchImpl, timeoutMs);
  if (provider === "gmail") return pollGmail(fetchImpl, timeoutMs);
  if (provider === "google-drive") return pollGoogleDrive(fetchImpl, timeoutMs);
  if (provider === "google-calendar") return pollGoogleCalendar(fetchImpl, timeoutMs);
  if (provider === "asana") return pollAsana(fetchImpl, timeoutMs);
  if (provider === "clickup") return pollClickUp(fetchImpl, timeoutMs);
  if (provider === "sentry") return pollSentry(fetchImpl, timeoutMs);
  if (provider === "datadog") return pollDatadog(fetchImpl, timeoutMs);
  if (provider === "pagerduty") return pollPagerDuty(fetchImpl, timeoutMs);
  return pollPostHog(fetchImpl, timeoutMs);
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
  if (provider === "linear") return writeLinear(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "gitlab") return writeGitLab(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "azure-devops") return writeAzureDevOps(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "teams") return writeTeams(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "gmail") return writeGmail(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "google-drive") return writeGoogleDrive(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "google-calendar") return writeGoogleCalendar(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "asana") return writeAsana(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "clickup") return writeClickUp(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "sentry") return writeSentry(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "datadog") return writeDatadog(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "pagerduty") return writePagerDuty(record, fetchImpl, timeoutMs, dryRun);
  return writePostHog(record, fetchImpl, timeoutMs, dryRun);
}

function vendorEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  if (key === "MEMORY_SLACK_TOKEN") return env.MEMORY_SLACK_TOKEN || env.MEMORY_SLACK_BOT_TOKEN;
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return env.MEMORY_DISCORD_BOT_TOKEN || env.MEMORY_DISCORD_TOKEN;
  if (key === "MEMORY_GITHUB_TOKEN") return env.MEMORY_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (key === "MEMORY_JIRA_API_TOKEN") return env.MEMORY_JIRA_API_TOKEN || env.JIRA_API_TOKEN;
  if (key === "MEMORY_CONFLUENCE_API_TOKEN") return env.MEMORY_CONFLUENCE_API_TOKEN || env.CONFLUENCE_API_TOKEN || env.MEMORY_JIRA_API_TOKEN;
  if (key === "MEMORY_NOTION_TOKEN") return env.MEMORY_NOTION_TOKEN || env.NOTION_TOKEN;
  if (key === "MEMORY_LINEAR_API_KEY") return env.MEMORY_LINEAR_API_KEY || env.LINEAR_API_KEY;
  if (key === "MEMORY_GITLAB_TOKEN") return env.MEMORY_GITLAB_TOKEN || env.GITLAB_TOKEN;
  if (key === "MEMORY_AZURE_DEVOPS_TOKEN") return env.MEMORY_AZURE_DEVOPS_TOKEN || env.AZURE_DEVOPS_EXT_PAT;
  if (key === "MEMORY_TEAMS_TOKEN") return env.MEMORY_TEAMS_TOKEN || env.MICROSOFT_GRAPH_TOKEN;
  if (key === "MEMORY_GOOGLE_TOKEN") return env.MEMORY_GOOGLE_TOKEN || env.GOOGLE_OAUTH_TOKEN;
  if (key === "MEMORY_ASANA_TOKEN") return env.MEMORY_ASANA_TOKEN || env.ASANA_ACCESS_TOKEN;
  if (key === "MEMORY_CLICKUP_TOKEN") return env.MEMORY_CLICKUP_TOKEN || env.CLICKUP_API_TOKEN;
  if (key === "MEMORY_SENTRY_TOKEN") return env.MEMORY_SENTRY_TOKEN || env.SENTRY_AUTH_TOKEN;
  if (key === "MEMORY_DATADOG_API_KEY") return env.MEMORY_DATADOG_API_KEY || env.DD_API_KEY || env.DATADOG_API_KEY;
  if (key === "MEMORY_DATADOG_APP_KEY") return env.MEMORY_DATADOG_APP_KEY || env.DD_APP_KEY || env.DATADOG_APP_KEY;
  if (key === "MEMORY_PAGERDUTY_TOKEN") return env.MEMORY_PAGERDUTY_TOKEN || env.PAGERDUTY_TOKEN;
  if (key === "MEMORY_POSTHOG_TOKEN") return env.MEMORY_POSTHOG_TOKEN || env.POSTHOG_PERSONAL_API_KEY;
  return env[key];
}

function requiredVendorEnv(provider: ExternalVendorProvider): string[] {
  if (provider === "github") return ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"];
  if (provider === "slack") return ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"];
  if (provider === "discord") return ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"];
  if (provider === "jira") return ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"];
  if (provider === "confluence") return ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"];
  if (provider === "notion") return ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"];
  if (provider === "linear") return ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"];
  if (provider === "gitlab") return ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"];
  if (provider === "azure-devops") return ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"];
  if (provider === "teams") return ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"];
  if (provider === "gmail") return ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "google-drive") return ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "google-calendar") return ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "asana") return ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"];
  if (provider === "clickup") return ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"];
  if (provider === "sentry") return ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"];
  if (provider === "datadog") return ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"];
  if (provider === "pagerduty") return ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"];
  return ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"];
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

function gitlabHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "private-token": vendorEnv(process.env, "MEMORY_GITLAB_TOKEN") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function azureDevOpsHeaders(): Record<string, string> {
  const token = vendorEnv(process.env, "MEMORY_AZURE_DEVOPS_TOKEN") ?? "";
  return {
    accept: "application/json",
    authorization: `Basic ${Buffer.from(`:${token}`).toString("base64")}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function bearerHeaders(tokenKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, tokenKey) ?? ""}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function clickUpHeaders(): Record<string, string> {
  return {
    authorization: vendorEnv(process.env, "MEMORY_CLICKUP_TOKEN") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

function datadogHeaders(): Record<string, string> {
  return {
    "dd-api-key": vendorEnv(process.env, "MEMORY_DATADOG_API_KEY") ?? "",
    "dd-application-key": vendorEnv(process.env, "MEMORY_DATADOG_APP_KEY") ?? "",
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

async function listGitLab(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const project = encodeURIComponent(process.env.MEMORY_GITLAB_PROJECT ?? "");
  const url = apiUrl(process.env.MEMORY_GITLAB_API_BASE ?? "https://gitlab.com", `/api/v4/projects/${project}/merge_requests`, {
    state: process.env.MEMORY_GITLAB_MR_STATE ?? "opened",
    order_by: "updated_at",
    sort: "desc",
    per_page: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, gitlabHeaders());
  const response = await fetchJson<Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json) ? response.json.map(gitlabMergeRequestItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollGitLab(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGitLab(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(gitlabMergeRequestEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeGitLab(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const project = encodeURIComponent(process.env.MEMORY_GITLAB_PROJECT ?? "");
  const iid = String(record.target?.mergeRequestIid ?? record.target?.mergeRequest ?? record.target?.pullRequest ?? record.target?.externalId ?? "").replace(/^(mr|pr)-/, "");
  const issueIid = String(record.target?.issueIid ?? "").replace(/^issue-/, "");
  const resource = issueIid ? "issues" : "merge_requests";
  const targetIid = issueIid || iid;
  if (!targetIid) return { status: "failed", request: { method: "POST", url: "vendor://gitlab/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "GitLab writeback requires target.mergeRequestIid, target.pullRequest, target.issueIid, or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_GITLAB_API_BASE ?? "https://gitlab.com", `/api/v4/projects/${project}/${resource}/${encodeURIComponent(targetIid)}/notes`), gitlabHeaders(), JSON.stringify({ body: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listAzureDevOps(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const org = process.env.MEMORY_AZURE_DEVOPS_ORG ?? "";
  const project = process.env.MEMORY_AZURE_DEVOPS_PROJECT ?? "";
  const url = apiUrl(process.env.MEMORY_AZURE_DEVOPS_BASE_URL ?? "https://dev.azure.com", `/${org}/${project}/_apis/git/pullrequests`, {
    "searchCriteria.status": process.env.MEMORY_AZURE_DEVOPS_PR_STATUS ?? "active",
    "$top": process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    "api-version": process.env.MEMORY_AZURE_DEVOPS_API_VERSION ?? "7.1"
  });
  const request = requestShape("GET", url, azureDevOpsHeaders());
  const response = await fetchJson<{ value?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.value) ? response.json.value.map(azurePullRequestItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollAzureDevOps(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listAzureDevOps(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(azurePullRequestEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeAzureDevOps(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const org = process.env.MEMORY_AZURE_DEVOPS_ORG ?? "";
  const project = process.env.MEMORY_AZURE_DEVOPS_PROJECT ?? "";
  const repositoryId = String(record.target?.repositoryId ?? process.env.MEMORY_AZURE_DEVOPS_REPOSITORY_ID ?? "");
  const pullRequestId = String(record.target?.pullRequestId ?? record.target?.pullRequest ?? record.target?.externalId ?? "").replace(/^pr-/, "");
  if (!repositoryId || !pullRequestId) return { status: "failed", request: { method: "POST", url: "vendor://azure-devops/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Azure DevOps writeback requires target.repositoryId and target.pullRequestId/pullRequest" };
  const url = apiUrl(process.env.MEMORY_AZURE_DEVOPS_BASE_URL ?? "https://dev.azure.com", `/${org}/${project}/_apis/git/repositories/${encodeURIComponent(repositoryId)}/pullRequests/${encodeURIComponent(pullRequestId)}/threads`, { "api-version": process.env.MEMORY_AZURE_DEVOPS_API_VERSION ?? "7.1" });
  const request = requestShape("POST", url, azureDevOpsHeaders(), JSON.stringify({ comments: [{ parentCommentId: 0, content: str(record.payload?.text, "Cognibrain memory update."), commentType: "text" }], status: "active" }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listTeams(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const teamId = process.env.MEMORY_TEAMS_TEAM_ID ?? process.env.MEMORY_TEAMS_TENANT_ID ?? "";
  const channelId = process.env.MEMORY_TEAMS_CHANNEL_ID ?? "";
  const url = apiUrl(process.env.MEMORY_TEAMS_GRAPH_BASE ?? "https://graph.microsoft.com", `/v1.0/teams/${teamId}/channels/${channelId}/messages`, { "$top": process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20" });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_TEAMS_TOKEN"));
  const response = await fetchJson<{ value?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.value) ? response.json.value.map(teamsMessageItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollTeams(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listTeams(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(teamsMessageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeTeams(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const teamId = process.env.MEMORY_TEAMS_TEAM_ID ?? process.env.MEMORY_TEAMS_TENANT_ID ?? "";
  const channelId = String(record.target?.channel ?? process.env.MEMORY_TEAMS_CHANNEL_ID ?? "");
  const request = requestShape("POST", apiUrl(process.env.MEMORY_TEAMS_GRAPH_BASE ?? "https://graph.microsoft.com", `/v1.0/teams/${teamId}/channels/${channelId}/messages`), bearerHeaders("MEMORY_TEAMS_TOKEN"), JSON.stringify({ body: { contentType: "text", content: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listGmail(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const account = process.env.MEMORY_GMAIL_ACCOUNT ?? "me";
  const url = apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://gmail.googleapis.com", `/gmail/v1/users/${encodeURIComponent(account)}/messages`, {
    maxResults: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    q: process.env.MEMORY_GMAIL_QUERY
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_GOOGLE_TOKEN"));
  const response = await fetchJson<{ messages?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.messages) ? response.json.messages.map(gmailMessageItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollGmail(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGmail(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(gmailMessageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeGmail(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const account = process.env.MEMORY_GMAIL_ACCOUNT ?? "me";
  const messageId = String(record.target?.messageId ?? record.target?.externalId ?? "");
  if (!messageId) return { status: "failed", request: { method: "POST", url: "vendor://gmail/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Gmail writeback requires target.messageId or target.externalId" };
  const labelIds = arr(record.target?.labelIds).filter((item): item is string => typeof item === "string");
  const request = requestShape("POST", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://gmail.googleapis.com", `/gmail/v1/users/${encodeURIComponent(account)}/messages/${encodeURIComponent(messageId)}/modify`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ addLabelIds: labelIds.length ? labelIds : ["IMPORTANT"] }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listGoogleDrive(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const root = process.env.MEMORY_GOOGLE_DRIVE_ROOT ?? "root";
  const query = root === "root" ? "'root' in parents" : `'${root.replace(/'/g, "\\'")}' in parents`;
  const url = apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", "/drive/v3/files", {
    q: process.env.MEMORY_GOOGLE_DRIVE_QUERY ?? query,
    pageSize: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    fields: "files(id,name,mimeType,webViewLink,modifiedTime,owners(displayName,emailAddress),description)"
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_GOOGLE_TOKEN"));
  const response = await fetchJson<{ files?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.files) ? response.json.files.map(googleDriveFileItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollGoogleDrive(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGoogleDrive(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(googleDriveFileEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeGoogleDrive(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const fileId = String(record.target?.fileId ?? record.target?.externalId ?? "");
  if (!fileId) return { status: "failed", request: { method: "PATCH", url: "vendor://google-drive/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Google Drive writeback requires target.fileId or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", `/drive/v3/files/${encodeURIComponent(fileId)}`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listGoogleCalendar(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const calendarId = process.env.MEMORY_GOOGLE_CALENDAR_ID ?? "primary";
  const url = apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    maxResults: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: process.env.MEMORY_GOOGLE_CALENDAR_TIME_MIN ?? new Date(Date.now() - 7 * 86_400_000).toISOString()
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_GOOGLE_TOKEN"));
  const response = await fetchJson<{ items?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.items) ? response.json.items.map(googleCalendarEventItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollGoogleCalendar(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGoogleCalendar(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(googleCalendarEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeGoogleCalendar(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const calendarId = process.env.MEMORY_GOOGLE_CALENDAR_ID ?? "primary";
  const eventId = String(record.target?.eventId ?? record.target?.externalId ?? "");
  if (!eventId) return { status: "failed", request: { method: "PATCH", url: "vendor://google-calendar/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Google Calendar writeback requires target.eventId or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listAsana(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const workspace = process.env.MEMORY_ASANA_WORKSPACE ?? "";
  const project = process.env.MEMORY_ASANA_PROJECT;
  const url = apiUrl(process.env.MEMORY_ASANA_API_BASE ?? "https://app.asana.com", "/api/1.0/tasks", {
    workspace,
    project,
    assignee: project ? undefined : process.env.MEMORY_ASANA_ASSIGNEE ?? "me",
    limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20",
    opt_fields: "gid,name,completed,permalink_url,assignee.name,modified_at,notes,memberships.project.name"
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_ASANA_TOKEN"));
  const response = await fetchJson<{ data?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.data) ? response.json.data.map(asanaTaskItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollAsana(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listAsana(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(asanaTaskEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeAsana(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const taskId = String(record.target?.taskId ?? record.target?.externalId ?? "");
  if (!taskId) return { status: "failed", request: { method: "POST", url: "vendor://asana/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Asana writeback requires target.taskId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_ASANA_API_BASE ?? "https://app.asana.com", `/api/1.0/tasks/${encodeURIComponent(taskId)}/stories`), bearerHeaders("MEMORY_ASANA_TOKEN"), JSON.stringify({ data: { text: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listClickUp(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const listId = process.env.MEMORY_CLICKUP_LIST_ID ?? process.env.MEMORY_CLICKUP_SPACE_ID ?? "";
  const url = apiUrl(process.env.MEMORY_CLICKUP_API_BASE ?? "https://api.clickup.com", `/api/v2/list/${encodeURIComponent(listId)}/task`, {
    page: "0",
    order_by: "updated",
    reverse: "true",
    include_closed: process.env.MEMORY_CLICKUP_INCLUDE_CLOSED ?? "false"
  });
  const request = requestShape("GET", url, clickUpHeaders());
  const response = await fetchJson<{ tasks?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.tasks) ? response.json.tasks.map(clickUpTaskItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollClickUp(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listClickUp(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(clickUpTaskEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeClickUp(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const taskId = String(record.target?.taskId ?? record.target?.externalId ?? "");
  if (!taskId) return { status: "failed", request: { method: "POST", url: "vendor://clickup/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "ClickUp writeback requires target.taskId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_CLICKUP_API_BASE ?? "https://api.clickup.com", `/api/v2/task/${encodeURIComponent(taskId)}/comment`), clickUpHeaders(), JSON.stringify({ comment_text: str(record.payload?.text, "Cognibrain memory update."), notify_all: false }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listSentry(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const org = process.env.MEMORY_SENTRY_ORG ?? "";
  const project = process.env.MEMORY_SENTRY_PROJECT ?? "";
  const url = apiUrl(process.env.MEMORY_SENTRY_API_BASE ?? "https://sentry.io", `/api/0/projects/${org}/${project}/issues/`, {
    query: process.env.MEMORY_SENTRY_QUERY,
    limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_SENTRY_TOKEN"));
  const response = await fetchJson<Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json) ? response.json.map(sentryIssueItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollSentry(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listSentry(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(sentryIssueEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeSentry(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueId = String(record.target?.issueId ?? record.target?.externalId ?? "");
  if (!issueId) return { status: "failed", request: { method: "POST", url: "vendor://sentry/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Sentry writeback requires target.issueId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_SENTRY_API_BASE ?? "https://sentry.io", `/api/0/issues/${encodeURIComponent(issueId)}/comments/`), bearerHeaders("MEMORY_SENTRY_TOKEN"), JSON.stringify({ text: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listDatadog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const base = datadogBaseUrl();
  const request = requestShape("GET", apiUrl(base, "/api/v1/monitor", { group_states: "all", page_size: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20" }), datadogHeaders());
  const response = await fetchJson<Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json) ? response.json.map(datadogMonitorItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollDatadog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listDatadog(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(datadogMonitorEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writeDatadog(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const request = requestShape("POST", apiUrl(datadogBaseUrl(), "/api/v1/events"), datadogHeaders(), JSON.stringify({
    title: str(record.payload?.title, "Cognibrain memory update"),
    text: str(record.payload?.text, "Cognibrain memory update."),
    tags: ["source:cognibrain", "memory:true", ...(arr(record.target?.tags).filter((item): item is string => typeof item === "string"))]
  }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listPagerDuty(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const serviceId = process.env.MEMORY_PAGERDUTY_SERVICE_ID;
  const url = apiUrl(process.env.MEMORY_PAGERDUTY_API_BASE ?? "https://api.pagerduty.com", "/incidents", {
    "service_ids[]": serviceId,
    limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, bearerHeaders("MEMORY_PAGERDUTY_TOKEN"));
  const response = await fetchJson<{ incidents?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.incidents) ? response.json.incidents.map(pagerDutyIncidentItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollPagerDuty(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listPagerDuty(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(pagerDutyIncidentEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writePagerDuty(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const incidentId = String(record.target?.incidentId ?? record.target?.externalId ?? "");
  if (!incidentId) return { status: "failed", request: { method: "POST", url: "vendor://pagerduty/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "PagerDuty writeback requires target.incidentId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_PAGERDUTY_API_BASE ?? "https://api.pagerduty.com", `/incidents/${encodeURIComponent(incidentId)}/notes`), bearerHeaders("MEMORY_PAGERDUTY_TOKEN"), JSON.stringify({ note: { content: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

async function listPostHog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const project = process.env.MEMORY_POSTHOG_PROJECT ?? "";
  const request = requestShape("GET", apiUrl(process.env.MEMORY_POSTHOG_BASE_URL ?? "https://app.posthog.com", `/api/projects/${encodeURIComponent(project)}/feature_flags/`, { limit: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20" }), bearerHeaders("MEMORY_POSTHOG_TOKEN"));
  const response = await fetchJson<{ results?: Array<Record<string, unknown>> }>(request, fetchImpl, timeoutMs);
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok && Array.isArray(response.json?.results) ? response.json.results.map(postHogFlagItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

async function pollPostHog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listPostHog(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(postHogFlagEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

async function writePostHog(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const project = process.env.MEMORY_POSTHOG_PROJECT ?? "";
  const flagId = String(record.target?.flagId ?? record.target?.featureFlag ?? record.target?.externalId ?? "");
  if (!flagId) return { status: "failed", request: { method: "PATCH", url: "vendor://posthog/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "PostHog writeback requires target.flagId, target.featureFlag, or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_POSTHOG_BASE_URL ?? "https://app.posthog.com", `/api/projects/${encodeURIComponent(project)}/feature_flags/${encodeURIComponent(flagId)}/`), bearerHeaders("MEMORY_POSTHOG_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

function gitlabMergeRequestItem(mergeRequest: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `mr-${mergeRequest.iid ?? mergeRequest.id ?? ""}`,
    iid: mergeRequest.iid,
    title: str(mergeRequest.title, "Untitled GitLab merge request"),
    state: str(mergeRequest.state, undefined),
    url: str(mergeRequest.web_url, undefined),
    author: str(obj(mergeRequest.author).username, str(obj(mergeRequest.author).name, undefined)),
    updatedAt: str(mergeRequest.updated_at, undefined),
    labels: arr(mergeRequest.labels).filter((item): item is string => typeof item === "string")
  };
}

function gitlabMergeRequestEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const project = process.env.MEMORY_GITLAB_PROJECT ?? "";
  return {
    role: "tool",
    content: `GitLab merge request ${str(item.externalId, "")}: ${str(item.title, "untitled")} in ${project}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.91 },
    metadata: { vendor: "gitlab", eventType: "pr_decision", project, mergeRequest: item.iid, author: item.author, labels: item.labels, state: item.state }
  };
}

function azurePullRequestItem(pull: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `pr-${pull.pullRequestId ?? pull.codeReviewId ?? ""}`,
    pullRequestId: pull.pullRequestId,
    repositoryId: str(obj(pull.repository).id, undefined),
    title: str(pull.title, "Untitled Azure DevOps pull request"),
    status: str(pull.status, undefined),
    url: str(pull.url, str(pull.remoteUrl, undefined)),
    author: str(obj(pull.createdBy).displayName, str(obj(pull.createdBy).uniqueName, undefined)),
    updatedAt: str(pull.creationDate, undefined)
  };
}

function azurePullRequestEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Azure DevOps pull request ${str(item.externalId, "")}: ${str(item.title, "untitled")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.89 },
    metadata: { vendor: "azure-devops", eventType: "pr_decision", organization: process.env.MEMORY_AZURE_DEVOPS_ORG, project: process.env.MEMORY_AZURE_DEVOPS_PROJECT, pullRequest: item.pullRequestId, repositoryId: item.repositoryId, author: item.author, status: item.status }
  };
}

function teamsMessageItem(message: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(message.id, ""),
    channel: process.env.MEMORY_TEAMS_CHANNEL_ID,
    team: process.env.MEMORY_TEAMS_TEAM_ID ?? process.env.MEMORY_TEAMS_TENANT_ID,
    text: htmlText(str(obj(message.body).content, str(message.summary, ""))),
    author: str(obj(obj(message.from).user).displayName, str(obj(obj(message.from).application).displayName, undefined)),
    createdAt: str(message.createdDateTime, undefined),
    url: str(message.webUrl, undefined)
  };
}

function teamsMessageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "user",
    content: `Microsoft Teams message in ${str(item.channel, "")}: ${str(item.text, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.createdAt, undefined),
    source: { kind: "transcript", confidence: 0.86 },
    metadata: { vendor: "teams", eventType: "thread_decision", team: item.team, channel: item.channel, author: item.author, reviewRequired: true, visibility: "org" }
  };
}

function gmailMessageItem(message: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(message.id, ""),
    threadId: str(message.threadId, undefined),
    account: process.env.MEMORY_GMAIL_ACCOUNT ?? "me",
    title: str(message.subject, `Gmail message ${message.id ?? ""}`),
    updatedAt: str(message.internalDate, undefined)
  };
}

function gmailMessageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "user",
    content: `Gmail message ${str(item.externalId, "")} in ${str(item.account, "me")} is ready for memory review.`,
    externalId: str(item.externalId, ""),
    source: { kind: "human", confidence: 0.78 },
    metadata: { vendor: "gmail", eventType: "email_decision", account: item.account, threadId: item.threadId, visibility: "private", reviewRequired: true }
  };
}

function googleDriveFileItem(file: Record<string, unknown>): Record<string, unknown> {
  const owner = arr(file.owners).map(obj)[0];
  return {
    externalId: str(file.id, ""),
    title: str(file.name, "Untitled Drive file"),
    mimeType: str(file.mimeType, undefined),
    url: str(file.webViewLink, undefined),
    updatedAt: str(file.modifiedTime, undefined),
    author: str(owner.displayName, str(owner.emailAddress, undefined)),
    description: str(file.description, "")
  };
}

function googleDriveFileEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Google Drive file ${str(item.title, "Untitled file")}: ${str(item.description, "metadata changed").slice(0, 1000)}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.84 },
    metadata: { vendor: "google-drive", eventType: /runbook|adr|decision/i.test(`${item.title ?? ""} ${item.description ?? ""}`) ? "architecture_decision" : "doc_decision", mimeType: item.mimeType, author: item.author, visibility: "org" }
  };
}

function googleCalendarEventItem(event: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(event.id, ""),
    title: str(event.summary, "Untitled calendar event"),
    description: str(event.description, ""),
    url: str(event.htmlLink, undefined),
    start: str(obj(event.start).dateTime, str(obj(event.start).date, undefined)),
    updatedAt: str(event.updated, undefined),
    organizer: str(obj(event.organizer).email, undefined)
  };
}

function googleCalendarEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Google Calendar event ${str(item.title, "Untitled event")}: ${str(item.description, "no description").slice(0, 1000)}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.start, str(item.updatedAt, undefined)),
    source: { kind: "human", confidence: 0.82 },
    metadata: { vendor: "google-calendar", eventType: /incident|postmortem|decision|architecture/i.test(`${item.title ?? ""} ${item.description ?? ""}`) ? "architecture_decision" : "calendar_decision", calendarId: process.env.MEMORY_GOOGLE_CALENDAR_ID, organizer: item.organizer, visibility: "org" }
  };
}

function asanaTaskItem(task: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(task.gid, ""),
    title: str(task.name, "Untitled Asana task"),
    completed: Boolean(task.completed),
    url: str(task.permalink_url, undefined),
    assignee: str(obj(task.assignee).name, undefined),
    updatedAt: str(task.modified_at, undefined),
    notes: str(task.notes, ""),
    project: str(obj(arr(task.memberships).map(obj)[0]?.project).name, process.env.MEMORY_ASANA_PROJECT)
  };
}

function asanaTaskEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const text = `${item.title ?? ""} ${item.notes ?? ""}`;
  return {
    role: "tool",
    content: `Asana task ${str(item.title, "Untitled task")}: ${str(item.notes, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.87 },
    metadata: { vendor: "asana", eventType: correctionLike(text) ? "issue_correction" : "issue_decision", workspace: process.env.MEMORY_ASANA_WORKSPACE, project: item.project, completed: item.completed, assignee: item.assignee, visibility: "org" }
  };
}

function clickUpTaskItem(task: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(task.id, ""),
    title: str(task.name, "Untitled ClickUp task"),
    status: str(obj(task.status).status, undefined),
    url: str(task.url, undefined),
    assignee: arr(task.assignees).map(obj).map((assignee) => str(assignee.username, str(assignee.email, ""))).filter(Boolean).join(", "),
    updatedAt: str(task.date_updated, undefined),
    text: str(task.markdown_description, str(task.description, ""))
  };
}

function clickUpTaskEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const text = `${item.title ?? ""} ${item.text ?? ""}`;
  return {
    role: "tool",
    content: `ClickUp task ${str(item.title, "Untitled task")}: ${str(item.text, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.86 },
    metadata: { vendor: "clickup", eventType: correctionLike(text) ? "issue_correction" : "issue_decision", workspace: process.env.MEMORY_CLICKUP_WORKSPACE_ID, list: process.env.MEMORY_CLICKUP_LIST_ID ?? process.env.MEMORY_CLICKUP_SPACE_ID, status: item.status, assignee: item.assignee, visibility: "org" }
  };
}

function sentryIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(issue.id, ""),
    title: str(issue.title, str(issue.culprit, "Untitled Sentry issue")),
    status: str(issue.status, undefined),
    level: str(issue.level, undefined),
    url: str(issue.permalink, undefined),
    updatedAt: str(issue.lastSeen, str(issue.firstSeen, undefined)),
    count: issue.count,
    userCount: issue.userCount
  };
}

function sentryIssueEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Sentry issue ${str(item.title, "Untitled issue")} is ${str(item.status, "active")} with level ${str(item.level, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.87 },
    metadata: { vendor: "sentry", eventType: "test_failure", organization: process.env.MEMORY_SENTRY_ORG, project: process.env.MEMORY_SENTRY_PROJECT, status: item.status, level: item.level, count: item.count, userCount: item.userCount, visibility: "org" }
  };
}

function datadogBaseUrl(): string {
  const site = process.env.MEMORY_DATADOG_SITE ?? "datadoghq.com";
  return /^https?:\/\//i.test(site) ? site : `https://api.${site}`;
}

function datadogMonitorItem(monitor: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: monitor.id === undefined ? "" : String(monitor.id),
    title: str(monitor.name, "Untitled Datadog monitor"),
    status: str(monitor.overall_state, undefined),
    type: str(monitor.type, undefined),
    query: str(monitor.query, undefined),
    url: str(monitor.url, undefined),
    tags: arr(monitor.tags).filter((item): item is string => typeof item === "string")
  };
}

function datadogMonitorEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Datadog monitor ${str(item.title, "Untitled monitor")} is ${str(item.status, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    source: { kind: "import", confidence: 0.85 },
    metadata: { vendor: "datadog", eventType: "incident_metric", site: process.env.MEMORY_DATADOG_SITE, status: item.status, monitorType: item.type, tags: item.tags, visibility: "org" }
  };
}

function pagerDutyIncidentItem(incident: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(incident.id, ""),
    title: str(incident.title, str(incident.summary, "Untitled PagerDuty incident")),
    status: str(incident.status, undefined),
    urgency: str(incident.urgency, undefined),
    url: str(incident.html_url, undefined),
    service: str(obj(incident.service).summary, undefined),
    updatedAt: str(incident.updated_at, undefined)
  };
}

function pagerDutyIncidentEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `PagerDuty incident ${str(item.title, "Untitled incident")} is ${str(item.status, "active")} with urgency ${str(item.urgency, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.87 },
    metadata: { vendor: "pagerduty", eventType: "incident_correction", account: process.env.MEMORY_PAGERDUTY_ACCOUNT, service: item.service, status: item.status, urgency: item.urgency, visibility: "org" }
  };
}

function postHogFlagItem(flag: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(flag.id, str(flag.key, "")),
    key: str(flag.key, undefined),
    title: str(flag.name, str(flag.key, "Untitled PostHog flag")),
    active: Boolean(flag.active),
    rollout: flag.filters,
    updatedAt: str(flag.updated_at, str(flag.created_at, undefined)),
    createdBy: str(obj(flag.created_by).email, str(obj(flag.created_by).first_name, undefined))
  };
}

function postHogFlagEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `PostHog feature flag ${str(item.key, str(item.title, "Untitled flag"))} is ${item.active ? "active" : "inactive"}.`,
    externalId: str(item.externalId, ""),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.84 },
    metadata: { vendor: "posthog", eventType: "feature_flag_decision", project: process.env.MEMORY_POSTHOG_PROJECT, key: item.key, active: item.active, author: item.createdBy, visibility: "org" }
  };
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
