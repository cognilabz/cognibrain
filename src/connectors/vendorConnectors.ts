import type { ConnectorManifest, ConnectorSyncRecord, MemoryExtractionEvent } from "../core";

export type ExternalVendorProvider = "github" | "slack" | "discord";

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
  return undefined;
}

export function shouldUseExternalVendor(manifest: ConnectorManifest, endpoint?: string): boolean {
  return Boolean(endpoint?.startsWith("vendor://") || manifest.vendor?.provider);
}

export function externalVendorConfigured(provider: ExternalVendorProvider, env: NodeJS.ProcessEnv = process.env): { configured: boolean; missing: string[] } {
  const required = provider === "github"
    ? ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"]
    : provider === "slack"
      ? ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"]
      : ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"];
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
  return listDiscord(fetchImpl, timeoutMs);
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
  return pollDiscord(fetchImpl, timeoutMs);
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
  return writeDiscord(record, fetchImpl, timeoutMs, dryRun);
}

function vendorEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  if (key === "MEMORY_SLACK_TOKEN") return env.MEMORY_SLACK_TOKEN || env.MEMORY_SLACK_BOT_TOKEN;
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return env.MEMORY_DISCORD_BOT_TOKEN || env.MEMORY_DISCORD_TOKEN;
  if (key === "MEMORY_GITHUB_TOKEN") return env.MEMORY_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  return env[key];
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

function str(value: unknown, fallback: string | undefined): string {
  return typeof value === "string" && value.length ? value : fallback ?? "";
}
