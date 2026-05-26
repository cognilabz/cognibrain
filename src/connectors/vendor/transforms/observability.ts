import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";

export function sentryIssueItem(issue: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(issue.id, ""),
    title: str(issue.title, str(issue.culprit, "Untitled Sentry issue")),
    status: str(issue.status, undefined),
    level: str(issue.level, undefined),
    url: str(issue.permalink, undefined),
    updatedAt: str(issue.lastSeen, str(issue.firstSeen, undefined)),
    count: issue.count,
    userCount: issue.userCount
  };
}

export function sentryIssueEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Sentry issue ${str(item.title, "Untitled issue")} is ${str(item.status, "active")} with level ${str(item.level, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.87 },
    metadata: { vendor: "sentry", eventType: "test_failure", organization: process.env.MEMORY_SENTRY_ORG, project: process.env.MEMORY_SENTRY_PROJECT, status: item.status, level: item.level, count: item.count, userCount: item.userCount, visibility: "org" }
  };
}

export function datadogBaseUrl(): string {
  const site = process.env.MEMORY_DATADOG_SITE ?? "datadoghq.com";
  return /^https?:\/\//i.test(site) ? site : `https://api.${site}`;
}

export function datadogMonitorItem(monitor: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: monitor.id === undefined ? "" : String(monitor.id),
    title: str(monitor.name, "Untitled Datadog monitor"),
    status: str(monitor.overall_state, undefined),
    type: str(monitor.type, undefined),
    query: str(monitor.query, undefined),
    url: str(monitor.url, undefined),
    tags: arr(monitor.tags).filter((item): item is string => typeof item === "string")
  };
}

export function datadogMonitorEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Datadog monitor ${str(item.title, "Untitled monitor")} is ${str(item.status, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    source: { kind: "import", confidence: 0.85 },
    metadata: { vendor: "datadog", eventType: "incident_metric", site: process.env.MEMORY_DATADOG_SITE, status: item.status, monitorType: item.type, tags: item.tags, visibility: "org" }
  };
}

export function pagerDutyIncidentItem(incident: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(incident.id, ""),
    title: str(incident.title, str(incident.summary, "Untitled PagerDuty incident")),
    status: str(incident.status, undefined),
    urgency: str(incident.urgency, undefined),
    url: str(incident.html_url, undefined),
    service: str(obj(incident.service).summary, undefined),
    updatedAt: str(incident.updated_at, undefined)
  };
}

export function pagerDutyIncidentEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `PagerDuty incident ${str(item.title, "Untitled incident")} is ${str(item.status, "active")} with urgency ${str(item.urgency, "unknown")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.87 },
    metadata: { vendor: "pagerduty", eventType: "incident_correction", account: process.env.MEMORY_PAGERDUTY_ACCOUNT, service: item.service, status: item.status, urgency: item.urgency, visibility: "org" }
  };
}

export function postHogFlagItem(flag: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(flag.id, str(flag.key, "")),
    key: str(flag.key, undefined),
    title: str(flag.name, str(flag.key, "Untitled PostHog flag")),
    active: Boolean(flag.active),
    rollout: flag.filters,
    updatedAt: str(flag.updated_at, str(flag.created_at, undefined)),
    createdBy: str(obj(flag.created_by).email, str(obj(flag.created_by).first_name, undefined))
  };
}

export function postHogFlagEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `PostHog feature flag ${str(item.key, str(item.title, "Untitled flag"))} is ${item.active ? "active" : "inactive"}.`,
    externalId: str(item.externalId, ""),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.84 },
    metadata: { vendor: "posthog", eventType: "feature_flag_decision", project: process.env.MEMORY_POSTHOG_PROJECT, key: item.key, active: item.active, author: item.createdBy, visibility: "org" }
  };
}
