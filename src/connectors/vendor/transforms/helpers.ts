import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";

export function jiraBrowseUrl(issueKey: string | undefined): string | undefined {
  if (!issueKey) return undefined;
  const base = process.env.MEMORY_JIRA_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/browse/${encodeURIComponent(issueKey)}` : undefined;
}

export function adfDocument(text: string): Record<string, unknown> {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }]
  };
}

export function adfText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfText).filter(Boolean).join(" ");
  const value = node as Record<string, unknown>;
  if (typeof value.text === "string") return value.text;
  return arr(value.content).map(adfText).filter(Boolean).join(" ");
}

export function notionTitle(properties: Record<string, unknown>): string {
  for (const value of Object.values(properties)) {
    const property = obj(value);
    const richText = Array.isArray(property.title) ? property.title : Array.isArray(property.rich_text) ? property.rich_text : [];
    const title = richText.map((part) => str(obj(part).plain_text, str(obj(part).text, ""))).join("").trim();
    if (title) return title;
  }
  return "";
}

export function structuredIssueEventType(labels: unknown[], issueType: unknown, fallback: "issue_decision" | "ticket_decision" = "issue_decision"): "issue_correction" | "ticket_correction" | "issue_decision" | "ticket_decision" {
  const normalized = [...labels, issueType].map((item) => normalizeStructuredToken(String(item ?? ""))).filter(Boolean);
  if (normalized.includes("review_correction") || normalized.includes("issue_correction") || normalized.includes("correction")) {
    return fallback === "ticket_decision" ? "ticket_correction" : "issue_correction";
  }
  return fallback;
}

export function structuredDocumentEventType(labels: unknown[], fallback: "doc_decision" | "calendar_decision" = "doc_decision"): "architecture_decision" | "runbook" | "repo_policy" | "doc_decision" | "calendar_decision" {
  const normalized = labels.map((item) => normalizeStructuredToken(String(item ?? ""))).filter(Boolean);
  if (normalized.includes("runbook")) return "runbook";
  if (normalized.includes("architecture_decision")) return "architecture_decision";
  if (normalized.includes("repo_policy")) return "repo_policy";
  return fallback;
}

export function normalizeStructuredToken(value: string): string {
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

export function htmlText(value: string): string {
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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
