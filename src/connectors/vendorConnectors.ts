import type { ConnectorManifest, ConnectorSyncRecord, MemoryExtractionEvent } from "../core";
import {
  externalVendorConfigured,
  externalVendorProvider,
  shouldUseExternalVendor,
  vendorEnv,
  type ExternalVendorListResult,
  type ExternalVendorPollResult,
  type ExternalVendorProvider,
  type ExternalVendorWritebackResult,
  type FetchLike,
  type VendorFetchResult,
  type VendorPagedFetchResult
} from "./vendorConfig";
import {
  listGitHub, pollGitHub, writeGitHub,
  listSlack, pollSlack, writeSlack,
  listDiscord, pollDiscord, writeDiscord,
  listJira, pollJira, writeJira,
  listConfluence, pollConfluence, writeConfluence,
  listNotion, pollNotion, writeNotion,
  listLinear, pollLinear, writeLinear,
  listGitLab, pollGitLab, writeGitLab,
  listAzureDevOps, pollAzureDevOps, writeAzureDevOps,
  listTeams, pollTeams, writeTeams,
  listGmail, pollGmail, writeGmail,
  listGoogleDrive, pollGoogleDrive, writeGoogleDrive,
  listGoogleCalendar, pollGoogleCalendar, writeGoogleCalendar,
  listAsana, pollAsana, writeAsana,
  listClickUp, pollClickUp, writeClickUp,
  listSentry, pollSentry, writeSentry,
  listDatadog, pollDatadog, writeDatadog,
  listPagerDuty, pollPagerDuty, writePagerDuty,
  listPostHog, pollPostHog, writePostHog
} from "./vendor/providerImplementations";
export { externalVendorConfigured, externalVendorProvider, shouldUseExternalVendor } from "./vendorConfig";

export async function listExternalVendorItems(
  manifest: ConnectorManifest,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
): Promise<ExternalVendorListResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) return { status: "failed", items: [], error: `No external vendor provider for ${manifest.id}` };
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) return { status: "failed", items: [], error: `Missing external vendor env: ${configured.missing.join(", ")}` };
  if (provider === "github") return listGitHub(fetchImpl, timeoutMs);
  if (provider === "slack") return listSlack(fetchImpl, timeoutMs);
  if (provider === "discord") return listDiscord(fetchImpl, timeoutMs);
  if (provider === "jira") return listJira(fetchImpl, timeoutMs);
  if (provider === "confluence") return listConfluence(fetchImpl, timeoutMs);
  if (provider === "notion") return listNotion(fetchImpl, timeoutMs);
  if (provider === "linear") return listLinear(fetchImpl, timeoutMs);
  if (provider === "gitlab") return listGitLab(fetchImpl, timeoutMs);
  if (provider === "azure-devops") return listAzureDevOps(fetchImpl, timeoutMs);
  if (provider === "teams") return listTeams(fetchImpl, timeoutMs);
  if (provider === "gmail") return listGmail(fetchImpl, timeoutMs);
  if (provider === "google-drive") return listGoogleDrive(fetchImpl, timeoutMs);
  if (provider === "google-calendar") return listGoogleCalendar(fetchImpl, timeoutMs);
  if (provider === "asana") return listAsana(fetchImpl, timeoutMs);
  if (provider === "clickup") return listClickUp(fetchImpl, timeoutMs);
  if (provider === "sentry") return listSentry(fetchImpl, timeoutMs);
  if (provider === "datadog") return listDatadog(fetchImpl, timeoutMs);
  if (provider === "pagerduty") return listPagerDuty(fetchImpl, timeoutMs);
  return listPostHog(fetchImpl, timeoutMs);
}

export async function pollExternalVendorConnector(
  manifest: ConnectorManifest,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
): Promise<ExternalVendorPollResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) return { status: "failed", events: [], error: `No external vendor provider for ${manifest.id}` };
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) return { status: "failed", events: [], error: `Missing external vendor env: ${configured.missing.join(", ")}` };
  if (provider === "github") return pollGitHub(fetchImpl, timeoutMs);
  if (provider === "slack") return pollSlack(fetchImpl, timeoutMs);
  if (provider === "discord") return pollDiscord(fetchImpl, timeoutMs);
  if (provider === "jira") return pollJira(fetchImpl, timeoutMs);
  if (provider === "confluence") return pollConfluence(fetchImpl, timeoutMs);
  if (provider === "notion") return pollNotion(fetchImpl, timeoutMs);
  if (provider === "linear") return pollLinear(fetchImpl, timeoutMs);
  if (provider === "gitlab") return pollGitLab(fetchImpl, timeoutMs);
  if (provider === "azure-devops") return pollAzureDevOps(fetchImpl, timeoutMs);
  if (provider === "teams") return pollTeams(fetchImpl, timeoutMs);
  if (provider === "gmail") return pollGmail(fetchImpl, timeoutMs);
  if (provider === "google-drive") return pollGoogleDrive(fetchImpl, timeoutMs);
  if (provider === "google-calendar") return pollGoogleCalendar(fetchImpl, timeoutMs);
  if (provider === "asana") return pollAsana(fetchImpl, timeoutMs);
  if (provider === "clickup") return pollClickUp(fetchImpl, timeoutMs);
  if (provider === "sentry") return pollSentry(fetchImpl, timeoutMs);
  if (provider === "datadog") return pollDatadog(fetchImpl, timeoutMs);
  if (provider === "pagerduty") return pollPagerDuty(fetchImpl, timeoutMs);
  return pollPostHog(fetchImpl, timeoutMs);
}

export async function writebackExternalVendorConnector(
  manifest: ConnectorManifest,
  record: ConnectorSyncRecord,
  fetchImpl: FetchLike = fetch,
  timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
  dryRun = false
): Promise<ExternalVendorWritebackResult> {
  const provider = externalVendorProvider(manifest);
  if (!provider) throw new Error(`No external vendor provider for ${manifest.id}`);
  const configured = externalVendorConfigured(provider);
  if (!configured.configured) {
    return {
      status: "failed",
      request: { method: "POST", url: `vendor://${provider}/writeback`, headers: {}, body: JSON.stringify(record.payload ?? {}) },
      error: `Missing external vendor env: ${configured.missing.join(", ")}`
    };
  }
  if (provider === "github") return writeGitHub(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "slack") return writeSlack(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "discord") return writeDiscord(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "jira") return writeJira(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "confluence") return writeConfluence(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "notion") return writeNotion(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "linear") return writeLinear(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "gitlab") return writeGitLab(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "azure-devops") return writeAzureDevOps(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "teams") return writeTeams(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "gmail") return writeGmail(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "google-drive") return writeGoogleDrive(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "google-calendar") return writeGoogleCalendar(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "asana") return writeAsana(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "clickup") return writeClickUp(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "sentry") return writeSentry(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "datadog") return writeDatadog(record, fetchImpl, timeoutMs, dryRun);
  if (provider === "pagerduty") return writePagerDuty(record, fetchImpl, timeoutMs, dryRun);
  return writePostHog(record, fetchImpl, timeoutMs, dryRun);
}

