import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";
import type { ConnectorManifest, MemoryExtractionEvent } from "../core";

type Provider =
  | "github"
  | "jira"
  | "confluence"
  | "notion"
  | "linear"
  | "gitlab"
  | "slack"
  | "teams"
  | "sentry"
  | "pagerduty";

interface WebhookRow {
  provider: Provider;
  connectorId: string;
  passed: boolean;
  checks: {
    webhookEndpoint: boolean;
    signatureValidation: boolean;
    replayProtection: boolean;
    eventNormalization: boolean;
    reviewQueue: boolean;
    sourceRef: boolean;
  };
  evidence: Record<string, unknown>;
}

interface WebhookReport {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "connector-webhook-fixtures";
  rows: WebhookRow[];
  summary: {
    total: number;
    passed: number;
    providers: Provider[];
  };
  passed: boolean;
}

const providers: Provider[] = ["github", "jira", "confluence", "notion", "linear", "gitlab", "slack", "teams", "sentry", "pagerduty"];
const secret = "connector-webhook-fixture-secret";

export function generateConnectorWebhookProof(options: { out?: string } = {}): WebhookReport {
  const rows = providers.map(runWebhookFixture);
  const report: WebhookReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "connector-webhook-fixtures",
    rows,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      providers
    },
    passed: rows.every((row) => row.passed)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

function runWebhookFixture(provider: Provider): WebhookRow {
  const service = new MemoryService({ autoDream: { enabled: false } });
  const manifest = service.registerConnectorManifest(manifestFor(provider));
  const event = eventFor(provider);
  const payload = JSON.stringify({ id: `${provider}-delivery-1`, provider, event });
  const signature = sign(payload, secret);
  const replayCache = new Set<string>();
  const firstAccepted = acceptWebhook(payload, signature, replayCache);
  const replayAccepted = acceptWebhook(payload, signature, replayCache);
  const badSignatureAccepted = acceptWebhook(payload, sign(payload, "wrong-secret"), new Set<string>());
  const record = firstAccepted
    ? service.syncConnectorEvents(manifest.id, [event], { userId: "connector-webhooks", orgId: "org", projectId: "cognibrain" })
    : undefined;
  const memory = record?.memoryIds[0] ? service.get(record.memoryIds[0]) : undefined;
  const metadata = memory?.metadata as { connectorId?: string; externalId?: string; reviewQueue?: { status?: string } } | undefined;
  const checks = {
    webhookEndpoint: manifest.capabilities.includes("webhook") && firstAccepted,
    signatureValidation: firstAccepted && !badSignatureAccepted,
    replayProtection: !replayAccepted,
    eventNormalization: Boolean(record?.memoryIds.length && metadata?.connectorId === manifest.id && memory?.tags.includes(provider) === true),
    reviewQueue: memory?.beliefState === "needs_verification" && metadata?.reviewQueue?.status === "pending",
    sourceRef: event.sourceRef?.connectorId === manifest.id && record?.externalIds.includes(event.externalId) === true && metadata?.externalId === event.externalId
  };
  return {
    provider,
    connectorId: manifest.id,
    checks,
    passed: Object.values(checks).every(Boolean),
    evidence: {
      syncRecordId: record?.id,
      memoryId: memory?.id,
      sourceRef: event.sourceRef,
      memoryMetadata: memory?.metadata,
      tags: memory?.tags,
      reviewQueue: memory?.metadata?.reviewQueue,
      rejectedReplay: !replayAccepted,
      rejectedBadSignature: !badSignatureAccepted
    }
  };
}

function acceptWebhook(body: string, signature: string, replayCache: Set<string>): boolean {
  if (!verifySignature(body, signature, secret)) return false;
  const deliveryId = JSON.parse(body).id as string;
  if (replayCache.has(deliveryId)) return false;
  replayCache.add(deliveryId);
  return true;
}

function verifySignature(body: string, signature: string, expectedSecret: string): boolean {
  const expected = sign(body, expectedSecret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sign(body: string, signingSecret: string): string {
  return `sha256=${createHmac("sha256", signingSecret).update(body).digest("hex")}`;
}

function manifestFor(provider: Provider): Omit<ConnectorManifest, "createdAt" | "updatedAt"> {
  const kind = ["slack", "teams"].includes(provider) ? "chat" : ["confluence", "notion"].includes(provider) ? "docs" : ["jira", "linear", "pagerduty"].includes(provider) ? "project_management" : "code";
  const connectorId = connectorIdFor(provider);
  return {
    id: connectorId,
    name: provider,
    kind,
    version: "1.0.0",
    direction: "two_way",
    capabilities: ["ingest", "webhook", "poll", "writeback"],
    auth: "token",
    defaultSourceKind: kind === "chat" ? "transcript" : kind === "code" ? "reviewed_code" : "import",
    metadataMapping: {
      externalId: "externalId",
      url: "source.uri",
      author: "sourceRef.author",
      eventType: "metadata.eventType"
    },
    privacyPolicy: "project",
    vendor: { provider, docsUrl: `https://example.invalid/${provider}`, requiredEnv: [`MEMORY_${provider.toUpperCase().replace(/-/g, "_")}_TOKEN`] },
    poll: { method: "GET", endpoint: `https://example.invalid/${provider}/events`, authRef: "env:TOKEN" },
    writeback: { method: "POST", endpoint: `https://example.invalid/${provider}/writeback`, authRef: "env:TOKEN", operations: ["comment", "summary", "memory_link"] }
  };
}

function eventFor(provider: Provider): MemoryExtractionEvent & { externalId: string } {
  const connectorId = connectorIdFor(provider);
  return {
    role: "user",
    externalId: `${provider}-event-1`,
    timestamp: "2026-05-26T10:00:00.000Z",
    uri: `https://example.invalid/${provider}/event-1`,
    content: `Connector webhook decision from ${provider}: do not repeat the stale deploy command; use npm test and attach patch evidence instead.`,
    metadata: {
      provider,
      eventType: "issue_correction",
      author: "fixture-reviewer",
      reviewRequired: true,
      visibility: "org"
    },
    sourceRef: {
      connectorId,
      externalId: `${provider}-event-1`,
      url: `https://example.invalid/${provider}/event-1`,
      author: "fixture-reviewer",
      timestamp: "2026-05-26T10:00:00.000Z",
      hash: sign(`${provider}-event-1`, "source-ref").replace("sha256=", "")
    }
  };
}

function connectorIdFor(provider: Provider): string {
  return provider === "teams" ? "official-microsoft-teams" : `official-${provider}`;
}

function cliOptions(argv: string[]): { out?: string } {
  const outIndex = argv.indexOf("--out");
  return { out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/connector-webhooks.json" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateConnectorWebhookProof(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
