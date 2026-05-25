import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

type Provider =
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

interface ProviderSmoke {
  provider: Provider;
  connectorId: string;
  configured: boolean;
  skipped: boolean;
  checks: Record<string, boolean>;
  error?: string;
}

interface VendorCredentialSmokeReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "credential_smoke";
  liveRequested: boolean;
  writebackEnabled: boolean;
  providers: ProviderSmoke[];
  passed: boolean;
}

const providers: Array<{ provider: Provider; connectorId: string; requiredEnv: string[] }> = [
  { provider: "github", connectorId: "official-github", requiredEnv: ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"] },
  { provider: "slack", connectorId: "official-slack", requiredEnv: ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"] },
  { provider: "discord", connectorId: "official-discord", requiredEnv: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"] },
  { provider: "jira", connectorId: "official-jira", requiredEnv: ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"] },
  { provider: "confluence", connectorId: "official-confluence", requiredEnv: ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"] },
  { provider: "notion", connectorId: "official-notion", requiredEnv: ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"] },
  { provider: "linear", connectorId: "official-linear", requiredEnv: ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"] },
  { provider: "gitlab", connectorId: "official-gitlab", requiredEnv: ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"] },
  { provider: "azure-devops", connectorId: "official-azure-devops", requiredEnv: ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"] },
  { provider: "teams", connectorId: "official-microsoft-teams", requiredEnv: ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"] },
  { provider: "gmail", connectorId: "official-gmail", requiredEnv: ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"] },
  { provider: "google-drive", connectorId: "official-google-drive", requiredEnv: ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"] },
  { provider: "google-calendar", connectorId: "official-google-calendar", requiredEnv: ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"] },
  { provider: "asana", connectorId: "official-asana", requiredEnv: ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"] },
  { provider: "clickup", connectorId: "official-clickup", requiredEnv: ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"] },
  { provider: "sentry", connectorId: "official-sentry", requiredEnv: ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"] },
  { provider: "datadog", connectorId: "official-datadog", requiredEnv: ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"] },
  { provider: "pagerduty", connectorId: "official-pagerduty", requiredEnv: ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"] },
  { provider: "posthog", connectorId: "official-posthog", requiredEnv: ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"] }
];

export async function runVendorCredentialSmoke(options: { out?: string; live?: boolean; writeback?: boolean } = {}): Promise<VendorCredentialSmokeReport> {
  const service = new MemoryService();
  const liveRequested = options.live === true || process.env.MEMORY_VENDOR_LIVE_SMOKE === "true";
  const writebackEnabled = options.writeback === true || process.env.MEMORY_VENDOR_LIVE_WRITE === "true";
  const results: ProviderSmoke[] = [];

  for (const item of providers) {
    const configured = item.requiredEnv.every((name) => Boolean(process.env[name]));
    if (!liveRequested || !configured) {
      results.push({
        provider: item.provider,
        connectorId: item.connectorId,
        configured,
        skipped: true,
        checks: {
          credentialsPresent: configured,
          liveSmokeOptedIn: liveRequested,
          noNetworkWithoutOptIn: !liveRequested
        }
      });
      continue;
    }

    try {
      const listed = await service.listConnectorItems(item.connectorId);
      const polled = await service.pollConnector(item.connectorId, {
        userId: "vendor-live",
        orgId: process.env.MEMORY_ORG_ID ?? "self-hosted",
        projectId: process.env.MEMORY_PROJECT_ID ?? "cognibrain"
      });
      const beforeWriteback = service.listConnectorSyncRecords().length;
      const writeback = await service.writebackConnector(item.connectorId, {
        operation: ["github", "jira", "confluence", "notion", "linear", "gitlab", "azure-devops", "asana", "clickup", "sentry", "pagerduty"].includes(item.provider) ? "comment" : "summary",
        content: "cognibrain self-hosted connector smoke: dry-run memory-linked writeback.",
        target: liveTarget(item.provider),
        dryRun: !writebackEnabled
      });
      const records = service.listConnectorSyncRecords();
      const serialized = JSON.stringify(records);
      results.push({
        provider: item.provider,
        connectorId: item.connectorId,
        configured,
        skipped: false,
        checks: {
          listApplied: listed.status === "applied",
          pollApplied: polled.status === "applied",
          writebackSafe: writebackEnabled ? writeback.status === "applied" : writeback.status === "queued" && records.length === beforeWriteback,
          authorizationRedacted: !/Bearer\s+[A-Za-z0-9._-]+|Bot\s+[A-Za-z0-9._-]+|Basic\s+[A-Za-z0-9+/=]+/i.test(serialized),
          noPlainTokenRetained: item.requiredEnv.every((name) => {
            const value = process.env[name];
            return !value || !serialized.includes(value);
          })
        }
      });
    } catch (error) {
      results.push({
        provider: item.provider,
        connectorId: item.connectorId,
        configured,
        skipped: false,
        checks: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const attempted = results.filter((item) => !item.skipped);
  const passed = liveRequested
    ? attempted.length > 0 && attempted.every((item) => Object.values(item.checks).every(Boolean))
    : results.every((item) => item.skipped);
  const report: VendorCredentialSmokeReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "credential_smoke",
    liveRequested,
    writebackEnabled,
    providers: results,
    passed
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function liveTarget(provider: Provider): Record<string, unknown> {
  if (provider === "github") {
    return {
      repo: process.env.MEMORY_GITHUB_REPO,
      pullRequest: Number(process.env.MEMORY_GITHUB_PR ?? 0) || undefined,
      issue: Number(process.env.MEMORY_GITHUB_ISSUE ?? 0) || undefined
    };
  }
  if (provider === "slack") {
    return { channel: process.env.MEMORY_SLACK_CHANNEL_ID, threadId: process.env.MEMORY_SLACK_THREAD_ID };
  }
  if (provider === "discord") return { channel: process.env.MEMORY_DISCORD_CHANNEL_ID };
  if (provider === "jira") return { issueKey: process.env.MEMORY_JIRA_ISSUE_KEY ?? process.env.MEMORY_JIRA_ISSUE ?? "DRY-RUN" };
  if (provider === "confluence") return { pageId: process.env.MEMORY_CONFLUENCE_PAGE_ID ?? "DRY-RUN" };
  if (provider === "notion") return { blockId: process.env.MEMORY_NOTION_BLOCK_ID ?? process.env.MEMORY_NOTION_PAGE_ID ?? "DRY-RUN" };
  if (provider === "linear") return { issueId: process.env.MEMORY_LINEAR_ISSUE_ID ?? "DRY-RUN" };
  if (provider === "gitlab") return { mergeRequestIid: process.env.MEMORY_GITLAB_MR_IID ?? "DRY-RUN" };
  if (provider === "azure-devops") return { repositoryId: process.env.MEMORY_AZURE_DEVOPS_REPOSITORY_ID ?? "DRY-RUN", pullRequestId: process.env.MEMORY_AZURE_DEVOPS_PR_ID ?? "DRY-RUN" };
  if (provider === "teams") return { channel: process.env.MEMORY_TEAMS_CHANNEL_ID };
  if (provider === "gmail") return { messageId: process.env.MEMORY_GMAIL_MESSAGE_ID ?? "DRY-RUN" };
  if (provider === "google-drive") return { fileId: process.env.MEMORY_GOOGLE_DRIVE_FILE_ID ?? "DRY-RUN" };
  if (provider === "google-calendar") return { eventId: process.env.MEMORY_GOOGLE_CALENDAR_EVENT_ID ?? "DRY-RUN" };
  if (provider === "asana") return { taskId: process.env.MEMORY_ASANA_TASK_ID ?? "DRY-RUN" };
  if (provider === "clickup") return { taskId: process.env.MEMORY_CLICKUP_TASK_ID ?? "DRY-RUN" };
  if (provider === "sentry") return { issueId: process.env.MEMORY_SENTRY_ISSUE_ID ?? "DRY-RUN" };
  if (provider === "datadog") return { tags: ["cognibrain:dry-run"] };
  if (provider === "pagerduty") return { incidentId: process.env.MEMORY_PAGERDUTY_INCIDENT_ID ?? "DRY-RUN" };
  return { flagId: process.env.MEMORY_POSTHOG_FLAG_ID ?? "DRY-RUN" };
}

function cliOptions(argv: string[]): { out?: string; live?: boolean; writeback?: boolean } {
  const outIndex = argv.indexOf("--out");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/vendor-live-smoke.json",
    live: argv.includes("--live"),
    writeback: argv.includes("--writeback")
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVendorCredentialSmoke(cliOptions(process.argv.slice(2)))
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
