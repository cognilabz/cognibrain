import type { MemoryRelation, Provenance, RelationType, SourceKind } from "./base";

export interface GraphPath {
  nodes: Array<{ id: string; kind: "memory" | "entity"; label: string; memoryId?: string }>;
  edges: Array<{
    from: string;
    to: string;
    type: RelationType | "mentions";
    confidence: number;
    memoryId?: string;
    trust?: number;
    timestamp?: Date | string;
    validFrom?: Date | string;
    validUntil?: Date | string;
    evidenceIds?: string[];
    createdBy?: SourceKind;
    source?: Provenance;
  }>;
  score: number;
  explanation: string[];
}

export interface GraphQueryResult {
  query: string;
  matches: Array<{ memoryId: string; content: string; relation?: MemoryRelation; entities: string[]; trust: number; createdAt?: Date | string; source?: Provenance }>;
  warnings: string[];
}

export interface GraphActivationResult {
  query: string;
  seeds: string[];
  ranked: Array<{ nodeId: string; label: string; kind: "memory" | "entity"; score: number; memoryId?: string; explanation: string[] }>;
}

export interface GraphExportOptions {
  userId?: string;
  relationTypes?: RelationType[];
  minTrust?: number;
  sourceKind?: SourceKind;
  after?: Date | string;
  before?: Date | string;
  validAt?: Date | string;
  format?: "json" | "graphml";
}

export interface GraphExplainReport {
  from: string;
  to: string;
  strategy: "shortest" | "strongest" | "most_recent" | "highest_trust";
  validAt?: Date | string;
  paths: GraphPath[];
}

export interface GraphExportResult {
  nodes: Array<{ id: string; kind: "memory" | "entity"; label: string; memoryId?: string }>;
  edges: GraphPath["edges"];
}

export interface InferenceRule {
  id: string;
  label: string;
  when: { left: RelationType; right: RelationType };
  then: RelationType;
  confidence?: number;
}

export interface InferenceReport {
  rulesEvaluated: number;
  inferred: Array<{ memoryId: string; relation: MemoryRelation; ruleId: string; evidence: string[] }>;
}
