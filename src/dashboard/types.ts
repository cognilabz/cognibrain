import type { MetricsReport } from "../core";

export type ViewId = "memories" | "recall" | "graph" | "timeline" | "dream" | "marketplace" | "proof";
export type MemoryFilter = "active" | "all" | "archived" | "needs-review";
export type TimeZoom = "day" | "week" | "month" | "all";
export type EngineeringKindFilter = "all" | "repo_policy" | "architecture_decision" | "review_correction" | "tool_outcome" | "procedure" | "forbidden_action" | "migration_note" | "test_strategy" | "dependency_rule" | "generated_file_rule";

export type RuntimeStatus = {
  state: "checking" | "online" | "offline";
  label: string;
  maintenance?: { enabled: boolean; writeThreshold: number; intervalHours: number };
  metrics?: MetricsReport;
  storage?: { active: string; adapters: Array<{ kind: string; durable: boolean; distributedReady: boolean }> };
  managed?: {
    tenants: { total: number; active: number };
    readiness: Record<string, boolean>;
    autoscaling: { enabled: boolean; minReplicas: number; maxReplicas: number };
  };
};

export type ConnectorHealth = {
  connectorId: string;
  kind: string;
  privacyPolicy: string;
  lastStatus: string;
  lastSyncAt?: string;
  lastWritebackAt?: string;
  records: number;
};

export type MarketplaceModuleCard = {
  id: string;
  kind: "connector" | "domain" | "persona" | "retrieval_profile";
  name: string;
  version: string;
  status: "available" | "installed";
  summary: string;
  manifest: Record<string, unknown>;
  securityStatus?: string;
};

export type RoutePreview = {
  selectedScopes: Array<{ kind: string; id: string; reason: string }>;
  excludedScopes: Array<{ kind: string; id: string; reason: string }>;
  reasoning: string[];
};
