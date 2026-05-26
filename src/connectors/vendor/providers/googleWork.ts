import type { ConnectorSyncRecord, MemoryExtractionEvent } from "../../../core";
import type { ExternalVendorListResult, ExternalVendorPollResult, ExternalVendorWritebackResult, FetchLike } from "../../vendorConfig";
import {
  apiUrl, atlassianHeaders, azureDevOpsHeaders, bearerHeaders, clickUpHeaders, datadogHeaders, discordHeaders, discordJumpUrl, fetchJson, fetchPagedJson, githubHeaders, githubRepo, gitlabHeaders, linearHeaders, nextLink, notionHeaders, recordRequest, requestShape, slackHeaders
} from "../http";
import {
  adfDocument, asanaTaskEvent, asanaTaskItem, azurePullRequestEvent, azurePullRequestItem, clickUpTaskEvent, clickUpTaskItem, confluencePageEvent, confluencePageItem, datadogBaseUrl, datadogMonitorEvent, datadogMonitorItem, escapeHtml, githubPullEvent, githubPullItem, gitlabMergeRequestEvent, gitlabMergeRequestItem, gmailMessageEvent, gmailMessageItem, googleCalendarEvent, googleCalendarEventItem, googleDriveFileEvent, googleDriveFileItem, jiraIssueEvents, jiraIssueItem, linearIssueEvents, linearIssueItem, notionPageEvent, notionPageItem, pagerDutyIncidentEvent, pagerDutyIncidentItem, postHogFlagEvent, postHogFlagItem, sentryIssueEvent, sentryIssueItem, teamsMessageEvent, teamsMessageItem
} from "../transforms";
import { arr, obj, str } from "../http";

export async function listGmail(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollGmail(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGmail(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(gmailMessageEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeGmail(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const account = process.env.MEMORY_GMAIL_ACCOUNT ?? "me";
  const messageId = String(record.target?.messageId ?? record.target?.externalId ?? "");
  if (!messageId) return { status: "failed", request: { method: "POST", url: "vendor://gmail/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Gmail writeback requires target.messageId or target.externalId" };
  const labelIds = arr(record.target?.labelIds).filter((item): item is string => typeof item === "string");
  const request = requestShape("POST", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://gmail.googleapis.com", `/gmail/v1/users/${encodeURIComponent(account)}/messages/${encodeURIComponent(messageId)}/modify`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ addLabelIds: labelIds.length ? labelIds : ["IMPORTANT"] }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listGoogleDrive(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollGoogleDrive(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGoogleDrive(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(googleDriveFileEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeGoogleDrive(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const fileId = String(record.target?.fileId ?? record.target?.externalId ?? "");
  if (!fileId) return { status: "failed", request: { method: "PATCH", url: "vendor://google-drive/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Google Drive writeback requires target.fileId or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", `/drive/v3/files/${encodeURIComponent(fileId)}`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listGoogleCalendar(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollGoogleCalendar(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listGoogleCalendar(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(googleCalendarEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeGoogleCalendar(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const calendarId = process.env.MEMORY_GOOGLE_CALENDAR_ID ?? "primary";
  const eventId = String(record.target?.eventId ?? record.target?.externalId ?? "");
  if (!eventId) return { status: "failed", request: { method: "PATCH", url: "vendor://google-calendar/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Google Calendar writeback requires target.eventId or target.externalId" };
  const request = requestShape("PATCH", apiUrl(process.env.MEMORY_GOOGLE_API_BASE ?? "https://www.googleapis.com", `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`), bearerHeaders("MEMORY_GOOGLE_TOKEN"), JSON.stringify({ description: str(record.payload?.text, "Cognibrain memory update.") }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listAsana(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollAsana(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listAsana(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(asanaTaskEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeAsana(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const taskId = String(record.target?.taskId ?? record.target?.externalId ?? "");
  if (!taskId) return { status: "failed", request: { method: "POST", url: "vendor://asana/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "Asana writeback requires target.taskId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_ASANA_API_BASE ?? "https://app.asana.com", `/api/1.0/tasks/${encodeURIComponent(taskId)}/stories`), bearerHeaders("MEMORY_ASANA_TOKEN"), JSON.stringify({ data: { text: str(record.payload?.text, "Cognibrain memory update.") } }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}

export async function listClickUp(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorListResult> {
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

export async function pollClickUp(fetchImpl: FetchLike, timeoutMs: number): Promise<ExternalVendorPollResult> {
  const list = await listClickUp(fetchImpl, timeoutMs);
  if (list.status === "failed") return { status: "failed", events: [], request: list.request, responseStatusCode: list.responseStatusCode, error: list.error };
  return { status: "applied", events: list.items.map(clickUpTaskEvent), request: list.request, responseStatusCode: list.responseStatusCode };
}

export async function writeClickUp(record: ConnectorSyncRecord, fetchImpl: FetchLike, timeoutMs: number, dryRun: boolean): Promise<ExternalVendorWritebackResult> {
  const taskId = String(record.target?.taskId ?? record.target?.externalId ?? "");
  if (!taskId) return { status: "failed", request: { method: "POST", url: "vendor://clickup/writeback", headers: {}, body: JSON.stringify(record.payload ?? {}) }, error: "ClickUp writeback requires target.taskId or target.externalId" };
  const request = requestShape("POST", apiUrl(process.env.MEMORY_CLICKUP_API_BASE ?? "https://api.clickup.com", `/api/v2/task/${encodeURIComponent(taskId)}/comment`), clickUpHeaders(), JSON.stringify({ comment_text: str(record.payload?.text, "Cognibrain memory update."), notify_all: false }));
  if (dryRun) return { status: "applied", request: recordRequest(request) };
  const response = await fetchJson<Record<string, unknown>>(request, fetchImpl, timeoutMs);
  return { status: response.ok ? "applied" : "failed", request: recordRequest(request), responseStatusCode: response.status, error: response.ok ? undefined : response.error };
}
