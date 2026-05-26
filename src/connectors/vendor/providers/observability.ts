import type { ConnectorSyncRecord, MemoryExtractionEvent } from "../../../core";
import type { ExternalVendorListResult, ExternalVendorPollResult, ExternalVendorWritebackResult, FetchLike } from "../../vendorConfig";
import {
  apiUrl, atlassianHeaders, azureDevOpsHeaders, bearerHeaders, clickUpHeaders, datadogHeaders, discordHeaders, discordJumpUrl, fetchJson, fetchPagedJson, githubHeaders, githubRepo, gitlabHeaders, linearHeaders, nextLink, notionHeaders, recordRequest, requestShape, slackHeaders
} from "../http";
import {
  adfDocument, asanaTaskEvent, asanaTaskItem, azurePullRequestEvent, azurePullRequestItem, clickUpTaskEvent, clickUpTaskItem, confluencePageEvent, confluencePageItem, datadogBaseUrl, datadogMonitorEvent, datadogMonitorItem, escapeHtml, githubPullEvent, githubPullItem, gitlabMergeRequestEvent, gitlabMergeRequestItem, gmailMessageEvent, gmailMessageItem, googleCalendarEvent, googleCalendarEventItem, googleDriveFileEvent, googleDriveFileItem, jiraIssueEvents, jiraIssueItem, linearIssueEvents, linearIssueItem, notionPageEvent, notionPageItem, pagerDutyIncidentEvent, pagerDutyIncidentItem, postHogFlagEvent, postHogFlagItem, sentryIssueEvent, sentryIssueItem, teamsMessageEvent, teamsMessageItem
} from "../transforms";
import { arr, obj, str } from "../http";

export async function listSentry(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollSentry(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listSentry(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(sentryIssueEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeSentry(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const issueId = String(record.target?.issueId ?? record.target?.externalId ?? "");
  if (!issueId) return { status: "failed", request: { method: "POST", url: "vendor://sentry/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Sentry writeback requires target.issueId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_SENTRY_API_BASE ?? "https://sentry.io", `/api/0/issues/${encodeURIComponent(issueId)}/comments/`), bearerHeaders("MEMORY_SENTRY_TOKEN"), JSON.stringify({ text: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listDatadog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollDatadog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listDatadog(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(datadogMonitorEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeDatadog(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const request = requestShape("POST", apiUrl(datadogBaseUrl(), "/api/v1/events"), datadogHeaders(), JSON.stringify({
    title: str(record.payload?.title, "Cognibrain memory update"),
    text: str(record.payload?.text, "Cognibrain memory update."),
    tags: ["source:cognibrain", "memory:true", ...(arr(record.target?.tags).filter((item): item is string => typeof item === "string"))]
  }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listPagerDuty(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollPagerDuty(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listPagerDuty(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(pagerDutyIncidentEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writePagerDuty(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const incidentId = String(record.target?.incidentId ?? record.target?.externalId ?? "");
  if (!incidentId) return { status: "failed", request: { method: "POST", url: "vendor://pagerduty/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "PagerDuty writeback requires target.incidentId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_PAGERDUTY_API_BASE ?? "https://api.pagerduty.com", `/incidents/${encodeURIComponent(incidentId)}/notes`), bearerHeaders("MEMORY_PAGERDUTY_TOKEN"), JSON.stringify({ note: { content: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listPostHog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollPostHog(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listPostHog(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(postHogFlagEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writePostHog(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const project = process.env.MEMORY_POSTHOG_PROJECT ?? "";
  const flagId = String(record.target?.flagId ?? record.target?.featureFlag ?? record.target?.externalId ?? "");
  if (!flagId) return { status: "failed", request: { method: "PATCH", url: "vendor://posthog/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "PostHog writeback requires target.flagId, target.featureFlag, or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_POSTHOG_BASE_URL ?? "https://app.posthog.com", `/api/projects/${encodeURIComponent(project)}/feature_flags/${encodeURIComponent(flagId)}/`), bearerHeaders("MEMORY_POSTHOG_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}
