import { spawnSync } from "node:child_process";
import { LocalHashEmbeddingProvider, embeddingsDisabled, normalizeVector } from "./embeddings";
import type { EmbeddingProvider } from "./types";

export interface OpenAICompatibleEmbeddingOptions {
  endpoint?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  dimensions?: number;
  timeoutMs?: number;
  request?: (payload: Record<string, unknown>, options: { endpoint: string; apiKey?: string }) => unknown;
}

interface OpenAICompatibleEmbeddingResponse {
  data?: Array<{ embedding?: unknown }>;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  readonly id: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly dimensions?: number;
  private readonly timeoutMs: number;
  private readonly request?: OpenAICompatibleEmbeddingOptions["request"];

  constructor(options: OpenAICompatibleEmbeddingOptions = {}) {
    const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
    this.endpoint = options.endpoint ?? `${baseUrl.replace(/\/$/, "")}/embeddings`;
    this.model = options.model ?? "text-embedding-3-small";
    this.apiKey = options.apiKey;
    this.dimensions = options.dimensions;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.MEMORY_EMBEDDING_TIMEOUT_MS ?? 5000);
    this.request = options.request;
    this.id = `openai-compatible:${this.model}`;
  }

  embed(input: string): number[] {
    const payload: Record<string, unknown> = { model: this.model, input };
    if (this.dimensions) payload.dimensions = this.dimensions;
    const response = this.request ? this.request(payload, { endpoint: this.endpoint, apiKey: this.apiKey }) : this.curl(payload);
    const vector = (response as OpenAICompatibleEmbeddingResponse).data?.[0]?.embedding;
    if (!Array.isArray(vector)) throw new Error("OpenAI-compatible embedding response did not include data[0].embedding");
    return normalizeVector(vector.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
  }

  private curl(payload: Record<string, unknown>): OpenAICompatibleEmbeddingResponse {
    const headers = ["-H", "content-type: application/json"];
    if (this.apiKey) headers.push("-H", `authorization: Bearer ${this.apiKey}`);
    const result = spawnSync("curl", [
      "-sS",
      "--fail",
      "--max-time",
      String(Math.max(1, Math.ceil(this.timeoutMs / 1000))),
      ...headers,
      "-d",
      JSON.stringify(payload),
      this.endpoint
    ], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`OpenAI-compatible embedding request failed: ${result.stderr || result.stdout || result.error?.message || "unknown error"}`);
    return JSON.parse(result.stdout || "{}") as OpenAICompatibleEmbeddingResponse;
  }
}

export function embeddingProviderFromEnv(): EmbeddingProvider | undefined {
  if (embeddingsDisabled()) return undefined;
  if (process.env.MEMORY_LOCAL_EMBEDDINGS === "1" || process.env.MEMORY_LOCAL_EMBEDDINGS === "true") return new LocalHashEmbeddingProvider();
  return undefined;
}
