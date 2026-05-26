import { createHmac } from "node:crypto";
import { createJsonCommandIntelligenceFromEnv } from "../../core/providers";
import type { RedactionPolicy } from "../../core/privacy";
import { DOMAIN_MODULES, citationFor, normalizeRetrievalWeights, type MemoryStore } from "../../core";
import type { ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryServiceOptions } from "../service";
import { contentHash } from "./base";
import { roundMetric } from "./patterns";
import type {
  AdaptiveDreamPolicyReport,
  AuditEvent,
  AuditJournalEvent,
  AuditReplayMemoryState,
  BehavioralPatternReport,
  ConnectorManifest,
  ConnectorSyncRecord,
  ConsentPolicy,
  ConsentVisibility,
  ContextReference,
  DreamBudget,
  DreamCycleMode,
  DreamCycleTrigger,
  EngineeringMemoryKind,
  ExternalContextEvidence,
  FeedbackEvent,
  MarketplaceModule,
  MarketplaceReview,
  Memory,
  MemoryExtractionEvent,
  MemoryInput,
  MemoryPolicyRule,
  MemoryScope,
  ObservationReport,
  PersonaProfile,
  ProceduralMemoryMetadata,
  QueryIntentReport,
  QueryPlan,
  QueryPlanStrategy,
  RetentionRule,
  RetrievalProfile,
  RetrievalTrainingSample,
  RetrievalWeights,
  TimelineReport,
  TransportSecurityReport
} from "../../core";

const COGNIBRAIN_VERSION = "0.1.0";

export function detectContextReferences(query: string): ContextReference[] {
  const references: ContextReference[] = [];
  const seen = new Set<string>();
  const add = (reference: ContextReference) => {
    const key = `${reference.type}:${reference.value}:${reference.url ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push(reference);
  };
  for (const match of query.matchAll(/https?:\/\/[^\s),\]]+/g)) {
    const raw = match[0].replace(/[).,]+$/, "");
    const parsed = parseReferenceUrl(raw);
    add(parsed ?? { type: "url", raw, value: raw, url: raw, confidence: 0.72 });
  }
  for (const match of query.matchAll(/\b([A-Z][A-Z0-9]{1,12}-\d+)\b/g)) {
    add({ type: "jira_issue", raw: match[0], value: match[1], connectorHint: "official-jira", confidence: 0.9 });
  }
  for (const match of query.matchAll(/\b(?:gh|github)\s*(?:issue|#)?\s*#?(\d+)\b/gi)) {
    add({ type: "github_issue", raw: match[0], value: match[1], connectorHint: "official-github", confidence: 0.84 });
  }
  for (const match of query.matchAll(/\b(?:pr|pull request|merge)\s*#?(\d+)\b/gi)) {
    add({ type: "github_pull_request", raw: match[0], value: match[1], connectorHint: "official-github", confidence: 0.82 });
  }
  for (const match of query.matchAll(/(?<![\w/-])#(\d+)\b/g)) {
    add({ type: "issue_or_pr", raw: match[0], value: match[1], confidence: 0.68 });
  }
  return references;
}

export function parseReferenceUrl(raw: string): ContextReference | undefined {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const github = url.pathname.match(/\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/i);
    if (host.includes("github.com") && github) {
      return {
        type: github[3].toLowerCase() === "pull" ? "github_pull_request" : "github_issue",
        raw,
        value: github[4],
        url: raw,
        connectorHint: "official-github",
        confidence: 0.96
      };
    }
    const gitlab = url.pathname.match(/\/-\/merge_requests\/(\d+)/i);
    if (host.includes("gitlab") && gitlab) {
      return { type: "gitlab_merge_request", raw, value: gitlab[1], url: raw, connectorHint: "official-gitlab", confidence: 0.93 };
    }
    if (host.includes("atlassian.net") && /\/wiki\//i.test(url.pathname)) {
      return { type: "confluence_page", raw, value: raw, url: raw, connectorHint: "official-confluence", confidence: 0.88 };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function contextConnectorPlan(input: ContextEnrichmentInput, references: ContextReference[]): Array<{ connectorId: string; reason: string; source: ExternalContextEvidence["source"]; reference?: ContextReference }> {
  const planned: Array<{ connectorId: string; reason: string; source: ExternalContextEvidence["source"]; reference?: ContextReference }> = [];
  const issueStore = input.primaryIssueStore ?? process.env.MEMORY_PRIMARY_ISSUE_CONNECTOR;
  const knowledgeStore = input.primaryKnowledgeStore ?? process.env.MEMORY_PRIMARY_KNOWLEDGE_CONNECTOR;
  const defaultConnectors = [
    ...(input.defaultSearchConnectors ?? []),
    ...csv(process.env.MEMORY_DEFAULT_CONTEXT_CONNECTORS)
  ];
  const push = (connectorId: string | undefined, reason: string, source: ExternalContextEvidence["source"], reference?: ContextReference) => {
    if (!connectorId) return;
    planned.push({ connectorId, reason, source, reference });
  };
  if (input.fetchReferenced !== false) {
    for (const reference of references) {
      if (reference.connectorHint) push(reference.connectorHint, `explicit reference ${reference.raw}`, "reference", reference);
      else if (reference.type === "issue_or_pr") push(issueStore ?? "official-github", `generic issue/PR reference ${reference.raw}`, "reference", reference);
      else if (reference.type === "url") push(knowledgeStore, `referenced URL ${reference.raw}`, "reference", reference);
    }
  }
  if (input.searchPrimaryStores !== false) {
    push(issueStore, "primary issue store default search", "primary_issue_store");
    push(knowledgeStore, "primary knowledge store default search", "primary_knowledge_store");
    for (const connectorId of defaultConnectors) push(connectorId, "default context connector search", "default_search");
  }
  const seen = new Set<string>();
  return planned.filter((item) => {
    const key = `${item.connectorId}:${item.source}:${item.reference?.type ?? ""}:${item.reference?.value ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankContextItems(input: {
  query: string;
  connectorId: string;
  source: ExternalContextEvidence["source"];
  reference?: ContextReference;
  items: Array<Record<string, unknown>>;
  maxResults: number;
}): ExternalContextEvidence[] {
  const queryTokens = tokenSet(input.query);
  return input.items
    .map((item) => contextEvidenceForItem(input.connectorId, item, input.source, input.reference, queryTokens))
    .filter((item): item is ExternalContextEvidence => item !== undefined && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.maxResults);
}

export function contextEvidenceForItem(
  connectorId: string,
  item: Record<string, unknown>,
  source: ExternalContextEvidence["source"],
  reference: ContextReference | undefined,
  queryTokens: Set<string>
): ExternalContextEvidence | undefined {
  const externalId = firstString(item.externalId, item.id, item.key, item.issueKey, item.identifier);
  const title = firstString(item.title, item.name, item.summary, item.key, externalId, "External context item") ?? "External context item";
  const uri = firstString(item.url, item.uri, item.webUrl, item.web_url, item.html_url, item.permalink_url);
  const content = compactContextItemText(item, title);
  const haystack = `${externalId ?? ""} ${title} ${uri ?? ""} ${content}`.toLowerCase();
  const exact = reference ? referenceMatchesItem(reference, haystack, externalId, uri) : false;
  const overlap = [...queryTokens].filter((token) => token.length > 2 && haystack.includes(token)).length;
  const score = (exact ? 2.5 : 0) + Math.min(1.5, overlap * 0.18) + (source === "primary_issue_store" || source === "primary_knowledge_store" ? 0.25 : 0);
  if (score <= 0.1) return undefined;
  const fetchedAt = new Date().toISOString();
  return {
    id: `ext_${contentHash(`${connectorId}:${externalId ?? uri ?? title}:${reference?.raw ?? ""}`).slice(2, 14)}`,
    connectorId,
    source,
    reference: reference?.raw,
    externalId,
    title,
    content,
    uri,
    score: roundMetric(score),
    fetchedAt,
    provenance: {
      connectorId,
      reference: reference?.raw,
      sourceUri: uri,
      fetchMode: reference ? "list-filter" : "search"
    }
  };
}

export function referenceMatchesItem(reference: ContextReference, haystack: string, externalId?: string, uri?: string): boolean {
  const value = reference.value.toLowerCase();
  if (reference.url && uri && normalizeUrl(uri) === normalizeUrl(reference.url)) return true;
  if (reference.type === "jira_issue") return haystack.includes(value);
  if (reference.type === "github_issue" || reference.type === "github_pull_request" || reference.type === "issue_or_pr") {
    return [value, `#${value}`, `pr-${value}`, `issue-${value}`].some((needle) => haystack.includes(needle)) || externalId === value;
  }
  if (reference.type === "gitlab_merge_request") return [value, `mr-${value}`].some((needle) => haystack.includes(needle));
  if (reference.type === "confluence_page" || reference.type === "url") return reference.url ? haystack.includes(reference.url.toLowerCase()) : haystack.includes(value);
  return false;
}

export function compactContextItemText(item: Record<string, unknown>, title: string): string {
  const values = [
    firstString(item.content, item.body, item.description, item.notes, item.text, item.markdown_description),
    firstString(item.status, item.state, item.assignee, item.author),
    firstString(item.updatedAt, item.modifiedAt, item.updated_at)
  ].filter((value): value is string => Boolean(value));
  return truncateText([title, ...values].join(" | "), 1200);
}

export function buildEnrichedContext(localContext: string, external: ExternalContextEvidence[], tokenBudget: number): string {
  const externalContext = external.length
    ? [
        "## External context fetched just in time",
        ...external.map((item) => `- [${item.id}] ${item.connectorId}${item.reference ? ` via ${item.reference}` : ""}: ${item.title}. ${truncateText(item.content, 420)}${item.uri ? ` (${item.uri})` : ""}`)
      ].join("\n")
    : "";
  return truncateText([localContext, externalContext].filter(Boolean).join("\n\n"), Math.max(600, tokenBudget * 4));
}

export function dedupeExternalEvidence(items: ExternalContextEvidence[]): ExternalContextEvidence[] {
  const byKey = new Map<string, ExternalContextEvidence>();
  for (const item of items) {
    const key = `${item.connectorId}:${item.externalId ?? item.uri ?? item.title}`;
    const previous = byKey.get(key);
    if (!previous || item.score > previous.score) byKey.set(key, item);
  }
  return [...byKey.values()];
}

export function csv(value: string | undefined): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

export function tokenSet(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9_-]+/).filter((token) => token.length > 1));
}

export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
  for (const value of values) if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function truncateText(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 3)).trim()}...`;
}

export function normalizeUrl(value: string): string {
  return value.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}
