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

export function correctionLike(text: string): boolean {
  return /\b(correction|do not|don't|dont|never|use .* instead|must not|should not)\b/i.test(text);
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
