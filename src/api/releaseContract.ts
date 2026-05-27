export type ReleaseStability = "stable" | "candidate" | "experimental";

export type ApiRouteContract = {
  path: string;
  methods: string[];
  stability: ReleaseStability;
  surface: "memory" | "graph" | "connector" | "dream" | "platform" | "operations" | "security";
  notes?: string;
};

export type CommandContract = {
  command: string;
  stability: ReleaseStability;
  surface: "operator-cli" | "memctl" | "binary";
  notes?: string;
};

const stable = "stable" satisfies ReleaseStability;
const candidate = "candidate" satisfies ReleaseStability;
const experimental = "experimental" satisfies ReleaseStability;

export const API_ROUTE_CONTRACTS: ApiRouteContract[] = [
  route("/health", ["GET"], stable, "operations"),
  route("/auth/status", ["GET"], stable, "security"),
  route("/maintenance", ["GET"], candidate, "operations"),
  route("/metrics", ["GET"], candidate, "operations"),
  route("/metrics/prometheus", ["GET"], candidate, "operations"),
  route("/memories", ["GET", "POST"], stable, "memory"),
  route("/memories/{id}", ["GET", "PATCH", "DELETE"], stable, "memory"),
  route("/memories/{id}/archive", ["POST"], stable, "memory"),
  route("/memories/{id}/confirm", ["POST"], stable, "memory"),
  route("/memories/{id}/retract", ["POST"], stable, "memory"),
  route("/memories/{id}/consent", ["POST"], candidate, "memory"),
  route("/memories/{id}/revert", ["POST"], candidate, "memory"),
  route("/memories/{id}/promote", ["POST"], candidate, "memory"),
  route("/memories/{id}/share-request", ["POST"], candidate, "memory"),
  route("/memories/{id}/share-revoke", ["POST"], candidate, "memory"),
  route("/episodes", ["GET"], candidate, "memory"),
  route("/episodes/{id}", ["GET"], candidate, "memory"),
  route("/extract", ["POST"], candidate, "memory"),
  route("/actions", ["POST"], stable, "memory"),
  route("/code/corrections", ["POST"], stable, "memory"),
  route("/code/action-guard", ["POST"], stable, "memory"),
  route("/search", ["POST"], stable, "memory"),
  route("/route", ["POST"], candidate, "memory"),
  route("/intent", ["POST"], candidate, "memory"),
  route("/evidence-pack", ["POST"], stable, "memory"),
  route("/evidence-pack/{id}", ["GET"], stable, "memory"),
  route("/context/enrich", ["POST"], candidate, "memory"),
  route("/coding-context-pack", ["POST"], stable, "memory"),
  route("/coding-context-packs/{id}", ["GET"], stable, "memory"),
  route("/context-packs/{id}", ["GET"], stable, "memory"),
  route("/context-packs/{id}/evidence", ["GET"], stable, "memory"),
  route("/patch-evidence", ["POST"], stable, "memory"),
  route("/feedback", ["POST"], candidate, "memory"),
  route("/feedback/injection", ["POST"], candidate, "memory"),
  route("/verification/{userId}", ["GET"], candidate, "dream"),
  route("/verification/resolve", ["POST"], candidate, "dream"),
  route("/profiles", ["GET", "PUT"], candidate, "memory"),
  route("/profiles/learn", ["POST"], experimental, "memory"),
  route("/profiles/training-samples", ["POST"], experimental, "memory"),
  route("/conflicts", ["GET"], candidate, "memory"),
  route("/conflicts/{id}/resolve", ["POST"], candidate, "memory"),
  route("/sync/status", ["GET"], candidate, "memory"),
  route("/sync/offline-operations", ["POST"], experimental, "memory"),
  route("/sync/run", ["POST"], experimental, "memory"),
  route("/federation/search", ["POST"], experimental, "memory"),
  route("/identity-links", ["POST"], candidate, "memory"),
  route("/identity-links/{id}", ["DELETE"], candidate, "memory"),
  route("/timeline/{userId}", ["GET"], candidate, "memory"),
  route("/timeline/{userId}/summarize", ["POST"], candidate, "memory"),
  route("/temporal/{userId}", ["GET"], candidate, "memory"),
  route("/patterns/{userId}", ["GET"], experimental, "memory"),
  route("/lifecycle/preview", ["POST"], candidate, "dream"),
  route("/learning/dream-policy/{userId}", ["GET"], experimental, "dream"),
  route("/learning/observations/{userId}", ["POST"], experimental, "dream"),
  route("/learning/predictions/{userId}", ["GET"], experimental, "dream"),
  route("/domain/evaluate", ["POST"], experimental, "memory"),
  route("/export/{userId}", ["GET"], candidate, "memory"),
  route("/users/{userId}/memories", ["DELETE"], candidate, "memory"),
  route("/graph", ["GET"], stable, "graph"),
  route("/entities", ["GET"], candidate, "graph"),
  route("/entities/enrich", ["POST"], experimental, "graph"),
  route("/entities/merge", ["POST"], candidate, "graph"),
  route("/entities/split", ["POST"], candidate, "graph"),
  route("/graph/paths", ["GET"], stable, "graph"),
  route("/graph/explain", ["GET"], stable, "graph"),
  route("/graph/activate", ["GET"], stable, "graph"),
  route("/graph/export", ["GET"], candidate, "graph"),
  route("/graph/query", ["POST"], stable, "graph"),
  route("/graph/infer", ["POST"], experimental, "graph"),
  route("/brains", ["GET", "POST"], candidate, "platform"),
  route("/sources", ["GET", "POST"], candidate, "platform"),
  route("/agents", ["GET", "POST"], candidate, "platform"),
  route("/agents/{id}/persona", ["POST"], candidate, "platform"),
  route("/personas", ["GET", "PUT"], candidate, "platform"),
  route("/events", ["GET"], candidate, "platform"),
  route("/audit", ["GET"], stable, "platform"),
  route("/audit/chain", ["GET"], stable, "platform"),
  route("/webhooks", ["POST"], candidate, "platform"),
  route("/webhooks/deliveries", ["GET"], candidate, "platform"),
  route("/webhooks/deliver", ["POST"], candidate, "platform"),
  route("/marketplace", ["GET"], experimental, "platform"),
  route("/marketplace/submissions", ["GET", "POST"], experimental, "platform"),
  route("/marketplace/scan", ["POST"], experimental, "platform"),
  route("/marketplace/review", ["POST"], experimental, "platform"),
  route("/marketplace/publish", ["POST"], experimental, "platform"),
  route("/marketplace/rate", ["POST"], experimental, "platform"),
  route("/marketplace/install", ["POST"], experimental, "platform"),
  route("/marketplace/plan", ["POST"], experimental, "platform"),
  route("/benchmarks/trend", ["GET"], experimental, "platform"),
  route("/benchmarks/leaderboard", ["GET"], experimental, "platform"),
  route("/managed/tenants", ["GET", "POST"], experimental, "platform"),
  route("/managed/control-plane", ["GET"], experimental, "platform"),
  route("/connectors", ["GET", "POST"], candidate, "connector"),
  route("/connectors/sync-records", ["GET"], candidate, "connector"),
  route("/connectors/review-queue", ["GET"], candidate, "connector"),
  route("/connectors/review-queue/{memoryId}/review", ["POST"], candidate, "connector"),
  route("/connectors/health", ["GET"], candidate, "connector"),
  route("/connectors/auth", ["GET"], candidate, "connector"),
  route("/connectors/auth/begin", ["POST"], candidate, "connector"),
  route("/connectors/auth/callback", ["POST"], candidate, "connector"),
  route("/connectors/auth/revoke", ["POST"], candidate, "connector"),
  route("/connectors/auth/refresh", ["POST"], candidate, "connector"),
  route("/connectors/list", ["GET"], candidate, "connector"),
  route("/connectors/sync", ["POST"], candidate, "connector"),
  route("/connectors/poll", ["POST"], candidate, "connector"),
  route("/connectors/writeback", ["POST"], candidate, "connector"),
  route("/connectors/feedback", ["POST"], candidate, "connector"),
  route("/connectors/telemetry", ["POST"], candidate, "connector"),
  route("/connectors/sync-state", ["POST"], candidate, "connector"),
  route("/dream/plan", ["POST"], candidate, "dream"),
  route("/dream/due", ["POST"], candidate, "dream"),
  route("/dream/run", ["POST"], candidate, "dream"),
  route("/dream/jobs", ["GET", "POST"], candidate, "dream"),
  route("/dream/jobs/{id}/cancel", ["POST"], candidate, "dream"),
  route("/dream/jobs/{id}/retry", ["POST"], candidate, "dream"),
  route("/sources/revalidate", ["POST"], candidate, "dream"),
  route("/harness/events", ["POST"], stable, "dream"),
  route("/harness/session-end", ["POST"], candidate, "dream"),
  route("/harness/handoff-prepare", ["POST"], candidate, "dream"),
  route("/harness/release-prepare", ["POST"], candidate, "dream"),
  route("/reflection", ["POST"], candidate, "dream"),
  route("/dream", ["POST"], candidate, "dream"),
  route("/maintenance/dream-due", ["POST"], candidate, "dream"),
  route("/migration/export", ["POST"], candidate, "operations"),
  route("/migration/import", ["POST"], candidate, "operations"),
  route("/backup/verify", ["POST"], candidate, "operations"),
  route("/compliance", ["GET"], candidate, "security"),
  route("/compliance/export", ["GET"], candidate, "security"),
  route("/policy/rules", ["GET", "POST"], candidate, "security"),
  route("/policy/evaluate", ["POST"], candidate, "security"),
  route("/retention/rules", ["GET", "POST"], candidate, "security"),
  route("/retention/enforce", ["POST"], candidate, "security"),
  route("/retention/review", ["GET"], candidate, "security"),
  route("/security/keys", ["GET"], candidate, "security"),
  route("/security/key-provider", ["GET"], candidate, "security"),
  route("/security/transport", ["GET"], candidate, "security"),
  route("/security/key-rotation", ["POST"], candidate, "security"),
  route("/privacy/insights", ["GET"], experimental, "security"),
  route("/privacy/cross-brain-compute", ["POST"], experimental, "security"),
  route("/storage", ["GET"], candidate, "operations"),
  route("/providers", ["GET"], candidate, "operations"),
  route("/translate", ["POST"], candidate, "operations"),
  route("/ingest/media", ["POST"], experimental, "memory"),
  route("/sdk/openapi", ["GET"], stable, "operations"),
  route("/openapi.json", ["GET"], stable, "operations"),
  route("/v1/openapi.json", ["GET"], stable, "operations")
];

export const CLI_COMMAND_CONTRACTS: CommandContract[] = [
  ...["cognibrain", "home", "ui", "tui", "init", "setup", "doctor", "start", "dev", "dashboard", "status", "stop", "proof", "truth", "dream", "service", "memories", "memory", "connections", "config", "connector", "adapter", "sdk", "skill", "mcp", "clean"].map((command) => commandContract(command, stable, "operator-cli")),
  commandContract("cognibrain-connect", candidate, "binary")
];

const stableMemctl = "add list extract action coding-context context-enrich code-correction action-guard patch-evidence search inspect edit archive route intent evidence evidence-pack why-used reflect dream truth-current truth-conflicts truth-resolve dream-plan dream-run dream-start dream-jobs dream-cancel dream-retry dream-verify dream-conflicts dream-resolve health maintenance verify confirm retract feedback feedback-injection metrics profiles profile-set profile-learn profile-sample timeline timeline-summarize temporal graph graph-path explain graph-activate graph-export graph-query audit audit-chain compliance compliance-export policy-rules policy-rule policy-evaluate retention-rule retention-rules retention-review retention-enforce storage api-spec connectors connector-register connector-configure connector-test connector-preview connector-sync connector-review connector-approve connector-reject connector-sync-records connector-health connector-auth connector-auth-begin connector-auth-callback connector-auth-refresh connector-list connector-poll connector-writeback connector-feedback connector-telemetry benchmark-proof production-certify consent revert export delete-user".split(/\s+/);
const candidateMemctl = "identity-link patterns entities entity-enrich entity-merge entity-split graph-changes infer agent-register agents agent-persona persona-set personas brain-create brains source-create events episodes episode federated-search share-request share-approve promote review share-revoke revoke key-report key-rotate privacy-insights privacy-cross-brain migration-export managed-tenant-create managed-tenants managed-control-plane provider-status translate media-ingest webhook-deliver connector-auth-revoke offline-add offline-update sync sync-status lifecycle-preview dream-policy observations predictions".split(/\s+/);
const experimentalMemctl = "marketplace marketplace-plan marketplace-install marketplace-submit marketplace-submissions marketplace-scan marketplace-review marketplace-publish marketplace-rate benchmark-nextgen leaderboard".split(/\s+/);

export const MEMCTL_COMMAND_CONTRACTS: CommandContract[] = [
  ...stableMemctl.map((command) => commandContract(command, stable, "memctl")),
  ...candidateMemctl.map((command) => commandContract(command, candidate, "memctl")),
  ...experimentalMemctl.map((command) => commandContract(command, experimental, "memctl"))
];

export function apiRouteMethods(): Record<string, string[]> {
  return Object.fromEntries(API_ROUTE_CONTRACTS.map((contract) => [contract.path, contract.methods]));
}

export function apiOperationContract(path: string, method: string): ApiRouteContract | undefined {
  const normalizedMethod = method.toUpperCase();
  return API_ROUTE_CONTRACTS.find((contract) => contract.path === path && contract.methods.includes(normalizedMethod));
}

function route(path: string, methods: string[], stability: ReleaseStability, surface: ApiRouteContract["surface"], notes?: string): ApiRouteContract {
  return { path, methods, stability, surface, notes };
}

function commandContract(command: string, stability: ReleaseStability, surface: CommandContract["surface"], notes?: string): CommandContract {
  return { command, stability, surface, notes };
}
