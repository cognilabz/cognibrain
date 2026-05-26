import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { defaultService } from "../../service";
import type { ManagedMigrationBundle, Memory, MemoryPolicyOperation } from "../../../core";
import { agentSchema, auditTypeSchema, brainSchema, crossBrainPrivacyComputeSchema, keyRotationSchema, managedTenantSchema, marketplaceModuleSchema, memoryInputSchema, marketplaceReviewSchema, marketplaceSubmissionSchema, migrationExportSchema, migrationImportSchema, personaSchema, policyRuleSchema, retentionRuleSchema, sourceSchema, webhookSchema } from "../../serverSchemas";
import { json, send } from "../helpers";

type RouteContext = {
  method: string;
  url: URL;
  parts: string[];
  request: IncomingMessage;
  response: ServerResponse;
  auth?: { statusReport: Record<string, unknown> };
};

export async function handlePlatformRoutes(context: RouteContext): Promise<boolean> {
  const { method, url, parts, request, response, auth } = context;
  if (method === "GET" && url.pathname === "/brains") {
    send(response, 200, defaultService.listBrains());
    return true;
  }

  if (method === "POST" && url.pathname === "/brains") {
    send(response, 201, defaultService.createBrain(brainSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/sources") {
    send(response, 200, defaultService.listSources(url.searchParams.get("brainId") ?? undefined));
    return true;
  }

  if (method === "POST" && url.pathname === "/sources") {
    send(response, 201, defaultService.createSource(sourceSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/agents") {
    send(response, 200, defaultService.listAgents());
    return true;
  }

  if (method === "POST" && url.pathname === "/agents") {
    send(response, 201, defaultService.registerAgent(agentSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && parts[0] === "agents" && parts[1] && parts[2] === "persona") {
    const body = z.object({ personaId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.assignAgentPersona(parts[1], body.personaId));
    return true;
  }

  if (method === "GET" && url.pathname === "/personas") {
    send(response, 200, defaultService.listPersonas());
    return true;
  }

  if (method === "PUT" && url.pathname === "/personas") {
    send(response, 200, defaultService.setPersona(personaSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/events") {
    send(response, 200, defaultService.eventFeed({
      agentId: url.searchParams.get("agentId") ?? undefined,
      brainId: url.searchParams.get("brainId") ?? undefined,
      sourceId: url.searchParams.get("sourceId") ?? undefined,
      type: url.searchParams.get("type") ? auditTypeSchema.parse(url.searchParams.get("type")) : undefined
    }));
    return true;
  }

  if (method === "GET" && url.pathname === "/audit") {
    send(response, 200, defaultService.auditTrail({
      userId: url.searchParams.get("userId") ?? undefined,
      memoryId: url.searchParams.get("memoryId") ?? undefined,
      type: url.searchParams.get("type") ? auditTypeSchema.parse(url.searchParams.get("type")) : undefined
    }));
    return true;
  }

  if (method === "GET" && url.pathname === "/audit/chain") {
    send(response, 200, defaultService.auditChain({
      userId: url.searchParams.get("userId") ?? undefined,
      memoryId: url.searchParams.get("memoryId") ?? undefined,
      type: url.searchParams.get("type") ? auditTypeSchema.parse(url.searchParams.get("type")) : undefined
    }));
    return true;
  }

  if (method === "POST" && url.pathname === "/webhooks") {
    send(response, 201, defaultService.registerWebhook(webhookSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/webhooks/deliveries") {
    send(response, 200, defaultService.eventFeed().deliveries);
    return true;
  }

  if (method === "POST" && url.pathname === "/webhooks/deliver") {
    const body = z.object({ fail: z.boolean().optional(), error: z.string().optional(), real: z.boolean().optional() }).parse(await json(request));
    send(response, 202, body.real ? await defaultService.deliverWebhookQueueHttp() : defaultService.deliverWebhookQueue(() => ({ ok: body.fail !== true, error: body.error ?? "simulated delivery failure" })));
    return true;
  }

  if (method === "GET" && url.pathname === "/marketplace/submissions") {
    const status = url.searchParams.get("status") as Parameters<typeof defaultService.listMarketplaceSubmissions>[0] | null;
    send(response, 200, defaultService.listMarketplaceSubmissions(status ?? undefined));
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/submissions") {
    send(response, 202, defaultService.submitMarketplaceModule(marketplaceSubmissionSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/scan") {
    const body = z.object({ submissionId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.scanMarketplaceSubmission(body.submissionId));
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/review") {
    const body = z.object({ submissionId: z.string().min(1), review: marketplaceReviewSchema }).parse(await json(request));
    send(response, 202, defaultService.reviewMarketplaceSubmission(body.submissionId, body.review));
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/publish") {
    const body = z.object({ submissionId: z.string().min(1) }).parse(await json(request));
    send(response, 202, defaultService.publishMarketplaceSubmission(body.submissionId));
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/rate") {
    const body = z.object({ moduleId: z.string().min(1), review: marketplaceReviewSchema.pick({ reviewer: true, rating: true, comment: true }) }).parse(await json(request));
    send(response, 202, defaultService.rateMarketplaceModule(body.moduleId, body.review));
    return true;
  }

  if (method === "GET" && url.pathname === "/marketplace") {
    send(response, 200, defaultService.listMarketplaceModules());
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/install") {
    const body = (await json(request)) as Record<string, unknown>;
    if (typeof body?.id === "string" && !body.kind) {
      send(response, 202, defaultService.installMarketplaceModuleById(body.id));
    } else {
      send(response, 202, defaultService.installMarketplaceModule(marketplaceModuleSchema.parse(body)));
    }
    return true;
  }

  if (method === "POST" && url.pathname === "/marketplace/plan") {
    const body = (await json(request)) as Record<string, unknown>;
    send(response, 200, typeof body?.id === "string" && !body.kind ? defaultService.marketplaceInstallPlan(body.id) : defaultService.marketplaceInstallPlan(marketplaceModuleSchema.parse(body)));
    return true;
  }

  if (method === "GET" && (url.pathname === "/sdk/openapi" || url.pathname === "/openapi.json" || url.pathname === "/v1/openapi.json")) {
    send(response, 200, defaultService.apiDescription(auth!.statusReport as any));
    return true;
  }

  if (method === "GET" && url.pathname === "/benchmarks/trend") {
    const path = url.searchParams.get("path") ?? "artifacts/benchmark-trend.json";
    send(response, 200, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { points: [] });
    return true;
  }

  if (method === "GET" && url.pathname === "/benchmarks/leaderboard") {
    const path = url.searchParams.get("path") ?? "artifacts/leaderboard.json";
    send(response, 200, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schemaVersion: "1.0", generatedAt: new Date().toISOString(), project: "cognibrain", privacy: { anonymized: true, noRawPrompts: true, noRawEvidence: true }, entries: [], publication: { anonymized: true, claimScope: "No leaderboard artifact has been generated yet." } });
    return true;
  }

  if (method === "POST" && url.pathname === "/migration/export") {
    send(response, 202, defaultService.managedMigrationBundle(migrationExportSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/migration/import") {
    send(response, 202, defaultService.importMigrationBundle(migrationImportSchema.parse(await json(request)) as unknown as ManagedMigrationBundle));
    return true;
  }

  if (method === "POST" && url.pathname === "/backup/verify") {
    const body = await json(request).catch(() => undefined);
    send(response, 200, body ? defaultService.verifyBackupRecovery(migrationImportSchema.parse(body) as unknown as ManagedMigrationBundle) : defaultService.verifyBackupRecovery());
    return true;
  }

  if (method === "GET" && url.pathname === "/compliance") {
    send(response, 200, defaultService.complianceReport());
    return true;
  }

  if (method === "GET" && url.pathname === "/compliance/export") {
    send(response, 200, defaultService.complianceReport());
    return true;
  }

  if (method === "GET" && url.pathname === "/policy/rules") {
    send(response, 200, defaultService.listPolicyRules());
    return true;
  }

  if (method === "POST" && url.pathname === "/policy/rules") {
    send(response, 202, defaultService.setPolicyRule(policyRuleSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/policy/evaluate") {
    const body = z
      .object({
        operation: z.enum(["write", "retrieve", "dream", "export", "delete", "all"]),
        memoryId: z.string().optional(),
        input: memoryInputSchema.partial().optional(),
        actor: z.record(z.string(), z.unknown()).optional()
      })
      .parse(await json(request));
    const target = body.memoryId ? defaultService.get(body.memoryId) : body.input;
    if (!target) throw new Error("policy evaluation requires memoryId or input");
    send(response, 200, defaultService.evaluatePolicy(body.operation as MemoryPolicyOperation, target as Memory, body.actor ?? {}));
    return true;
  }

  if (method === "GET" && url.pathname === "/retention/rules") {
    send(response, 200, defaultService.listRetentionRules());
    return true;
  }

  if (method === "POST" && url.pathname === "/retention/rules") {
    send(response, 202, defaultService.setRetentionRule(retentionRuleSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/retention/enforce") {
    const body = z.object({ userId: z.string().optional(), now: z.string().optional() }).parse(await json(request));
    send(response, 202, defaultService.enforceRetention(body.now ? new Date(body.now) : new Date(), body.userId));
    return true;
  }

  if (method === "GET" && url.pathname === "/retention/review") {
    const now = url.searchParams.get("now");
    send(response, 200, defaultService.retentionReview(now ? new Date(now) : new Date(), url.searchParams.get("userId") ?? undefined));
    return true;
  }

  if (method === "GET" && url.pathname === "/security/keys") {
    send(response, 200, defaultService.securityKeyReport());
    return true;
  }

  if (method === "GET" && url.pathname === "/security/key-provider") {
    send(response, 200, defaultService.keyProviderReport());
    return true;
  }

  if (method === "GET" && url.pathname === "/security/transport") {
    send(response, 200, defaultService.transportSecurityReport());
    return true;
  }

  if (method === "POST" && url.pathname === "/security/key-rotation") {
    send(response, 202, defaultService.rotateEncryptionKeyMetadata(keyRotationSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/privacy/insights") {
    send(response, 200, defaultService.privacyInsights({
      epsilon: url.searchParams.get("epsilon") ? Number(url.searchParams.get("epsilon")) : undefined,
      kAnonymity: url.searchParams.get("k") ? Number(url.searchParams.get("k")) : undefined,
      includeExact: url.searchParams.get("includeExact") === "true"
    }));
    return true;
  }

  if (method === "POST" && url.pathname === "/privacy/cross-brain-compute") {
    send(response, 200, defaultService.privacyPreservingCrossBrainCompute(crossBrainPrivacyComputeSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/storage") {
    send(response, 200, defaultService.storageStatus());
    return true;
  }

  if (method === "GET" && url.pathname === "/managed/tenants") {
    send(response, 200, defaultService.listManagedTenants());
    return true;
  }

  if (method === "POST" && url.pathname === "/managed/tenants") {
    send(response, 201, defaultService.createManagedTenant(managedTenantSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/managed/control-plane") {
    send(response, 200, defaultService.managedControlPlaneReport());
    return true;
  }

  if (method === "GET" && url.pathname === "/providers") {
    send(response, 200, defaultService.providerStatus());
    return true;
  }

  if (method === "POST" && url.pathname === "/translate") {
    const body = z.object({ text: z.string().min(1), sourceLanguage: z.string().optional(), targetLanguage: z.string().optional() }).parse(await json(request));
    send(response, 200, defaultService.translateText(body.text, body.sourceLanguage, body.targetLanguage));
    return true;
  }

  return false;
}
