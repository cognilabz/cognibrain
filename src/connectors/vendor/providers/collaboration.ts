import type { ConnectorSyncRecord, MemoryExtractionEvent } from "../../../core";
import type { ExternalVendorListResult, ExternalVendorPollResult, ExternalVendorWritebackResult, FetchLike } from "../../vendorConfig";
import {
  apiUrl, atlassianHeaders, azureDevOpsHeaders, bearerHeaders, clickUpHeaders, datadogHeaders, discordHeaders, discordJumpUrl, fetchJson, fetchPagedJson, githubHeaders, githubRepo, gitlabHeaders, linearHeaders, nextLink, notionHeaders, recordRequest, requestShape, slackHeaders
} from "../http";
import {
  adfDocument, asanaTaskEvent, asanaTaskItem, azurePullRequestEvent, azurePullRequestItem, clickUpTaskEvent, clickUpTaskItem, confluencePageEvent, confluencePageItem, datadogBaseUrl, datadogMonitorEvent, datadogMonitorItem, escapeHtml, githubPullEvent, githubPullItem, gitlabMergeRequestEvent, gitlabMergeRequestItem, gmailMessageEvent, gmailMessageItem, googleCalendarEvent, googleCalendarEventItem, googleDriveFileEvent, googleDriveFileItem, jiraIssueEvents, jiraIssueItem, linearIssueEvents, linearIssueItem, notionPageEvent, notionPageItem, pagerDutyIncidentEvent, pagerDutyIncidentItem, postHogFlagEvent, postHogFlagItem, sentryIssueEvent, sentryIssueItem, teamsMessageEvent, teamsMessageItem
} from "../transforms";
import { arr, obj, str } from "../http";

export async function listGitHub(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const { owner, repo } = githubRepo();
  const url = apiUrl(process.env.MEMORY_GITHUB_API_BASE ?? "https://api.github.com", `/repos/${owner}/${repo}/pulls`, {
    state: process.env.MEMORY_GITHUB_PULL_STATE ?? "open",
    per_page: process.env.MEMORY_VENDOR_PAGE_SIZE ?? "20"
  });
  const request = requestShape("GET", url, githubHeaders());
  const response = await fetchPagedJson<Record<string, unknown>, Array<Record<string, unknown>>>(request, fetchImpl, timeoutMs, {
    items: (json) => Array.isArray(json) ? json : [],
    nextPage: (result) => nextLink(result.headers)
  });
  return {
    status: response.ok ? "applied" : "failed",
    items: response.ok ? response.items.map(githubPullItem) : [],
    request: recordRequest(request),
    responseStatusCode: response.status,
    error: response.ok ? undefined : response.error
  };
}

export async function pollGitHub(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGitHub(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  const pulls = list.items.map(githubPullEvent);
  const actions = await githubFailedWorkflowEvents(fetchImpl, timeoutMs).catch(() => []);
  return { status: "applied", events: [...pulls, ...actions], request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function githubFailedWorkflowEvents(fetchImpl: FetchLike, timeoutMs: number): Promise<Array<MemoryExtractionEvent & { externalId?: string }>> {
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

export async function writeGitHub(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
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

export async function listSlack(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollSlack(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
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

export async function writeSlack(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const channel = str(record.target?.channel, process.env.MEMORY_SLACK_CHANNEL_ID ?? "");
  const body = JSON.stringify({ channel, text: str(record.payload?.text, "Cognibrain memory update."), thread_ts: record.target?.threadId });
  const request = requestShape("POST", apiUrl(process.env.MEMORY_SLACK_API_BASE ?? "https://slack.com/api", "/chat.postMessage"), slackHeaders(), body);
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<{ ok?: boolean; error?: string }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.ok !== false;
  return { status: ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: ok ? undefined : response.json?.error ?? response.error };
}

export async function listDiscord(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
  const poll = await pollDiscord(fetchImpl, timeoutMs);
  return { status: poll.status, items: poll.events.map((event) => ({ externalId: event.externalId, title: event.content, channel: event.metadata?.channel })), request: poll.request, responseStatusCode: poll.responseStatusCode, error: poll.error };
}

export async function pollDiscord(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
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

export async function writeDiscord(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const channel = str(record.target?.channel, process.env.MEMORY_DISCORD_CHANNEL_ID ?? "");
  const body = JSON.stringify({ content: str(record.payload?.text, "Cognibrain memory update.").slice(0, 2000), allowed_mentions: { parse: [] } });
  const request = requestShape("POST", apiUrl(process.env.MEMORY_DISCORD_API_BASE ?? "https://discord.com/api/v10", `/channels/${channel}/messages`), discordHeaders(), body);
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}
