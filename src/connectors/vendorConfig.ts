import type { ConnectorManifest, ConnectorSyncRecord, MemoryExtractionEvent } from "../core";

export type ExternalVendorProvider =
  | "github"
  | "slack"
  | "discord"
  | "jira"
  | "confluence"
  | "notion"
  | "linear"
  | "gitlab"
  | "azure-devops"
  | "teams"
  | "gmail"
  | "google-drive"
  | "google-calendar"
  | "asana"
  | "clickup"
  | "sentry"
  | "datadog"
  | "pagerduty"
  | "posthog";

export interface ExternalVendorListResult {
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  request?: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

export interface ExternalVendorPollResult {
  status: "applied" | "failed";
  events: Array<MemoryExtractionEvent & { externalId?: string }>;
  request?: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

export interface ExternalVendorWritebackResult {
  status: "applied" | "failed";
  request: NonNullable<ConnectorSyncRecord["request"]>;
  responseStatusCode?: number;
  error?: string;
}

export type FetchLike = typeof fetch;

export interface VendorFetchResult<T> {
  ok: boolean;
  status: number;
  json?: T;
  error?: string;
  headers: Record<string, string>;
  attempts: number;
  rateLimitRetries: number;
}

export interface VendorPagedFetchResult<TItem, TJson> extends VendorFetchResult<TJson> {
  items: TItem[];
  pageCount: number;
  requests: Array<NonNullable<ConnectorSyncRecord["request"]>>;
}

const providerByConnectorId: Record<string, ExternalVendorProvider> = {
  "official-github": "github",
  "official-slack": "slack",
  "official-discord": "discord",
  "official-jira": "jira",
  "official-confluence": "confluence",
  "official-notion": "notion",
  "official-linear": "linear",
  "official-gitlab": "gitlab",
  "official-azure-devops": "azure-devops",
  "official-microsoft-teams": "teams",
  "official-gmail": "gmail",
  "official-google-drive": "google-drive",
  "official-google-calendar": "google-calendar",
  "official-asana": "asana",
  "official-clickup": "clickup",
  "official-sentry": "sentry",
  "official-datadog": "datadog",
  "official-pagerduty": "pagerduty",
  "official-posthog": "posthog"
};

export function externalVendorProvider(manifest: ConnectorManifest): ExternalVendorProvider | undefined {
  if (manifest.vendor?.provider) return manifest.vendor.provider;
  return providerByConnectorId[manifest.id];
}

export function shouldUseExternalVendor(manifest: ConnectorManifest, endpoint?: string): boolean {
  return Boolean(endpoint?.startsWith("vendor://") || manifest.vendor?.provider);
}

export function externalVendorConfigured(provider: ExternalVendorProvider, env: NodeJS.ProcessEnv = process.env): { configured: boolean; missing: string[] } {
  const required = requiredVendorEnv(provider);
  const missing = required.filter((key) => !vendorEnv(env, key));
  return { configured: missing.length === 0, missing };
}

export function vendorEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  if (key === "MEMORY_SLACK_TOKEN") return env.MEMORY_SLACK_TOKEN || env.MEMORY_SLACK_BOT_TOKEN;
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return env.MEMORY_DISCORD_BOT_TOKEN || env.MEMORY_DISCORD_TOKEN;
  if (key === "MEMORY_GITHUB_TOKEN") return env.MEMORY_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (key === "MEMORY_JIRA_API_TOKEN") return env.MEMORY_JIRA_API_TOKEN || env.JIRA_API_TOKEN;
  if (key === "MEMORY_CONFLUENCE_API_TOKEN") return env.MEMORY_CONFLUENCE_API_TOKEN || env.CONFLUENCE_API_TOKEN || env.MEMORY_JIRA_API_TOKEN;
  if (key === "MEMORY_NOTION_TOKEN") return env.MEMORY_NOTION_TOKEN || env.NOTION_TOKEN;
  if (key === "MEMORY_LINEAR_API_KEY") return env.MEMORY_LINEAR_API_KEY || env.LINEAR_API_KEY;
  if (key === "MEMORY_GITLAB_TOKEN") return env.MEMORY_GITLAB_TOKEN || env.GITLAB_TOKEN;
  if (key === "MEMORY_AZURE_DEVOPS_TOKEN") return env.MEMORY_AZURE_DEVOPS_TOKEN || env.AZURE_DEVOPS_EXT_PAT;
  if (key === "MEMORY_TEAMS_TOKEN") return env.MEMORY_TEAMS_TOKEN || env.MICROSOFT_GRAPH_TOKEN;
  if (key === "MEMORY_GOOGLE_TOKEN") return env.MEMORY_GOOGLE_TOKEN || env.GOOGLE_OAUTH_TOKEN;
  if (key === "MEMORY_ASANA_TOKEN") return env.MEMORY_ASANA_TOKEN || env.ASANA_ACCESS_TOKEN;
  if (key === "MEMORY_CLICKUP_TOKEN") return env.MEMORY_CLICKUP_TOKEN || env.CLICKUP_API_TOKEN;
  if (key === "MEMORY_SENTRY_TOKEN") return env.MEMORY_SENTRY_TOKEN || env.SENTRY_AUTH_TOKEN;
  if (key === "MEMORY_DATADOG_API_KEY") return env.MEMORY_DATADOG_API_KEY || env.DD_API_KEY || env.DATADOG_API_KEY;
  if (key === "MEMORY_DATADOG_APP_KEY") return env.MEMORY_DATADOG_APP_KEY || env.DD_APP_KEY || env.DATADOG_APP_KEY;
  if (key === "MEMORY_PAGERDUTY_TOKEN") return env.MEMORY_PAGERDUTY_TOKEN || env.PAGERDUTY_TOKEN;
  if (key === "MEMORY_POSTHOG_TOKEN") return env.MEMORY_POSTHOG_TOKEN || env.POSTHOG_PERSONAL_API_KEY;
  return env[key];
}

export function requiredVendorEnv(provider: ExternalVendorProvider): string[] {
  if (provider === "github") return ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"];
  if (provider === "slack") return ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"];
  if (provider === "discord") return ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"];
  if (provider === "jira") return ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"];
  if (provider === "confluence") return ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"];
  if (provider === "notion") return ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"];
  if (provider === "linear") return ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"];
  if (provider === "gitlab") return ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"];
  if (provider === "azure-devops") return ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"];
  if (provider === "teams") return ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"];
  if (provider === "gmail") return ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "google-drive") return ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "google-calendar") return ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"];
  if (provider === "asana") return ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"];
  if (provider === "clickup") return ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"];
  if (provider === "sentry") return ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"];
  if (provider === "datadog") return ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"];
  if (provider === "pagerduty") return ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"];
  return ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"];
}
