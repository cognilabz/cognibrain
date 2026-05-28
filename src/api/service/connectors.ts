import { createHmac } from "node:crypto";
import { citationFor, type ConnectorManifest, type ConnectorSyncRecord, type ConsentVisibility, type Memory, type MemoryExtractionEvent } from "../../core";
import type { ConnectorWritebackOperation } from "../service";

export function connectorReviewRequired(manifest: ConnectorManifest, event: MemoryExtractionEvent & { externalId?: string }): boolean {
  if (event.metadata?.reviewRequired === true) return true;
  const eventType = normalizeConnectorEventType(typeof event.metadata?.eventType === "string" ? event.metadata.eventType : "");
  if (manifest.kind === "chat" && ["chat_decision", "pr_decision", "issue_decision"].includes(eventType)) return true;
  return false;
}

export function connectorEventVisibility(event: MemoryExtractionEvent & { externalId?: string }): ConsentVisibility | undefined {
  const value = event.metadata?.visibility ?? event.metadata?.channelVisibility;
  if (value === "private" || value === "user" || value === "org" || value === "public") return value;
  if (value === "team") return "org";
  return undefined;
}

export function connectorEventTags(manifest: ConnectorManifest, event: MemoryExtractionEvent & { externalId?: string }): string[] {
  const eventType = normalizeConnectorEventType(typeof event.metadata?.eventType === "string" ? event.metadata.eventType : "");
  const tags = [manifest.id, manifest.kind];
  for (const provider of ["github", "slack", "discord", "jira", "confluence", "notion", "linear", "gitlab", "azure-devops", "teams", "gmail", "google-drive", "google-calendar", "asana", "clickup", "sentry", "datadog", "pagerduty", "posthog"]) {
    if (manifest.id.includes(provider)) tags.push(provider);
  }
  if (eventType === "pr_decision") tags.push("pr-decision", "connector-decision");
  if (eventType === "test_failure" || eventType === "actions_failure") tags.push("test-failure", "harness-action");
  if (eventType === "issue_correction" || eventType === "ticket_correction" || eventType === "review_correction") tags.push("engineering-correction", "connector-correction");
  if (eventType === "architecture_decision" || eventType === "runbook" || eventType === "repo_policy") tags.push("architecture-decision", "repo-policy");
  if (connectorReviewRequired(manifest, event)) tags.push("memory-candidate", "review-required");
  return [...new Set(tags)];
}

export function connectorWritebackPayload(
  manifest: ConnectorManifest,
  operation: ConnectorWritebackOperation,
  target: Record<string, unknown>,
  content: string | undefined,
  memories: Memory[],
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const text = content?.trim() || memories.map((memory) => memory.content).join("\n\n").slice(0, 2000) || "Cognibrain memory update.";
  const citations = memories.map((memory) => citationFor(memory));
  const base = { operation, text, citations, memoryIds: memories.map((memory) => memory.id), metadata: metadata ?? {} };
  if (manifest.kind === "email") return { ...base, adapter: "email.draft_reply", messageId: target.externalId, threadId: target.threadId, subject: target.subject ?? "Memory update", body: text };
  if (manifest.kind === "chat") return { ...base, adapter: "chat.post_message", channel: target.channel, threadId: target.threadId, text };
  if (manifest.kind === "project_management") return { ...base, adapter: operation === "status" ? "issue.update_status" : "issue.add_comment", issueKey: target.externalId ?? target.issueKey, status: target.status, comment: text };
  if (manifest.kind === "docs") return { ...base, adapter: "docs.append_comment", uri: target.uri, title: target.title, comment: text };
  if (manifest.kind === "code") return { ...base, adapter: "code.review_comment", repo: target.repo, path: target.path, pullRequest: target.pullRequest, comment: text };
  if (manifest.kind === "calendar") return { ...base, adapter: "calendar.update_event_note", eventId: target.externalId ?? target.eventId, note: text };
  if (manifest.kind === "cloud_storage") return { ...base, adapter: "cloud_storage.file_metadata", fileId: target.externalId ?? target.fileId, tags: target.tags, summary: text };
  return { ...base, adapter: "custom.writeback", target };
}

export function connectorWritebackRequest(manifest: ConnectorManifest, record: ConnectorSyncRecord): ConnectorSyncRecord["request"] | undefined {
  const endpoint = manifest.writeback?.endpoint;
  if (!endpoint) return undefined;
  const body = JSON.stringify({ connectorId: manifest.id, kind: manifest.kind, operation: record.operation, target: record.target, payload: record.payload });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "cognibrain-connector/0.1",
    "x-cognibrain-connector": manifest.id,
    "x-cognibrain-operation": record.operation ?? "comment"
  };
  if (manifest.writeback?.authRef) headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", manifest.writeback.authRef).update(body).digest("hex")}`;
  return { method: manifest.writeback?.method ?? "POST", url: interpolateConnectorEndpoint(endpoint, record.target ?? {}), headers, body };
}

export function connectorAdapterRequest(
  manifest: ConnectorManifest,
  operation: string,
  endpoint: string,
  method: "GET" | "POST",
  payload?: Record<string, unknown>,
  authRef?: string
): NonNullable<ConnectorSyncRecord["request"]> {
  const body = method === "GET" ? "" : JSON.stringify({ connectorId: manifest.id, kind: manifest.kind, operation, payload: payload ?? {} });
  const headers: Record<string, string> = { "user-agent": "cognibrain-connector/0.1", "x-cognibrain-connector": manifest.id, "x-cognibrain-operation": operation };
  if (method !== "GET") headers["content-type"] = "application/json";
  if (authRef) headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", authRef).update(body).digest("hex")}`;
  return { method, url: endpoint, headers, body };
}

export function connectorWritebackOperations(kind: ConnectorManifest["kind"]): ConnectorWritebackOperation[] {
  if (kind === "project_management") return ["comment", "status", "tag", "memory_link"];
  if (kind === "chat") return ["comment", "summary", "memory_link"];
  if (kind === "email") return ["comment", "tag", "summary"];
  if (kind === "docs") return ["comment", "summary", "memory_link"];
  if (kind === "code") return ["comment", "status", "memory_link"];
  if (kind === "calendar") return ["summary", "memory_link"];
  if (kind === "cloud_storage") return ["tag", "summary", "memory_link"];
  return ["comment", "tag", "status", "summary", "memory_link"];
}

export function interpolateConnectorEndpoint(endpoint: string, target: Record<string, unknown>): string {
  return endpoint.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key: string) => encodeURIComponent(String(target[key] ?? "")));
}

function normalizeConnectorEventType(value: string): string {
  let output = "";
  let previousSeparator = false;
  for (const char of value.trim().toLowerCase()) {
    const code = char.charCodeAt(0);
    const alphaNumeric = (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
    if (alphaNumeric) {
      output += char;
      previousSeparator = false;
      continue;
    }
    if (!previousSeparator && output) {
      output += "_";
      previousSeparator = true;
    }
  }
  return output.endsWith("_") ? output.slice(0, -1) : output;
}
