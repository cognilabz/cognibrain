import { createHmac } from "node:crypto";
import { createJsonCommandIntelligenceFromEnv } from "../../core/providers";
import type { RedactionPolicy } from "../../core/privacy";
import { DOMAIN_MODULES, citationFor, normalizeRetrievalWeights, type MemoryStore } from "../../core";
import type { ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryServiceOptions } from "../service";
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

import { contentHash } from "./base";
import { connectorWritebackOperations } from "./connectors";

export function officialConnectorManifests(): ConnectorManifest[] {
  const now = "2026-01-01T00:00:00.000Z";
  const base = (kind: ConnectorManifest["kind"], name: string, capabilities: ConnectorManifest["capabilities"], metadataMapping: Record<string, string>, defaultSourceKind: ConnectorManifest["defaultSourceKind"] = "import"): ConnectorManifest => ({
    id: `official-${kind}`,
    name,
    kind,
    version: "1.0.0",
    direction: capabilities.includes("writeback") ? "two_way" : "ingest",
    capabilities,
    auth: kind === "custom" ? "none" : "oauth",
    defaultSourceKind,
    metadataMapping,
    privacyPolicy: "project",
    writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind) } : undefined,
    createdAt: now,
    updatedAt: now
  });
  const service = (
    id: string,
    name: string,
    kind: ConnectorManifest["kind"],
    capabilities: ConnectorManifest["capabilities"],
    metadataMapping: Record<string, string>,
    defaultSourceKind: ConnectorManifest["defaultSourceKind"],
    oauthScopes: string[]
  ): ConnectorManifest => ({
    ...base(kind, name, capabilities, metadataMapping, defaultSourceKind),
    id,
    name,
    oauth: {
      authorizeUrl: `https://connectors.cognibrain.local/${id.replace(/^official-/, "")}/oauth/authorize`,
      tokenUrl: `https://connectors.cognibrain.local/${id.replace(/^official-/, "")}/oauth/token`,
      clientIdRef: `secret://${id}/client-id`,
      clientSecretRef: `secret://${id}/client-secret`,
      scopes: oauthScopes,
      redirectUri: "http://localhost:8787/connectors/auth/callback"
    },
    list: { endpoint: `connector://${id}/list`, method: "POST" },
    poll: capabilities.includes("poll") ? { endpoint: `connector://${id}/poll`, method: "POST" } : undefined,
    writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind), endpoint: `connector://${id}/writeback`, method: "POST" } : undefined
  });
  type VendorProvider = NonNullable<ConnectorManifest["vendor"]>["provider"];
  const vendor = (
    id: string,
    name: string,
    kind: ConnectorManifest["kind"],
    capabilities: ConnectorManifest["capabilities"],
    metadataMapping: Record<string, string>,
    defaultSourceKind: ConnectorManifest["defaultSourceKind"],
    oauthScopes: string[],
    provider: VendorProvider,
    docsUrl: string,
    requiredEnv: string[]
  ): ConnectorManifest => {
    const vendorEndpoint = `vendor://${provider}`;
    const oauth = providerOAuthManifest(id, provider, oauthScopes);
    return {
      ...service(id, name, kind, capabilities, metadataMapping, defaultSourceKind, oauthScopes),
      auth: oauth ? "oauth" : provider === "datadog" ? "api_key" : "token",
      oauth,
      list: { endpoint: `${vendorEndpoint}/list`, method: "GET" },
      poll: capabilities.includes("poll") ? { endpoint: `${vendorEndpoint}/poll`, method: "GET" } : undefined,
      writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind), endpoint: `${vendorEndpoint}/writeback`, method: "POST" } : undefined,
      vendor: { provider, docsUrl, requiredEnv, realSmokeEnv: requiredEnv }
    };
  };
  return [
    base("email", "Email", ["ingest", "export", "webhook", "poll", "writeback"], { subject: "content.title", from: "source.author", messageId: "externalId", threadId: "metadata.threadId" }, "human"),
    base("chat", "Chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageId: "externalId", text: "content" }, "transcript"),
    base("project_management", "Project Management", ["ingest", "export", "poll", "writeback"], { issueKey: "externalId", status: "metadata.status", assignee: "entities.assignee", title: "content.title" }, "import"),
    base("docs", "Docs", ["ingest", "webhook", "poll", "writeback"], { url: "source.uri", title: "content.title", workspace: "metadata.workspace" }, "import"),
    base("code", "Code", ["ingest", "webhook", "poll", "writeback"], { repo: "metadata.repo", path: "source.uri", commit: "source.commit", symbol: "entities.symbol" }, "reviewed_code"),
    base("calendar", "Calendar", ["ingest", "poll", "writeback"], { eventId: "externalId", attendees: "entities.attendees", start: "temporal.eventAt" }, "human"),
    base("cloud_storage", "Cloud Storage", ["ingest", "poll", "media"], { fileId: "externalId", mimeType: "mimeType", uri: "source.uri", name: "content.title" }, "import"),
    vendor("official-github", "GitHub", "code", ["ingest", "export", "webhook", "poll", "writeback"], { repo: "metadata.repo", issueNumber: "externalId", pullRequest: "metadata.pullRequest", commit: "source.commit", actor: "source.author", url: "source.uri" }, "reviewed_code", ["repo:read", "issues:read", "pull_requests:read", "contents:read"], "github", "https://docs.github.com/en/rest/pulls/pulls", ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"]),
    vendor("official-gitlab", "GitLab", "code", ["ingest", "export", "webhook", "poll", "writeback"], { project: "metadata.project", mergeRequest: "metadata.mergeRequest", issueIid: "externalId", pipeline: "metadata.pipeline", commit: "source.commit", actor: "source.author", url: "source.uri" }, "reviewed_code", ["read_api", "read_repository", "read_user"], "gitlab", "https://docs.gitlab.com/api/merge_requests/", ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"]),
    vendor("official-azure-devops", "Azure DevOps", "code", ["ingest", "export", "webhook", "poll", "writeback"], { organization: "metadata.organization", project: "metadata.project", workItemId: "externalId", pullRequest: "metadata.pullRequest", pipeline: "metadata.pipeline", url: "source.uri" }, "reviewed_code", ["vso.code", "vso.work", "vso.build"], "azure-devops", "https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get-pull-requests", ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"]),
    vendor("official-jira", "Jira", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { issueKey: "externalId", status: "metadata.status", assignee: "entities.assignee", sprint: "metadata.sprint", project: "metadata.project", url: "source.uri" }, "import", ["read:jira-work", "write:jira-work"], "jira", "https://developer.atlassian.com/cloud/jira/platform/rest/v3/", ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"]),
    vendor("official-confluence", "Confluence", "docs", ["ingest", "export", "webhook", "poll", "writeback"], { pageId: "externalId", space: "metadata.space", version: "metadata.version", title: "content.title", url: "source.uri" }, "import", ["read:confluence-content.all", "write:confluence-content"], "confluence", "https://developer.atlassian.com/cloud/confluence/rest/v2/", ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"]),
    vendor("official-linear", "Linear", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { issueId: "externalId", team: "metadata.team", status: "metadata.status", assignee: "entities.assignee", label: "tags", url: "source.uri" }, "import", ["read", "write"], "linear", "https://developers.linear.app/docs/graphql/working-with-the-graphql-api", ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"]),
    vendor("official-slack", "Slack", "chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageTs: "externalId", threadTs: "metadata.threadId", permalink: "source.uri" }, "transcript", ["channels:history", "groups:history", "chat:write"], "slack", "https://docs.slack.dev/reference/methods/conversations.history/", ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"]),
    vendor("official-discord", "Discord", "chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageId: "externalId", threadId: "metadata.threadId", jumpUrl: "source.uri" }, "transcript", ["messages.read", "messages.write"], "discord", "https://docs.discord.com/developers/resources/message", ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"]),
    vendor("official-microsoft-teams", "Microsoft Teams", "chat", ["ingest", "webhook", "poll", "writeback"], { team: "metadata.team", channel: "metadata.channel", sender: "source.author", messageId: "externalId", threadId: "metadata.threadId", url: "source.uri" }, "transcript", ["ChannelMessage.Read.All", "ChannelMessage.Send"], "teams", "https://learn.microsoft.com/en-us/graph/api/channel-list-messages", ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"]),
    vendor("official-notion", "Notion", "docs", ["ingest", "webhook", "poll", "writeback"], { pageId: "externalId", workspace: "metadata.workspace", title: "content.title", url: "source.uri", lastEditedBy: "source.author" }, "import", ["read_content", "update_content"], "notion", "https://developers.notion.com/reference/intro", ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"]),
    vendor("official-google-drive", "Google Drive", "cloud_storage", ["ingest", "poll", "media", "writeback"], { fileId: "externalId", mimeType: "mimeType", uri: "source.uri", name: "content.title", owner: "source.author" }, "import", ["drive.metadata.readonly", "drive.file"], "google-drive", "https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list", ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"]),
    vendor("official-gmail", "Gmail", "email", ["ingest", "export", "webhook", "poll", "writeback"], { messageId: "externalId", threadId: "metadata.threadId", subject: "content.title", from: "source.author", labelIds: "tags" }, "human", ["gmail.readonly", "gmail.modify"], "gmail", "https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list", ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"]),
    vendor("official-google-calendar", "Google Calendar", "calendar", ["ingest", "poll", "writeback"], { eventId: "externalId", calendarId: "metadata.calendarId", attendees: "entities.attendees", start: "temporal.eventAt", url: "source.uri" }, "human", ["calendar.readonly", "calendar.events"], "google-calendar", "https://developers.google.com/workspace/calendar/api/v3/reference/events/list", ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"]),
    vendor("official-asana", "Asana", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { taskId: "externalId", workspace: "metadata.workspace", project: "metadata.project", status: "metadata.status", assignee: "entities.assignee", url: "source.uri" }, "import", ["tasks:read", "tasks:write"], "asana", "https://developers.asana.com/reference/gettasks", ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"]),
    vendor("official-clickup", "ClickUp", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { taskId: "externalId", workspace: "metadata.workspace", list: "metadata.list", status: "metadata.status", assignee: "entities.assignee", url: "source.uri" }, "import", ["task:read", "task:write"], "clickup", "https://developer.clickup.com/reference/gettasks", ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"]),
    vendor("official-sentry", "Sentry", "code", ["ingest", "export", "webhook", "poll", "writeback"], { issueId: "externalId", organization: "metadata.organization", project: "metadata.project", release: "metadata.release", actor: "source.author", url: "source.uri" }, "reviewed_code", ["event:read", "project:read", "org:read"], "sentry", "https://docs.sentry.io/api/events/list-a-projects-issues/", ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"]),
    vendor("official-datadog", "Datadog", "code", ["ingest", "export", "webhook", "poll", "writeback"], { monitorId: "externalId", service: "metadata.service", site: "metadata.site", status: "metadata.status", url: "source.uri" }, "import", ["monitors_read", "events_read", "incident_read"], "datadog", "https://docs.datadoghq.com/api/latest/monitors/", ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"]),
    vendor("official-pagerduty", "PagerDuty", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { incidentId: "externalId", service: "metadata.service", urgency: "metadata.urgency", status: "metadata.status", url: "source.uri" }, "import", ["incidents.read", "services.read"], "pagerduty", "https://developer.pagerduty.com/api-reference/", ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"]),
    vendor("official-posthog", "PostHog", "docs", ["ingest", "export", "webhook", "poll", "writeback"], { featureFlag: "externalId", project: "metadata.project", experiment: "metadata.experiment", actor: "source.author", url: "source.uri" }, "import", ["feature_flags:read", "insights:read"], "posthog", "https://posthog.com/docs/api/feature-flags", ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"])
  ];
}

function providerOAuthManifest(id: string, provider: NonNullable<ConnectorManifest["vendor"]>["provider"], scopes: string[]): ConnectorManifest["oauth"] | undefined {
  const configs: Partial<Record<NonNullable<ConnectorManifest["vendor"]>["provider"], { authorizeUrl: string; tokenUrl: string; refreshUrl?: string; revokeUrl?: string }>> = {
    github: { authorizeUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", revokeUrl: "https://api.github.com/applications/{client_id}/token" },
    slack: { authorizeUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", revokeUrl: "https://slack.com/api/auth.revoke" },
    jira: { authorizeUrl: "https://auth.atlassian.com/authorize", tokenUrl: "https://auth.atlassian.com/oauth/token", refreshUrl: "https://auth.atlassian.com/oauth/token" },
    confluence: { authorizeUrl: "https://auth.atlassian.com/authorize", tokenUrl: "https://auth.atlassian.com/oauth/token", refreshUrl: "https://auth.atlassian.com/oauth/token" },
    notion: { authorizeUrl: "https://api.notion.com/v1/oauth/authorize", tokenUrl: "https://api.notion.com/v1/oauth/token" },
    linear: { authorizeUrl: "https://linear.app/oauth/authorize", tokenUrl: "https://api.linear.app/oauth/token", revokeUrl: "https://api.linear.app/oauth/revoke" }
  };
  const config = configs[provider];
  if (!config) return undefined;
  return {
    ...config,
    clientIdRef: `secret://${id}/client-id`,
    clientSecretRef: `secret://${id}/client-secret`,
    scopes,
    redirectUri: "http://localhost:8787/connectors/auth/callback"
  };
}

export function officialMarketplaceModules(): MarketplaceModule[] {
  const scannedAt = "2026-01-01T00:00:00.000Z";
  const security = (permissions: string[] = []): MarketplaceModule["security"] => ({ scannedAt, status: "passed", permissions, risks: [] });
  const signed = (id: string): Pick<MarketplaceModule, "signature" | "compatibility"> => ({
    signature: {
      signer: "cognilabz",
      algorithm: "sha256",
      digest: contentHash(`cognibrain:${id}:1.0.0`),
      status: "verified",
      verifiedAt: scannedAt
    },
    compatibility: { minCognibrainVersion: "0.1.0", engines: ["node>=20"] }
  });
  return [
    ...officialConnectorManifests().map((manifest): MarketplaceModule => ({
      id: `market-${manifest.id}`,
      kind: "connector" as const,
      name: `${manifest.name} Connector`,
      version: manifest.version,
      description: `Official ${manifest.name.toLowerCase()} connector manifest with local-first install metadata.`,
      installState: "available" as const,
      security: security(manifest.capabilities),
      ...signed(`market-${manifest.id}`),
      manifest: { ...manifest } as Record<string, unknown>
    })),
    ...DOMAIN_MODULES.filter((domain) => domain.id !== "general").map((domain): MarketplaceModule => ({
      id: `domain-${domain.id}`,
      kind: "domain" as const,
      name: `${domain.label} Domain`,
      version: "1.0.0",
      description: `Domain module for ${domain.label.toLowerCase()} memory behavior.`,
      installState: "available" as const,
      security: security(["enrich", ...(domain.redactionPolicy ? ["redaction-policy"] : [])]),
      ...signed(`domain-${domain.id}`),
      manifest: {
        id: domain.id,
        label: domain.label,
        retrievalWeights: domain.retrievalWeights,
        lifecyclePolicy: domain.lifecyclePolicy,
        aliases: domain.aliases,
        redactionMode: domain.redactionPolicy?.mode
      }
    })),
    {
      id: "retrieval-trust-heavy",
      kind: "retrieval_profile",
      name: "Trust Heavy Retrieval",
      version: "1.0.0",
      description: "Prioritizes high-trust and entity-linked context for production agents.",
      installState: "available",
      security: security(["retrieval-profile"]),
      ...signed("retrieval-trust-heavy"),
      manifest: { id: "trust-heavy", label: "Trust Heavy", weights: { trust: 0.36, entity: 0.24, graph: 0.14, semantic: 0.14, keyword: 0.08, temporal: 0.04 } }
    },
    {
      id: "persona-operator",
      kind: "persona",
      name: "Operator Persona",
      version: "1.0.0",
      description: "Concise summaries, private defaults, and high-trust retrieval.",
      installState: "available",
      security: security(["persona"]),
      ...signed("persona-operator"),
      manifest: { id: "operator", label: "Operator", summaryStyle: "concise", privacyDefault: "private", retrievalWeights: { trust: 0.34, graph: 0.2 } }
    }
  ];
}

export function marketplaceRisks(module: MarketplaceModule): string[] {
  const risks: string[] = [];
  if (!module.id.trim() || !module.name.trim() || !module.version.trim()) risks.push("blocked: module requires id, name and version");
  if (module.security?.status === "blocked") risks.push("blocked: security scan blocked install");
  if (!module.signature) risks.push("warning: module has no signature metadata");
  if (module.signature?.status === "invalid") risks.push("blocked: module signature is invalid");
  if (module.signature && !module.signature.digest.trim()) risks.push("blocked: module signature digest is empty");
  if (module.compatibility?.minCognibrainVersion && compareVersions(COGNIBRAIN_VERSION, module.compatibility.minCognibrainVersion) < 0) risks.push(`blocked: requires cognibrain >= ${module.compatibility.minCognibrainVersion}`);
  if (module.compatibility?.maxCognibrainVersion && compareVersions(COGNIBRAIN_VERSION, module.compatibility.maxCognibrainVersion) > 0) risks.push(`blocked: supports cognibrain <= ${module.compatibility.maxCognibrainVersion}`);
  if (!module.security?.permissions?.length) risks.push("warning: module declares no requested permissions");
  if (module.kind === "connector") {
    try {
      validateConnectorManifest(module.manifest as unknown as ConnectorManifest);
    } catch (error) {
      risks.push(`blocked: ${error instanceof Error ? error.message : "invalid connector manifest"}`);
    }
  }
  if (module.kind === "retrieval_profile" && !(module.manifest as Partial<RetrievalProfile>).weights) risks.push("blocked: retrieval profile requires weights");
  if (module.kind === "persona" && (!(module.manifest as Partial<PersonaProfile>).id || !(module.manifest as Partial<PersonaProfile>).label)) risks.push("blocked: persona requires id and label");
  if (!module.security) risks.push("warning: module has no security scan metadata");
  return risks;
}

export function securityScanFor(module: MarketplaceModule): NonNullable<MarketplaceModule["security"]> {
  const risks = marketplaceRisks({ ...module, security: { scannedAt: new Date().toISOString(), status: "passed", permissions: [], risks: [] } }).filter((risk) => risk !== "warning: module has no security scan metadata");
  return {
    scannedAt: new Date().toISOString(),
    status: risks.some((risk) => risk.startsWith("blocked:")) ? "blocked" : risks.length ? "warning" : "passed",
    permissions: module.security?.permissions?.length ? module.security.permissions : module.kind === "connector" ? ((module.manifest as Partial<ConnectorManifest>).capabilities ?? []) : [module.kind],
    risks
  };
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part) || 0);
  const rightParts = right.split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value * 10) / 10));
}

export function averageRating(reviews: MarketplaceReview[]): number | undefined {
  if (!reviews.length) return undefined;
  return reviews.reduce((sum, review) => sum + clampRating(review.rating), 0) / reviews.length;
}

export function validateConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt">): void {
  if (!input.id.trim() || !input.name.trim()) throw new Error("Connector manifest requires id and name");
  if (!input.capabilities.length) throw new Error(`Connector ${input.id} must declare at least one capability`);
  if (input.direction === "two_way" && !input.capabilities.includes("ingest")) throw new Error(`Two-way connector ${input.id} must support ingest`);
  if (input.capabilities.includes("writeback") && input.direction === "ingest") throw new Error(`Writeback connector ${input.id} must be export or two_way`);
  if (input.auth === "oauth" && !input.oauth?.authorizeUrl) throw new Error(`OAuth connector ${input.id} requires oauth.authorizeUrl`);
}
