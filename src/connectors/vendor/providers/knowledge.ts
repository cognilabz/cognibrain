import type { ConnectorSyncRecord, MemoryExtractionEvent } from "../../../core";
import type { ExternalVendorListResult, ExternalVendorPollResult, ExternalVendorWritebackResult, FetchLike } from "../../vendorConfig";
import {
  apiUrl, atlassianHeaders, azureDevOpsHeaders, bearerHeaders, clickUpHeaders, datadogHeaders, discordHeaders, discordJumpUrl, fetchJson, fetchPagedJson, githubHeaders, githubRepo, gitlabHeaders, linearHeaders, nextLink, notionHeaders, recordRequest, requestShape, slackHeaders
} from "../http";
import {
  adfDocument, asanaTaskEvent, asanaTaskItem, azurePullRequestEvent, azurePullRequestItem, clickUpTaskEvent, clickUpTaskItem, confluencePageEvent, confluencePageItem, datadogBaseUrl, datadogMonitorEvent, datadogMonitorItem, escapeHtml, githubPullEvent, githubPullItem, gitlabMergeRequestEvent, gitlabMergeRequestItem, gmailMessageEvent, gmailMessageItem, googleCalendarEvent, googleCalendarEventItem, googleDriveFileEvent, googleDriveFileItem, jiraIssueEvents, jiraIssueItem, linearIssueEvents, linearIssueItem, notionPageEvent, notionPageItem, pagerDutyIncidentEvent, pagerDutyIncidentItem, postHogFlagEvent, postHogFlagItem, sentryIssueEvent, sentryIssueItem, teamsMessageEvent, teamsMessageItem
} from "../transforms";
import { arr, obj, str } from "../http";

export async function listJira(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollJira(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listJira(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.flatMap(jiraIssueEvents), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeJira(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueKey = String(record.target?.issueKey ?? record.target?.externalId ?? "");
  if (!issueKey) return { status: "failed", request: { method: "POST", url: "vendor://jira/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Jira writeback requires target.issueKey or target.externalId" };
  const url = apiUrl(process.env.MEMORY_JIRA_BASE_URL ?? "https://example.atlassian.net", `/rest/api/3/issue/${issueKey}/comment`);
  const request = requestShape("POST", url, atlassianHeaders("jira"), JSON.stringify({ body: adfDocument(str(record.payload?.text, "Cognibrain memory update.")) }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listConfluence(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollConfluence(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listConfluence(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(confluencePageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeConfluence(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const pageId = String(record.target?.pageId ?? record.target?.externalId ?? "");
  if (!pageId) return { status: "failed", request: { method: "POST", url: "vendor://confluence/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Confluence writeback requires target.pageId or target.externalId" };
  const url = apiUrl(process.env.MEMORY_CONFLUENCE_BASE_URL ?? "https://example.atlassian.net", `/wiki/rest/api/content/${pageId}/child/comment`);
  const request = requestShape("POST", url, atlassianHeaders("confluence"), JSON.stringify({ type: "comment", container: { id: pageId, type: "page" }, body: { storage: { value: `<p>${escapeHtml(str(record.payload?.text, "Cognibrain memory update."))}</p>`, representation: "storage" } } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listNotion(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollNotion(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listNotion(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(notionPageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeNotion(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const blockId = String(record.target?.blockId ?? record.target?.pageId ?? record.target?.externalId ?? "");
  if (!blockId) return { status: "failed", request: { method: "POST", url: "vendor://notion/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Notion writeback requires target.blockId, target.pageId, or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_NOTION_API_BASE ?? "https://api.notion.com", `/v1/blocks/${blockId}/children`), notionHeaders(), JSON.stringify({ children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: str(record.payload?.text, "Cognibrain memory update.").slice(0, 1900) } }] } }] }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listLinear(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollLinear(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listLinear(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.flatMap(linearIssueEvents), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeLinear(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueId = String(record.target?.issueId ?? record.target?.externalId ?? "");
  if (!issueId) return { status: "failed", request: { method: "POST", url: "vendor://linear/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Linear writeback requires target.issueId or target.externalId" };
  const query = "mutation CognibrainComment($issueId: String!, $body: String!) { commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id url } } }";
  const request = requestShape("POST", process.env.MEMORY_LINEAR_API_BASE ?? "https://api.linear.app/graphql", linearHeaders(), JSON.stringify({ query, variables: { issueId, body: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<{ data?: { commentCreate?: { success?: boolean } }; errors?: unknown }>(request, fetchImpl, timeoutMs);
  const ok = response.ok && response.json?.data?.commentCreate?.success !== false && !response.json?.errors;
  return { status: ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: ok ? undefined : response.error ?? "Linear GraphQL error" };
}
