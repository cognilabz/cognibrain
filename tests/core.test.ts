import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
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
import { CognibrainClient, CognibrainError } from "../src/sdk/client";
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

describe("TypeScript memory core", () => {
  it("retrieves with trust-aware multi-signal ranking", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Project Atlas uses TypeScript and line citations.",
      entities: ["atlas", "typescript", "citations"],
      source: { kind: "human", confidence: 0.98 }
    });
    store.add({
      userId: "u1",
      content: "Transcript guessed Atlas uses Ruby.",
      entities: ["atlas", "ruby"],
      source: { kind: "transcript", confidence: 0.2 }
    });
    const results = new RetrievalEngine(store).search({ userId: "u1", query: "What does Atlas use?", limit: 2 });
    expect(results[0].memory.content).toContain("TypeScript");
    expect(results[0].signals.trust).toBeGreaterThan(results[1].signals.trust);
  });

  it("normalizes question helper words and everyday aliases for recall", () => {
    expect(tokenize("When did Melanie paint a sunrise?")).toEqual(["melanie", "paint", "sun"]);
    expect(tokenize("The kids and children de-stress by relaxing.")).toEqual(["child", "child", "relax", "relax"]);

    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Melanie shared a painting of a sunset over a lake.",
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2025-01-01T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Melanie said she did a horse painting recently.",
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2026-01-01T10:00:00.000Z"
    });

    const results = new RetrievalEngine(store).search({
      userId: "u1",
      query: "When did Melanie paint a sunrise?",
      limit: 2,
      now: new Date("2026-02-01T10:00:00.000Z")
    });

    expect(results[0].memory.content).toContain("sunset over a lake");
  });

  it("extracts lowercase compound entities for zero-dependency entity linking", () => {
    const entities = extractEntities("The operator gate blocks transcript injection until human verification.");
    expect(entities).toContain("operator gate");
    expect(entities).toContain("transcript injection");

    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "The operator gate blocks transcript injection until human verification.",
      source: { kind: "human", confidence: 0.96 }
    });
    const results = new RetrievalEngine(store).search({ userId: "u1", query: "What does the operator gate do?", limit: 1 });
    expect(results[0].memory.content).toContain("blocks transcript injection");
    expect(results[0].signals.entity).toBeGreaterThan(0);
  });

  it("extracts coding entities and normalizes common multilingual aliases", () => {
    expect(tokenize("Das Repo nutzt eine Datenbank und CLI modules.")).toContain("repository");
    expect(tokenize("Das Repo nutzt eine Datenbank und CLI modules.")).toContain("database");

    const entities = extractEntities("POST /v1/cache calls CacheClient.get and imports @scope/pkg.");
    expect(entities).toContain("post /v1/cache");
    expect(entities).toContain("cacheclient.get");
    expect(entities).toContain("@scope/pkg");
  });

  it("supports configurable retrieval weights", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Old trusted Atlas memory mentions release policy.",
      source: { kind: "human", confidence: 0.98 },
      timestamp: "2025-01-01T00:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Fresh low-trust Atlas note mentions release policy.",
      source: { kind: "agent", confidence: 0.45 },
      timestamp: "2026-05-01T00:00:00.000Z"
    });

    const trustFirst = new RetrievalEngine(store, { trust: 1, temporal: 0, semantic: 0, keyword: 0, entity: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "Atlas release policy",
      now: new Date("2026-05-02T00:00:00.000Z")
    });
    const recencyFirst = new RetrievalEngine(store, { trust: 0, temporal: 1, semantic: 0, keyword: 0, entity: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "Atlas release policy",
      now: new Date("2026-05-02T00:00:00.000Z")
    });

    expect(trustFirst[0].memory.content).toContain("Old trusted");
    expect(recencyFirst[0].memory.content).toContain("Fresh low-trust");
  });

  it("supports optional dynamic reranking before verification", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Atlas stores cache entries in Redis.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-01T00:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas cache policy was discussed recently.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-20T00:00:00.000Z"
    });

    const results = new RetrievalEngine(store).search({ userId: "u1", query: "Redis cache", now: new Date("2026-05-21T00:00:00.000Z") });
    expect(results[0].memory.content).toContain("Redis");
    expect(results[0].explanation?.some((item) => item.includes("rerank coverage"))).toBe(true);
  });

  it("uses BM25-style lexical ranking for repeated exact query terms", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Atlas cache cache cache incidents mention Redis once.", source: { kind: "human", confidence: 0.95 } });
    store.add({ userId: "u1", content: "Atlas cache policy mentions storage in a general way.", source: { kind: "human", confidence: 0.95 } });
    const results = new RetrievalEngine(store, { keyword: 1, semantic: 0, entity: 0, temporal: 0, trust: 0, graph: 0, access: 0 }).search({ userId: "u1", query: "cache cache Redis", limit: 2 });
    expect(results[0].memory.content).toContain("Redis");
    expect(results[0].signals.keyword).toBeGreaterThan(results[1].signals.keyword);
  });

  it("uses SQLite FTS5 BM25 scores as an indexed lexical retrieval provider", () => {
    if (!sqliteAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-fts-"));
    try {
      const sqlite = new SQLitePersistenceAdapter(join(dir, "memory.sqlite"));
      const service = new MemoryService({ persistence: sqlite });
      const target = service.add({ userId: "u1", content: "Orion release release release postmortem names Bluebird as the blocking migration.", source: { kind: "human", confidence: 0.95 } });
      service.add({ userId: "u1", content: "Orion release notes mention cache cleanup and deployment owners.", source: { kind: "human", confidence: 0.95 } });

      const indexedHits = sqlite.lexicalSearch("release Bluebird", { memoryIds: service.store.list().map((memory) => memory.id), limit: 2 });
      expect(indexedHits[0].memoryId).toBe(target.id);
      expect(indexedHits[0].explanation).toContain("fts5");

      const results = service.search({
        userId: "u1",
        query: "release Bluebird",
        weights: { keyword: 1, semantic: 0, entity: 0, temporal: 0, behavioral: 0, trust: 0, graph: 0, access: 0 },
        limit: 2
      });
      expect(results[0].memory.id).toBe(target.id);
      expect(results[0].explanation?.join(" ")).toContain("lexical sqlite-fts");
      expect(service.storageStatus().adapters.find((adapter) => adapter.kind === "sqlite")?.lexical?.strategy).toBe("sqlite-fts5");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses an optional vector backend to improve semantic retrieval without API keys", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "The automobile maintenance checklist lives in the garage binder.", source: { kind: "human", confidence: 0.95 } });
    store.add({ userId: "u1", content: "Banana bread recipes use ripe fruit and cinnamon.", source: { kind: "human", confidence: 0.95 } });
    const embeddingProvider = {
      id: "test-synonym-vector",
      embed(input: string) {
        const lower = input.toLowerCase();
        if (/(car|automobile|vehicle|garage)/.test(lower)) return [1, 0, 0];
        if (/(banana|fruit|recipe)/.test(lower)) return [0, 1, 0];
        return [0, 0, 1];
      }
    };
    const results = new RetrievalEngine(store, { semantic: 1, keyword: 0, entity: 0, temporal: 0, behavioral: 0, trust: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "car checklist",
      embeddingProvider,
      limit: 2
    });
    expect(results[0].memory.content).toContain("automobile");
    expect(results[0].signals.semantic).toBe(1);
    expect(results[0].explanation?.join(" ")).toContain("vector test-synonym-vector");
  });

  it("supports OpenAI-compatible embedding adapters and privacy embedding disable", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "The automobile maintenance checklist lives in the garage binder.", source: { kind: "human", confidence: 0.95 } });
    store.add({ userId: "u1", content: "Banana bread recipes use ripe fruit and cinnamon.", source: { kind: "human", confidence: 0.95 } });
    const provider = new OpenAICompatibleEmbeddingProvider({
      model: "local-test-embedding",
      request: (payload) => {
        const input = String(payload.input).toLowerCase();
        const embedding = /(car|automobile|vehicle|garage)/.test(input) ? [1, 0, 0] : /(banana|fruit|recipe)/.test(input) ? [0, 1, 0] : [0, 0, 1];
        return { data: [{ embedding }] };
      }
    });
    const vectorResults = new RetrievalEngine(store, { semantic: 1, keyword: 0, entity: 0, temporal: 0, behavioral: 0, trust: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "car checklist",
      embeddingProvider: provider,
      limit: 2
    });
    expect(vectorResults[0].memory.content).toContain("automobile");
    expect(vectorResults[0].explanation?.join(" ")).toContain("openai-compatible:local-test-embedding");

    const previous = process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS;
    process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS = "true";
    try {
      const disabledResults = new RetrievalEngine(store, { semantic: 1, keyword: 1, entity: 0, temporal: 0, behavioral: 0, trust: 0, graph: 0, access: 0 }).search({
        userId: "u1",
        query: "automobile checklist",
        embeddingProvider: { id: "must-not-run", embed: () => { throw new Error("embedding provider should be disabled"); } },
        limit: 1
      });
      expect(disabledResults[0].memory.content).toContain("automobile");
      expect(disabledResults[0].explanation?.join(" ")).not.toContain("must-not-run");
    } finally {
      if (previous === undefined) delete process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS;
      else process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS = previous;
    }
  });

  it("keeps scoped and private memories out of unrelated retrieval", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      sessionId: "s1",
      appId: "app-a",
      content: "Session s1 uses the private launch checklist.",
      consent: { visibility: "private" },
      source: { kind: "human", confidence: 0.96 }
    });
    store.add({
      userId: "u1",
      sessionId: "s2",
      appId: "app-a",
      content: "Session s2 uses the public launch checklist.",
      source: { kind: "human", confidence: 0.96 }
    });
    const retrieval = new RetrievalEngine(store);
    expect(retrieval.search({ userId: "u1", appId: "app-a", query: "launch checklist", includePrivate: false })).toHaveLength(1);
    expect(retrieval.search({ userId: "u1", sessionId: "s1", query: "private launch checklist", includePrivate: true })[0].memory.content).toContain("private");
  });

  it("enforces org visibility and retention before retrieval", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      orgId: "org-a",
      content: "Org A uses the shared rollout calendar.",
      consent: { visibility: "org" },
      source: { kind: "human", confidence: 0.96 }
    });
    store.add({
      userId: "u1",
      content: "Expired memory mentions the rollout calendar.",
      consent: { visibility: "user", retentionUntil: "2026-01-01T00:00:00.000Z" },
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2025-12-01T00:00:00.000Z"
    });

    const retrieval = new RetrievalEngine(store);
    const now = new Date("2026-02-01T00:00:00.000Z");
    expect(retrieval.search({ userId: "u1", query: "rollout calendar", now })).toHaveLength(0);
    expect(retrieval.search({ userId: "u1", orgId: "org-b", query: "rollout calendar", now })).toHaveLength(0);
    expect(retrieval.search({ userId: "u1", orgId: "org-a", query: "rollout calendar", now })[0].memory.content).toContain("Org A");
  });

  it("demotes low-trust contradictions during reflection", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Mira prefers verbose reports.", source: { kind: "agent", confidence: 0.4 } });
    store.add({ userId: "u1", content: "Mira prefers concise reports.", source: { kind: "human", confidence: 0.99 } });
    const report = new ReflectionEngine(store).run("u1");
    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(store.list("u1").some((memory) => memory.trust < 0.5 || memory.archivedAt)).toBe(true);
    expect(report.lifecycle.qualityScore).toBeGreaterThan(0);
  });

  it("detects multilingual contradictions and supports an external contradiction classifier", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Mira nutzt Redis fuer Cache.", source: { kind: "agent", confidence: 0.5 } });
    store.add({ userId: "u1", content: "Mira nutzt Postgres fuer Cache.", source: { kind: "human", confidence: 0.99 } });

    const report = new ReflectionEngine(store, {
      contradictionDetector: {
        classify: () => ({ label: "contradiction", confidence: 0.91, reason: "external classifier conflict" })
      }
    }).run("u1");

    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(report.contradictions[0].detector).toBe("external");
    expect(report.contradictions[0].reason).toBe("external classifier conflict");
  });

  it("uses optional generated reflection summaries while preserving provenance", () => {
    const store = new MemoryStore();
    for (const content of ["Atlas requires API proof.", "Atlas requires browser proof.", "Atlas requires simulator proof."]) {
      store.add({ userId: "u1", content, tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    }

    const report = new ReflectionEngine(store, {
      summarizer: {
        summarize: ({ theme }) => ({
          content: `Generated ${theme} summary with audit-safe provenance.`,
          confidence: 0.77,
          metadata: { provider: "test-summarizer" }
        })
      }
    }).run("u1");

    const summary = report.created.find((memory) => memory.metadata.dreamJob === "cluster-summary");
    expect(summary?.content).toContain("Generated atlas summary");
    expect(summary?.metadata.summaryMode).toBe("external");
    expect(summary?.metadata.summaryOf).toHaveLength(3);
  });

  it("uses a JSON command provider for reranking, verification, contradiction classification, and summaries", () => {
    const script = `
      const fs = require("node:fs");
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      if (input.task === "rerank") console.log(JSON.stringify({ ranking: input.results.map((item) => item.id).reverse() }));
      if (input.task === "verify") console.log(JSON.stringify({ decisions: [{ id: input.results[0].id, decision: "warn", reason: "provider warning" }] }));
      if (input.task === "contradiction") console.log(JSON.stringify({ label: "contradiction", confidence: 0.88, reason: "provider contradiction" }));
      if (input.task === "summarize") console.log(JSON.stringify({ content: "Atlas provider summary from external intelligence.", confidence: 0.81 }));
      if (input.task === "translate") console.log(JSON.stringify({ translated: "Atlas memory provider translation.", confidence: 0.82 }));
    `;
    const provider = new JsonCommandMemoryIntelligence({ command: process.execPath, args: ["-e", script] });
    const service = new MemoryService({
      intelligence: { reranker: provider, verifier: provider, contradictionDetector: provider, summarizer: provider, translator: provider }
    });
    service.add({ userId: "u1", content: "Atlas first cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u1", content: "Atlas second cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u1", content: "Atlas third cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });

    const search = service.search({ userId: "u1", query: "Atlas cache", limit: 2 });
    expect(search[0].decision).toBe("warn");
    expect(search[0].explanation?.join(" ")).toContain("provider verify");

    const report = service.dream("u1");
    expect(report.contradictions[0]?.reason).toBe("provider contradiction");
    expect(report.created.some((memory) => memory.content.includes("provider summary"))).toBe(true);
    expect(service.translateText("Atlas Speicher", "de").translated).toBe("Atlas memory provider translation.");
  });

  it("schedules verification for time-sensitive stale memories", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "The current target repo is /old/path.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-01-01T00:00:00.000Z",
      temporal: { lastConfirmedAt: "2026-01-01T00:00:00.000Z" }
    });
    const report = new ReflectionEngine(store, { verificationAfterDays: 10 }).run("u1", new Date("2026-02-01T00:00:00.000Z"));
    const memory = store.list("u1")[0];
    expect(memory.temporal.verificationDueAt).toBeDefined();
    expect(report.lifecycle.actions.some((action) => action.includes("scheduled stale memory verification"))).toBe(true);
  });

  it("creates temporal and behavioral reflection memories from repeated evidence", () => {
    const store = new MemoryStore();
    for (const day of [1, 2, 3, 4]) {
      store.add({
        userId: "u1",
        content: `Mira prefers Thai food on Friday observation ${day}.`,
        source: { kind: "human", confidence: 0.94 },
        tags: ["preference", "mira"],
        timestamp: `2026-05-0${day}T12:00:00.000Z`
      });
    }
    const report = new ReflectionEngine(store).run("u1", new Date("2026-05-23T00:00:00.000Z"));
    expect(report.created.some((memory) => memory.metadata.dreamJob === "temporal-summary")).toBe(true);
    expect(report.created.some((memory) => memory.metadata.dreamJob === "behavior-pattern")).toBe(true);
  });

  it("runs a full dream lifecycle: summarize, fade, archive, reevaluate, and reorganize", () => {
    const store = new MemoryStore();
    const now = new Date("2026-05-22T10:00:00.000Z");
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires simulator proof.",
      tags: ["atlas", "release"],
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-01T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires browser screenshots.",
      tags: ["atlas", "release"],
      source: { kind: "reviewed_code", confidence: 0.92 },
      timestamp: "2026-05-02T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires backend evidence.",
      tags: ["atlas", "release"],
      source: { kind: "human", confidence: 0.94 },
      timestamp: "2026-05-03T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Run npm run verify before publishing a release.",
      tags: ["procedure", "release"],
      source: { kind: "human", confidence: 0.9 },
      timestamp: "2026-05-04T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Transcript guessed Atlas uses Perl.",
      tags: ["atlas"],
      source: { kind: "transcript", confidence: 0.1 },
      timestamp: "2025-11-01T10:00:00.000Z"
    });

    const report = new ReflectionEngine(store).run("u1", now);
    const memories = store.list("u1");

    const reflection = report.created.find((memory) => memory.layer === "reflection" && memory.content.includes("Reflection on atlas"));
    expect(reflection).toBeDefined();
    expect(reflection?.metadata.dreamedAt).toBe(now.toISOString());
    expect(report.lifecycle.summarized).toBeGreaterThan(0);
    expect(report.lifecycle.faded).toBeGreaterThan(0);
    expect(report.lifecycle.archived).toBeGreaterThan(0);
    expect(report.lifecycle.reorganized).toBeGreaterThan(0);
    expect(report.lifecycle.evaluated).toBe(5);
    expect(report.lifecycle.qualityScore).toBeGreaterThan(0.7);
    const procedure = memories.find((memory) => memory.content.includes("npm run verify") && memory.layer === "procedural");
    expect(procedure).toBeDefined();
    expect(procedure?.metadata.reorganizedAt).toBe(now.toISOString());
    expect(memories.some((memory) => memory.content.includes("Perl") && memory.archivedAt)).toBe(true);
  });

  it("supports harness before and after hooks", () => {
    const store = new MemoryStore();
    const retrieval = new RetrievalEngine(store);
    const api = {
      add: store.add.bind(store),
      search: (input: { userId: string; query: string; limit: number }) => retrieval.search(input)
    };
    store.add({ userId: "u1", content: "Use simulator proof for parity claims.", source: { kind: "human", confidence: 0.95 } });
    const hook = new HarnessMemoryHook(api);
    const prepared = hook.beforeLlmCall({ userId: "u1", prompt: "How do we claim parity?" });
    expect(prepared.memoryContext).toContain("simulator proof");
    hook.afterLlmCall({ userId: "u1", prompt: "How do we claim parity?" }, "Run simulator and cite evidence.");
    expect(store.list("u1").length).toBe(2);
  });

  it("runs the harness golden path from context to patch evidence", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    const codebaseScope = { repo: "demo-claude-code", branch: "main", harness: "claude" };
    service.recordCodeCorrection({
      userId: "dev",
      projectId: "demo-claude-code",
      content: "Do not use pnpm in demo-claude-code; use npm test before release.",
      kind: "repo_policy",
      correctAction: "npm test",
      codebase: codebaseScope
    });
    service.recordCodeCorrection({
      userId: "dev",
      projectId: "demo-claude-code",
      content: "Before editing validation in demo-claude-code, inspect the validation folder and run npm test.",
      kind: "procedure",
      correctAction: "inspect validation and run npm test",
      codebase: codebaseScope
    });

    const hook = new HarnessMemoryHook(service, { maxMemories: 8, tokenBudget: 700 });
    const context = {
      userId: "dev",
      agentId: "claude-code",
      appId: "claude",
      projectId: "demo-claude-code",
      prompt: "Fix validation without repeating old command mistakes.",
      codebaseScope
    };
    const session = hook.startSession(context);
    const preTool = hook.beforeToolCall(context, { command: "pnpm test", cwd: "/repo/demo-claude-code" });
    const action = hook.afterToolCall(context, {
      command: "npm test",
      cwd: "/repo/demo-claude-code",
      exitCode: 0,
      filesChanged: ["src/validation/userValidation.ts"],
      tests: [{ name: "npm test", status: "passed", output: "ok" }]
    });
    const correction = hook.captureCorrection(context, {
      content: "Reviewer correction: store Claude Code package-manager corrections and attach patch evidence.",
      previousWrongAction: "pnpm test",
      correctAction: "npm test",
      kind: "review_correction",
      evidenceIds: action ? [action.id] : []
    });
    const trail = hook.finishPatch(context, {
      task: "fix validation",
      filesChanged: ["src/validation/userValidation.ts"],
      commandsRun: ["npm test"],
      memoryIds: [action?.id, correction?.id].filter((id): id is string => Boolean(id))
    });

    expect(session.codingContextPack?.sections.some((section) => section.evidence.length > 0)).toBe(true);
    expect(preTool.procedures.some((result) => result.memory.content.includes("Before editing validation"))).toBe(true);
    expect(preTool.guard?.severity).toBe("block");
    expect(preTool.guard?.alternatives).toContain("npm test");
    expect(action?.tags).toEqual(expect.arrayContaining(["harness-action", "success-pattern"]));
    expect(correction?.tags).toEqual(expect.arrayContaining(["engineering-correction", "engineering:review_correction"]));
    expect(trail?.toolOutcomeIds).toContain(action?.id);
    expect(trail?.correctionIds).toContain(correction?.id);
  });

  it("keeps harness memory context inside the configured token budget", () => {
    const store = new MemoryStore();
    const retrieval = new RetrievalEngine(store);
    const api = {
      add: store.add.bind(store),
      search: (input: { userId: string; query: string; limit: number }) => retrieval.search(input)
    };
    store.add({
      userId: "u1",
      content: "Atlas migration requires simulator proof and backend evidence.",
      source: { kind: "human", confidence: 0.95 }
    });
    store.add({
      userId: "u1",
      content: "Atlas dashboard parity requires browser screenshots and interaction checks.",
      source: { kind: "human", confidence: 0.95 }
    });

    const hook = new HarnessMemoryHook(api, { maxMemories: 4, tokenBudget: 40 });
    const prepared = hook.beforeLlmCall({ userId: "u1", prompt: "Atlas proof" });

    expect(prepared.memories.length).toBeGreaterThan(1);
    expect(prepared.memoryContext).toContain("Atlas");
    expect(prepared.memoryContext).not.toContain("browser screenshots");
  });

  it("reports health metrics", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Pinned policy memory.", pinned: true, source: { kind: "human", confidence: 1 } });
    const health = healthReport(store, "u1");
    expect(health.healthScore).toBeGreaterThan(0.5);
    expect(health.active).toBe(1);
  });

  it("exposes MCP-compatible memory tool handlers", () => {
    const handlers = createMemoryToolHandlers(new MemoryService());
    const added = handlers.add({
      userId: "u1",
      content: "Codex should use LoCoMo evidence recall for certified memory benchmarks.",
      tags: ["benchmark", "locomo"],
      sourceKind: "human",
      sourceConfidence: 0.98
    });
    expect(added.content).toContain("LoCoMo");

    const search = handlers.search({ userId: "u1", query: "certified benchmark", limit: 3 });
    expect(search[0].memory.content).toContain("LoCoMo");

    const pack = handlers.contextPack({ userId: "u1", query: "LoCoMo", tokenBudget: 120 });
    expect(pack.context).toContain("LoCoMo");
    expect(pack.evidencePack.results[0].retrieval.explanation.length).toBeGreaterThan(0);
    expect(pack.evidencePack.results[0].retrieval.citation).toBeTruthy();

    const evidence = handlers.evidencePack({ contextPackId: pack.evidencePack.id });
    expect(evidence.id).toBe(pack.evidencePack.id);

    const policy = handlers.policyCheck({ operation: "retrieve", memoryId: added.id, actor: { userId: "u1" } });
    expect(policy.allowed).toBe(true);
    const verified = handlers.verifyClaim({ userId: "u1", claim: "Codex should use LoCoMo evidence recall", limit: 3 });
    expect(verified.verdict).toBe("supported");
    expect(verified.evidence[0].citation).toBeTruthy();

    handlers.add({
      userId: "u1",
      content: "Before certified benchmark release, run npm test and npm run benchmark:nextgen.",
      type: "procedural",
      layer: "procedural",
      sourceKind: "human",
      sourceConfidence: 0.98
    });
    expect(handlers.procedureRecall({ userId: "u1", query: "before benchmark release" })[0].memory.type).toBe("procedural");
    expect(handlers.actionRecord({ userId: "u1", command: "npm test", tests: [{ name: "vitest", status: "passed" }] }).tags).toContain("harness-action");

    const health = handlers.health({ userId: "u1" });
    expect(health.active).toBeGreaterThanOrEqual(3);

    const dream = handlers.dream({ userId: "u1" });
    expect(dream.lifecycle.evaluated).toBeGreaterThan(0);

    const maintenance = handlers.maintenance();
    expect(maintenance.enabled).toBe(false);
  });

  it("exports evidence packs that explain why memories were used", () => {
    const service = new MemoryService();
    service.add({
      userId: "u1",
      orgId: "org1",
      content: "Atlas release requires npm test before publish.",
      entities: ["atlas", "release"],
      tags: ["procedure"],
      source: { kind: "reviewed_code", uri: "file://AGENTS.md", lineStart: 7, lineEnd: 9, confidence: 0.97 },
      consent: { visibility: "org" },
      temporal: { validFrom: "2026-05-01T00:00:00.000Z", lastConfirmedAt: "2026-05-20T00:00:00.000Z" }
    });
    service.add({
      userId: "u1",
      content: "Atlas private draft should stay hidden.",
      entities: ["atlas"],
      source: { kind: "human", confidence: 0.95 },
      consent: { visibility: "private" }
    });

    const pack = service.evidencePack({ userId: "u1", orgId: "org1", query: "Why run tests before Atlas release?", tokenBudget: 500, limit: 5 });
    expect(pack.id).toMatch(/^ctx_/);
    expect(pack.context).toContain("npm test");
    expect(pack.results[0].retrieval.signals.trust).toBeGreaterThan(0);
    expect(pack.results[0].retrieval.explanation.length).toBeGreaterThan(0);
    expect(pack.results[0].retrieval.whyIncluded.length).toBeGreaterThan(0);
    expect(pack.results[0].retrieval.whyNotExcluded).toContain("policy allowed for actor and scope");
    expect(pack.results[0].retrieval.scoreBreakdown?.finalScore).toBeGreaterThan(0);
    expect(pack.results[0].policyDecision?.allowed).toBe(true);
    expect(pack.results[0].retrieval.citation).toContain("AGENTS.md:7");
    expect(pack.results[0].validity.validFrom).toBe("2026-05-01T00:00:00.000Z");
    expect(pack.results.some((result) => result.content.includes("private draft"))).toBe(false);
    expect(pack.hash).toBeTruthy();
    expect(pack.actor?.userId).toBe("u1");
    expect(pack.scope?.orgId).toBe("org1");
    expect(pack.policyDecisions?.some((decision) => decision.allowed)).toBe(true);
    expect(pack.temporalState?.valid).toBeGreaterThan(0);
    expect(service.getEvidencePack(pack.id).id).toBe(pack.id);
  });

  it("persists evidence packs by context pack id", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-evidence-"));
    try {
      const path = join(dir, "memory.json");
      const first = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      first.add({ userId: "u1", content: "Atlas release context pack is exportable.", source: { kind: "human", confidence: 0.94 } });
      const pack = first.evidencePack({ userId: "u1", query: "release context pack", limit: 3 });
      const second = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      expect(second.getEvidencePack(pack.id).context).toContain("Atlas release context pack");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores MemoryRecordV2 fields and enforces belief-state retrieval decisions", () => {
    const service = new MemoryService();
    const active = service.add({
      userId: "u1",
      content: "Atlas uses Vitest for release checks.",
      source: { kind: "reviewed_code", uri: "file://package.json", lineStart: 10, confidence: 0.96 },
      temporal: { validFrom: "2026-05-01T00:00:00.000Z" }
    });
    const review = service.add({
      userId: "u1",
      content: "Atlas release checks might be outdated.",
      beliefState: "needs_verification",
      source: { kind: "agent", confidence: 0.7 },
      temporal: { verificationDueAt: "2026-05-01T00:00:00.000Z" }
    });
    service.add({
      userId: "u1",
      content: "Atlas uses an obsolete release checklist.",
      beliefState: "retracted",
      source: { kind: "human", confidence: 0.9 }
    });

    expect(active.schemaVersion).toBe("2.0");
    expect(active.scope.userId).toBe("u1");
    expect(active.confidence).toBe(0.96);
    expect(active.beliefState).toBe("active");
    expect(active.provenance.citations[0]).toContain("package.json:10");
    expect(active.audit[0].type).toBe("created");

    const results = service.search({ userId: "u1", query: "Atlas release checks", limit: 5 });
    expect(results.some((result) => result.memory.id === active.id && result.decision !== "exclude")).toBe(true);
    expect(results.find((result) => result.memory.id === review.id)?.decision).toBe("review");
    expect(results.some((result) => result.memory.beliefState === "retracted")).toBe(false);
    expect(service.verificationQueue("u1").items.some((item) => item.memoryId === review.id)).toBe(true);
    expect(service.confirmMemory(review.id, "u1").beliefState).toBe("active");
    expect(service.verificationQueue("u1").items.some((item) => item.memoryId === review.id)).toBe(false);
    expect(service.retractMemory(active.id, "u1", "wrong").beliefState).toBe("retracted");
    expect(service.search({ userId: "u1", query: "Vitest release" }).some((result) => result.memory.id === active.id)).toBe(false);
  });

  it("exports a hash-linked audit journal that replays memory state", () => {
    const service = new MemoryService();
    const memory = service.add({
      userId: "audit-user",
      content: "Audit journal records every mutation as replayable evidence.",
      source: { kind: "human", confidence: 0.95 }
    });

    service.update(memory.id, { content: "Audit journal records every mutation with a signable chain." });
    service.archive(memory.id);
    expect(service.delete(memory.id)).toBe(true);

    const chain = service.auditChain();
    expect(chain.valid).toBe(true);
    expect(chain.headHash).toBe(chain.events.at(-1)?.hash);
    expect(chain.events.map((event) => event.journalType)).toEqual([
      "memory.created",
      "memory.updated",
      "memory.archived",
      "memory.deleted"
    ]);
    expect(chain.events[0].previousHash).toBeUndefined();
    expect(chain.events[1].previousHash).toBe(chain.events[0].hash);
    expect(chain.events.every((event) => event.hash && event.payloadHash && event.sequence > 0)).toBe(true);

    const replayed = service.replayAuditState();
    expect(replayed.valid).toBe(true);
    expect(replayed.memories[memory.id]).toMatchObject({
      exists: false,
      archived: true,
      versions: 4,
      userId: "audit-user"
    });
  });

  it("records harness actions as episodic memory evidence", () => {
    const service = new MemoryService();
    const action = service.recordHarnessAction({
      userId: "u1",
      agentId: "codex",
      projectId: "memory",
      command: "npm run test",
      filesChanged: ["src/api/service.ts"],
      filesTouched: ["src/api/service.ts", "tests/core.test.ts"],
      durationMs: 842,
      outputSummary: "vitest completed without failures",
      successReason: "all unit tests passed",
      environmentHints: ["node>=20", "CI=true"],
      tests: [{ name: "vitest", status: "passed" }],
      errorFixed: "TypeScript build failure"
    });
    expect(action.type).toBe("episodic");
    expect(action.source.kind).toBe("tool");
    expect(action.tags).toContain("harness-action");
    expect(action.metadata.action).toMatchObject({ command: "npm run test", errorFixed: "TypeScript build failure" });
    expect(action.metadata.engineering).toMatchObject({
      kind: "tool_outcome",
      durationMs: 842,
      outputSummary: "vitest completed without failures",
      successReason: "all unit tests passed",
      filesTouched: ["src/api/service.ts", "tests/core.test.ts"],
      environmentHints: ["node>=20", "CI=true"]
    });
    const recalled = service.search({ userId: "u1", query: "what fixed TypeScript build failure last time?", limit: 3 });
    expect(recalled.some((result) => result.memory.id === action.id)).toBe(true);
  });

  it("stores procedural memories with triggers, scope, confidence, and outcome history", () => {
    const service = new MemoryService();
    const procedure = service.add({
      userId: "u1",
      projectId: "memory",
      content: "Before release always run npm test and npm run build.",
      source: { kind: "human", confidence: 0.93 },
      tags: ["workflow", "release"]
    });
    expect(procedure.type).toBe("procedural");
    expect(procedure.layer).toBe("procedural");
    expect(procedure.metadata.procedure).toMatchObject({
      applicabilityScope: { userId: "u1", projectId: "memory" },
      confidence: 0.93,
      lastOutcome: "unknown",
      successCount: 0,
      failureCount: 0
    });
    expect((procedure.metadata.procedure as { triggerConditions: string[] }).triggerConditions).toEqual(expect.arrayContaining(["before release or deploy work", "before validation or CI-sensitive changes"]));
    expect(service.search({ userId: "u1", projectId: "memory", query: "what should run before release?", limit: 1 })[0].memory.id).toBe(procedure.id);
  });

  it("redacts sensitive writes, extracts add-only facts, records feedback, and reports metrics", () => {
    const service = new MemoryService({ redactionPolicy: { mode: "redact" } });
    const secret = service.add({
      userId: "u1",
      content: "Use token ghp_abcdefghijklmnopqrstuvwxyz123456 for tests.",
      source: { kind: "human", confidence: 0.95 }
    });
    expect(secret.content).toContain("[redacted:github-token]");
    expect(secret.metadata.privacy).toBeDefined();

    const extracted = service.extract(
      [
        { role: "user", content: "Atlas now uses Redis for cache. The API calls /v1/cache." },
        { role: "tool", content: "Verified npm test passed for Atlas." },
        { role: "user", content: "Thanks for the quick update." },
        { role: "assistant", content: "Temporary scratch note for this session: inspect Redis later." }
      ],
      { userId: "u1", sessionId: "s1", appId: "app-a" }
    );
    expect(extracted.memories.length).toBeGreaterThan(1);
    expect(Object.keys(extracted.entityLinks).length).toBeGreaterThan(0);
    expect(extracted.claims?.some((claim) => claim.subject.toLowerCase().includes("atlas") && claim.predicate === "uses" && claim.object.toLowerCase().includes("redis"))).toBe(true);
    expect(extracted.durabilityDecisions?.some((decision) => decision.action === "ignore" && decision.reason.includes("smalltalk"))).toBe(true);
    expect(extracted.durabilityDecisions?.some((decision) => decision.action === "working_memory")).toBe(true);
    expect(extracted.memories.some((memory) => memory.content.includes("Thanks for the quick update"))).toBe(false);
    expect(extracted.memories.some((memory) => memory.tags.includes("session-only"))).toBe(true);
    const episode = service.listEpisodes("u1")[0];
    expect(episode.rawConversation).toHaveLength(4);
    expect(episode.toolCalls.length).toBe(1);
    expect(episode.memoryIds).toEqual(extracted.memories.map((memory) => memory.id));
    expect(extracted.memories.every((memory) => memory.metadata.episodeId === episode.id && memory.provenance.extractedFromEpisodeId === episode.id)).toBe(true);

    const before = extracted.memories[0].importance;
    const updated = service.feedback({ memoryId: extracted.memories[0].id, kind: "helpful", userId: "u1" });
    expect(updated.importance).toBeGreaterThan(before);
    expect(service.metricsReport().feedback).toBe(1);
    expect(service.exportUser("u1").length).toBeGreaterThan(0);
  });

  it("audits staged extraction, provider fallback, enrichment, and entity disambiguation", () => {
    const service = new MemoryService({
      intelligence: {
        extractor: {
          extract: ({ scope }) => [
            {
              ...scope,
              content: "Design review recording confirmed Atlas uses Vector Cache.",
              entities: ["Atlas", "Vector Cache"],
              tags: ["review", "audio"],
              source: { kind: "agent", confidence: 0.74 },
              metadata: { providerTrace: "unit-test" }
            }
          ]
        }
      }
    });

    const report = service.extract(
      [
        {
          role: "operator",
          content: "Audio",
          mediaType: "audio",
          language: "de",
          uri: "file:///reviews/atlas.m4a",
          mimeType: "audio/mp4"
        }
      ],
      { userId: "u1", sessionId: "s1" }
    );

    expect(report.stages.some((stage) => stage.stage === "provider" && stage.extracted === 1)).toBe(true);
    expect(report.failures.some((failure) => failure.mediaType === "audio")).toBe(true);
    expect(report.learnedRules.some((rule) => rule.kind === "provider")).toBe(true);
    expect(report.learnedRules.some((rule) => rule.kind === "translation")).toBe(true);
    expect(report.memories[0].metadata.extraction).toMatchObject({ stage: "provider" });
    expect(report.enrichmentCandidates.some((candidate) => candidate.entity === "atlas")).toBe(true);
    const blockedEnrichment = service.runEntityEnrichment({ userId: "u1", entity: "atlas" });
    expect(blockedEnrichment.status).toBe("blocked");
    const appliedEnrichment = service.runEntityEnrichment({ userId: "u1", entity: "atlas", approveExternal: true, sourceUri: "https://example.com/atlas" });
    expect(appliedEnrichment.status).toBe("applied");
    expect(appliedEnrichment.memories[0].tags).toContain("external-enrichment");
    expect(appliedEnrichment.memories[0].metadata.enrichment).toMatchObject({ entity: "atlas", sourceUri: "https://example.com/atlas" });

    service.add({
      userId: "u1",
      content: "Atlas dashboard mentions VectorCache in tuning notes.",
      entities: ["VectorCache"],
      source: { kind: "human", confidence: 0.94 }
    });

    const catalog = service.entityCatalog("u1");
    expect(catalog.mergeSuggestions.some((suggestion) => suggestion.canonical.includes("vector"))).toBe(true);

    const merged = service.mergeEntity("vector cache", ["VectorCache"], "u1");
    expect(merged.aliases).toContain("vectorcache");
    expect(service.entityCatalog("u1").entities.some((entity) => entity.canonical === "vector cache")).toBe(true);

    const split = service.splitEntity("vector cache", ["VectorCache"], "u1");
    expect(split?.aliases).not.toContain("vectorcache");
  });

  it("encrypts sensitive writes when encryption mode is configured", () => {
    const service = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: "test-key-with-enough-length", encryptionKeyId: "local", encryptionKeyVersion: "1" } });
    const memory = service.add({
      userId: "u1",
      content: "The password=supersecret token should not be stored in plaintext.",
      source: { kind: "human", confidence: 0.95 }
    });
    expect(memory.content).toContain("[encrypted:aes-256-gcm:");
    expect(memory.content).not.toContain("supersecret");
    expect(memory.metadata.privacy).toMatchObject({ encrypted: true, action: "encrypt", keyId: "local", keyVersion: "1" });
  });

  it("verifies encrypted backup recovery across key rotation and migration import", () => {
    const oldKey = "old-test-key-with-enough-length";
    const newKey = "new-test-key-with-enough-length";
    const service = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: oldKey, encryptionKeyId: "user-u1", encryptionKeyVersion: "1" } });
    service.add({
      userId: "u1",
      content: "The token ghp_abcdefghijklmnopqrstuvwxyz123456 belongs in encrypted backup recovery.",
      source: { kind: "human", confidence: 0.95 }
    });

    const initialBundle = service.managedMigrationBundle({ target: "managed", backupRef: "local-backup://security", ssoProvider: "oidc", secretManager: "vault" });
    expect(initialBundle.deployment?.artifacts.kubernetes).toBe("deploy/kubernetes/cognibrain.yaml");
    expect(initialBundle.deployment?.importWorkflow.some((step) => step.includes("/migration/import"))).toBe(true);
    expect(service.verifyBackupRecovery(initialBundle, { keyring: [{ key: oldKey, keyId: "user-u1", keyVersion: "1" }] })).toMatchObject({ encryptedMemories: 1, verified: true });

    service.rotateEncryptionKeyMetadata({ keyId: "org-main", keyVersion: "2", backupRef: "local-backup://security" });
    const rotatedBundle = service.managedMigrationBundle({ target: "managed", backupRef: "local-backup://security", ssoProvider: "oidc", secretManager: "vault" });
    const recovery = service.verifyBackupRecovery(rotatedBundle, { keyring: [{ key: newKey, keyId: "org-main", keyVersion: "2" }, { key: oldKey, keyId: "user-u1", keyVersion: "1" }] });
    expect(recovery).toMatchObject({ encryptedMemories: 1, verified: true });

    const imported = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: oldKey, encryptionKeyId: "user-u1", encryptionKeyVersion: "1" } });
    const importReport = imported.importMigrationBundle(rotatedBundle);
    expect(importReport.importedMemories).toBe(1);
    expect(imported.securityKeyReport()).toMatchObject({ encrypted: 1, rotated: 1, backupRefs: ["local-backup://security"] });
    const compliance = imported.complianceReport();
    expect(compliance.keyProvider?.knownKeyIds).toContain("org-main");
    expect(compliance.backup?.verified).toBe(true);
    expect(imported.transportSecurityReport({ mode: "managed", publicUrl: "http://memory.example.com" }).warning).toContain("TLS");
  });

  it("enforces policy rules across retrieval, dream, export, delete, and writes", () => {
    const service = new MemoryService();
    const privateMemory = service.add({
      userId: "u-policy",
      content: "Atlas private legal decision must stay in the vault.",
      tags: ["legal"],
      consent: { visibility: "private" },
      source: { kind: "human", confidence: 0.96 }
    });
    service.add({
      userId: "u-policy",
      content: "Atlas public implementation detail can be retrieved.",
      tags: ["public-note"],
      consent: { visibility: "user" },
      source: { kind: "human", confidence: 0.96 }
    });

    service.setPolicyRule({
      label: "Block private legal retrieval",
      effect: "deny",
      operations: ["retrieve", "dream", "export", "delete"],
      scope: { userId: "u-policy", tag: "legal" },
      reason: "legal memories require explicit operator review"
    });

    const search = service.search({ userId: "u-policy", query: "Atlas decision vault", includePrivate: true });
    expect(search.some((result) => result.memory.id === privateMemory.id)).toBe(false);
    expect(service.evaluatePolicy("retrieve", privateMemory).allowed).toBe(false);
    expect(service.exportUser("u-policy").some((memory) => memory.id === privateMemory.id)).toBe(false);
    expect(service.deleteUser("u-policy")).toBe(1);
    expect(service.get(privateMemory.id)).toBeDefined();
    const dream = service.dream("u-policy");
    expect(dream.lifecycle.issues.join(" ")).toContain("blocked by policy");

    service.setPolicyRule({
      label: "Block connector write",
      effect: "deny",
      operations: ["write"],
      scope: { connectorId: "restricted-chat" }
    });
    expect(() =>
      service.add({
        userId: "u-policy",
        content: "Restricted connector event.",
        metadata: { connectorId: "restricted-chat" },
        source: { kind: "transcript", confidence: 0.8 }
      })
    ).toThrow(/denied by policy/);
    expect(service.complianceReport().policyRules?.length).toBe(2);
    expect(service.auditTrail({ type: "policy.violation" }).length).toBeGreaterThan(0);
  });

  it("fuzzes tenant isolation across private, org, project, connector, graph, and context-pack surfaces", () => {
    const service = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: "tenant-isolation-test-key" } });
    const privateBrain = service.createBrain({ id: "brain-private-a", name: "Private A", ownerUserId: "alice", visibility: "private" });
    const orgBrain = service.createBrain({ id: "brain-org-a", name: "Org A", ownerUserId: "alice", memberUserIds: ["carol"], orgId: "org-a", visibility: "org" });
    const connectorSource = service.createSource({ id: "src-connector-a", brainId: orgBrain.id, name: "Connector A", kind: "connector", defaultConsent: { visibility: "org" } });
    const records = [
      service.add({
        userId: "alice",
        brainId: privateBrain.id,
        content: "TENANT_PRIVATE_A must never leak to Bob.",
        consent: { visibility: "private" },
        source: { kind: "human", confidence: 0.99 },
        entities: ["TenantSecretA"],
        relations: [{ type: "mentions", sourceEntity: "TenantSecretA", targetEntity: "BobForbidden", confidence: 0.9 }]
      }),
      service.add({
        userId: "alice",
        brainId: privateBrain.id,
        content: "TENANT_PUBLIC_IN_PRIVATE_BRAIN still requires brain access.",
        consent: { visibility: "public" },
        source: { kind: "human", confidence: 0.99 },
        entities: ["PrivateBrainPublic"]
      }),
      service.add({
        userId: "alice",
        brainId: orgBrain.id,
        orgId: "org-a",
        projectId: "project-a",
        content: "TENANT_ORG_PROJECT_A is available only inside org-a project-a context.",
        consent: { visibility: "org" },
        source: { kind: "human", confidence: 0.97 },
        entities: ["TenantOrgProjectA"]
      }),
      service.add({
        userId: "alice",
        brainId: orgBrain.id,
        sourceId: connectorSource.id,
        orgId: "org-a",
        content: "TENANT_CONNECTOR_A came from an org-scoped connector.",
        source: { kind: "import", confidence: 0.94 },
        entities: ["TenantConnectorA"]
      }),
      service.add({
        userId: "alice",
        brainId: privateBrain.id,
        content: "api_key=TENANT_ENCRYPTED_A belongs to Alice.",
        consent: { visibility: "private" },
        source: { kind: "human", confidence: 0.98 },
        entities: ["TenantEncryptedA"]
      })
    ];

    const bobSearch = service.search({
      userId: "bob",
      query: "TENANT",
      includePrivate: true,
      includeSharedBrains: true,
      brainIds: [privateBrain.id, orgBrain.id],
      orgId: "org-b",
      projectId: "project-b",
      limit: 20
    });
    expect(bobSearch).toHaveLength(0);

    const sameOrgWrongProject = service.search({
      userId: "bob",
      query: "TENANT_ORG_PROJECT_A",
      includeSharedBrains: true,
      brainIds: [orgBrain.id],
      orgId: "org-a",
      projectId: "project-b"
    });
    expect(sameOrgWrongProject.every((result) => result.memory.id !== records[2].id)).toBe(true);
    expect(sameOrgWrongProject.every((result) => !result.memory.content.includes("TENANT_ORG_PROJECT_A"))).toBe(true);

    const carolOrg = service.search({
      userId: "carol",
      query: "TENANT_CONNECTOR_A",
      includeSharedBrains: true,
      brainIds: [orgBrain.id],
      orgId: "org-a",
      projectId: "project-a"
    });
    expect(carolOrg.some((result) => result.memory.id === records[3].id)).toBe(true);
    expect(carolOrg.every((result) => !result.memory.content.includes("TENANT_PRIVATE_A"))).toBe(true);

    const blockedFederation = service.federatedSearch({ userId: "bob", query: "TENANT_PUBLIC_IN_PRIVATE_BRAIN", brainIds: [privateBrain.id], includeSharedBrains: true });
    expect(blockedFederation.searchedBrainIds).toEqual([]);
    expect(blockedFederation.blockedBrainIds).toEqual([privateBrain.id]);
    expect(blockedFederation.results).toHaveLength(0);

    const route = service.routeMemory({ userId: "bob", query: "TENANT", brainId: privateBrain.id, includeSharedBrains: true });
    expect(route.excludedScopes.some((scope) => scope.kind === "brain" && scope.id === privateBrain.id)).toBe(true);

    const bobGraph = service.graphExport({ userId: "bob" });
    expect(JSON.stringify(bobGraph)).not.toContain("TENANT_PRIVATE_A");
    expect(service.graphPaths("TenantSecretA", "BobForbidden", { userId: "bob" })).toHaveLength(0);

    const pack = service.evidencePack({ userId: "bob", orgId: "org-b", query: "TENANT", includeSharedBrains: true, brainIds: [privateBrain.id, orgBrain.id], limit: 10 });
    expect(pack.results).toHaveLength(0);
    expect(pack.context).not.toContain("TENANT_PRIVATE_A");

    expect(records.every((record) => service.get(record.id))).toBe(true);
  });

  it("enforces retention, rotates encrypted key metadata, and emits privacy-safe insights", () => {
    const service = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: "test-key-with-enough-length", encryptionKeyId: "primary", encryptionKeyVersion: "1" } });
    const staleSearch = service.add({
      userId: "u1",
      content: "Atlas compliance memory should expire from retrieval.",
      entities: ["atlas"],
      timestamp: "2020-01-01T00:00:00.000Z",
      source: { kind: "human", confidence: 0.96 }
    });
    service.add({
      userId: "u1",
      content: "The token ghp_abcdefghijklmnopqrstuvwxyz123456 should rotate key metadata.",
      source: { kind: "human", confidence: 0.95 }
    });
    const staleDream = service.add({
      userId: "u2",
      content: "Dream retention should archive old source memories.",
      timestamp: "2020-01-01T00:00:00.000Z",
      source: { kind: "transcript", confidence: 0.42 }
    });
    const extracted = service.extract([{ role: "user", content: "Atlas episode retention source should expire.", timestamp: "2020-01-01T00:00:00.000Z" }], { userId: "u1" });
    const episode = service.listEpisodes("u1")[0];
    expect(episode.memoryIds).toEqual(extracted.memories.map((memory) => memory.id));
    service.add({ userId: "u3", content: "Privacy insight aggregate one.", source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u4", content: "Privacy insight aggregate two.", source: { kind: "human", confidence: 0.95 } });

    const rule = service.setRetentionRule({ label: "Atlas archive", retentionDays: 1, action: "archive", scope: { entity: "atlas" } });
    expect(service.listRetentionRules()[0].id).toBe(rule.id);
    const retentionReview = service.retentionReview(new Date(), "u1");
    expect(retentionReview.expiredMemories.some((item) => item.memoryId === staleSearch.id && item.action === "archive")).toBe(true);
    expect(retentionReview.episodeRisks.some((item) => item.episodeId === episode.id && item.action === "archive")).toBe(true);
    const retentionReport = service.enforceRetention(new Date(), "u1");
    expect(retentionReport.episodeArchived).toContain(episode.id);
    expect(service.listEpisodes("u1")[0].retention?.action).toBe("archive");
    const search = service.search({ userId: "u1", query: "Atlas compliance memory", includePrivate: true });
    expect(search.some((result) => result.memory.id === staleSearch.id)).toBe(false);
    expect(service.exportUser("u1").find((memory) => memory.id === staleSearch.id)?.archivedAt).toBeDefined();

    service.setRetentionRule({ label: "Transcript archive", retentionDays: 1, action: "archive", scope: { userId: "u2", sourceKind: "transcript" } });
    service.dream("u2");
    expect(service.exportUser("u2").find((memory) => memory.id === staleDream.id)?.archivedAt).toBeDefined();

    const keysBefore = service.securityKeyReport();
    expect(keysBefore.keyIds.primary).toBe(1);
    const rotation = service.rotateEncryptionKeyMetadata({ keyId: "primary", keyVersion: "2", backupRef: "local-backup://2026-05" });
    expect(rotation.rotated).toHaveLength(1);
    expect(service.securityKeyReport()).toMatchObject({ rotated: 1, backupRefs: ["local-backup://2026-05"] });

    const insights = service.privacyInsights({ epsilon: 0.8, kAnonymity: 2, includeExact: true });
    expect(insights.aggregates.some((item) => item.dimension === "sourceKind" && item.key === "human" && item.suppressed === false)).toBe(true);
    expect(insights.aggregates.some((item) => item.dimension === "sourceKind" && item.key === "transcript" && item.suppressed === true && item.noisyCount === 0)).toBe(true);

    const compliance = service.complianceReport();
    expect(compliance.retentionRules?.length).toBeGreaterThanOrEqual(2);
    expect(compliance.encryption?.keyVersions["2"]).toBe(1);
    expect(compliance.keyProvider?.encryptedMemories).toBe(1);
    expect(compliance.backup?.verified).toBe(true);
    expect(compliance.transportSecurity?.mode).toBe("local");
    expect(compliance.dataFlows?.some((flow) => flow.type === "security.key.rotate")).toBe(true);
    expect(service.auditTrail({ type: "retention.enforce" }).length).toBeGreaterThan(0);
  });

  it("runs privacy-preserving cross-brain compute without raw labels", () => {
    const service = new MemoryService();
    const alpha = service.createBrain({ id: "brain_alpha", name: "Alpha", ownerUserId: "owner", visibility: "team" });
    const beta = service.createBrain({ id: "brain_beta", name: "Beta", ownerUserId: "owner", visibility: "team" });
    const gamma = service.createBrain({ id: "brain_gamma", name: "Gamma", ownerUserId: "owner", visibility: "team" });
    service.add({ userId: "owner", brainId: alpha.id, content: "Alpha Atlas retrieval.", entities: ["Atlas"], tags: ["retrieval"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "owner", brainId: beta.id, content: "Beta Atlas memory.", entities: ["Atlas"], tags: ["memory"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "owner", brainId: gamma.id, content: "Gamma has a private-only unique concept.", entities: ["UniqueSecret"], tags: ["private-only"], source: { kind: "human", confidence: 0.95 } });

    const report = service.privacyPreservingCrossBrainCompute({
      brainIds: [alpha.id, beta.id, gamma.id],
      salt: "unit-secret-salt",
      minK: 2,
      dimensions: ["entities", "tags"]
    });

    expect(report.noRawMemoryData).toBe(true);
    expect(report.intersections).toHaveLength(1);
    expect(report.intersections[0].participantBrainIds).toEqual([alpha.id, beta.id]);
    expect(JSON.stringify(report)).not.toContain("Atlas");
    expect(JSON.stringify(report)).not.toContain("UniqueSecret");
    expect(report.totals.suppressedHashes).toBeGreaterThan(0);
    expect(service.auditTrail({ type: "privacy.compute" })).toHaveLength(1);
  });

  it("manages retrieval profiles and learns a bounded profile from feedback", () => {
    const service = new MemoryService();
    const memory = service.add({
      userId: "u1",
      content: "Atlas Redis cache memory should be trusted.",
      entities: ["atlas", "redis"],
      source: { kind: "human", confidence: 0.96 }
    });
    service.feedback({ memoryId: memory.id, kind: "helpful", userId: "u1" });
    service.addTrainingSample({
      userId: "u1",
      query: "Atlas Redis",
      selectedMemoryId: memory.id,
      outcome: "accepted",
      signals: { entity: 1, trust: 0.9, keyword: 0.5 }
    });
    const learned = service.learnRetrievalProfile("team-learned");
    expect(learned.samples).toBe(2);
    expect(learned.lossBefore).toBeDefined();
    expect(learned.lossAfter).toBeDefined();
    expect(learned.profile.weights.trust).toBeGreaterThan(0);
    expect(service.getRetrievalProfiles().some((profile) => profile.id === "team-learned")).toBe(true);
  });

  it("supports retrieval modes, query expansion, scoped learning, and contradiction decisions", () => {
    const service = new MemoryService();
    const commandLine = service.add({
      userId: "u1",
      projectId: "p1",
      content: "The command line workflow starts the package installer.",
      entities: ["command line", "installer"],
      source: { kind: "human", confidence: 0.94 }
    });
    service.add({
      userId: "u1",
      projectId: "p1",
      content: "Atlas should use Redis for shared cache.",
      entities: ["atlas", "redis"],
      source: { kind: "reviewed_code", confidence: 0.98 }
    });
    service.add({
      userId: "u1",
      projectId: "p1",
      content: "Atlas should not use Redis for shared cache.",
      entities: ["atlas", "redis"],
      source: { kind: "transcript", confidence: 0.35 }
    });

    const expanded = service.search({ userId: "u1", query: "cli workflow", expandQuery: true, mode: "rrf" });
    expect(expanded[0].memory.id).toBe(commandLine.id);
    expect(expanded[0].retrievalMode).toBe("rrf");
    expect(expanded[0].fusion?.rank).toBe(1);
    expect(expanded[0].expandedQueries?.some((query) => query.includes("command line"))).toBe(true);
    const intent = service.classifyQueryIntent("How are Atlas and Redis connected?");
    expect(intent.intent).toBe("connection_explanation");
    expect(intent.recommendedMode).toBe("path");
    expect(intent.plan.strategies).toEqual(expect.arrayContaining(["graph_path", "activation", "entity"]));
    const intentDriven = service.search({ userId: "u1", query: "How are Atlas and Redis connected?" });
    expect(intentDriven.some((result) => result.retrievalMode === "path")).toBe(true);
    expect(intentDriven[0].queryPlan?.queryType).toBe("connection_explanation");
    expect(intentDriven[0].queryPlan?.explanation.length).toBeGreaterThan(0);
    expect(intentDriven[0].confidence).toBeGreaterThan(0);

    const contradictions = service.search({ userId: "u1", query: "Atlas Redis shared cache", mode: "path" });
    expect(contradictions.some((result) => result.contradiction && result.decision === "exclude")).toBe(true);
    expect(contradictions.some((result) => result.retrievalMode === "path" && result.explanation?.some((item) => item.includes("mode path")))).toBe(true);

    service.addTrainingSample({ userId: "u1", query: "cli workflow", outcome: "accepted", signals: { keyword: 0.9, semantic: 0.7 } });
    service.addTrainingSample({ userId: "u2", query: "other", outcome: "accepted", signals: { graph: 1 } });
    const learned = service.learnRetrievalProfile("p1-learned", "Project profile", { scope: { userId: "u1", projectId: "p1" } });
    expect(learned.samples).toBe(1);
    expect(learned.profile.scope?.projectId).toBe("p1");
  });

  it("calibrates retrieval confidence and avoids injecting unsafe low-confidence results", () => {
    const service = new MemoryService();
    service.add({ userId: "u1", content: "Atlas deployment gate requires reviewed npm test evidence.", entities: ["atlas", "deployment"], source: { kind: "reviewed_code", confidence: 0.99 } });
    const weak = service.add({ userId: "u1", content: "Atlas deployment maybe skips tests according to an unreviewed note.", entities: ["atlas", "deployment"], source: { kind: "agent", confidence: 0.08 } });
    service.update(weak.id, { trust: 0.04, importance: 0.1 });

    const results = service.search({ userId: "u1", query: "Atlas deployment tests", includePrivate: true, limit: 2 });
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence ?? 0);
    expect(results.find((result) => result.memory.id === weak.id)?.unsafeToInject).toBe(true);

    const pack = service.evidencePack({ userId: "u1", query: "Atlas deployment tests", includePrivate: true, limit: 2, tokenBudget: 500 });
    expect(pack.context).not.toContain(weak.id);
    expect(pack.excludedResults?.find((result) => result.memoryId === weak.id)?.reason).toContain("confidence");
    expect(pack.results[0].retrieval.confidence).toBeGreaterThan(0.5);
  });

  it("plans at least twenty query types for retrieval strategy selection", () => {
    const service = new MemoryService();
    const examples = [
      ["What is the Atlas cache?", "direct_fact"],
      ["What happened yesterday?", "temporal_recent"],
      ["What was valid between March and April?", "temporal_range"],
      ["What changed in the release history?", "change_summary"],
      ["How are Atlas and Redis connected?", "connection_explanation"],
      ["Which services are linked through Redis?", "graph_multi_hop"],
      ["What depends on the billing package?", "dependency_path"],
      ["How do I run the deploy workflow?", "procedure_recall"],
      ["Which release checklist should I use?", "checklist_release"],
      ["Does this contradict the old decision?", "contradiction_check"],
      ["Is this guidance outdated?", "stale_or_outdated"],
      ["Who owns the migration?", "person_entity"],
      ["What is the repo branch status?", "project_state"],
      ["What did the team decide?", "team_memory"],
      ["What do I prefer for tests?", "personal_preference"],
      ["Where did this evidence come from?", "source_provenance"],
      ["Am I allowed to use private memory?", "policy_permission"],
      ["What pattern usually happens on Mondays?", "pattern_behavior"],
      ["Why did the incident fail?", "incident_root_cause"],
      ["What did I do last action?", "action_history"]
    ] as const;
    const planned = examples.map(([query, expected]) => service.classifyQueryIntent(query).plan);
    expect(planned).toHaveLength(20);
    expect(new Set(planned.map((plan) => plan.queryType)).size).toBeGreaterThanOrEqual(18);
    examples.forEach(([, expected], index) => expect(planned[index].queryType).toBe(expected));
    expect(planned.every((plan) => plan.strategies.length > 0 && plan.explanation.length > 0)).toBe(true);
  });

  it("plans at least fifty coding-agent query intent cases", () => {
    const service = new MemoryService();
    const planned = CODING_QUERY_INTENT_CASES.map((item) => ({
      item,
      plan: service.classifyQueryIntent(item.query).plan
    }));
    expect(planned).toHaveLength(50);
    for (const { item, plan } of planned) {
      expect(plan.queryType, item.query).toBe(item.expectedQueryType);
      expect(plan.strategies).toEqual(expect.arrayContaining(["semantic"]));
      expect(plan.explanation.length, item.query).toBeGreaterThan(0);
    }
    expect(new Set(planned.map(({ plan }) => plan.queryType))).toEqual(
      new Set(["command_selection", "change_location", "reviewer_correction", "dangerous_file", "architecture_decision", "failed_last_time", "repo_change"])
    );
  });

  it("loads retrieval profiles and aliases from runtime config", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-config-"));
    try {
      const configPath = join(dir, "memory.config.json");
      writeFileSync(
        configPath,
        JSON.stringify({
          retrievalProfiles: [{ id: "fresh", label: "Fresh", weights: { temporal: 1 }, updatedAt: "2026-01-01T00:00:00.000Z" }],
          entityAliases: { redis: ["cache database"] }
        })
      );
      const service = new MemoryService({ configPath });
      expect(service.getRetrievalProfiles().some((profile) => profile.id === "fresh")).toBe(true);
      const memory = service.add({ userId: "u1", content: "Atlas uses cache database.", entities: ["cache database"], source: { kind: "human", confidence: 0.96 } });
      expect(memory.entities).toContain("redis");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("links identities only with explicit consent and supports cross-session recall", () => {
    const service = new MemoryService();
    service.add({ userId: "device-a", content: "Returning user prefers simulator proof.", source: { kind: "human", confidence: 0.96 } });
    expect(service.search({ userId: "device-b", query: "simulator proof" })).toHaveLength(0);
    service.linkIdentity("device-b", "device-a", "consented-link-token");
    expect(service.search({ userId: "device-b", query: "simulator proof", includeLinkedIdentities: true })[0].memory.userId).toBe("device-a");
  });

  it("filters temporal searches and exposes multi-scale timeline summaries", () => {
    const service = new MemoryService({
      intelligence: {
        summarizer: {
          summarize: ({ theme }) => ({
            content: `Provider narrative for ${theme}.`,
            confidence: 0.84,
            metadata: { provider: "test-timeline" }
          })
        }
      }
    });
    service.add({ userId: "u1", content: "Atlas used SQLite in January.", source: { kind: "human", confidence: 0.96 }, timestamp: "2026-01-10T00:00:00.000Z" });
    service.add({ userId: "u1", content: "Atlas used Redis after February.", source: { kind: "human", confidence: 0.96 }, timestamp: "2026-03-10T00:00:00.000Z" });
    service.add({
      userId: "u1",
      content: "Atlas migration was valid for the whole second week of February.",
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2026-02-08T12:00:00.000Z",
      temporal: { validFrom: "2026-02-08T00:00:00.000Z", validUntil: "2026-02-15T00:00:00.000Z" }
    });
    const after = service.search({ userId: "u1", query: "after 2026-02 Atlas used", now: new Date("2026-04-01T00:00:00.000Z") });
    expect(after[0].memory.content).toContain("Redis");
    const interval = service.temporalQuery("u1", { after: "2026-02-10T00:00:00.000Z", before: "2026-02-11T00:00:00.000Z" });
    expect(interval.events.some((event) => event.content.includes("whole second week"))).toBe(true);
    const timeline = service.timeline("u1");
    expect(timeline.periods.map((period) => period.period)).toContain("2026-01");
    expect(timeline.periods.map((period) => period.period)).toContain("2026-03");
    expect(timeline.periods.some((period) => period.granularity === "hour")).toBe(true);
    expect(timeline.periods.some((period) => period.granularity === "day")).toBe(true);
    expect(timeline.periods.some((period) => period.granularity === "week")).toBe(true);
    const summaries = service.summarizeTimeline("u1", { granularity: "month", persist: true, style: "narrative" });
    expect(summaries.summaries.some((summary) => summary.mode === "provider" && summary.summaryMemoryId)).toBe(true);
    const summaryMemory = service.list("u1").find((memory) => memory.metadata.dreamJob === "timeline-summary");
    expect(summaryMemory?.metadata.summaryOf).toBeDefined();
  });

  it("exposes canonical entity and typed graph reports", () => {
    const service = new MemoryService({ entityAliases: { redis: ["cache database"] } });
    const memory = service.add({
      userId: "u1",
      content: "CacheClient calls cache database through GET /v1/cache.",
      entities: ["cache database", "cacheclient"],
      relations: [{ type: "calls", sourceEntity: "cacheclient", targetEntity: "cache database", confidence: 0.8 }],
      source: { kind: "reviewed_code", confidence: 0.96 }
    });
    const graph = service.graph("u1");
    expect(graph.entities.some((entity) => entity.canonical === "redis" && entity.memoryIds.includes(memory.id))).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "calls" && edge.targetEntity === "redis")).toBe(true);
  });

  it("keeps inferred behavioral patterns pending until feedback approves or rejects them", () => {
    const service = new MemoryService();
    for (const day of [1, 2, 3]) {
      service.add({ userId: "u1", content: `Mira prefers Thai food Friday ${day}.`, tags: ["mira"], source: { kind: "human", confidence: 0.95 } });
    }
    const report = service.dream("u1");
    const pattern = report.created.find((memory) => memory.metadata.dreamJob === "behavior-pattern");
    expect(pattern?.metadata.patternReview).toMatchObject({ status: "pending" });
    const approved = service.feedback({ memoryId: pattern!.id, kind: "approve_pattern", userId: "u1" });
    expect(approved.metadata.patternReview).toMatchObject({ status: "approved" });
    service.feedback({ memoryId: pattern!.id, kind: "reject_pattern", userId: "u1" });
    expect(service.get(pattern!.id).archivedAt).toBeDefined();
  });

  it("previews lifecycle policy and protects configured sources", () => {
    const service = new MemoryService();
    service.add({
      userId: "u1",
      content: "Reviewed policy should stay protected.",
      source: { kind: "reviewed_code", confidence: 0.96 },
      timestamp: "2025-01-01T00:00:00.000Z"
    });
    const preview = service.lifecyclePreview("u1", { fadeAfterDays: 1, archiveAfterDays: 2 });
    expect(preview[0].action).toBe("protect");
  });

  it("runs domain evaluation hooks for coding modules", () => {
    const service = new MemoryService({ domainModule: CODING_DOMAIN_MODULE });
    const report = service.runDomainEvaluation();
    expect(report.passed).toBe(true);
    expect(report.domainId).toBe("coding");
    expect(service.metricsReport().benchmarkRuns).toBe(1);
  });

  it("ships domain modules required by the market plan", () => {
    expect(DOMAIN_MODULES.map((module) => module.id)).toEqual(expect.arrayContaining(["coding", "research", "legal", "sales", "support", "finance", "healthcare"]));
    for (const id of ["sales", "support"]) {
      const module = DOMAIN_MODULES.find((item) => item.id === id);
      expect(module?.evaluationCases?.length).toBeGreaterThan(0);
      const report = new MemoryService({ domainModule: module }).runDomainEvaluation();
      expect(report.passed).toBe(true);
      const enriched = module?.enrich?.({ userId: "domain", content: `${id} customer ticket opportunity`, source: { kind: "human", confidence: 0.9 } });
      expect(enriched?.tags).toContain(id);
    }
  });

  it("deduplicates extracted facts and links state changes additively", () => {
    const service = new MemoryService();
    service.add({ userId: "u1", content: "Atlas uses SQLite for cache.", entities: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    const first = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    const second = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    expect(first.memories).toHaveLength(1);
    expect(second.memories).toHaveLength(0);
    expect(first.memories[0].relations.some((relation) => relation.type === "supersedes")).toBe(true);
  });

  it("models belief revision as a supersession journey with historical validity", () => {
    const service = new MemoryService();
    const vienna = service.add({
      userId: "u1",
      content: "Mira lives in Vienna.",
      entities: ["mira"],
      temporal: { validFrom: "2026-01-01T00:00:00.000Z" },
      source: { kind: "human", confidence: 0.96 }
    });
    const berlin = service.extract([{ role: "user", content: "Mira now lives in Berlin.", timestamp: "2026-05-01T00:00:00.000Z" }], { userId: "u1" }).memories[0];

    expect(service.get(vienna.id).beliefState).toBe("superseded");
    expect(new Date(service.get(vienna.id).temporal.validUntil!).toISOString()).toContain("2026-05-01");
    expect(service.get(vienna.id).metadata.supersededBy).toBe(berlin.id);
    expect(berlin.relations.some((relation) => relation.type === "supersedes" && relation.targetId === vienna.id)).toBe(true);
    expect(service.search({ userId: "u1", query: "Mira lives", now: new Date("2026-05-20T00:00:00.000Z") })[0].memory.content).toContain("Berlin");
    expect(service.temporalQuery("u1", { before: "2026-04-01T00:00:00.000Z" }).events.some((event) => event.content.includes("Vienna"))).toBe(true);
  });

  it("persists memories and maintenance state across service restarts", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-"));
    try {
      const dbPath = join(dir, "memory.json");
      const service = new MemoryService({
        persistencePath: dbPath,
        autoDream: { enabled: true, writeThreshold: 2, intervalHours: 6 }
      });

      service.add({
        userId: "u1",
        content: "Run npm test before merging memory changes.",
        source: { kind: "human", confidence: 0.96 },
        tags: ["procedure", "test"]
      });
      expect(service.maintenanceStatus().users.u1.writesSinceDream).toBe(1);

      service.add({
        userId: "u1",
        content: "Run npm run build before releasing memory changes.",
        source: { kind: "human", confidence: 0.96 },
        tags: ["procedure", "release"]
      });

      const status = service.maintenanceStatus().users.u1;
      expect(status.writesSinceDream).toBe(0);
      expect(status.lastDreamAt).toBeDefined();

      const reloaded = new MemoryService({ persistencePath: dbPath });
      expect(reloaded.search({ userId: "u1", query: "What should run before releasing?", limit: 1 })[0].memory.content).toContain("build");
      expect(reloaded.maintenanceStatus().users.u1.lastDreamAt).toBe(status.lastDreamAt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports an append-only durable persistence backend", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-log-"));
    try {
      const logPath = join(dir, "memory.jsonl");
      const service = new MemoryService({
        persistence: new AppendOnlyLogPersistenceAdapter(logPath)
      });

      service.add({
        userId: "u1",
        content: "Durable backends keep memory snapshots in an append-only audit log.",
        source: { kind: "human", confidence: 0.97 }
      });
      service.addTrainingSample({
        userId: "u1",
        query: "durable memory backend",
        selectedMemoryId: service.list("u1")[0].id,
        outcome: "helpful",
        signals: { trust: 1, keyword: 0.8 }
      });

      const reloaded = new MemoryService({
        persistence: new AppendOnlyLogPersistenceAdapter(logPath)
      });
      expect(reloaded.search({ userId: "u1", query: "audit log backend", limit: 1 })[0].memory.content).toContain("append-only");
      expect(reloaded.learnRetrievalProfile().samples).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports SQLite persistence and JSON-to-SQL migration when node:sqlite is available", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-sqlite-"));
    try {
      const jsonPath = join(dir, "memory.json");
      const sqlitePath = join(dir, "memory.sqlite");
      const jsonAdapter = new JsonFilePersistenceAdapter(jsonPath);
      const source = new MemoryService({ persistence: jsonAdapter });
      source.add({
        userId: "u1",
        content: "SQLite backends keep transactional memory snapshots.",
        entities: ["sqlite", "transactional snapshots"],
        source: { kind: "human", confidence: 0.97 }
      });
      source.addTrainingSample({
        userId: "u1",
        query: "sqlite backend",
        selectedMemoryId: source.list("u1")[0].id,
        outcome: "helpful",
        signals: { trust: 1, keyword: 0.8 }
      });

      const status = source.storageStatus();
      expect(status.adapters.some((adapter) => adapter.kind === "sqlite" && adapter.sql)).toBe(true);

      if (!sqliteAvailable()) {
        expect(status.adapters.find((adapter) => adapter.kind === "sqlite")?.migrationSafe).toBe(false);
        return;
      }

      const payload = jsonAdapter.load();
      expect(payload).toBeDefined();
      const sqliteAdapter = new SQLitePersistenceAdapter(sqlitePath);
      if (payload && !Array.isArray(payload)) sqliteAdapter.save(payload);

      const reloaded = new MemoryService({ persistence: sqliteAdapter });
      expect(reloaded.storageStatus().active).toBe("sqlite");
      expect(reloaded.search({ userId: "u1", query: "transactional sqlite snapshots", limit: 1 })[0].memory.content).toContain("SQLite");
      expect(reloaded.learnRetrievalProfile().samples).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports Postgres-compatible persistence, migration, and storage capability reports", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-postgres-"));
    try {
      const jsonPath = join(dir, "memory.json");
      const postgresPath = join(dir, "memory.postgres.json");
      const jsonAdapter = new JsonFilePersistenceAdapter(jsonPath);
      const source = new MemoryService({ persistence: jsonAdapter });
      const memory = source.add({
        userId: "u1",
        content: "Postgres-compatible storage keeps team memories transactionally replicated.",
        entities: ["postgres", "replicated storage"],
        source: { kind: "human", confidence: 0.98 }
      });
      source.queueOfflineOperation({
        type: "add",
        userId: "u1",
        input: {
          userId: "u1",
          content: "Offline team sync should replay into a Postgres-compatible backend.",
          source: { kind: "tool", confidence: 0.8 }
        },
        clientMutationId: "pg-sync-1",
        occurredAt: "2026-05-01T00:00:00.000Z"
      });

      const payload = jsonAdapter.load();
      expect(payload).toBeDefined();
      const postgresAdapter = new PostgresCompatiblePersistenceAdapter(postgresPath);
      if (payload && !Array.isArray(payload)) postgresAdapter.save(payload);

      const reloaded = new MemoryService({ persistence: postgresAdapter });
      expect(reloaded.storageStatus().active).toBe("postgres-compatible");
      const status = reloaded.storageStatus();
      expect(status.adapters.find((adapter) => adapter.kind === "postgres-compatible")).toMatchObject({ sql: true, transactional: true, appendOnly: true, distributedReady: true, replication: "logical" });
      expect(status.adapters.find((adapter) => adapter.kind === "cockroach-compatible")?.distributedReady).toBe(true);
      expect(status.adapters.find((adapter) => adapter.kind === "cassandra-compatible")?.migrationSafe).toBe(true);
      expect(reloaded.search({ userId: "u1", query: "team memories replicated", limit: 1 })[0].memory.content).toContain("Postgres-compatible");
      reloaded.update(memory.id, { content: "Postgres-compatible storage keeps team memories transactionally replicated with audit snapshots." });
      const sync = reloaded.syncOfflineOperations();
      expect(sync.applied).toHaveLength(1);
      expect(reloaded.auditTrail().some((event) => event.type === "memory.update")).toBe(true);
      expect(reloaded.revertMemory(memory.id).content).toContain("transactionally replicated");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports Cassandra-compatible wide-column persistence and migration reports", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-cassandra-"));
    try {
      const cassandraPath = join(dir, "memory.cassandra.json");
      const service = new MemoryService({ persistence: new CassandraCompatiblePersistenceAdapter(cassandraPath) });
      service.createBrain({ id: "team-brain", name: "Team Brain", ownerUserId: "u1", visibility: "team" });
      const memory = service.add({
        userId: "u1",
        brainId: "team-brain",
        content: "Cassandra-compatible storage partitions team memories by brain and user.",
        source: { kind: "human", confidence: 0.95 }
      });
      const reloaded = new MemoryService({ persistence: new CassandraCompatiblePersistenceAdapter(cassandraPath) });
      expect(reloaded.search({ userId: "u1", query: "Cassandra partitions team memories" })[0].memory.id).toBe(memory.id);
      expect(reloaded.storageStatus().adapters.some((adapter) => adapter.kind === "cassandra-compatible" && adapter.distributedReady && adapter.sharding === "range")).toBe(true);
      const raw = JSON.parse(readFileSync(cassandraPath, "utf8"));
      expect(raw.dialect).toBe("cassandra-compatible");
      expect(raw.tables.persistence_events.length).toBeGreaterThanOrEqual(1);
      expect(raw.tables.snapshots.at(-1).partition).toContain("team-brain");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exposes production remote persistence driver capabilities", () => {
    const postgresRemote = new PostgresRemotePersistenceAdapter("postgres://example.invalid/cognibrain");
    const cockroachRemote = new PostgresRemotePersistenceAdapter("postgres://example.invalid:26257/cognibrain", { cockroach: true });
    const cassandraRemote = new CassandraRemotePersistenceAdapter("127.0.0.1", { keyspace: "cognibrain" });
    expect(postgresRemote.capabilities()).toMatchObject({ distributedReady: true, transactional: true, appendOnly: true, sql: true, replication: "logical" });
    expect(cockroachRemote.kind).toBe("cockroach-remote");
    expect(cassandraRemote.capabilities()).toMatchObject({ distributedReady: true, appendOnly: true, replication: "quorum", sharding: "range" });
    const status = new MemoryService().storageStatus();
    expect(status.adapters.map((adapter) => adapter.kind)).toEqual(expect.arrayContaining(["postgres-remote", "cockroach-remote", "cassandra-remote"]));
  });

  it("selects remote persistence drivers from deployment env", () => {
    const previousBackend = process.env.MEMORY_STORAGE_BACKEND;
    const previousPostgresUrl = process.env.MEMORY_POSTGRES_URL;
    const previousContactPoint = process.env.MEMORY_CASSANDRA_CONTACT_POINT;
    try {
      process.env.MEMORY_STORAGE_BACKEND = "postgres-remote";
      process.env.MEMORY_POSTGRES_URL = "postgres://example.invalid/cognibrain";
      expect(createPersistenceFromEnv().kind).toBe("postgres-remote");
      process.env.MEMORY_STORAGE_BACKEND = "cockroach-remote";
      expect(createPersistenceFromEnv().kind).toBe("cockroach-remote");
      process.env.MEMORY_STORAGE_BACKEND = "cassandra-remote";
      process.env.MEMORY_CASSANDRA_CONTACT_POINT = "127.0.0.1";
      expect(createPersistenceFromEnv().kind).toBe("cassandra-remote");
    } finally {
      if (previousBackend === undefined) delete process.env.MEMORY_STORAGE_BACKEND;
      else process.env.MEMORY_STORAGE_BACKEND = previousBackend;
      if (previousPostgresUrl === undefined) delete process.env.MEMORY_POSTGRES_URL;
      else process.env.MEMORY_POSTGRES_URL = previousPostgresUrl;
      if (previousContactPoint === undefined) delete process.env.MEMORY_CASSANDRA_CONTACT_POINT;
      else process.env.MEMORY_CASSANDRA_CONTACT_POINT = previousContactPoint;
    }
  });

  it("supports next-gen graph paths, activation, exports, graph queries, and configurable inference rules", () => {
    const service = new MemoryService();
    service.add({
      userId: "u1",
      content: "Atlas depends on CacheClient for cache reads.",
      entities: ["atlas", "cacheclient"],
      relations: [{ type: "depends_on", sourceEntity: "atlas", targetEntity: "cacheclient", confidence: 0.9, validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2026-02-01T00:00:00.000Z" }],
      source: { kind: "human", confidence: 0.96 }
    });
    service.add({
      userId: "u1",
      content: "CacheClient imports RedisAdapter for storage.",
      entities: ["cacheclient", "redisadapter"],
      relations: [{ type: "imports", sourceEntity: "cacheclient", targetEntity: "redisadapter", confidence: 0.88 }],
      source: { kind: "reviewed_code", confidence: 0.94 }
    });
    service.add({
      userId: "u1",
      content: "RedisAdapter calls RedisCluster for storage shards.",
      entities: ["redisadapter", "rediscluster"],
      relations: [{ type: "calls", sourceEntity: "redisadapter", targetEntity: "rediscluster", confidence: 0.86 }],
      source: { kind: "reviewed_code", confidence: 0.94 }
    });

    const report = service.runInference();
    expect(report.inferred.some((item) => item.relation.type === "transitive_depends_on")).toBe(true);
    const custom = service.runInference([{ id: "imports-calls", label: "imports + calls -> depends_on", when: { left: "imports", right: "calls" }, then: "depends_on", confidence: 0.52 }]);
    expect(custom.inferred.some((item) => item.relation.targetEntity === "rediscluster")).toBe(true);

    const paths = service.graphPaths("atlas", "redisadapter", { userId: "u1", maxDepth: 3, relationTypes: ["transitive_depends_on"] });
    expect(paths.some((path) => path.explanation.join(" ").includes("transitive_depends_on"))).toBe(true);
    expect(paths[0].edges.some((edge) => edge.source?.kind === "human" && typeof edge.trust === "number")).toBe(true);
    expect(paths[0].edges[0].validFrom).toBeTruthy();

    const validPast = service.graphPaths("atlas", "cacheclient", { userId: "u1", maxDepth: 1, relationTypes: ["depends_on"], validAt: "2026-01-15T00:00:00.000Z" });
    const validFuture = service.graphPaths("atlas", "cacheclient", { userId: "u1", maxDepth: 1, relationTypes: ["depends_on"], validAt: "2026-03-01T00:00:00.000Z" });
    expect(validPast.length).toBeGreaterThan(0);
    expect(validFuture.length).toBe(0);
    const explained = service.graphExplain("atlas", "cacheclient", { userId: "u1", strategy: "shortest", validAt: "2026-01-15T00:00:00.000Z" });
    expect(explained.paths[0].explanation.join(" ")).toContain("depends_on");

    const query = service.graphQuery("MATCH (a)-[:transitive_depends_on]->(b) WHERE trust>0.8 RETURN a,b,trust", "u1");
    expect(query.matches[0].relation?.targetEntity).toBe("redisadapter");

    const activation = service.graphActivation("Atlas RedisCluster", { userId: "u1", maxDepth: 4 });
    expect(activation.ranked.some((node) => node.label.includes("CacheClient") || node.label === "cacheclient")).toBe(true);

    const exported = service.graphExport({ userId: "u1", relationTypes: ["imports", "calls", "transitive_depends_on"], minTrust: 0.7 }) as { nodes: unknown[]; edges: Array<{ type: string }> };
    expect(exported.nodes.length).toBeGreaterThan(0);
    expect(exported.edges.every((edge) => ["imports", "calls", "transitive_depends_on", "mentions"].includes(edge.type))).toBe(true);
    expect(String(service.graphExport({ userId: "u1", format: "graphml" }))).toContain("<graphml");

    const fused = service.search({ userId: "u1", query: "Atlas RedisCluster", graphDepth: 4, weights: { graph: 1, semantic: 0, keyword: 0, entity: 0, temporal: 0, behavioral: 0, trust: 0, access: 0 } });
    expect(fused.some((result) => result.signals.graph > 0 && result.graphPaths?.length)).toBe(true);
  });

  it("manages brains, sources, agents, webhooks, marketplace modules, and compliance reports", () => {
    const service = new MemoryService();
    const brain = service.createBrain({ name: "Team Brain", ownerUserId: "u1", orgId: "org1", visibility: "team", consentRequired: true });
    const source = service.createSource({ brainId: brain.id, name: "Engineering Notes", kind: "docs", defaultConsent: { visibility: "org" } });
    service.registerAgent({ id: "agent-codex", name: "Codex", namespace: "coding", brainIds: [brain.id], permissions: ["read", "write"] });
    service.registerWebhook({ url: "https://example.invalid/memory", events: ["memory.write", "memory.share"] });
    service.installMarketplaceModule({
      id: "persona-researcher",
      kind: "persona",
      name: "Researcher Persona",
      version: "1.0.0",
      description: "Careful citation-heavy memory defaults.",
      manifest: { id: "researcher", label: "Researcher", summaryStyle: "descriptive", privacyDefault: "private" }
    });

    const memory = service.add({
      brainId: brain.id,
      sourceId: source.id,
      userId: "u1",
      agentId: "agent-codex",
      orgId: "org1",
      content: "Team brain stores approved project launch decisions.",
      consent: { visibility: "private", retentionUntil: "2020-01-01T00:00:00.000Z", deleteOnRequest: true },
      source: { kind: "human", confidence: 0.98 }
    });
    service.add({
      userId: "u2",
      content: "Other user's private launch decision.",
      consent: { visibility: "private" }
    });
    const route = service.routeMemory({ userId: "u1", agentId: "agent-codex", orgId: "org1", brainIds: [brain.id, "missing-brain"], includeSharedBrains: true, query: "project launch decisions" });
    expect(route.selectedScopes.some((scope) => scope.kind === "brain" && scope.id === brain.id)).toBe(true);
    expect(route.selectedScopes.some((scope) => scope.kind === "agent" && scope.id === "agent-codex")).toBe(true);
    expect(route.excludedScopes.some((scope) => scope.kind === "brain" && scope.id === "missing-brain")).toBe(true);
    expect(route.excludedScopes.some((scope) => scope.kind === "private")).toBe(true);
    service.promoteSharedMemory(memory.id, "org1");

    expect(service.listBrains()).toHaveLength(1);
    expect(service.listSources(brain.id)[0].id).toBe(source.id);
    expect(service.listAgents()[0].id).toBe("agent-codex");
    expect(service.listPersonas()[0].id).toBe("researcher");
    expect(service.listMarketplaceModules().some((module) => module.id === "persona-researcher" && module.installState === "installed")).toBe(true);
    expect(service.eventFeed().deliveries.some((delivery) => delivery.status === "queued")).toBe(true);

    const compliance = service.complianceReport(new Date("2026-01-01T00:00:00.000Z"));
    expect(compliance.totals.brains).toBe(1);
    expect(compliance.totals.sources).toBe(1);
    expect(compliance.retentionExpired).toBe(1);
    expect(compliance.auditByType["memory.write"]).toBeGreaterThan(0);
  });

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
    expect(openapi.clients.typescript).toContain("src/sdk/client.ts");
    expect(openapi.openapi).toBe("3.1.0");
    expect(openapi.servers[0].url).toBe("/v1");
    expect(openapi.paths["/openapi.json"].get).toBeDefined();
    expect(openapi.paths["/retention/review"].get).toBeDefined();
    expect(openapi.paths["/memories/{id}/archive"].post).toMatchObject({ operationId: "postMemoriesIdArchive" });
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
      expect(report.suites.map((suite) => suite.id)).toEqual(["answer-generation", "multi-hop-temporal", "behavioral-patterns", "retrieval-calibration", "usp-evidence-pack"]);
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
      const artifact = buildLeaderboardArtifact({ nextgenPath, answerGenerationPath, outputPath, evaluationPath: join(dir, "missing-eval.json") });
      expect(validateLeaderboardArtifact(artifact)).toBe(true);
      expect(artifact.privacy).toMatchObject({ anonymized: true, noRawPrompts: true, noRawEvidence: true });
      expect(artifact.publication.anonymized).toBe(true);
      expect(artifact.entries.some((entry) => entry.category === "answer_generation")).toBe(true);
      expect(JSON.stringify(artifact)).not.toContain("rawPrompt");
      expect(JSON.stringify(artifact)).not.toContain("rawEvidence");
      const publication = publishLeaderboardArtifact({ inputPath: outputPath, outputDir: join(dir, "public") });
      expect(publication.entries).toBeGreaterThan(0);
      expect(publication.anonymized).toBe(true);
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
    const service = new MemoryService({ autoDream: { enabled: false } });
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

  it("seeds expanded first-class vendor connectors", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    const vendors = ["official-github", "official-slack", "official-discord", "official-jira", "official-confluence", "official-notion", "official-linear"];
    const health = service.connectorHealth().filter((item) => vendors.includes(item.connectorId));
    expect(health.map((item) => item.connectorId)).toEqual(expect.arrayContaining(vendors));
    expect(health.every((item) => item.supports.externalVendor)).toBe(true);
    expect(health.find((item) => item.connectorId === "official-jira")?.externalVendor?.missingEnv).toContain("MEMORY_JIRA_PROJECT");
    expect(health.find((item) => item.connectorId === "official-confluence")?.kind).toBe("docs");
    expect(health.find((item) => item.connectorId === "official-linear")?.kind).toBe("project_management");
    const planned = service.connectorHealth().filter((item) => ["official-asana", "official-clickup", "official-sentry", "official-datadog", "official-pagerduty", "official-posthog"].includes(item.connectorId));
    expect(planned.map((item) => item.connectorId)).toEqual(expect.arrayContaining(["official-asana", "official-clickup", "official-sentry", "official-datadog", "official-pagerduty", "official-posthog"]));
    expect(planned.every((item) => item.supports.poll && item.supports.writeback)).toBe(true);
  });

  it("writes guided init and connector setup state without storing credential values", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-test-"));
    const cli = join(process.cwd(), "bin", "cognibrain.mjs");
    const env = {
      ...process.env,
      MEMORY_GITHUB_REPO: "cognilabz/cognibrain",
      MEMORY_GITHUB_TOKEN: "test-token-should-not-be-written"
    };
    try {
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "init", "--profile", "solo-dev", "--yes", "--dry-run", "--no-start", "--no-doctor", "--no-skill", "--no-demo"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "add", "github"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "add", "jira", "--set", "baseUrl=https://example.atlassian.net", "--set", "project=CB", "--email-env", "MEMORY_JIRA_EMAIL", "--token-env", "MEMORY_JIRA_API_TOKEN"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "add", "gitlab", "--set", "project=cognilabz/cognibrain"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "add", "storage-sqlite", "--set", "path=.cognibrain/memory.sqlite"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "add", "mcp-remote", "--set", "url=https://memory.example.com/mcp", "--token-env", "MEMORY_MCP_REMOTE_TOKEN"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "doctor", "--fix", "--no-start", "--no-skill"], { cwd: dir, env, encoding: "utf8" });
      const setupPath = join(dir, ".cognibrain", "setup-state.json");
      const connectorPath = join(dir, ".cognibrain", "connectors", "github.json");
      const jiraPath = join(dir, ".cognibrain", "connectors", "jira.json");
      const gitlabPath = join(dir, ".cognibrain", "connectors", "gitlab.json");
      const sqlitePath = join(dir, ".cognibrain", "adapters", "storage-sqlite.json");
      const mcpRemotePath = join(dir, ".cognibrain", "adapters", "mcp-remote.json");
      expect(existsSync(setupPath)).toBe(true);
      expect(existsSync(connectorPath)).toBe(true);
      expect(existsSync(jiraPath)).toBe(true);
      expect(existsSync(gitlabPath)).toBe(true);
      expect(existsSync(sqlitePath)).toBe(true);
      expect(existsSync(mcpRemotePath)).toBe(true);
      const setup = JSON.parse(readFileSync(setupPath, "utf8"));
      const connector = JSON.parse(readFileSync(connectorPath, "utf8"));
      const jira = JSON.parse(readFileSync(jiraPath, "utf8"));
      const gitlab = JSON.parse(readFileSync(gitlabPath, "utf8"));
      const sqlite = JSON.parse(readFileSync(sqlitePath, "utf8"));
      const mcpRemote = JSON.parse(readFileSync(mcpRemotePath, "utf8"));
      expect(setup.profile).toBe("solo-dev");
      expect(setup.metadata.uiFramework).toBe("ink-react");
      expect(setup.adapters).toContain("storage-sqlite");
      expect(connector.configured).toBe(true);
      expect(connector.requiredEnv.every((item: { valueRef?: string }) => item.valueRef?.startsWith("env:"))).toBe(true);
      expect(jira.settings.baseUrl).toBe("https://example.atlassian.net");
      expect(jira.settings.project).toBe("CB");
      expect(jira.settings.tokenEnv).toBe("env:MEMORY_JIRA_API_TOKEN");
      expect(gitlab.status).toBe("planned-contract");
      expect(gitlab.nextSteps.some((step: string) => step.includes("custom connector"))).toBe(true);
      expect(sqlite.kind).toBe("storage");
      expect(sqlite.configured).toBe(true);
      expect(mcpRemote.kind).toBe("transport");
      expect(mcpRemote.settings.tokenEnv).toBe("env:MEMORY_MCP_REMOTE_TOKEN");
      expect(JSON.stringify({ setup, connector, jira, gitlab, sqlite, mcpRemote })).not.toContain("test-token-should-not-be-written");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
