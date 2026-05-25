import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  Download,
  Eye,
  FileJson,
  GitBranch,
  ListFilter,
  Network,
  Pin,
  Plus,
  Search,
  ShoppingBag,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  WifiOff
} from "lucide-react";
import {
  MemoryStore,
  RetrievalEngine,
  ReflectionEngine,
  healthReport,
  type Memory,
  type FeedbackKind,
  type MemoryInput,
  type MetricsReport,
  type ReflectionReport,
  type SearchResult,
  findGraphPaths,
  activateGraph,
  exportMemoryGraph
} from "../core";
import "./styles/app.css";

type ViewId = "memories" | "recall" | "graph" | "timeline" | "dream" | "marketplace" | "proof";
type MemoryFilter = "active" | "all" | "archived" | "needs-review";
type TimeZoom = "day" | "week" | "month" | "all";
type EngineeringKindFilter = "all" | "repo_policy" | "architecture_decision" | "review_correction" | "tool_outcome" | "procedure" | "forbidden_action" | "migration_note" | "test_strategy" | "dependency_rule" | "generated_file_rule";
type RuntimeStatus = {
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
type ConnectorHealth = {
  connectorId: string;
  kind: string;
  privacyPolicy: string;
  lastStatus: string;
  lastSyncAt?: string;
  lastWritebackAt?: string;
  records: number;
};
type MarketplaceModuleCard = {
  id: string;
  kind: "connector" | "domain" | "persona" | "retrieval_profile";
  name: string;
  version: string;
  status: "available" | "installed";
  summary: string;
  manifest: Record<string, unknown>;
  securityStatus?: string;
};
type RoutePreview = {
  selectedScopes: Array<{ kind: string; id: string; reason: string }>;
  excludedScopes: Array<{ kind: string; id: string; reason: string }>;
  reasoning: string[];
};

const viewItems: Array<{ id: ViewId; label: string; icon: React.ElementType; note: string }> = [
  { id: "memories", label: "Store", icon: Database, note: "Inspect facts" },
  { id: "recall", label: "Recall", icon: SlidersHorizontal, note: "Tune context" },
  { id: "graph", label: "Graph", icon: GitBranch, note: "Explain paths" },
  { id: "timeline", label: "Time", icon: Clock3, note: "Patterns" },
  { id: "dream", label: "Dream", icon: Sparkles, note: "Repair memory" },
  { id: "marketplace", label: "Market", icon: ShoppingBag, note: "Modules" },
  { id: "proof", label: "Proof", icon: BarChart3, note: "Verify claims" }
];

const engineeringKindFilters: EngineeringKindFilter[] = [
  "all",
  "repo_policy",
  "architecture_decision",
  "review_correction",
  "tool_outcome",
  "procedure",
  "forbidden_action",
  "migration_note",
  "test_strategy",
  "dependency_rule",
  "generated_file_rule"
];

const logoUrl = new URL("../../docs/assets/cognilabz-logo.png", import.meta.url).href;

const seedMemories: MemoryInput[] = [
  {
    userId: "demo",
    content: "Codex prefers compact memory citations with source lines and rollout ids.",
    source: { kind: "human", confidence: 0.96 },
    tags: ["preference", "workflow"],
    entities: ["Codex"],
    timestamp: daysAgo(5),
    pinned: true
  },
  {
    userId: "demo",
    content: "Project Daybreaker parity work must use simulator and backend proof before claiming done.",
    source: { kind: "reviewed_code", confidence: 0.9 },
    tags: ["daybreaker", "proof", "workflow"],
    entities: ["Daybreaker"],
    timestamp: daysAgo(8)
  },
  {
    userId: "demo",
    content: "Copilot bundle edits live under /Users/michaelhubeny/.copilot/pkg/universal.",
    source: { kind: "tool", confidence: 0.74 },
    tags: ["copilot", "path"],
    entities: ["Copilot"],
    timestamp: daysAgo(18)
  },
  {
    userId: "demo",
    content: "Memory retrieval should combine semantic, keyword, entity, temporal, trust, and graph signals.",
    source: { kind: "human", confidence: 0.94 },
    tags: ["retrieval", "benchmark", "architecture"],
    timestamp: daysAgo(2)
  },
  {
    userId: "demo",
    content: "Transcribed audio memories have lower source confidence until verified by a human.",
    source: { kind: "agent", confidence: 0.63 },
    tags: ["transcript", "quality"],
    timestamp: daysAgo(42)
  },
  {
    userId: "demo",
    content: "Audio transcript said Mira has tonsil pain, but this was never confirmed.",
    source: { kind: "transcript", confidence: 0.34 },
    tags: ["health", "transcript", "needs-review"],
    entities: ["Mira"],
    timestamp: daysAgo(96)
  },
  {
    userId: "demo",
    content: "Mira confirmed she does not have tonsil pain; demote the transcript memory.",
    source: { kind: "human", confidence: 0.95 },
    tags: ["health", "correction"],
    entities: ["Mira"],
    timestamp: daysAgo(1)
  },
  {
    userId: "demo",
    content: "Old vector-only memory often misses temporal corrections and multi-hop project preferences.",
    source: { kind: "import", confidence: 0.61 },
    tags: ["benchmark", "retrieval"],
    timestamp: daysAgo(65)
  },
  {
    userId: "demo",
    content: "Operator reviews memory graph and benchmark proof every Friday before release work.",
    source: { kind: "human", confidence: 0.92 },
    tags: ["pattern", "release", "review"],
    entities: ["operator", "memory graph", "benchmark proof"],
    timestamp: daysAgo(10),
    temporal: { eventAt: daysAgo(10).toISOString() }
  },
  {
    userId: "demo",
    content: "Repo policy: before Cognibrain release work, run npm run release:check and keep managed SaaS claims out of self-hosted launch copy.",
    source: { kind: "reviewed_code", confidence: 0.96 },
    tags: ["engineering-memory", "engineering:repo_policy", "release"],
    entities: ["Cognibrain", "release"],
    timestamp: daysAgo(1),
    metadata: {
      engineering: {
        kind: "repo_policy",
        codebase: { repo: "cognibrain", branch: "main" },
        confidence: 0.92,
        command: "npm run release:check"
      }
    }
  },
  {
    userId: "demo",
    content: "Inferred pattern: release reviews often combine graph paths, dream output, and benchmark proof.",
    source: { kind: "agent", confidence: 0.7 },
    tags: ["pattern", "needs-review"],
    entities: ["release review", "graph paths", "benchmark proof"],
    timestamp: daysAgo(3),
    metadata: {
      patternReview: { status: "pending", support: 3, confidence: 0.72, cadence: "weekly:friday" }
    }
  }
];

const marketplaceModules: MarketplaceModuleCard[] = [
  {
    id: "connector-chat",
    kind: "connector",
    name: "Chat Connector",
    version: "1.0.0",
    status: "installed",
    summary: "Ingests chat transcripts with external ids, source mapping, and webhook sync.",
    manifest: { connectorId: "official-chat", capabilities: ["ingest", "webhook", "writeback"] }
  },
  {
    id: "persona-operator",
    kind: "persona",
    name: "Operator Persona",
    version: "1.0.0",
    status: "available",
    summary: "Concise summaries, stricter privacy defaults, and high trust weighting.",
    manifest: { id: "operator", summaryStyle: "concise", privacyDefault: "private", weights: { trust: 0.34, graph: 0.2 } }
  },
  {
    id: "domain-coding",
    kind: "domain",
    name: "Coding Domain",
    version: "1.0.0",
    status: "installed",
    summary: "Recognizes APIs, packages, tests, repo paths, and code relations.",
    manifest: { aliases: ["repo", "api", "cli"], tags: ["code", "test", "package"] }
  },
  {
    id: "profile-recall-safe",
    kind: "retrieval_profile",
    name: "High-Precision Recall",
    version: "1.0.0",
    status: "available",
    summary: "Raises trust and graph path evidence while lowering recency-only pressure.",
    manifest: { weights: { trust: 0.36, graph: 0.22, semantic: 0.2, temporal: 0.06 } }
  }
];

const certifiedBenchmarks = [
  {
    dataset: "LoCoMo",
    metric: "evidence recall@20",
    ours: "1095/1536",
    accuracy: 71.29,
    baseline: "best included 981/1536",
    margin: 7.42,
    artifact: "artifacts/locomo-report.json"
  },
  {
    dataset: "LongMemEval-S",
    metric: "answer-session recall@20",
    ours: "497/500",
    accuracy: 99.4,
    baseline: "keyword-only 495/500",
    margin: 0.4,
    artifact: "artifacts/longmemeval-report.json"
  },
  {
    dataset: "BEAM 100K",
    metric: "retrieval nugget score@20",
    ours: "386/400",
    accuracy: 96.5,
    baseline: "Graphonomous public 95.0%",
    margin: 1.5,
    artifact: "artifacts/beam-report.json"
  },
  {
    dataset: "BEAM 500K",
    metric: "retrieval nugget score@20",
    ours: "683/700",
    accuracy: 97.57,
    baseline: "Graphonomous public 96.9%",
    margin: 0.67,
    artifact: "artifacts/beam-500k-report.json"
  },
  {
    dataset: "CogniCodeBench",
    metric: "engineering-memory score",
    ours: "100/100",
    accuracy: 100,
    baseline: "best ablation below full",
    margin: 18,
    artifact: "artifacts/cognicodebench/run.json"
  }
];

const beamCategories = [
  ["abstention", "70/70"],
  ["contradiction", "70/70"],
  ["event ordering", "70/70"],
  ["information extraction", "65/70"],
  ["instruction following", "70/70"],
  ["knowledge update", "69/70"],
  ["multi-session", "65/70"],
  ["preference", "69/70"],
  ["summarization", "70/70"],
  ["temporal", "65/70"]
];

const nextgenProof = [
  ["engineering memory", "10 typed kinds"],
  ["action guard", "do/don't before tools"],
  ["patch evidence", "corrections + outcomes"],
  ["graph inference", "typed rules"],
  ["path explainer", "multi-hop"],
  ["brain/source scope", "team-ready"],
  ["audit events", "queued webhooks"],
  ["compliance report", "retention proof"],
  ["marketplace", "persona install"]
];

const harnessProof = [
  ["Claude Code", "setup package"],
  ["OpenAI Codex", "skill + MCP"],
  ["Cursor / VS Code", "workspace scope"],
  ["GitHub", "review + CI memory"]
];

const harnessRunProof = [
  ["Claude Code", "context -> guard -> outcome -> evidence"],
  ["Codex", "context pack + MCP tools"],
  ["Cursor / VS Code", "telemetry-ready workspace"],
  ["GitHub", "review and CI writeback"]
];

const patchEvidenceProof = [
  ["context pack", "code_ctx_* linked when supplied by EvidencePack"],
  ["memories used", "citation, trust and graph paths retained"],
  ["corrections applied", "reviewed corrections and derived policies"],
  ["procedures recalled", "next command and success pattern"],
  ["forbidden actions", "repeated mistakes blocked before tools"],
  ["commands run", "patch summary captures exact validation"],
  ["tool outcomes", "exit code, duration and touched files"],
  ["stale excluded", "superseded rules kept out of context"]
];

const platformSignals = [
  { label: "CLI", value: "setup installs skill + runtime", icon: Terminal },
  { label: "API", value: "scoped HTTP and MCP store", icon: Network },
  { label: "Dream", value: "staleness and pattern maintenance", icon: Sparkles }
];

const operatorControls = [
  "configurable weights",
  "privacy redaction",
  "scope filters",
  "feedback learning",
  "graph paths",
  "time review",
  "brain scope",
  "audit trail",
  "marketplace"
];

function App() {
  const [view, setView] = useState<ViewId>("memories");
  const [query, setQuery] = useState("Avoid stale memories?");
  const [filter, setFilter] = useState<MemoryFilter>("active");
  const [engineeringFilter, setEngineeringFilter] = useState<EngineeringKindFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState("");
  const [artifactText, setArtifactText] = useState("");
  const [lastCycle, setLastCycle] = useState<ReflectionReport | null>(null);
  const [lastClean, setLastClean] = useState<string[]>([]);
  const [retrievalWeights, setRetrievalWeights] = useState({ semantic: 0.26, keyword: 0.24, entity: 0.16, temporal: 0.08, behavioral: 0.05, trust: 0.18, graph: 0.06, access: 0.02 });
  const [graphDepth, setGraphDepth] = useState(3);
  const [timeZoom, setTimeZoom] = useState<TimeZoom>("month");
  const [lifecyclePolicy, setLifecyclePolicy] = useState({ fadeAfterDays: 45, archiveAfterDays: 90 });
  const [exportPayload, setExportPayload] = useState("");
  const [modules, setModules] = useState<MarketplaceModuleCard[]>(marketplaceModules);
  const [version, setVersion] = useState(0);
  const apiUrl = useMemo(getApiUrl, []);
  const [runtime, setRuntime] = useState<RuntimeStatus>({ state: "checking", label: "checking" });
  const [connectorHealth, setConnectorHealth] = useState<ConnectorHealth[]>([]);
  const [installingModuleId, setInstallingModuleId] = useState<string | null>(null);
  const [marketplaceNotice, setMarketplaceNotice] = useState("Live runtime required for module installation.");
  const [liveMemories, setLiveMemories] = useState<Memory[] | null>(null);
  const [liveResults, setLiveResults] = useState<SearchResult[] | null>(null);
  const [liveRoutePreview, setLiveRoutePreview] = useState<RoutePreview | null>(null);
  const [runtimeNotice, setRuntimeNotice] = useState("Using bundled demo data until the API runtime is online.");

  const { store, retrieval, reflection } = useMemo(() => {
    const store = new MemoryStore();
    store.seed(seedMemories);
    return { store, retrieval: new RetrievalEngine(store), reflection: new ReflectionEngine(store) };
  }, []);

  const localMemories = store.list("demo");
  const usingRuntime = runtime.state === "online" && liveMemories !== null;
  const memories = usingRuntime ? liveMemories : localMemories;
  const health = usingRuntime ? healthFromMemories(memories) : healthReport(store, "demo");
  const filteredMemories = filterMemories(memories, filter, engineeringFilter);
  const selectedMemory = selectedId ? findMemory(memories, selectedId) : filteredMemories[0] ?? memories[0] ?? null;
  const localResults = retrieval.search({ userId: "demo", query, limit: 5, weights: retrievalWeights, graphDepth });
  const results = usingRuntime ? liveResults ?? [] : localResults;
  const routePreview = useMemo(() => usingRuntime && liveRoutePreview ? liveRoutePreview : previewRoute(query, memories, results), [usingRuntime, liveRoutePreview, query, memories, results]);
  const artifactSummary = useMemo(() => summarizeArtifact(artifactText), [artifactText]);
  const reviewCount = memories.filter(needsReview).length;

  useEffect(() => {
    let cancelled = false;
    async function checkRuntime() {
      try {
        const [healthResponse, maintenanceResponse] = await Promise.all([
          fetch(`${apiUrl}/health`),
          fetch(`${apiUrl}/maintenance`)
        ]);
        if (!healthResponse.ok || !maintenanceResponse.ok) throw new Error("runtime unavailable");
        const [metricsResponse, connectorResponse, marketplaceResponse, storageResponse, managedResponse, memoriesResponse] = await Promise.all([
          fetch(`${apiUrl}/metrics`),
          fetch(`${apiUrl}/connectors/health`),
          fetch(`${apiUrl}/marketplace`),
          fetch(`${apiUrl}/storage`),
          fetch(`${apiUrl}/managed/control-plane`),
          fetch(`${apiUrl}/memories?userId=demo`)
        ]);
        const maintenance = (await maintenanceResponse.json()) as RuntimeStatus["maintenance"];
        const metrics = metricsResponse.ok ? ((await metricsResponse.json()) as MetricsReport) : undefined;
        const connectors = connectorResponse.ok ? ((await connectorResponse.json()) as ConnectorHealth[]) : [];
        const liveModules = marketplaceResponse.ok ? ((await marketplaceResponse.json()) as unknown[]) : undefined;
        const storage = storageResponse.ok ? ((await storageResponse.json()) as RuntimeStatus["storage"]) : undefined;
        const managed = managedResponse.ok ? ((await managedResponse.json()) as RuntimeStatus["managed"]) : undefined;
        const runtimeMemories = memoriesResponse.ok ? reviveMemories(await memoriesResponse.json()) : [];
        if (!cancelled) {
          setRuntime({ state: "online", label: "online", maintenance, metrics, storage, managed });
          setConnectorHealth(connectors);
          setLiveMemories(runtimeMemories);
          if (liveModules?.length) setModules(liveModules.map(mapMarketplaceModule));
          setRuntimeNotice(`Using live API store at ${apiUrl}.`);
          setMarketplaceNotice("Marketplace is backed by the live runtime.");
        }
      } catch {
        if (!cancelled) {
          setRuntime({ state: "offline", label: "offline" });
          setConnectorHealth([]);
          setLiveMemories(null);
          setLiveResults(null);
          setLiveRoutePreview(null);
          setRuntimeNotice("API runtime unavailable. Using in-browser demo data.");
          setMarketplaceNotice("Live runtime unavailable. Module install is disabled until the API is online.");
        }
      }
    }
    checkRuntime();
    const timer = window.setInterval(checkRuntime, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiUrl]);

  useEffect(() => {
    if (!usingRuntime) {
      setLiveResults(null);
      setLiveRoutePreview(null);
      return;
    }
    let cancelled = false;
    async function loadRuntimeRecall() {
      try {
        const payload = { userId: "demo", query, limit: 5, weights: retrievalWeights, graphDepth };
        const [searchResponse, routeResponse] = await Promise.all([
          fetch(`${apiUrl}/search`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }),
          fetch(`${apiUrl}/route`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        ]);
        if (!searchResponse.ok || !routeResponse.ok) throw new Error("runtime recall unavailable");
        const [searchJson, routeJson] = await Promise.all([searchResponse.json(), routeResponse.json()]);
        if (!cancelled) {
          setLiveResults(reviveSearchResults(searchJson));
          setLiveRoutePreview(routeJson as RoutePreview);
        }
      } catch {
        if (!cancelled) {
          setLiveResults([]);
          setLiveRoutePreview(null);
        }
      }
    }
    loadRuntimeRecall();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, query, retrievalWeights, graphDepth, usingRuntime, liveMemories?.length, version]);

  function refresh(nextSelectedId = selectedMemory?.id ?? null) {
    setSelectedId(nextSelectedId);
    setVersion((value) => value + 1);
  }

  async function refreshRuntimeMemories(nextSelectedId = selectedMemory?.id ?? null) {
    const response = await fetch(`${apiUrl}/memories?userId=demo`);
    if (!response.ok) throw new Error(await response.text());
    const nextMemories = reviveMemories(await response.json());
    setLiveMemories(nextMemories);
    refresh(nextSelectedId);
  }

  async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
    });
    if (!response.ok) throw new Error(await response.text());
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  async function addMemory() {
    const content = newMemory.trim();
    if (!content) return;
    if (usingRuntime) {
      try {
        const created = reviveMemory(await apiJson<unknown>("/memories", {
          method: "POST",
          body: JSON.stringify({
            userId: "demo",
            content,
            source: { kind: "human", confidence: 0.9 },
            tags: ["manual"],
            timestamp: new Date().toISOString()
          })
        }));
        setNewMemory("");
        setFilter("active");
        await refreshRuntimeMemories(created.id);
        setLastClean([`Added ${shortId(created)} through ${apiUrl}/memories.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime add failed."]);
      }
      return;
    }
    const created = store.add({
      userId: "demo",
      content,
      source: { kind: "human", confidence: 0.9 },
      tags: ["manual"],
      timestamp: new Date()
    });
    setNewMemory("");
    setFilter("active");
    refresh(created.id);
  }

  async function archiveMemory(memory: Memory) {
    if (usingRuntime) {
      try {
        const archived = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}/archive`, { method: "POST" }));
        await refreshRuntimeMemories(null);
        setLastClean([`Archived ${shortId(archived)} through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime archive failed."]);
      }
      return;
    }
    store.archive(memory.id);
    setLastClean([`Archived ${shortId(memory)} because it should no longer be injected.`]);
    refresh(null);
  }

  async function deleteMemory(memory: Memory) {
    if (usingRuntime) {
      try {
        await apiJson<void>(`/memories/${memory.id}`, { method: "DELETE" });
        await refreshRuntimeMemories(null);
        setLastClean([`Deleted ${shortId(memory)} through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime delete failed."]);
      }
      return;
    }
    store.delete(memory.id);
    setLastClean([`Deleted ${shortId(memory)} from the local store.`]);
    refresh(null);
  }

  async function verifyMemory(memory: Memory) {
    if (usingRuntime) {
      try {
        const updated = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}/confirm`, { method: "POST", body: JSON.stringify({ userId: "demo" }) }));
        await refreshRuntimeMemories(updated.id);
        setLastClean([`Confirmed ${shortId(updated)} through the live verification API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime verify failed."]);
      }
      return;
    }
    const updated = store.update(memory.id, {
      source: { kind: "human", confidence: 0.96 },
      trust: 0.94,
      tags: Array.from(new Set([...memory.tags.filter((tag) => tag !== "needs-review"), "verified"])),
      metadata: { verifiedAt: new Date().toISOString() }
    });
    setLastClean([`Verified ${shortId(updated)} and raised trust to ${updated.trust.toFixed(2)}.`]);
    refresh(updated.id);
  }

  async function togglePin(memory: Memory) {
    if (usingRuntime) {
      try {
        const updated = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !memory.pinned }) }));
        await refreshRuntimeMemories(updated.id);
        setLastClean([`${updated.pinned ? "Pinned" : "Unpinned"} ${shortId(updated)} through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime pin update failed."]);
      }
      return;
    }
    const updated = store.update(memory.id, { pinned: !memory.pinned });
    setLastClean([`${updated.pinned ? "Pinned" : "Unpinned"} ${shortId(updated)}.`]);
    refresh(updated.id);
  }

  async function applyFeedback(memory: Memory, kind: FeedbackKind) {
    if (usingRuntime) {
      try {
        const updated = reviveMemory(await apiJson<unknown>("/feedback", { method: "POST", body: JSON.stringify({ userId: "demo", memoryId: memory.id, kind }) }));
        await refreshRuntimeMemories(updated.id);
        setLastClean([`Recorded ${kind.replace("_", " ")} feedback through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime feedback failed."]);
      }
      return;
    }
    const delta =
      kind === "helpful" ? { trust: 0.04, importance: 0.06 } :
      kind === "wrong" ? { trust: -0.18, importance: -0.08 } :
      kind === "always_include" ? { trust: 0.06, importance: 0.12 } :
      kind === "never_include" ? { trust: -0.25, importance: -0.18 } :
      kind === "approve_pattern" ? { trust: 0.08, importance: 0.1 } :
      kind === "reject_pattern" ? { trust: -0.22, importance: -0.18 } :
      { trust: 0, importance: 0 };
    const updated = store.update(memory.id, {
      trust: clamp01(memory.trust + delta.trust),
      importance: clamp01(memory.importance + delta.importance),
      pinned: kind === "always_include" || kind === "approve_pattern" ? true : memory.pinned,
      tags: kind === "wrong" || kind === "never_include" ? Array.from(new Set([...memory.tags, "needs-review"])) : memory.tags,
      metadata: {
        feedback: [...((memory.metadata.feedback as unknown[]) ?? []), { kind, timestamp: new Date().toISOString() }],
        ...(kind === "approve_pattern" ? { patternReview: { status: "approved", reviewedAt: new Date().toISOString() } } : {}),
        ...(kind === "reject_pattern" ? { patternReview: { status: "rejected", reviewedAt: new Date().toISOString() } } : {})
      }
    });
    if (kind === "reject_pattern" || kind === "never_include") store.archive(updated.id);
    setLastClean([`Recorded ${kind.replace("_", " ")} feedback for ${shortId(updated)}.`]);
    refresh(updated.id);
  }

  async function updateConsent(memory: Memory, visibility: Memory["consent"]["visibility"]) {
    if (usingRuntime) {
      try {
        const updated = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}/consent`, { method: "POST", body: JSON.stringify({ visibility }) }));
        await refreshRuntimeMemories(updated.id);
        setLastClean([`Updated consent for ${shortId(updated)} to ${visibility} through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime consent update failed."]);
      }
      return;
    }
    const updated = store.update(memory.id, {
      consent: { ...memory.consent, visibility },
      metadata: { ...memory.metadata, consentUpdatedAt: new Date().toISOString() }
    });
    setLastClean([`Updated consent for ${shortId(updated)} to ${visibility}.`]);
    refresh(updated.id);
  }

  async function markSensitive(memory: Memory) {
    if (usingRuntime) {
      try {
        const updated = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            tags: Array.from(new Set([...memory.tags, "needs-review", "sensitive"])),
            metadata: { ...memory.metadata, privacy: { action: "encrypt", reviewedAt: new Date().toISOString() } }
          })
        }));
        await refreshRuntimeMemories(updated.id);
        setLastClean([`Marked ${shortId(updated)} as sensitive through the live API.`]);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime sensitive update failed."]);
      }
      return;
    }
    const updated = store.update(memory.id, {
      trust: Math.min(memory.trust, 0.5),
      tags: Array.from(new Set([...memory.tags, "needs-review", "sensitive"])),
      metadata: { ...memory.metadata, privacy: { action: "encrypt", reviewedAt: new Date().toISOString() } }
    });
    setLastClean([`Marked ${shortId(updated)} as sensitive and moved it into review.`]);
    refresh(updated.id);
  }

  async function exportUserMemories() {
    let exportMemories: Memory[];
    try {
      exportMemories = usingRuntime ? reviveMemories(await apiJson<unknown>("/export/demo")) : store.list("demo");
    } catch (error) {
      setLastClean([error instanceof Error ? error.message : "Runtime export failed."]);
      return;
    }
    const payload = JSON.stringify(exportMemories.map((memory) => ({
      id: memory.id,
      content: memory.content,
      trust: memory.trust,
      source: memory.source.kind,
      consent: memory.consent.visibility,
      tags: memory.tags,
      archived: Boolean(memory.archivedAt)
    })), null, 2);
    setExportPayload(payload);
    setLastClean([`Prepared export with ${exportMemories.length} memories.`]);
  }

  async function installModule(moduleId: string) {
    if (runtime.state !== "online") {
      setMarketplaceNotice("Start the API runtime before installing marketplace modules.");
      return;
    }
    setInstallingModuleId(moduleId);
    setMarketplaceNotice(`Installing ${moduleId} through the live runtime...`);
    try {
      const response = await fetch(`${apiUrl}/marketplace/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: moduleId })
      });
      if (!response.ok) throw new Error(await response.text());
      const installed = mapMarketplaceModule(await response.json());
      setModules((items) => items.map((item) => item.id === moduleId ? installed : item));
      setLastClean([`Installed ${moduleId} through ${apiUrl}/marketplace/install.`]);
      setMarketplaceNotice(`${installed.name} is installed in the live runtime.`);
    } catch (error) {
      setMarketplaceNotice(error instanceof Error ? error.message : "Marketplace install failed.");
    } finally {
      setInstallingModuleId(null);
    }
  }

  async function cleanRiskyMemories() {
    const candidates = store.list("demo").filter((memory) => !memory.archivedAt && !memory.pinned && needsReview(memory));
    if (usingRuntime) {
      const liveCandidates = memories.filter((memory) => !memory.archivedAt && !memory.pinned && needsReview(memory));
      const actions: string[] = [];
      for (const memory of liveCandidates) {
        try {
          const archived = reviveMemory(await apiJson<unknown>(`/memories/${memory.id}/archive`, { method: "POST" }));
          actions.push(`Archived ${shortId(archived)}: ${reviewReason(memory)}.`);
        } catch (error) {
          actions.push(error instanceof Error ? error.message : `Failed to archive ${shortId(memory)}.`);
        }
      }
      await refreshRuntimeMemories(null);
      setLastClean(actions.length ? actions : ["No risky active memories found."]);
      return;
    }
    const actions = candidates.map((memory) => {
      const archived = store.archive(memory.id);
      return `Archived ${shortId(archived)}: ${reviewReason(memory)}.`;
    });
    setLastClean(actions.length ? actions : ["No risky active memories found."]);
    refresh(null);
  }

  async function runDreamCycle() {
    if (usingRuntime) {
      try {
        const report = reviveReflectionReport(await apiJson<unknown>("/dream", { method: "POST", body: JSON.stringify({ userId: "demo" }) }));
        setLastCycle(report);
        setLastClean(report.lifecycle.actions.length ? report.lifecycle.actions : ["Dream cycle evaluated runtime memory quality."]);
        setFilter("all");
        setView("dream");
        await refreshRuntimeMemories(null);
      } catch (error) {
        setLastClean([error instanceof Error ? error.message : "Runtime dream failed."]);
      }
      return;
    }
    const report = new ReflectionEngine(store, lifecyclePolicy).run("demo");
    setLastCycle(report);
    setLastClean(report.lifecycle.actions.length ? report.lifecycle.actions : ["Dream cycle evaluated memory quality. No structural action was needed."]);
    setFilter("all");
    setView("dream");
    refresh(null);
  }

  return (
    <main className="app-shell" data-version={version}>
      <header className="app-topbar">
        <div className="brand">
          <img className="brand-mark" src={logoUrl} alt="cognibrain logo" />
          <div>
            <strong>cognibrain</strong>
            <span>operator console</span>
          </div>
        </div>

        <nav className="view-nav" aria-label="Workspace views">
          {viewItems.map(({ id, label, icon: Icon, note }) => (
            <button key={id} className={view === id ? "active" : undefined} onClick={() => setView(id)}>
              <Icon size={18} />
              <span>
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className={`runtime-chip ${runtime.state}`}>
          <GitBranch size={15} />
          <span>API {runtime.label}</span>
        </div>
      </header>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="kicker">platform + operator memory control</span>
            <h1>{viewTitle(view)}</h1>
            <p>{viewSubtitle(view)}</p>
          </div>
          <div className="topbar-actions">
            <button className="secondary-action" onClick={cleanRiskyMemories}><Archive size={17} /> Clean risky</button>
            <button onClick={runDreamCycle}><Sparkles size={17} /> Run dream cycle</button>
          </div>
        </header>

        <section className="operator-deck" aria-label="Platform and operator state">
          <article className="operator-card operator-primary">
            <div className="card-heading">
              <ShieldCheck size={18} />
              <span>Operator gate</span>
            </div>
            <strong>{Math.round(health.healthScore * 100)}% ready for context</strong>
            <p>{health.active} active memories, {reviewCount} need review. {runtimeNotice}</p>
            <div className="operator-flow" aria-label="Operator workflow">
              <span>Capture</span>
              <span>Rank</span>
              <span>Dream</span>
              <span>Inject</span>
            </div>
          </article>

          <article className="operator-card">
            <div className="card-heading">
              <Cpu size={18} />
              <span>Platform runtime</span>
            </div>
            <strong>{runtime.storage?.active ? `${runtime.storage.active} backend` : runtime.maintenance?.enabled === false ? "manual dreams" : "auto-dream online"}</strong>
            <p>{runtime.managed ? `${runtime.managed.tenants.total} managed tenants, ${Object.values(runtime.managed.readiness).filter(Boolean).length} readiness checks passing.` : "CLI, HTTP, dashboard, MCP, and connector templates run from one local package."}</p>
            <div className="signal-stack">
              {platformSignals.map(({ label, value, icon: Icon }) => (
                <span key={label}><Icon size={14} /> {label}: {value}</span>
              ))}
              {runtime.managed ? <span><ShieldCheck size={14} /> managed: {runtime.managed.autoscaling.enabled ? `${runtime.managed.autoscaling.minReplicas}-${runtime.managed.autoscaling.maxReplicas} replicas` : "fixed capacity"}</span> : null}
            </div>
          </article>

          <article className="operator-card">
            <div className="card-heading">
              <Activity size={18} />
              <span>Memory advantage</span>
            </div>
            <strong>entity-linked recall loop</strong>
            <p>Hybrid retrieval links entities, typed relations, time, trust, source quality, feedback, and dream actions.</p>
            <div className="signal-stack">
              <span><Network size={14} /> entity links</span>
              <span><ShieldCheck size={14} /> source gates</span>
              <span><BarChart3 size={14} /> benchmark proof</span>
            </div>
          </article>
        </section>

        <section className="capability-strip" aria-label="Operator controls">
          {operatorControls.map((control) => (
            <span key={control}>{control}</span>
          ))}
        </section>

        <section className="metrics" aria-label="Memory health metrics">
          <Metric label="Active" value={String(health.active)} />
          <Metric label="Need review" value={String(reviewCount)} tone={reviewCount ? "warn" : "ok"} />
          <Metric label="Avg trust" value={health.averageTrust.toFixed(2)} />
          <Metric label="Freshness" value={`${Math.round(health.freshness * 100)}%`} />
          <Metric label="No-hit" value={String(runtime.metrics?.noHitSearches ?? 0)} />
          <Metric label="Dreams" value={String(runtime.metrics?.dreams ?? 0)} />
          <Metric label="Connectors" value={String(connectorHealth.length)} />
          <Metric label="Writebacks" value={String(connectorHealth.filter((item) => item.lastWritebackAt).length)} />
          <Metric label="Tenants" value={String(runtime.managed?.tenants.total ?? 0)} />
        </section>

        {view === "memories" ? (
          <MemoryView
            filter={filter}
            setFilter={setFilter}
            engineeringFilter={engineeringFilter}
            setEngineeringFilter={setEngineeringFilter}
            memories={filteredMemories}
            selectedMemory={selectedMemory}
            newMemory={newMemory}
            setNewMemory={setNewMemory}
            addMemory={addMemory}
            selectMemory={(memory) => setSelectedId(memory.id)}
            archiveMemory={archiveMemory}
            deleteMemory={deleteMemory}
            verifyMemory={verifyMemory}
            togglePin={togglePin}
            applyFeedback={applyFeedback}
            updateConsent={updateConsent}
            markSensitive={markSensitive}
            exportUserMemories={exportUserMemories}
            exportPayload={exportPayload}
            lastClean={lastClean}
          />
        ) : null}

        {view === "recall" ? (
          <RecallView
            query={query}
            setQuery={setQuery}
            results={results}
            selectedMemory={selectedMemory}
            selectMemory={(memory) => setSelectedId(memory.id)}
            routePreview={routePreview}
            retrievalWeights={retrievalWeights}
            setRetrievalWeights={setRetrievalWeights}
            graphDepth={graphDepth}
            setGraphDepth={setGraphDepth}
          />
        ) : null}

        {view === "graph" ? <GraphView memories={memories} /> : null}

        {view === "timeline" ? (
          <TimelineView
            memories={memories}
            timeZoom={timeZoom}
            setTimeZoom={setTimeZoom}
            applyFeedback={applyFeedback}
            selectMemory={(memory) => setSelectedId(memory.id)}
          />
        ) : null}

        {view === "dream" ? (
          <DreamView
            report={lastCycle}
            memories={memories}
            runDreamCycle={runDreamCycle}
            lastClean={lastClean}
            retrievalWeights={retrievalWeights}
            setRetrievalWeights={setRetrievalWeights}
            lifecyclePolicy={lifecyclePolicy}
            setLifecyclePolicy={setLifecyclePolicy}
          />
        ) : null}

        {view === "marketplace" ? (
          <MarketplaceView modules={modules} installModule={installModule} runtime={runtime} installingModuleId={installingModuleId} notice={marketplaceNotice} />
        ) : null}

        {view === "proof" ? (
          <ProofView artifactText={artifactText} setArtifactText={setArtifactText} artifactSummary={artifactSummary} metrics={runtime.metrics} />
        ) : null}
      </section>
    </main>
  );
}

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
}

function reviveMemories(raw: unknown): Memory[] {
  return Array.isArray(raw) ? raw.map(reviveMemory) : [];
}

function reviveMemory(raw: unknown): Memory {
  const memory = raw as Memory & { createdAt: string | Date; updatedAt: string | Date; lastAccessedAt?: string | Date; archivedAt?: string | Date };
  return {
    ...memory,
    createdAt: toDate(memory.createdAt),
    updatedAt: toDate(memory.updatedAt),
    lastAccessedAt: memory.lastAccessedAt ? toDate(memory.lastAccessedAt) : undefined,
    archivedAt: memory.archivedAt ? toDate(memory.archivedAt) : undefined
  };
}

function reviveSearchResults(raw: unknown): SearchResult[] {
  return Array.isArray(raw)
    ? raw.map((result) => {
        const item = result as SearchResult & { memory: unknown };
        return { ...item, memory: reviveMemory(item.memory) };
      })
    : [];
}

function reviveReflectionReport(raw: unknown): ReflectionReport {
  const report = raw as ReflectionReport;
  return {
    ...report,
    created: reviveMemories(report.created),
    demoted: reviveMemories(report.demoted),
    contradictions: (report.contradictions ?? []).map((item) => ({
      ...item,
      kept: reviveMemory(item.kept),
      demoted: reviveMemory(item.demoted)
    }))
  };
}

function toDate(value: string | Date | undefined): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date();
}

function healthFromMemories(memories: Memory[]) {
  const active = memories.filter((memory) => !memory.archivedAt);
  const averageTrust = active.length ? active.reduce((total, memory) => total + memory.trust, 0) / active.length : 1;
  const now = Date.now();
  const freshness = active.length
    ? active.reduce((total, memory) => total + Math.max(0, 1 - ((now - memory.updatedAt.getTime()) / (90 * 86_400_000))), 0) / active.length
    : 1;
  const healthScore = Math.max(0, Math.min(1, averageTrust * 0.7 + freshness * 0.3));
  return { active: active.length, averageTrust, freshness, healthScore };
}

function mapMarketplaceModule(raw: unknown): MarketplaceModuleCard {
  const item = raw as {
    id?: string;
    kind?: MarketplaceModuleCard["kind"];
    name?: string;
    version?: string;
    description?: string;
    installState?: "available" | "installed";
    status?: "available" | "installed";
    manifest?: Record<string, unknown>;
    security?: { status?: string };
  };
  return {
    id: item.id ?? "unknown-module",
    kind: item.kind ?? "domain",
    name: item.name ?? item.id ?? "Unnamed module",
    version: item.version ?? "0.0.0",
    status: item.installState ?? item.status ?? "available",
    summary: item.description ?? "Runtime module from the marketplace API.",
    manifest: item.manifest ?? {},
    securityStatus: item.security?.status
  };
}

function MemoryView({
  filter,
  setFilter,
  engineeringFilter,
  setEngineeringFilter,
  memories,
  selectedMemory,
  newMemory,
  setNewMemory,
  addMemory,
  selectMemory,
  archiveMemory,
  deleteMemory,
  verifyMemory,
  togglePin,
  applyFeedback,
  updateConsent,
  markSensitive,
  exportUserMemories,
  exportPayload,
  lastClean
}: {
  filter: MemoryFilter;
  setFilter: (filter: MemoryFilter) => void;
  engineeringFilter: EngineeringKindFilter;
  setEngineeringFilter: (filter: EngineeringKindFilter) => void;
  memories: Memory[];
  selectedMemory: Memory | null;
  newMemory: string;
  setNewMemory: (value: string) => void;
  addMemory: () => void;
  selectMemory: (memory: Memory) => void;
  archiveMemory: (memory: Memory) => void;
  deleteMemory: (memory: Memory) => void;
  verifyMemory: (memory: Memory) => void;
  togglePin: (memory: Memory) => void;
  applyFeedback: (memory: Memory, kind: FeedbackKind) => void;
  updateConsent: (memory: Memory, visibility: Memory["consent"]["visibility"]) => void;
  markSensitive: (memory: Memory) => void;
  exportUserMemories: () => void;
  exportPayload: string;
  lastClean: string[];
}) {
  return (
    <section className="memory-layout">
      <div className="panel inventory-panel">
        <div className="panel-title">
          <div>
            <h2>Memory Inventory</h2>
            <p>Every stored memory is visible with source, trust, status, and cleanup state.</p>
          </div>
          <ListFilter size={18} />
        </div>
        <div className="segmented" role="tablist" aria-label="Memory filters">
          {(["active", "needs-review", "archived", "all"] as MemoryFilter[]).map((item) => (
            <button key={item} className={filter === item ? "active" : undefined} onClick={() => setFilter(item)}>
              {itemLabel(item)}
            </button>
          ))}
        </div>
        <label className="select-field" htmlFor="engineering-kind-filter">
          <span>Engineering type</span>
          <select id="engineering-kind-filter" value={engineeringFilter} onChange={(event) => setEngineeringFilter(event.target.value as EngineeringKindFilter)}>
            {engineeringKindFilters.map((kind) => (
              <option key={kind} value={kind}>{kind === "all" ? "all engineering types" : kind}</option>
            ))}
          </select>
        </label>
        <div className="memory-list">
          {memories.map((memory) => (
            <button
              key={memory.id}
              className={`memory-row ${selectedMemory?.id === memory.id ? "selected" : ""}`}
              onClick={() => selectMemory(memory)}
            >
              <span className={`status-dot ${memory.archivedAt ? "archived" : needsReview(memory) ? "warn" : "ok"}`} />
              <span>
                <strong>{memory.content}</strong>
                <small>{memory.source.kind} · trust {memory.trust.toFixed(2)} · {engineeringKindLabel(memory) ?? `${memory.layer}/${memory.type}`}</small>
              </span>
              <meter value={memory.trust} min={0} max={1} />
            </button>
          ))}
        </div>
      </div>

      <div className="panel detail-panel">
        <div className="panel-title">
          <div>
            <h2>{selectedMemory ? "Memory Detail" : "No memory selected"}</h2>
            <p>Use this panel to verify, pin, archive, or delete a memory.</p>
          </div>
        </div>
        {selectedMemory ? (
          <article className="memory-detail">
            <strong>{selectedMemory.content}</strong>
            <dl>
              <div><dt>Status</dt><dd>{selectedMemory.archivedAt ? "archived" : needsReview(selectedMemory) ? "needs review" : "active"}</dd></div>
              <div><dt>Trust</dt><dd>{selectedMemory.trust.toFixed(2)}</dd></div>
              <div><dt>Source</dt><dd>{selectedMemory.source.kind}</dd></div>
              <div><dt>Layer</dt><dd>{selectedMemory.layer}</dd></div>
              <div><dt>Engineering</dt><dd>{engineeringKindLabel(selectedMemory) ?? "none"}</dd></div>
              <div><dt>Scope</dt><dd>{scopeLabel(selectedMemory)}</dd></div>
              <div><dt>Consent</dt><dd>{selectedMemory.consent.visibility}</dd></div>
              <div><dt>Tags</dt><dd>{selectedMemory.tags.join(", ") || "none"}</dd></div>
              <div><dt>Relations</dt><dd>{selectedMemory.relations.map((relation) => relation.type).join(", ") || "none"}</dd></div>
              <div><dt>Age</dt><dd>{ageLabel(selectedMemory.createdAt)}</dd></div>
            </dl>
            <p className="reason">{reviewReason(selectedMemory)}</p>
            <div className="detail-actions">
              <button className="secondary-action" onClick={() => verifyMemory(selectedMemory)}><CheckCircle2 size={16} /> Verify</button>
              <button className="secondary-action" onClick={() => togglePin(selectedMemory)}><Pin size={16} /> {selectedMemory.pinned ? "Unpin" : "Pin"}</button>
              <button className="secondary-action" onClick={() => markSensitive(selectedMemory)}><Eye size={16} /> Sensitive</button>
              <button className="secondary-action" onClick={() => archiveMemory(selectedMemory)} disabled={Boolean(selectedMemory.archivedAt)}><Archive size={16} /> Archive</button>
              <button className="danger-action" onClick={() => deleteMemory(selectedMemory)}><Trash2 size={16} /> Delete</button>
            </div>
            <div className="consent-tools" aria-label="Consent controls">
              <label>
                <span>Consent visibility</span>
                <select value={selectedMemory.consent.visibility} onChange={(event) => updateConsent(selectedMemory, event.target.value as Memory["consent"]["visibility"])}>
                  <option value="private">private</option>
                  <option value="user">user</option>
                  <option value="org">org</option>
                  <option value="public">public</option>
                </select>
              </label>
              <button className="secondary-action" onClick={exportUserMemories}><Download size={16} /> Export user</button>
            </div>
            <div className="feedback-grid" aria-label="Memory feedback">
              <button className="secondary-action" onClick={() => applyFeedback(selectedMemory, "helpful")}><CheckCircle2 size={15} /> Helpful</button>
              <button className="secondary-action" onClick={() => applyFeedback(selectedMemory, "wrong")}><ShieldCheck size={15} /> Wrong</button>
              <button className="secondary-action" onClick={() => applyFeedback(selectedMemory, "always_include")}><Pin size={15} /> Always</button>
              <button className="secondary-action" onClick={() => applyFeedback(selectedMemory, "never_include")}><Archive size={15} /> Never</button>
              {selectedMemory.metadata.patternReview ? (
                <>
                  <button className="secondary-action" onClick={() => applyFeedback(selectedMemory, "approve_pattern")}><CheckCircle2 size={15} /> Approve</button>
                  <button className="danger-action" onClick={() => applyFeedback(selectedMemory, "reject_pattern")}><Trash2 size={15} /> Reject</button>
                </>
              ) : null}
            </div>
          </article>
        ) : null}
        <div className="add-memory">
          <label htmlFor="new-memory">Add verified memory</label>
          <textarea id="new-memory" value={newMemory} onChange={(event) => setNewMemory(event.target.value)} placeholder="Write a fact, preference, procedure, or correction..." />
          <button onClick={addMemory}><Plus size={16} /> Add memory</button>
        </div>
        <ActionLog actions={lastClean} />
        {exportPayload ? (
          <div className="export-preview">
            <strong>Export preview</strong>
            <pre>{exportPayload}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecallView({
  query,
  setQuery,
  results,
  selectedMemory,
  selectMemory,
  routePreview,
  retrievalWeights,
  setRetrievalWeights,
  graphDepth,
  setGraphDepth
}: {
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  selectedMemory: Memory | null;
  selectMemory: (memory: Memory) => void;
  routePreview: RoutePreview;
  retrievalWeights: Record<string, number>;
  setRetrievalWeights: React.Dispatch<React.SetStateAction<{ semantic: number; keyword: number; entity: number; temporal: number; behavioral: number; trust: number; graph: number; access: number }>>;
  graphDepth: number;
  setGraphDepth: React.Dispatch<React.SetStateAction<number>>;
}) {
  const defaultWeights = { semantic: 0.26, keyword: 0.24, entity: 0.16, temporal: 0.08, behavioral: 0.05, trust: 0.18, graph: 0.06, access: 0.02 };
  return (
    <section className="recall-layout">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Recall Test</h2>
            <p>Ask the exact question an agent would ask before context injection.</p>
          </div>
        </div>
        <label htmlFor="query">Workflow question</label>
        <div className="query-row">
          <input id="query" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button><Search size={17} /> Search</button>
        </div>
        <div className="route-preview" aria-label="Memory route preview">
          <div>
            <strong>Route Preview</strong>
            <small>{routePreview.reasoning.join(" ")}</small>
          </div>
          <div className="route-scope-grid">
            {routePreview.selectedScopes.map((scope) => (
              <span key={`${scope.kind}:${scope.id}`} title={scope.reason}>{scope.kind}: {scope.id}</span>
            ))}
          </div>
          {routePreview.excludedScopes.length ? (
            <div className="route-excluded">
              {routePreview.excludedScopes.map((scope) => (
                <span key={`${scope.kind}:${scope.id}`} title={scope.reason}>blocked {scope.kind}: {scope.id}</span>
              ))}
            </div>
          ) : <small>No scope excluded for this query.</small>}
        </div>
        <div className="result-list">
          {results.map((result) => (
            <button key={result.memory.id} className="result" onClick={() => selectMemory(result.memory)}>
              <span>{result.score.toFixed(2)}</span>
              <strong>{result.memory.content}</strong>
              <small>{result.citation} · trust {result.memory.trust.toFixed(2)} · stale={String(result.stale)}</small>
              <small>{(result.explanation ?? []).join(" · ")}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Context Pack Preview</h2>
            <p>The agent would receive this ranked evidence, with score signals visible.</p>
          </div>
        </div>
        <div className="signal-list">
          {results.slice(0, 3).map((result) => (
            <article key={result.memory.id}>
              <strong>{shortId(result.memory)} · {result.score.toFixed(2)} · confidence {(result.confidence ?? result.score).toFixed(2)}</strong>
              <span>semantic {result.signals.semantic.toFixed(2)}</span>
              <span>keyword {result.signals.keyword.toFixed(2)}</span>
              <span>trust {result.signals.trust.toFixed(2)}</span>
              <span>graph {result.signals.graph.toFixed(2)}</span>
              <span>source {result.memory.source.kind}</span>
              <span>citation {result.citation}</span>
              <span>policy {result.decision ?? "include"}</span>
              <span>{result.queryPlan?.queryType ?? "direct_fact"}</span>
              <span>profile {result.queryPlan?.recommendedMode ?? "hybrid"}</span>
              <span>{result.unsafeToInject ? "unsafe" : "injectable"}</span>
              <span>valid {result.memory.temporal.validUntil ? `until ${new Date(result.memory.temporal.validUntil).toLocaleDateString()}` : "until superseded"}</span>
              <span>{supersessionLabel(result.memory)}</span>
              <p className="why-used-line">Why used: {(result.explanation ?? []).slice(0, 4).join(" · ") || "direct match"}</p>
              <p className="why-used-line">Evidence: {result.citation}{result.graphPaths?.length ? ` · ${result.graphPaths[0]}` : ""}</p>
              <p>{result.memory.content}</p>
            </article>
          ))}
        </div>
        <details className="export-preview">
          <summary>Export evidence JSON</summary>
          <pre>{JSON.stringify(results.slice(0, 3).map((result) => ({
            memoryId: result.memory.id,
            whySelected: result.explanation ?? [],
            source: result.memory.source,
            citation: result.citation,
            trust: result.memory.trust,
            confidence: result.confidence ?? result.score,
            policyDecision: result.decision ?? "include",
            graphPaths: result.graphPaths ?? [],
            temporalValidity: result.memory.temporal,
            contradiction: result.contradiction,
            supersessionState: result.memory.beliefState,
            retrievalProfile: result.queryPlan?.recommendedMode ?? "hybrid",
            signals: result.signals
          })), null, 2)}</pre>
        </details>
        {selectedMemory ? <MemoryMini memory={selectedMemory} /> : null}
      </div>
      <div className="panel tuning-panel wide-panel">
        <div className="panel-title">
          <div>
            <h2>Retrieval Tuning Preview</h2>
            <p>Adjust ranking pressure and watch the context pack change before saving a profile.</p>
          </div>
          <button className="secondary-action" onClick={() => setRetrievalWeights(defaultWeights)}><SlidersHorizontal size={16} /> Rollback</button>
        </div>
        <div className="slider-grid">
          {(["semantic", "keyword", "entity", "temporal", "behavioral", "trust", "graph", "access"] as const).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights[key]}
                onChange={(event) => setRetrievalWeights((weights) => ({ ...weights, [key]: Number(event.target.value) }))}
              />
              <b>{retrievalWeights[key].toFixed(2)}</b>
            </label>
          ))}
          <label>
            <span>graph depth</span>
            <input type="range" min="1" max="6" step="1" value={graphDepth} onChange={(event) => setGraphDepth(Number(event.target.value))} />
            <b>{graphDepth}</b>
          </label>
        </div>
        <div className="context-preview">
          {results.slice(0, 5).map((result) => (
            <span key={result.memory.id}>{shortId(result.memory)} · {result.score.toFixed(2)} · {(result.decision ?? "include")}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function GraphView({ memories }: { memories: Memory[] }) {
  const [from, setFrom] = useState("Mira");
  const [to, setTo] = useState("transcript");
  const [query, setQuery] = useState("Mira transcript correction");
  const [sourceFilter, setSourceFilter] = useState<"all" | Memory["source"]["kind"]>("all");
  const active = memories.filter((memory) => !memory.archivedAt);
  const visible = sourceFilter === "all" ? active : active.filter((memory) => memory.source.kind === sourceFilter);
  const paths = findGraphPaths(visible, from, to, { maxDepth: 4, limit: 4 });
  const activation = activateGraph(visible, query, { maxDepth: 3, limit: 8 });
  const exported = exportMemoryGraph(visible, { format: "json" }) as { nodes: Array<{ id: string; label: string; kind: string }>; edges: Array<{ from: string; to: string; type: string; confidence: number }> };
  const clusters = clusterEntities(visible);
  return (
    <section className="recall-layout">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Graph Explorer</h2>
            <p>Inspect entity-memory paths, relation confidence, and activation chains.</p>
          </div>
          <GitBranch size={18} />
        </div>
        <div className="segmented compact" role="tablist" aria-label="Graph source filters">
          {(["all", "human", "reviewed_code", "tool", "agent", "transcript", "import"] as const).map((kind) => (
            <button key={kind} className={sourceFilter === kind ? "active" : undefined} onClick={() => setSourceFilter(kind)}>{kind === "reviewed_code" ? "code" : kind}</button>
          ))}
        </div>
        <div className="query-row">
          <input aria-label="From node" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input aria-label="To node" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="result-list">
          {paths.map((path, index) => (
            <article key={`${path.score}-${index}`} className="result">
              <span>{path.score.toFixed(2)}</span>
              <strong>{path.explanation[0] ?? "Direct connection"}</strong>
              <small>{path.edges.map((edge) => `${edge.type} ${edge.confidence.toFixed(2)}`).join(" · ")}</small>
              <small>{path.edges.map((edge) => edge.source?.kind ?? "memory").join(" · ")}</small>
            </article>
          ))}
          {!paths.length ? <p className="empty-state">No path for the selected endpoints.</p> : null}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Spreading Activation</h2>
            <p>See which graph nodes become relevant after traversing nearby evidence.</p>
          </div>
          <Network size={18} />
        </div>
        <input aria-label="Activation query" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="signal-list">
          {activation.ranked.slice(0, 5).map((node) => (
            <article key={node.nodeId}>
              <strong>{node.label}</strong>
              <span>{node.kind}</span>
              <span>activation {node.score.toFixed(2)}</span>
              <p>{node.explanation[0] ?? "Seed-adjacent graph evidence"}</p>
            </article>
          ))}
        </div>
        <div className="artifact-summary">
          <span>{exported.nodes.length} nodes</span>
          <span>{exported.edges.length} edges</span>
          <span>GraphML export available from API/CLI</span>
        </div>
        <div className="cluster-list">
          {clusters.slice(0, 5).map((cluster) => (
            <span key={cluster.entity}>{cluster.entity}: {cluster.count} memories</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineView({
  memories,
  timeZoom,
  setTimeZoom,
  applyFeedback,
  selectMemory
}: {
  memories: Memory[];
  timeZoom: TimeZoom;
  setTimeZoom: (zoom: TimeZoom) => void;
  applyFeedback: (memory: Memory, kind: FeedbackKind) => void;
  selectMemory: (memory: Memory) => void;
}) {
  const [tagFilter, setTagFilter] = useState("all");
  const [annotation, setAnnotation] = useState("");
  const events = timelineEvents(memories, timeZoom, tagFilter);
  const patterns = memories.filter((memory) => memory.tags.includes("pattern") || Boolean(memory.metadata.patternReview));
  const tags = ["all", ...Array.from(new Set(memories.flatMap((memory) => memory.tags))).slice(0, 8)];
  return (
    <section className="timeline-layout">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Temporal Explorer</h2>
            <p>Zoom into recent memory changes and filter the event stream before it becomes context.</p>
          </div>
          <Clock3 size={18} />
        </div>
        <div className="segmented compact" role="tablist" aria-label="Timeline zoom">
          {(["day", "week", "month", "all"] as TimeZoom[]).map((zoom) => (
            <button key={zoom} className={timeZoom === zoom ? "active" : undefined} onClick={() => setTimeZoom(zoom)}>{zoom}</button>
          ))}
        </div>
        <label>
          <span>Event filter</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <div className="timeline-list">
          {events.map((event) => (
            <button key={event.memory.id} className="timeline-row" onClick={() => selectMemory(event.memory)}>
              <span>{event.day}</span>
              <strong>{event.memory.content}</strong>
              <small>{event.memory.source.kind} · {event.memory.tags.join(", ") || "untagged"}</small>
            </button>
          ))}
          {!events.length ? <p className="empty-state">No events match this zoom and filter.</p> : null}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Pattern Overlay</h2>
            <p>Review inferred habits and recurring memory workflows before promoting them.</p>
          </div>
          <Activity size={18} />
        </div>
        <div className="pattern-list">
          {patterns.map((memory) => {
            const review = memory.metadata.patternReview as { status?: string; confidence?: number; cadence?: string; support?: number } | undefined;
            return (
              <article key={memory.id} className="pattern-card">
                <strong>{memory.content}</strong>
                <span>{review?.cadence ?? "observed pattern"} · confidence {(review?.confidence ?? memory.trust).toFixed(2)} · support {review?.support ?? 1}</span>
                <div className="detail-actions">
                  <button className="secondary-action" onClick={() => applyFeedback(memory, "approve_pattern")}><CheckCircle2 size={15} /> Approve</button>
                  <button className="danger-action" onClick={() => applyFeedback(memory, "reject_pattern")}><Trash2 size={15} /> Reject</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="annotation-box">
          <label htmlFor="timeline-annotation">Annotation</label>
          <textarea id="timeline-annotation" value={annotation} onChange={(event) => setAnnotation(event.target.value)} placeholder="Add an operator note for this timeline review..." />
          <span>{annotation ? "Annotation staged for the next memory write." : "No annotation staged."}</span>
        </div>
      </div>
    </section>
  );
}

function DreamView({
  report,
  memories,
  runDreamCycle,
  lastClean,
  retrievalWeights,
  setRetrievalWeights,
  lifecyclePolicy,
  setLifecyclePolicy
}: {
  report: ReflectionReport | null;
  memories: Memory[];
  runDreamCycle: () => void;
  lastClean: string[];
  retrievalWeights: Record<string, number>;
  setRetrievalWeights: React.Dispatch<React.SetStateAction<{ semantic: number; keyword: number; entity: number; temporal: number; behavioral: number; trust: number; graph: number; access: number }>>;
  lifecyclePolicy: { fadeAfterDays: number; archiveAfterDays: number };
  setLifecyclePolicy: React.Dispatch<React.SetStateAction<{ fadeAfterDays: number; archiveAfterDays: number }>>;
}) {
  const lifecycle = report?.lifecycle;
  return (
    <section className="dream-layout">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>What the Dream Cycle Does</h2>
            <p>It resolves contradictions, fades stale low-utility facts, archives risky items, creates summaries, and reorganizes memories into better layers.</p>
          </div>
          <button onClick={runDreamCycle}><Sparkles size={17} /> Run now</button>
        </div>
        <div className="lifecycle-grid">
          {[
            ["evaluated", lifecycle?.evaluated ?? memories.filter((memory) => !memory.archivedAt).length],
            ["summarized", lifecycle?.summarized ?? 0],
            ["faded", lifecycle?.faded ?? 0],
            ["archived", lifecycle?.archived ?? 0],
            ["reorganized", lifecycle?.reorganized ?? 0]
          ].map(([label, value]) => (
            <article key={label} className="lifecycle-card">
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <ActionLog actions={lastClean} empty="Run the dream cycle to see exact memory operations." />
      </div>
      <div className="panel tuning-panel">
        <div className="panel-title">
          <div>
            <h2>Operator Tuning</h2>
            <p>Adjust recall and lifecycle pressure before running the next maintenance pass.</p>
          </div>
          <ShieldCheck size={18} />
        </div>
        <div className="slider-grid">
          {(["semantic", "keyword", "entity", "temporal", "behavioral", "trust", "graph", "access"] as const).map((key) => (
            <label key={key}>
              <span>{key}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights[key]}
                onChange={(event) => setRetrievalWeights((weights) => ({ ...weights, [key]: Number(event.target.value) }))}
              />
              <b>{retrievalWeights[key].toFixed(2)}</b>
            </label>
          ))}
          <label>
            <span>fade days</span>
            <input
              type="range"
              min="7"
              max="180"
              step="1"
              value={lifecyclePolicy.fadeAfterDays}
              onChange={(event) => setLifecyclePolicy((policy) => ({ ...policy, fadeAfterDays: Number(event.target.value) }))}
            />
            <b>{lifecyclePolicy.fadeAfterDays}</b>
          </label>
          <label>
            <span>archive days</span>
            <input
              type="range"
              min="14"
              max="365"
              step="1"
              value={lifecyclePolicy.archiveAfterDays}
              onChange={(event) => setLifecyclePolicy((policy) => ({ ...policy, archiveAfterDays: Number(event.target.value) }))}
            />
            <b>{lifecyclePolicy.archiveAfterDays}</b>
          </label>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Cycle Output</h2>
            <p>Created reflections, demoted facts, and remaining quality issues stay inspectable.</p>
          </div>
          <span className="proof-badge">quality {Math.round((lifecycle?.qualityScore ?? 1) * 100)}%</span>
        </div>
        <div className="cycle-output">
          <OutputGroup title="Created summaries" items={(report?.created ?? []).map((memory) => memory.content)} />
          <OutputGroup title="Demoted or archived" items={(report?.demoted ?? []).map((memory) => `${shortId(memory)} · trust ${memory.trust.toFixed(2)} · ${memory.content}`)} />
          <OutputGroup title="Quality issues" items={lifecycle?.issues ?? []} />
        </div>
      </div>
    </section>
  );
}

function MarketplaceView({
  modules,
  installModule,
  runtime,
  installingModuleId,
  notice
}: {
  modules: MarketplaceModuleCard[];
  installModule: (moduleId: string) => void | Promise<void>;
  runtime: RuntimeStatus;
  installingModuleId: string | null;
  notice: string;
}) {
  const [kind, setKind] = useState<"all" | MarketplaceModuleCard["kind"]>("all");
  const [selectedId, setSelectedId] = useState(modules[0]?.id ?? "");
  const filtered = kind === "all" ? modules : modules.filter((module) => module.kind === kind);
  const selected = modules.find((module) => module.id === selectedId) ?? filtered[0] ?? modules[0];
  const canInstall = runtime.state === "online" && selected?.status !== "installed" && installingModuleId !== selected?.id;
  return (
    <section className="market-layout">
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Marketplace Browser</h2>
            <p>{runtime.state === "online" ? "Live modules from the API runtime. Installs mutate the service registry." : "Preview modules are visible, but install is disabled until the API is online."}</p>
          </div>
          {runtime.state === "online" ? <ShoppingBag size={18} /> : <WifiOff size={18} />}
        </div>
        <div className={`runtime-chip ${runtime.state} market-status`}>
          <Activity size={14} />
          <span>{notice}</span>
        </div>
        <div className="segmented compact" role="tablist" aria-label="Marketplace filters">
          {(["all", "connector", "domain", "persona", "retrieval_profile"] as const).map((item) => (
            <button key={item} className={kind === item ? "active" : undefined} onClick={() => setKind(item)}>{item === "retrieval_profile" ? "profiles" : item}</button>
          ))}
        </div>
        <div className="module-list">
          {filtered.map((module) => (
            <button key={module.id} className={`module-row ${selected?.id === module.id ? "selected" : ""}`} onClick={() => setSelectedId(module.id)}>
              <span>{module.kind}</span>
              <strong>{module.name}</strong>
              <small>{module.summary}</small>
              <em>{module.status}{module.securityStatus ? ` / ${module.securityStatus}` : ""}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h2>Install Preview</h2>
            <p>Review manifest shape and runtime effect before enabling a module.</p>
          </div>
          {selected ? <button disabled={!canInstall} onClick={() => installModule(selected.id)}><Plus size={16} /> {installingModuleId === selected.id ? "Installing" : selected.status === "installed" ? "Installed" : "Install"}</button> : null}
        </div>
        {selected ? (
          <article className="module-detail">
            <strong>{selected.name}</strong>
            <span>{selected.kind} · v{selected.version} · {selected.status}{selected.securityStatus ? ` · ${selected.securityStatus}` : ""}</span>
            <p>{selected.summary}</p>
            <pre>{JSON.stringify(selected.manifest, null, 2)}</pre>
          </article>
        ) : <p className="empty-state">No module selected.</p>}
      </div>
    </section>
  );
}

function ProofView({
  artifactText,
  setArtifactText,
  artifactSummary,
  metrics
}: {
  artifactText: string;
  setArtifactText: (value: string) => void;
  artifactSummary: string[];
  metrics?: MetricsReport;
}) {
  return (
    <section className="proof-layout">
      <div className="benchmark-grid">
        {certifiedBenchmarks.map((benchmark) => (
          <article key={benchmark.dataset} className="benchmark-card">
            <div>
              <span>{benchmark.metric}</span>
              <strong>{benchmark.dataset}</strong>
            </div>
            <b>{benchmark.accuracy.toFixed(2)}%</b>
            <small>cognibrain {benchmark.ours}</small>
            <small>Best baseline {benchmark.baseline}</small>
            <em>+{benchmark.margin.toFixed(2)}pp margin</em>
            <code>{benchmark.artifact}</code>
          </article>
        ))}
      </div>
      <div className="proof-split">
        <div className="panel">
          <h2><Activity size={17} /> Runtime Analytics</h2>
          <div className="ability-list">
            <div className="ability-row"><span>searches</span><strong>{metrics?.searches ?? 0}</strong></div>
            <div className="ability-row"><span>no-hit</span><strong>{metrics?.noHitSearches ?? 0}</strong></div>
            <div className="ability-row"><span>low confidence</span><strong>{metrics?.lowConfidenceSearches ?? 0}</strong></div>
            <div className="ability-row"><span>benchmark runs</span><strong>{metrics?.benchmarkRuns ?? 0}</strong></div>
          </div>
        </div>
        <div className="panel">
          <h2><CheckCircle2 size={17} /> BEAM Ability Breakdown</h2>
          <div className="ability-list">
            {beamCategories.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><GitBranch size={17} /> Nextgen Substrate</h2>
          <div className="ability-list">
            {nextgenProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><Network size={17} /> Harness Packages</h2>
          <div className="ability-list">
            {harnessProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><Activity size={17} /> Harness Runs</h2>
          <div className="ability-list">
            {harnessRunProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><FileJson size={17} /> Patch Evidence Trail</h2>
          <div className="ability-list">
            {patchEvidenceProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><BarChart3 size={17} /> Proof Trend</h2>
          <div className="trend-list">
            {certifiedBenchmarks.map((benchmark) => (
              <div key={benchmark.dataset} className="trend-row">
                <span>{benchmark.dataset}</span>
                <meter min={0} max={100} value={benchmark.accuracy} />
                <strong>+{benchmark.margin.toFixed(2)}pp</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><FileJson size={17} /> Artifact Inspector</h2>
          <p>Paste local or CI-uploaded benchmark JSON to inspect proof without leaving the operator console.</p>
          <textarea
            value={artifactText}
            onChange={(event) => setArtifactText(event.target.value)}
            placeholder="Paste market-gate.json or a benchmark report JSON"
          />
          <div className="artifact-summary">
            {artifactSummary.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <CogniCodeBenchAblation artifactText={artifactText} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MemoryMini({ memory }: { memory: Memory }) {
  return (
    <article className="memory-mini">
      <strong>{shortId(memory)}</strong>
      <p>{memory.content}</p>
      <small>{memory.source.kind} · trust {memory.trust.toFixed(2)} · {memory.layer} · {memory.consent.visibility}</small>
    </article>
  );
}

function engineeringKindLabel(memory: Memory): string | undefined {
  const engineering = memory.metadata.engineering as { kind?: string; codebase?: { repo?: string; branch?: string; filePattern?: string } } | undefined;
  if (!engineering?.kind) return undefined;
  const scope = [engineering.codebase?.repo, engineering.codebase?.branch, engineering.codebase?.filePattern].filter(Boolean).join(" / ");
  return scope ? `${engineering.kind} · ${scope}` : engineering.kind;
}

function ActionLog({ actions, empty = "No cleanup actions yet." }: { actions: string[]; empty?: string }) {
  return (
    <div className="action-log">
      <strong>Action Log</strong>
      {(actions.length ? actions : [empty]).map((action) => (
        <span key={action}>{action}</span>
      ))}
    </div>
  );
}

function OutputGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="output-group">
      <strong>{title}</strong>
      {(items.length ? items : ["None"]).map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function CogniCodeBenchAblation({ artifactText }: { artifactText: string }) {
  const rows = useMemo(() => {
    if (!artifactText.trim()) return [];
    try {
      const parsed = JSON.parse(artifactText) as {
        benchmark?: string;
        ablation?: Record<string, { score?: number; deltaFromFull?: number }>;
      };
      if (parsed.benchmark !== "CogniCodeBench" || !parsed.ablation) return [];
      return Object.entries(parsed.ablation)
        .map(([name, value]) => ({
          name,
          score: Number(value.score ?? 0),
          delta: Number(value.deltaFromFull ?? 0)
        }))
        .sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }, [artifactText]);
  if (!rows.length) return null;
  return (
    <div className="trend-list" aria-label="CogniCodeBench ablation chart">
      {rows.map((row) => (
        <div key={row.name} className="trend-row">
          <span>{row.name}</span>
          <meter min={0} max={100} value={Math.round(row.score * 100)} />
          <strong>{(row.score * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}

function summarizeArtifact(value: string): string[] {
  if (!value.trim()) return ["Paste an artifact to inspect pass status, proof level, and benchmark rows."];
  try {
    const parsed = JSON.parse(value) as {
      passed?: boolean;
      proofLevel?: string;
      source?: { name?: string };
      ours?: { correct?: number; total?: number; accuracy?: number };
      benchmarks?: Array<{
        dataset?: string;
        name?: string;
        margin?: number;
        accuracy?: number;
        ours?: { correct?: number; total?: number; accuracy?: number };
        questions?: Array<{ id: string; passed?: boolean; score?: number; expected?: string[]; retrieved?: string[] }>;
      }>;
      datasets?: Array<{
        dataset: string;
        score: number;
        total?: number;
        questions?: Array<{ id: string; generatedAnswer?: string; expected?: string[]; judge?: { passed?: boolean; score?: number; reason?: string } }>;
      }>;
      benchmark?: string;
      scenarioCount?: number;
      metrics?: {
        correctionCarryoverRate?: number;
        repeatedMistakeRate?: number;
        procedureRecallRate?: number;
        wrongMemorySuppression?: number;
      };
      ablation?: Record<string, { score?: number }>;
      harnessRuns?: Array<{ harness?: string; repo?: string; passed?: boolean; checks?: Record<string, boolean> }>;
      checks?: Record<string, boolean>;
    };
    if (parsed.harnessRuns?.length) {
      return [
        `connectorProof passed=${String(parsed.passed)} checks=${Object.values(parsed.checks ?? {}).filter(Boolean).length}/${Object.keys(parsed.checks ?? {}).length}`,
        ...parsed.harnessRuns.map((run) => {
          const passed = Object.values(run.checks ?? {}).filter(Boolean).length;
          const total = Object.keys(run.checks ?? {}).length;
          return `${run.harness ?? "harness"} repo=${run.repo ?? "n/a"} passed=${String(run.passed)} ${passed}/${total}`;
        })
      ];
    }
    if (parsed.benchmark === "CogniCodeBench") {
      const full = parsed.ablation?.cognibrain_full?.score ?? 0;
      const bestBaseline = Math.max(...Object.entries(parsed.ablation ?? {}).filter(([name]) => name !== "cognibrain_full").map(([, value]) => value.score ?? 0), 0);
      return [
        `benchmark=CogniCodeBench scenarios=${parsed.scenarioCount ?? 0}`,
        `passed=${String(parsed.passed)} full=${(full * 100).toFixed(2)}% bestBaseline=${(bestBaseline * 100).toFixed(2)}%`,
        `correctionCarryover=${parsed.metrics?.correctionCarryoverRate ?? 0}`,
        `repeatedMistakeRate=${parsed.metrics?.repeatedMistakeRate ?? 1}`,
        `procedureRecall=${parsed.metrics?.procedureRecallRate ?? 0}`,
        `wrongMemorySuppression=${parsed.metrics?.wrongMemorySuppression ?? 0}`
      ];
    }
    if (parsed.benchmarks) {
      const failedRows = parsed.benchmarks.flatMap((benchmark) =>
        (benchmark.questions ?? [])
          .filter((question) => question.passed === false)
          .slice(0, 4)
          .map((question) => `${benchmark.dataset ?? benchmark.name ?? "benchmark"}/${question.id}: failed, expected ${(question.expected ?? []).slice(0, 3).join(", ") || "n/a"}`)
      );
      return [
        `passed=${parsed.passed === undefined ? "not provided" : String(parsed.passed)}`,
        `proof=${parsed.proofLevel ?? "unknown"}`,
        ...parsed.benchmarks.map((benchmark) => {
          const label = benchmark.dataset ?? benchmark.name ?? "benchmark";
          const score = benchmark.ours?.correct !== undefined && benchmark.ours?.total !== undefined
            ? `${benchmark.ours.correct}/${benchmark.ours.total}`
            : benchmark.accuracy !== undefined
              ? `${(benchmark.accuracy * 100).toFixed(2)}%`
              : "score unavailable";
          const margin = benchmark.margin !== undefined ? `, margin ${(benchmark.margin * 100).toFixed(2)}pp` : "";
          return `${label}: ${score}${margin}, questions=${benchmark.questions?.length ?? 0}`;
        }),
        ...(failedRows.length ? ["Failed question rows:", ...failedRows] : ["Failed question rows: none in artifact"])
      ];
    }
    if (parsed.datasets) {
      const failedRows = parsed.datasets.flatMap((dataset) =>
        (dataset.questions ?? [])
          .filter((question) => question.judge?.passed === false)
          .slice(0, 4)
          .map((question) => `${dataset.dataset}/${question.id}: score ${(question.judge?.score ?? 0).toFixed(2)}, expected ${(question.expected ?? []).slice(0, 3).join(", ") || "n/a"}`)
      );
      return [
        `answer-artifact datasets=${parsed.datasets.length}`,
        ...parsed.datasets.map((dataset) => `${dataset.dataset}: score ${(dataset.score * 100).toFixed(2)}%, questions=${dataset.total ?? dataset.questions?.length ?? 0}`),
        ...(failedRows.length ? ["Failed judged rows:", ...failedRows] : ["Failed judged rows: none in artifact"])
      ];
    }
    if (parsed.ours) {
      return [
        `dataset=${parsed.source?.name ?? "unknown"}`,
        `passed=${String(parsed.passed)}`,
        `score=${parsed.ours.correct}/${parsed.ours.total}`,
        `accuracy=${(((parsed.ours.accuracy ?? 0) * 100)).toFixed(2)}%`
      ];
    }
    return ["Artifact parsed, but no known benchmark fields were found."];
  } catch (error) {
    return [`Invalid JSON: ${(error as Error).message}`];
  }
}

function filterMemories(memories: Memory[], filter: MemoryFilter, engineeringFilter: EngineeringKindFilter): Memory[] {
  const byStatus = filter === "all"
    ? memories
    : filter === "archived"
      ? memories.filter((memory) => memory.archivedAt)
      : filter === "needs-review"
        ? memories.filter((memory) => !memory.archivedAt && needsReview(memory))
        : memories.filter((memory) => !memory.archivedAt);
  if (engineeringFilter === "all") return byStatus;
  return byStatus.filter((memory) => {
    const engineering = memory.metadata.engineering as { kind?: string } | undefined;
    return engineering?.kind === engineeringFilter;
  });
}

function needsReview(memory: Memory): boolean {
  const patternReview = memory.metadata.patternReview as { status?: string } | undefined;
  const privacy = memory.metadata.privacy as { action?: string } | undefined;
  return !memory.archivedAt && (memory.trust < 0.55 || memory.source.kind === "transcript" || memory.tags.includes("needs-review") || patternReview?.status === "pending" || privacy?.action === "encrypt");
}

function reviewReason(memory: Memory): string {
  if (memory.archivedAt) return "This memory is archived and will not be injected.";
  if (memory.pinned) return "Pinned memory. It will survive cleanup unless explicitly changed.";
  if (memory.source.kind === "transcript") return "Transcript source: verify with a human before injecting.";
  if ((memory.metadata.patternReview as { status?: string } | undefined)?.status === "pending") return "Inferred behavioral pattern: approve before treating it as stable.";
  if ((memory.metadata.privacy as { action?: string } | undefined)?.action === "encrypt") return "Encrypted sensitive memory: review policy before use.";
  if (memory.trust < 0.55) return "Low trust: archive, verify, or replace with better evidence.";
  if (memory.tags.includes("needs-review")) return "Tagged for review.";
  return "Ready for context injection.";
}

function supersessionLabel(memory: Memory): string {
  if (memory.beliefState === "superseded") return "superseded by newer correction";
  if (memory.beliefState === "contradicted") return "contradiction warning";
  if (memory.beliefState === "stale") return "stale rule";
  if (memory.beliefState === "needs_verification") return "needs verification";
  if (memory.temporal.supersededAt) return `superseded ${new Date(memory.temporal.supersededAt).toLocaleDateString()}`;
  return "current rule";
}

function itemLabel(item: MemoryFilter): string {
  return item === "needs-review" ? "Needs review" : item[0].toUpperCase() + item.slice(1);
}

function shortId(memory: Memory): string {
  return memory.id.slice(0, 8);
}

function scopeLabel(memory: Memory): string {
  return [memory.orgId, memory.appId, memory.sessionId, memory.projectId].filter(Boolean).join(" / ") || "user";
}

function previewRoute(query: string, memories: Memory[], results: SearchResult[]): RoutePreview {
  const selected = new Map<string, { kind: string; id: string; reason: string }>();
  const excluded = new Map<string, { kind: string; id: string; reason: string }>();
  const topMemories = results.map((result) => result.memory);
  const addSelected = (kind: string, id: string | undefined, reason: string) => {
    if (!id) return;
    selected.set(`${kind}:${id}`, { kind, id, reason });
  };
  const addExcluded = (kind: string, id: string | undefined, reason: string) => {
    if (!id) return;
    excluded.set(`${kind}:${id}`, { kind, id, reason });
  };

  addSelected("user", "demo", "demo user is the base route");
  for (const memory of topMemories) {
    addSelected("session", memory.sessionId, "top evidence contains this session scope");
    addSelected("app", memory.appId, "top evidence contains this app scope");
    addSelected("project", memory.projectId, "top evidence contains this project scope");
    addSelected("org", memory.orgId, "top evidence contains this org scope");
    addSelected("brain", memory.brainId, "top evidence contains this brain scope");
    addSelected("agent", memory.agentId, "top evidence contains this agent scope");
    addSelected("persona", typeof memory.metadata.personaId === "string" ? memory.metadata.personaId : undefined, "top evidence contains this persona scope");
  }

  const privateOffRoute = memories
    .filter((memory) => !topMemories.some((top) => top.id === memory.id))
    .filter((memory) => memory.consent.visibility === "private" && query.toLowerCase().includes("team"))
    .slice(0, 3);
  for (const memory of privateOffRoute) addExcluded("private", shortId(memory), "private memory is held back from team-style routing");

  const reasoning = [
    topMemories.some((memory) => memory.projectId || memory.brainId) ? "Project and brain scopes are selected from ranked evidence." : "Base route uses user memory plus matching evidence scopes.",
    query.toLowerCase().includes("team") ? "Team wording keeps private memories out unless consent allows sharing." : "Consent gates are checked before context injection."
  ];
  return { selectedScopes: [...selected.values()], excludedScopes: [...excluded.values()], reasoning };
}

function ageLabel(date: Date): string {
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function findMemory(memories: Memory[], id: string): Memory | null {
  return memories.find((memory) => memory.id === id) ?? null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clusterEntities(memories: Memory[]): Array<{ entity: string; count: number }> {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    for (const entity of memory.entities) counts.set(entity, (counts.get(entity) ?? 0) + 1);
  }
  return [...counts.entries()].map(([entity, count]) => ({ entity, count })).sort((a, b) => b.count - a.count || a.entity.localeCompare(b.entity));
}

function timelineEvents(memories: Memory[], zoom: TimeZoom, tagFilter: string): Array<{ day: string; memory: Memory }> {
  const cutoffDays = zoom === "day" ? 1 : zoom === "week" ? 7 : zoom === "month" ? 31 : 10_000;
  const cutoff = Date.now() - cutoffDays * 86_400_000;
  return memories
    .filter((memory) => !memory.archivedAt)
    .filter((memory) => memory.createdAt.getTime() >= cutoff)
    .filter((memory) => tagFilter === "all" || memory.tags.includes(tagFilter))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((memory) => ({ day: memory.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }), memory }));
}

function viewTitle(view: ViewId): string {
  if (view === "memories") return "Memory workbench";
  if (view === "recall") return "Recall tuning";
  if (view === "graph") return "Knowledge graph";
  if (view === "timeline") return "Temporal patterns";
  if (view === "dream") return "Dream and cleanup";
  if (view === "marketplace") return "Marketplace setup";
  return "Benchmark proof";
}

function viewSubtitle(view: ViewId): string {
  if (view === "memories") return "Inspect every memory, understand trust, and remove anything that should not shape agent behavior.";
  if (view === "recall") return "Preview ranked context, tune signal weights, and roll back unsafe recall changes.";
  if (view === "graph") return "Trace entity paths, source filters, clusters, and activation before injecting multi-hop evidence.";
  if (view === "timeline") return "Inspect memory chronology, recurring patterns, and review annotations.";
  if (view === "dream") return "Run memory hygiene and inspect each summary, demotion, archive, and reorganization.";
  if (view === "marketplace") return "Browse modules, personas, connectors, and retrieval profiles before installation.";
  return "Validate benchmark claims and inspect public proof artifacts.";
}

createRoot(document.getElementById("root")!).render(<App />);
