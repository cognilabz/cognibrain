import { describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CODING_DOMAIN_MODULE, DOMAIN_MODULES, MemoryStore, ReflectionEngine, RetrievalEngine, healthReport, tokenize, extractEntities, type EngineeringMemoryKind } from "../src/core";
import { JsonCommandMemoryIntelligence } from "../src/core/providers";
import { HarnessMemoryHook } from "../src/connectors/harnessHook";
import { connectorAuthHeaders, createConnectorManifest, createPlatformIntegration, createWritebackPlan, runConnectorPoll } from "../src/connectors/sdk";
import { MemoryService } from "../src/api/service";
import { CognibrainClient, CognibrainError } from "../sdk/typescript/client";
import { CognibrainHarnessSdk } from "../sdk/typescript/harness";
import { createPlatformIntegration as createPublicPlatformIntegration } from "../sdk/typescript/connectors";
import * as publicTypescriptSdk from "../sdk/typescript/index";
import { AppendOnlyLogPersistenceAdapter, CassandraCompatiblePersistenceAdapter, CassandraRemotePersistenceAdapter, JsonFilePersistenceAdapter, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, SQLitePersistenceAdapter, createPersistenceFromEnv, sqliteAvailable } from "../src/api/persistence";
import { createMemoryToolHandlers } from "../src/connectors/mcpHandlers";
import { buildLeaderboardArtifact, validateLeaderboardArtifact } from "../src/eval/leaderboard";
import { publishLeaderboardArtifact } from "../src/eval/publishLeaderboard";
import { runNextgenBenchmarkSuites } from "../src/eval/nextgenBenchmarks";
import { runAnswerGenerationBenchmark } from "../src/eval/answerGeneration";
import { runMarketGate } from "../src/eval/marketGate";
import { runProductionLoadBenchmark } from "../src/eval/load";
import { OpenAICompatibleEmbeddingProvider } from "../src/core/openaiEmbeddings";
import { CODING_QUERY_INTENT_CASES } from "../src/eval/codingIntentCases";

describe("TypeScript memory core integrations", () => {
  it("validates marketplace modules, installs built-ins, exports migration bundles, and exposes an SDK client", async () => {
    const service = new MemoryService();
    expect(service.listMarketplaceModules().some((module) => module.id === "domain-research" && module.security?.status === "passed")).toBe(true);
    const plan = service.marketplaceInstallPlan("domain-research");
    expect(plan.valid).toBe(true);
    expect(plan.actions).toContain("make domain module available for runtime config");
    expect(plan.actions).toContain("verify module signature metadata");
    expect(plan.actions.some((action) => action.startsWith("request permissions:"))).toBe(true);

    const installedDomain = service.installMarketplaceModuleById("domain-coding");
    expect(installedDomain.installState).toBe("installed");
    expect(service.getRetrievalProfiles().some((profile) => profile.id === "domain:coding")).toBe(true);
    const codingMemory = service.add({ userId: "domain-market", content: "CacheClient calls the API endpoint.", source: { kind: "human", confidence: 0.95 } });
    expect(codingMemory.tags).toContain("coding");

    const installedProfile = service.installMarketplaceModuleById("retrieval-trust-heavy");
    expect(installedProfile.installState).toBe("installed");
    expect(service.getRetrievalProfiles().some((profile) => profile.id === "trust-heavy")).toBe(true);

    const bundle = service.managedMigrationBundle({ target: "managed", backupRef: "local-backup://market", ssoProvider: "oidc", secretManager: "vault" });
    expect(bundle.placeholders.sso.required).toBe(true);
    expect(bundle.deployment?.secretManager).toBe("vault");
    expect(bundle.deployment?.artifacts.dockerCompose).toBe("docker/docker-compose.yml");
    expect(bundle.counts.connectors).toBeGreaterThan(0);
    const openapi = service.apiDescription();
    expect(openapi.clients.typescript).toContain("sdk/typescript/client.ts");
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.servers[0].url).toBe("/v1");
    expect(openapi.paths["/openapi.json"].get).toBeDefined();
    expect(openapi.paths["/retention/review"].get).toBeDefined();
    expect(openapi.paths["/memories/{id}/archive"].post).toMatchObject({ operationId: "postMemoriesIdArchive" });
    const codingContextPath = openapi.paths["/coding-context-pack"] as { post: { responses: Record<string, unknown> } };
    const codingContextResponse = codingContextPath.post.responses["200"] as { content: { "application/json": { schema: { $ref: string } } } };
    expect(codingContextResponse.content["application/json"].schema.$ref).toBe("#/components/schemas/CodingContextPack");
    expect(openapi.paths["/audit/chain"].get).toBeDefined();
    expect(openapi.components.schemas.MemoryInput.required).toEqual(["userId", "content"]);
    expect(openapi.components.schemas.AuditChain.required).toContain("replay");

    const calls: Array<{ url: string; body?: string; headers?: HeadersInit }> = [];
    const client = new CognibrainClient({
      baseUrl: "http://memory.local",
      apiKey: "sdk-key",
      actorId: "sdk-agent",
      fetchImpl: (async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body ?? ""), headers: init?.headers });
        return new Response(JSON.stringify({ id: "mem_sdk", content: "SDK memory" }), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch
    });
    const added = await client.add({ userId: "sdk", content: "SDK memory" });
    await client.feedback("mem_sdk", "helpful", "sdk");
    await client.archive("mem_sdk");
    await client.getEvidencePack("ctx_sdk");
    await client.graphQuery("MATCH (a)-[:mentions]->(b) RETURN a,b", "sdk");
    await client.listPolicyRules();
    await client.evaluatePolicy("retrieve", { memoryId: "mem_sdk" }, { userId: "sdk" });
    await client.listConnectors("code");
    await client.connectorHealth("official-github");
    expect(added.id).toBe("mem_sdk");
    expect(calls.map((call) => call.url)).toEqual([
      "http://memory.local/memories",
      "http://memory.local/feedback",
      "http://memory.local/memories/mem_sdk/archive",
      "http://memory.local/context-packs/ctx_sdk/evidence",
      "http://memory.local/graph/query",
      "http://memory.local/policy/rules",
      "http://memory.local/policy/evaluate",
      "http://memory.local/connectors?kind=code",
      "http://memory.local/connectors/health?connectorId=official-github"
    ]);
    expect(calls.every((call) => (call.headers as Record<string, string> | undefined)?.["x-api-key"] === "sdk-key")).toBe(true);
  });

  it("retries transient SDK failures, returns local pages, and raises typed errors", async () => {
    let attempts = 0;
    const client = new CognibrainClient({
      baseUrl: "http://memory.local",
      retries: 1,
      retryDelayMs: 0,
      fetchImpl: (async (url) => {
        attempts += 1;
        if (String(url).endsWith("/search") && attempts === 1) return new Response(JSON.stringify({ error: "temporary" }), { status: 503 });
        if (String(url).startsWith("http://memory.local/memories")) {
          return new Response(JSON.stringify([{ id: "m1", userId: "sdk", content: "one" }, { id: "m2", userId: "sdk", content: "two" }]), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (String(url).endsWith("/policy/rules")) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
        return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch
    });
    await expect(client.search({ userId: "sdk", query: "retry" })).resolves.toEqual([]);
    expect(attempts).toBe(2);
    await expect(client.listMemoriesPage({ userId: "sdk", limit: 1 })).resolves.toMatchObject({ nextCursor: "1", items: [{ id: "m1" }] });
    await expect(client.listPolicyRules()).rejects.toMatchObject({ name: "CognibrainError", status: 403, path: "/policy/rules" } satisfies Partial<CognibrainError>);
  });

  it("persists managed tenants and reports hosted control-plane readiness", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-managed-"));
    try {
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path) });
      const tenant = service.createManagedTenant({
        name: "Acme Memory",
        orgId: "org_acme",
        plan: "enterprise",
        region: "eu-central-1",
        ssoProvider: "oidc",
        secretManager: "vault",
        backup: { enabled: true, backupRef: "local-backup://managed" },
        autoscaling: { minReplicas: 2, maxReplicas: 8, targetCpuUtilization: 65 }
      });

      const report = service.managedControlPlaneReport();
      expect(report.tenants).toMatchObject({ total: 1, active: 1, regions: ["eu-central-1"] });
      expect(report.tenants.plans.enterprise).toBe(1);
      expect(report.readiness.sso).toBe(true);
      expect(report.readiness.backup).toBe(true);
      expect(report.autoscaling).toMatchObject({ enabled: true, minReplicas: 2, maxReplicas: 8, targetCpuUtilization: 65 });
      expect(service.apiDescription().paths["/managed/control-plane"].get).toBeDefined();

      const reloaded = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path) });
      expect(reloaded.listManagedTenants()[0].id).toBe(tenant.id);
      expect(reloaded.managedControlPlaneReport().tenants.total).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs the marketplace submission, scan, review, publish, rating, and install lifecycle", () => {
    const service = new MemoryService();
    const module = {
      id: "persona-community-reviewer",
      kind: "persona" as const,
      name: "Community Reviewer",
      version: "1.0.0",
      description: "Review-friendly community persona defaults.",
      manifest: { id: "community-reviewer", label: "Community Reviewer", summaryStyle: "concise" }
    };

    const submitted = service.submitMarketplaceModule({ module, submitter: "dahuby", sourceUrl: "https://github.com/cognilabz/cognibrain/pull/1" });
    expect(submitted.status).toBe("submitted");

    const scanned = service.scanMarketplaceSubmission(submitted.id);
    expect(scanned.status).toBe("scanned");
    expect(scanned.scan?.status).toBe("warning");
    expect(scanned.scan?.risks).toContain("warning: module has no signature metadata");

    const reviewed = service.reviewMarketplaceSubmission(submitted.id, { reviewer: "operator", rating: 4.8, comment: "Manifest and privacy defaults are reviewable.", approve: true });
    expect(reviewed.status).toBe("approved");
    expect(reviewed.module.trustSignals?.ratingAverage).toBe(4.8);

    const published = service.publishMarketplaceSubmission(submitted.id);
    expect(published.installState).toBe("available");
    expect(published.trustSignals?.publisher).toBe("dahuby");
    expect(published.trustSignals?.reviewCount).toBe(1);

    const rated = service.rateMarketplaceModule(published.id, { reviewer: "user", rating: 5, comment: "Installed cleanly." });
    expect(rated.trustSignals?.ratingCount).toBe(2);

    const installed = service.installMarketplaceModuleById(published.id);
    expect(installed.installState).toBe("installed");
    expect(installed.trustSignals?.installCount).toBe(1);
    expect(service.listMarketplaceSubmissions("published")).toHaveLength(1);

    const blocked = service.marketplaceInstallPlan({
      ...module,
      id: "bad-signature",
      signature: { signer: "unknown", algorithm: "sha256", digest: "bad", status: "invalid" },
      compatibility: { minCognibrainVersion: "99.0.0" },
      security: { scannedAt: new Date().toISOString(), status: "passed", permissions: ["persona"], risks: [] }
    });
    expect(blocked.valid).toBe(false);
    expect(blocked.risks.some((risk) => risk.includes("signature is invalid"))).toBe(true);
    expect(blocked.risks.some((risk) => risk.includes("requires cognibrain"))).toBe(true);
  });

  it("runs deterministic nextgen benchmark suites", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-bench-"));
    try {
      const report = runNextgenBenchmarkSuites(join(dir, "nextgen-benchmarks.json"), join(dir, "benchmark-trend.json"));
      expect(report.passed).toBe(true);
      expect(report.diagnosticPassed).toBe(true);
      expect(report.proof).toBe("local-lifecycle-diagnostic");
      expect(report.qualityClaimAllowed).toBe(false);
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.claimBoundary.claimBlockers[0]).toContain("local lifecycle diagnostics");
      expect(report.suites.map((suite) => suite.id)).toEqual(["answer-generation", "multi-hop-temporal", "behavioral-patterns", "retrieval-calibration", "usp-evidence-pack"]);
      expect(report.suites.every((suite) => suite.proof === "local-lifecycle-diagnostic" && suite.qualityClaimAllowed === false && suite.marketClaimAllowed === false)).toBe(true);
      expect(report.suites.flatMap((suite) => suite.details).every((detail) => detail.diagnosticPassed === detail.passed && detail.scorer.endsWith("-diagnostic"))).toBe(true);
      expect(report.trend.points.at(-1)?.meanScore).toBeGreaterThan(0.9);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates production load benchmark latency and throughput artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-load-bench-"));
    try {
      const report = runProductionLoadBenchmark({
        out: join(dir, "load-benchmark.json"),
        memories: 120,
        concurrentWrites: 12,
        concurrentSearches: 24,
        connectorEvents: 8,
        dream: true
      });
      expect(report.passed).toBe(true);
      expect(report.latencyMs.write.p95).toBeGreaterThanOrEqual(0);
      expect(report.latencyMs.search.p99).toBeGreaterThanOrEqual(report.latencyMs.search.p50);
      expect(report.throughputPerSecond.write).toBeGreaterThan(0);
      expect(report.totals.connectorEvents).toBe(8);
      expect(readFileSync(join(dir, "load-benchmark.json"), "utf8")).toContain("\"schemaVersion\"");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds a public-safe leaderboard artifact from benchmark proof", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-leaderboard-"));
    try {
      const nextgenPath = join(dir, "nextgen-benchmarks.json");
      const answerGenerationPath = join(dir, "answer-generation.json");
      const outputPath = join(dir, "leaderboard.json");
      runNextgenBenchmarkSuites(nextgenPath, join(dir, "benchmark-trend.json"));
      const answers = runAnswerGenerationBenchmark({ reports: [nextgenPath], outputPath: answerGenerationPath });
      expect(answers.datasets[0].questions[0].generatedAnswer).toBeTruthy();
      expect(answers.proof).toBe("local-diagnostic");
      expect(answers.qualityClaimAllowed).toBe(false);
      expect(answers.datasets.every((dataset) => dataset.proof === "local-diagnostic" && dataset.qualityClaimAllowed === false)).toBe(true);
      const artifact = buildLeaderboardArtifact({ nextgenPath, answerGenerationPath, outputPath, evaluationPath: join(dir, "missing-eval.json") });
      expect(validateLeaderboardArtifact(artifact)).toBe(true);
      expect(artifact.privacy).toMatchObject({ anonymized: true, noRawPrompts: true, noRawEvidence: true });
      expect(artifact.publication.anonymized).toBe(true);
      expect(artifact.entries.some((entry) => entry.category === "answer_generation")).toBe(true);
      expect(artifact.entries.filter((entry) => entry.proof === "local-diagnostic").every((entry) => entry.claimAllowed === false && entry.claimClass === "diagnostic-only")).toBe(true);
      const nextgenEntries = artifact.entries.filter((entry) => entry.artifact === nextgenPath);
      expect(nextgenEntries.every((entry) => entry.methodology.proof === "local-lifecycle-diagnostic" && entry.methodology.qualityClaimAllowed === false)).toBe(true);
      expect(nextgenEntries.every((entry) => String(entry.methodology.scorer).endsWith("-diagnostic"))).toBe(true);
      const answerEntries = artifact.entries.filter((entry) => entry.artifact === answerGenerationPath);
      expect(answerEntries.every((entry) => entry.methodology.proof === "local-diagnostic" && entry.methodology.qualityClaimAllowed === false)).toBe(true);
      expect(JSON.stringify(artifact.entries)).not.toContain("local-deterministic");
      expect(JSON.stringify(artifact)).not.toContain("rawPrompt");
      expect(JSON.stringify(artifact)).not.toContain("rawEvidence");
      const invalidClaim = structuredClone(artifact);
      invalidClaim.entries[0].claimAllowed = true;
      expect(() => validateLeaderboardArtifact(invalidClaim)).toThrow(/cannot allow quality claims/);
      const publication = publishLeaderboardArtifact({ inputPath: outputPath, outputDir: join(dir, "public") });
      expect(publication.entries).toBeGreaterThan(0);
      expect(publication.anonymized).toBe(true);
      expect(publication.claimAllowed).toBe(false);
      expect(publication.proofLevel).toBe("diagnostic-publication");
      const publicJson = JSON.parse(readFileSync(join(dir, "public", "leaderboard.json"), "utf8"));
      const html = readFileSync(join(dir, "public", "index.html"), "utf8");
      expect(publicJson.publication.claimAllowed).toBe(false);
      expect(publicJson.publication.proofLevel).toBe("diagnostic-publication");
      expect(publicJson.publication.claimSummary.diagnosticEntries).toBeGreaterThan(0);
      expect(publicJson.publication.claimSummary.claimedEntries).toBe(0);
      expect(html).toContain("cognibrain diagnostic leaderboard");
      expect(html).toContain("Claim allowed: no");
      expect(html).toContain("Diagnostic entries");
      expect(html).toContain("Diagnostic/claim score");
      expect(html).toContain("Diagnostic publication only");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects comparable market claims without methodology metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-market-"));
    try {
      const locomoPath = join(dir, "locomo.json");
      const longMemEvalPath = join(dir, "longmemeval.json");
      const competitorsPath = join(dir, "competitors.json");
      const report = {
        source: { name: "LoCoMo", metric: "evidence_recall_at_k" },
        ours: { name: "cognibrain", accuracy: 0.9, correct: 9, total: 10 },
        baselines: [{ name: "baseline", accuracy: 0.5, correct: 5, total: 10 }]
      };
      writeFileSync(locomoPath, JSON.stringify(report));
      writeFileSync(longMemEvalPath, JSON.stringify({ ...report, source: { name: "LongMemEval-S", metric: "answer_session_recall_at_k" } }));
      writeFileSync(competitorsPath, JSON.stringify({ competitors: [{ name: "Vendor", sourceUrl: "https://example.com", benchmarks: [{ dataset: "LoCoMo", metric: "evidence_recall_at_k", accuracy: 0.8, comparable: true }] }] }));
      const gate = runMarketGate({ locomoPath, longMemEvalPath, competitorsPath, outputPath: join(dir, "market-gate.json") });
      expect(gate.passed).toBe(false);
      expect(gate.methodologyFailures.some((failure) => failure.reason.includes("topK"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("packages a connector author SDK for manifests, auth headers, polling, and writeback plans", async () => {
    const service = new MemoryService();
    const manifest = createConnectorManifest({
      id: "sdk-chat",
      name: "SDK Chat",
      kind: "chat",
      version: "1.0.0",
      direction: "two_way",
      capabilities: ["ingest", "poll", "writeback"],
      auth: "token",
      defaultSourceKind: "import",
      metadataMapping: { thread: "externalId" },
      privacyPolicy: "team",
      poll: { endpoint: "https://chat.example.invalid/poll", authRef: "token-ref" },
      writeback: { endpoint: "https://chat.example.invalid/messages/{thread}", operations: ["comment"], authRef: "token-ref" }
    });
    service.registerConnectorManifest(manifest);
    const events = await runConnectorPoll(
      {
        poll: () => [{ content: "SDK connector poll captured the release approval.", externalId: "thread-1", author: "reviewer" }]
      },
      { manifest, scope: { userId: "u1", orgId: "org1" } }
    );
    const record = service.syncConnectorEvents(manifest.id, events, { userId: "u1", orgId: "org1" });
    expect(record.status).toBe("applied");
    expect(service.get(record.memoryIds[0]).metadata.connectorId).toBe("sdk-chat");
    expect(connectorAuthHeaders(manifest)).toEqual({ authorization: "Bearer token-ref" });
    expect(createWritebackPlan(manifest, { text: "Linked memory evidence" })).toMatchObject({ connectorId: "sdk-chat", operation: "comment", dryRun: true });
    expect(() =>
      createConnectorManifest({
        id: "bad",
        name: "Bad",
        kind: "custom",
        version: "1.0.0",
        direction: "ingest",
        capabilities: ["writeback"],
        auth: "none",
        defaultSourceKind: "import",
        metadataMapping: {}
      })
    ).toThrow(/writeback/i);
  });

  it("enriches context from referenced and primary connector stores without persisting by default", async () => {
    const service = new MemoryService();
    service.add({ userId: "u1", content: "Atlas local memory says connector context should cite external evidence.", source: { kind: "human", confidence: 0.95 } });
    service.registerConnectorManifest({
      id: "issue-store",
      name: "Issue Store",
      kind: "project_management",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest", "poll"],
      auth: "none",
      defaultSourceKind: "import",
      metadataMapping: { issueKey: "externalId", title: "content.title" },
      privacyPolicy: "project",
      list: { endpoint: "https://issues.example/list", method: "GET" },
      poll: { endpoint: "https://issues.example/poll", method: "GET" }
    });
    const fetchImpl = async () => new Response(JSON.stringify({
      items: [
        {
          externalId: "42",
          title: "Issue #42 / CB-9: fetch Confluence and GitHub context just in time",
          description: "Primary issue store says the agent should resolve explicit references before acting.",
          url: "https://issues.example/browse/CB-9"
        }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } });

    const report = await service.enrichContext({
      userId: "u1",
      query: "Fix #42 and CB-9 with the primary issue context",
      primaryIssueStore: "issue-store",
      defaultSearchConnectors: ["issue-store"],
      tokenBudget: 700
    }, fetchImpl as typeof fetch);

    expect(report.references.map((item) => item.raw)).toEqual(expect.arrayContaining(["#42", "CB-9"]));
    expect(report.externalEvidence[0]).toMatchObject({ connectorId: "issue-store", externalId: "42" });
    expect(report.context).toContain("External context fetched just in time");
    expect(report.context).toContain("Issue #42 / CB-9");
    expect(service.search({ userId: "u1", query: "Primary issue store says", limit: 5 }).some((result) => result.memory.metadata.contextEnrichment)).toBe(false);

    const persisted = await service.enrichContext({
      userId: "u1",
      query: "Recheck #42",
      primaryIssueStore: "issue-store",
      persistFetched: true
    }, fetchImpl as typeof fetch);
    expect(persisted.summary.persistedExternalItems).toBe(1);
    expect(service.search({ userId: "u1", query: "Primary issue store says", limit: 5 })[0].memory.metadata.contextEnrichment).toBe(true);
  });

  it("packages a platform integration SDK for custom source systems", async () => {
    const integration = createPlatformIntegration(
      {
        name: "Acme Tasks",
        kind: "project_management",
        direction: "two_way",
        envPrefix: "MEMORY_ACME_TASKS",
        metadataMapping: { taskId: "externalId", status: "metadata.status" }
      },
      {
        poll: () => [
          {
            id: "TASK-1",
            title: "Approve platform SDK",
            body: "The self-hosted install should make private platform integration easy.",
            url: "https://acme.example/tasks/TASK-1",
            author: { name: "Mira" },
            status: "approved",
            token: "must-not-be-serialized-as-content"
          }
        ],
        health: ({ config }) => ({ ok: true, tokenRef: `env:${config.tokenEnv}` })
      }
    );

    expect(integration.manifest.id).toBe("acme-tasks");
    expect(integration.manifest.capabilities).toEqual(expect.arrayContaining(["ingest", "poll", "writeback"]));
    expect(integration.exampleConfig).toMatchObject({ tokenEnv: "MEMORY_ACME_TASKS_TOKEN", baseUrlEnv: "MEMORY_ACME_TASKS_BASE_URL" });
    expect(JSON.stringify(integration.exampleConfig)).not.toContain("must-not-be-serialized");

    const events = await integration.pollEvents({ userId: "sdk-user", projectId: "memory" });
    const event = events[0];
    if (!event) throw new Error("expected platform SDK event");
    expect(event.content).toContain("Approve platform SDK");
    expect(event.sourceRef?.connectorId).toBe("acme-tasks");
    expect(event.sourceRef?.author).toBe("Mira");
    expect(event.metadata?.connectorKind).toBe("project_management");
    expect(event.metadata?.platform).toBe("acme-tasks");

    const plan = await integration.writeback({ externalId: "TASK-1", text: "Linked memory evidence" });
    expect(plan).toMatchObject({ connectorId: "acme-tasks", operation: "comment", dryRun: true });
    const health = await integration.health();
    expect(health).toMatchObject({ ok: true, connectorId: "acme-tasks", tokenRef: "env:MEMORY_ACME_TASKS_TOKEN" });
  });

  it("exposes public TypeScript SDK subpaths and runs the async harness lifecycle", async () => {
    expect(publicTypescriptSdk.CognibrainClient).toBe(CognibrainClient);
    expect(createPublicPlatformIntegration({ name: "Public Tasks" }).manifest.id).toBe("public-tasks");

    const calls: Array<{ path: string; body?: Record<string, unknown> }> = [];
    const fetchImpl = (async (url, init) => {
      const path = String(url).replace("http://memory.local", "");
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      calls.push({ path, body });
      if (path === "/coding-context-pack") {
        return new Response(JSON.stringify({
          schemaVersion: "1.0",
          id: "code_ctx_sdk",
          generatedAt: "2026-05-27T00:00:00.000Z",
          query: body?.query,
          userId: body?.userId,
          tokenBudget: 900,
          context: "Use public harness SDK.",
          sections: [],
          excludedStaleRules: []
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (path === "/code/action-guard") {
        return new Response(JSON.stringify({
          schemaVersion: "1.0",
          generatedAt: "2026-05-27T00:00:00.000Z",
          userId: body?.userId,
          action: body?.action,
          allowed: true,
          severity: "allow",
          warnings: [],
          blockedBy: [],
          alternatives: [],
          evidenceIds: []
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (path === "/actions") {
        return new Response(JSON.stringify({ id: "mem_action", content: "action", tags: ["harness-action"] }), { status: 202, headers: { "content-type": "application/json" } });
      }
      if (path === "/code/corrections") {
        return new Response(JSON.stringify({ id: "mem_correction", content: body?.content, tags: ["engineering-correction"] }), { status: 202, headers: { "content-type": "application/json" } });
      }
      if (path === "/patch-evidence") {
        return new Response(JSON.stringify({
          schemaVersion: "1.0",
          id: "trail_sdk",
          generatedAt: "2026-05-27T00:00:00.000Z",
          userId: body?.userId,
          task: body?.task,
          memoryIds: body?.memoryIds ?? [],
          correctionIds: ["mem_correction"],
          procedureIds: [],
          toolOutcomeIds: ["mem_action"],
          graphPaths: [],
          excludedStaleRules: [],
          memoriesUsed: [],
          correctionsApplied: [],
          proceduresRecalled: [],
          forbiddenActionsAvoided: [],
          toolOutcomes: [],
          staleMemoriesExcluded: [],
          summary: { filesChanged: body?.filesChanged ?? [], commandsRun: body?.commandsRun ?? [], evidenceCount: 1 }
        }), { status: 202, headers: { "content-type": "application/json" } });
      }
      if (path === "/harness/events") {
        return new Response(JSON.stringify({
          eventMemory: { id: `event_${calls.length}`, content: body?.event, tags: [`harness:${body?.event}`] },
          dream: { plan: { shouldDream: false } }
        }), { status: 202, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: path }), { status: 404, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const harness = new CognibrainHarnessSdk(new CognibrainClient({ baseUrl: "http://memory.local", fetchImpl }));
    const context = {
      userId: "sdk-user",
      agentId: "external-agent",
      appId: "external-harness",
      projectId: "memory",
      sessionId: "run-1",
      prompt: "Run the public harness SDK lifecycle",
      codebaseScope: { repo: "memory", harness: "external-harness" }
    };

    const session = await harness.startSession(context);
    const preTool = await harness.beforeToolCall(context, { command: "npm test" });
    const action = await harness.afterToolCall(context, { command: "npm test", exitCode: 0, outputSummary: "ok" });
    const correction = await harness.captureCorrection(context, { content: "Use public harness SDK imports.", correctAction: "import from sdk/typescript/harness", evidenceIds: [action.action.id] });
    const patch = await harness.finishPatch(context, { task: "public harness SDK", commandsRun: ["npm test"], memoryIds: [action.action.id, correction.correction.id] });
    const handoff = await harness.prepareHandoff(context, { content: "handoff", runDream: false });
    const release = await harness.prepareRelease(context, { content: "release", runDream: false });

    expect(session.codingContextPack.context).toContain("public harness SDK");
    expect(preTool.guard.severity).toBe("allow");
    expect(action.action.tags).toContain("harness-action");
    expect(patch.trail.id).toBe("trail_sdk");
    expect(handoff.eventMemory.tags).toContain("harness:handoff");
    expect(release.eventMemory.tags).toContain("harness:release_candidate");
    expect(calls.map((call) => call.path)).toEqual([
      "/coding-context-pack",
      "/harness/events",
      "/harness/events",
      "/code/action-guard",
      "/harness/events",
      "/actions",
      "/harness/events",
      "/code/corrections",
      "/harness/events",
      "/patch-evidence",
      "/harness/events",
      "/harness/events",
      "/harness/events"
    ]);
  });

  it("validates connector manifests, syncs connector events, retries webhooks, and ingests translated media", () => {
    const service = new MemoryService();
    const official = service.listConnectorManifests();
    expect(official.map((manifest) => manifest.kind)).toEqual(expect.arrayContaining(["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage"]));
    expect(official.map((manifest) => manifest.id)).toEqual(expect.arrayContaining([
      "official-github",
      "official-gitlab",
      "official-azure-devops",
      "official-jira",
      "official-linear",
      "official-slack",
      "official-microsoft-teams",
      "official-notion",
      "official-google-drive",
      "official-gmail",
      "official-google-calendar"
    ]));
    const github = official.find((manifest) => manifest.id === "official-github");
    expect(github?.metadataMapping.issueNumber).toBe("externalId");
    expect(github?.writeback?.operations).toEqual(expect.arrayContaining(["comment", "memory_link"]));
    expect(github?.oauth?.scopes).toEqual(expect.arrayContaining(["repo:read", "pull_requests:read"]));
    const gitlab = official.find((manifest) => manifest.id === "official-gitlab");
    const teams = official.find((manifest) => manifest.id === "official-microsoft-teams");
    const posthog = official.find((manifest) => manifest.id === "official-posthog");
    expect(gitlab?.vendor?.provider).toBe("gitlab");
    expect(teams?.poll?.endpoint).toBe("vendor://teams/poll");
    expect(posthog?.writeback?.endpoint).toBe("vendor://posthog/writeback");
    expect(() =>
      service.registerConnectorManifest({
        id: "bad-writeback",
        name: "Bad Writeback",
        kind: "custom",
        version: "1.0.0",
        direction: "ingest",
        capabilities: ["writeback"],
        auth: "none",
        defaultSourceKind: "import",
        metadataMapping: {}
      })
    ).toThrow(/Writeback/);

    service.registerConnectorManifest({
      id: "oauth-docs",
      name: "OAuth Docs",
      kind: "docs",
      version: "1.0.0",
      direction: "two_way",
      capabilities: ["ingest", "poll", "writeback"],
      auth: "oauth",
      defaultSourceKind: "human",
      metadataMapping: { documentId: "externalId" },
      oauth: {
        authorizeUrl: "https://auth.example.com/authorize",
        tokenUrl: "https://auth.example.com/token",
        clientIdRef: "secret://oauth-docs/client-id",
        scopes: ["docs.read", "docs.write"],
        redirectUri: "http://localhost:8787/connectors/auth/callback"
      },
      poll: { endpoint: "https://api.example.com/docs/poll" },
      writeback: { endpoint: "https://api.example.com/docs/writeback", operations: ["comment"] }
    });
    const oauth = service.beginConnectorOAuth("oauth-docs", { stateSalt: "unit" });
    expect(oauth.authorizeUrl).toContain("state=");
    expect(oauth.authorizeUrl).toContain("docs.read");
    const authorized = service.completeConnectorOAuth({ connectorId: "oauth-docs", state: oauth.state, code: "code-123" });
    expect(authorized.status).toBe("authorized");
    expect(authorized.tokenRef).toContain("oauth://oauth-docs/");
    expect(service.connectorAuthStatus("oauth-docs")[0].tokenHash).toBeTruthy();
    expect(service.listConnectorManifests("docs").find((item) => item.id === "oauth-docs")?.poll?.authRef).toBe(authorized.tokenRef);

    const manifest = service.registerConnectorManifest({
      id: "unit-chat",
      name: "Unit Chat",
      kind: "chat",
      version: "1.0.0",
      direction: "two_way",
      capabilities: ["ingest", "webhook", "writeback"],
      auth: "token",
      defaultSourceKind: "transcript",
      metadataMapping: { channel: "metadata.channel", messageId: "externalId" }
    });
    service.registerWebhook({ url: "https://example.invalid/connectors", events: ["connector.sync", "provider.call", "memory.write"] });

    const sync = service.syncConnectorEvents(
      manifest.id,
      [{ role: "user", content: "Connector sync should capture customer escalation decisions.", externalId: "msg-1", metadata: { channel: "support" } }],
      { userId: "u1" }
    );
    expect(sync.status).toBe("applied");
    expect(sync.memoryIds.length).toBe(1);
    expect(sync.externalIds).toContain("msg-1");
    const syncedMemory = service.get(sync.memoryIds[0]);
    expect(syncedMemory.provenance.sourceRef).toMatchObject({ connectorId: manifest.id, externalId: "msg-1" });
    expect(syncedMemory.provenance.sourceRef?.hash).toBeTruthy();
    expect(service.listConnectorSyncRecords("unit-chat")[0].id).toBe(sync.id);

    const brain = service.createBrain({ name: "Connector Source Brain", ownerUserId: "u1", visibility: "private" });
    const source = service.createSource({ brainId: brain.id, name: "GitHub Issues", kind: "connector", uri: "https://github.com/acme/repo" });
    const sourced = service.add({ userId: "u1", brainId: brain.id, sourceId: source.id, content: "GitHub PR #12 approved the release gate.", source: { kind: "reviewed_code", confidence: 0.96 } });
    const deletion = service.deleteSource(source.id, "operator");
    expect(deletion.affectedMemoryIds).toContain(sourced.id);
    expect(service.get(sourced.id).beliefState).toBe("needs_verification");
    expect(service.verificationQueue("u1").items.some((item) => item.memoryId === sourced.id && item.reason.includes("requires verification"))).toBe(true);

    const failed = service.deliverWebhookQueue(() => ({ ok: false, error: "offline" }));
    expect(failed.failed).toBeGreaterThan(0);
    expect(service.eventFeed().deliveries.some((delivery) => delivery.status === "failed" && delivery.lastAttemptAt && delivery.nextAttemptAt)).toBe(true);
    const retry = service.deliverWebhookQueue();
    expect(retry.delivered).toBeGreaterThanOrEqual(0);

    const translated = service.translateText("Speicher soll nicht fehler", "de");
    expect(translated.translated).toContain("memory");
    const media = service.ingestMedia({ role: "operator", content: "Speicher soll release notes erfassen.", mediaType: "audio", language: "de" }, { userId: "u1" });
    expect(media.memories[0].metadata.translatedFrom).toBe("de");
    expect(service.auditTrail({ type: "provider.call" }).length).toBeGreaterThan(0);
    expect(service.providerStatus().tasks).toContain("translate");
  });

  it("exchanges OAuth codes through token endpoints while persisting only secret refs", async () => {
    const tokenServer = spawn(process.execPath, ["-e", `
      const { createServer } = require("node:http");
      const server = createServer((request, response) => {
        let body = "";
        request.on("data", (chunk) => body += chunk);
        request.on("end", () => {
          if (request.url !== "/token" || !body.includes("code=real-code") || !body.includes("client_secret=client-secret")) {
            response.writeHead(400, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "invalid_request", body }));
            return;
          }
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({ access_token: "raw-access-token", refresh_token: "raw-refresh-token", expires_in: 3600 }));
        });
      });
      server.listen(0, "127.0.0.1", () => console.log(server.address().port));
    `], { stdio: ["ignore", "pipe", "pipe"] });
    const port = await new Promise<number>((resolve, reject) => {
      tokenServer.once("error", reject);
      tokenServer.stdout.once("data", (chunk) => resolve(Number(String(chunk).trim())));
    });
    process.env.MEMORY_SECRET_OAUTH_REAL_DOCS_CLIENT_ID = "client-id";
    process.env.MEMORY_SECRET_OAUTH_REAL_DOCS_CLIENT_SECRET = "client-secret";
    try {
      const service = new MemoryService();
      service.registerConnectorManifest({
        id: "oauth-real-docs",
        name: "OAuth Real Docs",
        kind: "docs",
        version: "1.0.0",
        direction: "two_way",
        capabilities: ["ingest", "poll"],
        auth: "oauth",
        defaultSourceKind: "human",
        metadataMapping: {},
        oauth: {
          authorizeUrl: "https://auth.example.com/authorize",
          tokenUrl: `http://127.0.0.1:${port}/token`,
          clientIdRef: "secret://oauth-real-docs/client-id",
          clientSecretRef: "secret://oauth-real-docs/client-secret",
          scopes: ["docs.read"]
        },
        poll: { endpoint: "https://api.example.com/docs/poll" }
      });
      const session = service.beginConnectorOAuth("oauth-real-docs", { stateSalt: "unit" });
      const authorized = service.completeConnectorOAuth({ connectorId: "oauth-real-docs", state: session.state, code: "real-code" });
      expect(authorized.status).toBe("authorized");
      expect(authorized.tokenRef).toMatch(/^secret:\/\/oauth\/oauth-real-docs\/access\//);
      expect(authorized.refreshTokenRef).toMatch(/^secret:\/\/oauth\/oauth-real-docs\/refresh\//);
      expect(JSON.stringify(authorized)).not.toContain("raw-access-token");
      expect(JSON.stringify(authorized)).not.toContain("raw-refresh-token");
      const refreshed = service.refreshConnectorOAuth("oauth-real-docs");
      expect(refreshed.tokenRef).toMatch(/^secret:\/\/oauth\/oauth-real-docs\/access\//);
      expect(refreshed.tokenRef).not.toBe(authorized.tokenRef);
      expect(JSON.stringify(refreshed)).not.toContain("raw-access-token");
      expect(JSON.stringify(refreshed.metadata?.secretRef)).toContain("secret://oauth/");
      const revoked = service.revokeConnectorAuth("oauth-real-docs", "operator");
      expect(revoked[0].tokenRef).toBeUndefined();
      expect(revoked[0].refreshTokenRef).toBeUndefined();
      expect(revoked[0].revokedAt).toBeTruthy();
    } finally {
      delete process.env.MEMORY_SECRET_OAUTH_REAL_DOCS_CLIENT_ID;
      delete process.env.MEMORY_SECRET_OAUTH_REAL_DOCS_CLIENT_SECRET;
      tokenServer.kill();
    }
  }, 30_000);

  it("extracts local OCR, PDF OCR, ASR, and video frame metadata into auditable memories", () => {
    const service = new MemoryService();
    const image = service.ingestMedia(
      {
        role: "operator",
        content: "fixtures/media/operator-dashboard.png",
        mediaType: "image",
        uri: "file:///fixtures/media/operator-dashboard.png",
        mimeType: "image/png",
        metadata: { ocrText: "Operator dashboard shows connector health applied.", imageLabels: ["dashboard", "connector health"] }
      },
      { userId: "u1" }
    );
    const audio = service.ingestMedia(
      {
        role: "operator",
        content: "fixtures/media/release-review.wav",
        mediaType: "audio",
        language: "en",
        uri: "file:///fixtures/media/release-review.wav",
        mimeType: "audio/wav",
        metadata: { asrText: "Release review audio confirms the memory writeback adapter passed." }
      },
      { userId: "u1" }
    );
    const pdf = service.ingestMedia(
      {
        role: "operator",
        content: "fixtures/media/operator-brief.pdf",
        mediaType: "document",
        uri: "file:///fixtures/media/operator-brief.pdf",
        mimeType: "application/pdf",
        metadata: { ocrText: "Operator PDF snapshot confirms connector writeback and audit trail coverage." }
      },
      { userId: "u1" }
    );
    const video = service.ingestMedia(
      {
        role: "operator",
        content: "fixtures/media/demo-video.mp4",
        mediaType: "video",
        uri: "file:///fixtures/media/demo-video.mp4",
        mimeType: "video/mp4",
        metadata: {
          frames: [
            { at: "00:00:01", description: "Operator opens connector health panel.", text: "Connectors applied" },
            { at: "00:00:04", description: "Writeback status changes to applied." }
          ]
        }
      },
      { userId: "u1" }
    );

    expect(image.failures.some((failure) => failure.mediaType === "image")).toBe(false);
    expect(audio.failures.some((failure) => failure.mediaType === "audio")).toBe(false);
    expect(video.failures.some((failure) => failure.mediaType === "video")).toBe(false);
    expect(image.memories[0].content).toContain("connector health");
    expect(audio.memories[0].content).toContain("writeback adapter passed");
    expect(pdf.memories[0].content).toContain("audit trail coverage");
    expect(video.memories.map((memory) => memory.content).join(" ")).toContain("Writeback status changes to applied");
    expect(image.memories[0].metadata.extraction).toMatchObject({ mediaType: "image", uri: "file:///fixtures/media/operator-dashboard.png", mimeType: "image/png" });
    expect(audio.memories[0].metadata.originalMediaContent).toBe("fixtures/media/release-review.wav");
    expect(pdf.memories[0].metadata).toMatchObject({ originalMediaContent: "fixtures/media/operator-brief.pdf", mediaExtraction: { mode: "local", task: "ocr" } });
    expect(video.memories[0].metadata.mediaExtraction).toMatchObject({ mode: "local", task: "video_frames", frames: 2 });
  });

  it("plans source-specific connector writebacks and can deliver them over HTTP", async () => {
    const service = new MemoryService();
    const memory = service.add({ userId: "u1", content: "Connector writeback should preserve reviewed release decisions.", source: { kind: "human", confidence: 0.9 } });
    const initialTrust = memory.trust;
    const codePlan = await service.writebackConnector("official-code", {
      memoryIds: [memory.id],
      content: "Use this release decision in the pull request summary.",
      target: { repo: "cognilabz/cognibrain", path: "README.md", pullRequest: 99 },
      dryRun: true
    });
    expect(codePlan.status).toBe("queued");
    expect(codePlan.direction).toBe("export");
    expect(codePlan.adapter).toBe("code:comment");
    expect(codePlan.payload?.adapter).toBe("code.review_comment");
    expect(codePlan.payload?.memoryIds).toContain(memory.id);

    const received: Array<{ headers: Record<string, string | string[] | undefined>; body: string }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        received.push({ headers: request.headers, body });
        response.writeHead(202);
        response.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      service.registerConnectorManifest({
        id: "unit-chat-writeback",
        name: "Unit Chat Writeback",
        kind: "chat",
        version: "1.0.0",
        direction: "two_way",
        capabilities: ["ingest", "writeback"],
        auth: "token",
        defaultSourceKind: "transcript",
        metadataMapping: { channel: "metadata.channel" },
        writeback: { endpoint: `http://127.0.0.1:${address.port}/channels/{channel}`, authRef: "connector-secret", operations: ["summary"] }
      });
      const delivered = await service.writebackConnector("unit-chat-writeback", {
        operation: "summary",
        memoryIds: [memory.id],
        target: { channel: "support", threadId: "t-1" },
        content: "Release decision summary",
        dryRun: false
      });
      expect(delivered.status).toBe("applied");
      expect(delivered.responseStatusCode).toBe(202);
      expect(delivered.request?.url).toContain("/channels/support");
      expect(received).toHaveLength(1);
      const body = received[0].body;
      expect(JSON.parse(body).payload.adapter).toBe("chat.post_message");
      expect(received[0].headers["x-cognibrain-signature"]).toBe(`sha256=${createHmac("sha256", "connector-secret").update(body).digest("hex")}`);
      const feedback = service.recordConnectorFeedback({
        connectorId: "unit-chat-writeback",
        userId: "u1",
        kind: "accepted_change",
        content: "Connector accepted the release decision.",
        memoryIds: [memory.id],
        externalId: "t-1"
      });
      expect(feedback.record.payload?.feedbackAdapter).toBe("accepted_change");
      expect(feedback.updatedMemories[0].trust).toBeGreaterThan(initialTrust);
      expect(feedback.feedbackMemory.tags).toContain("connector-feedback");
      const acceptedTelemetry = service.recordConnectorTelemetry({
        connectorId: "unit-chat-writeback",
        harnessId: "cursor",
        userId: "u1",
        kind: "accepted_suggestion",
        content: "Cursor accepted the memory-backed summary.",
        memoryIds: [memory.id],
        externalId: "telemetry-1"
      });
      expect(acceptedTelemetry.record.payload?.telemetryKind).toBe("accepted_suggestion");
      expect(acceptedTelemetry.createdMemories[0].tags).toContain("connector-feedback");
      const toolTelemetry = service.recordConnectorTelemetry({
        connectorId: "unit-chat-writeback",
        harnessId: "codex",
        userId: "u1",
        kind: "tool_outcome",
        command: "npm test",
        tests: [{ name: "unit", status: "passed" }]
      });
      expect(toolTelemetry.createdMemories[0].tags).toContain("harness-action");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("lists, polls, ingests, and writebacks every official connector category with mock servers", async () => {
    const service = new MemoryService();
    const kinds = ["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage"] as const;
    const calls: Array<{ url?: string; body: string }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        calls.push({ url: request.url, body });
        const [, kind, action] = request.url?.split("/") ?? [];
        response.setHeader("content-type", "application/json");
        if (action === "list") {
          response.end(JSON.stringify({ items: [{ externalId: `${kind}-item-1`, title: `${kind} item` }] }));
          return;
        }
        if (action === "poll") {
          response.end(JSON.stringify({ events: [{ role: "user", content: `${kind} connector poll captured a durable release decision.`, externalId: `${kind}-event-1` }] }));
          return;
        }
        response.writeHead(202);
        response.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      const defaultSourceKind = (kind: (typeof kinds)[number]) => kind === "chat" ? "transcript" : kind === "code" ? "reviewed_code" : kind === "email" || kind === "calendar" ? "human" : "import";
      for (const kind of kinds) {
        const connectorId = `mock-${kind}`;
        service.registerConnectorManifest({
          id: connectorId,
          name: `Mock ${kind}`,
          kind,
          version: "1.0.0",
          direction: "two_way",
          capabilities: ["ingest", "poll", "writeback"],
          auth: "token",
          defaultSourceKind: defaultSourceKind(kind),
          metadataMapping: { externalId: "externalId" },
          privacyPolicy: "project",
          list: { endpoint: `http://127.0.0.1:${address.port}/${kind}/list` },
          poll: { endpoint: `http://127.0.0.1:${address.port}/${kind}/poll` },
          writeback: { endpoint: `http://127.0.0.1:${address.port}/${kind}/write/{externalId}`, operations: ["comment", "summary", "tag", "status", "memory_link"] }
        });
        const listed = await service.listConnectorItems(connectorId);
        expect(listed.status).toBe("applied");
        expect(listed.items[0].externalId).toBe(`${kind}-item-1`);
        const polled = await service.pollConnector(connectorId, { userId: "u1" });
        expect(polled.status).toBe("applied");
        expect(polled.memoryIds).toHaveLength(1);
        const writeback = await service.writebackConnector(connectorId, { externalId: `${kind}-item-1`, content: `${kind} writeback summary`, target: { externalId: `${kind}-item-1` }, dryRun: false });
        expect(writeback.status).toBe("applied");
        expect(writeback.responseStatusCode).toBe(202);
      }
      const health = service.connectorHealth();
      expect(health.filter((item) => item.connectorId.startsWith("mock-") && item.lastStatus === "applied")).toHaveLength(kinds.length);
      expect(calls.filter((call) => call.url?.includes("/poll")).length).toBe(kinds.length);
      expect(calls.filter((call) => call.url?.includes("/write/")).length).toBe(kinds.length);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("honors never-store connector privacy policy during polling", async () => {
    const service = new MemoryService();
    const server = createServer((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ events: [{ role: "user", content: "Never store connector event should remain outside memory.", externalId: "private-1" }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      service.registerConnectorManifest({
        id: "private-chat",
        name: "Private Chat",
        kind: "chat",
        version: "1.0.0",
        direction: "two_way",
        capabilities: ["ingest", "poll"],
        auth: "token",
        defaultSourceKind: "transcript",
        metadataMapping: {},
        privacyPolicy: "never_store",
        poll: { endpoint: `http://127.0.0.1:${address.port}/poll` }
      });
      const record = await service.pollConnector("private-chat", { userId: "u1" });
      expect(record.status).toBe("applied");
      expect(record.memoryIds).toHaveLength(0);
      expect(record.payload?.reason).toBe("privacy_policy_never_store");
      expect(service.list("u1")).toHaveLength(0);
      expect(service.connectorHealth("private-chat")[0].privacyPolicy).toBe("never_store");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("delivers webhooks with real HTTP POSTs and HMAC signatures", async () => {
    const received: Array<{ headers: Record<string, string | string[] | undefined>; body: string }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        received.push({ headers: request.headers, body });
        response.writeHead(204);
        response.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      const service = new MemoryService();
      service.registerWebhook({ url: `http://127.0.0.1:${address.port}/memory`, events: ["memory.write"], secretRef: "local-test-secret" });
      service.add({ userId: "u1", content: "Real webhook delivery posts memory events.", source: { kind: "human", confidence: 0.95 } });

      const delivery = await service.deliverWebhookQueueHttp();
      expect(delivery.delivered).toBe(1);
      expect(received).toHaveLength(1);
      const body = received[0].body;
      expect(JSON.parse(body).event.type).toBe("memory.write");
      expect(received[0].headers["x-cognibrain-event"]).toBe("memory.write");
      expect(received[0].headers["x-cognibrain-signature"]).toBe(`sha256=${createHmac("sha256", "local-test-secret").update(body).digest("hex")}`);
      expect(service.eventFeed().deliveries[0].lastStatusCode).toBe(204);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("learns from injection feedback, adapts dream policy, generates cited observations, and predicts prefetch context", () => {
    const service = new MemoryService({ autoDream: { enabled: true, intervalHours: 6, writeThreshold: 12 } });
    const first = service.add({
      userId: "u1",
      content: "Operator reviews graph evidence before every Friday release.",
      tags: ["release", "graph"],
      entities: ["operator", "release"],
      temporal: { eventAt: "2026-05-01T09:00:00.000Z" },
      source: { kind: "human", confidence: 0.94 }
    });
    service.add({
      userId: "u1",
      content: "Operator reviews benchmark proof before every Friday release.",
      tags: ["release", "benchmark"],
      entities: ["operator", "release"],
      temporal: { eventAt: "2026-05-08T09:00:00.000Z" },
      source: { kind: "human", confidence: 0.94 }
    });
    const risky = service.add({
      userId: "u1",
      content: "Unverified transcript claims the release uses a stale API.",
      tags: ["release", "needs-review"],
      entities: ["release"],
      source: { kind: "transcript", confidence: 0.34 }
    });

    const feedback = service.recordInjectionFeedback({
      userId: "u1",
      query: "release graph proof",
      injectedMemoryIds: [first.id, risky.id],
      acceptedMemoryIds: [first.id],
      rejectedMemoryIds: [risky.id],
      outcome: "accepted",
      signals: { graph: 0.9, trust: 0.8 }
    });
    expect(feedback.updatedMemories).toHaveLength(2);
    expect(feedback.learnedProfile.samples).toBeGreaterThanOrEqual(2);
    expect(service.getRetrievalProfiles().some((profile) => profile.id === "learned-injection")).toBe(true);

    const policy = service.adaptiveDreamPolicy("u1");
    expect(policy.recommended.writeThreshold).toBeLessThanOrEqual(12);
    expect(policy.rationale.join(" ")).toContain("feedback");

    const observations = service.generateObservations("u1", { persist: true, style: "descriptive" });
    expect(observations.observations.some((observation) => observation.citations.length >= 2 && observation.observationMemoryId)).toBe(true);
    expect(observations.observations[0].memoryIds.length).toBeGreaterThanOrEqual(2);

    const predictions = service.predictionReport("u1", { query: "Friday release review" });
    expect(predictions.predictions.some((prediction) => prediction.suggestedQuery.includes("Friday release review") || prediction.label.includes("release"))).toBe(true);
    expect(predictions.prefetch.length).toBeGreaterThan(0);
    expect(predictions.anomalies.some((anomaly) => anomaly.kind === "low_trust_recent_memory" || anomaly.kind === "pending_pattern_review")).toBe(true);
  });

  it("enforces brain membership, explicit shared-brain federation, consent updates, audit revert, storage status, and offline sync", () => {
    const service = new MemoryService();
    const brain = service.createBrain({
      name: "Federated Brain",
      ownerUserId: "owner",
      memberUserIds: ["member"],
      orgId: "org1",
      visibility: "team",
      consentRequired: true
    });
    const source = service.createSource({ brainId: brain.id, name: "Team Docs", kind: "docs", defaultConsent: { visibility: "org" } });

    expect(() =>
      service.add({
        brainId: brain.id,
        sourceId: source.id,
        userId: "outsider",
        orgId: "org1",
        content: "Outsider should not write to a team brain.",
        source: { kind: "human", confidence: 0.9 }
      })
    ).toThrow(/cannot write/);

    const shared = service.add({
      brainId: brain.id,
      sourceId: source.id,
      userId: "owner",
      orgId: "org1",
      content: "Federated brain keeps release architecture notes.",
      entities: ["federated brain", "release architecture"],
      source: { kind: "human", confidence: 0.95 }
    });

    expect(service.search({ userId: "member", orgId: "org1", query: "release architecture", includeSharedBrains: false })).toHaveLength(0);
    expect(service.search({ userId: "member", orgId: "org1", query: "release architecture", includeSharedBrains: true, brainIds: [brain.id] })[0].memory.id).toBe(shared.id);

    const consented = service.updateConsent(shared.id, { visibility: "public", allowTraining: true });
    expect(consented.consent.visibility).toBe("public");
    expect(service.auditTrail({ memoryId: shared.id }).some((event) => event.type === "memory.consent")).toBe(true);

    service.update(shared.id, { content: "Federated brain keeps outdated release notes." });
    const reverted = service.revertMemory(shared.id);
    expect(reverted.content).toContain("release architecture notes");
    expect(service.auditTrail({ memoryId: shared.id }).some((event) => event.type === "memory.revert")).toBe(true);

    const storage = service.storageStatus();
    expect(storage.adapters.some((adapter) => adapter.kind === "append-only-log" && adapter.distributedReady)).toBe(true);

    const queued = service.queueOfflineOperation({
      type: "add",
      userId: "member",
      input: {
        brainId: brain.id,
        sourceId: source.id,
        userId: "member",
        orgId: "org1",
        content: "Offline sync captured member deployment note.",
        source: { kind: "human", confidence: 0.9 }
      }
    });
    expect(queued.status).toBe("queued");
    const sync = service.syncOfflineOperations();
    expect(sync.applied).toHaveLength(1);
    expect(sync.remaining).toHaveLength(0);
    expect(service.search({ userId: "member", orgId: "org1", query: "deployment note" })[0].memory.content).toContain("Offline sync");
  });

  it("supports multi-agent subscriptions, shared-memory review, cross-brain federation, and persona defaults", () => {
    const service = new MemoryService();
    const team = service.createBrain({ name: "Team Brain", ownerUserId: "owner", memberUserIds: ["member"], orgId: "org1", visibility: "team", allowedAgentIds: ["agent-review"] });
    const org = service.createBrain({ name: "Org Brain", ownerUserId: "owner", orgId: "org1", visibility: "org" });
    const teamSource = service.createSource({ brainId: team.id, name: "Team Source", kind: "docs" });
    service.setPersona({
      id: "support",
      label: "Support",
      summaryStyle: "descriptive",
      privacyDefault: "org",
      retrievalWeights: { keyword: 0.5, trust: 0.3, graph: 0.2 }
    });
    service.registerAgent({
      id: "agent-review",
      name: "Review Agent",
      namespace: "review",
      brainIds: [team.id, org.id],
      permissions: ["read", "write", "share"],
      personaId: "support",
      subscriptions: { events: ["memory.write", "memory.share.request", "memory.share", "memory.share.revoke"], brainIds: [team.id] }
    });

    const privateMemory = service.add({
      brainId: team.id,
      sourceId: teamSource.id,
      userId: "member",
      agentId: "agent-review",
      orgId: "org1",
      content: "Support agent captured the release escalation playbook.",
      entities: ["release escalation"],
      source: { kind: "human", confidence: 0.94 }
    });
    expect(privateMemory.consent.visibility).toBe("org");

    const pending = service.requestSharedMemory(privateMemory.id, "org1", "agent-review", "Useful for team support.");
    expect((pending.metadata.shared as { status?: string }).status).toBe("pending");
    service.registerAgent({ id: "agent-readonly", name: "Read Only", namespace: "review", brainIds: [team.id], permissions: ["read"] });
    expect(() => service.reviewSharedMemory(privateMemory.id, { orgId: "org1", reviewerId: "agent-readonly", decision: "approve" })).toThrow(/cannot review/);
    const promoted = service.reviewSharedMemory(privateMemory.id, { orgId: "org1", reviewerId: "agent-review", decision: "approve", note: "Approved for hosted support workflow." });
    expect((promoted.metadata.shared as { status?: string }).status).toBe("approved");
    expect((promoted.metadata.shared as { reviewedBy?: string }).reviewedBy).toBe("agent-review");

    const federated = service.federatedSearch({ userId: "member", agentId: "agent-review", orgId: "org1", query: "release escalation", brainIds: [team.id, org.id] });
    expect(federated.searchedBrainIds).toContain(team.id);
    expect(federated.searchedBrainIds).toContain(org.id);
    expect(federated.results.some((result) => result.memory.id === privateMemory.id)).toBe(true);

    const feed = service.eventFeed({ agentId: "agent-review", brainId: team.id });
    expect(feed.auditEvents.some((event) => event.type === "memory.share.request")).toBe(true);
    expect(feed.auditEvents.every((event) => !event.brainId || event.brainId === team.id)).toBe(true);

    const search = service.search({ userId: "member", agentId: "agent-review", orgId: "org1", query: "release escalation" });
    expect(search[0].fusion?.components?.keyword).toBeGreaterThan(0);

    const revoked = service.revokeSharedMemory(privateMemory.id, "agent-review", "No longer approved.");
    expect((revoked.metadata.shared as { status?: string }).status).toBe("revoked");
    const link = service.linkIdentity("member", "member-device", "consent-token-hosted", "user");
    expect(link.hashedSubject).not.toContain("consent-token-hosted");
    service.unlinkIdentity(link.id);
    expect(service.auditTrail({ type: "memory.consent" }).some((event) => (event.metadata?.resource as string | undefined) === "identity-link")).toBe(true);
    expect(service.auditTrail({ memoryId: privateMemory.id }).some((event) => event.type === "memory.share.revoke")).toBe(true);
  });

  it("queries temporal intervals and mines recurring behavioural patterns for retrieval", () => {
    const service = new MemoryService();
    for (const timestamp of ["2026-05-01T09:00:00.000Z", "2026-05-08T09:00:00.000Z", "2026-05-15T09:00:00.000Z"]) {
      service.add({
        userId: "u1",
        content: "Mira reviews release notes on Friday mornings.",
        tags: ["review", "release"],
        entities: ["mira"],
        timestamp,
        temporal: { eventAt: timestamp },
        source: { kind: "human", confidence: 0.95 }
      });
    }
    service.add({
      userId: "u1",
      content: "Mira tested deployment on Monday.",
      tags: ["deploy"],
      timestamp: "2026-05-18T09:00:00.000Z",
      temporal: { eventAt: "2026-05-18T09:00:00.000Z" },
      source: { kind: "human", confidence: 0.95 }
    });

    const temporal = service.temporalQuery("u1", { after: "2026-05-07T00:00:00.000Z", before: "2026-05-16T00:00:00.000Z" });
    expect(temporal.events).toHaveLength(2);
    expect(temporal.changedEntities.some((entity) => entity.entity === "mira")).toBe(true);

    const patterns = service.behavioralPatterns("u1");
    expect(patterns.patterns.some((pattern) => pattern.cadence === "weekly:friday" && pattern.support >= 3 && typeof pattern.falsePositiveRisk === "number")).toBe(true);
    const friday = service.search({ userId: "u1", query: "Friday release habit", weights: { behavioral: 1, semantic: 0, keyword: 0, entity: 0, temporal: 0, trust: 0, graph: 0, access: 0 } });
    expect(friday[0].signals.behavioral).toBeGreaterThan(0.5);
  });

  it("stores engineering corrections, guards forbidden actions, and builds patch evidence", () => {
    const service = new MemoryService({
      autoDream: { enabled: false },
      intelligence: {
        engineeringClassifier: {
          classifyEngineering: () => ({
            kind: "generated_file_rule",
            confidence: 0.91,
            correctAction: "npm test",
            forbiddenAction: "pnpm test",
            command: "npm test"
          })
        }
      }
    });
    const wrong = service.recordHarnessAction({
      userId: "dev",
      agentId: "codex",
      projectId: "atlas",
      command: "pnpm test",
      cwd: "/repo/atlas",
      exitCode: 1,
      failureReason: "CI uses npm, not pnpm.",
      filesChanged: ["src/generated/api.generated.ts"],
      tests: [{ name: "npm test", status: "failed", output: "pnpm is unsupported" }]
    });
    const correction = service.recordCodeCorrection({
      userId: "dev",
      agentId: "reviewer",
      projectId: "atlas",
      previousMemoryId: wrong.id,
      content: "Do not use pnpm in this repo; use npm test and do not edit generated files.",
      kind: "repo_policy",
      correctAction: "npm test",
      codebase: { repo: "atlas", branch: "main", filePattern: "**/api.generated.ts" }
    });

    expect(service.get(wrong.id).beliefState).toBe("superseded");
    expect((correction.metadata.engineering as { kind?: string }).kind).toBe("repo_policy");
    expect(correction.temporal.verificationDueAt).toBeTruthy();
    const derived = (correction.metadata.correctionPipeline as { derivedMemoryIds: string[] }).derivedMemoryIds.map((id) => service.get(id));
    expect(derived.map((memory) => (memory.metadata.engineering as { kind?: string }).kind)).toEqual(expect.arrayContaining(["forbidden_action", "generated_file_rule", "procedure"]));
    expect(derived.find((memory) => (memory.metadata.engineering as { kind?: string }).kind === "procedure")?.type).toBe("procedural");

    const pack = service.codingContextPack({
      userId: "dev",
      projectId: "atlas",
      query: "what command should I run before changing validation",
      codebaseScope: { repo: "atlas", branch: "main" },
      tokenBudget: 900
    });
    expect(pack.sections.some((section) => section.id === "repo_policies" && section.evidence.some((item) => item.memoryId === correction.id))).toBe(true);

    const guard = service.guardAction({ userId: "dev", projectId: "atlas", action: "pnpm test", codebaseScope: { repo: "atlas" } });
    expect(guard.severity).toBe("block");
    expect(guard.alternatives).toContain("npm test");

    const trail = service.patchEvidenceTrail({
      userId: "dev",
      projectId: "atlas",
      task: "fix validation",
      filesChanged: ["src/validation/userValidation.ts"],
      commandsRun: ["npm test"],
      memoryIds: [wrong.id, correction.id, ...derived.map((memory) => memory.id)]
    });
    expect(trail.correctionIds).toContain(correction.id);
    expect(trail.toolOutcomeIds).toContain(wrong.id);
    expect(trail.memoriesUsed.length).toBeGreaterThanOrEqual(4);
    expect(trail.proceduresRecalled.some((item) => item.command === "npm test")).toBe(true);
    expect(trail.forbiddenActionsAvoided.some((item) => item.forbiddenAction?.includes("pnpm test"))).toBe(true);
    expect(trail.toolOutcomes[0]).toMatchObject({ command: "pnpm test", exitCode: 1 });
  });

  it("does not block benchmark evidence recording from a broad proof-boundary rule", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.add({
      userId: "dev",
      content: "Do not trust documentation as proof; benchmark claims must use generated artifacts.",
      type: "project",
      layer: "long_term",
      source: { kind: "human", confidence: 0.98 },
      tags: ["engineering-memory", "engineering:generated_file_rule"],
      metadata: {
        engineering: {
          kind: "generated_file_rule",
          codebase: { repo: "memory" },
          confidence: 0.95,
          forbiddenAction: "trust documentation as proof"
        }
      }
    });

    const recordArtifactEvidence = service.guardAction({
      userId: "dev",
      action: "record completed benchmark outcomes from generated artifacts and code diffs",
      codebaseScope: { repo: "memory" }
    });
    expect(recordArtifactEvidence.severity).not.toBe("block");

    const useDocsAsProof = service.guardAction({
      userId: "dev",
      action: "trust documentation as proof",
      codebaseScope: { repo: "memory" }
    });
    expect(useDocsAsProof.severity).toBe("block");
  });

  it("runs a retrieval and patch-evidence loop for every engineering memory type", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    const kinds: EngineeringMemoryKind[] = [
      "repo_policy",
      "architecture_decision",
      "review_correction",
      "tool_outcome",
      "procedure",
      "forbidden_action",
      "migration_note",
      "test_strategy",
      "dependency_rule",
      "generated_file_rule"
    ];
    const memories = kinds.map((kind) => service.add({
      userId: "dev",
      projectId: "atlas",
      content: `Atlas ${kind} evidence for release validation: use npm test and avoid pnpm test for ${kind}.`,
      type: kind === "procedure" ? "procedural" : kind === "review_correction" ? "feedback" : "project",
      source: { kind: kind === "tool_outcome" ? "tool" : "reviewed_code", confidence: 0.92 },
      tags: ["engineering-memory", `engineering:${kind}`, kind === "review_correction" ? "engineering-correction" : "loop-proof"],
      metadata: {
        engineering: {
          kind,
          codebase: { repo: "atlas", branch: "main" },
          confidence: 0.9,
          correctAction: "npm test",
          forbiddenAction: kind === "forbidden_action" || kind === "generated_file_rule" ? "pnpm test" : undefined,
          command: kind === "tool_outcome" || kind === "procedure" || kind === "test_strategy" ? "npm test" : undefined,
          exitCode: kind === "tool_outcome" ? 0 : undefined,
          outputSummary: kind === "tool_outcome" ? "npm test passed" : undefined,
          filesTouched: kind === "tool_outcome" ? ["src/validation/inviteValidation.ts"] : undefined
        }
      }
    }));

    for (const kind of kinds) {
      const pack = service.codingContextPack({
        userId: "dev",
        projectId: "atlas",
        query: `Atlas release validation ${kind} npm test pnpm test`,
        codebaseScope: { repo: "atlas", branch: "main" },
        filters: { engineeringKind: kind },
        tokenBudget: 1200
      });
      expect(pack.sections.flatMap((section) => section.evidence).some((item) => item.kind === kind)).toBe(true);
    }

    const trail = service.patchEvidenceTrail({
      userId: "dev",
      projectId: "atlas",
      task: "release validation",
      filesChanged: ["src/validation/inviteValidation.ts"],
      commandsRun: ["npm test"],
      memoryIds: memories.map((memory) => memory.id)
    });
    expect(trail.memoriesUsed.map((item) => item.kind)).toEqual(expect.arrayContaining(kinds));
    expect(trail.correctionIds.length).toBeGreaterThan(0);
    expect(trail.proceduresRecalled.some((item) => item.command === "npm test")).toBe(true);
    expect(trail.forbiddenActionsAvoided.some((item) => item.forbiddenAction === "pnpm test")).toBe(true);
    expect(trail.toolOutcomes.some((item) => item.command === "npm test" && item.exitCode === 0)).toBe(true);
  });
});
