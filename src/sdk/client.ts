import type { EvidencePack, FeedbackKind, GraphExplainReport, MarketplaceModule, Memory, MemoryInput, MemoryRouteReport, QueryIntentReport, SearchOptions, SearchResult } from "../core";

export interface CognibrainClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class CognibrainClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CognibrainClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8787").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  add(input: MemoryInput): Promise<Memory> {
    return this.request("/memories", { method: "POST", body: input });
  }

  search(options: SearchOptions): Promise<SearchResult[]> {
    return this.request("/search", { method: "POST", body: options });
  }

  evidencePack(options: SearchOptions & { tokenBudget?: number }): Promise<EvidencePack> {
    return this.request("/evidence-pack", { method: "POST", body: options });
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

  graph(userId?: string): Promise<unknown> {
    return this.request(`/graph${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`);
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
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : `${response.status} ${response.statusText}`);
    return body as T;
  }
}
