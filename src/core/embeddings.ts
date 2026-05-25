import { tokenize } from "./text";
import type { EmbeddingProvider } from "./types";

export class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly id = "local-hash-embedding";

  constructor(private readonly dimensions = 128) {}

  embed(input: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    for (const token of tokenize(input)) {
      const index = hashToken(token) % this.dimensions;
      vector[index] += 1;
    }
    return normalizeVector(vector);
  }
}

export function embeddingsDisabled(options: { disableEmbeddings?: boolean } = {}, env: NodeJS.ProcessEnv = process.env): boolean {
  if (options.disableEmbeddings) return true;
  return ["MEMORY_DISABLE_EMBEDDINGS", "MEMORY_PRIVACY_DISABLE_EMBEDDINGS"].some((key) => isEnabled(env[key]));
}

export function cosineVector(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(normA * normB)));
}

export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  return norm ? vector.map((value) => value / norm) : vector;
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (const char of token) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isEnabled(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
