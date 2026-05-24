import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CODING_DOMAIN_MODULE, MemoryStore, ReflectionEngine, RetrievalEngine, healthReport, tokenize, extractEntities } from "../src/core";
import { JsonCommandMemoryIntelligence } from "../src/core/providers";
import { HarnessMemoryHook } from "../src/connectors/harnessHook";
import { MemoryService } from "../src/api/service";
import { CognibrainClient } from "../src/sdk/client";
import { AppendOnlyLogPersistenceAdapter, CassandraCompatiblePersistenceAdapter, JsonFilePersistenceAdapter, PostgresCompatiblePersistenceAdapter, SQLitePersistenceAdapter, sqliteAvailable } from "../src/api/persistence";
import { createMemoryToolHandlers } from "../src/connectors/mcpHandlers";
import { buildLeaderboardArtifact, validateLeaderboardArtifact } from "../src/eval/leaderboard";
import { publishLeaderboardArtifact } from "../src/eval/publishLeaderboard";
import { runNextgenBenchmarkSuites } from "../src/eval/nextgenBenchmarks";
import { runAnswerGenerationBenchmark } from "../src/eval/answerGeneration";
import { runMarketGate } from "../src/eval/marketGate";

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

    const health = handlers.health({ userId: "u1" });
    expect(health.active).toBe(1);

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
    expect(pack.results[0].retrieval.citation).toContain("AGENTS.md:7");
    expect(pack.results[0].validity.validFrom).toBe("2026-05-01T00:00:00.000Z");
    expect(pack.results.some((result) => result.content.includes("private draft"))).toBe(false);
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
        { role: "tool", content: "Verified npm test passed for Atlas." }
      ],
      { userId: "u1", sessionId: "s1", appId: "app-a" }
    );
    expect(extracted.memories.length).toBeGreaterThan(1);
    expect(Object.keys(extracted.entityLinks).length).toBeGreaterThan(0);
    const episode = service.listEpisodes("u1")[0];
    expect(episode.rawConversation).toHaveLength(2);
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
    service.add({ userId: "u3", content: "Privacy insight aggregate one.", source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u4", content: "Privacy insight aggregate two.", source: { kind: "human", confidence: 0.95 } });

    const rule = service.setRetentionRule({ label: "Atlas archive", retentionDays: 1, action: "archive", scope: { entity: "atlas" } });
    expect(service.listRetentionRules()[0].id).toBe(rule.id);
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
    const intentDriven = service.search({ userId: "u1", query: "How are Atlas and Redis connected?" });
    expect(intentDriven.some((result) => result.retrievalMode === "path")).toBe(true);

    const contradictions = service.search({ userId: "u1", query: "Atlas Redis shared cache", mode: "path" });
    expect(contradictions.some((result) => result.contradiction && result.decision === "exclude")).toBe(true);
    expect(contradictions.some((result) => result.retrievalMode === "path" && result.explanation?.some((item) => item.includes("mode path")))).toBe(true);

    service.addTrainingSample({ userId: "u1", query: "cli workflow", outcome: "accepted", signals: { keyword: 0.9, semantic: 0.7 } });
    service.addTrainingSample({ userId: "u2", query: "other", outcome: "accepted", signals: { graph: 1 } });
    const learned = service.learnRetrievalProfile("p1-learned", "Project profile", { scope: { userId: "u1", projectId: "p1" } });
    expect(learned.samples).toBe(1);
    expect(learned.profile.scope?.projectId).toBe("p1");
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

  it("deduplicates extracted facts and links state changes additively", () => {
    const service = new MemoryService();
    service.add({ userId: "u1", content: "Atlas uses SQLite for cache.", entities: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    const first = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    const second = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    expect(first.memories).toHaveLength(1);
    expect(second.memories).toHaveLength(0);
    expect(first.memories[0].relations.some((relation) => relation.type === "supersedes")).toBe(true);
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

    const installedProfile = service.installMarketplaceModuleById("retrieval-trust-heavy");
    expect(installedProfile.installState).toBe("installed");
    expect(service.getRetrievalProfiles().some((profile) => profile.id === "trust-heavy")).toBe(true);

    const bundle = service.managedMigrationBundle({ target: "managed", backupRef: "local-backup://market", ssoProvider: "oidc", secretManager: "vault" });
    expect(bundle.placeholders.sso.required).toBe(true);
    expect(bundle.deployment?.secretManager).toBe("vault");
    expect(bundle.deployment?.artifacts.dockerCompose).toBe("docker/docker-compose.yml");
    expect(bundle.counts.connectors).toBeGreaterThan(0);
    expect(service.apiDescription().clients.typescript).toContain("src/sdk/client.ts");

    const calls: Array<{ url: string; body?: string }> = [];
    const client = new CognibrainClient({
      baseUrl: "http://memory.local",
      fetchImpl: (async (url, init) => {
        calls.push({ url: String(url), body: String(init?.body ?? "") });
        return new Response(JSON.stringify({ id: "mem_sdk", content: "SDK memory" }), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch
    });
    const added = await client.add({ userId: "sdk", content: "SDK memory" });
    await client.feedback("mem_sdk", "helpful", "sdk");
    await client.graphQuery("MATCH (a)-[:mentions]->(b) RETURN a,b", "sdk");
    expect(added.id).toBe("mem_sdk");
    expect(calls.map((call) => call.url)).toEqual(["http://memory.local/memories", "http://memory.local/feedback", "http://memory.local/graph/query"]);
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
      expect(service.apiDescription().paths["/managed/control-plane"]).toContain("GET");

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
    expect(scanned.scan?.status).toBe("passed");

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
  });

  it("runs deterministic nextgen benchmark suites", () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-bench-"));
    try {
      const report = runNextgenBenchmarkSuites(join(dir, "nextgen-benchmarks.json"), join(dir, "benchmark-trend.json"));
      expect(report.passed).toBe(true);
      expect(report.suites.map((suite) => suite.id)).toEqual(["answer-generation", "multi-hop-temporal", "behavioral-patterns", "usp-evidence-pack"]);
      expect(report.trend.points.at(-1)?.meanScore).toBeGreaterThan(0.9);
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

  it("validates connector manifests, syncs connector events, retries webhooks, and ingests translated media", () => {
    const service = new MemoryService();
    const official = service.listConnectorManifests();
    expect(official.map((manifest) => manifest.kind)).toEqual(expect.arrayContaining(["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage"]));
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
    expect(service.listConnectorSyncRecords("unit-chat")[0].id).toBe(sync.id);

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
    const promoted = service.promoteSharedMemory(privateMemory.id, "org1");
    expect((promoted.metadata.shared as { status?: string }).status).toBe("approved");

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
});
