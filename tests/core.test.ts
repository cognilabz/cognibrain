import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CODING_DOMAIN_MODULE, DOMAIN_MODULES, InMemoryEventJournal, InMemoryMemoryRepository, LOCAL_CONTEXT_RERANKER_PROFILE, MemoryProjectionBuilder, MemoryStore, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, healthReport, rankMemories, tokenize, extractEntities, rebuildMemoryStoreFromEvents, type EngineeringMemoryKind, type MemoryClaim } from "../src/core";
import { JsonCommandMemoryIntelligence } from "../src/core/providers";
import { HarnessMemoryHook } from "../src/connectors/harnessHook";
import { connectorAuthHeaders, createConnectorManifest, createPlatformIntegration, createWritebackPlan, runConnectorPoll } from "../src/connectors/sdk";
import { MemoryService, createProductionPersistedFileFromRepository } from "../src/api/service";
import { PostgresMemoryRepository, SQLiteMemoryRepository, sqliteRepositoryAvailable } from "../src/api/repositories";
import { CognibrainClient, CognibrainError } from "../sdk/typescript/client";
import { AppendOnlyLogPersistenceAdapter, CassandraCompatiblePersistenceAdapter, CassandraRemotePersistenceAdapter, JsonFilePersistenceAdapter, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, SQLitePersistenceAdapter, createPersistenceFromEnv, sqliteAvailable } from "../src/api/persistence";
import { createMemoryToolHandlers } from "../src/connectors/mcpHandlers";
import { registerMemoryMcpTools } from "../src/connectors/mcpTools";
import { buildLeaderboardArtifact, validateLeaderboardArtifact } from "../src/eval/leaderboard";
import { publishLeaderboardArtifact } from "../src/eval/publishLeaderboard";
import { runNextgenBenchmarkSuites } from "../src/eval/nextgenBenchmarks";
import { runAnswerGenerationBenchmark } from "../src/eval/answerGeneration";
import { runMarketGate } from "../src/eval/marketGate";
import { runProductionLoadBenchmark } from "../src/eval/load";
import { OpenAICompatibleEmbeddingProvider, embeddingProviderFromEnv } from "../src/core/openaiEmbeddings";
import { CODING_QUERY_INTENT_CASES } from "../src/eval/codingIntentCases";

const nodeRequire = createRequire(import.meta.url);

describe("TypeScript memory core", () => {
  it("records typed memory events through the event journal contract", async () => {
    const journal = new InMemoryEventJournal();
    const event = await journal.appendEvent({
      type: "current_truth.decided",
      aggregateId: "claim-atlas",
      occurredAt: "2026-06-05T00:00:00.000Z",
      payload: { selectedMemoryId: "mem-atlas" }
    });

    expect(event.id).toBeTruthy();
    await journal.appendEvent({
      type: "dream.job_queued",
      aggregateId: "job-atlas",
      occurredAt: "2026-06-05T00:01:00.000Z",
      payload: { jobId: "job-atlas" }
    });

    const claimEvents = await journal.readEvents({ aggregateId: "claim-atlas" });
    expect(claimEvents).toEqual([expect.objectContaining({ type: "current_truth.decided", payload: { selectedMemoryId: "mem-atlas" } })]);
  });

  it("rebuilds a MemoryStore projection from typed memory events", async () => {
    const sourceStore = new MemoryStore();
    const memory = sourceStore.add({
      userId: "u1",
      content: "Atlas uses npm test for release checks.",
      source: { kind: "human", confidence: 0.96 }
    });
    const updated = sourceStore.update(memory.id, { content: "Atlas uses npm run release:check for release checks." });
    const deleted = sourceStore.add({
      userId: "u1",
      content: "Delete this stale projection row.",
      source: { kind: "human", confidence: 0.9 }
    });
    const journal = new InMemoryEventJournal();
    await journal.appendEvent({ type: "memory.created", aggregateId: memory.id, occurredAt: "2026-06-05T00:00:00.000Z", payload: memory });
    await journal.appendEvent({ type: "current_truth.decided", aggregateId: "claim-atlas", occurredAt: "2026-06-05T00:00:01.000Z", payload: { selectedMemoryId: memory.id } });
    await journal.appendEvent({ type: "memory.updated", aggregateId: memory.id, occurredAt: "2026-06-05T00:00:02.000Z", payload: updated });
    await journal.appendEvent({ type: "memory.created", aggregateId: deleted.id, occurredAt: "2026-06-05T00:00:03.000Z", payload: deleted });
    await journal.appendEvent({ type: "memory.deleted", aggregateId: deleted.id, occurredAt: "2026-06-05T00:00:04.000Z", payload: { memoryId: deleted.id } });

    const { store, report } = await new MemoryProjectionBuilder(journal).rebuild();

    expect(report).toMatchObject({ eventsRead: 5, memoriesCreatedOrUpdated: 3, memoriesDeleted: 1, ignoredEvents: 1, errors: [] });
    expect(store.get(memory.id).content).toBe("Atlas uses npm run release:check for release checks.");
    expect(() => store.get(deleted.id)).toThrow("Memory not found");
  });

  it("rebuilds claims truth conflicts evidence dream and connector projections from typed events", async () => {
    const journal = new InMemoryEventJournal();
    const claim = {
      id: "claim-release-command",
      subject: "cognibrain",
      predicate: "release_command",
      object: "npm run release:check",
      qualifiers: {},
      sourceMemoryId: "mem-release-command",
      confidence: 0.96,
      trust: 0.95,
      state: "active" as const,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z"
    };
    const conflict = {
      id: "conflict-release-command",
      claimIds: ["claim-old", claim.id],
      detectedAt: "2026-06-05T00:01:00.000Z",
      status: "operator_review" as const
    };
    const truthDecision = {
      subject: claim.subject,
      predicate: claim.predicate,
      selectedClaimId: claim.id,
      selectedMemoryId: claim.sourceMemoryId,
      state: "selected" as const,
      reason: "newer source-backed release command",
      suppressedClaimIds: ["claim-old"],
      conflictSetId: conflict.id
    };
    const evidencePack = {
      schemaVersion: "1.0" as const,
      id: "ctx-release-command",
      generatedAt: "2026-06-05T00:02:00.000Z",
      query: "release command",
      userId: "u1",
      tokenBudget: 900,
      context: "safe_to_inject=true",
      results: [],
      summary: { included: 0, warnings: 0, excluded: 0, stale: 0, contradictions: 0 }
    };
    const connectorState = {
      connectorId: "official-github",
      lastStatus: "applied" as const,
      records: 2,
      cursor: "cursor-42"
    };
    await journal.appendEvent({ type: "claim.registered", aggregateId: claim.id, occurredAt: "2026-06-05T00:00:00.000Z", payload: claim });
    await journal.appendEvent({ type: "conflict.opened", aggregateId: conflict.id, occurredAt: "2026-06-05T00:01:00.000Z", payload: conflict });
    await journal.appendEvent({ type: "current_truth.decided", aggregateId: "cognibrain:release_command", occurredAt: "2026-06-05T00:01:30.000Z", payload: truthDecision });
    await journal.appendEvent({ type: "context_pack.created", aggregateId: evidencePack.id, occurredAt: evidencePack.generatedAt, payload: evidencePack });
    await journal.appendEvent({ type: "dream.job_queued", aggregateId: "job-release", occurredAt: "2026-06-05T00:03:00.000Z", payload: { jobId: "job-release", status: "queued", trigger: "before_release" } });
    await journal.appendEvent({ type: "dream.job_leased", aggregateId: "job-release", occurredAt: "2026-06-05T00:04:00.000Z", payload: { jobId: "job-release", status: "running", leaseOwner: "worker-a" } });
    await journal.appendEvent({ type: "connector.polled", aggregateId: connectorState.connectorId, occurredAt: "2026-06-05T00:05:00.000Z", payload: connectorState });

    const { domain, report } = await new MemoryProjectionBuilder(journal).rebuild();

    expect(report.domainEventsApplied).toBe(7);
    expect(domain.claims).toEqual([expect.objectContaining({ id: claim.id })]);
    expect(domain.conflictSets).toEqual([expect.objectContaining({ id: conflict.id, status: "operator_review" })]);
    expect(domain.currentTruth).toEqual([expect.objectContaining({ selectedClaimId: claim.id, suppressedClaimIds: ["claim-old"] })]);
    expect(domain.evidencePacks).toEqual([expect.objectContaining({ id: evidencePack.id, context: "safe_to_inject=true" })]);
    expect(domain.dreamJobs).toEqual([expect.objectContaining({ jobId: "job-release", status: "running", leaseOwner: "worker-a" })]);
    expect(domain.connectorSyncStates).toEqual([expect.objectContaining({ connectorId: "official-github", cursor: "cursor-42" })]);
  });

  it("rebuilds non-memory domain projections from a persisted SQLite event journal", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-domain-projection-journal-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await repository.appendEvent({
        type: "claim.registered",
        aggregateId: "claim-sqlite-domain",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: {
          id: "claim-sqlite-domain",
          subject: "sqlite",
          predicate: "rebuilds_domain_projection",
          object: "true",
          qualifiers: {},
          sourceMemoryId: "mem-sqlite-domain",
          confidence: 0.9,
          trust: 0.9,
          state: "active",
          createdAt: "2026-06-05T00:00:00.000Z",
          updatedAt: "2026-06-05T00:00:00.000Z"
        }
      });
      await repository.appendEvent({
        type: "connector.polled",
        aggregateId: "official-github",
        occurredAt: "2026-06-05T00:01:00.000Z",
        payload: { connectorId: "official-github", lastStatus: "applied", records: 1, cursor: "sqlite-cursor" }
      });

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const { domain, report } = await rebuildMemoryStoreFromEvents(reloaded);

      expect(report.domainEventsApplied).toBe(2);
      expect(domain.claims).toEqual([expect.objectContaining({ id: "claim-sqlite-domain" })]);
      expect(domain.connectorSyncStates).toEqual([expect.objectContaining({ connectorId: "official-github", cursor: "sqlite-cursor" })]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists typed memory events through the SQLite repository journal", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-event-journal-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await repository.appendEvent({
        type: "source_ref.revalidated",
        aggregateId: "mem-source",
        occurredAt: "2026-06-05T00:00:00.000Z",
        payload: { status: "confirmed" }
      });

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const events = await reloaded.readEvents({ aggregateId: "mem-source", type: "source_ref.revalidated" });
      expect(events).toEqual([
        expect.objectContaining({
          type: "source_ref.revalidated",
          aggregateId: "mem-source",
          payload: { status: "confirmed" }
        })
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rebuilds a MemoryStore projection from a persisted SQLite event journal", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-projection-journal-"));
    try {
      const sourceStore = new MemoryStore();
      const memory = sourceStore.add({
        userId: "u1",
        content: "SQLite event journal can rebuild projection caches.",
        source: { kind: "tool", confidence: 0.88 }
      });
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await repository.appendEvent({ type: "memory.created", aggregateId: memory.id, occurredAt: "2026-06-05T00:00:00.000Z", payload: memory });

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const { store, report } = await rebuildMemoryStoreFromEvents(reloaded);

      expect(report.errors).toEqual([]);
      expect(report.memoriesCreatedOrUpdated).toBe(1);
      expect(store.get(memory.id).content).toBe("SQLite event journal can rebuild projection caches.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists claims and current truth through SQLite domain repositories", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-truth-repository-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const claim = {
        id: "claim-atlas-release",
        subject: "atlas",
        predicate: "release_command",
        object: "npm run release:check",
        qualifiers: {},
        sourceMemoryId: "mem-atlas-release",
        confidence: 0.97,
        trust: 0.94,
        state: "active" as const,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z"
      };
      const decision = {
        subject: "atlas",
        predicate: "release_command",
        selectedClaimId: claim.id,
        selectedMemoryId: claim.sourceMemoryId,
        state: "selected" as const,
        reason: "fixture repository selected current truth",
        suppressedClaimIds: [],
        scoreBreakdown: { selected: 0.99 }
      };

      await repository.claimRepository.register(claim);
      await repository.truthRepository.decide(decision);

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await expect(reloaded.claimRepository.get(claim.id)).resolves.toMatchObject({ id: claim.id, object: "npm run release:check" });
      await expect(reloaded.claimRepository.list({ subject: "atlas", predicate: "release_command" })).resolves.toEqual([expect.objectContaining({ id: claim.id })]);
      await expect(reloaded.truthRepository.currentForClaim("atlas", "release_command")).resolves.toMatchObject({ selectedClaimId: claim.id, state: "selected" });
      const events = await reloaded.readEvents({ aggregateId: claim.id });
      expect(events.map((event) => event.type)).toContain("claim.registered");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists conflict evidence connector policy and retention rows through SQLite domain repositories", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-domain-repositories-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const conflict = {
        id: "conflict-release-rule",
        claimIds: ["claim-old", "claim-new"],
        detectedAt: "2026-06-05T00:00:00.000Z",
        status: "open" as const
      };
      const evidencePack = {
        schemaVersion: "1.0" as const,
        id: "ctx-release-rule",
        generatedAt: "2026-06-05T00:00:00.000Z",
        query: "release command",
        userId: "u1",
        tokenBudget: 1200,
        context: "safe_to_inject=true",
        results: [],
        summary: {
          included: 0,
          warnings: 0,
          excluded: 0,
          stale: 0,
          contradictions: 0
        }
      };
      const connectorState = {
        connectorId: "official-github",
        lastStatus: "applied" as const,
        records: 3,
        cursor: "cursor-1"
      };
      const policyRule = {
        id: "policy-release-read",
        label: "Allow release proof retrieval",
        effect: "allow" as const,
        operations: ["retrieve" as const],
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z"
      };
      const retentionRule = {
        id: "retention-release-proof",
        label: "Archive release proof after one year",
        retentionDays: 365,
        action: "archive" as const,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z"
      };

      await repository.conflictRepository.save(conflict);
      await repository.evidencePackRepository.save(evidencePack);
      await repository.connectorSyncRepository.save(connectorState);
      await repository.policyRepository.savePolicy(policyRule);
      await repository.policyRepository.saveRetention(retentionRule);

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await expect(reloaded.conflictRepository.get(conflict.id)).resolves.toMatchObject({ id: conflict.id, status: "open" });
      await expect(reloaded.conflictRepository.list({ status: "open" })).resolves.toEqual([expect.objectContaining({ id: conflict.id })]);
      await expect(reloaded.evidencePackRepository.get(evidencePack.id)).resolves.toMatchObject({ id: evidencePack.id, context: "safe_to_inject=true" });
      await expect(reloaded.connectorSyncRepository.get(connectorState.connectorId)).resolves.toMatchObject({ connectorId: "official-github", cursor: "cursor-1" });

      const events = await reloaded.readEvents();
      expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["conflict.opened", "context_pack.created", "connector.polled"]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("commits memory claim truth and event writes through a SQLite async UnitOfWork", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-uow-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const uow = repository.createUnitOfWork();
      const memory = await uow.memoryRepository.create({
        userId: "u1",
        content: "UnitOfWork writes memory rows and truth records together.",
        source: { kind: "tool", confidence: 0.92 }
      });
      const claim = {
        id: "claim-uow-release",
        subject: "unit_of_work",
        predicate: "writes",
        object: "memory_claim_truth_event",
        qualifiers: {},
        sourceMemoryId: memory.id,
        confidence: 0.92,
        trust: 0.91,
        state: "active" as const,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z"
      };
      await uow.claimRepository.register(claim);
      await uow.truthRepository.decide({
        subject: claim.subject,
        predicate: claim.predicate,
        selectedClaimId: claim.id,
        selectedMemoryId: memory.id,
        state: "selected",
        reason: "unit of work selected current truth",
        suppressedClaimIds: []
      });
      await uow.appendEvent({
        type: "patch_evidence.created",
        aggregateId: memory.id,
        occurredAt: "2026-06-05T00:01:00.000Z",
        payload: { memoryId: memory.id, claimId: claim.id }
      });

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      await expect(reloaded.get(memory.id)).toMatchObject({ id: memory.id });
      await expect(reloaded.claimRepository.get(claim.id)).resolves.toMatchObject({ id: claim.id, sourceMemoryId: memory.id });
      await expect(reloaded.truthRepository.currentForClaim(claim.subject, claim.predicate)).resolves.toMatchObject({ selectedClaimId: claim.id });
      await expect(reloaded.readEvents({ aggregateId: memory.id, type: "patch_evidence.created" })).resolves.toEqual([
        expect.objectContaining({ type: "patch_evidence.created", payload: { memoryId: memory.id, claimId: claim.id } })
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rolls back SQLite async UnitOfWork writes atomically", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-uow-rollback-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      let memoryId = "";
      await expect(repository.executeUnitOfWork(async (uow) => {
        const memory = await uow.memoryRepository.create({
          userId: "u1",
          content: "This UnitOfWork should roll back.",
          source: { kind: "tool", confidence: 0.92 }
        });
        memoryId = memory.id;
        await uow.appendEvent({
          type: "patch_evidence.created",
          aggregateId: memory.id,
          occurredAt: "2026-06-05T00:02:00.000Z",
          payload: { memoryId: memory.id }
        });
        throw new Error("rollback fixture");
      })).rejects.toThrow("rollback fixture");

      const reloaded = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      expect(() => reloaded.get(memoryId)).toThrow("Memory not found");
      await expect(reloaded.readEvents({ aggregateId: memoryId })).resolves.toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("claims due dream jobs through a durable SQLite lease repository", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-dream-queue-"));
    try {
      const repository = new SQLiteMemoryRepository(join(dir, "memory.sqlite"));
      const baseJob = {
        jobId: "job-release",
        userId: "u1",
        status: "queued" as const,
        trigger: "before_release" as const,
        mode: "dream" as const,
        queuedAt: "2026-06-05T00:00:00.000Z",
        priority: 10,
        progress: { connectorPolls: 0, memoriesEvaluated: 0, contradictions: 0, sourceRevalidations: 0, verificationScheduled: 0 },
        plan: {
          userId: "u1",
          generatedAt: "2026-06-05T00:00:00.000Z",
          trigger: "before_release" as const,
          mode: "dream" as const,
          budget: "release" as const,
          sourceRefresh: true,
          connectorIds: [],
          shouldDream: true,
          forced: true,
          reasons: ["release gate"],
          recommendedActions: ["revalidate sources"],
          signals: {
            activeMemories: 0,
            writesSinceDream: 0,
            writeThreshold: 1,
            dueByWriteThreshold: true,
            dueByInterval: false,
            verificationQueue: 0,
            contradictions: 0,
            needsVerification: 0,
            staleSourceRefs: 0,
            sourceRefs: 0,
            connectorCandidates: 0
          }
        }
      };
      await repository.queue(baseJob);

      const first = await repository.claimDueJob({ workerId: "worker-a", now: "2026-06-05T00:00:01.000Z", leaseMs: 60_000 });
      const second = await repository.claimDueJob({ workerId: "worker-b", now: "2026-06-05T00:00:02.000Z", leaseMs: 60_000 });

      expect(first).toMatchObject({ jobId: "job-release", status: "running", leaseOwner: "worker-a", attemptCount: 1 });
      expect(second).toBeUndefined();

      const reclaimed = await repository.claimDueJob({ workerId: "worker-b", now: "2026-06-05T00:02:02.000Z", leaseMs: 60_000 });
      expect(reclaimed).toMatchObject({ jobId: "job-release", status: "running", leaseOwner: "worker-b", attemptCount: 2 });

      const completed = await repository.completeJob("job-release", { status: "succeeded" });
      expect(completed.status).toBe("succeeded");
      const events = await repository.readEvents({ aggregateId: "job-release" });
      expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["dream.job_queued", "dream.job_leased", "dream.job_completed"]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
    expect(results[0].explanation?.some((item) => item.includes(LOCAL_CONTEXT_RERANKER_PROFILE.id))).toBe(true);
  });

  it("supports reusable weighted local reranker profiles outside benchmark-specific code", () => {
    const store = new MemoryStore();
    const trusted = store.add({
      userId: "u1",
      content: "Atlas cache settings live in Redis.",
      tags: ["atlas"],
      entities: ["atlas", "redis"],
      source: { kind: "human", confidence: 0.95 }
    });
    store.add({
      userId: "u1",
      content: "Atlas cache notes mention generic storage.",
      tags: ["atlas"],
      entities: ["atlas"],
      source: { kind: "agent", confidence: 0.5 }
    });

    const ranked = rankMemories("Redis cache", store.list(), {
      id: "test-reranker-profile",
      label: "Test reranker profile",
      weights: { semantic: 0.4, keyword: 0.4, entity: 0.1, trust: 0.1 },
      includeTags: true,
      includeEntities: true
    });

    expect(ranked[0].memory.id).toBe(trusted.id);
    expect(ranked[0].signals.semantic).toBeGreaterThan(0);
    expect(ranked[0].signals.keyword).toBeGreaterThan(0);
  });

  it("keeps release-critical context injection unsafe until an explicit harness evidence judge accepts it", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.add({
      userId: "u1",
      content: "Atlas production deploy must run npm test and npm run build before release.",
      entities: ["atlas", "production", "release"],
      source: { kind: "reviewed_code", confidence: 0.98 },
      timestamp: "2026-06-04T00:00:00.000Z"
    });

    const localOnly = service.evidencePack({
      userId: "u1",
      query: "ship production release deploy gate for Atlas",
      now: new Date("2026-06-04T01:00:00.000Z")
    });
    expect(localOnly.context).not.toContain("Atlas production deploy");
    expect(localOnly.excludedResults?.[0]).toMatchObject({ decision: "review" });
    expect(localOnly.excludedResults?.[0].reason).toContain("unsafe-to-inject");

    const judged = service.evidencePack({
      userId: "u1",
      query: "ship production release deploy gate for Atlas",
      now: new Date("2026-06-04T01:00:00.000Z"),
      evidenceJudge: {
        judgeEvidence: ({ results }) => ({
          answerable: true,
          confidence: 0.96,
          reason: "fixture harness evidence judge accepted the reviewed release gate memory",
          decisions: results.map((result) => ({ id: result.memory.id, decision: "include", confidence: 0.96, reason: "release gate supported" }))
        })
      }
    });

    expect(judged.context).toContain("Atlas production deploy");
    expect(judged.results[0].retrieval.verification).toMatchObject({
      evidenceJudge: "harness",
      claimSafe: true,
      harnessVerified: true
    });
  });

  it("uses BM25-style lexical ranking for repeated exact query terms", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Atlas cache cache cache incidents mention Redis once.", source: { kind: "human", confidence: 0.95 } });
    store.add({ userId: "u1", content: "Atlas cache policy mentions storage in a general way.", source: { kind: "human", confidence: 0.95 } });
    const results = new RetrievalEngine(store, { keyword: 1, semantic: 0, entity: 0, temporal: 0, trust: 0, graph: 0, access: 0 }).search({ userId: "u1", query: "cache cache Redis", limit: 2 });
    expect(results[0].memory.content).toContain("Redis");
    expect(results[0].signals.keyword).toBeGreaterThan(results[1].signals.keyword);
  });

  it("constructs MemoryService through a repository boundary instead of a hard-wired store", () => {
    const repository = new InMemoryMemoryRepository();
    const service = new MemoryService({ repository });
    const memory = service.add({ userId: "u1", content: "Repository-backed service writes through the MemoryRepository contract.", source: { kind: "human", confidence: 0.96 } });

    expect(repository.get(memory.id).content).toContain("MemoryRepository");
    expect(service.storage).toBeInstanceOf(RepositoryBackedStorageAdapter);
    expect(service.store.get(memory.id).id).toBe(memory.id);
  });

  it("runs MemoryService on a SQLiteMemoryRepository with row-level CRUD persistence", () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-repository-"));
    try {
      const path = join(dir, "memory.sqlite");
      const repository = new SQLiteMemoryRepository(path);
      const service = new MemoryService({ repository, autoDream: { enabled: false } });
      const created = service.add({ userId: "u1", content: "SQLite repository writes MemoryService mutations as durable rows.", source: { kind: "human", confidence: 0.96 } });
      const updated = service.update(created.id, { content: "SQLite repository updates exactly the memory row used by MemoryService." });

      expect(updated.content).toContain("updates exactly");
      expect(new SQLiteMemoryRepository(path).get(created.id).content).toContain("updates exactly");

      expect(service.delete(created.id)).toBe(true);
      expect(new SQLiteMemoryRepository(path).list("u1").some((memory) => memory.id === created.id)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not reimport the full store during SQLite repository-backed service persistence", () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-no-import-"));
    try {
      const path = join(dir, "memory.sqlite");
      const service = new MemoryService({ repository: new SQLiteMemoryRepository(path), autoDream: { enabled: false } });
      const created = service.add({ userId: "u1", content: "SQLite repository service persistence keeps CRUD rows primary.", source: { kind: "human", confidence: 0.96 } });
      service.update(created.id, { content: "SQLite repository updates remain row-level without snapshot reimport events." });

      const { DatabaseSync } = nodeRequire("node:sqlite") as { DatabaseSync: new (path: string) => { prepare: (sql: string) => { all: () => unknown[] }; close?: () => void } };
      const db = new DatabaseSync(path);
      try {
        const rows = db.prepare("select event_type as eventType from persistence_events order by id").all() as Array<{ eventType: string }>;
        const eventTypes = rows.map((row) => row.eventType);
        expect(eventTypes).toEqual(expect.arrayContaining(["memory.created", "memory.updated"]));
        expect(eventTypes).not.toContain("memory.imported");
      } finally {
        db.close?.();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists MemoryService truth and dream state inside SQLiteMemoryRepository without a JSON sidecar", async () => {
    if (!sqliteRepositoryAvailable()) return;
    const dir = mkdtempSync(join(tmpdir(), "memory-sqlite-state-"));
    try {
      const path = join(dir, "memory.sqlite");
      const service = new MemoryService({ repository: new SQLiteMemoryRepository(path), autoDream: { enabled: false } });
      const firstClaim: MemoryClaim = {
        id: "claim-old",
        subject: "atlas",
        predicate: "test_command",
        object: "pnpm test",
        qualifiers: {},
        source: { kind: "agent", confidence: 0.6 },
        confidence: 0.6,
        durability: "durable",
        sensitivity: "none",
        scope: { userId: "u1", projectId: "atlas" }
      };
      const secondClaim: MemoryClaim = { ...firstClaim, id: "claim-new", object: "npm test", source: { kind: "reviewed_code", confidence: 0.97 }, confidence: 0.97 };
      service.add({ userId: "u1", projectId: "atlas", content: "Atlas test command is pnpm test.", source: { kind: "agent", confidence: 0.6 }, metadata: { claim: firstClaim } });
      const current = service.add({ userId: "u1", projectId: "atlas", content: "Atlas test command is npm test.", source: { kind: "reviewed_code", confidence: 0.97 }, metadata: { claim: secondClaim, engineeringKind: "review_correction" } });
      await service.startDreamJob({ userId: "u1", trigger: "manual_dream", mode: "dream", force: true }, fetch, 10_000, { wait: true });

      const reloaded = new MemoryService({ repository: new SQLiteMemoryRepository(path), autoDream: { enabled: false } });
      expect(reloaded.list("u1").map((memory) => memory.content).join("\n")).toContain("npm test");
      expect(reloaded.currentTruthForMemory(reloaded.get(current.id))?.selectedMemoryId).toBe(current.id);
      expect(reloaded.listConflictSets().some((set) => set.claimIds.length === 2)).toBe(true);
      expect(reloaded.dreamJobStatus().length).toBeGreaterThanOrEqual(1);
      expect(reloaded.storageStatus().active).toBe("sqlite-repository");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("selects current truth from claim records and explains suppressed stale claims in evidence packs", () => {
    const service = new MemoryService();
    const npmClaim: MemoryClaim = {
      id: "claim-npm",
      subject: "atlas",
      predicate: "package_manager",
      object: "npm",
      qualifiers: {},
      source: { kind: "agent", confidence: 0.55 },
      confidence: 0.55,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1", projectId: "atlas" }
    };
    const pnpmClaim: MemoryClaim = {
      ...npmClaim,
      id: "claim-pnpm",
      object: "pnpm",
      source: { kind: "reviewed_code", confidence: 0.95 },
      confidence: 0.95
    };
    const oldMemory = service.add({
      userId: "u1",
      projectId: "atlas",
      content: "Atlas package manager is npm.",
      source: { kind: "agent", confidence: 0.55 },
      metadata: { claim: npmClaim }
    });
    const currentMemory = service.add({
      userId: "u1",
      projectId: "atlas",
      content: "Atlas package manager is pnpm.",
      source: { kind: "reviewed_code", confidence: 0.95 },
      metadata: { claim: pnpmClaim, engineeringKind: "review_correction" }
    });

    const oldTruth = service.currentTruthForMemory(oldMemory);
    expect(oldTruth?.selectedMemoryId).toBe(currentMemory.id);
    expect(oldTruth?.suppressedClaimIds.length).toBeGreaterThanOrEqual(1);

    const search = service.search({ userId: "u1", projectId: "atlas", query: "Atlas package manager", limit: 2 });
    expect(search.find((result) => result.memory.id === oldMemory.id)?.decision).toBe("exclude");
    expect(search.find((result) => result.memory.id === oldMemory.id)?.truth?.selectedMemoryId).toBe(currentMemory.id);

    const pack = service.evidencePack({ userId: "u1", projectId: "atlas", query: "Atlas package manager", limit: 2 });
    expect(pack.truthDecisions?.some((decision) => decision.selectedMemoryId === currentMemory.id)).toBe(true);
    expect(pack.excludedResults?.some((result) => result.memoryId === oldMemory.id && result.truthDecision?.selectedMemoryId === currentMemory.id)).toBe(true);
    expect(JSON.stringify(pack.results)).toContain("truth state");
    expect(pack.context).toContain(`truth=selected selected=${currentMemory.id}`);
    expect(pack.context).toContain("safe_to_inject=");
    expect(pack.context).toContain("suppressed=1");

    const testClaim: MemoryClaim = {
      id: "claim-jest",
      subject: "atlas",
      predicate: "test_command",
      object: "jest",
      qualifiers: {},
      source: { kind: "agent", confidence: 0.55 },
      confidence: 0.55,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1", projectId: "atlas" }
    };
    const staleTestMemory = service.add({
      userId: "u1",
      projectId: "atlas",
      content: "Atlas test command is jest.",
      source: { kind: "agent", confidence: 0.55 },
      metadata: { claim: testClaim, engineeringKind: "test_strategy" }
    });
    const currentTestMemory = service.add({
      userId: "u1",
      projectId: "atlas",
      content: "Atlas test command is vitest.",
      source: { kind: "reviewed_code", confidence: 0.95 },
      metadata: { claim: { ...testClaim, id: "claim-vitest", object: "vitest", source: { kind: "reviewed_code", confidence: 0.95 }, confidence: 0.95 }, engineeringKind: "test_strategy" }
    });
    const codingPack = service.codingContextPack({ userId: "u1", projectId: "atlas", query: "Atlas test command", limit: 2 });
    const codingEvidence = codingPack.sections.flatMap((section) => section.evidence);
    expect(codingPack.excludedStaleRules.some((item) => item.memoryId === staleTestMemory.id)).toBe(true);
    expect(codingPack.context).not.toContain(staleTestMemory.content);
    expect(codingEvidence.find((item) => item.memoryId === currentTestMemory.id)?.truthExplanation).toContain(`truth=selected selected=${currentTestMemory.id}`);
    expect(codingEvidence.find((item) => item.memoryId === currentTestMemory.id)?.truthExplanation).toContain("safe_to_inject=");
    expect(codingEvidence.find((item) => item.memoryId === currentTestMemory.id)?.truthExplanation).toContain("suppressed=1");
  });

  it("tracks evidence-pack delivery structurally when context text mentions another memory id", () => {
    const service = new MemoryService();
    const decoy = service.add({
      userId: "u1",
      content: `CobaltLane deployment gate archive placeholder. ${"Low-confidence unrelated audit filler. ".repeat(80)}`,
      source: { kind: "agent", confidence: 0.2 },
      confidence: 0.25
    });
    const target = service.add({
      userId: "u1",
      content: "CobaltLane deployment gate uses canary verify.",
      entities: ["cobaltlane", "deployment", "gate", "canary", "verify"],
      source: { kind: "reviewed_code", confidence: 0.99 },
      confidence: 0.99
    });
    const originalContextSelection = service.retrieval.contextSelection.bind(service.retrieval);
    service.retrieval.contextSelection = (results, tokenBudget) => {
      const selection = originalContextSelection(results, tokenBudget);
      return { ...selection, context: `${selection.context}\nquoted cross-reference [${decoy.id}]` };
    };

    const pack = service.evidencePack({ userId: "u1", query: "CobaltLane deployment gate canary verify", limit: 2, tokenBudget: 120 });
    expect(pack.context).toContain(target.id);
    expect(pack.context).toContain(`[${decoy.id}]`);
    expect(pack.results.map((result) => result.memoryId)).toContain(target.id);
    expect(pack.results.map((result) => result.memoryId)).not.toContain(decoy.id);
    expect(pack.excludedResults?.find((result) => result.memoryId === decoy.id)?.reason).toContain("token budget");
  });

  it("lists and resolves claim conflict sets with an operator decision", () => {
    const service = new MemoryService();
    const firstClaim: MemoryClaim = {
      id: "claim-redis",
      subject: "atlas",
      predicate: "cache_backend",
      object: "redis",
      qualifiers: {},
      source: { kind: "agent", confidence: 0.72 },
      confidence: 0.72,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1" }
    };
    const secondClaim: MemoryClaim = { ...firstClaim, id: "claim-postgres", object: "postgres", source: { kind: "human", confidence: 0.95 }, confidence: 0.95 };
    const oldMemory = service.add({ userId: "u1", content: "Atlas cache backend is Redis.", source: { kind: "agent", confidence: 0.72 }, metadata: { claim: firstClaim } });
    const newMemory = service.add({ userId: "u1", content: "Atlas cache backend is Postgres.", source: { kind: "human", confidence: 0.95 }, metadata: { claim: secondClaim } });

    const conflict = service.listConflictSets("open")[0];
    expect(conflict.claimIds.length).toBe(2);

    const selectedClaimId = service.currentTruthForMemory(newMemory)?.selectedClaimId;
    expect(selectedClaimId).toBeTruthy();
    const resolved = service.resolveConflictSet(conflict.id, { selectedClaimId: selectedClaimId!, reason: "operator confirmed the migration ADR", resolvedBy: "operator" });
    expect(resolved.status).toBe("resolved");
    expect(service.get(newMemory.id).beliefState).toBe("active");
    expect(service.get(oldMemory.id).beliefState).toBe("contradicted");
  });

  it("uses configurable source quality when selecting current truth", () => {
    const service = new MemoryService({ sourceQuality: { agent: 1, human: 0.2 } });
    const base: MemoryClaim = {
      id: "claim-a",
      subject: "beacon",
      predicate: "deploy_tool",
      object: "tool-a",
      qualifiers: {},
      source: { kind: "human", confidence: 0.9 },
      confidence: 0.9,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1" }
    };
    const human = service.add({ userId: "u1", content: "Beacon deploy tool is tool-a.", source: { kind: "human", confidence: 0.9 }, metadata: { claim: base } });
    const agent = service.add({ userId: "u1", content: "Beacon deploy tool is tool-b.", source: { kind: "agent", confidence: 0.9 }, metadata: { claim: { ...base, id: "claim-b", object: "tool-b", source: { kind: "agent", confidence: 0.9 } } } });

    expect(service.currentTruthForMemory(human)?.selectedMemoryId).toBe(agent.id);
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

  it("does not auto-enable OpenAI-compatible embeddings from runtime API key env vars", () => {
    const previousMemoryOpenAiKey = process.env.MEMORY_OPENAI_API_KEY;
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    const previousLocalEmbeddings = process.env.MEMORY_LOCAL_EMBEDDINGS;
    const previousPrivacyDisable = process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS;
    try {
      process.env.MEMORY_OPENAI_API_KEY = "runtime-key-must-not-enable-provider";
      process.env.OPENAI_API_KEY = "runtime-key-must-not-enable-provider";
      delete process.env.MEMORY_LOCAL_EMBEDDINGS;
      delete process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS;

      expect(embeddingProviderFromEnv()).toBeUndefined();

      process.env.MEMORY_LOCAL_EMBEDDINGS = "true";
      expect(embeddingProviderFromEnv()?.id).toBe("local-hash-embedding");
    } finally {
      if (previousMemoryOpenAiKey === undefined) delete process.env.MEMORY_OPENAI_API_KEY;
      else process.env.MEMORY_OPENAI_API_KEY = previousMemoryOpenAiKey;
      if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAiKey;
      if (previousLocalEmbeddings === undefined) delete process.env.MEMORY_LOCAL_EMBEDDINGS;
      else process.env.MEMORY_LOCAL_EMBEDDINGS = previousLocalEmbeddings;
      if (previousPrivacyDisable === undefined) delete process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS;
      else process.env.MEMORY_PRIVACY_DISABLE_EMBEDDINGS = previousPrivacyDisable;
    }
  });

  it("keeps runtime intelligence provider activation explicit to the harness", () => {
    const previousCommand = process.env.MEMORY_INTELLIGENCE_COMMAND;
    const previousArgs = process.env.MEMORY_INTELLIGENCE_ARGS;
    try {
      process.env.MEMORY_INTELLIGENCE_COMMAND = process.execPath;
      process.env.MEMORY_INTELLIGENCE_ARGS = "-e console.log(JSON.stringify({}))";
      const service = new MemoryService();
      expect(service.providerStatus()).toMatchObject({ active: false, fallback: "deterministic" });
      expect(service.providerStatus().command).toBeUndefined();
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_INTELLIGENCE_COMMAND;
      else process.env.MEMORY_INTELLIGENCE_COMMAND = previousCommand;
      if (previousArgs === undefined) delete process.env.MEMORY_INTELLIGENCE_ARGS;
      else process.env.MEMORY_INTELLIGENCE_ARGS = previousArgs;
    }
  });

  it("does not pass generic OpenAI provider secrets into runtime intelligence commands", () => {
    const previousMemoryOpenAiKey = process.env.MEMORY_OPENAI_API_KEY;
    const previousOpenAiKey = process.env.OPENAI_API_KEY;
    try {
      process.env.MEMORY_OPENAI_API_KEY = "runtime-provider-secret";
      process.env.OPENAI_API_KEY = "generic-provider-secret";
      const script = `
        process.stdin.resume();
        process.stdin.on("end", () => {
          console.log(JSON.stringify({
            content: process.env.MEMORY_OPENAI_API_KEY || process.env.OPENAI_API_KEY ? "leaked" : "sanitized",
            confidence: 0.91
          }));
        });
      `;
      const provider = new JsonCommandMemoryIntelligence({ command: process.execPath, args: ["-e", script] });
      expect(provider.summarize({ theme: "runtime env", memories: [], now: new Date("2026-06-04T00:00:00.000Z") }).content).toBe("sanitized");
    } finally {
      if (previousMemoryOpenAiKey === undefined) delete process.env.MEMORY_OPENAI_API_KEY;
      else process.env.MEMORY_OPENAI_API_KEY = previousMemoryOpenAiKey;
      if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAiKey;
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
    store.add({ userId: "u1", content: "Mira prefers verbose reports.", entities: ["mira"], source: { kind: "agent", confidence: 0.4 } });
    store.add({ userId: "u1", content: "Mira prefers concise reports.", entities: ["mira"], source: { kind: "human", confidence: 0.99 } });
    const report = new ReflectionEngine(store, {
      contradictionDetector: {
        classify: () => ({ label: "contradiction", confidence: 0.91, reason: "provider semantic conflict" })
      }
    }).run("u1");
    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(store.list("u1").some((memory) => memory.trust < 0.5 || memory.archivedAt)).toBe(true);
    expect(report.lifecycle.qualityScore).toBeGreaterThan(0);
  });

  it("runs reflection with bounded active-memory store scans", () => {
    class CountingStore extends MemoryStore {
      listCalls = 0;
      list(userId?: string) {
        this.listCalls += 1;
        return super.list(userId);
      }
    }
    const store = new CountingStore();
    store.add({ userId: "u1", content: "Atlas release prefers compact proof notes.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    store.add({ userId: "u1", content: "Atlas CI proof should include remote checks.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });

    new ReflectionEngine(store).run("u1");

    expect(store.listCalls).toBeLessThanOrEqual(3);
  });

  it("detects multilingual contradictions and supports an external contradiction classifier", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Mira nutzt Redis fuer Cache.", entities: ["mira", "cache"], source: { kind: "agent", confidence: 0.5 } });
    store.add({ userId: "u1", content: "Mira nutzt Postgres fuer Cache.", entities: ["mira", "cache"], source: { kind: "human", confidence: 0.99 } });

    const report = new ReflectionEngine(store, {
      contradictionDetector: {
        classify: () => ({ label: "contradiction", confidence: 0.91, reason: "external classifier conflict" })
      }
    }).run("u1");

    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(report.contradictions[0].detector).toBe("external");
    expect(report.contradictions[0].reason).toBe("external classifier conflict");
  });

  it("uses provider reflection evaluations instead of keyword claim patterns", () => {
    const store = new MemoryStore();
    const older = store.add({ userId: "u1", content: "Mira tends to ask for longer release notes.", source: { kind: "agent", confidence: 0.5 } });
    const newer = store.add({ userId: "u1", content: "Mira wants short release notes.", source: { kind: "human", confidence: 0.99 } });

    const report = new ReflectionEngine(store, {
      evaluator: {
        evaluateReflection: ({ memories }) =>
          memories.map((memory) => ({
            memoryId: memory.id,
            claims: [{ key: "mira:release-note-style", value: memory.id === older.id ? "long" : "short", confidence: 0.9 }],
            behavioralEvidence: { applies: true, theme: "release-notes", confidence: 0.8 }
          }))
      }
    }).run("u1");

    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(report.contradictions[0].detector).toBe("provider:reflection");
    expect(report.created.some((memory) => memory.metadata.pattern === "release-notes")).toBe(false);
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
      if (input.task === "evidence") console.log(JSON.stringify({ answerable: false, confidence: 0.91, reason: "provider found no sufficient evidence" }));
      if (input.task === "contradiction") console.log(JSON.stringify({ label: "contradiction", confidence: 0.88, reason: "provider contradiction" }));
      if (input.task === "summarize") console.log(JSON.stringify({ content: "Atlas provider summary from external intelligence.", confidence: 0.81 }));
      if (input.task === "translate") console.log(JSON.stringify({ translated: "Atlas memory provider translation.", confidence: 0.82 }));
    `;
    const provider = new JsonCommandMemoryIntelligence({ command: process.execPath, args: ["-e", script] });
    const service = new MemoryService({
      intelligence: { reranker: provider, verifier: provider, evidenceJudge: provider, contradictionDetector: provider, summarizer: provider, translator: provider }
    });
    service.add({ userId: "u1", content: "Atlas first cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u1", content: "Atlas second cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u1", content: "Atlas third cache note.", tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });

    const search = service.search({ userId: "u1", query: "Atlas cache", limit: 2 });
    expect(search[0].decision).toBe("exclude");
    expect(search[0].explanation?.join(" ")).toContain("provider verify");
    expect(search[0].explanation?.join(" ")).toContain("provider evidence");
    expect(search[0].evidence?.answerable).toBe(false);

    const report = service.dream("u1");
    expect(report.contradictions[0]?.reason).toBe("provider contradiction");
    expect(report.created.some((memory) => memory.content.includes("provider summary"))).toBe(true);
    expect(service.translateText("Atlas Speicher", "de").translated).toBe("Atlas memory provider translation.");
  }, 30_000);

  it("compacts and caches JSON command evidence payloads without replacing provider judgement", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-provider-cache-"));
    const countPath = join(dir, "count.txt");
    const payloadPath = join(dir, "payloads.jsonl");
    const script = `
      const fs = require("node:fs");
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      fs.appendFileSync(${JSON.stringify(countPath)}, "1\\n");
      fs.appendFileSync(${JSON.stringify(payloadPath)}, JSON.stringify(input) + "\\n");
      console.log(JSON.stringify({
        answerable: true,
        confidence: 0.97,
        reason: "provider semantic evidence decision",
        decisions: input.results.map((result) => ({ id: result.id, decision: "include", confidence: 0.97, reason: "provider include" }))
      }));
    `;
    const provider = new JsonCommandMemoryIntelligence({
      command: process.execPath,
      args: ["-e", script],
      cacheTtlMs: 60_000,
      cacheMaxEntries: 8,
      compactPayloads: true
    });
    const service = new MemoryService();
    const memory = service.add({
      userId: "u1",
      content: `Atlas provider cache note. ${"Semantic details ".repeat(140)}`,
      tags: Array.from({ length: 40 }, (_, index) => `tag-${index}`),
      entities: Array.from({ length: 50 }, (_, index) => `entity-${index}`),
      metadata: { large: "metadata ".repeat(100), nested: { keep: "short" } },
      source: { kind: "human", confidence: 0.95 }
    });
    const result = {
      memory,
      score: 0.91,
      decision: "include" as const,
      explanation: [`provider explanation ${"detail ".repeat(80)}`],
      signals: { semantic: 0.9, keyword: 0.2 }
    };

    const first = provider.judgeEvidence({ query: "Atlas provider cache note", results: [result as any], now: new Date("2026-06-02T12:00:10.000Z") });
    const second = provider.judgeEvidence({ query: "Atlas provider cache note", results: [result as any], now: new Date("2026-06-02T12:00:45.000Z") });

    expect(first).toMatchObject({ answerable: true, confidence: 0.97 });
    expect(second).toMatchObject({ answerable: true, confidence: 0.97 });
    expect(readFileSync(countPath, "utf8").trim().split("\n")).toHaveLength(1);
    const captured = JSON.parse(readFileSync(payloadPath, "utf8").trim());
    expect(captured.results[0].memory.content.length).toBeLessThanOrEqual(1203);
    expect(captured.results[0].memory.tags).toHaveLength(24);
    expect(captured.results[0].memory.entities).toHaveLength(32);
    expect(captured.results[0].explanation[0].length).toBeLessThanOrEqual(183);
  });

  it("fails closed when JSON command evidence output lacks per-memory confidence", () => {
    const script = `
      const fs = require("node:fs");
      const input = JSON.parse(fs.readFileSync(0, "utf8"));
      console.log(JSON.stringify({
        answerable: true,
        confidence: 0.96,
        reason: "provider claims semantic support but omits decision confidence",
        decisions: input.results.map((result) => ({ id: result.id, decision: "include", reason: "provider include without confidence" }))
      }));
    `;
    const provider = new JsonCommandMemoryIntelligence({ command: process.execPath, args: ["-e", script] });
    const service = new MemoryService({ intelligence: { evidenceJudge: provider } });
    service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "exclude", unsafeToInject: true });
    expect(results[0].evidence).toMatchObject({ answerable: false, confidence: 0.99 });
    expect(results[0].explanation?.join(" ")).toContain("provider evidence contract invalid");
  });

  it("marks engineering memories without claim records as review-only and unsafe to inject", () => {
    const service = new MemoryService();
    service.add({
      userId: "u1",
      content: "Atlas release must use npm run release:check.",
      source: { kind: "human", confidence: 0.96 },
      metadata: { engineering: { kind: "repo_policy", confidence: 0.96, codebase: { repo: "atlas" } } }
    });

    const results = service.search({ userId: "u1", query: "What release command should Atlas use?", limit: 1 });

    expect(results[0]).toMatchObject({ decision: "review", unsafeToInject: true });
    expect(results[0].explanation?.join(" ")).toContain("engineering memory lacks claim record");
    const pack = service.evidencePack({ userId: "u1", query: "What release command should Atlas use?", limit: 1 });
    expect(pack.results).toHaveLength(0);
    expect(pack.excludedResults?.[0]).toMatchObject({ decision: "review", unsafeToInject: true });
    expect(service.metricsReport().truthGate?.missingClaim).toBeGreaterThanOrEqual(1);
  });

  it("renders selected truth details in injected context lines", () => {
    const service = new MemoryService();
    const claim: MemoryClaim = {
      id: "claim-atlas-release",
      subject: "atlas",
      predicate: "release_command",
      object: "npm run release:check",
      qualifiers: {},
      source: { kind: "reviewed_code", confidence: 0.98 },
      confidence: 0.98,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1" }
    };
    const memory = service.add({
      userId: "u1",
      content: "Atlas release command is npm run release:check.",
      source: { kind: "reviewed_code", confidence: 0.98 },
      metadata: { claim }
    });

    const selectedClaimId = service.currentTruthForMemory(memory)?.selectedClaimId;
    const context = service.retrieval.contextSelection(service.search({ userId: "u1", query: "Atlas release command", limit: 1 }), 300).context;

    expect(context).toContain(`[${memory.id}]`);
    expect(context).toContain("truth=selected");
    expect(context).toContain(`selected=${memory.id}`);
    expect(context).toContain(`claim=${selectedClaimId}`);
    expect(context).toContain("safe_to_inject=");
  });

  it("uses truth gate decisions before action guard relies on supplemental engineering matches", () => {
    const service = new MemoryService();
    const unsafe = service.add({
      userId: "u1",
      content: "Never run rm -rf dist for Atlas release cleanup.",
      source: { kind: "human", confidence: 0.96 },
      metadata: { engineering: { kind: "forbidden_action", confidence: 0.96, forbiddenAction: "rm -rf dist", codebase: { repo: "atlas" } } }
    });

    const reviewOnly = service.guardAction({ userId: "u1", action: "rm -rf dist", codebaseScope: { repo: "atlas" } });

    expect(reviewOnly.allowed).toBe(false);
    expect(reviewOnly.severity).toBe("block");
    expect(reviewOnly.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ memoryId: unsafe.id })]));
    expect(reviewOnly.blockedBy[0].reason).toContain("review required");

    const claim: MemoryClaim = {
      id: "claim-atlas-forbidden-cleanup",
      subject: "atlas",
      predicate: "forbidden_action",
      object: "rm -rf dist",
      qualifiers: {},
      source: { kind: "human", confidence: 0.97 },
      confidence: 0.97,
      durability: "durable",
      sensitivity: "none",
      scope: { userId: "u1" }
    };
    const safe = service.add({
      userId: "u1",
      content: "Atlas forbidden cleanup action is rm -rf dist.",
      source: { kind: "human", confidence: 0.97 },
      metadata: { claim, engineering: { kind: "forbidden_action", confidence: 0.97, forbiddenAction: "rm -rf dist", codebase: { repo: "atlas" } } }
    });

    const blocked = service.guardAction({ userId: "u1", action: "rm -rf dist", codebaseScope: { repo: "atlas" } });

    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ memoryId: safe.id }), expect.objectContaining({ memoryId: unsafe.id })]));
  });

  it("uses harness evidence judgement to suppress unsupported retrieval without static query rules", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: false,
            confidence: 0.93,
            reason: "harness judge did not find source-grounded support",
            decisions: results.map((result) => ({ id: result.memory.id, decision: "exclude", confidence: 0.93, reason: "insufficient source support" }))
          })
        }
      }
    });
    service.add({ userId: "u1", content: "Atlas dashboard has a deployment note.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What was the exact customer feedback on the dashboard?", limit: 1 });
    expect(results[0].decision).toBe("exclude");
    expect(results[0].unsafeToInject).toBe(true);
    expect(results[0].evidence).toMatchObject({ answerable: false, confidence: 0.93 });
    expect(results[0].explanation?.join(" ")).toContain("insufficient source support");

    const pack = service.evidencePack({ userId: "u1", query: "What was the exact customer feedback on the dashboard?", limit: 1 });
    expect(pack.evidenceVerdict).toMatchObject({ answerable: false, confidence: 0.93, injected: 0 });
    expect(pack.evidenceVerdict?.blockedMemoryIds).toContain(results[0].memory.id);
  });

  it("preserves explicit harness include confidence through retrieval calibration", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: true,
            confidence: 0.96,
            reason: "harness semantically authorized the delivered evidence",
            decisions: results.map((result) => ({ id: result.memory.id, decision: "include", confidence: 0.96, reason: "semantic support" }))
          })
        }
      }
    });
    service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the checkout problem?", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "include", unsafeToInject: false, confidence: 0.96 });
    expect(results[0].explanation?.join(" ")).toContain("provider-evidence");
  });

  it("fails closed when direct harness top-level evidence verdict is malformed", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) =>
            ({
              answerable: "true",
              reason: "harness omitted a strict top-level confidence",
              decisions: results.map((result) => ({ id: result.memory.id, decision: "include", confidence: 0.97, reason: "semantic support" }))
            }) as any
        }
      }
    });
    const memory = service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "exclude", unsafeToInject: true });
    expect(results[0].evidence).toMatchObject({ answerable: false, confidence: 0.99 });
    expect(results[0].explanation?.join(" ")).toContain("top-level answerable must be boolean");
    expect(results[0].explanation?.join(" ")).toContain("top-level confidence must be finite number");

    const pack = service.evidencePack({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(pack.context).not.toContain(memory.id);
    expect(pack.evidenceVerdict).toMatchObject({ answerable: false, confidence: 0.99, injected: 0 });
    expect(pack.evidenceVerdict?.blockedMemoryIds).toContain(memory.id);
  });

  it("requires finite per-memory harness confidence before injection", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: true,
            confidence: 0.96,
            reason: "harness semantically authorized the answer but omitted item confidence",
            decisions: results.map((result) => ({ id: result.memory.id, decision: "include", reason: "semantic support without confidence" }))
          })
        }
      }
    });
    const memory = service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "include", unsafeToInject: true });
    expect(results[0].explanation?.join(" ")).toContain("missing finite per-memory confidence");

    const pack = service.evidencePack({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(pack.context).not.toContain(memory.id);
    expect(pack.evidenceVerdict).toMatchObject({ answerable: true, injected: 0 });
    expect(pack.excludedResults?.find((result) => result.memoryId === memory.id)?.reason).toContain("unsafe-to-inject");
  });

  it("fails closed on invalid direct harness evidence decision contracts", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: true,
            confidence: 0.96,
            reason: "harness returned a malformed decision contract",
            decisions: [
              { id: results[0].memory.id, decision: "approve" as any, confidence: 0.96, reason: "invalid decision value" },
              { id: "unknown-memory", decision: "include", confidence: 0.96, reason: "unknown memory id" }
            ]
          })
        }
      }
    });
    const memory = service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "exclude", unsafeToInject: true });
    expect(results[0].explanation?.join(" ")).toContain("invalid decision");
    expect(results[0].explanation?.join(" ")).toContain("unknown memory id");

    const pack = service.evidencePack({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 1 });
    expect(pack.context).not.toContain(memory.id);
    expect(pack.evidenceVerdict).toMatchObject({ answerable: true, injected: 0 });
  });

  it("requires explicit per-memory harness evidence decisions before injection", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: () => ({
            answerable: true,
            confidence: 0.94,
            reason: "harness found the answer somewhere but did not authorize individual evidence",
            decisions: []
          })
        }
      }
    });
    service.add({ userId: "u1", content: "NovaRetail checkout timeout was fixed with Redis pipeline batching.", source: { kind: "human", confidence: 0.95 } });
    service.add({ userId: "u1", content: "CobaltLane search delays were reduced by Kafka retry backoff.", source: { kind: "human", confidence: 0.95 } });

    const results = service.search({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 2 });
    expect(results.every((result) => result.decision === "exclude")).toBe(true);
    expect(results.every((result) => result.unsafeToInject)).toBe(true);
    expect(results[0].explanation?.join(" ")).toContain("missing explicit per-memory decision");

    const pack = service.evidencePack({ userId: "u1", query: "What fixed the NovaRetail checkout timeout?", limit: 2 });
    expect(pack.evidenceVerdict).toMatchObject({ answerable: true, injected: 0 });
    expect(pack.results).toHaveLength(0);
    expect(pack.excludedResults?.map((result) => result.memoryId)).toEqual(expect.arrayContaining(results.map((result) => result.memory.id)));
  });

  it("keeps harness-reviewed evidence out of injected context until approved", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: true,
            confidence: 0.96,
            reason: "harness requires human review before injection",
            decisions: results.map((result) => ({ id: result.memory.id, decision: "review", confidence: 0.96, reason: "needs operator approval" }))
          })
        }
      }
    });
    const memory = service.add({ userId: "u1", content: "Atlas release uses the reviewed deployment gate.", entities: ["atlas", "release"], source: { kind: "reviewed_code", confidence: 0.99 } });

    const results = service.search({ userId: "u1", query: "Atlas release deployment gate", limit: 1 });
    expect(results[0]).toMatchObject({ decision: "review", unsafeToInject: true });

    const pack = service.evidencePack({ userId: "u1", query: "Atlas release deployment gate", limit: 1, tokenBudget: 500 });
    expect(pack.context).not.toContain(memory.id);
    expect(pack.results).toHaveLength(0);
    expect(pack.evidenceVerdict).toMatchObject({ answerable: true, injected: 0 });
    expect(pack.evidenceVerdict?.reviewMemoryIds).toContain(memory.id);
    expect(pack.excludedResults?.find((result) => result.memoryId === memory.id)?.reason).toContain("unsafe-to-inject");
  });

  it("keeps unsafe harness-reviewed engineering memories out of injected coding context while retaining review evidence", () => {
    const service = new MemoryService({
      intelligence: {
        evidenceJudge: {
          judgeEvidence: ({ results }) => ({
            answerable: true,
            confidence: 0.95,
            reason: "harness review gate",
            decisions: results.map((result) => ({ id: result.memory.id, decision: "review", confidence: 0.95, reason: "operator review required" }))
          })
        }
      }
    });
    const memory = service.add({
      userId: "dev",
      projectId: "atlas",
      content: "Atlas repo policy says use npm test before release.",
      source: { kind: "reviewed_code", confidence: 0.98 },
      tags: ["engineering-memory", "engineering:repo_policy"],
      metadata: { engineering: { kind: "repo_policy", codebase: { repo: "atlas" }, confidence: 0.95 } }
    });

    const pack = service.codingContextPack({ userId: "dev", projectId: "atlas", query: "Atlas release test policy", codebaseScope: { repo: "atlas" }, tokenBudget: 500 });
    expect(pack.context).not.toContain(memory.id);
    const reviewEvidence = pack.sections.flatMap((section) => section.evidence).find((item) => item.memoryId === memory.id);
    expect(reviewEvidence).toMatchObject({
      delivery: "review_required",
      unsafeToInject: true,
      verification: { evidenceJudge: "harness", claimSafe: false }
    });
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
    const report = new ReflectionEngine(store, {
      verificationAfterDays: 10,
      evaluator: {
        evaluateReflection: ({ memories }) => memories.map((memory) => ({
          memoryId: memory.id,
          timeSensitive: { applies: true, confidence: 0.9, reason: "provider detected current deployment wording" }
        }))
      }
    }).run("u1", new Date("2026-02-01T00:00:00.000Z"));
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
    const report = new ReflectionEngine(store, {
      evaluator: {
        evaluateReflection: ({ memories }) => memories.map((memory) => ({
          memoryId: memory.id,
          behavioralEvidence: { applies: true, theme: "mira-friday-food", confidence: 0.88 }
        }))
      }
    }).run("u1", new Date("2026-05-23T00:00:00.000Z"));
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
      previousWrongAction: "pnpm test",
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
    const blockedDecision = hook.beforeToolCallDecision(context, { command: "pnpm test", cwd: "/repo/demo-claude-code" });
    const overrideDecision = hook.beforeToolCallDecision(context, { command: "pnpm test", cwd: "/repo/demo-claude-code" }, { overrideReason: "testing explicit override capture", overrideBy: "operator" });
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
    const handoff = hook.prepareHandoff(context, { content: "Ready for handoff after patch proof.", runDream: false });
    const release = hook.prepareRelease(context, { content: "Release candidate prepared with patch evidence.", runDream: false });

    expect(session.codingContextPack?.sections.some((section) => section.evidence.length > 0)).toBe(true);
    expect(preTool.procedures.some((result) => result.memory.content.includes("Before editing validation"))).toBe(true);
    expect(preTool.guard?.severity).toBe("block");
    expect(preTool.guard?.alternatives).toContain("npm test");
    expect(blockedDecision.decision).toBe("block");
    expect(overrideDecision.decision).toBe("warn");
    expect(overrideDecision.overrideMemory?.tags).toContain("guard-override");
    expect(action?.tags).toEqual(expect.arrayContaining(["harness-action", "success-pattern"]));
    expect(correction?.tags).toEqual(expect.arrayContaining(["engineering-correction", "engineering:review_correction"]));
    expect(trail?.toolOutcomeIds).toContain(action?.id);
    expect(trail?.correctionIds).toContain(correction?.id);
    expect(JSON.stringify(handoff)).toContain("harness:handoff");
    expect(JSON.stringify(release)).toContain("harness:release_candidate");
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

  it("publishes MCP tool annotations for host safety hints", () => {
    const server = new McpServer({ name: "test-cognibrain", version: "0.0.0" });
    registerMemoryMcpTools(server, new MemoryService());
    const tools = (server as unknown as { _registeredTools: Record<string, { annotations: unknown }> })._registeredTools;

    expect(tools.memory_search.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    expect(tools.memory_action_guard.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    expect(tools.memory_add.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false });
    expect(tools.memory_dream.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });
    expect(tools.memory_source_revalidate.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, openWorldHint: true });
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

  it("compacts oversized evidence packs only in persisted local snapshots", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-evidence-compact-"));
    const previousMaxBytes = process.env.MEMORY_EVIDENCE_PACK_PERSIST_MAX_BYTES;
    const previousContentChars = process.env.MEMORY_EVIDENCE_PACK_PERSIST_RESULT_CONTENT_CHARS;
    try {
      process.env.MEMORY_EVIDENCE_PACK_PERSIST_MAX_BYTES = "1200";
      process.env.MEMORY_EVIDENCE_PACK_PERSIST_RESULT_CONTENT_CHARS = "128";
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      const longContent = `Atlas release note ${"semantic evidence ".repeat(500)}`;
      service.add({ userId: "u1", content: longContent, source: { kind: "human", confidence: 0.96 } });
      const pack = service.evidencePack({ userId: "u1", query: "Atlas release note semantic evidence", limit: 3, tokenBudget: 20_000 });
      expect(pack.results[0].content.length).toBeGreaterThan(8_000);
      expect(pack.storage).toBeUndefined();

      const persisted = JSON.parse(readFileSync(path, "utf8"));
      const savedPack = persisted.evidencePacks.find((item: { id: string }) => item.id === pack.id);
	      expect(savedPack.storage).toMatchObject({ compacted: true, maxPersistedBytes: 1200, resultContentMaxChars: 128 });
	      expect(savedPack.storage.originalBytes).toBeGreaterThan(savedPack.storage.persistedBytes);
	      expect(Buffer.byteLength(JSON.stringify(savedPack), "utf8")).toBeLessThanOrEqual(1200);
	      expect(savedPack.results[0].content.length).toBeLessThan(pack.results[0].content.length);
      expect(savedPack.results[0].memoryId).toBe(pack.results[0].memoryId);
      expect(savedPack.hash).toBe(pack.hash);
    } finally {
      if (previousMaxBytes === undefined) delete process.env.MEMORY_EVIDENCE_PACK_PERSIST_MAX_BYTES;
      else process.env.MEMORY_EVIDENCE_PACK_PERSIST_MAX_BYTES = previousMaxBytes;
      if (previousContentChars === undefined) delete process.env.MEMORY_EVIDENCE_PACK_PERSIST_RESULT_CONTENT_CHARS;
      else process.env.MEMORY_EVIDENCE_PACK_PERSIST_RESULT_CONTENT_CHARS = previousContentChars;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bounds transient context pack retention in runtime and local snapshots", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-context-retention-"));
    const previousEvidenceLimit = process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX;
    const previousCodingLimit = process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX;
    try {
      process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX = "3";
      process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX = "2";
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      service.add({
        userId: "u1",
        content: "Atlas release policy requires tests, source review, and patch evidence.",
        type: "project",
        tags: ["repo-policy"],
        source: { kind: "reviewed_code", confidence: 0.96 },
        metadata: { engineering: { kind: "repo_policy" } }
      });

      const evidenceIds = Array.from({ length: 5 }, (_, index) =>
        service.evidencePack({ userId: "u1", query: `Atlas context retention evidence ${index}`, limit: 3 }).id
      );
      expect(() => service.getEvidencePack(evidenceIds[0])).toThrow("Evidence pack not found");
      expect(service.getEvidencePack(evidenceIds.at(-1)!).id).toBe(evidenceIds.at(-1));

      let persisted = JSON.parse(readFileSync(path, "utf8"));
      expect(persisted.evidencePacks).toHaveLength(3);
      expect(persisted.evidencePacks.map((pack: { id: string }) => pack.id)).toContain(evidenceIds.at(-1));
      expect(JSON.stringify(persisted.evidencePacks)).not.toContain(evidenceIds[0]);

      const codingIds = Array.from({ length: 4 }, (_, index) =>
        service.codingContextPack({ userId: "u1", query: `Atlas context retention coding ${index}`, limit: 3 }).id
      );
      expect(() => service.getCodingContextPack(codingIds[0])).toThrow("Coding context pack not found");
      expect(service.getCodingContextPack(codingIds.at(-1)!).id).toBe(codingIds.at(-1));

      persisted = JSON.parse(readFileSync(path, "utf8"));
      expect(persisted.evidencePacks).toHaveLength(3);
    } finally {
      if (previousEvidenceLimit === undefined) delete process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX;
      else process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX = previousEvidenceLimit;
      if (previousCodingLimit === undefined) delete process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX;
      else process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX = previousCodingLimit;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("compacts over-retained transient context packs during startup load", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-startup-context-retention-"));
    const previousEvidenceLimit = process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX;
    const previousCodingLimit = process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX;
    try {
      process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX = "0";
      process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX = "0";
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      service.add({
        userId: "u1",
        content: "Atlas startup retention policy requires loading compact transient context state.",
        type: "project",
        tags: ["repo-policy"],
        source: { kind: "reviewed_code", confidence: 0.96 },
        metadata: { engineering: { kind: "repo_policy" } }
      });
      const evidenceIds = Array.from({ length: 5 }, (_, index) =>
        service.evidencePack({ userId: "u1", query: `Atlas startup context retention evidence ${index}`, limit: 3 }).id
      );
      let persisted = JSON.parse(readFileSync(path, "utf8"));
      expect(persisted.evidencePacks).toHaveLength(5);

      process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX = "3";
      const reloaded = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      expect(() => reloaded.getEvidencePack(evidenceIds[0])).toThrow("Evidence pack not found");
      expect(reloaded.getEvidencePack(evidenceIds.at(-1)!).id).toBe(evidenceIds.at(-1));

      persisted = JSON.parse(readFileSync(path, "utf8"));
      expect(persisted.evidencePacks).toHaveLength(3);
      expect(persisted.evidencePacks.map((pack: { id: string }) => pack.id)).toContain(evidenceIds.at(-1));
      expect(JSON.stringify(persisted.evidencePacks)).not.toContain(evidenceIds[0]);
    } finally {
      if (previousEvidenceLimit === undefined) delete process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX;
      else process.env.MEMORY_EVIDENCE_PACK_RETENTION_MAX = previousEvidenceLimit;
      if (previousCodingLimit === undefined) delete process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX;
      else process.env.MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX = previousCodingLimit;
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
      tags: ["workflow", "release", "test"]
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
    const reviewedRedis = service.add({
      userId: "u1",
      projectId: "p1",
      content: "Atlas should use Redis for shared cache.",
      entities: ["atlas", "redis"],
      metadata: { claim: { subject: "atlas", predicate: "shared-cache", object: "redis", confidence: 0.98 } },
      source: { kind: "reviewed_code", confidence: 0.98 }
    });
    const transcriptRedis = service.add({
      userId: "u1",
      projectId: "p1",
      content: "Atlas should not use Redis for shared cache.",
      entities: ["atlas", "redis"],
      metadata: { claim: { subject: "atlas", predicate: "shared-cache", object: "not-redis", confidence: 0.35 } },
      relations: [{ type: "contradicts", targetId: reviewedRedis.id, confidence: 0.9 }],
      source: { kind: "transcript", confidence: 0.35 }
    });
    service.update(reviewedRedis.id, {
      relations: [{ type: "contradicts", targetId: transcriptRedis.id, confidence: 0.9 }]
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

    const oldDb = service.add({
      userId: "u1",
      projectId: "p1",
      content: "Acme Billing used MySQL for ledger storage during the February pilot.",
      entities: ["acme", "billing", "ledger", "database"],
      temporal: { eventAt: "2026-02-01T00:00:00.000Z" },
      source: { kind: "human", confidence: 0.96 }
    });
    const currentDb = service.add({
      userId: "u1",
      projectId: "p1",
      content: "Acme Billing migrated ledger storage to Postgres and Postgres is the current source of truth.",
      entities: ["acme", "billing", "ledger", "database"],
      temporal: { eventAt: "2026-05-18T00:00:00.000Z" },
      source: { kind: "human", confidence: 0.96 }
    });
    const providerTemporal = service.search({
      userId: "u1",
      projectId: "p1",
      query: "What is Acme Billing's current ledger database?",
      limit: 4,
      contradictionDetector: {
        classify: ({ a, b }) => (
          [a.id, b.id].includes(oldDb.id) && [a.id, b.id].includes(currentDb.id)
            ? { label: "contradiction", confidence: 0.94, reason: "provider judged newer fact supersedes old database fact" }
            : { label: "neutral", confidence: 0.88, reason: "provider judged unrelated pair" }
        )
      }
    });
    expect(providerTemporal.find((result) => result.memory.id === oldDb.id)?.decision).toBe("exclude");
    expect(providerTemporal.find((result) => result.memory.id === oldDb.id)?.unsafeToInject).toBe(true);
    expect(providerTemporal.find((result) => result.memory.id === currentDb.id)?.decision).not.toBe("exclude");

    let defaultContradictionCalls = 0;
    const defaultContradictionService = new MemoryService({
      intelligence: {
        contradictionDetector: {
          classify: () => {
            defaultContradictionCalls += 1;
            return { label: "contradiction", confidence: 0.95, reason: "default retrieval provider should be opt-in" };
          }
        }
      }
    });
    defaultContradictionService.add({ userId: "u1", content: "Atlas layout uses moonlit spacing tokens.", entities: ["atlas", "layout"], source: { kind: "human", confidence: 0.96 } });
    defaultContradictionService.add({ userId: "u1", content: "Atlas layout uses canyon spacing tokens.", entities: ["atlas", "layout"], source: { kind: "human", confidence: 0.96 } });
    defaultContradictionService.search({ userId: "u1", query: "Atlas layout spacing tokens", limit: 2 });
    expect(defaultContradictionCalls).toBe(0);

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
    const service = new MemoryService({
      intelligence: {
        evaluator: {
          evaluateReflection: ({ memories }) => memories.map((memory) => ({
            memoryId: memory.id,
            behavioralEvidence: { applies: true, theme: "mira-friday-food", confidence: 0.88 }
          }))
        }
      }
    });
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
    const service = new MemoryService({
      intelligence: {
        extractor: {
          extract: ({ events, scope }) => events.map((event) => ({
            ...scope,
            content: event.content,
            entities: ["atlas"],
            source: { kind: "human", confidence: 0.92 },
            metadata: { supersedes: true }
          }))
        }
      }
    });
    service.add({ userId: "u1", content: "Atlas uses SQLite for cache.", entities: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    const first = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    const second = service.extract([{ role: "user", content: "Atlas now uses Redis for cache." }], { userId: "u1" });
    expect(first.memories).toHaveLength(1);
    expect(second.memories).toHaveLength(0);
    expect(first.memories[0].relations.some((relation) => relation.type === "supersedes")).toBe(true);
  });

  it("models belief revision as a supersession journey with historical validity", () => {
    const service = new MemoryService({
      intelligence: {
        extractor: {
          extract: ({ events, scope }) => events.map((event) => ({
            ...scope,
            content: event.content,
            entities: ["mira"],
            source: { kind: "human", confidence: 0.92 },
            timestamp: event.timestamp,
            metadata: { supersedes: true }
          }))
        }
      }
    });
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

  it("checks due auto dreams from maintenance state without scanning all memories", () => {
    const service = new MemoryService({ autoDream: { enabled: true, writeThreshold: 100, intervalHours: 6 } });
    service.add({ userId: "u1", content: "Auto dream resource checks should avoid full memory scans.", source: { kind: "human", confidence: 0.96 } });
    const store = (service as any).store as MemoryStore;
    const originalList = store.list.bind(store);
    let listCalls = 0;
    store.list = ((userId?: string) => {
      listCalls += 1;
      return originalList(userId);
    }) as typeof store.list;

    expect(service.runDueDreams(new Date("2026-06-04T00:00:00.000Z"))).toEqual([]);
    expect(listCalls).toBe(0);
  });

  it("plans not-due harness session-end dreams without scanning the memory store", () => {
    const service = new MemoryService({ autoDream: { enabled: true, writeThreshold: 12, intervalHours: 6 } });
    const store = (service as any).store as MemoryStore;
    const originalList = store.list.bind(store);
    let listCalls = 0;
    store.list = ((userId?: string) => {
      listCalls += 1;
      return originalList(userId);
    }) as typeof store.list;

    const plan = service.dreamPlan({
      userId: "idle-user",
      trigger: "harness_session_end",
      mode: "dream",
      harnessRunId: "run-idle"
    });

    expect(listCalls).toBe(0);
    expect(plan.shouldDream).toBe(false);
    expect(plan.reasons).toEqual(["dream not due"]);
    expect(plan.signals.memoryScanSkipped).toBe(true);
    expect(plan.signals.memoryScanReason).toContain("maintenance counters");
    expect(plan.signals.writesSinceDream).toBe(0);
  });

  it("runs autoDream through the full dream cycle and schedules verification", () => {
    const service = new MemoryService({ autoDream: { enabled: true, writeThreshold: 2, intervalHours: 6 } });
    const risky = service.add({
      userId: "u1",
      content: "The current memory backend needs operator verification.",
      beliefState: "needs_verification",
      source: { kind: "human", confidence: 0.96 }
    });
    expect(service.get(risky.id).temporal.verificationDueAt).toBeUndefined();

    service.add({
      userId: "u1",
      content: "Dream cycles should keep verification state fresh.",
      source: { kind: "human", confidence: 0.96 }
    });

    const refreshed = service.get(risky.id);
    const status = service.maintenanceStatus().users.u1;
    expect(refreshed.temporal.verificationDueAt).toBeDefined();
    expect(refreshed.metadata.verification).toMatchObject({ status: "queued", reason: "dream belief revision" });
    expect(status.writesSinceDream).toBe(0);
    expect(status.lastDreamAt).toBeDefined();
  });

  it("plans dream cycles with harness and source-aware recommendations", () => {
    const service = new MemoryService({ autoDream: { enabled: false, writeThreshold: 12, intervalHours: 6 } });
    service.add({
      userId: "u1",
      content: "GitHub PR review requested changes for the release branch.",
      source: { kind: "tool", confidence: 0.9 },
      sourceRef: {
        connectorId: "official-github",
        externalId: "pr-42",
        timestamp: "2026-05-01T00:00:00.000Z",
        version: "1"
      }
    });

    const plan = service.dreamPlan({
      userId: "u1",
      trigger: "harness_handoff",
      mode: "dream",
      sourceRefresh: true,
      harnessRunId: "run-1"
    });

    expect(plan.shouldDream).toBe(true);
    expect(plan.trigger).toBe("harness_handoff");
    expect(plan.sourceRefresh).toBe(true);
    expect(plan.connectorIds).toContain("official-github");
    expect(plan.recommendedActions).toContain("poll connectors: official-github");
    expect(plan.recommendedActions).toContain("revalidate 1 sourceRefs");
    expect(plan.reasons).toContain("handoff needs a prepared memory state");
  });

  it("revalidates sourceRefs and supersedes stale connector-backed memories", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "test-github",
      name: "Test GitHub",
      kind: "code",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    const firstRecord = service.syncConnectorEvents("test-github", [{
      role: "tool",
      content: "PR 42 CI status is pending.",
      externalId: "pr-42",
      timestamp: "2026-05-01T00:00:00.000Z",
      metadata: { version: "1" }
    }], { userId: "u1" });
    const firstMemoryId = firstRecord.memoryIds[0];

    service.syncConnectorEvents("test-github", [{
      role: "tool",
      content: "PR 42 CI status is passed.",
      externalId: "pr-42",
      timestamp: "2026-05-02T00:00:00.000Z",
      metadata: { version: "2" }
    }], { userId: "u1" });

    const report = service.revalidateSourceRefs("u1", { connectorIds: ["test-github"] });
    const superseded = report.results.find((result) => result.memoryId === firstMemoryId);
    expect(superseded).toMatchObject({ status: "superseded", connectorId: "test-github", externalId: "pr-42", previousVersion: "1", currentVersion: "2" });
    expect(service.get(firstMemoryId).beliefState).toBe("superseded");
  });

  it("uses registered source resolvers before fallback sourceRef heuristics", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerSourceResolver({
      connectorId: "confluence",
      get: (sourceRef) => ({
        sourceRef: { ...sourceRef, version: "2", hash: "new-hash" },
        version: "2",
        hash: "new-hash",
        updatedAt: "2026-05-03T00:00:00.000Z"
      })
    });
    const memory = service.add({
      userId: "u1",
      content: "Confluence ADR-12 says cache backend is Postgres.",
      source: { kind: "import", confidence: 0.86 },
      sourceRef: { connectorId: "confluence", externalId: "ADR-12", version: "1", hash: "old-hash" }
    });

    const updated = service.revalidateMemory(memory.id, "u1");
    expect(updated).toMatchObject({ status: "source_updated", connectorId: "confluence", externalId: "ADR-12", previousVersion: "1", currentVersion: "2" });
    expect(service.get(memory.id).beliefState).toBe("needs_verification");

    service.registerSourceResolver({
      connectorId: "confluence",
      get: (sourceRef) => ({ sourceRef, status: "missing" })
    });
    const missing = service.revalidateMemory(memory.id, "u1");
    expect(missing.status).toBe("source_missing");
  });

  it("uses live async source resolver fetch for sourceRef revalidation", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerSourceResolver({
      connectorId: "github",
      get: (sourceRef) => ({
        sourceRef,
        version: sourceRef.version,
        hash: sourceRef.hash,
        updatedAt: "2026-05-01T00:00:00.000Z"
      }),
      fetch: async (sourceRef) => ({
        sourceRef: { ...sourceRef, version: "2", hash: "live-hash" },
        version: "2",
        hash: "live-hash",
        updatedAt: "2026-05-04T00:00:00.000Z",
        metadata: { fetchedLive: true }
      })
    });
    const memory = service.add({
      userId: "u1",
      content: "GitHub PR 42 says release gate requires npm test.",
      source: { kind: "import", confidence: 0.9 },
      sourceRef: { connectorId: "github", externalId: "PR-42", version: "1", hash: "old-hash" }
    });

    const updated = await service.revalidateMemoryAsync(memory.id, "u1");
    expect(updated).toMatchObject({ status: "source_updated", connectorId: "github", externalId: "PR-42", previousVersion: "1", currentVersion: "2" });
    expect((service.get(memory.id).metadata.sourceRevalidation as { sourceRecord?: { hash?: string } }).sourceRecord?.hash).toBe("live-hash");
  });

  it("default GitHub source resolver fetches current provider state when credentials are configured", async () => {
    const previousFetch = globalThis.fetch;
    const previousRepo = process.env.MEMORY_GITHUB_REPO;
    const previousToken = process.env.MEMORY_GITHUB_TOKEN;
    const requested: string[] = [];
    try {
      process.env.MEMORY_GITHUB_REPO = "cognilabz/cognibrain";
      process.env.MEMORY_GITHUB_TOKEN = "test-token";
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        requested.push(String(input));
        return new Response(JSON.stringify([{
          number: 42,
          title: "Release gate now requires npm test",
          state: "open",
          html_url: "https://github.com/cognilabz/cognibrain/pull/42",
          user: { login: "reviewer" },
          updated_at: "2026-05-05T00:00:00.000Z"
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }) as typeof fetch;
      const service = new MemoryService({ autoDream: { enabled: false } });
      const memory = service.add({
        userId: "u1",
        content: "GitHub PR 42 previously required pnpm test.",
        source: { kind: "import", confidence: 0.82 },
        sourceRef: {
          connectorId: "official-github",
          externalId: "pr-42",
          url: "https://github.com/cognilabz/cognibrain/pull/42",
          version: "2026-05-01T00:00:00.000Z",
          hash: "old-hash"
        }
      });

      const updated = await service.revalidateMemoryAsync(memory.id, "u1");
      expect(updated).toMatchObject({ status: "source_updated", connectorId: "official-github", externalId: "pr-42" });
      expect(requested.some((url) => url.includes("/repos/cognilabz/cognibrain/pulls"))).toBe(true);
      expect((service.get(memory.id).metadata.sourceRevalidation as { sourceRecord?: { updatedAt?: string } }).sourceRecord?.updatedAt).toBe("2026-05-05T00:00:00.000Z");
    } finally {
      globalThis.fetch = previousFetch;
      if (previousRepo === undefined) delete process.env.MEMORY_GITHUB_REPO;
      else process.env.MEMORY_GITHUB_REPO = previousRepo;
      if (previousToken === undefined) delete process.env.MEMORY_GITHUB_TOKEN;
      else process.env.MEMORY_GITHUB_TOKEN = previousToken;
    }
  });

  it("resolves verification queue items and records harness lifecycle dream plans", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "test-jira",
      name: "Test Jira",
      kind: "project_management",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    const record = service.syncConnectorEvents("test-jira", [{
      role: "tool",
      content: "Jira CB-7 is ready for release.",
      externalId: "CB-7",
      timestamp: "2026-05-01T00:00:00.000Z",
      metadata: { version: "3" }
    }], { userId: "u1" });
    const memoryId = record.memoryIds[0];
    service.update(memoryId, { beliefState: "needs_verification" });

    const resolved = service.resolveVerificationQueue("u1");
    expect(resolved.results.find((result) => result.memoryId === memoryId)?.status).toBe("confirmed");
    expect(service.get(memoryId).beliefState).toBe("active");
    expect(service.get(memoryId).temporal.verificationDueAt).toBeUndefined();

    const event = service.recordHarnessLifecycleEvent({
      userId: "u1",
      event: "tests_failed",
      command: "npm test",
      tests: [{ name: "vitest", status: "failed" }],
      failureReason: "unit regression",
      runDream: false
    });
    expect(event.eventMemory.tags).toContain("harness:tests_failed");
    expect(event.actionMemory?.tags).toContain("test-failure");
    expect(event.dream.plan.trigger).toBe("after_negative_feedback");
    expect(event.dream.plan.shouldDream).toBe(true);

    const job = await service.startDreamJob({ userId: "u1", trigger: "harness_handoff", mode: "dream", sourceRefresh: true }, fetch, 10_000, { wait: true });
    expect(job.status).toBe("done");
    expect(job.progress.memoriesEvaluated).toBeGreaterThan(0);
    expect(service.dreamJobStatus(job.jobId)[0].jobId).toBe(job.jobId);
  });

  it("persists dream job queue state across service restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-dream-jobs-"));
    try {
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      service.add({ userId: "u1", content: "Release dream jobs must remain inspectable after restart.", source: { kind: "human", confidence: 0.96 } });
      const job = await service.startDreamJob({ userId: "u1", trigger: "before_release", mode: "dream", budget: "release" }, fetch, 10_000, { wait: true });

      const reloaded = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      const restored = reloaded.dreamJobStatus(job.jobId)[0];
      expect(restored.jobId).toBe(job.jobId);
      expect(restored.status).toBe("done");
      expect(restored.priority).toBe(100);
      expect(restored.attemptCount).toBe(1);
      expect(restored.leaseOwner).toMatch(/^pid-/);
      expect(restored.leaseUntil).toBeUndefined();
      expect(restored.progress.memoriesEvaluated).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("resumes queued dream jobs through a worker after service restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "memory-dream-worker-"));
    try {
      const path = join(dir, "memory.json");
      const service = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      service.add({ userId: "u1", content: "Queued dream workers must resume release jobs after restart.", source: { kind: "human", confidence: 0.96 } });
      const queued = await service.startDreamJob({ userId: "u1", trigger: "before_release", mode: "dream", budget: "release" }, fetch, 10_000, { queueOnly: true });
      expect(queued).toMatchObject({ status: "queued", priority: 100, attemptCount: 0 });

      const reloaded = new MemoryService({ persistence: new JsonFilePersistenceAdapter(path), autoDream: { enabled: false } });
      expect(reloaded.dreamJobStatus(queued.jobId)[0]).toMatchObject({ status: "queued", attemptCount: 0 });

      const completed = await reloaded.runDreamJobWorkerOnce(fetch, 10_000);
      expect(completed).toMatchObject({ jobId: queued.jobId, status: "done", attemptCount: 1 });
      expect(completed?.progress.memoriesEvaluated).toBeGreaterThan(0);
      await expect(reloaded.runDreamJobWorkerOnce(fetch, 10_000)).resolves.toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("cancels and retries dream jobs through the persisted job surface", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.add({ userId: "u1", content: "Release dream cancellation must keep an operator-visible job state.", source: { kind: "human", confidence: 0.96 } });
    service.registerConnectorManifest({
      id: "slow-jira",
      name: "Slow Jira",
      kind: "project_management",
      version: "1.0.0",
      auth: "none",
      direction: "ingest",
      capabilities: ["poll"],
      defaultSourceKind: "tool",
      metadataMapping: {},
      poll: { endpoint: "https://example.invalid/poll" }
    });
    const slowFetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify({ events: [] }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const job = await service.startDreamJob({ userId: "u1", trigger: "before_release", mode: "dream", budget: "release", sourceRefresh: true, connectorIds: ["slow-jira"] }, slowFetch as typeof fetch);
    expect(job.status).toBe("running");
    expect(job.leaseOwner).toMatch(/^pid-/);
    expect(job.leaseUntil).toBeTruthy();
    expect(job.attemptCount).toBe(1);
    const cancelled = service.cancelDreamJob(job.jobId, "operator paused release gate");
    expect(cancelled.status).toBe("cancelled");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(service.dreamJobStatus(job.jobId)[0].status).toBe("cancelled");

    const retry = await service.retryDreamJob(job.jobId, slowFetch as typeof fetch, 10_000, { wait: true });
    expect(retry.retryOf).toBe(job.jobId);
    expect(retry.status).toBe("done");
    expect(retry.attemptCount).toBe(1);
  });

  it("tracks connector sync state cursor metadata from poll records", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "cursor-jira",
      name: "Cursor Jira",
      kind: "project_management",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest", "poll"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      poll: { endpoint: "https://example.invalid/poll", method: "GET" },
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    const fetchImpl = async () => new Response(JSON.stringify({
      nextCursor: "cursor-2",
      lastExternalUpdatedAt: "2026-05-03T00:00:00.000Z",
      etag: "etag-2",
      sourceVersion: "v2",
      events: [{
        role: "tool",
        content: "Jira CB-8 is done.",
        externalId: "CB-8",
        timestamp: "2026-05-03T00:00:00.000Z",
        metadata: { version: "2" }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });

    const record = await service.pollConnector("cursor-jira", { userId: "u1" }, fetchImpl as typeof fetch);
    const state = service.connectorSyncState("cursor-jira")[0];
    expect(record.status).toBe("applied");
    expect(state).toMatchObject({
      connectorId: "cursor-jira",
      cursor: "cursor-2",
      lastExternalUpdatedAt: "2026-05-03T00:00:00.000Z",
      etag: "etag-2",
      sourceVersion: "v2",
      lastStatus: "applied"
    });
  });

  it("marks deleted connector sourceRefs as review-required and keeps stale content out of context", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "deleted-runbook",
      name: "Deleted Runbook",
      kind: "docs",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest", "poll"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      poll: { endpoint: "https://example.invalid/poll", method: "GET" },
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    const initial = service.syncConnectorEvents("deleted-runbook", [{
      role: "tool",
      content: "Runbook RUN-4 says restart payments worker with legacy-restart.sh.",
      externalId: "RUN-4",
      timestamp: "2026-05-01T00:00:00.000Z",
      metadata: { version: "1" }
    }], { userId: "u1", projectId: "payments" });
    const fetchImpl = async () => new Response(JSON.stringify({
      nextCursor: "cursor-delete",
      sourceVersion: "deleted",
      deletedExternalIds: ["RUN-4"],
      events: []
    }), { status: 200, headers: { "content-type": "application/json" } });

    const record = await service.pollConnector("deleted-runbook", { userId: "u1", projectId: "payments" }, fetchImpl as typeof fetch);
    const memory = service.get(initial.memoryIds[0]);
    const pack = service.evidencePack({ userId: "u1", projectId: "payments", query: "payments worker restart runbook", tokenBudget: 500 });

    expect(record.externalIds).toContain("RUN-4");
    expect(record.memoryIds).toContain(memory.id);
    expect(record.payload?.deletedExternalIds).toEqual(["RUN-4"]);
    expect(memory.beliefState).toBe("needs_verification");
    expect(memory.content).toContain("operator review is required");
    expect(memory.content).not.toContain("legacy-restart.sh");
    expect(memory.metadata.previousContent).toContain("legacy-restart.sh");
    expect(pack.context).not.toContain("legacy-restart.sh");
  });

  it("preserves upstream connector claims for semantic conflict review", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "claim-docs",
      name: "Claim Docs",
      kind: "docs",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    service.syncConnectorEvents("claim-docs", [{
      role: "tool",
      content: "Confluence ADR-31 says payment gateway is Stripe.",
      externalId: "adr-31",
      timestamp: "2026-05-01T00:00:00.000Z",
      metadata: { claim: { subject: "payment gateway", predicate: "decision", object: "Stripe", confidence: 0.82 } }
    }, {
      role: "tool",
      content: "Notion launch spec says payment gateway is Adyen.",
      externalId: "launch-spec",
      timestamp: "2026-05-02T00:00:00.000Z",
      metadata: { claim: { subject: "payment gateway", predicate: "decision", object: "Adyen", confidence: 0.82 } }
    }], { userId: "u1", projectId: "payments" });

    const report = service.runDreamCycle({ userId: "u1", mode: "dream", trigger: "before_release", budget: "release", force: true });
    const memories = service.listMemories("u1", { includeArchived: true });

    expect(memories.map((memory) => memory.metadata.claim)).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: "payment gateway", predicate: "decision", object: "Stripe" }),
      expect.objectContaining({ subject: "payment gateway", predicate: "decision", object: "Adyen" })
    ]));
    expect(report.contradictions).toHaveLength(0);
    const connectorMemories = memories.filter((memory) => memory.metadata.externalId);
    expect(connectorMemories.every((memory) => (memory.metadata.conflictReview as { status?: string } | undefined)?.status === "needs_operator_review")).toBe(true);
    expect(memories.some((memory) => (memory.metadata.conflictReviewSummary as { claimKey?: string } | undefined)?.claimKey === "payment gateway:decision")).toBe(true);
    const pack = service.evidencePack({ userId: "u1", projectId: "payments", query: "payment gateway decision", tokenBudget: 500 });
    expect(pack.context).toContain("operator review");
    expect(pack.context).not.toContain("Stripe");
    expect(pack.context).not.toContain("Adyen");
  });

  it("exposes connector review queue decisions as first-class memory operations", () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "review-slack",
      name: "Review Slack",
      kind: "chat",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest"],
      auth: "none",
      defaultSourceKind: "transcript",
      metadataMapping: {}
    });
    const record = service.syncConnectorEvents("review-slack", [{
      role: "user",
      content: "Slack decision: Atlas must use Postgres for launch notes.",
      externalId: "msg-1",
      timestamp: "2026-05-01T00:00:00.000Z",
      metadata: { reviewRequired: true }
    }], { userId: "u1", projectId: "atlas" });
    const pending = service.listConnectorReviewQueue({ connectorId: "review-slack" });

    expect(pending.map((memory) => memory.id)).toContain(record.memoryIds[0]);
    const approved = service.reviewConnectorMemory(record.memoryIds[0], { decision: "approve", reviewerId: "operator", reason: "matches ADR" });
    expect(approved.metadata.reviewQueue).toMatchObject({ status: "approved", reviewerId: "operator" });
    expect(approved.beliefState).toBe("active");
    expect(service.listConnectorReviewQueue({ connectorId: "review-slack" })).toHaveLength(0);

    const second = service.syncConnectorEvents("review-slack", [{
      role: "user",
      content: "Slack decision: Atlas must use SQLite for launch notes.",
      externalId: "msg-2",
      timestamp: "2026-05-02T00:00:00.000Z",
      metadata: { reviewRequired: true }
    }], { userId: "u1", projectId: "atlas" });
    const rejected = service.reviewConnectorMemory(second.memoryIds[0], { decision: "reject", reviewerId: "operator", reason: "superseded by ADR" });
    expect(rejected.beliefState).toBe("retracted");
    expect(rejected.trust).toBe(0);
  });

  it("persists connector cursor state independently from sync history replay", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cursor-"));
    try {
      const path = join(dir, "memory.json");
      const service = new MemoryService({
        persistence: new JsonFilePersistenceAdapter(path),
        autoDream: { enabled: false }
      });
      service.registerConnectorManifest({
        id: "persisted-jira",
        name: "Persisted Jira",
        kind: "project_management",
        version: "1.0.0",
        direction: "ingest",
        capabilities: ["ingest", "poll"],
        auth: "none",
        defaultSourceKind: "tool",
        metadataMapping: {},
        poll: { endpoint: "https://example.invalid/poll", method: "GET" },
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z"
      });
      const fetchImpl = async () => new Response(JSON.stringify({
        nextCursor: "cursor-persisted",
        sourceVersion: "jira-v7",
        events: [{ role: "tool", content: "Jira CB-9 is released.", externalId: "CB-9", timestamp: "2026-05-04T00:00:00.000Z" }]
      }), { status: 200, headers: { "content-type": "application/json" } });
      await service.pollConnector("persisted-jira", { userId: "u1" }, fetchImpl as typeof fetch);

      const reloaded = new MemoryService({
        persistence: new JsonFilePersistenceAdapter(path),
        autoDream: { enabled: false }
      });
      expect(reloaded.connectorSyncState("persisted-jira")[0]).toMatchObject({
        connectorId: "persisted-jira",
        cursor: "cursor-persisted",
        sourceVersion: "jira-v7",
        lastStatus: "applied"
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs source-refresh dream jobs by polling connectors before revalidation", async () => {
    const service = new MemoryService({ autoDream: { enabled: false } });
    service.registerConnectorManifest({
      id: "job-github",
      name: "Job GitHub",
      kind: "code",
      version: "1.0.0",
      direction: "ingest",
      capabilities: ["ingest", "poll"],
      auth: "none",
      defaultSourceKind: "tool",
      metadataMapping: {},
      poll: { endpoint: "https://example.invalid/github/poll", method: "GET" },
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    });
    const fetchImpl = async () => new Response(JSON.stringify({
      nextCursor: "gh-cursor-3",
      sourceVersion: "run-3",
      events: [{
        role: "tool",
        content: "GitHub PR 42 CI status is passed.",
        externalId: "pr-42",
        timestamp: "2026-05-05T00:00:00.000Z",
        metadata: { version: "3" }
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
    const job = await service.startDreamJob({
      userId: "u1",
      trigger: "before_release",
      mode: "dream",
      budget: "release",
      sourceRefresh: true,
      connectorIds: ["job-github"],
      force: true
    }, fetchImpl as typeof fetch, 10_000, { wait: true });

    expect(job.status).toBe("done");
    expect(job.progress.connectorPolls).toBe(1);
    expect(job.report?.dreamCycle.connectorRefresh).toMatchObject({ attempted: 1, applied: 1, failed: 0 });
    expect(service.connectorSyncState("job-github")[0]).toMatchObject({ cursor: "gh-cursor-3", sourceVersion: "run-3" });
    expect(service.search({ userId: "u1", query: "PR 42 CI status" })[0].memory.content).toContain("passed");
  });

  it("uses source quality hierarchy when resolving contradictory claims", () => {
    const store = new MemoryStore();
    const agentGuess = store.add({
      userId: "u1",
      content: "target repo is /workspace/old-platform",
      source: { kind: "agent", confidence: 0.98 },
      tags: ["agent-inference"],
      metadata: { claim: { subject: "workspace", predicate: "target-repository", object: "/workspace/old-platform", confidence: 0.98 } },
      timestamp: "2026-05-01T00:00:00.000Z"
    });
    const userCorrection = store.add({
      userId: "u1",
      content: "target repo is /workspace/new-platform",
      source: { kind: "human", confidence: 0.72 },
      tags: ["correction"],
      metadata: { claim: { subject: "workspace", predicate: "target-repository", object: "/workspace/new-platform", confidence: 0.72 } },
      timestamp: "2026-04-01T00:00:00.000Z"
    });

    const report = new ReflectionEngine(store).run("u1");
    expect(report.contradictions[0].kept.id).toBe(userCorrection.id);
    expect(store.get(agentGuess.id).beliefState).toBe("contradicted");
    expect(store.get(userCorrection.id).beliefState).toBe("active");
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
      expect(reloaded.storageStatus().adapters.some((adapter) => adapter.kind === "cassandra-compatible" && !adapter.distributedReady && adapter.notes.some((note) => note.includes("snapshot/event-journal")))).toBe(true);
      const raw = JSON.parse(readFileSync(cassandraPath, "utf8"));
      expect(raw.dialect).toBe("cassandra-compatible");
      expect(raw.tables.persistence_events.length).toBeGreaterThanOrEqual(1);
      expect(raw.tables.snapshots.at(-1).partition).toContain("team-brain");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the Postgres repository driver-backed with service-state tables and optional RLS", () => {
    const source = readFileSync("src/api/repositories/postgresRepository.ts", "utf8");
    const serviceSource = readdirSync("src/api/service")
      .filter((file) => file.startsWith("memoryService") && file.endsWith(".ts"))
      .map((file) => readFileSync(`src/api/service/${file}`, "utf8"))
      .join("\n");
    expect(source).toContain('require("pg")');
    expect(source).not.toContain('"psql"');
    expect(source).toContain("cognibrain_repository_state");
    expect(source).toContain("cognibrain_claims");
    expect(source).toContain("cognibrain_current_truth");
    expect(source).toContain("claimRepository");
    expect(source).toContain("truthRepository");
    expect(source).toContain("async registerClaim");
    expect(source).toContain("async currentForClaim");
    expect(source).toContain("cognibrain_conflict_sets");
    expect(source).toContain("cognibrain_dream_jobs");
    expect(source).toContain("cognibrain_connector_sync_states");
    expect(source).toContain("enable row level security");
    expect(serviceSource).toContain('backend === "postgres-production"');
    expect(serviceSource).toContain('backend === "postgres-async"');
    expect(serviceSource).toContain('await import("../repositories/postgresRepository")');
    expect(serviceSource).toContain('backend === "postgres-repository"');
    expect(readFileSync("src/api/service/memoryServiceDeps.ts", "utf8")).not.toContain("PostgresMemoryRepository");
    const buildSource = readFileSync("scripts/runtime/build-api.mjs", "utf8");
    expect(buildSource).toContain('external: ["pg"]');
    expect(buildSource).toContain("splitting: true");
    expect(buildSource).toContain('chunkNames: "chunks/[name]-[hash]"');
  });

  it("hydrates production Postgres startup from repository rows before legacy service_state", async () => {
    const store = new MemoryStore();
    const memory = store.add({
      userId: "u1",
      content: "Production Postgres startup rebuilds from cognibrain_memories rows.",
      source: { kind: "human", confidence: 0.96 }
    });
    let legacyStateRead = false;
    const rowBacked = await createProductionPersistedFileFromRepository({
      list: async () => [memory],
      loadStateAsync: async () => {
        legacyStateRead = true;
        return { version: 2, memories: [] };
      }
    });

    expect(rowBacked?.memories?.map((item) => item.id)).toEqual([memory.id]);
    expect(legacyStateRead).toBe(false);

    const legacy = await createProductionPersistedFileFromRepository({
      list: async () => [],
      loadStateAsync: async () => ({ version: 2, memories: [memory] })
    }, { allowServiceStateFallback: true });
    expect(legacy?.memories?.[0]?.id).toBe(memory.id);
  });

  it("does not read legacy service_state for strict DB-primary production startup", async () => {
    let legacyStateRead = false;
    const loaded = await createProductionPersistedFileFromRepository({
      list: async () => [],
      loadStateAsync: async () => {
        legacyStateRead = true;
        return { version: 2, memories: [{ id: "legacy-memory" }] };
      }
    }, { allowServiceStateFallback: false });

    expect(loaded).toBeUndefined();
    expect(legacyStateRead).toBe(false);
    const serviceSource = readFileSync("src/api/service/memoryService.ts", "utf8");
    expect(serviceSource).toContain("isStrictDbPrimaryBackend");
    expect(serviceSource).toContain("allowServiceStateFallback: !isStrictDbPrimaryBackend(backend)");
  });

  it("flushes production Postgres persistence through rows and projection tables without service_state", async () => {
    const service = new MemoryService();
    const imported: unknown[] = [];
    const projections: unknown[] = [];
    let legacySnapshotWrites = 0;
    Object.defineProperty(service, "productionAsyncRepository", {
      value: {
        import: async (memories: unknown[]) => {
          imported.push(...memories);
        },
        saveProjectionRowsAsync: async (payload: unknown) => {
          projections.push(payload);
        },
        saveStateAsync: async () => {
          legacySnapshotWrites += 1;
        }
      }
    });

    const memory = service.add({
      userId: "u1",
      content: "Production Postgres writes memory rows and projection tables, not service_state.",
      source: { kind: "human", confidence: 0.96 }
    });
    await (service as unknown as { productionAsyncFlush?: Promise<void> }).productionAsyncFlush;

    expect(imported).toEqual(expect.arrayContaining([expect.objectContaining({ id: memory.id })]));
    expect(projections).toEqual([expect.objectContaining({ memories: expect.arrayContaining([expect.objectContaining({ id: memory.id })]) })]);
    expect(legacySnapshotWrites).toBe(0);
  });

  it("keeps production Postgres dream jobs on a leased DB-backed queue", () => {
    const repositorySource = readFileSync(join(process.cwd(), "src/api/repositories/postgresRepository.ts"), "utf8");
    expect(repositorySource).toContain("implements RepositoryStatePersistence, MemoryEventJournal, AsyncDreamJobRepository");
    expect(repositorySource).toContain("async claimDueJob");
    expect(repositorySource).toContain("for update skip locked");
    expect(repositorySource).toContain("lease_until is null or lease_until <= $1");
    expect(repositorySource).toContain("dream.job_completed");
  });

  it("exposes production Postgres domain repositories for row-backed projections", () => {
    const repositorySource = readFileSync(join(process.cwd(), "src/api/repositories/postgresRepository.ts"), "utf8");
    expect(repositorySource).toContain("readonly conflictRepository: AsyncConflictRepository");
    expect(repositorySource).toContain("readonly evidencePackRepository: AsyncEvidencePackRepository");
    expect(repositorySource).toContain("readonly connectorSyncRepository: AsyncConnectorSyncRepository");
    expect(repositorySource).toContain("readonly policyRepository: AsyncPolicyRepository");
    expect(repositorySource).toContain("readonly dreamJobRepository: AsyncDreamJobRepository");
    expect(repositorySource).toContain("createUnitOfWork(): AsyncUnitOfWork");
    expect(repositorySource).toContain("executeUnitOfWork<T>(operation: (unitOfWork: AsyncUnitOfWork) => Promise<T>): Promise<T>");
    expect(repositorySource).toContain("createClientUnitOfWork(client: PoolClient): AsyncUnitOfWork");
    expect(repositorySource).toContain("return this.transaction((client) => operation(this.createClientUnitOfWork(client)))");
    expect(repositorySource).toContain("upsertMemoryWithClient(client, memory");
    expect(repositorySource).toContain("memoryRepository: this");
    expect(repositorySource).toContain("eventJournal: this");
    expect(repositorySource).toContain("async saveConflict");
    expect(repositorySource).toContain("async saveEvidencePack");
    expect(repositorySource).toContain("async saveConnectorSyncState");
    expect(repositorySource).toContain("async savePolicyRule");
    expect(repositorySource).toContain("async saveRetentionRule");
    expect(repositorySource).toContain("cognibrain_conflict_sets");
    expect(repositorySource).toContain("cognibrain_evidence_packs");
    expect(repositorySource).toContain("cognibrain_connector_sync_states");
    expect(repositorySource).toContain("cognibrain_policy_rules");
    expect(repositorySource).toContain("cognibrain_retention_rules");
  });

  it("runs Postgres repository live tests only with explicit test credentials", () => {
    const url = process.env.MEMORY_POSTGRES_TEST_URL;
    if (!url) {
      expect({ state: "credential-blocked", reason: "MEMORY_POSTGRES_TEST_URL not set" }).toMatchObject({ state: "credential-blocked" });
      return;
    }
    const repository = new PostgresMemoryRepository(url, { timeoutMs: 15_000 });
    const memory = repository.create({
      userId: "postgres-test-user",
      orgId: "postgres-test-org",
      projectId: "postgres-test-project",
      content: "Postgres repository live credential test writes through pg.",
      source: { kind: "human", confidence: 0.99 }
    });
    expect(repository.get(memory.id).content).toContain("pg");
    repository.delete(memory.id);
  });

  it("exposes production remote persistence driver capabilities", () => {
    const postgresRemote = new PostgresRemotePersistenceAdapter("postgres://example.invalid/cognibrain");
    const cockroachRemote = new PostgresRemotePersistenceAdapter("postgres://example.invalid:26257/cognibrain", { cockroach: true });
    const cassandraRemote = new CassandraRemotePersistenceAdapter("127.0.0.1", { keyspace: "cognibrain" });
    expect(postgresRemote.capabilities()).toMatchObject({ distributedReady: true, transactional: true, appendOnly: true, sql: true, replication: "logical" });
    expect(cockroachRemote.kind).toBe("cockroach-remote");
    expect(cassandraRemote.capabilities()).toMatchObject({ distributedReady: false, appendOnly: true, replication: "quorum", sharding: "range" });
    expect(cassandraRemote.capabilities().notes.some((note) => note.includes("snapshot/event-journal"))).toBe(true);
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

  it("does not route DB-primary Postgres aliases through the legacy remote persistence factory", () => {
    const previousBackend = process.env.MEMORY_STORAGE_BACKEND;
    const previousPostgresUrl = process.env.MEMORY_POSTGRES_URL;
    try {
      process.env.MEMORY_POSTGRES_URL = "postgres://example.invalid/cognibrain";
      for (const backend of ["postgres-production", "postgres-db-primary", "postgres-async", "postgres-repository"]) {
        process.env.MEMORY_STORAGE_BACKEND = backend;
        expect(() => createPersistenceFromEnv()).toThrow(/DB-primary MemoryRepository backend/);
      }
      process.env.MEMORY_STORAGE_BACKEND = "postgres-remote";
      expect(createPersistenceFromEnv().kind).toBe("postgres-remote");
    } finally {
      if (previousBackend === undefined) delete process.env.MEMORY_STORAGE_BACKEND;
      else process.env.MEMORY_STORAGE_BACKEND = previousBackend;
      if (previousPostgresUrl === undefined) delete process.env.MEMORY_POSTGRES_URL;
      else process.env.MEMORY_POSTGRES_URL = previousPostgresUrl;
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

  it("seeds expanded first-class vendor connectors", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-health-cert-"));
    const oldArtifact = process.env.MEMORY_CONNECTOR_CERTIFICATION_ARTIFACT;
    try {
      const certificationArtifact = join(dir, "connector-certification.json");
      writeFileSync(certificationArtifact, JSON.stringify({
        rows: [{
          provider: "github",
          connectorId: "official-github",
          state: "credential-blocked",
          blockedBy: ["signed tenant live-smoke artifact"],
          canBecomeTenantVerified: true,
          canBecomeProductionCertified: false
        }]
      }));
      process.env.MEMORY_CONNECTOR_CERTIFICATION_ARTIFACT = certificationArtifact;
      const service = new MemoryService({ autoDream: { enabled: false } });
      const vendors = ["official-github", "official-slack", "official-discord", "official-jira", "official-confluence", "official-notion", "official-linear", "official-gitlab", "official-azure-devops", "official-microsoft-teams", "official-google-drive", "official-gmail", "official-google-calendar", "official-asana", "official-clickup", "official-sentry", "official-datadog", "official-pagerduty", "official-posthog"];
      const health = service.connectorHealth().filter((item) => vendors.includes(item.connectorId));
      expect(health.map((item) => item.connectorId)).toEqual(expect.arrayContaining(vendors));
      expect(health.every((item) => item.supports.externalVendor)).toBe(true);
      expect(health.find((item) => item.connectorId === "official-jira")?.externalVendor?.missingEnv).toContain("MEMORY_JIRA_PROJECT");
      expect(health.find((item) => item.connectorId === "official-github")?.certification).toMatchObject({
        state: "credential-blocked",
        artifact: certificationArtifact,
        canBecomeTenantVerified: true,
        productionCertified: false
      });
      expect(health.find((item) => item.connectorId === "official-confluence")?.kind).toBe("docs");
      expect(health.find((item) => item.connectorId === "official-linear")?.kind).toBe("project_management");
      const stateOfArt = health.filter((item) => ["official-asana", "official-clickup", "official-sentry", "official-datadog", "official-pagerduty", "official-posthog"].includes(item.connectorId));
      expect(stateOfArt.map((item) => item.connectorId)).toEqual(expect.arrayContaining(["official-asana", "official-clickup", "official-sentry", "official-datadog", "official-pagerduty", "official-posthog"]));
      expect(stateOfArt.every((item) => item.supports.poll && item.supports.writeback && item.supports.externalVendor)).toBe(true);
    } finally {
      if (oldArtifact === undefined) delete process.env.MEMORY_CONNECTOR_CERTIFICATION_ARTIFACT;
      else process.env.MEMORY_CONNECTOR_CERTIFICATION_ARTIFACT = oldArtifact;
      rmSync(dir, { recursive: true, force: true });
    }
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
      const gitlabConfig = JSON.parse(readFileSync(gitlabPath, "utf8"));
      const sqlite = JSON.parse(readFileSync(sqlitePath, "utf8"));
      const mcpRemote = JSON.parse(readFileSync(mcpRemotePath, "utf8"));
      expect(setup.profile).toBe("solo-dev");
      expect(setup.metadata.uiFramework).toBe("plain-cli");
      expect(setup.adapters).toContain("storage-sqlite");
      expect(connector.configured).toBe(true);
      expect(connector.requiredEnv.every((item: { valueRef?: string }) => item.valueRef?.startsWith("env:"))).toBe(true);
      expect(jira.settings.baseUrl).toBe("https://example.atlassian.net");
      expect(jira.settings.project).toBe("CB");
      expect(jira.settings.tokenEnv).toBe("env:MEMORY_JIRA_API_TOKEN");
      expect(gitlabConfig.status).toBe("vendor-driver");
      expect(gitlabConfig.nextSteps.some((step: string) => step.includes("verify:vendor-connectors"))).toBe(true);
      expect(sqlite.kind).toBe("storage");
      expect(sqlite.configured).toBe(true);
      expect(mcpRemote.kind).toBe("transport");
      expect(mcpRemote.settings.tokenEnv).toBe("env:MEMORY_MCP_REMOTE_TOKEN");
      expect(JSON.stringify({ setup, connector, jira, gitlabConfig, sqlite, mcpRemote })).not.toContain("test-token-should-not-be-written");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("marks release-critical retrieval with risk-aware verification requests and releaseBlockers", () => {
    const service = new MemoryService();
    const memory = service.add({
      userId: "risk-user",
      content: "Production deploy uses the old migration checklist.",
      source: { kind: "human", confidence: 0.7 },
      temporal: { verificationDueAt: new Date(Date.now() - 60_000) }
    });
    service.update(memory.id, { trust: 0.4 });
    const results = service.search({ userId: "risk-user", query: "deploy production release-critical migration", limit: 3 });
    expect(results[0]?.risk?.riskLevel).toBe("release-critical");
    expect(results[0]?.risk?.verificationRequests.length).toBeGreaterThan(0);
    const plan = service.dreamPlan({ userId: "risk-user", trigger: "before_release", mode: "dream" });
    expect(plan.releaseBlockers?.length).toBeGreaterThan(0);
  });
});
