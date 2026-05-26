export type ApiDescriptionAuth = { mode: "open-local-dev" | "api-key" | "jwt-oidc"; protected: boolean; warning?: string; scopes?: string[] };

export function buildApiDescription(auth?: ApiDescriptionAuth) {
  const protectedAuth: Array<Record<string, string[]>> = auth?.protected ? [{ ApiKeyAuth: [] }, { BearerAuth: [] }] : [];
  const routeMethods: Record<string, string[]> = {
    "/memories": ["GET", "POST"],
    "/episodes": ["GET"],
    "/episodes/{id}": ["GET"],
    "/actions": ["POST"],
    "/code/corrections": ["POST"],
    "/code/action-guard": ["POST"],
    "/search": ["POST"],
    "/route": ["POST"],
    "/intent": ["POST"],
    "/evidence-pack": ["POST"],
    "/context/enrich": ["POST"],
    "/coding-context-pack": ["POST"],
    "/coding-context-packs/{id}": ["GET"],
    "/patch-evidence": ["POST"],
    "/evidence-pack/{id}": ["GET"],
    "/context-packs/{id}": ["GET"],
    "/context-packs/{id}/evidence": ["GET"],
    "/feedback": ["POST"],
    "/feedback/injection": ["POST"],
    "/verification/{userId}": ["GET"],
    "/memories/{id}": ["GET", "PATCH", "DELETE"],
    "/memories/{id}/archive": ["POST"],
    "/memories/{id}/confirm": ["POST"],
    "/memories/{id}/retract": ["POST"],
    "/memories/{id}/consent": ["POST"],
    "/memories/{id}/revert": ["POST"],
    "/graph": ["GET"],
    "/graph/paths": ["GET"],
    "/graph/explain": ["GET"],
    "/graph/activate": ["GET"],
    "/graph/export": ["GET"],
    "/graph/query": ["POST"],
    "/audit": ["GET"],
    "/audit/chain": ["GET"],
    "/events": ["GET"],
    "/webhooks": ["POST"],
    "/webhooks/deliveries": ["GET"],
    "/webhooks/deliver": ["POST"],
    "/marketplace": ["GET"],
    "/marketplace/submissions": ["GET", "POST"],
    "/marketplace/scan": ["POST"],
    "/marketplace/review": ["POST"],
    "/marketplace/publish": ["POST"],
    "/marketplace/rate": ["POST"],
    "/marketplace/install": ["POST"],
    "/marketplace/plan": ["POST"],
    "/managed/tenants": ["GET", "POST"],
    "/managed/control-plane": ["GET"],
    "/connectors": ["GET"],
    "/connectors/register": ["POST"],
    "/connectors/sync": ["POST"],
    "/connectors/health": ["GET"],
    "/connectors/auth": ["GET"],
    "/connectors/auth/begin": ["POST"],
    "/connectors/auth/callback": ["POST"],
    "/connectors/auth/revoke": ["POST"],
    "/connectors/list": ["POST"],
    "/connectors/poll": ["POST"],
    "/connectors/writeback": ["POST"],
    "/connectors/feedback": ["POST"],
    "/connectors/telemetry": ["POST"],
    "/profiles": ["GET", "PUT"],
    "/profiles/learn": ["POST"],
    "/profiles/training-samples": ["POST"],
    "/migration/export": ["POST"],
    "/migration/import": ["POST"],
    "/backup/verify": ["POST"],
    "/policy/rules": ["GET", "POST"],
    "/policy/evaluate": ["POST"],
    "/retention/rules": ["GET", "POST"],
    "/retention/enforce": ["POST"],
    "/retention/review": ["GET"],
    "/privacy/insights": ["GET"],
    "/privacy/cross-brain-compute": ["POST"],
    "/security/key-provider": ["GET"],
    "/security/transport": ["GET"],
    "/compliance/export": ["GET"],
    "/auth/status": ["GET"],
    "/storage": ["GET"],
    "/providers": ["GET"],
    "/translate": ["POST"],
    "/ingest/media": ["POST"],
    "/sdk/openapi": ["GET"],
    "/openapi.json": ["GET"],
    "/v1/openapi.json": ["GET"]
  };
  return {
    openapi: "3.1.0",
    info: { title: "cognibrain API", version: "0.1.0" },
    servers: [{ url: "/v1", description: "Versioned local API prefix" }],
    security: protectedAuth,
    paths: openApiPaths(routeMethods, protectedAuth),
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
        BearerAuth: { type: "http", scheme: "bearer" }
      },
      schemas: openApiSchemas()
    },
    "x-cognibrain-generatedFrom": ["src/api/server.ts route registry", "src/core/types.ts public contracts", "src/api/service.ts apiDescription"],
    "x-cognibrain-auth": auth ?? {
      mode: "open-local-dev",
      protected: false,
      warning: "API authentication is disabled for local development. Set MEMORY_API_KEYS or MEMORY_REQUIRE_AUTH=true before exposing this server."
    },
    clients: {
        typescript: "sdk/typescript/client.ts",
      python: "sdk/python/cognibrain_client.py",
      openapiCodegen: "/sdk/openapi"
    }
  };
}

function openApiPaths(routeMethods: Record<string, string[]>, security: Array<Record<string, string[]>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(routeMethods).map(([path, methods]) => [
      path,
      Object.fromEntries(methods.map((method) => [method.toLowerCase(), openApiOperation(path, method, security)]))
    ])
  );
}

function openApiOperation(path: string, method: string, security: Array<Record<string, string[]>>): Record<string, unknown> {
  const operationId = `${method.toLowerCase()}${path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[{}-](.)/g, (_match, char: string) => char.toUpperCase()).replace(/[{}]/g, ""))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" }
  }));
  return {
    operationId,
    summary: `${method} ${path}`,
    ...(security.length && path !== "/auth/status" ? { security } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(method !== "GET" && method !== "DELETE" ? { requestBody: jsonBody(schemaRef(requestSchemaFor(path))) } : {}),
    responses: {
      "200": jsonResponse(responseSchemaFor(path, method)),
      "201": jsonResponse(responseSchemaFor(path, method)),
      "202": jsonResponse(responseSchemaFor(path, method)),
      "400": jsonResponse("ErrorResponse"),
      "401": jsonResponse("ErrorResponse"),
      "404": jsonResponse("ErrorResponse")
    }
  };
}

function requestSchemaFor(path: string): string {
  if (path === "/memories" || path === "/ingest/media") return "MemoryInput";
  if (path === "/search" || path === "/route" || path === "/evidence-pack" || path === "/coding-context-pack") return "SearchRequest";
  if (path === "/policy/evaluate") return "PolicyEvaluateRequest";
  if (path === "/policy/rules") return "MemoryPolicyRule";
  if (path === "/connectors/register") return "ConnectorManifest";
  if (path.includes("connector")) return "ConnectorRequest";
  if (path.includes("graph")) return "GraphRequest";
  if (path.includes("migration")) return "ManagedMigrationBundle";
  return "GenericObject";
}

function responseSchemaFor(path: string, method: string): string {
  if (path === "/memories" && method === "GET") return "MemoryList";
  if (path === "/memories" || path.startsWith("/memories/{id}")) return "Memory";
  if (path === "/coding-context-pack" || path.startsWith("/coding-context-packs")) return "CodingContextPack";
  if (path.includes("evidence") || path.includes("context-packs")) return "EvidencePack";
  if (path === "/audit/chain") return "AuditChain";
  if (path === "/audit") return "AuditEventList";
  if (path.includes("policy")) return "PolicyDecision";
  if (path.includes("connectors")) return "ConnectorResponse";
  if (path.includes("graph")) return "GraphResponse";
  if (path === "/sdk/openapi") return "OpenAPI";
  if (method === "DELETE") return "EmptyResponse";
  return "GenericObject";
}

function jsonBody(schema: Record<string, unknown>): Record<string, unknown> {
  return { required: true, content: { "application/json": { schema } } };
}

function jsonResponse(schemaName: string): Record<string, unknown> {
  return { description: schemaName, content: { "application/json": { schema: schemaRef(schemaName) } } };
}

function schemaRef(name: string): Record<string, string> {
  return { "$ref": `#/components/schemas/${name}` };
}

function openApiSchemas(): Record<string, Record<string, unknown>> {
  return {
    GenericObject: { type: "object", additionalProperties: true },
    EmptyResponse: { type: "object", additionalProperties: false },
    ErrorResponse: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
    MemoryInput: {
      type: "object",
      required: ["userId", "content"],
      properties: {
        userId: { type: "string" },
        brainId: { type: "string" },
        sourceId: { type: "string" },
        agentId: { type: "string" },
        orgId: { type: "string" },
        projectId: { type: "string" },
        content: { type: "string" },
        type: { enum: ["user", "feedback", "project", "reference", "episodic", "procedural"] },
        layer: { enum: ["working", "episodic", "long_term", "procedural", "reflection"] },
        tags: { type: "array", items: { type: "string" } },
        entities: { type: "array", items: { type: "string" } },
        consent: { "$ref": "#/components/schemas/ConsentPolicy" },
        source: { "$ref": "#/components/schemas/Provenance" }
      }
    },
    Memory: {
      allOf: [
        { "$ref": "#/components/schemas/MemoryInput" },
        {
          type: "object",
          required: ["id", "schemaVersion", "createdAt", "updatedAt", "trust", "importance", "audit"],
          properties: {
            id: { type: "string" },
            schemaVersion: { const: "2.0" },
            beliefState: { enum: ["active", "stale", "superseded", "contradicted", "needs_verification", "retracted", "archived"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            trust: { type: "number" },
            importance: { type: "number" },
            audit: { type: "array", items: { "$ref": "#/components/schemas/MemoryAuditEvent" } }
          }
        }
      ]
    },
    MemoryList: { type: "array", items: { "$ref": "#/components/schemas/Memory" } },
    ConsentPolicy: {
      type: "object",
      properties: {
        visibility: { enum: ["private", "user", "org", "public"] },
        allowTraining: { type: "boolean" },
        retentionUntil: { type: "string", format: "date-time" },
        deleteOnRequest: { type: "boolean" }
      }
    },
    Provenance: {
      type: "object",
      required: ["kind", "confidence"],
      properties: {
        kind: { enum: ["human", "reviewed_code", "tool", "agent", "transcript", "import"] },
        uri: { type: "string" },
        commit: { type: "string" },
        lineStart: { type: "number" },
        lineEnd: { type: "number" },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    MemoryAuditEvent: { type: "object", additionalProperties: true },
    SearchRequest: {
      type: "object",
      required: ["userId", "query"],
      properties: {
        userId: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        includePrivate: { type: "boolean" },
        includeSharedBrains: { type: "boolean" },
        brainId: { type: "string" },
        brainIds: { type: "array", items: { type: "string" } },
        orgId: { type: "string" },
        projectId: { type: "string" },
        mode: { enum: ["hybrid", "rrf", "graph", "path"] }
      }
    },
    EvidencePack: { type: "object", required: ["schemaVersion", "id", "query", "context", "results", "hash"], additionalProperties: true },
    CodingContextPack: { type: "object", required: ["schemaVersion", "id", "query", "context", "sections"], additionalProperties: true },
    AuditEvent: { type: "object", required: ["id", "type", "timestamp"], additionalProperties: true },
    AuditEventList: { type: "array", items: { "$ref": "#/components/schemas/AuditEvent" } },
    AuditChain: { type: "object", required: ["schemaVersion", "eventCount", "valid", "events", "replay"], additionalProperties: true },
    MemoryPolicyRule: { type: "object", required: ["label", "effect", "operations"], additionalProperties: true },
    PolicyEvaluateRequest: { type: "object", required: ["operation"], additionalProperties: true },
    PolicyDecision: { type: "object", required: ["operation", "allowed", "matchedRules", "reasons"], additionalProperties: true },
    ConnectorManifest: { type: "object", required: ["id", "name", "kind", "version", "direction", "capabilities", "auth"], additionalProperties: true },
    ConnectorRequest: { type: "object", additionalProperties: true },
    ConnectorResponse: { type: "object", additionalProperties: true },
    GraphRequest: { type: "object", additionalProperties: true },
    GraphResponse: { type: "object", additionalProperties: true },
    ManagedMigrationBundle: { type: "object", additionalProperties: true },
    OpenAPI: { type: "object", required: ["openapi", "info", "paths", "components"], additionalProperties: true }
  };
}
