import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { server } from "../src/api/server";

async function listen(): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function close(): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function signJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", process.env.MEMORY_JWT_HS256_SECRET ?? "jwt-test-secret")
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

describe("cognibrain HTTP API contract", () => {
  afterEach(async () => {
    await close();
    delete process.env.MEMORY_API_KEY;
    delete process.env.MEMORY_API_KEYS;
    delete process.env.MEMORY_REQUIRE_AUTH;
    delete process.env.MEMORY_JWT_ISSUER;
    delete process.env.MEMORY_JWT_AUDIENCE;
    delete process.env.MEMORY_JWT_HS256_SECRET;
    delete process.env.MEMORY_CORS_ORIGINS;
    delete process.env.MEMORY_RATE_LIMIT_MAX;
    delete process.env.MEMORY_RATE_LIMIT_WINDOW_MS;
    delete process.env.MEMORY_REQUEST_BODY_LIMIT_BYTES;
    delete process.env.MEMORY_POLICY_MODE;
    delete process.env.MEMORY_SECURITY_MODE;
    delete process.env.MEMORY_PRODUCTION_MODE;
  });

  it("accepts governed marketplace module metadata over HTTP", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/marketplace/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "api-domain",
        kind: "domain",
        name: "API Domain",
        version: "1.0.0",
        description: "Domain module with signed governance metadata.",
        signature: {
          signer: "cognilabz",
          algorithm: "sha256",
          digest: "abc123",
          status: "verified"
        },
        compatibility: {
          minCognibrainVersion: "0.1.0",
          engines: ["node>=20"]
        },
        security: {
          scannedAt: new Date().toISOString(),
          status: "passed",
          permissions: ["domain"],
          risks: []
        },
        manifest: { id: "coding" }
      })
    });

    expect(response.status).toBe(200);
    const plan = (await response.json()) as { valid: boolean; actions: string[] };
    expect(plan.valid).toBe(true);
    expect(plan.actions).toContain("verify module signature metadata");
    expect(plan.actions).toContain("check cognibrain version compatibility");
  });

  it("accepts policy, retention, security, and privacy audit webhooks", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: "https://example.invalid/cognibrain-webhook",
        events: ["policy.violation", "retention.enforce", "security.key.rotate", "privacy.insights"]
      })
    });

    expect(response.status).toBe(201);
    const webhook = (await response.json()) as { events: string[] };
    expect(webhook.events).toEqual(["policy.violation", "retention.enforce", "security.key.rotate", "privacy.insights"]);
  });

  it("accepts connector telemetry over HTTP", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/connectors/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectorId: "official-code",
        harnessId: "codex",
        userId: "api-telemetry-user",
        kind: "accepted_suggestion",
        content: "Accepted the context pack for the API telemetry contract test."
      })
    });

    expect(response.status).toBe(202);
    const body = (await response.json()) as { record: { payload: { telemetryKind: string; harnessId: string } }; createdMemories: Array<{ tags: string[] }> };
    expect(body.record.payload).toMatchObject({ telemetryKind: "accepted_suggestion", harnessId: "codex" });
    expect(body.createdMemories[0]?.tags).toContain("connector-feedback");
  });

  it("archives memories over HTTP while preserving audit history", async () => {
    const baseUrl = await listen();
    const create = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "dash",
        content: "Dashboard archive uses the runtime API.",
        source: { kind: "human", confidence: 0.93 }
      })
    });
    expect(create.status).toBe(201);
    const memory = (await create.json()) as { id: string };

    const archive = await fetch(`${baseUrl}/memories/${memory.id}/archive`, { method: "POST" });
    expect(archive.status).toBe(202);
    const archived = (await archive.json()) as { archivedAt?: string };
    expect(archived.archivedAt).toBeTruthy();

    const audit = await fetch(`${baseUrl}/audit?memoryId=${memory.id}`);
    expect(audit.status).toBe(200);
    const events = (await audit.json()) as Array<{ metadata?: { action?: string } }>;
    expect(events.some((event) => event.metadata?.action === "archive")).toBe(true);

    const chainResponse = await fetch(`${baseUrl}/audit/chain?memoryId=${memory.id}`);
    expect(chainResponse.status).toBe(200);
    const chain = (await chainResponse.json()) as { valid: boolean; events: Array<{ hash?: string; previousHash?: string; journalType?: string }>; replay: { memories: Record<string, { archived: boolean }> } };
    expect(chain.valid).toBe(true);
    expect(chain.events.some((event) => event.journalType === "memory.archived")).toBe(true);
    expect(chain.events.every((event) => event.hash)).toBe(true);
    expect(chain.replay.memories[memory.id]?.archived).toBe(true);
  });

  it("protects non-health routes when API keys are configured", async () => {
    process.env.MEMORY_API_KEYS = "test-secret";
    const baseUrl = await listen();

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { auth?: { protected?: boolean } };
    expect(healthBody.auth?.protected).toBe(true);

    const denied = await fetch(`${baseUrl}/memories`);
    expect(denied.status).toBe(401);

    const allowed = await fetch(`${baseUrl}/memories`, { headers: { "x-api-key": "test-secret", "x-actor-id": "api-test" } });
    expect(allowed.status).toBe(200);
  });

  it("validates JWT issuer/audience/scopes and binds actor scope", async () => {
    process.env.MEMORY_JWT_ISSUER = "https://issuer.example";
    process.env.MEMORY_JWT_AUDIENCE = "cognibrain-api";
    process.env.MEMORY_JWT_HS256_SECRET = "jwt-test-secret";
    const baseUrl = await listen();
    const writeToken = signJwt({
      iss: "https://issuer.example",
      aud: "cognibrain-api",
      sub: "jwt-user",
      orgId: "org-jwt",
      scope: "memory:write",
      exp: Math.floor(Date.now() / 1000) + 300
    });

    const created = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${writeToken}` },
      body: JSON.stringify({ userId: "jwt-user", orgId: "org-jwt", content: "JWT actor-bound writes stay in scope." })
    });
    expect(created.status).toBe(201);

    const spoofed = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${writeToken}` },
      body: JSON.stringify({ userId: "other-user", orgId: "org-jwt", content: "This should not cross scopes." })
    });
    expect(spoofed.status).toBe(403);

    const readDenied = await fetch(`${baseUrl}/memories?userId=jwt-user`, { headers: { authorization: `Bearer ${writeToken}` } });
    expect(readDenied.status).toBe(403);

    const connectorReadToken = signJwt({
      iss: "https://issuer.example",
      aud: "cognibrain-api",
      sub: "jwt-user",
      orgId: "org-jwt",
      scope: "connector:read",
      exp: Math.floor(Date.now() / 1000) + 300
    });
    const connectorHealth = await fetch(`${baseUrl}/connectors/health`, { headers: { authorization: `Bearer ${connectorReadToken}` } });
    expect(connectorHealth.status).toBe(200);
    const memoryReadWithConnectorScope = await fetch(`${baseUrl}/memories?userId=jwt-user`, { headers: { authorization: `Bearer ${connectorReadToken}` } });
    expect(memoryReadWithConnectorScope.status).toBe(403);
  });

  it("applies configurable CORS, request body limits, and rate limits", async () => {
    process.env.MEMORY_CORS_ORIGINS = "https://app.example";
    process.env.MEMORY_REQUEST_BODY_LIMIT_BYTES = "80";
    process.env.MEMORY_RATE_LIMIT_MAX = "2";
    process.env.MEMORY_RATE_LIMIT_WINDOW_MS = "60000";
    const baseUrl = await listen();

    const options = await fetch(`${baseUrl}/memories`, { method: "OPTIONS", headers: { origin: "https://app.example" } });
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe("https://app.example");

    const tooLarge = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "body-limit", content: "x".repeat(200) })
    });
    expect(tooLarge.status).toBe(413);

    const first = await fetch(`${baseUrl}/health`);
    const second = await fetch(`${baseUrl}/health`);
    const third = await fetch(`${baseUrl}/health`);
    expect([first.status, second.status, third.status]).toContain(429);
  });

  it("exposes a structured OpenAPI contract for SDK generation", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/sdk/openapi`);
    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, { operationId?: string; responses?: Record<string, unknown> }>>;
      components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/openapi.json"].get.operationId).toBe("getOpenapi.json");
    expect(spec.paths["/retention/review"].get.operationId).toBe("getRetentionReview");
    expect(spec.paths["/memories"].post.operationId).toBe("postMemories");
    expect(spec.paths["/coding-context-pack"].post.operationId).toBe("postCodingContextPack");
    expect(spec.paths["/audit/chain"].get.responses?.["200"]).toBeDefined();
    expect(spec.components.schemas.MemoryInput).toBeDefined();
    expect(spec.components.schemas.EvidencePack).toBeDefined();
    expect(spec.components.schemas.CodingContextPack).toBeDefined();
    expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();

    const alias = await fetch(`${baseUrl}/v1/openapi.json`);
    expect(alias.status).toBe(200);
    expect(((await alias.json()) as { openapi: string }).openapi).toBe("3.1.0");
  });

  it("exports persisted context packs through evidence endpoints", async () => {
    const baseUrl = await listen();
    await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "evidence-user",
        content: "Evidence packs include source, temporal state, policy decisions, and graph paths.",
        source: { kind: "human", confidence: 0.96 },
        entities: ["EvidencePack"]
      })
    });

    const created = await fetch(`${baseUrl}/evidence-pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "evidence-user", query: "why evidence packs", tokenBudget: 1200 })
    });
    expect(created.status).toBe(200);
    const pack = (await created.json()) as { id: string; hash?: string; policyDecisions?: unknown[]; temporalState?: { valid: number } };
    expect(pack.hash).toBeTruthy();
    expect(pack.policyDecisions?.length).toBeGreaterThan(0);
    expect(pack.temporalState?.valid).toBeGreaterThan(0);

    const exported = await fetch(`${baseUrl}/context-packs/${pack.id}/evidence`);
    expect(exported.status).toBe(200);
    const evidence = (await exported.json()) as { id: string; results: unknown[] };
    expect(evidence.id).toBe(pack.id);
    expect(evidence.results.length).toBeGreaterThan(0);
  });

  it("gates entity enrichment over HTTP until external approval is explicit", async () => {
    const baseUrl = await listen();
    const response = await fetch(`${baseUrl}/entities/enrich`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "api-entity-user",
        entity: "atlas",
        approveExternal: false,
        sourceUri: "https://example.invalid/atlas"
      })
    });

    expect(response.status).toBe(202);
    const body = (await response.json()) as { status: string; memories: unknown[] };
    expect(["blocked", "skipped"]).toContain(body.status);
    expect(body.memories).toEqual([]);
  });
});
