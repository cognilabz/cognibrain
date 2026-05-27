import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { createMemoryToolHandlers, jsonText } from "./mcpHandlers";

export function registerMemoryMcpTools(server: McpServer, service: Parameters<typeof createMemoryToolHandlers>[0]): void {
  const handlers = createMemoryToolHandlers(service);
  const engineeringKindSchema = z.enum(["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"]);
  const codebaseScopeSchema = z.object({
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
  });
  const dreamTriggerSchema = z.enum(["manual_reflect", "manual_dream", "auto_write_threshold", "auto_interval", "harness_session_end", "harness_handoff", "before_release", "after_connector_sync", "after_negative_feedback", "after_contradiction_detected"]);
  const dreamModeSchema = z.enum(["reflect", "dream"]);
  const dreamBudgetSchema = z.enum(["quick", "standard", "deep", "release"]);
  const dreamScopeSchema = z.object({
    kind: z.enum(["session", "repo", "branch", "project", "connector", "user", "org"]).optional(),
    sessionId: z.string().optional(),
    projectId: z.string().optional(),
    orgId: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().optional(),
    connectorId: z.string().optional()
  });
  const dreamCycleInputSchema = {
    userId: z.string().min(1),
    trigger: dreamTriggerSchema.optional(),
    mode: dreamModeSchema.optional(),
    scope: dreamScopeSchema.optional(),
    budget: dreamBudgetSchema.optional(),
    sourceRefresh: z.boolean().optional(),
    connectorIds: z.array(z.string()).optional(),
    harnessRunId: z.string().optional(),
    force: z.boolean().optional()
  };
  const dreamPrepareInputSchema = {
    ...dreamCycleInputSchema,
    run: z.boolean().optional()
  };
  const dreamJobInputSchema = {
    ...dreamCycleInputSchema,
    jobId: z.string().optional()
  };
  const revalidateInputSchema = {
    userId: z.string().min(1),
    memoryId: z.string().optional(),
    connectorIds: z.array(z.string()).optional(),
    limit: z.number().int().positive().max(500).optional()
  };
  const connectorSyncStateInputSchema = {
    connectorId: z.string().optional()
  };
  const conflictListInputSchema = {
    status: z.enum(["open", "resolved", "operator_review"]).optional()
  };
  const conflictResolveInputSchema = {
    conflictSetId: z.string().min(1),
    selectedClaimId: z.string().min(1),
    reason: z.string().min(1),
    resolvedBy: z.enum(["system", "operator", "source_revalidation"]).optional()
  };
  const connectorReviewQueueInputSchema = {
    connectorId: z.string().optional(),
    userId: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional()
  };
  const connectorReviewDecisionInputSchema = {
    memoryId: z.string().min(1),
    decision: z.enum(["approve", "reject"]),
    reviewerId: z.string().optional(),
    reason: z.string().optional()
  };
  const harnessLifecycleEventSchema = {
    userId: z.string().min(1),
    event: z.enum(["session_started", "context_injected", "tool_called", "tool_failed", "tool_succeeded", "user_corrected", "patch_created", "tests_failed", "tests_passed", "session_ended", "handoff", "release_candidate"]),
    agentId: z.string().optional(),
    sessionId: z.string().optional(),
    appId: z.string().optional(),
    orgId: z.string().optional(),
    projectId: z.string().optional(),
    harnessRunId: z.string().optional(),
    content: z.string().optional(),
    command: z.string().optional(),
    cwd: z.string().optional(),
    exitCode: z.number().int().optional(),
    durationMs: z.number().nonnegative().optional(),
    outputSummary: z.string().optional(),
    failureReason: z.string().optional(),
    successReason: z.string().optional(),
    filesChanged: z.array(z.string()).optional(),
    filesTouched: z.array(z.string()).optional(),
    tests: z.array(z.object({ name: z.string(), status: z.enum(["passed", "failed", "skipped"]), output: z.string().optional() })).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().optional(),
    runDream: z.boolean().optional(),
    forceDream: z.boolean().optional(),
    budget: dreamBudgetSchema.optional(),
    sourceRefresh: z.boolean().optional(),
    connectorIds: z.array(z.string()).optional()
  };

  server.registerTool(
    "memory_add",
    {
      title: "Add Memory",
      description: "Store a durable memory with provenance, tags, entities, and optional harness scope.",
      inputSchema: {
        userId: z.string().min(1),
        content: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        type: z.enum(["user", "feedback", "project", "reference", "episodic", "procedural"]).optional(),
        layer: z.enum(["working", "episodic", "long_term", "procedural", "reflection"]).optional(),
        sourceKind: z.enum(["human", "reviewed_code", "tool", "agent", "transcript", "import"]).optional(),
        sourceConfidence: z.number().min(0).max(1).optional(),
        tags: z.array(z.string()).optional(),
        entities: z.array(z.string()).optional(),
        pinned: z.boolean().optional(),
        metadata: z.record(z.string(), z.unknown()).optional()
      }
    },
    async (args) => jsonText(handlers.add(args))
  );

  server.registerTool(
    "memory_search",
    {
      title: "Search Memories",
      description: "Retrieve ranked memories using semantic, keyword, entity, temporal, trust, and graph signals.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional()
      }
    },
    async (args) => jsonText(handlers.search(args))
  );

  server.registerTool(
    "memory_context_pack",
    {
      title: "Build Context Pack",
      description: "Retrieve memories and format them into a compact context block for a coding agent prompt.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional(),
        tokenBudget: z.number().int().positive().max(8000).optional()
      }
    },
    async (args) => jsonText(handlers.contextPack(args))
  );

  server.registerTool(
    "memory_evidence_pack",
    {
      title: "Export Evidence Pack",
      description: "Return a persisted evidence pack by contextPackId, or create one from a query with source, policy, temporal, and graph evidence.",
      inputSchema: {
        contextPackId: z.string().optional(),
        userId: z.string().min(1).optional(),
        query: z.string().min(1).optional(),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional(),
        tokenBudget: z.number().int().positive().max(8000).optional()
      }
    },
    async (args) => jsonText(handlers.evidencePack(args))
  );

  server.registerTool(
    "memory_coding_context_pack",
    {
      title: "Build Coding Context Pack",
      description: "Build an evidence-grade context pack specialized for coding agents, with repo policies, corrections, procedures, tool outcomes, architecture decisions, and stale-rule exclusions.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional(),
        tokenBudget: z.number().int().positive().max(8000).optional(),
        codebaseScope: codebaseScopeSchema.optional()
      }
    },
    async (args) => jsonText(handlers.codingContextPack(args))
  );

  server.registerTool(
    "memory_code_correction",
    {
      title: "Record Code Correction",
      description: "Store a user or review correction as engineering memory, link the previous wrong action, and supersede the stale belief.",
      inputSchema: {
        userId: z.string().min(1),
        content: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        previousMemoryId: z.string().optional(),
        previousWrongAction: z.string().optional(),
        correctAction: z.string().optional(),
        kind: engineeringKindSchema.optional(),
        codebase: codebaseScopeSchema.optional(),
        evidenceIds: z.array(z.string()).optional()
      }
    },
    async (args) => jsonText(handlers.codeCorrection(args))
  );

  server.registerTool(
    "memory_action_guard",
    {
      title: "Guard Coding Action",
      description: "Check engineering memory before a tool call or edit and block or warn on known forbidden actions.",
      inputSchema: {
        userId: z.string().min(1),
        action: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        codebaseScope: codebaseScopeSchema.optional()
      }
    },
    async (args) => jsonText(handlers.actionGuard(args))
  );

  server.registerTool(
    "memory_patch_evidence",
    {
      title: "Build Patch Evidence Trail",
      description: "Return the memories, corrections, procedures, tool outcomes, graph paths, and excluded stale rules used for a patch.",
      inputSchema: {
        userId: z.string().min(1),
        task: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        codebaseScope: codebaseScopeSchema.optional(),
        filesChanged: z.array(z.string()).optional(),
        commandsRun: z.array(z.string()).optional(),
        memoryIds: z.array(z.string()).optional()
      }
    },
    async (args) => jsonText(handlers.patchEvidence(args))
  );

  server.registerTool(
    "memory_policy_check",
    {
      title: "Check Memory Policy",
      description: "Evaluate whether an actor may write, retrieve, dream, export, delete, or otherwise use a memory.",
      inputSchema: {
        operation: z.enum(["write", "retrieve", "dream", "export", "delete", "all"]),
        memoryId: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
        actor: z.record(z.string(), z.unknown()).optional()
      }
    },
    async (args) => jsonText(handlers.policyCheck(args))
  );

  server.registerTool(
    "memory_retention_review",
    {
      title: "Review Retention",
      description: "Preview memories and ground-truth episodes affected by retention rules before enforcement.",
      inputSchema: {
        userId: z.string().optional(),
        now: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.retentionReview(args))
  );

  server.registerTool(
    "memory_verify_claim",
    {
      title: "Verify Claim",
      description: "Check whether a claim is supported, contradicted, or missing evidence, returning citations and policy decisions.",
      inputSchema: {
        userId: z.string().min(1),
        claim: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional(),
        tokenBudget: z.number().int().positive().max(8000).optional()
      }
    },
    async (args) => jsonText(handlers.verifyClaim(args))
  );

  server.registerTool(
    "memory_graph_path",
    {
      title: "Find Memory Graph Path",
      description: "Find citation-rich graph paths between two entities or memories.",
      inputSchema: {
        from: z.string().min(1),
        to: z.string().min(1),
        userId: z.string().optional(),
        maxDepth: z.number().int().positive().max(8).optional(),
        limit: z.number().int().positive().max(20).optional(),
        validAt: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.graphPath(args))
  );

  server.registerTool(
    "memory_graph_query",
    {
      title: "Query Memory Graph",
      description: "Run the safe memory graph query surface with policy-aware filtering.",
      inputSchema: {
        query: z.string().min(1),
        userId: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.graphQuery(args))
  );

  server.registerTool(
    "memory_graph_activation",
    {
      title: "Activate Memory Graph",
      description: "Run spreading activation over the memory graph for a query.",
      inputSchema: {
        query: z.string().min(1),
        userId: z.string().optional(),
        maxDepth: z.number().int().positive().max(8).optional(),
        limit: z.number().int().positive().max(50).optional(),
        validAt: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.graphActivation(args))
  );

  server.registerTool(
    "memory_graph_activate",
    {
      title: "Activate Memory Graph",
      description: "Alias for memory_graph_activation matching the Memory OS tool contract.",
      inputSchema: {
        query: z.string().min(1),
        userId: z.string().optional(),
        maxDepth: z.number().int().positive().max(8).optional(),
        limit: z.number().int().positive().max(50).optional(),
        validAt: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.graphActivation(args))
  );

  server.registerTool(
    "memory_explain_connection",
    {
      title: "Explain Memory Connection",
      description: "Explain why two entities or memories are connected, including graph paths and evidence.",
      inputSchema: {
        from: z.string().min(1),
        to: z.string().min(1),
        userId: z.string().optional(),
        maxDepth: z.number().int().positive().max(8).optional(),
        limit: z.number().int().positive().max(20).optional(),
        validAt: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.explainConnection(args))
  );

  server.registerTool(
    "memory_procedure_recall",
    {
      title: "Recall Procedures",
      description: "Retrieve procedural memories that should guide an agent before a tool call or workflow.",
      inputSchema: {
        userId: z.string().min(1),
        query: z.string().min(1),
        agentId: z.string().optional(),
        sessionId: z.string().optional(),
        appId: z.string().optional(),
        orgId: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().positive().max(50).optional(),
        includeArchived: z.boolean().optional()
      }
    },
    async (args) => jsonText(handlers.procedureRecall(args))
  );

  server.registerTool(
    "memory_action_record",
    {
      title: "Record Agent Action",
      description: "Store a harness action memory with command, files, tests, PR, and fix evidence.",
      inputSchema: {
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
      }
    },
    async (args) => jsonText(handlers.actionRecord(args))
  );

  server.registerTool(
    "memory_action_outcome",
    {
      title: "Record Agent Action Outcome",
      description: "Store the outcome of a harness action so repeated failures and successes can become patterns.",
      inputSchema: {
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
      }
    },
    async (args) => jsonText(handlers.actionOutcome(args))
  );

  server.registerTool(
    "memory_list",
    {
      title: "List Memories",
      description: "List recent memories for a user or all users.",
      inputSchema: {
        userId: z.string().optional(),
        limit: z.number().int().positive().max(200).optional()
      }
    },
    async (args) => jsonText(handlers.list(args))
  );

  server.registerTool(
    "memory_reflect",
    {
      title: "Reflect Memories",
      description: "Run reflection to summarize repeated themes, demote contradictions, fade stale memories, and report lifecycle quality.",
      inputSchema: {
        userId: z.string().min(1)
      }
    },
    async (args) => jsonText(handlers.reflect(args))
  );

  server.registerTool(
    "memory_dream",
    {
      title: "Dream Memory Lifecycle",
      description: "Run the full maintenance cycle: rethink, reevaluate, summarize, fade, reflect, and reorganize memories.",
      inputSchema: {
        userId: z.string().min(1)
      }
    },
    async (args) => jsonText(handlers.dream(args))
  );

  server.registerTool(
    "memory_dream_plan",
    {
      title: "Plan Dream Cycle",
      description: "Preview whether a dream cycle is due, why, and which connector or verification actions are recommended.",
      inputSchema: dreamCycleInputSchema
    },
    async (args) => jsonText(handlers.dreamPlan(args))
  );

  server.registerTool(
    "memory_dream_due",
    {
      title: "Check Dream Due",
      description: "Check automatic and lifecycle signals without running reflection or changing memories.",
      inputSchema: dreamCycleInputSchema
    },
    async (args) => jsonText(handlers.dreamDue(args))
  );

  server.registerTool(
    "memory_dream_run",
    {
      title: "Run Scoped Dream Cycle",
      description: "Run the shared DreamCycle orchestrator with an explicit trigger, mode, scope, budget, and source-refresh intent.",
      inputSchema: dreamCycleInputSchema
    },
    async (args) => jsonText(await handlers.dreamRun(args))
  );

  server.registerTool(
    "memory_dream_job_start",
    {
      title: "Start Dream Job",
      description: "Run a DreamCycle through the job-status surface and return progress, report, and final status.",
      inputSchema: dreamJobInputSchema
    },
    async (args) => jsonText(await handlers.dreamJobStart(args))
  );

  server.registerTool(
    "memory_dream_job_status",
    {
      title: "Dream Job Status",
      description: "Return dream job status and progress for one job or recent jobs.",
      inputSchema: { jobId: z.string().optional() }
    },
    async (args) => jsonText(handlers.dreamJobStatus(args))
  );

  server.registerTool(
    "memory_dream_job_cancel",
    {
      title: "Cancel Dream Job",
      description: "Cancel a queued or running dream job and persist the operator-visible cancellation state.",
      inputSchema: { jobId: z.string().min(1), reason: z.string().optional() }
    },
    async (args) => jsonText(handlers.dreamJobCancel(args))
  );

  server.registerTool(
    "memory_dream_job_retry",
    {
      title: "Retry Dream Job",
      description: "Retry a failed or cancelled dream job using the original trigger, mode, budget, source-refresh and connector scope.",
      inputSchema: { jobId: z.string().min(1) }
    },
    async (args) => jsonText(await handlers.dreamJobRetry(args))
  );

  server.registerTool(
    "memory_session_end",
    {
      title: "Prepare Session End",
      description: "Create a harness session-end dream plan, optionally running it when due or forced.",
      inputSchema: dreamPrepareInputSchema
    },
    async (args) => jsonText(handlers.sessionEnd(args))
  );

  server.registerTool(
    "memory_handoff_prepare",
    {
      title: "Prepare Handoff",
      description: "Create a handoff dream plan with source-refresh recommendations, optionally running it when due or forced.",
      inputSchema: dreamPrepareInputSchema
    },
    async (args) => jsonText(handlers.handoffPrepare(args))
  );

  server.registerTool(
    "memory_release_prepare",
    {
      title: "Prepare Release",
      description: "Create a release dream plan with release-budget verification recommendations, optionally running it when due or forced.",
      inputSchema: dreamPrepareInputSchema
    },
    async (args) => jsonText(handlers.releasePrepare(args))
  );

  server.registerTool(
    "memory_source_revalidate",
    {
      title: "Revalidate SourceRefs",
      description: "Revalidate source-backed memories against current connector-ingested evidence and sync records.",
      inputSchema: revalidateInputSchema
    },
    async (args) => jsonText(handlers.revalidateSourceRefs(args))
  );

  server.registerTool(
    "memory_connector_sync_state",
    {
      title: "Connector Sync State",
      description: "Show per-connector cursor, last poll, version, etag, and sync status derived from sync records.",
      inputSchema: connectorSyncStateInputSchema
    },
    async (args) => jsonText(handlers.connectorSyncState(args))
  );

  server.registerTool(
    "memory_conflict_sets",
    {
      title: "List Truth Conflict Sets",
      description: "List claim-level truth conflicts that need system or operator resolution.",
      inputSchema: conflictListInputSchema
    },
    async (args) => jsonText(handlers.conflictSets(args))
  );

  server.registerTool(
    "memory_conflict_resolve",
    {
      title: "Resolve Truth Conflict",
      description: "Resolve a claim conflict set by selecting the current truth claim with an auditable reason.",
      inputSchema: conflictResolveInputSchema
    },
    async (args) => jsonText(handlers.conflictResolve(args))
  );

  server.registerTool(
    "memory_connector_review_queue",
    {
      title: "Connector Review Queue",
      description: "List connector-ingested memory candidates awaiting operator approval or rejection.",
      inputSchema: connectorReviewQueueInputSchema
    },
    async (args) => jsonText(handlers.connectorReviewQueue(args))
  );

  server.registerTool(
    "memory_connector_review_decide",
    {
      title: "Review Connector Memory",
      description: "Approve or reject a connector-ingested memory candidate from the review queue.",
      inputSchema: connectorReviewDecisionInputSchema
    },
    async (args) => jsonText(handlers.connectorReviewDecision(args))
  );

  server.registerTool(
    "memory_verification_resolve",
    {
      title: "Resolve Verification Queue",
      description: "Actively resolve due verification items through sourceRef revalidation where possible.",
      inputSchema: revalidateInputSchema
    },
    async (args) => jsonText(handlers.resolveVerification(args))
  );

  server.registerTool(
    "memory_harness_event",
    {
      title: "Record Harness Lifecycle Event",
      description: "Record a harness lifecycle event and return the matching dream plan or optional dream run.",
      inputSchema: harnessLifecycleEventSchema
    },
    async (args) => jsonText(handlers.harnessEvent(args))
  );

  server.registerTool(
    "memory_health",
    {
      title: "Memory Health",
      description: "Return memory health metrics including freshness, average trust, coverage, and contradictions.",
      inputSchema: {
        userId: z.string().optional()
      }
    },
    async (args) => jsonText(handlers.health(args))
  );

  server.registerTool(
    "memory_maintenance_status",
    {
      title: "Memory Maintenance Status",
      description: "Show automatic dream-cycle policy and per-user maintenance counters.",
      inputSchema: {}
    },
    async () => jsonText(handlers.maintenance())
  );

  server.registerPrompt(
    "memory_usage_policy",
    {
      title: "Memory Usage Policy",
      description: "A harness prompt snippet describing when to search, verify, store, and reflect memories.",
      argsSchema: {
        userId: z.string().optional()
      }
    },
    ({ userId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Use cognibrain for${userId ? ` user ${userId}` : " the current user"}.`,
              "Before long-running coding tasks, call memory_search or memory_context_pack with the task.",
              "Treat returned memories as evidence, not authority; verify drift-prone facts against current files or source systems.",
              "After durable discoveries, user corrections, benchmark results, or connector setup decisions, call memory_add with source metadata.",
              "Call memory_dream_plan or memory_dream_due before expensive lifecycle work; use memory_session_end, memory_handoff_prepare, or memory_release_prepare for harness lifecycle events.",
              "Use memory_harness_event for session/tool/test/handoff/release events, memory_source_revalidate for sourceRef checks, and memory_verification_resolve to actively process due verification items.",
              "Run memory_reflect after large sessions or when contradictions appear. Run memory_dream or memory_dream_run for a full maintenance cycle before handoff or release.",
              "Use memory_maintenance_status to confirm whether automatic dreaming is enabled for the local backend."
            ].join("\n")
          }
        }
      ]
    })
  );
}
