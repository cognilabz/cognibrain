import { afterEach, describe, expect, it } from "vitest";
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

describe("cognibrain HTTP API contract", () => {
  afterEach(async () => {
    await close();
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
