import type { CodebaseScope, EngineeringMemoryKind, FeedbackKind } from "../../core";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function isFeedbackKind(value: string): value is FeedbackKind {
  return ["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable", "approve_pattern", "reject_pattern"].includes(value);
}

export function relationTypesFromEnv() {
  return process.env.MEMORY_RELATION_TYPES ? process.env.MEMORY_RELATION_TYPES.split(",").map((item) => item.trim()).filter(Boolean) as any : undefined;
}

export function retrievalModeFromEnv() {
  const value = process.env.MEMORY_RETRIEVAL_MODE;
  return value === "rrf" || value === "graph" || value === "path" || value === "hybrid" ? value : undefined;
}

export function graphExplainStrategyFromEnv() {
  const value = process.env.MEMORY_GRAPH_STRATEGY;
  return value === "shortest" || value === "strongest" || value === "most_recent" || value === "highest_trust" ? value : undefined;
}

export function permissionsFromEnv() {
  const values = (process.env.MEMORY_AGENT_PERMISSIONS ?? "read,write").split(",").map((item) => item.trim()).filter(Boolean);
  return values.filter((value): value is "read" | "write" | "share" | "admin" => value === "read" || value === "write" || value === "share" || value === "admin");
}

export function summaryStyleFromEnv() {
  const value = process.env.MEMORY_PERSONA_SUMMARY_STYLE;
  return value === "descriptive" || value === "narrative" ? value : "concise";
}

export function observationStyleFromEnv() {
  const value = process.env.MEMORY_OBSERVATION_STYLE;
  return value === "descriptive" || value === "narrative" ? value : "concise";
}

export function csvList(value?: string) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

export function optionValue(argv: string[], name: string) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export function codebaseScopeFromEnv(): CodebaseScope | undefined {
  if (process.env.MEMORY_CODEBASE_JSON) return JSON.parse(process.env.MEMORY_CODEBASE_JSON) as CodebaseScope;
  const scope: CodebaseScope = {
    repo: process.env.MEMORY_REPO,
    branch: process.env.MEMORY_BRANCH,
    commit: process.env.MEMORY_COMMIT,
    workspace: process.env.MEMORY_WORKSPACE,
    directory: process.env.MEMORY_DIRECTORY,
    filePattern: process.env.MEMORY_FILE_PATTERN,
    language: process.env.MEMORY_LANGUAGE,
    framework: process.env.MEMORY_FRAMEWORK,
    harness: process.env.MEMORY_HARNESS,
    currentPath: process.env.MEMORY_CURRENT_PATH
  };
  return Object.values(scope).some(Boolean) ? scope : undefined;
}

export function engineeringKindFromEnv(): EngineeringMemoryKind | undefined {
  const value = process.env.MEMORY_ENGINEERING_KIND;
  return value === "repo_policy" || value === "architecture_decision" || value === "review_correction" || value === "tool_outcome" || value === "procedure" || value === "forbidden_action" || value === "migration_note" || value === "test_strategy" || value === "dependency_rule" || value === "generated_file_rule" ? value : undefined;
}

export function searchFiltersFromEnv() {
  const engineeringKind = engineeringKindFromEnv();
  return engineeringKind ? { engineeringKind } : undefined;
}

export function privacyDefaultFromEnv() {
  const value = process.env.MEMORY_PERSONA_PRIVACY;
  return value === "private" || value === "org" || value === "public" ? value : value === "user" ? value : undefined;
}

export function connectorKindFromEnv() {
  const value = process.env.MEMORY_CONNECTOR_KIND;
  return value === "email" || value === "chat" || value === "project_management" || value === "docs" || value === "code" || value === "calendar" || value === "cloud_storage" || value === "custom" ? value : undefined;
}

export function connectorOperationFromEnv() {
  const value = process.env.MEMORY_CONNECTOR_OPERATION;
  return value === "tag" || value === "comment" || value === "status" || value === "summary" || value === "memory_link" ? value : undefined;
}

export function isConnectorFeedbackKind(value: string): value is "accepted_change" | "rejected_suggestion" | "failing_test" | "user_correction" {
  return value === "accepted_change" || value === "rejected_suggestion" || value === "failing_test" || value === "user_correction";
}

export function isConnectorTelemetryKind(value: string): value is "accepted_suggestion" | "rejected_suggestion" | "context_pack_feedback" | "tool_outcome" {
  return value === "accepted_suggestion" || value === "rejected_suggestion" || value === "context_pack_feedback" || value === "tool_outcome";
}

export function mediaTypeFromEnv() {
  const value = process.env.MEMORY_MEDIA_TYPE;
  return value === "text" || value === "code" || value === "document" || value === "audio" || value === "image" || value === "video" ? value : undefined;
}

export function managedPlanFromEnv() {
  const value = process.env.MEMORY_MANAGED_PLAN;
  return value === "developer" || value === "team" || value === "enterprise" ? value : undefined;
}

export function managedTenantStatusFromEnv() {
  const value = process.env.MEMORY_MANAGED_TENANT_STATUS;
  return value === "provisioning" || value === "active" || value === "paused" ? value : undefined;
}

export function privacyComputeDimensionsFromEnv() {
  const values = csvList(process.env.MEMORY_PRIVACY_COMPUTE_DIMENSIONS);
  const dimensions = values.filter((value): value is "entities" | "tags" | "relations" => value === "entities" || value === "tags" || value === "relations");
  return dimensions.length ? dimensions : undefined;
}

export function metadataFromEnv() {
  return process.env.MEMORY_METADATA_JSON ? JSON.parse(process.env.MEMORY_METADATA_JSON) : undefined;
}
