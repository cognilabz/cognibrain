import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "../../service";
import { actionGuardSchema, codeCorrectionSchema, contextEnrichmentSchema, evidencePackSchema, extractSchema, extractionEventSchema, feedbackSchema, harnessActionSchema, identityLinkSchema, injectionFeedbackSchema, memoryInputSchema, offlineOperationSchema, patchEvidenceSchema, retrievalProfileSchema, searchSchema, timelineSummarySchema, trainingSampleSchema } from "../../serverSchemas";
import { json, send, serialize, serializeExtractionReport } from "../helpers";

type RouteContext = {
  method: string;
  url: URL;
  parts: string[];
  request: IncomingMessage;
  response: ServerResponse;
  auth?: { statusReport: Record<string, unknown> };
};
const memoryPatchSchema = memoryInputSchema.partial().extend({
  trust: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional()
});

export async function handleMemoryRoutes(context: RouteContext): Promise<boolean> {
  const { method, url, parts, request, response } = context;
  if (method === "GET" && url.pathname === "/profiles") {
    send(response, 200, defaultService.getRetrievalProfiles());
    return true;
  }

  if (method === "PUT" && url.pathname === "/profiles") {
    send(response, 200, defaultService.setRetrievalProfile(retrievalProfileSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/profiles/learn") {
    const body = z
      .object({
        id: z.string().optional(),
        label: z.string().optional(),
        scope: z
          .object({
            userId: z.string().optional(),
            projectId: z.string().optional(),
            appId: z.string().optional(),
            orgId: z.string().optional(),
            agentId: z.string().optional()
          })
          .optional()
      })
      .parse(await json(request));
    send(response, 202, defaultService.learnRetrievalProfile(body.id, body.label, { scope: body.scope }));
    return true;
  }

  if (method === "POST" && url.pathname === "/profiles/training-samples") {
    send(response, 201, defaultService.addTrainingSample(trainingSampleSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && url.pathname === "/conflicts") {
    const status = url.searchParams.get("status");
    const parsedStatus = status ? z.enum(["open", "resolved", "operator_review"]).parse(status) : undefined;
    send(response, 200, defaultService.listConflictSets(parsedStatus));
    return true;
  }

  if (method === "POST" && parts[0] === "conflicts" && parts[1] && parts[2] === "resolve") {
    const body = z.object({
      selectedClaimId: z.string().min(1),
      reason: z.string().min(1),
      resolvedBy: z.enum(["system", "operator", "source_revalidation"]).optional()
    }).parse(await json(request));
    send(response, 200, defaultService.resolveConflictSet(parts[1], body));
    return true;
  }

  if (method === "POST" && url.pathname === "/memories") {
    const body = memoryInputSchema.parse(await json(request));
    send(response, 201, serialize(await defaultService.addAsync(body)));
    return true;
  }

  if (method === "POST" && url.pathname === "/extract") {
    const body = extractSchema.parse(await json(request));
    const { events, ...scope } = body;
    const report = defaultService.extract(events, scope);
    send(response, 201, serializeExtractionReport(report));
    return true;
  }

  if (method === "POST" && url.pathname === "/actions") {
    send(response, 201, serialize(defaultService.recordHarnessAction(harnessActionSchema.parse(await json(request)))));
    return true;
  }

  if (method === "POST" && url.pathname === "/code/corrections") {
    send(response, 201, serialize(defaultService.recordCodeCorrection(codeCorrectionSchema.parse(await json(request)))));
    return true;
  }

  if (method === "POST" && url.pathname === "/code/action-guard") {
    send(response, 200, defaultService.guardAction(actionGuardSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/ingest/media") {
    const body = z
      .object({
        brainId: z.string().optional(),
        sourceId: z.string().optional(),
        userId: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        event: extractionEventSchema
      })
      .parse(await json(request));
    const { event, ...scope } = body;
    send(response, 201, serializeExtractionReport(defaultService.ingestMedia(event, scope)));
    return true;
  }

  if (method === "GET" && url.pathname === "/memories") {
    send(response, 200, defaultService.list(url.searchParams.get("userId") ?? undefined).map(serialize));
    return true;
  }

  if (method === "GET" && url.pathname === "/episodes") {
    send(response, 200, defaultService.listEpisodes(url.searchParams.get("userId") ?? undefined));
    return true;
  }

  if (method === "GET" && parts[0] === "episodes" && parts[1]) {
    send(response, 200, defaultService.getEpisode(parts[1]));
    return true;
  }

  if (parts[0] === "memories" && parts[1]) {
    if (method === "GET") {
      send(response, 200, serialize(defaultService.get(parts[1])));
      return true;
    }
    if (method === "PATCH") {
      send(response, 200, serialize(defaultService.update(parts[1], memoryPatchSchema.parse(await json(request)))));
      return true;
    }
    if (method === "POST" && parts[2] === "consent") {
      const body = z
        .object({
          visibility: z.enum(["private", "user", "org", "public"]).optional(),
          allowTraining: z.boolean().optional(),
          retentionUntil: z.string().optional(),
          deleteOnRequest: z.boolean().optional()
        })
        .parse(await json(request));
      send(response, 202, serialize(defaultService.updateConsent(parts[1], body)));
      return true;
    }
    if (method === "POST" && parts[2] === "revert") {
      const body = z.object({ auditEventId: z.string().optional() }).parse(await json(request));
      send(response, 202, serialize(defaultService.revertMemory(parts[1], body.auditEventId)));
      return true;
    }
    if (method === "POST" && parts[2] === "archive") {
      send(response, 202, serialize(defaultService.archive(parts[1])));
      return true;
    }
    if (method === "DELETE") {
      send(response, defaultService.delete(parts[1]) ? 204 : 404, null);
      return true;
    }
  }

  if (method === "GET" && url.pathname === "/sync/status") {
    send(response, 200, defaultService.syncStatus());
    return true;
  }

  if (method === "POST" && url.pathname === "/sync/offline-operations") {
    send(response, 201, defaultService.queueOfflineOperation(offlineOperationSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/sync/run") {
    send(response, 202, defaultService.syncOfflineOperations());
    return true;
  }

  if (method === "POST" && url.pathname === "/search") {
    const body = searchSchema.parse(await json(request));
    send(
      response,
      200,
      defaultService.search(body).map((result) => ({
        ...result,
        memory: serialize(result.memory)
      }))
    );
    return true;
  }

  if (method === "POST" && url.pathname === "/route") {
    send(response, 200, defaultService.routeMemory(searchSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/intent") {
    const body = z.object({ query: z.string().min(1) }).parse(await json(request));
    send(response, 200, defaultService.classifyQueryIntent(body.query));
    return true;
  }

  if (method === "POST" && url.pathname === "/evidence-pack") {
    send(response, 200, defaultService.evidencePack(evidencePackSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/context/enrich") {
    send(response, 200, await defaultService.enrichContext(contextEnrichmentSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/coding-context-pack") {
    send(response, 200, defaultService.codingContextPack(evidencePackSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/patch-evidence") {
    send(response, 200, defaultService.patchEvidenceTrail(patchEvidenceSchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && parts[0] === "evidence-pack" && parts[1]) {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
    return true;
  }

  if (method === "GET" && parts[0] === "context-packs" && parts[1] && parts[2] === "evidence") {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
    return true;
  }

  if (method === "GET" && parts[0] === "coding-context-packs" && parts[1]) {
    send(response, 200, defaultService.getCodingContextPack(parts[1]));
    return true;
  }

  if (method === "GET" && parts[0] === "context-packs" && parts[1]) {
    send(response, 200, defaultService.getEvidencePack(parts[1]));
    return true;
  }

  if (method === "POST" && url.pathname === "/federation/search") {
    const body = searchSchema.extend({ brainIds: z.array(z.string()).min(1) }).parse(await json(request));
    const report = defaultService.federatedSearch(body);
    send(response, 200, {
      ...report,
      results: report.results.map((result) => ({ ...result, memory: serialize(result.memory) }))
    });
    return true;
  }

  if (method === "POST" && url.pathname === "/feedback") {
    const body = feedbackSchema.parse(await json(request));
    send(response, 202, serialize(defaultService.feedback(body)));
    return true;
  }

  if (method === "POST" && url.pathname === "/feedback/injection") {
    const report = defaultService.recordInjectionFeedback(injectionFeedbackSchema.parse(await json(request)));
    send(response, 202, {
      ...report,
      updatedMemories: report.updatedMemories.map(serialize)
    });
    return true;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "promote") {
    const body = z.object({ orgId: z.string().min(1), reviewerId: z.string().optional(), note: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(body.reviewerId ? defaultService.reviewSharedMemory(parts[1], { orgId: body.orgId, reviewerId: body.reviewerId, decision: "approve", note: body.note }) : defaultService.promoteSharedMemory(parts[1], body.orgId)));
    return true;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "share-request") {
    const body = z.object({ orgId: z.string().min(1), requestedBy: z.string().optional(), note: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(defaultService.requestSharedMemory(parts[1], body.orgId, body.requestedBy, body.note)));
    return true;
  }

  if (method === "POST" && parts[0] === "memories" && parts[2] === "share-revoke") {
    const body = z.object({ actorId: z.string().optional(), reason: z.string().optional() }).parse(await json(request));
    send(response, 202, serialize(defaultService.revokeSharedMemory(parts[1], body.actorId, body.reason)));
    return true;
  }

  if (method === "POST" && url.pathname === "/identity-links") {
    const body = identityLinkSchema.parse(await json(request));
    send(response, 201, defaultService.linkIdentity(body.primaryUserId, body.linkedUserId, body.consentToken, body.consent));
    return true;
  }

  if (method === "DELETE" && parts[0] === "identity-links" && parts[1]) {
    send(response, 200, defaultService.unlinkIdentity(parts[1]));
    return true;
  }

  if (method === "GET" && parts[0] === "timeline" && parts[1]) {
    send(response, 200, defaultService.timeline(parts[1]));
    return true;
  }

  if (method === "POST" && parts[0] === "timeline" && parts[1] && parts[2] === "summarize") {
    send(response, 202, defaultService.summarizeTimeline(parts[1], timelineSummarySchema.parse(await json(request))));
    return true;
  }

  if (method === "GET" && parts[0] === "temporal" && parts[1]) {
    send(response, 200, defaultService.temporalQuery(parts[1], {
      after: url.searchParams.get("after") ?? undefined,
      before: url.searchParams.get("before") ?? undefined
    }));
    return true;
  }

  if (method === "GET" && parts[0] === "patterns" && parts[1]) {
    send(response, 200, defaultService.behavioralPatterns(parts[1]));
    return true;
  }

  if (method === "POST" && url.pathname === "/lifecycle/preview") {
    const body = z.object({ userId: z.string().min(1), policy: z.record(z.unknown()).optional() }).parse(await json(request));
    send(response, 200, defaultService.lifecyclePreview(body.userId, body.policy));
    return true;
  }

  if (method === "GET" && parts[0] === "learning" && parts[1] === "dream-policy" && parts[2]) {
    send(response, 200, defaultService.adaptiveDreamPolicy(parts[2]));
    return true;
  }

  if (method === "POST" && parts[0] === "learning" && parts[1] === "observations" && parts[2]) {
    const body = z.object({ style: z.enum(["concise", "descriptive", "narrative"]).optional(), persist: z.boolean().optional(), limit: z.number().int().positive().max(12).optional() }).parse(await json(request));
    send(response, 202, defaultService.generateObservations(parts[2], body));
    return true;
  }

  if (method === "GET" && parts[0] === "learning" && parts[1] === "predictions" && parts[2]) {
    const report = defaultService.predictionReport(parts[2], {
      query: url.searchParams.get("query") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
    });
    send(response, 200, {
      ...report,
      prefetch: report.prefetch.map((result) => ({ ...result, memory: serialize(result.memory) }))
    });
    return true;
  }

  if (method === "POST" && url.pathname === "/domain/evaluate") {
    send(response, 202, defaultService.runDomainEvaluation());
    return true;
  }

  if (method === "GET" && parts[0] === "export" && parts[1]) {
    send(response, 200, defaultService.exportUser(parts[1]).map(serialize));
    return true;
  }

  if (method === "DELETE" && parts[0] === "users" && parts[1] && parts[2] === "memories") {
    send(response, 200, { deleted: defaultService.deleteUser(parts[1]) });
    return true;
  }

  return false;
}
