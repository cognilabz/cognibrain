import type { Memory, MemoryInput } from "./memory";

export interface DomainEvaluationCase {
  id: string;
  query: string;
  expected: string[];
  memories: MemoryInput[];
}

export interface DomainEvaluationReport {
  domainId: string;
  passed: boolean;
  accuracy: number;
  total: number;
  correct: number;
  generatedAt: Date | string;
  details: Array<{ id: string; passed: boolean; retrieved: string[]; expected: string[] }>;
}

export interface ReflectionReport {
  created: Memory[];
  demoted: Memory[];
  contradictions: Array<{ kept: Memory; demoted: Memory; reason: string; detector?: string; confidence?: number }>;
  lifecycle: {
    evaluated: number;
    summarized: number;
    faded: number;
    archived: number;
    reorganized: number;
    qualityScore: number;
    issues: string[];
    actions: string[];
  };
}
