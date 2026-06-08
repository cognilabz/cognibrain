import type { SearchResult } from "./memory";

export interface ObservationReport {
  userId: string;
  generatedAt: Date | string;
  style: "concise" | "descriptive" | "narrative";
  persisted: boolean;
  observations: Array<{
    content: string;
    memoryIds: string[];
    citations: string[];
    confidence: number;
    mode: "deterministic" | "provider";
    observationMemoryId?: string;
  }>;
}

export interface PredictionReport {
  userId: string;
  generatedAt: Date | string;
  predictions: Array<{
    label: string;
    confidence: number;
    reason: string;
    memoryIds: string[];
    suggestedQuery: string;
  }>;
  prefetch: SearchResult[];
  anomalies: Array<{
    kind: "missing_recent_confirmation" | "pending_pattern_review" | "low_trust_recent_memory";
    memoryId?: string;
    message: string;
  }>;
}

export interface MetricsReport {
  memoriesAdded: number;
  memoriesUpdated?: number;
  memoriesArchived?: number;
  searches: number;
  feedback: number;
  dreams: number;
  contradictionsResolved: number;
  contradictionsOpened?: number;
  noHitSearches: number;
  lowConfidenceSearches?: number;
  averageSearchResults: number;
  averageQualityScore: number;
  truthGate?: {
    excluded: number;
    reviewed: number;
    missingClaim: number;
    suppressedClaims: number;
    revalidate: number;
  };
  dreamActions?: Record<string, number>;
  benchmarkRuns?: number;
  sessions?: Record<string, { searches: number; noHitSearches: number; averageResults: number }>;
}

export interface BenchmarkCase {
  id: string;
  kind: "single-hop" | "multi-hop" | "temporal" | "contradiction" | "abstention";
  query: string;
  expectedIds: string[];
  disallowedIds?: string[];
}

export interface BenchmarkResult {
  name: string;
  accuracy: number;
  correct: number;
  total: number;
  meanTokens: number;
  meanLatencyMs: number;
  details: Array<{ id: string; passed: boolean; retrieved: string[]; expected: string[] }>;
}
