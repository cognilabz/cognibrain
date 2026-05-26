import { readFileSync } from "node:fs";
import type { MemoryService } from "../../api/service";
import { buildLeaderboardArtifact } from "../../eval/leaderboard";
import { runNextgenBenchmarkSuites } from "../../eval/nextgenBenchmarks";
import {
  codebaseScopeFromEnv,
  csvList,
  engineeringKindFromEnv,
  fail,
  graphExplainStrategyFromEnv,
  isFeedbackKind,
  managedPlanFromEnv,
  managedTenantStatusFromEnv,
  metadataFromEnv,
  observationStyleFromEnv,
  optionValue,
  permissionsFromEnv,
  privacyComputeDimensionsFromEnv,
  privacyDefaultFromEnv,
  relationTypesFromEnv,
  retrievalModeFromEnv,
  searchFiltersFromEnv,
  summaryStyleFromEnv
} from "./env";

type CommandContext = { service: MemoryService; userId: string };

export async function handleGovernanceCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "compliance": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
    return true;
  }
  case "compliance-export": {
    console.log(JSON.stringify(service.complianceReport(), null, 2));
    return true;
  }
  case "policy-rules": {
    console.log(JSON.stringify(service.listPolicyRules(), null, 2));
    return true;
  }
  case "policy-rule": {
    const [label, effect, operations, scopeJson] = args;
    if (!label || (effect !== "allow" && effect !== "deny") || !operations) fail("Usage: memctl policy-rule <label> <allow|deny> <operation[,operation]> [scope-json]");
    console.log(JSON.stringify(service.setPolicyRule({
      label,
      effect,
      operations: operations.split(",").map((item) => item.trim()).filter(Boolean) as Array<"write" | "retrieve" | "dream" | "export" | "delete" | "all">,
      scope: scopeJson ? JSON.parse(scopeJson) : undefined,
      priority: process.env.MEMORY_POLICY_PRIORITY ? Number(process.env.MEMORY_POLICY_PRIORITY) : undefined,
      reason: process.env.MEMORY_POLICY_REASON
    }), null, 2));
    return true;
  }
  case "policy-evaluate": {
    const [operation, memoryId] = args;
    if (!operation || !memoryId) fail("Usage: memctl policy-evaluate <write|retrieve|dream|export|delete> <memory-id>");
    console.log(JSON.stringify(service.evaluatePolicy(operation as "write" | "retrieve" | "dream" | "export" | "delete", service.get(memoryId), { userId }), null, 2));
    return true;
  }
  case "retention-rule": {
    const [label, days, action, scopeJson] = args;
    if (!label || !days || !action) fail("Usage: memctl retention-rule <label> <retention-days> <archive|delete> [scope-json]");
    if (action !== "archive" && action !== "delete") fail(`Unsupported retention action: ${action}`);
    console.log(JSON.stringify(service.setRetentionRule({ label, retentionDays: Number(days), action, scope: scopeJson ? JSON.parse(scopeJson) : undefined }), null, 2));
    return true;
  }
  case "retention-rules": {
    console.log(JSON.stringify(service.listRetentionRules(), null, 2));
    return true;
  }
  case "retention-enforce": {
    console.log(JSON.stringify(service.enforceRetention(args[0] ? new Date(args[0]) : new Date(), process.env.MEMORY_RETENTION_USER_ID ?? userId), null, 2));
    return true;
  }
  case "retention-review": {
    console.log(JSON.stringify(service.retentionReview(args[0] ? new Date(args[0]) : new Date(), process.env.MEMORY_RETENTION_USER_ID ?? userId), null, 2));
    return true;
  }
  case "key-report": {
    console.log(JSON.stringify(service.securityKeyReport(), null, 2));
    return true;
  }
  case "key-provider": {
    console.log(JSON.stringify(service.keyProviderReport(), null, 2));
    return true;
  }
  case "key-rotate": {
    const [keyId, keyVersion, backupRef] = args;
    if (!keyId || !keyVersion) fail("Usage: memctl key-rotate <key-id> <key-version> [backup-ref]");
    console.log(JSON.stringify(service.rotateEncryptionKeyMetadata({ keyId, keyVersion, backupRef, actorId: process.env.MEMORY_AGENT_ID ?? userId }), null, 2));
    return true;
  }
  case "privacy-insights": {
    console.log(JSON.stringify(service.privacyInsights({ epsilon: args[0] ? Number(args[0]) : undefined, kAnonymity: args[1] ? Number(args[1]) : undefined, includeExact: process.env.MEMORY_PRIVACY_INCLUDE_EXACT === "true" }), null, 2));
    return true;
  }
  case "privacy-cross-brain": {
    const brainIds = args.length ? args : csvList(process.env.MEMORY_BRAIN_IDS);
    if (brainIds.length < 2) fail("Usage: memctl privacy-cross-brain <brain-id> <brain-id> [...]");
    console.log(JSON.stringify(service.privacyPreservingCrossBrainCompute({
      brainIds,
      salt: process.env.MEMORY_PRIVACY_COMPUTE_SALT,
      minK: process.env.MEMORY_PRIVACY_COMPUTE_MIN_K ? Number(process.env.MEMORY_PRIVACY_COMPUTE_MIN_K) : undefined,
      dimensions: privacyComputeDimensionsFromEnv()
    }), null, 2));
    return true;
  }
  case "storage": {
    console.log(JSON.stringify(service.storageStatus(), null, 2));
    return true;
  }
  case "marketplace": {
    console.log(JSON.stringify(service.listMarketplaceModules(), null, 2));
    return true;
  }
  case "marketplace-plan": {
    const id = args[0];
    if (!id) fail("Usage: memctl marketplace-plan <module-id>");
    console.log(JSON.stringify(service.marketplaceInstallPlan(id), null, 2));
    return true;
  }
  case "marketplace-install": {
    const idOrJson = args[0];
    if (!idOrJson) fail("Usage: memctl marketplace-install <module-id|module-json>");
    const module = idOrJson.trim().startsWith("{") ? service.installMarketplaceModule(JSON.parse(idOrJson)) : service.installMarketplaceModuleById(idOrJson);
    console.log(JSON.stringify(module, null, 2));
    return true;
  }

  case "marketplace-submit": {
    const [submitter, moduleJson, sourceUrl] = args;
    if (!submitter || !moduleJson) fail("Usage: memctl marketplace-submit <submitter> '<module-json>' [source-url]");
    console.log(JSON.stringify(service.submitMarketplaceModule({ submitter, module: JSON.parse(moduleJson), sourceUrl }), null, 2));
    return true;
  }

  case "marketplace-submissions": {
    console.log(JSON.stringify(service.listMarketplaceSubmissions(args[0] as Parameters<typeof service.listMarketplaceSubmissions>[0]), null, 2));
    return true;
  }

  case "marketplace-scan": {
    const submissionId = args[0];
    if (!submissionId) fail("Usage: memctl marketplace-scan <submission-id>");
    console.log(JSON.stringify(service.scanMarketplaceSubmission(submissionId), null, 2));
    return true;
  }

  case "marketplace-review": {
    const [submissionId, reviewer, rating, ...commentParts] = args;
    if (!submissionId || !reviewer || !rating) fail("Usage: memctl marketplace-review <submission-id> <reviewer> <rating> [comment]");
    console.log(JSON.stringify(service.reviewMarketplaceSubmission(submissionId, { reviewer, rating: Number(rating), comment: commentParts.join(" ") || undefined, approve: process.env.MEMORY_MARKETPLACE_APPROVE !== "false" }), null, 2));
    return true;
  }

  case "marketplace-publish": {
    const submissionId = args[0];
    if (!submissionId) fail("Usage: memctl marketplace-publish <submission-id>");
    console.log(JSON.stringify(service.publishMarketplaceSubmission(submissionId), null, 2));
    return true;
  }

  case "marketplace-rate": {
    const [moduleId, reviewer, rating, ...commentParts] = args;
    if (!moduleId || !reviewer || !rating) fail("Usage: memctl marketplace-rate <module-id> <reviewer> <rating> [comment]");
    console.log(JSON.stringify(service.rateMarketplaceModule(moduleId, { reviewer, rating: Number(rating), comment: commentParts.join(" ") || undefined }), null, 2));
    return true;
  }
  case "api-spec": {
    console.log(JSON.stringify(service.apiDescription(), null, 2));
    return true;
  }
  case "migration-export": {
    const target = args[0] === "self_hosted" || args[0] === "managed" || args[0] === "backup" ? args[0] : undefined;
    console.log(JSON.stringify(service.managedMigrationBundle({ target, backupRef: process.env.MEMORY_BACKUP_REF, ssoProvider: process.env.MEMORY_SSO_PROVIDER, secretManager: process.env.MEMORY_SECRET_MANAGER }), null, 2));
    return true;
  }
  case "managed-tenant-create": {
    const [name, orgId] = args;
    if (!name || !orgId) fail("Usage: memctl managed-tenant-create <name> <org-id>");
    console.log(JSON.stringify(service.createManagedTenant({
      name,
      orgId,
      plan: managedPlanFromEnv(),
      region: process.env.MEMORY_REGION,
      status: managedTenantStatusFromEnv(),
      ssoProvider: process.env.MEMORY_SSO_PROVIDER,
      secretManager: process.env.MEMORY_SECRET_MANAGER,
      dataResidency: process.env.MEMORY_DATA_RESIDENCY,
      backup: {
        enabled: process.env.MEMORY_BACKUP_ENABLED !== "false" && Boolean(process.env.MEMORY_BACKUP_REF),
        backupRef: process.env.MEMORY_BACKUP_REF
      }
    }), null, 2));
    return true;
  }
  case "managed-tenants": {
    console.log(JSON.stringify(service.listManagedTenants(), null, 2));
    return true;
  }
  case "managed-control-plane": {
    console.log(JSON.stringify(service.managedControlPlaneReport(), null, 2));
    return true;
  }
  case "migration-import": {
    const path = args[0];
    if (!path) fail("Usage: memctl migration-import <bundle-json-path>");
    console.log(JSON.stringify(service.importMigrationBundle(JSON.parse(readFileSync(path, "utf8"))), null, 2));
    return true;
  }
  case "backup-verify": {
    const path = args[0];
    const bundle = path ? JSON.parse(readFileSync(path, "utf8")) : undefined;
    console.log(JSON.stringify(service.verifyBackupRecovery(bundle), null, 2));
    return true;
  }
  case "transport-security": {
    console.log(JSON.stringify(service.transportSecurityReport(), null, 2));
    return true;
  }
  }
  return false;
}
