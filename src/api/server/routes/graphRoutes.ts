import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { defaultService } from "../../service";
import { entityEnrichmentSchema, entityMergeSchema, inferenceRuleSchema } from "../../serverSchemas";
import { json, parseRelationTypes, send, sendText, sourceKind } from "../helpers";

type RouteContext = {
  method: string;
  url: URL;
  parts: string[];
  request: IncomingMessage;
  response: ServerResponse;
  auth?: { statusReport: Record<string, unknown> };
};

export async function handleGraphRoutes(context: RouteContext): Promise<boolean> {
  const { method, url, parts, request, response } = context;
  if (method === "GET" && url.pathname === "/graph") {
    send(response, 200, defaultService.graph(url.searchParams.get("userId") ?? undefined));
    return true;
  }

  if (method === "GET" && url.pathname === "/entities") {
    send(response, 200, defaultService.entityCatalog(url.searchParams.get("userId") ?? undefined));
    return true;
  }

  if (method === "POST" && url.pathname === "/entities/enrich") {
    send(response, 202, defaultService.runEntityEnrichment(entityEnrichmentSchema.parse(await json(request))));
    return true;
  }

  if (method === "POST" && url.pathname === "/entities/merge") {
    const body = entityMergeSchema.parse(await json(request));
    send(response, 202, defaultService.mergeEntity(body.canonical, body.aliases, body.userId));
    return true;
  }

  if (method === "POST" && url.pathname === "/entities/split") {
    const body = entityMergeSchema.parse(await json(request));
    const record = defaultService.splitEntity(body.canonical, body.aliases, body.userId);
    send(response, record ? 202 : 404, record ?? { error: "Entity not found" });
    return true;
  }

  if (method === "GET" && url.pathname === "/graph/paths") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      send(response, 400, { error: "from and to are required" });
      return true;
    }
    send(response, 200, defaultService.graphPaths(from, to, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      validAt: url.searchParams.get("validAt") ?? undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return true;
  }

  if (method === "GET" && url.pathname === "/graph/explain") {
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to) {
      send(response, 400, { error: "from and to are required" });
      return true;
    }
    const strategy = url.searchParams.get("strategy");
    send(response, 200, defaultService.graphExplain(from, to, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      validAt: url.searchParams.get("validAt") ?? undefined,
      strategy: strategy === "shortest" || strategy === "strongest" || strategy === "most_recent" || strategy === "highest_trust" ? strategy : undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return true;
  }

  if (method === "GET" && url.pathname === "/graph/activate") {
    const query = url.searchParams.get("query");
    if (!query) {
      send(response, 400, { error: "query is required" });
      return true;
    }
    send(response, 200, defaultService.graphActivation(query, {
      userId: url.searchParams.get("userId") ?? undefined,
      maxDepth: url.searchParams.get("maxDepth") ? Number(url.searchParams.get("maxDepth")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      validAt: url.searchParams.get("validAt") ?? undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes"))
    }));
    return true;
  }

  if (method === "GET" && url.pathname === "/graph/export") {
    const format = url.searchParams.get("format") === "graphml" ? "graphml" : "json";
    const exported = defaultService.graphExport({
      userId: url.searchParams.get("userId") ?? undefined,
      relationTypes: parseRelationTypes(url.searchParams.get("relationTypes")),
      minTrust: url.searchParams.get("minTrust") ? Number(url.searchParams.get("minTrust")) : undefined,
      sourceKind: sourceKind(url.searchParams.get("sourceKind")),
      after: url.searchParams.get("after") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
      validAt: url.searchParams.get("validAt") ?? undefined,
      format
    });
    if (format === "graphml" && typeof exported === "string") {
      sendText(response, 200, exported, "application/graphml+xml");
      return true;
    }
    send(response, 200, exported);
    return true;
  }

  if (method === "POST" && url.pathname === "/graph/query") {
    const body = z.object({ query: z.string().min(1), userId: z.string().optional() }).parse(await json(request));
    send(response, 200, defaultService.graphQuery(body.query, body.userId));
    return true;
  }

  if (method === "POST" && url.pathname === "/graph/infer") {
    const body = z.object({ rules: z.array(inferenceRuleSchema).optional() }).parse(await json(request));
    send(response, 202, defaultService.runInference(body.rules));
    return true;
  }

  return false;
}
