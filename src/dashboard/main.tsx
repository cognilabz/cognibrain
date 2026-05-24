import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  Cpu,
  Database,
  FileJson,
  GitBranch,
  ListFilter,
  Network,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2
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
  type SearchResult
} from "../core";
import "./styles/app.css";

type ViewId = "memories" | "recall" | "dream" | "proof";
type MemoryFilter = "active" | "all" | "archived" | "needs-review";
type RuntimeStatus = {
  state: "checking" | "online" | "offline";
  label: string;
  maintenance?: { enabled: boolean; writeThreshold: number; intervalHours: number };
  metrics?: MetricsReport;
};

const viewItems: Array<{ id: ViewId; label: string; icon: React.ElementType; note: string }> = [
  { id: "memories", label: "Store", icon: Database, note: "Inspect facts" },
  { id: "recall", label: "Recall", icon: Search, note: "Preview context" },
  { id: "dream", label: "Dream", icon: Sparkles, note: "Repair memory" },
  { id: "proof", label: "Proof", icon: BarChart3, note: "Verify claims" }
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
  ["graph inference", "typed rules"],
  ["path explainer", "multi-hop"],
  ["brain/source scope", "team-ready"],
  ["audit events", "queued webhooks"],
  ["compliance report", "retention proof"],
  ["marketplace", "persona install"]
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState("");
  const [artifactText, setArtifactText] = useState("");
  const [lastCycle, setLastCycle] = useState<ReflectionReport | null>(null);
  const [lastClean, setLastClean] = useState<string[]>([]);
  const [retrievalWeights, setRetrievalWeights] = useState({ semantic: 0.26, keyword: 0.24, entity: 0.16, temporal: 0.08, trust: 0.18, graph: 0.06, access: 0.02 });
  const [lifecyclePolicy, setLifecyclePolicy] = useState({ fadeAfterDays: 45, archiveAfterDays: 90 });
  const [version, setVersion] = useState(0);
  const apiUrl = useMemo(getApiUrl, []);
  const [runtime, setRuntime] = useState<RuntimeStatus>({ state: "checking", label: "checking" });

  const { store, retrieval, reflection } = useMemo(() => {
    const store = new MemoryStore();
    store.seed(seedMemories);
    return { store, retrieval: new RetrievalEngine(store), reflection: new ReflectionEngine(store) };
  }, []);

  const memories = store.list("demo");
  const health = healthReport(store, "demo");
  const filteredMemories = filterMemories(memories, filter);
  const selectedMemory = selectedId ? findMemory(memories, selectedId) : filteredMemories[0] ?? memories[0] ?? null;
  const results = retrieval.search({ userId: "demo", query, limit: 5, weights: retrievalWeights });
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
        const metricsResponse = await fetch(`${apiUrl}/metrics`);
        const maintenance = (await maintenanceResponse.json()) as RuntimeStatus["maintenance"];
        const metrics = metricsResponse.ok ? ((await metricsResponse.json()) as MetricsReport) : undefined;
        if (!cancelled) setRuntime({ state: "online", label: "online", maintenance, metrics });
      } catch {
        if (!cancelled) setRuntime({ state: "offline", label: "offline" });
      }
    }
    checkRuntime();
    const timer = window.setInterval(checkRuntime, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiUrl]);

  function refresh(nextSelectedId = selectedMemory?.id ?? null) {
    setSelectedId(nextSelectedId);
    setVersion((value) => value + 1);
  }

  function addMemory() {
    const content = newMemory.trim();
    if (!content) return;
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

  function archiveMemory(memory: Memory) {
    store.archive(memory.id);
    setLastClean([`Archived ${shortId(memory)} because it should no longer be injected.`]);
    refresh(null);
  }

  function deleteMemory(memory: Memory) {
    store.delete(memory.id);
    setLastClean([`Deleted ${shortId(memory)} from the local store.`]);
    refresh(null);
  }

  function verifyMemory(memory: Memory) {
    const updated = store.update(memory.id, {
      source: { kind: "human", confidence: 0.96 },
      trust: 0.94,
      tags: Array.from(new Set([...memory.tags.filter((tag) => tag !== "needs-review"), "verified"])),
      metadata: { verifiedAt: new Date().toISOString() }
    });
    setLastClean([`Verified ${shortId(updated)} and raised trust to ${updated.trust.toFixed(2)}.`]);
    refresh(updated.id);
  }

  function togglePin(memory: Memory) {
    const updated = store.update(memory.id, { pinned: !memory.pinned });
    setLastClean([`${updated.pinned ? "Pinned" : "Unpinned"} ${shortId(updated)}.`]);
    refresh(updated.id);
  }

  function applyFeedback(memory: Memory, kind: FeedbackKind) {
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

  function cleanRiskyMemories() {
    const candidates = store.list("demo").filter((memory) => !memory.archivedAt && !memory.pinned && needsReview(memory));
    const actions = candidates.map((memory) => {
      const archived = store.archive(memory.id);
      return `Archived ${shortId(archived)}: ${reviewReason(memory)}.`;
    });
    setLastClean(actions.length ? actions : ["No risky active memories found."]);
    refresh(null);
  }

  function runDreamCycle() {
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
            <p>{health.active} active memories, {reviewCount} need review. Context is inspected before it reaches an agent.</p>
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
            <strong>{runtime.maintenance?.enabled === false ? "manual dreams" : "auto-dream online"}</strong>
            <p>CLI, HTTP, dashboard, MCP, and connector templates run from one local package.</p>
            <div className="signal-stack">
              {platformSignals.map(({ label, value, icon: Icon }) => (
                <span key={label}><Icon size={14} /> {label}: {value}</span>
              ))}
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
        </section>

        {view === "memories" ? (
          <MemoryView
            filter={filter}
            setFilter={setFilter}
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
            lastClean={lastClean}
          />
        ) : null}

        {view === "recall" ? (
          <RecallView query={query} setQuery={setQuery} results={results} selectedMemory={selectedMemory} selectMemory={(memory) => setSelectedId(memory.id)} />
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

function MemoryView({
  filter,
  setFilter,
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
  lastClean
}: {
  filter: MemoryFilter;
  setFilter: (filter: MemoryFilter) => void;
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
                <small>{memory.source.kind} · trust {memory.trust.toFixed(2)} · {memory.layer}/{memory.type}</small>
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
              <button className="secondary-action" onClick={() => archiveMemory(selectedMemory)} disabled={Boolean(selectedMemory.archivedAt)}><Archive size={16} /> Archive</button>
              <button className="danger-action" onClick={() => deleteMemory(selectedMemory)}><Trash2 size={16} /> Delete</button>
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
      </div>
    </section>
  );
}

function RecallView({
  query,
  setQuery,
  results,
  selectedMemory,
  selectMemory
}: {
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  selectedMemory: Memory | null;
  selectMemory: (memory: Memory) => void;
}) {
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
              <strong>{shortId(result.memory)} · {result.score.toFixed(2)}</strong>
              <span>semantic {result.signals.semantic.toFixed(2)}</span>
              <span>keyword {result.signals.keyword.toFixed(2)}</span>
              <span>trust {result.signals.trust.toFixed(2)}</span>
              <span>graph {result.signals.graph.toFixed(2)}</span>
              <span>{result.decision ?? "include"}</span>
              <p>{result.memory.content}</p>
            </article>
          ))}
        </div>
        {selectedMemory ? <MemoryMini memory={selectedMemory} /> : null}
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
  setRetrievalWeights: React.Dispatch<React.SetStateAction<{ semantic: number; keyword: number; entity: number; temporal: number; trust: number; graph: number; access: number }>>;
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
          {(["semantic", "keyword", "entity", "temporal", "trust", "graph", "access"] as const).map((key) => (
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

function summarizeArtifact(value: string): string[] {
  if (!value.trim()) return ["Paste an artifact to inspect pass status, proof level, and benchmark rows."];
  try {
    const parsed = JSON.parse(value) as {
      passed?: boolean;
      proofLevel?: string;
      source?: { name?: string };
      ours?: { correct?: number; total?: number; accuracy?: number };
      benchmarks?: Array<{ dataset: string; margin: number; ours: { correct: number; total: number } }>;
    };
    if (parsed.benchmarks) {
      return [
        `passed=${String(parsed.passed)}`,
        `proof=${parsed.proofLevel ?? "unknown"}`,
        ...parsed.benchmarks.map((benchmark) => `${benchmark.dataset}: ${benchmark.ours.correct}/${benchmark.ours.total}, margin ${(benchmark.margin * 100).toFixed(2)}pp`)
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

function filterMemories(memories: Memory[], filter: MemoryFilter): Memory[] {
  if (filter === "all") return memories;
  if (filter === "archived") return memories.filter((memory) => memory.archivedAt);
  if (filter === "needs-review") return memories.filter((memory) => !memory.archivedAt && needsReview(memory));
  return memories.filter((memory) => !memory.archivedAt);
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

function itemLabel(item: MemoryFilter): string {
  return item === "needs-review" ? "Needs review" : item[0].toUpperCase() + item.slice(1);
}

function shortId(memory: Memory): string {
  return memory.id.slice(0, 8);
}

function scopeLabel(memory: Memory): string {
  return [memory.orgId, memory.appId, memory.sessionId, memory.projectId].filter(Boolean).join(" / ") || "user";
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

function viewTitle(view: ViewId): string {
  if (view === "memories") return "Memory workbench";
  if (view === "recall") return "Recall QA";
  if (view === "dream") return "Dream and cleanup";
  return "Benchmark proof";
}

function viewSubtitle(view: ViewId): string {
  if (view === "memories") return "Inspect every memory, understand trust, and remove anything that should not shape agent behavior.";
  if (view === "recall") return "Preview the ranked context pack before an agent uses it.";
  if (view === "dream") return "Run memory hygiene and inspect each summary, demotion, archive, and reorganization.";
  return "Validate benchmark claims and inspect public proof artifacts.";
}

createRoot(document.getElementById("root")!).render(<App />);
