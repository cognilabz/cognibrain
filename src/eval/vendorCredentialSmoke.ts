import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

type Provider = "github" | "slack" | "discord";

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
  { provider: "discord", connectorId: "official-discord", requiredEnv: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"] }
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
        operation: item.provider === "github" ? "comment" : "summary",
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
          authorizationRedacted: !/Bearer\s+[A-Za-z0-9._-]+|Bot\s+[A-Za-z0-9._-]+/i.test(serialized),
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
  return { channel: process.env.MEMORY_DISCORD_CHANNEL_ID };
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
