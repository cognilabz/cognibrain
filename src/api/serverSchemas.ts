import { z } from "zod";

export const relationTypeSchema = z.enum([
  "mentions",
  "calls",
  "imports",
  "defines",
  "extends",
  "depends_on",
  "transitive_depends_on",
  "works_for",
  "advisor_of",
  "supersedes",
  "contradicts",
  "confirmed_by",
  "suggested_by",
  "executed_by"
]);

export const memoryInputSchema = z.object({
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  deviceId: z.string().optional(),
  runId: z.string().optional(),
  content: z.string().min(1),
  type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
  layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
  source: z
    .object({
      kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
      uri: z.string().optional(),
      commit: z.string().optional(),
      lineStart: z.number().optional(),
      lineEnd: z.number().optional(),
      confidence: z.number().min(0).max(1)
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  relations: z
    .array(
      z.object({
        type: relationTypeSchema,
        sourceEntity: z.string().optional(),
        targetId: z.string().optional(),
        targetEntity: z.string().optional(),
        direction: z.enum(["out", "in", "undirected"]).optional(),
        confidence: z.number().min(0).max(1).optional(),
        evidence: z.string().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional()
      })
    )
    .optional(),
  consent: z
    .object({
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      allowTraining: z.boolean().optional(),
      retentionUntil: z.string().optional(),
      deleteOnRequest: z.boolean().optional()
    })
    .optional(),
  temporal: z.record(z.unknown()).optional(),
  pinned: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  beliefState: z.enum(["active", "stale", "superseded", "contradicted", "needs_verification", "retracted", "archived"]).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const searchSchema = z.object({
  brainId: z.string().optional(),
  brainIds: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  runId: z.string().optional(),
  scopeMode: z.enum(["user", "session", "app", "org", "project", "all"]).optional(),
  query: z.string().min(1),
  mode: z.enum(["hybrid", "rrf", "graph", "path"]).optional(),
  expandQuery: z.boolean().optional(),
  queryExpansions: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50).optional(),
  includeArchived: z.boolean().optional(),
  includePrivate: z.boolean().optional(),
  includeLinkedIdentities: z.boolean().optional(),
  includeSharedBrains: z.boolean().optional(),
  profileId: z.string().optional(),
  weights: z.record(z.number()).optional(),
  codebaseScope: z.object({
    org: z.string().optional(),
    orgId: z.string().optional(),
    repo: z.string().optional(),
    repository: z.string().optional(),
    branch: z.string().optional(),
    commit: z.string().optional(),
    commitRange: z.string().optional(),
    packageName: z.string().optional(),
    workspace: z.string().optional(),
    directory: z.string().optional(),
    filePattern: z.string().optional(),
    language: z.string().optional(),
    framework: z.string().optional(),
    harness: z.string().optional(),
    currentPath: z.string().optional()
  }).optional(),
  filters: z.object({
    type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
    layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
    tags: z.array(z.string()).optional(),
    minTrust: z.number().optional(),
    engineeringKind: z.enum(["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"]).optional(),
    engineeringKinds: z.array(z.enum(["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"])).optional()
  }).optional(),
  graphDepth: z.number().int().positive().max(8).optional(),
  relationTypes: z.array(relationTypeSchema).optional()
});

export const evidencePackSchema = searchSchema.extend({
  tokenBudget: z.number().int().positive().max(8000).optional()
});

export const contextEnrichmentSchema = evidencePackSchema.extend({
  primaryIssueStore: z.string().optional(),
  primaryKnowledgeStore: z.string().optional(),
  defaultSearchConnectors: z.array(z.string()).optional(),
  fetchReferenced: z.boolean().optional(),
  searchPrimaryStores: z.boolean().optional(),
  persistFetched: z.boolean().optional(),
  maxExternalFetches: z.number().int().nonnegative().max(20).optional(),
  maxExternalResults: z.number().int().positive().max(30).optional()
});

export const harnessActionSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  envRequirements: z.array(z.string()).optional(),
  environmentHints: z.array(z.string()).optional(),
  exitCode: z.number().int().optional(),
  durationMs: z.number().nonnegative().optional(),
  outputSummary: z.string().optional(),
  failureReason: z.string().optional(),
  successReason: z.string().optional(),
  benchmarkScenarioId: z.string().optional(),
  evidencePackId: z.string().optional(),
  filesChanged: z.array(z.string()).optional(),
  filesTouched: z.array(z.string()).optional(),
  tests: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]), output: z.string().optional() })).optional(),
  pullRequest: z.string().optional(),
  errorFixed: z.string().optional(),
  content: z.string().optional(),
  timestamp: z.string().optional()
});

export const codeCorrectionSchema = z.object({
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  content: z.string().min(1),
  previousMemoryId: z.string().optional(),
  previousWrongAction: z.string().optional(),
  correctAction: z.string().optional(),
  kind: z.enum(["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"]).optional(),
  codebase: searchSchema.shape.codebaseScope,
  source: z.object({ kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]), uri: z.string().optional(), commit: z.string().optional(), lineStart: z.number().optional(), lineEnd: z.number().optional(), confidence: z.number() }).optional(),
  timestamp: z.string().optional(),
  evidenceIds: z.array(z.string()).optional()
});

export const actionGuardSchema = z.object({
  userId: z.string().min(1),
  action: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  codebaseScope: searchSchema.shape.codebaseScope
});

export const patchEvidenceSchema = z.object({
  userId: z.string().min(1),
  task: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  codebaseScope: searchSchema.shape.codebaseScope,
  filesChanged: z.array(z.string()).optional(),
  commandsRun: z.array(z.string()).optional(),
  memoryIds: z.array(z.string()).optional()
});

export const graphExportSchema = z.object({
  userId: z.string().optional(),
  relationTypes: z.array(relationTypeSchema).optional(),
  minTrust: z.number().min(0).max(1).optional(),
  sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
  after: z.string().optional(),
  before: z.string().optional(),
  format: z.enum(["json", "graphml"]).optional()
});

export const inferenceRuleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  when: z.object({ left: relationTypeSchema, right: relationTypeSchema }),
  then: relationTypeSchema,
  confidence: z.number().min(0).max(1).optional()
});

export const extractionEventSchema = z.object({
  role: z.enum(["user", "assistant", "tool", "system", "operator"]),
  content: z.string().min(1),
  timestamp: z.string().optional(),
  source: z
    .object({
      kind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
      uri: z.string().optional(),
      commit: z.string().optional(),
      lineStart: z.number().optional(),
      lineEnd: z.number().optional(),
      confidence: z.number().min(0).max(1)
    })
    .optional(),
  mediaType: z.enum(["text", "code", "document", "audio", "image", "video"]).optional(),
  language: z.string().optional(),
  uri: z.string().optional(),
  mimeType: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const extractSchema = z.object({
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  deviceId: z.string().optional(),
  runId: z.string().optional(),
  events: z.array(extractionEventSchema)
});

export const entityMergeSchema = z.object({
  canonical: z.string().min(1),
  aliases: z.array(z.string().min(1)).min(1),
  userId: z.string().optional()
});

export const entityEnrichmentSchema = z.object({
  userId: z.string().min(1),
  entity: z.string().min(1),
  approveExternal: z.boolean().optional(),
  sourceUri: z.string().optional()
});

export const timelineSummarySchema = z.object({
  granularity: z.enum(["hour", "day", "week", "month", "all"]).optional(),
  persist: z.boolean().optional(),
  style: z.enum(["concise", "descriptive", "narrative"]).optional()
});

export const feedbackSchema = z.object({
  memoryId: z.string().min(1),
  userId: z.string().optional(),
  kind: z.enum(["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable", "approve_pattern", "reject_pattern"]),
  note: z.string().optional(),
  timestamp: z.string().optional()
});

export const injectionFeedbackSchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(1),
  injectedMemoryIds: z.array(z.string().min(1)).min(1),
  acceptedMemoryIds: z.array(z.string().min(1)).optional(),
  rejectedMemoryIds: z.array(z.string().min(1)).optional(),
  outcome: z.enum(["helpful", "wrong", "accepted", "rejected"]),
  sessionId: z.string().optional(),
  profileId: z.string().optional(),
  note: z.string().optional(),
  signals: z.record(z.number()).optional(),
  timestamp: z.string().optional()
});

export const trainingSampleSchema = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  selectedMemoryId: z.string().optional(),
  rejectedMemoryIds: z.array(z.string()).optional(),
  profileId: z.string().optional(),
  signals: z.record(z.number()).optional(),
  outcome: z.enum(["helpful", "wrong", "accepted", "rejected"]),
  timestamp: z.string().optional()
});

export const retrievalProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weights: z.record(z.number()),
  scope: z
    .object({
      userId: z.string().optional(),
      projectId: z.string().optional(),
      appId: z.string().optional(),
      orgId: z.string().optional(),
      agentId: z.string().optional()
    })
    .optional(),
  learned: z.boolean().optional(),
  trainingSamples: z.number().optional(),
  benchmarkDelta: z.number().optional(),
  provenance: z.string().optional()
});

export const identityLinkSchema = z.object({
  primaryUserId: z.string().min(1),
  linkedUserId: z.string().min(1),
  consentToken: z.string().min(8),
  consent: z.enum(["user", "org"]).optional()
});

export const brainSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  ownerUserId: z.string().min(1),
  memberUserIds: z.array(z.string()).optional(),
  allowedAgentIds: z.array(z.string()).optional(),
  orgId: z.string().optional(),
  visibility: z.enum(["private", "team", "org", "public"]),
  consentRequired: z.boolean().optional()
});

export const sourceSchema = z.object({
  id: z.string().optional(),
  brainId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["manual", "chat", "code", "docs", "calendar", "connector", "import"]),
  uri: z.string().optional(),
  defaultConsent: z.record(z.unknown()).optional()
});

export const agentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  namespace: z.string().min(1),
  brainIds: z.array(z.string()),
  permissions: z.array(z.enum(["read", "write", "share", "admin"])),
  personaId: z.string().optional(),
  subscriptions: z
    .object({
      events: z.array(z.lazy(() => auditTypeSchema)).optional(),
      brainIds: z.array(z.string()).optional(),
      sourceIds: z.array(z.string()).optional()
    })
    .optional()
});

export const personaSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summaryStyle: z.enum(["concise", "descriptive", "narrative"]),
  retrievalWeights: z.record(z.number()).optional(),
  privacyDefault: z.enum(["private", "user", "org", "public"]).optional(),
  domain: z.string().optional()
});

export const webhookSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  events: z.array(z.enum(["memory.write", "memory.update", "memory.delete", "memory.share", "memory.share.request", "memory.share.revoke", "memory.revert", "memory.consent", "agent.register", "persona.set", "connector.register", "connector.auth", "connector.sync", "provider.call", "extract.run", "reflect.run", "search.run", "sync.queue", "sync.run", "webhook.register", "marketplace.submit", "marketplace.scan", "marketplace.review", "marketplace.publish", "marketplace.install", "managed.tenant", "privacy.compute", "inference.run", "entity.merge", "entity.split", "policy.violation", "retention.enforce", "security.key.rotate", "privacy.insights"])),
  secretRef: z.string().optional()
});

export const marketplaceModuleSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["connector", "domain", "persona", "retrieval_profile"]),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string(),
  installState: z.enum(["available", "installed"]).optional(),
  signature: z
    .object({
      signer: z.string().min(1),
      algorithm: z.enum(["sha256", "ed25519"]),
      digest: z.string().min(1),
      status: z.enum(["verified", "invalid", "unverified"]).optional(),
      verifiedAt: z.string().optional()
    })
    .optional(),
  compatibility: z
    .object({
      minCognibrainVersion: z.string().optional(),
      maxCognibrainVersion: z.string().optional(),
      engines: z.array(z.string()).optional()
    })
    .optional(),
  security: z
    .object({
      scannedAt: z.string(),
      status: z.enum(["passed", "warning", "blocked"]),
      permissions: z.array(z.string()),
      risks: z.array(z.string())
    })
    .optional(),
  manifest: z.record(z.unknown()),
  trustSignals: z.record(z.unknown()).optional()
});

export const marketplaceSubmissionSchema = z.object({
  module: marketplaceModuleSchema,
  submitter: z.string().min(1),
  sourceUrl: z.string().url().optional()
});

export const marketplaceReviewSchema = z.object({
  reviewer: z.string().min(1),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  approve: z.boolean().optional(),
  requestChanges: z.boolean().optional(),
  reject: z.boolean().optional()
});

export const migrationExportSchema = z.object({
  target: z.enum(["self_hosted", "managed", "backup"]).optional(),
  backupRef: z.string().optional(),
  ssoProvider: z.string().optional(),
  secretManager: z.string().optional()
});

export const migrationImportSchema = z.object({
  generatedAt: z.union([z.string(), z.date()]),
  target: z.enum(["self_hosted", "managed", "backup"]),
  counts: z.record(z.number()),
  backup: z.record(z.unknown()),
  placeholders: z.record(z.unknown()),
  deployment: z.record(z.unknown()).optional(),
  manifest: z.record(z.unknown())
}).passthrough();

export const managedTenantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  orgId: z.string().min(1),
  plan: z.enum(["developer", "team", "enterprise"]).optional(),
  region: z.string().optional(),
  status: z.enum(["provisioning", "active", "paused"]).optional(),
  ssoProvider: z.string().optional(),
  secretManager: z.string().optional(),
  dataResidency: z.string().optional(),
  autoscaling: z.object({
    minReplicas: z.number().int().min(0),
    maxReplicas: z.number().int().min(1),
    targetCpuUtilization: z.number().min(1).max(100)
  }).optional(),
  backup: z.object({
    enabled: z.boolean(),
    backupRef: z.string().optional(),
    lastVerifiedAt: z.union([z.string(), z.date()]).optional()
  }).optional()
});

export const crossBrainPrivacyComputeSchema = z.object({
  brainIds: z.array(z.string().min(1)).min(2),
  salt: z.string().optional(),
  minK: z.number().int().min(2).optional(),
  dimensions: z.array(z.enum(["entities", "tags", "relations"])).optional()
});

export const connectorManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage", "custom"]),
  version: z.string().min(1),
  direction: z.enum(["ingest", "export", "two_way"]),
  capabilities: z.array(z.enum(["ingest", "export", "webhook", "poll", "writeback", "media", "translation"])).min(1),
  auth: z.enum(["none", "api_key", "oauth", "token"]),
  defaultSourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]),
  metadataMapping: z.record(z.string()),
  privacyPolicy: z.enum(["personal", "project", "team", "never_store"]).optional(),
  list: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["GET", "POST"]).optional(),
      authRef: z.string().optional()
    })
    .optional(),
  poll: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["GET", "POST"]).optional(),
      authRef: z.string().optional()
    })
    .optional(),
  writeback: z
    .object({
      endpoint: z.string().url().optional(),
      method: z.enum(["POST", "PUT", "PATCH"]).optional(),
      authRef: z.string().optional(),
      operations: z.array(z.enum(["tag", "comment", "status", "summary", "memory_link"])).optional()
    })
    .optional(),
  oauth: z
    .object({
      authorizeUrl: z.string().url(),
      tokenUrl: z.string().url().optional(),
      clientIdRef: z.string().optional(),
      scopes: z.array(z.string()).optional(),
      redirectUri: z.string().url().optional()
    })
    .optional()
});

export const connectorOAuthBeginSchema = z.object({
  connectorId: z.string().min(1),
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  stateSalt: z.string().optional()
});

export const connectorOAuthCallbackSchema = z.object({
  connectorId: z.string().min(1),
  state: z.string().min(1),
  code: z.string().optional(),
  tokenRef: z.string().optional(),
  error: z.string().optional()
});

export const connectorOAuthRevokeSchema = z.object({
  connectorId: z.string().min(1),
  actorId: z.string().optional()
});

export const connectorSyncSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
  events: z.array(
    z.object({
      role: z.enum(["user", "assistant", "tool", "system", "operator"]),
      content: z.string().min(1),
      externalId: z.string().optional(),
      timestamp: z.string().optional(),
      mediaType: z.enum(["text", "code", "document", "audio", "image", "video"]).optional(),
      language: z.string().optional(),
      uri: z.string().optional(),
      mimeType: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    })
  )
});

export const connectorWritebackSchema = z.object({
  connectorId: z.string().min(1),
  operation: z.enum(["tag", "comment", "status", "summary", "memory_link"]).optional(),
  memoryIds: z.array(z.string()).optional(),
  externalId: z.string().optional(),
  content: z.string().optional(),
  target: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional()
});

export const connectorFeedbackSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  kind: z.enum(["accepted_change", "rejected_suggestion", "failing_test", "user_correction"]),
  content: z.string().min(1),
  memoryIds: z.array(z.string()).optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const connectorTelemetrySchema = z.object({
  connectorId: z.string().min(1),
  harnessId: z.string().optional(),
  userId: z.string().min(1),
  kind: z.enum(["accepted_suggestion", "rejected_suggestion", "context_pack_feedback", "tool_outcome"]),
  content: z.string().optional(),
  query: z.string().optional(),
  memoryIds: z.array(z.string()).optional(),
  acceptedMemoryIds: z.array(z.string()).optional(),
  rejectedMemoryIds: z.array(z.string()).optional(),
  command: z.string().optional(),
  filesTouched: z.array(z.string()).optional(),
  filesChanged: z.array(z.string()).optional(),
  tests: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]), output: z.string().optional() })).optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const connectorPollSchema = z.object({
  connectorId: z.string().min(1),
  userId: z.string().min(1),
  brainId: z.string().optional(),
  sourceId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
  appId: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional()
});

export const auditTypeSchema = z.enum(["memory.write", "memory.update", "memory.delete", "memory.share", "memory.share.request", "memory.share.revoke", "memory.revert", "memory.consent", "agent.register", "persona.set", "connector.register", "connector.auth", "connector.sync", "provider.call", "extract.run", "reflect.run", "search.run", "sync.queue", "sync.run", "webhook.register", "marketplace.submit", "marketplace.scan", "marketplace.review", "marketplace.publish", "marketplace.install", "managed.tenant", "inference.run", "entity.merge", "entity.split", "policy.violation", "retention.enforce", "security.key.rotate", "privacy.insights", "privacy.compute"]);

export const policyRuleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  effect: z.enum(["allow", "deny"]),
  operations: z.array(z.enum(["write", "retrieve", "dream", "export", "delete", "all"])).min(1),
  scope: z
    .object({
      userId: z.string().optional(),
      orgId: z.string().optional(),
      brainId: z.string().optional(),
      sourceId: z.string().optional(),
      sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
      tag: z.string().optional(),
      memoryType: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
      connectorId: z.string().optional(),
      visibility: z.enum(["private", "user", "org", "public"]).optional()
    })
    .optional(),
  priority: z.number().optional(),
  reason: z.string().optional()
});

export const retentionRuleSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  retentionDays: z.number().min(0),
  action: z.enum(["archive", "delete"]),
  scope: z
    .object({
      userId: z.string().optional(),
      brainId: z.string().optional(),
      sourceId: z.string().optional(),
      sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      entity: z.string().optional(),
      relationType: relationTypeSchema.optional(),
      tag: z.string().optional()
    })
    .optional()
});

export const keyRotationSchema = z.object({
  keyId: z.string().min(1),
  keyVersion: z.string().min(1),
  backupRef: z.string().optional(),
  actorId: z.string().optional()
});

export const offlineOperationSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["add", "update", "delete", "consent"]),
  userId: z.string().min(1),
  memoryId: z.string().optional(),
  clientMutationId: z.string().optional(),
  occurredAt: z.string().optional(),
  input: memoryInputSchema.optional(),
  patch: memoryInputSchema.partial().optional(),
  consent: z
    .object({
      visibility: z.enum(["private", "user", "org", "public"]).optional(),
      allowTraining: z.boolean().optional(),
      retentionUntil: z.string().optional(),
      deleteOnRequest: z.boolean().optional()
    })
    .optional()
});
