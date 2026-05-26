import type { ContextEnrichmentReport, ExternalContextEvidence } from "../../core";
import type { ContextEnrichmentInput } from "../service";
import { buildEnrichedContext, contextConnectorPlan, dedupeExternalEvidence, detectContextReferences, rankContextItems } from "./context";
import { contentHash } from "./helpers";

export async function enrichContext(service: any, input: ContextEnrichmentInput, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ContextEnrichmentReport> {
    const tokenBudget = input.tokenBudget ?? 1200;
    const localEvidence = service.evidencePack({ ...input, limit: input.limit ?? 8, tokenBudget: Math.max(300, Math.floor(tokenBudget * 0.55)) });
    const references = detectContextReferences(input.query);
    const connectorPlan = contextConnectorPlan(input, references);
    const maxFetches = Math.max(0, input.maxExternalFetches ?? Number(process.env.MEMORY_CONTEXT_MAX_FETCHES ?? 6));
    const maxExternalResults = Math.max(1, input.maxExternalResults ?? Number(process.env.MEMORY_CONTEXT_MAX_RESULTS ?? 8));
    const warnings: string[] = [];
    const searchedConnectors: ContextEnrichmentReport["searchedConnectors"] = [];
    const externalEvidence: ExternalContextEvidence[] = [];
    const plans = connectorPlan.slice(0, maxFetches);

    for (const plan of plans) {
      const manifest = service.connectorManifests.get(plan.connectorId);
      if (!manifest?.list?.endpoint) {
        searchedConnectors.push({ connectorId: plan.connectorId, reason: plan.reason, status: "skipped", error: "connector has no list endpoint" });
        continue;
      }
      try {
        const listed = await service.listConnectorItems(plan.connectorId, fetchImpl, timeoutMs);
        searchedConnectors.push({ connectorId: plan.connectorId, reason: plan.reason, status: listed.status, items: listed.items.length, error: listed.error });
        if (listed.status === "failed") {
          warnings.push(`${plan.connectorId}: ${listed.error ?? "list failed"}`);
          continue;
        }
        externalEvidence.push(...rankContextItems({
          query: input.query,
          connectorId: plan.connectorId,
          source: plan.source,
          reference: plan.reference,
          items: listed.items,
          maxResults: maxExternalResults
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "context connector search failed";
        searchedConnectors.push({ connectorId: plan.connectorId, reason: plan.reason, status: "failed", error: message });
        warnings.push(`${plan.connectorId}: ${message}`);
      }
    }

    const dedupedExternal = dedupeExternalEvidence(externalEvidence)
      .sort((a: ExternalContextEvidence, b: ExternalContextEvidence) => b.score - a.score)
      .slice(0, maxExternalResults);
    let persistedExternalItems = 0;
    if (input.persistFetched) {
      for (const item of dedupedExternal) {
        service.add({
          userId: input.userId,
          brainId: input.brainId,
          sourceId: input.sourceId,
          agentId: input.agentId,
          sessionId: input.sessionId,
          appId: input.appId,
          orgId: input.orgId,
          projectId: input.projectId,
          content: `${item.title}: ${item.content}`,
          type: "reference",
          layer: "working",
          tags: ["context-enrichment", item.connectorId],
          source: { kind: "import", uri: item.uri, confidence: 0.82 },
          metadata: {
            connectorId: item.connectorId,
            externalId: item.externalId,
            reference: item.reference,
            contextEnrichment: true,
            evidenceId: item.id
          }
        });
        persistedExternalItems += 1;
      }
    }

    const context = buildEnrichedContext(localEvidence.context, dedupedExternal, tokenBudget);
    const id = `ctx_enrich_${contentHash(JSON.stringify({
      userId: input.userId,
      query: input.query,
      local: localEvidence.id,
      external: dedupedExternal.map((item: ExternalContextEvidence) => item.id)
    })).slice(2, 14)}`;
    const report: ContextEnrichmentReport = {
      schemaVersion: "1.0",
      id,
      generatedAt: new Date().toISOString(),
      query: input.query,
      userId: input.userId,
      references,
      localEvidence,
      externalEvidence: dedupedExternal,
      searchedConnectors,
      context,
      warnings,
      summary: {
        localMemories: localEvidence.results.length,
        externalItems: dedupedExternal.length,
        referencesDetected: references.length,
        persistedExternalItems
      }
    };
    service.recordAudit("search.run", {
      userId: input.userId,
      brainId: input.brainId,
      sourceId: input.sourceId,
      metadata: {
        resource: "context-enrichment",
        contextPackId: id,
        query: input.query,
        localMemories: report.summary.localMemories,
        externalItems: report.summary.externalItems,
        references: report.summary.referencesDetected,
        searchedConnectors: searchedConnectors.map((item) => item.connectorId)
      }
    });
    service.persist();
    return report;
  }
