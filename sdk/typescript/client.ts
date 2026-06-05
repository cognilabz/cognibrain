import type { ActionGuardReport, CodebaseScope, CodingContextPack, ConnectorManifest, ConnectorSyncRecord, ContextEnrichmentReport, EngineeringMemoryKind, EpisodeRecord, EvidencePack, FeedbackKind, GraphExplainReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, MarketplaceModule, Memory, MemoryInput, MemoryPolicyOperation, MemoryPolicyRule, MemoryRouteReport, MemoryScope, PatchEvidenceTrail, PolicyDecision, QueryIntentReport, SearchOptions, SearchResult } from "../../src/core";
import { discoverDaemonUrl } from "../../src/runtime/daemonClient";

export interface CognibrainClientOptions {
  baseUrl?: string;
  runtimeRoot?: string;
  fetchImpl?: typeof fetch;
  apiKey?: string;
  actorId?: string;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class CognibrainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "CognibrainError";
  }
}

export interface MemoryPage {
  items: Memory[];
  nextCursor?: string;
}

export class CognibrainClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly apiKey?: string;
  private readonly actorId?: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;

  constructor(options: CognibrainClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? discoverDaemonUrl(options.runtimeRoot ?? process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd())).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiKey = options.apiKey;
    this.actorId = options.actorId;
    this.retries = Math.max(0, options.retries ?? 2);
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? 150);
    this.timeoutMs = Math.max(0, options.timeoutMs ?? 30_000);
  }

  add(input: MemoryInput): Promise<Memory> {
    return this.request("/memories", { method: "POST", body: input });
  }

  health(userId?: string): Promise<Record<string, unknown>> {
    return this.request(`/health${queryString({ userId })}`);
  }

  search(options: SearchOptions): Promise<SearchResult[]> {
    return this.request("/search", { method: "POST", body: options });
  }

  listMemories(userId?: string): Promise<Memory[]> {
    return this.request(`/memories${queryString({ userId })}`);
  }

  async listMemoriesPage(input: { userId?: string; limit?: number; cursor?: string } = {}): Promise<MemoryPage> {
    const items = await this.listMemories(input.userId);
    const start = Math.max(0, Number(input.cursor ?? 0) || 0);
    const limit = Math.max(1, input.limit ?? (items.length || 1));
    const page = items.slice(start, start + limit);
    const next = start + limit < items.length ? String(start + limit) : undefined;
    return { items: page, nextCursor: next };
  }

  paginateMemories(input: { userId?: string; limit?: number; cursor?: string } = {}): Promise<MemoryPage> {
    return this.listMemoriesPage(input);
  }

  getMemory(id: string): Promise<Memory> {
    return this.request(`/memories/${encodeURIComponent(id)}`);
  }

  updateMemory(id: string, patch: Partial<MemoryInput>): Promise<Memory> {
    return this.request(`/memories/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  }

  evidencePack(options: SearchOptions & { tokenBudget?: number }): Promise<EvidencePack> {
    return this.request("/evidence-pack", { method: "POST", body: options });
  }

  enrichContext(options: SearchOptions & { tokenBudget?: number; primaryIssueStore?: string; primaryKnowledgeStore?: string; defaultSearchConnectors?: string[]; fetchReferenced?: boolean; searchPrimaryStores?: boolean; persistFetched?: boolean; maxExternalFetches?: number; maxExternalResults?: number }): Promise<ContextEnrichmentReport> {
    return this.request("/context/enrich", { method: "POST", body: options });
  }

  codingContextPack(options: SearchOptions & { tokenBudget?: number }): Promise<CodingContextPack> {
    return this.request("/coding-context-pack", { method: "POST", body: options });
  }

  getEvidencePack(id: string): Promise<EvidencePack> {
    return this.request(`/context-packs/${encodeURIComponent(id)}/evidence`);
  }

  getCodingContextPack(id: string): Promise<CodingContextPack> {
    return this.request(`/coding-context-packs/${encodeURIComponent(id)}`);
  }

  recordAction(input: HarnessActionInput): Promise<Memory> {
    return this.request("/actions", { method: "POST", body: input });
  }

  recordCodeCorrection(input: {
    userId: string;
    content: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    evidenceIds?: string[];
  }): Promise<Memory> {
    return this.request("/code/corrections", { method: "POST", body: input });
  }

  guardAction(input: { userId: string; action: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; codebaseScope?: CodebaseScope }): Promise<ActionGuardReport> {
    return this.request("/code/action-guard", { method: "POST", body: input });
  }

  patchEvidenceTrail(input: { userId: string; task: string; agentId?: string; sessionId?: string; appId?: string; orgId?: string; projectId?: string; codebaseScope?: CodebaseScope; filesChanged?: string[]; commandsRun?: string[]; memoryIds?: string[] }): Promise<PatchEvidenceTrail> {
    return this.request("/patch-evidence", { method: "POST", body: input });
  }

  recordHarnessLifecycleEvent(input: HarnessLifecycleEventInput): Promise<HarnessLifecycleEventReport> {
    return this.request("/harness/events", { method: "POST", body: input });
  }

  route(options: SearchOptions): Promise<MemoryRouteReport> {
    return this.request("/route", { method: "POST", body: options });
  }

  intent(query: string): Promise<QueryIntentReport> {
    return this.request("/intent", { method: "POST", body: { query } });
  }

  feedback(memoryId: string, kind: FeedbackKind, userId?: string, note?: string): Promise<Memory> {
    return this.request("/feedback", { method: "POST", body: { memoryId, kind, userId, note } });
  }

  archive(memoryId: string): Promise<Memory> {
    return this.request(`/memories/${encodeURIComponent(memoryId)}/archive`, { method: "POST" });
  }

  graph(userId?: string): Promise<unknown> {
    return this.request(`/graph${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
  }

  episodes(userId?: string): Promise<EpisodeRecord[]> {
    return this.request(`/episodes${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
  }

  graphQuery(query: string, userId?: string): Promise<unknown> {
    return this.request("/graph/query", { method: "POST", body: { query, userId } });
  }

  graphExplain(from: string, to: string, options: { userId?: string; strategy?: GraphExplainReport["strategy"]; validAt?: Date | string; maxDepth?: number; limit?: number } = {}): Promise<GraphExplainReport> {
    const params = new URLSearchParams({ from, to });
    if (options.userId) params.set("userId", options.userId);
    if (options.strategy) params.set("strategy", options.strategy);
    if (options.validAt) params.set("validAt", new Date(options.validAt).toISOString());
    if (options.maxDepth) params.set("maxDepth", String(options.maxDepth));
    if (options.limit) params.set("limit", String(options.limit));
    return this.request(`/graph/explain?${params.toString()}`);
  }

  listPolicyRules(): Promise<MemoryPolicyRule[]> {
    return this.request("/policy/rules");
  }

  setPolicyRule(rule: Partial<MemoryPolicyRule> & Pick<MemoryPolicyRule, "label" | "effect" | "operations">): Promise<MemoryPolicyRule> {
    return this.request("/policy/rules", { method: "POST", body: rule });
  }

  evaluatePolicy(operation: MemoryPolicyOperation, target: { memoryId?: string; input?: MemoryInput }, actor: Partial<MemoryScope> = {}): Promise<PolicyDecision> {
    return this.request("/policy/evaluate", { method: "POST", body: { operation, ...target, actor } });
  }

  listConnectors(kind?: ConnectorManifest["kind"]): Promise<ConnectorManifest[]> {
    return this.request(`/connectors${queryString({ kind })}`);
  }

  registerConnector(manifest: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): Promise<ConnectorManifest> {
    return this.request("/connectors", { method: "POST", body: manifest });
  }

  connectorHealth(connectorId?: string): Promise<unknown> {
    return this.request(`/connectors/health${queryString({ connectorId })}`);
  }

  connectorSyncRecords(connectorId?: string): Promise<ConnectorSyncRecord[]> {
    return this.request(`/connectors/sync-records${queryString({ connectorId })}`);
  }

  syncConnector(connectorId: string, events: unknown[], scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): Promise<ConnectorSyncRecord> {
    return this.request("/connectors/sync", { method: "POST", body: { connectorId, events, ...scope } });
  }

  pollConnector(connectorId: string, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): Promise<ConnectorSyncRecord> {
    return this.request("/connectors/poll", { method: "POST", body: { connectorId, ...scope } });
  }

  writebackConnector(connectorId: string, input: Record<string, unknown>): Promise<ConnectorSyncRecord> {
    return this.request("/connectors/writeback", { method: "POST", body: { connectorId, ...input } });
  }

  marketplace(): Promise<MarketplaceModule[]> {
    return this.request("/marketplace");
  }

  installMarketplace(idOrModule: string | MarketplaceModule): Promise<MarketplaceModule> {
    return this.request("/marketplace/install", { method: "POST", body: typeof idOrModule === "string" ? { id: idOrModule } : idOrModule });
  }

  migrationExport(target: "self_hosted" | "managed" | "backup" = "backup"): Promise<unknown> {
    return this.request("/migration/export", { method: "POST", body: { target } });
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: options.method ?? "GET",
          headers: this.headers(Boolean(options.body)),
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: this.timeoutSignal()
        });
        const text = await response.text();
        const body = parseJsonBody(text) as { error?: unknown } | undefined;
        if (response.ok) return body as T;
        const error = new CognibrainError(typeof body?.error === "string" ? body.error : `${response.status} ${response.statusText}`, response.status, path, body);
        if (!isRetryableStatus(response.status) || attempt >= this.retries) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof CognibrainError) {
          lastError = error;
          if (!isRetryableStatus(error.status) || attempt >= this.retries) throw error;
        } else {
          lastError = error;
          if (attempt >= this.retries) throw error;
        }
      }
      await sleep(this.retryDelayMs * (attempt + 1));
    }
    throw lastError;
  }

  private headers(hasBody: boolean): Record<string, string> | undefined {
    const headers: Record<string, string> = {};
    if (hasBody) headers["content-type"] = "application/json";
    if (this.apiKey) headers["x-api-key"] = this.apiKey;
    if (this.actorId) headers["x-actor-id"] = this.actorId;
    return Object.keys(headers).length ? headers : undefined;
  }

  private timeoutSignal(): AbortSignal | undefined {
    return this.timeoutMs > 0 && typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(this.timeoutMs) : undefined;
  }
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  const value = search.toString();
  return value ? `?${value}` : "";
}

function parseJsonBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
