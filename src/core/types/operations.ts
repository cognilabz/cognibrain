import type { ConsentPolicy, MemoryRelation, MemoryScope, Provenance, RelationType } from "./base";
import type { Memory, SearchResult } from "./memory";
import type { MemoryExtractionEvent } from "./extraction";
import type { AuditEvent } from "./integrations";

export interface QueryExpander {
  expand(input: { query: string; userId: string; now: Date; memories?: Memory[] }): string[];
}

export interface TranslationProvider {
  translate(input: { text: string; sourceLanguage?: string; targetLanguage: string }): {
    translated: string;
    confidence?: number;
    provider?: string;
  };
}

export interface HealthReport {
  total: number;
  active: number;
  archived: number;
  freshness: number;
  averageTrust: number;
  coverage: number;
  contradictions: number;
  healthScore: number;
}

export interface IdentityLink {
  id: string;
  primaryUserId: string;
  linkedUserId: string;
  hashedSubject: string;
  consent: "user" | "org";
  createdAt: Date | string;
  revokedAt?: Date | string;
}

export interface TimelineReport {
  userId: string;
  events: Array<{
    memoryId: string;
    content: string;
    eventAt: Date | string;
    validFrom?: Date | string;
    validUntil?: Date | string;
    supersededAt?: Date | string;
    entities: string[];
  }>;
  periods: Array<{ period: string; granularity: "hour" | "day" | "week" | "month"; memoryIds: string[]; summary?: string }>;
}

export interface TimelineSummaryReport {
  userId: string;
  generatedAt: Date | string;
  granularity: "hour" | "day" | "week" | "month" | "all";
  persisted: boolean;
  summaries: Array<{
    period: string;
    granularity: "hour" | "day" | "week" | "month";
    content: string;
    memoryIds: string[];
    summaryMemoryId?: string;
    confidence: number;
    mode: "deterministic" | "provider";
  }>;
}

export interface TemporalQueryReport {
  userId: string;
  after?: Date | string;
  before?: Date | string;
  events: TimelineReport["events"];
  changedEntities: Array<{ entity: string; memoryIds: string[]; firstAt: Date | string; lastAt: Date | string }>;
}

export interface BehavioralPatternReport {
  userId: string;
  patterns: Array<{
    key: string;
    label: string;
    support: number;
    memoryIds: string[];
    confidence: number;
    cadence?: string;
    pendingReview: boolean;
    lastObservedAt: Date | string;
    falsePositiveRisk?: number;
  }>;
}

export interface EntityRecord {
  id: string;
  canonical: string;
  aliases: string[];
  memoryIds: string[];
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
}

export interface GraphReport {
  entities: EntityRecord[];
  edges: Array<{
    sourceMemoryId: string;
    sourceEntity?: string;
    targetMemoryId?: string;
    targetEntity?: string;
    type: RelationType;
    direction?: "out" | "in" | "undirected";
    confidence: number;
    validFrom?: Date | string;
    validUntil?: Date | string;
  }>;
}

export interface Brain {
  id: string;
  name: string;
  ownerUserId: string;
  memberUserIds?: string[];
  allowedAgentIds?: string[];
  orgId?: string;
  visibility: "private" | "team" | "org" | "public";
  createdAt: Date | string;
  updatedAt: Date | string;
  consentRequired?: boolean;
}

export interface MemorySource {
  id: string;
  brainId: string;
  name: string;
  kind: "manual" | "chat" | "code" | "docs" | "calendar" | "connector" | "import";
  uri?: string;
  defaultConsent?: Partial<ConsentPolicy>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AgentRegistration {
  id: string;
  name: string;
  namespace: string;
  brainIds: string[];
  permissions: Array<"read" | "write" | "share" | "admin">;
  personaId?: string;
  subscriptions?: {
    events?: AuditEvent["type"][];
    brainIds?: string[];
    sourceIds?: string[];
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}
