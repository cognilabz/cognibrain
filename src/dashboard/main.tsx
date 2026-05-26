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
import {
  benchmarkArenaProof,
  beamCategories,
  certifiedBenchmarks,
  harnessProof,
  harnessRunProof,
  marketplaceModules,
  nextgenProof,
  operatorControls,
  patchEvidenceProof,
  seedMemories
} from "./fixtures";
import type { ConnectorHealth, EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom, ViewId } from "./types";
import { getApiUrl, healthFromMemories, mapMarketplaceModule, reviveMemories, reviveMemory, reviveReflectionReport, reviveSearchResults } from "./runtime";
import { summarizeArtifact } from "./components/views";
import { DashboardChrome } from "./components/DashboardChrome";
import { ViewRouter } from "./components/ViewRouter";
import { clamp01, filterMemories, findMemory, needsReview, previewRoute, reviewReason, shortId } from "./utils";

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
      <DashboardChrome
        view={view}
        setView={setView}
        runtime={runtime}
        runtimeNotice={runtimeNotice}
        health={health}
        reviewCount={reviewCount}
        connectorHealth={connectorHealth}
        cleanRiskyMemories={cleanRiskyMemories}
        runDreamCycle={runDreamCycle}
      />

      <section className="workspace">
        <ViewRouter
          view={view}
          filter={filter}
          setFilter={setFilter}
          engineeringFilter={engineeringFilter}
          setEngineeringFilter={setEngineeringFilter}
          memories={memories}
          filteredMemories={filteredMemories}
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
          query={query}
          setQuery={setQuery}
          results={results}
          routePreview={routePreview}
          retrievalWeights={retrievalWeights}
          setRetrievalWeights={setRetrievalWeights}
          graphDepth={graphDepth}
          setGraphDepth={setGraphDepth}
          timeZoom={timeZoom}
          setTimeZoom={setTimeZoom}
          lastCycle={lastCycle}
          runDreamCycle={runDreamCycle}
          lifecyclePolicy={lifecyclePolicy}
          setLifecyclePolicy={setLifecyclePolicy}
          modules={modules}
          installModule={installModule}
          runtime={runtime}
          installingModuleId={installingModuleId}
          marketplaceNotice={marketplaceNotice}
          artifactText={artifactText}
          setArtifactText={setArtifactText}
          artifactSummary={artifactSummary}
        />
      </section>
    </main>
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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

createRoot(document.getElementById("root")!).render(<App />);
