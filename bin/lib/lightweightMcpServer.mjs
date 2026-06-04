import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { sanitizedRuntimeEnv } from "./runtimeEnv.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const runtimeRoot = resolve(process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd());
const jsonObjectSchema = { type: "object", additionalProperties: true };

const tools = [
  tool("memory_add", "Add Memory", "Store a durable memory with provenance, tags, entities, and optional harness scope.", "memory.add"),
  tool("memory_search", "Search Memories", "Retrieve ranked memories.", "memory.search", (args) => ({ ...args, limit: args.limit ?? 8 })),
  tool("memory_context_pack", "Build Context Pack", "Build a compact context block from evidence.", "memory.evidencePack", (args) => ({ ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 }), contextPackResult),
  tool("memory_evidence_pack", "Export Evidence Pack", "Return or build an evidence pack.", undefined, evidencePackInput),
  tool("memory_coding_context_pack", "Build Coding Context Pack", "Build an evidence-grade coding context pack.", "memory.codingContextPack", (args) => ({ ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 })),
  tool("memory_code_correction", "Record Code Correction", "Record a reviewer or user correction for coding behavior.", "memory.codeCorrection"),
  tool("memory_action_guard", "Check Action Guard", "Check whether a shell command or edit should proceed.", "memory.actionGuard"),
  tool("memory_patch_evidence", "Write Patch Evidence", "Write patch evidence for a completed code change.", "memory.patchEvidence"),
  tool("memory_policy_check", "Evaluate Policy", "Evaluate memory policy for a proposed operation.", "policy.evaluate"),
  tool("memory_retention_review", "Retention Review", "Review memory retention state.", "retention.review"),
  tool("memory_verify_claim", "Verify Claim", "Build evidence for or against a claim.", "memory.evidencePack", verifyClaimInput, verifyClaimResult),
  tool("memory_graph_path", "Graph Path", "Find graph paths between two entities.", "graph.paths"),
  tool("memory_graph_query", "Graph Query", "Run a graph query.", "graph.query"),
  tool("memory_graph_activation", "Graph Activation", "Run graph activation from a query.", "graph.activation"),
  tool("memory_graph_activate", "Graph Activation", "Alias for memory_graph_activation.", "graph.activation"),
  tool("memory_explain_connection", "Explain Connection", "Explain graph paths between two entities.", "graph.explain"),
  tool("memory_procedure_recall", "Procedure Recall", "Recall procedural memories for a task.", "memory.search", (args) => ({ ...args, limit: args.limit ?? 5, filters: { type: "procedural" } })),
  tool("memory_action_record", "Record Action", "Record a harness action or command outcome.", "memory.actionRecord"),
  tool("memory_action_outcome", "Record Action Outcome", "Alias for recording a harness action outcome.", "memory.actionRecord"),
  tool("memory_list", "List Memories", "List memories for a user.", "memory.list", (args) => args),
  tool("memory_reflect", "Reflect Memories", "Run a reflection pass.", "dream.reflect"),
  tool("memory_dream", "Run Dream", "Run the legacy dream cycle.", "dream.runLegacy"),
  tool("memory_dream_plan", "Dream Plan", "Plan whether a dream cycle should run.", "dream.plan", dreamCycleInput),
  tool("memory_dream_due", "Dream Due", "Check due dream work.", "dream.plan", (args) => dreamCycleInput({ ...args, trigger: args.trigger ?? "auto_interval" })),
  tool("memory_dream_run", "Run Dream Cycle", "Run a dream cycle.", "dream.run", (args) => dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" })),
  tool("memory_dream_job_start", "Start Dream Job", "Start a durable dream job.", "dream.jobStart", (args) => dreamCycleInput({ ...args, mode: args.mode ?? "dream", trigger: args.trigger ?? "manual_dream" })),
  tool("memory_dream_job_status", "Dream Job Status", "Inspect durable dream jobs.", "dream.jobStatus"),
  tool("memory_dream_job_cancel", "Cancel Dream Job", "Cancel a durable dream job.", "dream.jobCancel"),
  tool("memory_dream_job_retry", "Retry Dream Job", "Retry a durable dream job.", "dream.jobRetry"),
  tool("memory_session_end", "Session End", "Prepare dream work after a harness session ends.", "dream.prepare", (args) => dreamCycleInput({ ...args, trigger: "harness_session_end", mode: args.mode ?? "dream" })),
  tool("memory_handoff_prepare", "Handoff Prepare", "Prepare dream work for handoff.", "dream.prepare", (args) => dreamCycleInput({ ...args, trigger: "harness_handoff", mode: args.mode ?? "dream", sourceRefresh: args.sourceRefresh ?? true })),
  tool("memory_release_prepare", "Release Prepare", "Prepare release-grade dream work.", "dream.prepare", (args) => dreamCycleInput({ ...args, trigger: "before_release", mode: args.mode ?? "dream", budget: args.budget ?? "release", sourceRefresh: args.sourceRefresh ?? true })),
  tool("memory_source_revalidate", "Revalidate Sources", "Revalidate memories against source references.", "source.revalidate"),
  tool("memory_connector_sync_state", "Connector Sync State", "Inspect connector sync state.", "connector.syncState"),
  tool("memory_conflict_sets", "Conflict Sets", "List truth conflict sets.", "truth.conflictSets"),
  tool("memory_conflict_resolve", "Resolve Conflict", "Resolve a truth conflict set.", "truth.conflictResolve"),
  tool("memory_connector_review_queue", "Connector Review Queue", "List connector review queue items.", "connector.reviewQueue"),
  tool("memory_connector_review_decide", "Connector Review Decision", "Approve or reject a connector memory.", "connector.reviewDecision"),
  tool("memory_verification_resolve", "Resolve Verification", "Resolve queued source verification.", "verification.resolve"),
  tool("memory_harness_event", "Harness Event", "Record a harness lifecycle event.", "harness.event"),
  tool("memory_health", "Memory Health", "Inspect memory health.", "health"),
  tool("memory_maintenance_status", "Maintenance Status", "Inspect dream maintenance status.", "maintenance.status")
];

const toolsByName = new Map(tools.map((item) => [item.name, item]));

export async function runLightweightMcpServer() {
  const server = new Server(
    { name: "cognibrain", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ handler: _handler, transform: _transform, result: _result, operation: _operation, ...item }) => item)
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const item = toolsByName.get(name);
    if (!item) return toolError(`Unknown tool: ${name}`);
    try {
      const args = request.params.arguments ?? {};
      const payload = item.handler
        ? await item.handler(args)
        : await callOperation(item.operation, item.transform ? item.transform(args) : args);
      const result = item.result ? await item.result(args, payload) : payload;
      return jsonText(result);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  });

  await server.connect(new StdioServerTransport());
}

function tool(name, title, description, operation, transform, result) {
  return {
    name,
    title,
    description,
    inputSchema: jsonObjectSchema,
    annotations: memoryToolAnnotations(name),
    operation,
    transform,
    result
  };
}

async function evidencePackInput(args) {
  if (args.contextPackId) return callOperation("memory.evidencePack.get", { contextPackId: args.contextPackId });
  if (!args.userId || !args.query) throw new Error("memory_evidence_pack requires contextPackId or userId plus query");
  return callOperation("memory.evidencePack", { ...args, limit: args.limit ?? 8, tokenBudget: args.tokenBudget ?? 900 });
}

function contextPackResult(_args, pack) {
  return { context: pack.context, evidencePack: pack, results: pack.results };
}

function verifyClaimInput(args) {
  return {
    userId: args.userId,
    agentId: args.agentId,
    sessionId: args.sessionId,
    appId: args.appId,
    orgId: args.orgId,
    projectId: args.projectId,
    query: args.claim,
    limit: args.limit ?? 5,
    includeArchived: args.includeArchived,
    tokenBudget: args.tokenBudget ?? 900
  };
}

function verifyClaimResult(args, pack) {
  const top = pack.results?.[0];
  const contradicted = Boolean(pack.results?.some((result) => result.beliefState === "contradicted" || result.retrieval?.contradiction));
  const supported = Boolean(top && top.retrieval?.score >= 0.2 && !contradicted);
  return {
    claim: args.claim,
    verdict: contradicted ? "contradicted" : supported ? "supported" : "insufficient_evidence",
    confidence: top ? Math.min(1, Math.max(0, top.retrieval?.score ?? 0)) : 0,
    evidencePackId: pack.id,
    evidence: (pack.results ?? []).map((result) => ({
      memoryId: result.memoryId,
      content: result.content,
      citation: result.retrieval?.citation,
      score: result.retrieval?.score,
      explanation: result.retrieval?.explanation,
      beliefState: result.beliefState,
      policyDecision: pack.policyDecisions?.find((decision) => decision.memoryId === result.memoryId)
    })),
    warnings: [
      ...(contradicted ? ["claim has contradictory evidence"] : []),
      ...(pack.excludedResults?.length ? [`${pack.excludedResults.length} evidence candidates were excluded`] : [])
    ]
  };
}

function dreamCycleInput(args) {
  return {
    userId: args.userId,
    trigger: args.trigger,
    mode: args.mode,
    scope: args.scope,
    budget: args.budget,
    sourceRefresh: args.sourceRefresh,
    connectorIds: args.connectorIds,
    harnessRunId: args.harnessRunId,
    force: args.force
  };
}

async function callOperation(operation, input) {
  const route = routeForOperation(operation, input);
  await ensureReachable();
  return httpJson(route.method, `${daemonUrl()}${route.path}`, route.body, authHeadersFromEnv());
}

let reachable = false;
async function ensureReachable() {
  if (reachable) return;
  try {
    const health = await httpJson("GET", `${daemonUrl()}/health`, undefined, authHeadersFromEnv(), 800);
    if (health.ok) {
      reachable = true;
      return;
    }
  } catch {
    // Try autostart below.
  }
  if (process.env.COGNIBRAIN_MCP_AUTOSTART === "false") throw new Error(`cognibrain daemon unavailable at ${daemonUrl()}`);
  autostartDaemon();
  const health = await httpJson("GET", `${daemonUrl(true)}/health`, undefined, authHeadersFromEnv(), 1_200);
  if (!health.ok) throw new Error(`cognibrain daemon unavailable at ${daemonUrl()}`);
  reachable = true;
}

let cachedDaemonUrl;
function daemonUrl(refresh = false) {
  if (!refresh && cachedDaemonUrl) return cachedDaemonUrl;
  const explicit = process.env.MEMORY_API_URL ?? process.env.COGNIBRAIN_API_URL ?? process.env.COGNIBRAIN_URL;
  if (explicit) {
    cachedDaemonUrl = stripSlash(explicit);
    return cachedDaemonUrl;
  }
  for (const file of [
    join(runtimeRoot, ".cognibrain", "runtime.json"),
    join(runtimeRoot, ".cognibrain", "local-runtime.json")
  ]) {
    const state = readJson(file);
    if (state?.api?.url) {
      cachedDaemonUrl = stripSlash(state.api.url);
      return cachedDaemonUrl;
    }
  }
  cachedDaemonUrl = "http://127.0.0.1:8787";
  return cachedDaemonUrl;
}

function routeForOperation(operation, input = {}) {
  switch (operation) {
    case "memory.add":
      return { method: "POST", path: "/memories", body: memoryInputForAdd(input) };
    case "memory.search":
      return { method: "POST", path: "/search", body: input };
    case "memory.evidencePack":
      return { method: "POST", path: "/evidence-pack", body: input };
    case "memory.evidencePack.get":
      return { method: "GET", path: `/evidence-pack/${encodeURIComponent(input.contextPackId)}` };
    case "memory.codingContextPack":
      return { method: "POST", path: "/coding-context-pack", body: input };
    case "memory.codeCorrection":
      return { method: "POST", path: "/code/corrections", body: input };
    case "memory.actionGuard":
      return { method: "POST", path: "/code/action-guard", body: input };
    case "memory.patchEvidence":
      return { method: "POST", path: "/patch-evidence", body: input };
    case "memory.actionRecord":
      return { method: "POST", path: "/actions", body: input };
    case "memory.list":
      return { method: "GET", path: `/memories${query(input)}` };
    case "graph.paths":
      return { method: "GET", path: `/graph/paths${query(input)}` };
    case "graph.query":
      return { method: "POST", path: "/graph/query", body: input };
    case "graph.activation":
      return { method: "GET", path: `/graph/activate${query(input)}` };
    case "graph.explain":
      return { method: "GET", path: `/graph/explain${query(input)}` };
    case "policy.evaluate":
      return { method: "POST", path: "/policy/evaluate", body: input };
    case "retention.review":
      return { method: "GET", path: `/retention/review${query(input)}` };
    case "dream.reflect":
      return { method: "POST", path: "/reflection", body: input };
    case "dream.runLegacy":
      return { method: "POST", path: "/dream", body: input };
    case "dream.plan":
      return { method: "POST", path: "/dream/plan", body: input };
    case "dream.run":
      return { method: "POST", path: "/dream/run", body: input };
    case "dream.jobStart":
      return { method: "POST", path: "/dream/jobs", body: input };
    case "dream.jobStatus":
      return { method: "GET", path: `/dream/jobs${query(input)}` };
    case "dream.jobCancel":
      return { method: "POST", path: `/dream/jobs/${encodeURIComponent(input.jobId)}/cancel`, body: { reason: input.reason } };
    case "dream.jobRetry":
      return { method: "POST", path: `/dream/jobs/${encodeURIComponent(input.jobId)}/retry` };
    case "dream.prepare":
      return dreamPrepareRoute(input);
    case "source.revalidate":
      return { method: "POST", path: "/sources/revalidate", body: input };
    case "verification.resolve":
      return { method: "POST", path: "/verification/resolve", body: input };
    case "connector.syncState":
      return { method: "POST", path: "/connectors/sync-state", body: input };
    case "truth.conflictSets":
      return { method: "GET", path: `/conflicts${query(input)}` };
    case "truth.conflictResolve":
      return { method: "POST", path: `/conflicts/${encodeURIComponent(input.conflictSetId)}/resolve`, body: { selectedClaimId: input.selectedClaimId, reason: input.reason, resolvedBy: input.resolvedBy } };
    case "connector.reviewQueue":
      return { method: "GET", path: `/connectors/review-queue${query(input)}` };
    case "connector.reviewDecision":
      return { method: "POST", path: `/connectors/review-queue/${encodeURIComponent(input.memoryId)}/review`, body: { decision: input.decision, reviewerId: input.reviewerId, reason: input.reason } };
    case "harness.event":
      return { method: "POST", path: "/harness/events", body: input };
    case "health":
      return { method: "GET", path: `/health${query(input)}` };
    case "maintenance.status":
      return { method: "GET", path: "/maintenance" };
    default:
      throw new Error(`unsupported MCP runtime operation ${operation}`);
  }
}

function dreamPrepareRoute(input) {
  if (input.trigger === "harness_handoff") return { method: "POST", path: "/harness/handoff-prepare", body: input };
  if (input.trigger === "before_release") return { method: "POST", path: "/harness/release-prepare", body: input };
  return { method: "POST", path: "/harness/session-end", body: input };
}

function memoryInputForAdd(args) {
  return {
    userId: args.userId,
    agentId: args.agentId,
    sessionId: args.sessionId,
    appId: args.appId,
    orgId: args.orgId,
    projectId: args.projectId,
    content: args.content,
    type: args.type,
    layer: args.layer,
    tags: args.tags,
    entities: args.entities,
    pinned: args.pinned,
    metadata: args.metadata,
    source: {
      kind: args.sourceKind ?? "human",
      confidence: args.sourceConfidence ?? 0.9
    }
  };
}

function query(input = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      continue;
    }
    if (typeof value === "object") continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function httpJson(method, url, body, headers = {}, timeoutMs = 4_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error ?? payload.message ?? `${url} returned ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function autostartDaemon() {
  const lockPath = join(runtimeRoot, ".cognibrain", "mcp-start.lock");
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockFd;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch {
    return;
  }
  try {
    writeFileSync(lockFd, `${process.pid}\n`);
    spawnSync(process.execPath, [join(root, "bin", "cognibrain.mjs"), "--runtime-root", runtimeRoot, "start"], {
      cwd: root,
      env: sanitizedRuntimeEnv(),
      stdio: "ignore",
      timeout: 12_000
    });
  } finally {
    if (lockFd !== undefined) closeSync(lockFd);
    rmSync(lockPath, { force: true });
  }
}

function authHeadersFromEnv() {
  const bearer = process.env.MEMORY_BEARER_TOKEN;
  const apiKey = bearer ? undefined : process.env.MEMORY_API_KEY ?? process.env.COGNIBRAIN_API_KEY ?? process.env.COGNIBRAIN_API_TOKEN;
  return Object.fromEntries(Object.entries({
    authorization: bearer ? `Bearer ${bearer}` : undefined,
    "x-api-key": apiKey,
    "x-actor-id": process.env.MEMORY_ACTOR_ID ?? process.env.COGNIBRAIN_ACTOR_ID
  }).filter((entry) => typeof entry[1] === "string" && entry[1] !== ""));
}

function readJson(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function stripSlash(value) {
  return value.replace(/\/+$/, "");
}

function jsonText(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function toolError(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function memoryToolAnnotations(name) {
  const mutating = new Set([
    "memory_add",
    "memory_code_correction",
    "memory_patch_evidence",
    "memory_action_record",
    "memory_action_outcome",
    "memory_reflect",
    "memory_dream",
    "memory_dream_run",
    "memory_dream_job_start",
    "memory_dream_job_cancel",
    "memory_dream_job_retry",
    "memory_session_end",
    "memory_handoff_prepare",
    "memory_release_prepare",
    "memory_source_revalidate",
    "memory_conflict_resolve",
    "memory_connector_review_decide",
    "memory_verification_resolve",
    "memory_harness_event"
  ]);
  const readOnly = !mutating.has(name);
  return {
    readOnlyHint: readOnly,
    destructiveHint: false,
    idempotentHint: readOnly,
    openWorldHint: false
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLightweightMcpServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
