import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";

export function asanaTaskItem(task: Record<string, unknown>): Record<string, unknown> {
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

export function asanaTaskEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Asana task ${str(item.title, "Untitled task")}: ${str(item.notes, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.87 },
    metadata: { vendor: "asana", eventType: "issue_decision", workspace: process.env.MEMORY_ASANA_WORKSPACE, project: item.project, completed: item.completed, assignee: item.assignee, visibility: "org" }
  };
}

export function clickUpTaskItem(task: Record<string, unknown>): Record<string, unknown> {
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

export function clickUpTaskEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `ClickUp task ${str(item.title, "Untitled task")}: ${str(item.text, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.86 },
    metadata: { vendor: "clickup", eventType: "issue_decision", workspace: process.env.MEMORY_CLICKUP_WORKSPACE_ID, list: process.env.MEMORY_CLICKUP_LIST_ID ?? process.env.MEMORY_CLICKUP_SPACE_ID, status: item.status, assignee: item.assignee, visibility: "org" }
  };
}
