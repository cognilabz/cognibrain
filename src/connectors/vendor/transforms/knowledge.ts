import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";
import { adfText, htmlText, jiraBrowseUrl, notionTitle, structuredDocumentEventType, structuredIssueEventType } from "./helpers";

export function jiraIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
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

export function jiraIssueEvents(item: Record<string, unknown>): Array<MemoryExtractionEvent & { externalId?: string }> {
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
      eventType: structuredIssueEventType(labels, item.issueType, "issue_decision"),
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

export function confluencePageItem(page: Record<string, unknown>): Record<string, unknown> {
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

export function confluencePageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
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
      eventType: structuredDocumentEventType(arr(item.labels), "doc_decision"),
      space: item.space,
      version: String(item.version ?? ""),
      labels: item.labels,
      author: item.author,
      visibility: "org"
    }
  };
}

export function notionPageItem(page: Record<string, unknown>): Record<string, unknown> {
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

export function notionPageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Notion page ${str(item.title, "Untitled page")} was updated in the connected workspace.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.86 },
    metadata: {
      vendor: "notion",
      eventType: structuredDocumentEventType([], "doc_decision"),
      workspace: item.workspace,
      archived: item.archived,
      author: item.author,
      visibility: "org"
    }
  };
}

export function linearIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
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

export function linearIssueEvents(item: Record<string, unknown>): Array<MemoryExtractionEvent & { externalId?: string }> {
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
      eventType: structuredIssueEventType(arr(item.labels), undefined, "issue_decision"),
      identifier,
      status: item.status,
      assignee: item.assignee,
      labels: item.labels,
      author: str(latestComment?.author, undefined),
      visibility: "org"
    }
  }];
}
