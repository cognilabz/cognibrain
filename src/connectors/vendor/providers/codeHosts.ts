import type { ConnectorSyncRecord, MemoryExtractionEvent } from "../../../core";
import type { ExternalVendorListResult, ExternalVendorPollResult, ExternalVendorWritebackResult, FetchLike } from "../../vendorConfig";
import {
  apiUrl, atlassianHeaders, azureDevOpsHeaders, bearerHeaders, clickUpHeaders, datadogHeaders, discordHeaders, discordJumpUrl, fetchJson, fetchPagedJson, githubHeaders, githubRepo, gitlabHeaders, linearHeaders, nextLink, notionHeaders, recordRequest, requestShape, slackHeaders
} from "../http";
import {
  adfDocument, asanaTaskEvent, asanaTaskItem, azurePullRequestEvent, azurePullRequestItem, clickUpTaskEvent, clickUpTaskItem, confluencePageEvent, confluencePageItem, datadogBaseUrl, datadogMonitorEvent, datadogMonitorItem, escapeHtml, githubPullEvent, githubPullItem, gitlabMergeRequestEvent, gitlabMergeRequestItem, gmailMessageEvent, gmailMessageItem, googleCalendarEvent, googleCalendarEventItem, googleDriveFileEvent, googleDriveFileItem, jiraIssueEvents, jiraIssueItem, linearIssueEvents, linearIssueItem, notionPageEvent, notionPageItem, pagerDutyIncidentEvent, pagerDutyIncidentItem, postHogFlagEvent, postHogFlagItem, sentryIssueEvent, sentryIssueItem, teamsMessageEvent, teamsMessageItem
} from "../transforms";
import { arr, obj, str } from "../http";

export async function listGitLab(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollGitLab(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGitLab(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(gitlabMergeRequestEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeGitLab(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
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

export async function listAzureDevOps(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollAzureDevOps(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listAzureDevOps(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(azurePullRequestEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeAzureDevOps(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
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

export async function listTeams(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollTeams(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listTeams(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(teamsMessageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeTeams(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const teamId = process.env.MEMORY_TEAMS_TEAM_ID ?? process.env.MEMORY_TEAMS_TENANT_ID ?? "";
  const channelId = String(record.target?.channel ?? process.env.MEMORY_TEAMS_CHANNEL_ID ?? "");
  const request = requestShape("POST", apiUrl(process.env.MEMORY_TEAMS_GRAPH_BASE ?? "https://graph.microsoft.com", `/v1.0/teams/${teamId}/channels/${channelId}/messages`), bearerHeaders("MEMORY_TEAMS_TOKEN"), JSON.stringify({ body: { contentType: "text", content: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}
