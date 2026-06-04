import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createDefaultMemoryService, type MemoryService } from "../api/service";
import type { DreamCycleInput, HarnessLifecycleEventInput, Memory, MemoryInput, MemoryPolicyOperation } from "../core";
import { sanitizedRuntimeEnv } from "../core/runtimeEnv";
import { createMemoryToolHandlers } from "./mcpHandlers";
import type {
  ConnectorReviewDecisionArgs,
  ConnectorReviewQueueArgs,
  ConnectorSyncStateArgs,
  MemoryActionGuardArgs,
  MemoryAddArgs,
  MemoryCodeCorrectionArgs,
  MemoryConflictListArgs,
  MemoryConflictResolveArgs,
  MemoryContextPackArgs,
  MemoryDreamCycleArgs,
  MemoryDreamJobArgs,
  MemoryDreamJobControlArgs,
  MemoryDreamJobStatusArgs,
  MemoryDreamPrepareArgs,
  MemoryEvidenceArgs,
  MemoryGraphActivationArgs,
  MemoryGraphPathArgs,
  MemoryGraphQueryArgs,
  MemoryHealthArgs,
  MemoryListArgs,
  MemoryPatchEvidenceArgs,
  MemoryPolicyCheckArgs,
  MemoryProcedureRecallArgs,
  MemoryReflectArgs,
  MemoryRetentionReviewArgs,
  MemoryRevalidateArgs,
  MemorySearchArgs,
  MemoryVerifyClaimArgs
} from "./mcpHandlers";

export interface MemoryRuntimeClient {
  call<TInput, TOutput>(operation: string, input?: TInput): Promise<TOutput>;
  health(input?: { userId?: string }): Promise<Record<string, unknown>>;
}

type RuntimeOptions = {
  service?: MemoryService;
  root?: string;
  runtimeRoot?: string;
};

export function createMcpRuntimeService(options: RuntimeOptions = {}): MemoryService | DaemonRuntimeServiceProxy {
  if (options.service) return options.service;
  const mode = process.env.COGNIBRAIN_MCP_BACKEND ?? process.env.COGNIBRAIN_RUNTIME_BACKEND;
  if (mode === "local" || mode === "local-direct" || mode === "in-process") {
    return createDefaultMemoryService();
  }
  return new DaemonRuntimeServiceProxy({
    root: options.root,
    runtimeRoot: options.runtimeRoot
  });
}

export function createMcpRuntimeToolHandlers(options: RuntimeOptions = {}) {
  if (options.service || process.env.COGNIBRAIN_MCP_BACKEND === "local" || process.env.COGNIBRAIN_MCP_BACKEND === "local-direct" || process.env.COGNIBRAIN_MCP_BACKEND === "in-process") {
    const service = options.service ?? createDefaultMemoryService();
    return createMemoryToolHandlers(service);
  }
  const runtime = new DaemonRuntimeClient({ root: options.root, runtimeRoot: options.runtimeRoot });
  return createDaemonMemoryToolHandlers(runtime);
}

function memoryInputForAdd(args: MemoryAddArgs): MemoryInput {
  return {
    userId: args.userId,
    agentId: args.agentId,
    sessionId: args.sessionId,
    appId: args.appId,
    orgId: args.orgId,
    projectId: args.projectId,
    content: args.content,
    type: args.type,
    layer: args.layer,
    tags: args.tags,
    entities: args.entities,
    pinned: args.pinned,
    metadata: args.metadata,
    source: {
      kind: args.sourceKind ?? "human",
      confidence: args.sourceConfidence ?? 0.9
    }
  };
}

function dreamCycleInput(args: MemoryDreamCycleArgs): DreamCycleInput {
  return {
    userId: args.userId,
    trigger: args.trigger,
    mode: args.mode,
    scope: args.scope,
    budget: args.budget,
    sourceRefresh: args.sourceRefresh,
    connectorIds: args.connectorIds,
    harnessRunId: args.harnessRunId,
    force: args.force
  };
}

export function createDaemonMemoryToolHandlers(runtime: MemoryRuntimeClient) {
  return {
    add(args: MemoryAddArgs) {
      return runtime.call("memory.add", memoryInputForAdd(args));
    },

    search(args: MemorySearchArgs) {
      return runtime.call("memory.search", { ...args, limit: args.limit ?? 8 });
    },

    async contextPack(args: MemoryContextPackArgs) {
      const pack: any = await runtime.call("memory.evidencePack", { ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 });
      return { context: pack.context, evidencePack: pack, results: pack.results };
    },

    codingContextPack(args: MemoryContextPackArgs) {
      return runtime.call("memory.codingContextPack", { ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 });
    },

    codeCorrection(args: MemoryCodeCorrectionArgs) {
      return runtime.call("memory.codeCorrection", args);
    },

    actionGuard(args: MemoryActionGuardArgs) {
      return runtime.call("memory.actionGuard", args);
    },

    patchEvidence(args: MemoryPatchEvidenceArgs) {
      return runtime.call("memory.patchEvidence", args);
    },

    evidencePack(args: MemoryEvidenceArgs) {
      if (args.contextPackId) return runtime.call("memory.evidencePack.get", { contextPackId: args.contextPackId });
      if (!args.userId || !args.query) throw new Error("memory_evidence_pack requires contextPackId or userId plus query");
      return runtime.call("memory.evidencePack", { ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 });
    },

    graphPath(args: MemoryGraphPathArgs) {
      return runtime.call("graph.paths", args);
    },

    graphQuery(args: MemoryGraphQueryArgs) {
      return runtime.call("graph.query", args);
    },

    graphActivation(args: MemoryGraphActivationArgs) {
      return runtime.call("graph.activation", args);
    },

    explainConnection(args: MemoryGraphPathArgs) {
      return runtime.call("graph.explain", args);
    },

    policyCheck(args: MemoryPolicyCheckArgs) {
      return runtime.call("policy.evaluate", args);
    },

    retentionReview(args: MemoryRetentionReviewArgs) {
      return runtime.call("retention.review", args);
    },

    async verifyClaim(args: MemoryVerifyClaimArgs) {
      const pack: any = await runtime.call("memory.evidencePack", {
        userId: args.userId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        appId: args.appId,
        orgId: args.orgId,
        projectId: args.projectId,
        query: args.claim,
        limit: args.limit ?? 5,
        includeArchived: args.includeArchived,
        tokenBudget: args.tokenBudget ?? 900
      });
      const top = pack.results?.[0];
      const contradicted = Boolean(pack.results?.some((result: any) => result.beliefState === "contradicted" || result.retrieval?.contradiction));
      const supported = Boolean(top && top.retrieval?.score >= 0.2 && !contradicted);
      return {
        claim: args.claim,
        verdict: contradicted ? "contradicted" : supported ? "supported" : "insufficient_evidence",
        confidence: top ? Math.min(1, Math.max(0, top.retrieval?.score ?? 0)) : 0,
        evidencePackId: pack.id,
        evidence: (pack.results ?? []).map((result: any) => ({
          memoryId: result.memoryId,
          content: result.content,
          citation: result.retrieval?.citation,
          score: result.retrieval?.score,
          explanation: result.retrieval?.explanation,
          beliefState: result.beliefState,
          policyDecision: pack.policyDecisions?.find((decision: any) => decision.memoryId === result.memoryId)
        })),
        warnings: [
          ...(contradicted ? ["claim has contradictory evidence"] : []),
          ...(pack.excludedResults?.length ? [`${pack.excludedResults.length} evidence candidates were excluded`] : [])
        ]
      };
    },

    procedureRecall(args: MemoryProcedureRecallArgs) {
      return runtime.call("memory.search", { ...args, limit: args.limit ?? 5, filters: { type: "procedural" } });
    },

    actionRecord(args: Record<string, unknown>) {
      return runtime.call("memory.actionRecord", args);
    },

    actionOutcome(args: Record<string, unknown>) {
      return runtime.call("memory.actionRecord", args);
    },

    async list(args: MemoryListArgs) {
      const memories = await runtime.call<MemoryListArgs, any[]>("memory.list", args);
      return memories.slice(0, args.limit ?? 50);
    },

    reflect(args: MemoryReflectArgs) {
      return runtime.call("dream.reflect", args);
    },

    dream(args: MemoryReflectArgs) {
      return runtime.call("dream.runLegacy", args);
    },

    dreamPlan(args: MemoryDreamCycleArgs) {
      return runtime.call("dream.plan", dreamCycleInput(args));
    },

    dreamDue(args: MemoryDreamCycleArgs) {
      return runtime.call("dream.plan", dreamCycleInput({ ...args, trigger: args.trigger ?? "auto_interval" }));
    },

    dreamRun(args: MemoryDreamCycleArgs) {
      return runtime.call("dream.run", dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" }));
    },

    dreamJobStart(args: MemoryDreamJobArgs) {
      return runtime.call("dream.jobStart", dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" }));
    },

    dreamJobStatus(args: MemoryDreamJobStatusArgs) {
      return runtime.call("dream.jobStatus", args);
    },

    dreamJobCancel(args: MemoryDreamJobControlArgs) {
      return runtime.call("dream.jobCancel", args);
    },

    dreamJobRetry(args: MemoryDreamJobControlArgs) {
      return runtime.call("dream.jobRetry", args);
    },

    sessionEnd(args: MemoryDreamPrepareArgs) {
      return runtime.call("dream.prepare", dreamCycleInput({ ...args, trigger: "harness_session_end", mode: args.mode ?? "dream" }));
    },

    handoffPrepare(args: MemoryDreamPrepareArgs) {
      return runtime.call("dream.prepare", dreamCycleInput({ ...args, trigger: "harness_handoff", mode: args.mode ?? "dream", sourceRefresh: args.sourceRefresh ?? true }));
    },

    releasePrepare(args: MemoryDreamPrepareArgs) {
      return runtime.call("dream.prepare", dreamCycleInput({ ...args, trigger: "before_release", mode: args.mode ?? "dream", budget: args.budget ?? "release", sourceRefresh: args.sourceRefresh ?? true }));
    },

    revalidateSourceRefs(args: MemoryRevalidateArgs) {
      return runtime.call("source.revalidate", args);
    },

    resolveVerification(args: MemoryRevalidateArgs) {
      return runtime.call("verification.resolve", args);
    },

    connectorSyncState(args: ConnectorSyncStateArgs) {
      return runtime.call("connector.syncState", args);
    },

    conflictSets(args: MemoryConflictListArgs) {
      return runtime.call("truth.conflictSets", args);
    },

    conflictResolve(args: MemoryConflictResolveArgs) {
      return runtime.call("truth.conflictResolve", args);
    },

    connectorReviewQueue(args: ConnectorReviewQueueArgs) {
      return runtime.call("connector.reviewQueue", args);
    },

    connectorReviewDecision(args: ConnectorReviewDecisionArgs) {
      return runtime.call("connector.reviewDecision", args);
    },

    harnessEvent(args: HarnessLifecycleEventInput) {
      return runtime.call("harness.event", args);
    },

    health(args: MemoryHealthArgs) {
      return runtime.call("health", args);
    },

    maintenance() {
      return runtime.call("maintenance.status");
    }
  };
}

export class DaemonRuntimeClient implements MemoryRuntimeClient {
  readonly root: string;
  readonly runtimeRoot: string;
  baseUrl: string;
  readonly headers: Record<string, string>;

  constructor(options: { root?: string; runtimeRoot?: string; baseUrl?: string } = {}) {
    this.root = resolve(options.root ?? process.cwd());
    this.runtimeRoot = resolve(options.runtimeRoot ?? process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd());
    this.baseUrl = stripSlash(options.baseUrl ?? discoverDaemonUrl(this.runtimeRoot));
    this.headers = authHeadersFromEnv();
  }

  async call<TInput, TOutput>(operation: string, input?: TInput): Promise<TOutput> {
    const route = routeForOperation(operation, input);
    await this.ensureReachable();
    return httpJson<TOutput>(route.method, `${this.baseUrl}${route.path}`, route.body, this.headers);
  }

  async health(input: { userId?: string } = {}): Promise<Record<string, unknown>> {
    return this.call("health", input);
  }

  async ensureReachable(): Promise<void> {
    if (await this.isReachable()) return;
    if (process.env.COGNIBRAIN_MCP_AUTOSTART === "false") throw new Error(`cognibrain daemon unavailable at ${this.baseUrl}`);
    autostartDaemon(this.root, this.runtimeRoot);
    this.baseUrl = stripSlash(discoverDaemonUrl(this.runtimeRoot));
    if (await this.isReachable()) return;
    throw new Error(`cognibrain daemon unavailable at ${this.baseUrl}`);
  }

  private async isReachable(): Promise<boolean> {
    try {
      const health = await httpJson<{ ok?: boolean }>("GET", `${this.baseUrl}/health`, undefined, this.headers, 800);
      return Boolean(health.ok);
    } catch {
      return false;
    }
  }
}

export class DaemonRuntimeServiceProxy {
  readonly runtime: DaemonRuntimeClient;

  constructor(options: { root?: string; runtimeRoot?: string; runtime?: DaemonRuntimeClient } = {}) {
    this.runtime = options.runtime ?? new DaemonRuntimeClient(options);
  }

  add(input: MemoryInput) {
    return this.runtime.call("memory.add", input);
  }

  search(input: Record<string, unknown>) {
    return this.runtime.call("memory.search", input);
  }

  evidencePack(input: Record<string, unknown>) {
    return this.runtime.call("memory.evidencePack", input);
  }

  getEvidencePack(contextPackId: string) {
    return this.runtime.call("memory.evidencePack.get", { contextPackId });
  }

  codingContextPack(input: Record<string, unknown>) {
    return this.runtime.call("memory.codingContextPack", input);
  }

  recordCodeCorrection(input: Record<string, unknown>) {
    return this.runtime.call("memory.codeCorrection", input);
  }

  guardAction(input: Record<string, unknown>) {
    return this.runtime.call("memory.actionGuard", input);
  }

  patchEvidenceTrail(input: Record<string, unknown>) {
    return this.runtime.call("memory.patchEvidence", input);
  }

  graphPaths(from: string, to: string, options: Record<string, unknown>) {
    return this.runtime.call("graph.paths", { from, to, ...options });
  }

  graphQuery(query: string, userId?: string) {
    return this.runtime.call("graph.query", { query, userId });
  }

  graphActivation(query: string, options: Record<string, unknown>) {
    return this.runtime.call("graph.activation", { query, ...options });
  }

  graphExplain(from: string, to: string, options: Record<string, unknown>) {
    return this.runtime.call("graph.explain", { from, to, ...options });
  }

  get(memoryId: string) {
    return this.runtime.call("memory.get", { memoryId });
  }

  evaluatePolicy(operation: MemoryPolicyOperation, target: Memory | MemoryInput, actor: Partial<MemoryInput>) {
    return this.runtime.call("policy.evaluate", { operation, input: target, actor });
  }

  retentionReview(now: Date, userId?: string) {
    return this.runtime.call("retention.review", { now: now.toISOString(), userId });
  }

  recordHarnessAction(input: Record<string, unknown>) {
    return this.runtime.call("memory.actionRecord", input);
  }

  list(userId?: string) {
    return this.runtime.call("memory.list", { userId });
  }

  reflect(userId: string) {
    return this.runtime.call("dream.reflect", { userId });
  }

  dream(userId: string) {
    return this.runtime.call("dream.runLegacy", { userId });
  }

  dreamPlan(input: DreamCycleInput) {
    return this.runtime.call("dream.plan", input);
  }

  runDreamCycleAsync(input: DreamCycleInput) {
    return this.runtime.call("dream.run", input);
  }

  startDreamJob(input: DreamCycleInput) {
    return this.runtime.call("dream.jobStart", input);
  }

  dreamJobStatus(jobId?: string) {
    return this.runtime.call("dream.jobStatus", { jobId });
  }

  cancelDreamJob(jobId: string, reason?: string) {
    return this.runtime.call("dream.jobCancel", { jobId, reason });
  }

  retryDreamJob(jobId: string) {
    return this.runtime.call("dream.jobRetry", { jobId });
  }

  prepareDream(input: DreamCycleInput & { run?: boolean }) {
    return this.runtime.call("dream.prepare", input);
  }

  revalidateMemory(memoryId: string, userId?: string) {
    return this.runtime.call("source.revalidate", { memoryId, userId: userId ?? "local" });
  }

  revalidateSourceRefs(userId: string, options: { connectorIds?: string[]; limit?: number } = {}) {
    return this.runtime.call("source.revalidate", { userId, ...options });
  }

  resolveVerificationQueue(userId: string, options: { connectorIds?: string[]; limit?: number } = {}) {
    return this.runtime.call("verification.resolve", { userId, ...options });
  }

  connectorSyncState(connectorId?: string) {
    return this.runtime.call("connector.syncState", { connectorId });
  }

  listConflictSets(status?: string) {
    return this.runtime.call("truth.conflictSets", { status });
  }

  resolveConflictSet(conflictSetId: string, input: Record<string, unknown>) {
    return this.runtime.call("truth.conflictResolve", { conflictSetId, ...input });
  }

  listConnectorReviewQueue(input: Record<string, unknown>) {
    return this.runtime.call("connector.reviewQueue", input);
  }

  reviewConnectorMemory(memoryId: string, input: Record<string, unknown>) {
    return this.runtime.call("connector.reviewDecision", { memoryId, ...input });
  }

  recordHarnessLifecycleEvent(input: HarnessLifecycleEventInput) {
    return this.runtime.call("harness.event", input);
  }

  health(userId?: string) {
    return this.runtime.call("health", { userId });
  }

  maintenanceStatus() {
    return this.runtime.call("maintenance.status");
  }
}

function routeForOperation(operation: string, input?: any): { method: string; path: string; body?: unknown } {
  switch (operation) {
    case "memory.add":
      return { method: "POST", path: "/memories", body: input };
    case "memory.search":
      return { method: "POST", path: "/search", body: input };
    case "memory.evidencePack":
      return { method: "POST", path: "/evidence-pack", body: input };
    case "memory.evidencePack.get":
      return { method: "GET", path: `/evidence-pack/${encodeURIComponent(input.contextPackId)}` };
    case "memory.codingContextPack":
      return { method: "POST", path: "/coding-context-pack", body: input };
    case "memory.codeCorrection":
      return { method: "POST", path: "/code/corrections", body: input };
    case "memory.actionGuard":
      return { method: "POST", path: "/code/action-guard", body: input };
    case "memory.patchEvidence":
      return { method: "POST", path: "/patch-evidence", body: input };
    case "memory.actionRecord":
      return { method: "POST", path: "/actions", body: input };
    case "memory.list":
      return { method: "GET", path: `/memories${query(input)}` };
    case "memory.get":
      return { method: "GET", path: `/memories/${encodeURIComponent(input.memoryId)}` };
    case "graph.paths":
      return { method: "GET", path: `/graph/paths${query(input)}` };
    case "graph.query":
      return { method: "POST", path: "/graph/query", body: input };
    case "graph.activation":
      return { method: "GET", path: `/graph/activate${query(input)}` };
    case "graph.explain":
      return { method: "GET", path: `/graph/explain${query(input)}` };
    case "policy.evaluate":
      return { method: "POST", path: "/policy/evaluate", body: input };
    case "retention.review":
      return { method: "GET", path: `/retention/review${query(input)}` };
    case "dream.reflect":
      return { method: "POST", path: "/reflection", body: input };
    case "dream.runLegacy":
      return { method: "POST", path: "/dream", body: input };
    case "dream.plan":
      return { method: "POST", path: "/dream/plan", body: input };
    case "dream.run":
      return { method: "POST", path: "/dream/run", body: input };
    case "dream.jobStart":
      return { method: "POST", path: "/dream/jobs", body: input };
    case "dream.jobStatus":
      return { method: "GET", path: `/dream/jobs${query(input)}` };
    case "dream.jobCancel":
      return { method: "POST", path: `/dream/jobs/${encodeURIComponent(input.jobId)}/cancel`, body: { reason: input.reason } };
    case "dream.jobRetry":
      return { method: "POST", path: `/dream/jobs/${encodeURIComponent(input.jobId)}/retry` };
    case "dream.prepare":
      return dreamPrepareRoute(input);
    case "source.revalidate":
      return { method: "POST", path: "/sources/revalidate", body: input };
    case "verification.resolve":
      return { method: "POST", path: "/verification/resolve", body: input };
    case "connector.syncState":
      return { method: "POST", path: "/connectors/sync-state", body: input };
    case "truth.conflictSets":
      return { method: "GET", path: `/conflicts${query(input)}` };
    case "truth.conflictResolve":
      return { method: "POST", path: `/conflicts/${encodeURIComponent(input.conflictSetId)}/resolve`, body: { selectedClaimId: input.selectedClaimId, reason: input.reason, resolvedBy: input.resolvedBy } };
    case "connector.reviewQueue":
      return { method: "GET", path: `/connectors/review-queue${query(input)}` };
    case "connector.reviewDecision":
      return { method: "POST", path: `/connectors/review-queue/${encodeURIComponent(input.memoryId)}/review`, body: { decision: input.decision, reviewerId: input.reviewerId, reason: input.reason } };
    case "harness.event":
      return { method: "POST", path: "/harness/events", body: input };
    case "health":
      return { method: "GET", path: `/health${query(input)}` };
    case "maintenance.status":
      return { method: "GET", path: "/maintenance" };
    default:
      throw new Error(`unsupported MCP runtime operation ${operation}`);
  }
}

function dreamPrepareRoute(input: DreamCycleInput & { run?: boolean }): { method: string; path: string; body?: unknown } {
  const trigger = input.trigger;
  if (trigger === "harness_handoff") return { method: "POST", path: "/harness/handoff-prepare", body: input };
  if (trigger === "before_release") return { method: "POST", path: "/harness/release-prepare", body: input };
  return { method: "POST", path: "/harness/session-end", body: input };
}

function query(input?: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      continue;
    }
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function httpJson<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}, timeoutMs = 4_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error ?? payload.message ?? `${url} returned ${response.status}`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

function discoverDaemonUrl(runtimeRoot: string): string {
  const explicit = process.env.MEMORY_API_URL ?? process.env.COGNIBRAIN_API_URL ?? process.env.COGNIBRAIN_URL;
  if (explicit) return explicit;
  for (const file of [
    join(runtimeRoot, ".cognibrain", "runtime.json"),
    join(runtimeRoot, ".cognibrain", "local-runtime.json")
  ]) {
    const state = readJson(file);
    if (state?.api?.url) return state.api.url;
  }
  return "http://127.0.0.1:8787";
}

function autostartDaemon(root: string, runtimeRoot: string): void {
  const lockPath = join(runtimeRoot, ".cognibrain", "mcp-start.lock");
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockFd: number | undefined;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch {
    return;
  }
  try {
    writeFileSync(lockFd, `${process.pid}\n`);
    spawnSync(process.execPath, [join(root, "bin", "cognibrain.mjs"), "--runtime-root", runtimeRoot, "start"], {
      cwd: root,
      env: sanitizedRuntimeEnv(),
      stdio: "ignore",
      timeout: 12_000
    });
  } finally {
    rmSync(lockPath, { force: true });
  }
}

function authHeadersFromEnv(): Record<string, string> {
  const bearer = process.env.MEMORY_BEARER_TOKEN;
  const apiKey = bearer ? undefined : process.env.MEMORY_API_KEY ?? process.env.COGNIBRAIN_API_KEY ?? process.env.COGNIBRAIN_API_TOKEN;
  return Object.fromEntries(Object.entries({
    authorization: bearer ? `Bearer ${bearer}` : undefined,
    "x-api-key": apiKey,
    "x-actor-id": process.env.MEMORY_ACTOR_ID ?? process.env.COGNIBRAIN_ACTOR_ID
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function readJson(path: string): any {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
