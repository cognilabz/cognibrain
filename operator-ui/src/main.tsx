"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  BadgeCheck,
  BarChart3,
  Brain,
  Cable,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Database,
  Download,
  ExternalLink,
  FileJson,
  Gauge,
  GitBranch,
  Hammer,
  KeyRound,
  Layers3,
  Loader2,
  PackagePlus,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Terminal,
  Trash2,
  Unplug,
  WandSparkles
} from "lucide-react";
import {
  MemoryStore,
  ReflectionEngine,
  healthReport,
  type ConnectorManifest,
  type Memory,
  type MemoryInput,
  type MetricsReport,
  type ReflectionReport
} from "../../src/core";
import "./styles.css";

type ViewId = "overview" | "memories" | "connectors" | "dreaming" | "harnesses" | "reports";
type RuntimeState = "checking" | "online" | "offline";
type NoticeKind = "info" | "good" | "warn" | "bad";
type Notice = { kind: NoticeKind; text: string };
type ConnectorHealth = {
  connectorId: string;
  kind: string;
  privacyPolicy: string;
  lastStatus: string;
  lastSyncAt?: string;
  lastWritebackAt?: string;
  records: number;
};
type MarketplaceModule = {
  id: string;
  kind: string;
  name: string;
  version: string;
  description?: string;
  status?: string;
  installState?: string;
  security?: { status?: string };
};
type ManagedControlPlane = {
  tenants?: { total?: number; active?: number };
  readiness?: Record<string, boolean>;
  autoscaling?: { enabled?: boolean; minReplicas?: number; maxReplicas?: number };
};
type RuntimeReport = {
  state: RuntimeState;
  health?: ReturnType<typeof healthReport>;
  metrics?: MetricsReport;
  maintenance?: { enabled: boolean; writeThreshold: number; intervalHours: number };
  storage?: { active: string; adapters?: Array<{ kind: string; durable: boolean; distributedReady: boolean }> };
  managed?: ManagedControlPlane;
};
type DraftMemory = {
  id?: string;
  content: string;
  tags: string;
  visibility: "private" | "user" | "org" | "public";
  trust: number;
};
type ConnectorDraft = {
  provider: VendorProvider;
  connectorId: string;
  name: string;
  privacyPolicy: ConnectorManifest["privacyPolicy"];
  direction: ConnectorManifest["direction"];
};
type ConnectorConfigSummary = {
  path: string;
  keys: Array<{
    key: string;
    aliases: string[];
    configured: boolean;
    source: "env" | "file" | "missing";
    secret: boolean;
    valueRef?: string;
  }>;
};
type ReportPayload = {
  label: string;
  data: unknown;
};
type HarnessExecutionResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
};

const apiUrl = getApiUrl();
const logoUrl = "/cognilabz-logo.png";
const userId = "demo";

const vendorProviders = [
  { id: "github", label: "GitHub", kind: "code", env: ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"] },
  { id: "slack", label: "Slack", kind: "chat", env: ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"] },
  { id: "discord", label: "Discord", kind: "chat", env: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"] },
  { id: "jira", label: "Jira", kind: "project_management", env: ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"] },
  { id: "confluence", label: "Confluence", kind: "docs", env: ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"] },
  { id: "notion", label: "Notion", kind: "docs", env: ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"] },
  { id: "linear", label: "Linear", kind: "project_management", env: ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"] },
  { id: "gitlab", label: "GitLab", kind: "code", env: ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"] },
  { id: "azure-devops", label: "Azure DevOps", kind: "code", env: ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"] },
  { id: "teams", label: "Microsoft Teams", kind: "chat", env: ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"] },
  { id: "gmail", label: "Gmail", kind: "email", env: ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"] },
  { id: "google-drive", label: "Google Drive", kind: "cloud_storage", env: ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"] },
  { id: "google-calendar", label: "Google Calendar", kind: "calendar", env: ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"] },
  { id: "asana", label: "Asana", kind: "project_management", env: ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"] },
  { id: "clickup", label: "ClickUp", kind: "project_management", env: ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"] },
  { id: "sentry", label: "Sentry", kind: "code", env: ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"] },
  { id: "datadog", label: "Datadog", kind: "custom", env: ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"] },
  { id: "pagerduty", label: "PagerDuty", kind: "incident", env: ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"] },
  { id: "posthog", label: "PostHog", kind: "custom", env: ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"] }
] as const;
type VendorProvider = (typeof vendorProviders)[number]["id"];

const navigation: Array<{ id: ViewId; label: string; icon: React.ElementType }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "memories", label: "Memories", icon: Database },
  { id: "connectors", label: "Connectors", icon: Cable },
  { id: "dreaming", label: "Dreaming", icon: WandSparkles },
  { id: "harnesses", label: "Harnesses", icon: Terminal },
  { id: "reports", label: "Reports", icon: BarChart3 }
];

const harnesses = [
  {
    id: "all",
    label: "All agent harnesses",
    summary: "Install every supported instruction and lifecycle hook template for this workspace.",
    command: "npx cognibrain setup --all-harnesses",
    icon: Layers3
  },
  {
    id: "codex",
    label: "Codex lifecycle",
    summary: "Wire context, guard, outcome, patch evidence, and dream handoff hooks for Codex-style work.",
    command: "npx cognibrain harness install codex",
    icon: Brain
  },
  {
    id: "mcp",
    label: "MCP server",
    summary: "Expose memory context, corrections, action guards, and evidence packs to MCP-native agents.",
    command: "npx cognibrain mcp",
    icon: GitBranch
  },
  {
    id: "ci",
    label: "CI evidence hook",
    summary: "Record test commands, changed files, release checks, and failure evidence from automation.",
    command: "npx cognibrain harness outcome --command \"npm test\" --exit-code 0 --json",
    icon: Hammer
  }
];

const seedMemories: MemoryInput[] = [
  {
    userId,
    content: "Operator UI must keep the commercial surface out of the MIT package.",
    source: { kind: "human", confidence: 0.96 },
    tags: ["operator-ui", "license", "commercial"],
    timestamp: daysAgo(1),
    pinned: true
  },
  {
    userId,
    content: "Run dream cycles after connector syncs that produce low-trust or contradictory memories.",
    source: { kind: "agent", confidence: 0.82 },
    tags: ["dream", "connectors", "maintenance"],
    timestamp: daysAgo(7)
  },
  {
    userId,
    content: "Connector credentials must stay in env vars; manifests store only non-secret configuration.",
    source: { kind: "reviewed_code", confidence: 0.92 },
    tags: ["connectors", "security"],
    timestamp: daysAgo(4)
  },
  {
    userId,
    content: "Harness installs should remain scriptable from the CLI even when the browser UI is unavailable.",
    source: { kind: "human", confidence: 0.9 },
    tags: ["harness", "cli", "fallback"],
    timestamp: daysAgo(10)
  },
  {
    userId,
    content: "Stale transcript memories need source revalidation before they are injected into coding context.",
    source: { kind: "transcript", confidence: 0.42 },
    tags: ["needs-review", "source-revalidation"],
    timestamp: daysAgo(96)
  }
];

export default function App() {
  const [view, setView] = useState<ViewId>("overview");
  const [runtime, setRuntime] = useState<RuntimeReport>({ state: "checking" });
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [connectorHealth, setConnectorHealth] = useState<ConnectorHealth[]>([]);
  const [connectors, setConnectors] = useState<ConnectorManifest[]>([]);
  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [connectorConfig, setConnectorConfig] = useState<ConnectorConfigSummary>({ path: "", keys: [] });
  const [connectorConfigValues, setConnectorConfigValues] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState<DraftMemory>({ content: "", tags: "manual", visibility: "private", trust: 0.9 });
  const [connectorDraft, setConnectorDraft] = useState<ConnectorDraft>({
    provider: "github",
    connectorId: "official-github",
    name: "GitHub",
    privacyPolicy: "project",
    direction: "two_way"
  });
  const [dreamReport, setDreamReport] = useState<ReflectionReport | null>(null);
  const [dreamJobs, setDreamJobs] = useState<unknown[]>([]);
  const [report, setReport] = useState<ReportPayload>({ label: "Runtime report", data: {} });
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState(harnesses[0].command);
  const [harnessCwd, setHarnessCwd] = useState("");
  const [harnessTimeout, setHarnessTimeout] = useState(30);
  const [harnessResult, setHarnessResult] = useState<HarnessExecutionResult | null>(null);

  const local = useMemo(() => {
    const store = new MemoryStore();
    store.seed(seedMemories);
    return { store, reflection: new ReflectionEngine(store) };
  }, []);

  const online = runtime.state === "online";
  const displayedMemories = online ? memories : local.store.list(userId);
  const filteredMemories = displayedMemories.filter((memory) => {
    const haystack = `${memory.content} ${memory.tags.join(" ")} ${memory.source.kind}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const selected = displayedMemories.find((memory) => memory.id === selectedId) ?? filteredMemories[0] ?? displayedMemories[0];
  const fallbackHealth = healthReport(local.store, userId);
  const memoryHealth = runtime.health ?? fallbackHealth;
  const staleCount = displayedMemories.filter((memory) => !memory.archivedAt && ageDays(memory.updatedAt) > 60).length;
  const reviewCount = displayedMemories.filter(needsReview).length;

  useEffect(() => {
    void loadRuntime();
    const timer = window.setInterval(() => void loadRuntime({ quiet: true }), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!online) return;
    setConnectorConfigValues({});
    void refreshConnectorConfig(connectorDraft.provider);
  }, [connectorDraft.provider, online]);

  async function loadRuntime(options: { quiet?: boolean } = {}) {
    try {
      const [health, maintenance, metrics, storage, managed, memoryRows, connectorRows, connectorHealthRows, configRows, moduleRows, jobs] = await Promise.all([
        apiJson<RuntimeReport["health"]>("/health"),
        apiJson<RuntimeReport["maintenance"]>("/maintenance"),
        apiJson<MetricsReport>("/metrics"),
        apiJson<RuntimeReport["storage"]>("/storage").catch(() => undefined),
        apiJson<ManagedControlPlane>("/managed/control-plane").catch(() => undefined),
        apiJson<unknown[]>(`/memories?userId=${encodeURIComponent(userId)}`),
        apiJson<ConnectorManifest[]>("/connectors").catch(() => []),
        apiJson<ConnectorHealth[]>("/connectors/health").catch(() => []),
        apiJson<ConnectorConfigSummary>(`/connectors/config?provider=${encodeURIComponent(connectorDraft.provider)}`).catch(() => ({ path: "", keys: [] })),
        apiJson<MarketplaceModule[]>("/marketplace").catch(() => []),
        apiJson<unknown[]>("/dream/jobs").catch(() => [])
      ]);
      setRuntime({ state: "online", health, maintenance, metrics, storage, managed });
      setMemories(reviveMemories(memoryRows));
      setConnectors(connectorRows);
      setConnectorHealth(connectorHealthRows);
      setConnectorConfig(configRows);
      setModules(moduleRows);
      setDreamJobs(Array.isArray(jobs) ? jobs : []);
    } catch {
      setRuntime({ state: "offline" });
      setMemories(local.store.list(userId));
      setConnectorHealth([]);
      setConnectors([]);
      setModules([]);
      setConnectorConfig({ path: "", keys: [] });
      if (!options.quiet) setNotice({ kind: "warn", text: "API offline. Showing local demo data and disabled write actions." });
    }
  }

  async function refreshConnectorConfig(provider: VendorProvider) {
    try {
      setConnectorConfig(await apiJson<ConnectorConfigSummary>(`/connectors/config?provider=${encodeURIComponent(provider)}`));
    } catch {
      // Keep the last summary if the runtime is temporarily unavailable.
    }
  }

  async function addMemory() {
    const content = draft.content.trim();
    if (!content) return;
    await runMutation(async () => {
      requireOnline();
      const created = reviveMemory(await apiJson<unknown>("/memories", {
        method: "POST",
        body: JSON.stringify({
          userId,
          content,
          source: { kind: "human", confidence: draft.trust },
          tags: tagList(draft.tags),
          consent: { visibility: draft.visibility },
          timestamp: new Date().toISOString()
        })
      }));
      setSelectedId(created.id);
      setDraft(draftFromMemory(created));
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: "Memory added through the live API." });
    });
  }

  async function saveSelected() {
    if (!selected) return;
    await runMutation(async () => {
      const patch = { content: draft.content || selected.content, tags: tagList(draft.tags), trust: draft.trust };
      requireOnline();
      await apiJson(`/memories/${selected.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await apiJson(`/memories/${selected.id}/consent`, { method: "POST", body: JSON.stringify({ visibility: draft.visibility }) });
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: "Memory updated in the live store." });
    });
  }

  async function archiveSelected() {
    if (!selected) return;
    await runMemoryAction(selected, "archive");
  }

  async function deleteSelected() {
    if (!selected) return;
    await runMemoryAction(selected, "delete");
  }

  async function confirmSelected() {
    if (!selected) return;
    await runMemoryAction(selected, "confirm");
  }

  async function runMemoryAction(memory: Memory, action: "archive" | "delete" | "confirm") {
    await runMutation(async () => {
      requireOnline();
      if (action === "delete") await apiJson(`/memories/${memory.id}`, { method: "DELETE" });
      else await apiJson(`/memories/${memory.id}/${action}`, { method: "POST", body: action === "confirm" ? JSON.stringify({ userId }) : undefined });
      if (action === "delete") {
        setSelectedId(undefined);
        setDraft({ content: "", tags: "manual", visibility: "private", trust: 0.9 });
      }
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: `Memory ${action} completed through the live API.` });
    });
  }

  async function registerConnector() {
    const provider = vendorProviders.find((item) => item.id === connectorDraft.provider) ?? vendorProviders[0];
    await runMutation(async () => {
      const now = new Date().toISOString();
      const manifest: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string } = {
        id: connectorDraft.connectorId,
        name: connectorDraft.name,
        kind: provider.kind as ConnectorManifest["kind"],
        version: "1.0.0",
        direction: connectorDraft.direction,
        capabilities: connectorDraft.direction === "ingest" ? ["ingest", "poll"] : ["ingest", "poll", "writeback"],
        auth: provider.id === "github" || provider.id === "linear" ? "token" : "oauth",
        defaultSourceKind: provider.id === "github" ? "reviewed_code" : provider.id === "slack" ? "transcript" : "tool",
        privacyPolicy: connectorDraft.privacyPolicy,
        metadataMapping: { externalId: "id", content: "content", timestamp: "updatedAt" },
        list: { endpoint: `vendor://${provider.id}/list`, method: "GET" },
        poll: { endpoint: `vendor://${provider.id}/poll`, method: "GET" },
        writeback: { endpoint: `vendor://${provider.id}/writeback`, method: "POST", operations: ["comment", "memory_link", "summary"] },
        vendor: {
          provider: provider.id,
          docsUrl: `https://cognilabz.com`,
          requiredEnv: [...provider.env]
        },
        createdAt: now,
        updatedAt: now
      };
      await apiJson("/connectors", { method: "POST", body: JSON.stringify(manifest) });
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: `${connectorDraft.name} registered. Configure env vars or local config before live sync.` });
    });
  }

  async function saveConnectorConfig() {
    const allowedKeys = new Set(providerConfigKeys(connectorDraft.provider));
    const values = Object.fromEntries(Object.entries(connectorConfigValues).filter(([key, value]) => allowedKeys.has(key) && value.trim()));
    await runMutation(async () => {
      await apiJson<ConnectorConfigSummary>("/connectors/config", { method: "POST", body: JSON.stringify({ values }) });
      const refreshed = await apiJson<ConnectorConfigSummary>(`/connectors/config?provider=${encodeURIComponent(connectorDraft.provider)}`);
      setConnectorConfig(refreshed);
      setConnectorConfigValues({});
      setNotice({ kind: "good", text: "Connector config saved locally with redacted readback." });
    });
  }

  async function pollConnector(connectorId: string) {
    await runMutation(async () => {
      await apiJson("/connectors/poll", { method: "POST", body: JSON.stringify({ connectorId, userId }) });
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: `${connectorId} poll queued.` });
    });
  }

  async function installModule(moduleId: string) {
    await runMutation(async () => {
      await apiJson("/marketplace/install", { method: "POST", body: JSON.stringify({ id: moduleId }) });
      await loadRuntime({ quiet: true });
      setNotice({ kind: "good", text: `${moduleId} installed through marketplace runtime.` });
    });
  }

  async function executeHarness() {
    await runMutation(async () => {
      const result = await apiJson<HarnessExecutionResult>("/harness/execute", {
        method: "POST",
        body: JSON.stringify({
          userId,
          command,
          cwd: harnessCwd.trim() || undefined,
          timeoutMs: Math.max(1, harnessTimeout) * 1000
        })
      });
      setHarnessResult(result);
      setNotice({ kind: result.exitCode === 0 ? "good" : "warn", text: result.exitCode === 0 ? "Harness command completed." : "Harness command needs review." });
    });
  }

  async function runDream(kind: "plan" | "run" | "due") {
    await runMutation(async () => {
      requireOnline();
      if (kind === "due") {
        await apiJson("/maintenance/dream-due", { method: "POST", body: JSON.stringify({ userId }) });
      } else {
        const response = await apiJson<ReflectionReport>(kind === "plan" ? "/dream/plan" : "/dream/run", {
          method: "POST",
          body: JSON.stringify({ userId, mode: "dream", trigger: kind === "plan" ? "manual_reflect" : "manual_dream", budget: "standard" })
        });
        setDreamReport(response);
      }
      await loadRuntime({ quiet: true });
      setView("dreaming");
      setNotice({ kind: "good", text: `Dream ${kind} completed.` });
    });
  }

  async function loadReport(kind: string) {
    const routes: Record<string, string> = {
      metrics: "/metrics",
      compliance: "/compliance",
      audit: "/audit",
      chain: "/audit/chain",
      leaderboard: "/benchmarks/leaderboard",
      storage: "/storage",
      managed: "/managed/control-plane",
      openapi: "/openapi.json"
    };
    await runMutation(async () => {
      const data = await apiJson(routes[kind] ?? "/metrics");
      setReport({ label: kind, data });
      setNotice({ kind: "good", text: `${kind} report loaded.` });
    });
  }

  async function runMutation(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setNotice({ kind: "bad", text: error instanceof Error ? error.message : "Operation failed." });
    } finally {
      setBusy(false);
    }
  }

  function requireOnline() {
    if (!online) throw new Error("API offline. Operator writes are disabled until the runtime is reachable.");
  }

  function editSelected(memory: Memory) {
    setSelectedId(memory.id);
    setDraft(draftFromMemory(memory));
  }

  return (
    <main className="operator-shell" data-version={version}>
      <aside className="rail" aria-label="Operator navigation">
        <a className="brand" href="https://cognilabz.com" target="_blank" rel="noreferrer">
          <img src={logoUrl} alt="" />
          <span>
            <strong>Cognibrain</strong>
            <small>Operator UI</small>
          </span>
        </a>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)} title={label}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className={`runtime ${runtime.state}`}>
          {runtime.state === "online" ? <CheckCircle2 size={17} /> : runtime.state === "checking" ? <Loader2 size={17} /> : <Unplug size={17} />}
          <span>{runtime.state}</span>
        </div>
      </aside>

      <section className="stage">
        <header className="stage-top">
          <div>
            <span className="eyebrow">commercial control plane</span>
            <h1>{titleFor(view)}</h1>
            <p>{subtitleFor(view)}</p>
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => void loadRuntime()} disabled={busy} title="Refresh runtime">
              <RefreshCw size={17} />
              Refresh
            </button>
            <button onClick={() => void runDream("run")} disabled={busy} title="Run dream cycle">
              <Sparkles size={17} />
              Dream now
            </button>
          </div>
        </header>

        {notice ? (
          <div className={`notice ${notice.kind}`}>
            <CircleDot size={15} />
            <span>{notice.text}</span>
          </div>
        ) : null}

        {view === "overview" ? (
          <OverviewView
            runtime={runtime}
            memories={displayedMemories}
            memoryHealth={memoryHealth}
            connectorHealth={connectorHealth}
            modules={modules}
            reviewCount={reviewCount}
            staleCount={staleCount}
            setView={setView}
          />
        ) : null}

        {view === "memories" ? (
          <MemoryView
            memories={filteredMemories}
            selected={selected}
            query={query}
            setQuery={setQuery}
            draft={draft}
            setDraft={setDraft}
            editSelected={editSelected}
            addMemory={addMemory}
            saveSelected={saveSelected}
            archiveSelected={archiveSelected}
            deleteSelected={deleteSelected}
            confirmSelected={confirmSelected}
            online={online}
            busy={busy}
          />
        ) : null}

        {view === "connectors" ? (
          <ConnectorsView
            online={online}
            connectors={connectors}
          connectorHealth={connectorHealth}
          modules={modules}
          draft={connectorDraft}
          setDraft={setConnectorDraft}
          config={connectorConfig}
          configValues={connectorConfigValues}
          setConfigValues={setConnectorConfigValues}
          registerConnector={registerConnector}
          saveConnectorConfig={saveConnectorConfig}
          pollConnector={pollConnector}
          installModule={installModule}
            busy={busy}
          />
        ) : null}

        {view === "dreaming" ? (
          <DreamingView
            memories={displayedMemories}
            report={dreamReport}
            jobs={dreamJobs}
            runDream={runDream}
            busy={busy}
            reviewCount={reviewCount}
            staleCount={staleCount}
          />
        ) : null}

        {view === "harnesses" ? (
          <HarnessView
            command={command}
            setCommand={setCommand}
            cwd={harnessCwd}
            setCwd={setHarnessCwd}
            timeout={harnessTimeout}
            setTimeout={setHarnessTimeout}
            result={harnessResult}
            executeHarness={executeHarness}
            online={online}
            busy={busy}
          />
        ) : null}

        {view === "reports" ? <ReportsView report={report} loadReport={loadReport} runtime={runtime} busy={busy} /> : null}
      </section>
    </main>
  );
}

function OverviewView({
  runtime,
  memories,
  memoryHealth,
  connectorHealth,
  modules,
  reviewCount,
  staleCount,
  setView
}: {
  runtime: RuntimeReport;
  memories: Memory[];
  memoryHealth: ReturnType<typeof healthReport>;
  connectorHealth: ConnectorHealth[];
  modules: MarketplaceModule[];
  reviewCount: number;
  staleCount: number;
  setView: (view: ViewId) => void;
}) {
  const ready = Math.round((memoryHealth.healthScore ?? 0) * 100);
  return (
    <div className="overview-grid">
      <section className="hero-panel">
        <div>
          <span className="panel-label">Operator readiness</span>
          <strong>{ready}%</strong>
          <p>{memories.filter((memory) => !memory.archivedAt).length} active memories, {reviewCount} review items, {staleCount} stale candidates.</p>
        </div>
        <div className="workflow-map" aria-label="Operator workflow">
          <span>Capture</span>
          <span>Review</span>
          <span>Dream</span>
          <span>Inject</span>
        </div>
      </section>
      <MetricCard icon={Database} label="Memories" value={String(memories.length)} detail={`${reviewCount} need review`} />
      <MetricCard icon={Cable} label="Connectors" value={String(connectorHealth.length)} detail={`${connectorHealth.filter((item) => item.lastSyncAt).length} synced`} />
      <MetricCard icon={PackagePlus} label="Modules" value={String(modules.length)} detail={`${modules.filter((item) => item.status === "installed" || item.installState === "installed").length} installed`} />
      <MetricCard icon={Activity} label="No-hit searches" value={String(runtime.metrics?.noHitSearches ?? 0)} detail={`${runtime.metrics?.searches ?? 0} searches`} />
      <MetricCard icon={Sparkles} label="Dreams" value={String(runtime.metrics?.dreams ?? 0)} detail={runtime.maintenance?.enabled === false ? "manual only" : "maintenance enabled"} />
      <MetricCard icon={ShieldCheck} label="Storage" value={runtime.storage?.active ?? "local"} detail={`${runtime.storage?.adapters?.length ?? 1} adapter path`} />
      <section className="ops-panel">
        <div className="panel-title">
          <div>
            <span className="panel-label">Control actions</span>
            <h2>Run the memory room from one place.</h2>
          </div>
        </div>
        <div className="action-grid">
          <button onClick={() => setView("memories")}><Database size={17} /> CRUD memories</button>
          <button onClick={() => setView("connectors")}><Cable size={17} /> Configure connectors</button>
          <button onClick={() => setView("dreaming")}><Sparkles size={17} /> Dream queue</button>
          <button onClick={() => setView("harnesses")}><Terminal size={17} /> Install harnesses</button>
        </div>
      </section>
    </div>
  );
}

function MemoryView({
  memories,
  selected,
  query,
  setQuery,
  draft,
  setDraft,
  editSelected,
  addMemory,
  saveSelected,
  archiveSelected,
  deleteSelected,
  confirmSelected,
  online,
  busy
}: {
  memories: Memory[];
  selected?: Memory;
  query: string;
  setQuery: (value: string) => void;
  draft: DraftMemory;
  setDraft: React.Dispatch<React.SetStateAction<DraftMemory>>;
  editSelected: (memory: Memory) => void;
  addMemory: () => Promise<void>;
  saveSelected: () => Promise<void>;
  archiveSelected: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  confirmSelected: () => Promise<void>;
  online: boolean;
  busy: boolean;
}) {
  return (
    <section className="split-view">
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="panel-label">Memory inventory</span>
            <h2>Inspect, filter, and select records.</h2>
          </div>
          <Search size={18} />
        </div>
        <label className="field">
          <span>Search memories</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="trust, connector, repo policy..." />
        </label>
        <div className="record-list">
          {memories.map((memory) => (
            <button key={memory.id} className={`record-row ${selected?.id === memory.id ? "selected" : ""}`} onClick={() => editSelected(memory)}>
              <span className={`dot ${memory.archivedAt ? "muted" : needsReview(memory) ? "warn" : "good"}`} />
              <span>
                <strong>{memory.content}</strong>
                <small>{memory.source.kind} / trust {memory.trust.toFixed(2)} / {memory.tags.join(", ") || "untagged"}</small>
              </span>
              <meter value={memory.trust} min={0} max={1} />
            </button>
          ))}
        </div>
      </div>
      <div className="panel editor-panel">
        <div className="panel-title">
          <div>
            <span className="panel-label">CRUD workbench</span>
            <h2>{selected ? "Edit selected memory." : "Create a memory."}</h2>
          </div>
          <SquarePen size={18} />
        </div>
        <label className="field">
          <span>Content</span>
          <textarea value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} placeholder="Write the durable fact, correction, procedure, or preference..." />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Tags</span>
            <input value={draft.tags} onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value }))} placeholder="manual, release, policy" />
          </label>
          <label className="field">
            <span>Visibility</span>
            <select value={draft.visibility} onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value as DraftMemory["visibility"] }))}>
              <option value="private">private</option>
              <option value="user">user</option>
              <option value="org">org</option>
              <option value="public">public</option>
            </select>
          </label>
          <label className="field range">
            <span>Trust {draft.trust.toFixed(2)}</span>
            <input type="range" min="0" max="1" step="0.01" value={draft.trust} onChange={(event) => setDraft((value) => ({ ...value, trust: Number(event.target.value) }))} />
          </label>
        </div>
        <div className="button-row">
          <button onClick={addMemory} disabled={busy || !online}><Plus size={17} /> Add</button>
          <button className="ghost" onClick={saveSelected} disabled={busy || !online || !selected}><BadgeCheck size={17} /> Save</button>
          <button className="ghost" onClick={confirmSelected} disabled={busy || !online || !selected}><CheckCircle2 size={17} /> Confirm</button>
          <button className="ghost" onClick={archiveSelected} disabled={busy || !online || !selected}><Archive size={17} /> Archive</button>
          <button className="danger" onClick={deleteSelected} disabled={busy || !online || !selected}><Trash2 size={17} /> Delete</button>
        </div>
        {selected ? (
          <div className="selected-facts">
            <span>ID {shortId(selected.id)}</span>
            <span>Age {ageDays(selected.createdAt)}d</span>
            <span>Consent {selected.consent?.visibility ?? "private"}</span>
            <span>{selected.archivedAt ? "Archived" : needsReview(selected) ? "Needs review" : "Active"}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ConnectorsView({
  online,
  connectors,
  connectorHealth,
  modules,
  draft,
  setDraft,
  config,
  configValues,
  setConfigValues,
  registerConnector,
  saveConnectorConfig,
  pollConnector,
  installModule,
  busy
}: {
  online: boolean;
  connectors: ConnectorManifest[];
  connectorHealth: ConnectorHealth[];
  modules: MarketplaceModule[];
  draft: ConnectorDraft;
  setDraft: React.Dispatch<React.SetStateAction<ConnectorDraft>>;
  config: ConnectorConfigSummary;
  configValues: Record<string, string>;
  setConfigValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  registerConnector: () => Promise<void>;
  saveConnectorConfig: () => Promise<void>;
  pollConnector: (connectorId: string) => Promise<void>;
  installModule: (moduleId: string) => Promise<void>;
  busy: boolean;
}) {
  const provider = vendorProviders.find((item) => item.id === draft.provider) ?? vendorProviders[0];
  const configRows = providerConfigKeys(provider.id).map((key) => config.keys.find((item) => item.key === key) ?? {
    key,
    aliases: connectorEnvAliases(key).filter((alias) => alias !== key),
    configured: false,
    source: "missing" as const,
    secret: isSecretConnectorKey(key)
  });
  const hasPendingConfigValue = configRows.some((row) => configValues[row.key]?.trim());
  return (
    <section className="split-view connectors">
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="panel-label">Connector configuration</span>
            <h2>Register sources and runtime-local secrets.</h2>
          </div>
          <KeyRound size={18} />
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Provider</span>
            <select value={draft.provider} onChange={(event) => {
              const next = vendorProviders.find((item) => item.id === event.target.value) ?? vendorProviders[0];
              setDraft((value) => ({ ...value, provider: next.id, connectorId: connectorIdForProvider(next.id), name: next.label }));
            }}>
              {vendorProviders.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Connector ID</span>
            <input value={draft.connectorId} onChange={(event) => setDraft((value) => ({ ...value, connectorId: event.target.value }))} />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>Privacy</span>
            <select value={draft.privacyPolicy} onChange={(event) => setDraft((value) => ({ ...value, privacyPolicy: event.target.value as ConnectorDraft["privacyPolicy"] }))}>
              <option value="personal">personal</option>
              <option value="project">project</option>
              <option value="team">team</option>
              <option value="never_store">never_store</option>
            </select>
          </label>
        </div>
        <div className="config-path">
          <span>Local config</span>
          <code>{config.path || ".cognibrain/connector-config.json"}</code>
        </div>
        <div className="env-grid">
          {configRows.map((summary) => {
            const { key } = summary;
            const aliases = summary.aliases ?? connectorEnvAliases(key).filter((alias) => alias !== key);
            return (
              <label className="field connector-secret" key={key}>
                <span>{key} <b className={`source-pill ${summary.source}`}>{summary.source}</b></span>
                {aliases.length ? <small className="alias-line">Also reads {aliases.join(", ")}{summary.valueRef ? ` / active ${summary.valueRef}` : ""}</small> : null}
                <input
                  type={summary.secret ? "password" : "text"}
                  value={configValues[key] ?? ""}
                  onChange={(event) => setConfigValues((values) => ({ ...values, [key]: event.target.value }))}
                  placeholder={summary.configured ? "configured; leave blank to keep" : "enter value for local config file"}
                />
              </label>
            );
          })}
        </div>
        <div className="button-row">
          <button onClick={registerConnector} disabled={!online || busy}><PackagePlus size={17} /> Register connector</button>
          <button className="ghost" onClick={saveConnectorConfig} disabled={!online || busy || !hasPendingConfigValue}><KeyRound size={17} /> Save config file</button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <span className="panel-label">Live connectors</span>
            <h2>Health, sync, and marketplace installs.</h2>
          </div>
          <Cable size={18} />
        </div>
        <div className="record-list compact">
          {connectors.map((connector) => {
            const health = connectorHealth.find((item) => item.connectorId === connector.id);
            return (
              <article className="connector-row" key={connector.id}>
                <div>
                  <strong>{connector.name}</strong>
                  <small>{connector.id} / {connector.kind} / {health?.lastStatus ?? "not synced"}</small>
                </div>
                <button className="ghost" onClick={() => pollConnector(connector.id)} disabled={!online || busy}><RefreshCw size={16} /> Poll</button>
              </article>
            );
          })}
          {!connectors.length ? <p className="empty">No live connector manifests loaded.</p> : null}
        </div>
        <div className="market-list">
          {modules.slice(0, 5).map((module) => (
            <article className="module-row" key={module.id}>
              <div>
                <strong>{module.name}</strong>
                <small>{module.kind} / {module.status ?? module.installState ?? "available"}</small>
              </div>
              <button className="ghost" onClick={() => installModule(module.id)} disabled={!online || busy}><Plus size={16} /> Install</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function DreamingView({
  memories,
  report,
  jobs,
  runDream,
  busy,
  reviewCount,
  staleCount
}: {
  memories: Memory[];
  report: ReflectionReport | null;
  jobs: unknown[];
  runDream: (kind: "plan" | "run" | "due") => Promise<void>;
  busy: boolean;
  reviewCount: number;
  staleCount: number;
}) {
  const lifecycle = report?.lifecycle;
  return (
    <section className="dream-grid">
      <MetricCard icon={ClipboardList} label="Evaluated" value={String(lifecycle?.evaluated ?? memories.length)} detail="candidate memories" />
      <MetricCard icon={Archive} label="Archived" value={String(lifecycle?.archived ?? 0)} detail={`${staleCount} stale now`} />
      <MetricCard icon={ShieldCheck} label="Review" value={String(reviewCount)} detail="operator queue" />
      <MetricCard icon={Sparkles} label="Jobs" value={String(jobs.length)} detail="tracked dream jobs" />
      <section className="panel wide">
        <div className="panel-title">
          <div>
            <span className="panel-label">Dream controls</span>
            <h2>Plan, run, or process due maintenance.</h2>
          </div>
        </div>
        <div className="action-grid three">
          <button onClick={() => runDream("plan")} disabled={busy}><PauseCircle size={17} /> Plan only</button>
          <button onClick={() => runDream("run")} disabled={busy}><Play size={17} /> Run cycle</button>
          <button onClick={() => runDream("due")} disabled={busy}><RefreshCw size={17} /> Run due jobs</button>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title">
          <div>
            <span className="panel-label">Dream output</span>
            <h2>Actions stay auditable.</h2>
          </div>
          <FileJson size={18} />
        </div>
        <JsonBlock data={report ?? { message: "No dream report loaded yet." }} />
      </section>
    </section>
  );
}

function HarnessView({
  command,
  setCommand,
  cwd,
  setCwd,
  timeout,
  setTimeout,
  result,
  executeHarness,
  online,
  busy
}: {
  command: string;
  setCommand: (command: string) => void;
  cwd: string;
  setCwd: (cwd: string) => void;
  timeout: number;
  setTimeout: (timeout: number) => void;
  result: HarnessExecutionResult | null;
  executeHarness: () => Promise<void>;
  online: boolean;
  busy: boolean;
}) {
  return (
    <section className="harness-grid">
      {harnesses.map(({ id, label, summary, command: harnessCommand, icon: Icon }) => (
        <article className="harness-card" key={id}>
          <Icon size={20} />
          <strong>{label}</strong>
          <p>{summary}</p>
          <button className="ghost" onClick={() => setCommand(harnessCommand)}><Terminal size={16} /> Prepare command</button>
        </article>
      ))}
      <section className="panel wide">
        <div className="panel-title">
          <div>
            <span className="panel-label">Interactive harness run</span>
            <h2>Edit, execute, and inspect output.</h2>
          </div>
          <Terminal size={18} />
        </div>
        <div className="harness-console">
          <label className="field command-field">
            <span>Command</span>
            <textarea value={command} onChange={(event) => setCommand(event.target.value)} />
          </label>
          <div className="harness-options">
            <label className="field">
              <span>Working directory</span>
              <input value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="runtime checkout root" />
            </label>
            <label className="field">
              <span>Timeout seconds</span>
              <input type="number" min={1} max={120} value={timeout} onChange={(event) => setTimeout(Number(event.target.value))} />
            </label>
            <button onClick={executeHarness} disabled={!online || busy || !command.trim()}><Play size={17} /> Run</button>
          </div>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title">
          <div>
            <span className="panel-label">Execution output</span>
            <h2>{result ? resultTitle(result) : "No harness run yet."}</h2>
          </div>
          <Download size={18} />
        </div>
        {result ? (
          <div className="execution-result">
            <div className="execution-meta">
              <span className={`run-pill ${result.exitCode === 0 ? "ok" : "fail"}`}>{result.timedOut ? "timeout" : `exit ${result.exitCode}`}</span>
              <span>{result.durationMs} ms</span>
              <span>{result.cwd}</span>
            </div>
            <div className="terminal-grid">
              <div>
                <strong>stdout</strong>
                <pre>{result.stdout || "(empty)"}</pre>
              </div>
              <div>
                <strong>stderr</strong>
                <pre>{result.stderr || "(empty)"}</pre>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty">Choose a preset, adjust the command if needed, then run it against the local Cognibrain runtime.</p>
        )}
      </section>
    </section>
  );
}

function ReportsView({
  report,
  loadReport,
  runtime,
  busy
}: {
  report: ReportPayload;
  loadReport: (kind: string) => Promise<void>;
  runtime: RuntimeReport;
  busy: boolean;
}) {
  const reports = ["metrics", "compliance", "audit", "chain", "leaderboard", "storage", "managed", "openapi"];
  const visualReport = buildVisualReport(report.data);
  return (
    <section className="reports-grid">
      <MetricCard icon={Activity} label="Searches" value={String(runtime.metrics?.searches ?? 0)} detail="runtime metric" />
      <MetricCard icon={Brain} label="Updates" value={String(runtime.metrics?.memoriesUpdated ?? 0)} detail="memory mutations" />
      <MetricCard icon={Sparkles} label="Dreams" value={String(runtime.metrics?.dreams ?? 0)} detail="maintenance" />
      <MetricCard icon={ShieldCheck} label="Conflicts" value={String(runtime.metrics?.contradictionsOpened ?? 0)} detail="opened by truth checks" />
      <section className="panel wide">
        <div className="report-picker">
          {reports.map((item) => (
            <button key={item} className="ghost" onClick={() => loadReport(item)} disabled={busy}>{item}</button>
          ))}
        </div>
        <div className="panel-title">
          <div>
            <span className="panel-label">Report view</span>
            <h2>{report.label}</h2>
          </div>
          <BarChart3 size={18} />
        </div>
        <GenericReport model={visualReport} />
      </section>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function resultTitle(result: HarnessExecutionResult): string {
  if (result.timedOut) return "Command timed out.";
  return result.exitCode === 0 ? "Command completed." : "Command returned a non-zero exit.";
}

function JsonBlock({ data }: { data: unknown }) {
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

type VisualReport = {
  metrics: Array<{ label: string; value: number; path: string }>;
  tables: Array<{ title: string; columns: string[]; rows: Array<Record<string, unknown>> }>;
  charts: Array<{ title: string; bars: Array<{ label: string; value: number }> }>;
};

function GenericReport({ model }: { model: VisualReport }) {
  const hasVisuals = model.metrics.length || model.tables.length || model.charts.length;
  return (
    <div className="report-visuals">
      {!hasVisuals ? (
        <div className="report-empty">
          <FileJson size={18} />
          <div>
            <strong>No visual fields detected.</strong>
            <span>The report loaded, but it did not expose primitive, tabular, or numeric values that can be rendered generically.</span>
          </div>
        </div>
      ) : null}

      {model.metrics.length ? (
        <div className="report-metrics">
          {model.metrics.slice(0, 8).map((metric, index) => (
            <article className="report-stat" key={`${metric.path}-${index}`}>
              <span>{metric.label}</span>
              <strong>{formatMetric(metric.value)}</strong>
              <small>{metric.path}</small>
            </article>
          ))}
        </div>
      ) : null}

      {model.charts.map((chart, chartIndex) => (
        <section className="report-card" key={`${chart.title}-${chartIndex}`}>
          <div className="report-card-title">
            <strong>{chart.title}</strong>
            <small>{chart.bars.length} values</small>
          </div>
          <div className="bar-chart">
            {chart.bars.map((bar, barIndex) => {
              const max = Math.max(...chart.bars.map((item) => Math.abs(item.value)), 0);
              const width = max === 0 ? 10 : Math.max(6, (Math.abs(bar.value) / max) * 100);
              const tone = bar.value < 0 ? "negative" : bar.value === 0 ? "zero" : "positive";
              return (
                <div className={`bar-row ${tone}`} key={`${bar.label}-${barIndex}`}>
                  <span>{bar.label}</span>
                  <div><i style={{ width: `${width}%` }} /></div>
                  <b>{formatMetric(bar.value)}</b>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {model.tables.map((table, tableIndex) => (
        <section className="report-card" key={`${table.title}-${tableIndex}`}>
          <div className="report-card-title">
            <strong>{table.title}</strong>
            <small>{table.rows.length} rows</small>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 80).map((row, rowIndex) => (
                  <tr key={`${table.title}-${rowIndex}`}>
                    {table.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function buildVisualReport(data: unknown): VisualReport {
  const metrics: VisualReport["metrics"] = [];
  const tables: VisualReport["tables"] = [];
  walkReport(data, "report", metrics, tables);
  const charts = buildCharts(metrics, tables);
  return { metrics, tables: tables.slice(0, 10), charts };
}

function walkReport(data: unknown, path: string, metrics: VisualReport["metrics"], tables: VisualReport["tables"]) {
  if (Array.isArray(data)) {
    const rows = data.filter(isPlainObject).map((row) => flattenRow(row));
    if (rows.length) tables.push({ title: labelFromPath(path), columns: columnsForRows(rows), rows });
    data.slice(0, 20).forEach((item, index) => walkReport(item, `${path}.${index}`, metrics, tables));
    return;
  }
  if (!isPlainObject(data)) return;
  const object = data as Record<string, unknown>;
  const objectRows = Object.entries(object)
    .filter(([, value]) => isPrimitive(value))
    .map(([key, value]) => ({ key, value }));
  if (objectRows.length) tables.push({ title: `${labelFromPath(path)} fields`, columns: ["key", "value"], rows: objectRows });
  for (const [key, value] of Object.entries(object)) {
    const nextPath = `${path}.${key}`;
    if (typeof value === "number" && Number.isFinite(value)) metrics.push({ label: humanize(key), value, path: nextPath });
    else if (Array.isArray(value) || isPlainObject(value)) walkReport(value, nextPath, metrics, tables);
  }
}

function buildCharts(metrics: VisualReport["metrics"], tables: VisualReport["tables"]): VisualReport["charts"] {
  const charts: VisualReport["charts"] = [];
  const metricBars = metrics
    .filter((metric) => Number.isFinite(metric.value))
    .slice(0, 12)
    .map((metric) => ({ label: metric.label, value: metric.value }));
  if (metricBars.length) charts.push({ title: "Numeric fields", bars: metricBars });
  for (const table of tables) {
    const numericColumns = table.columns.filter((column) => table.rows.some((row) => isFiniteNumber(row[column])));
    const labelColumn = table.columns.find((column) => table.rows.some((row) => typeof row[column] === "string")) ?? table.columns[0];
    for (const column of numericColumns.slice(0, 2)) {
      const bars = table.rows.slice(0, 10).flatMap((row, index) => {
        const value = row[column];
        return isFiniteNumber(value) ? [{
          label: String(row[labelColumn] ?? `Row ${index + 1}`),
          value
        }] : [];
      });
      if (bars.length) charts.push({
        title: `${table.title} / ${humanize(column)}`,
        bars
      });
    }
  }
  return charts.slice(0, 4);
}

function flattenRow(row: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (isPrimitive(value)) flat[nextKey] = value;
    else if (isPlainObject(value)) Object.assign(flat, flattenRow(value as Record<string, unknown>, nextKey));
    else if (Array.isArray(value)) flat[nextKey] = `${value.length} items`;
  }
  return flat;
}

function columnsForRows(rows: Array<Record<string, unknown>>): string[] {
  const columns = new Set<string>();
  for (const row of rows.slice(0, 25)) Object.keys(row).forEach((key) => columns.add(key));
  return Array.from(columns).slice(0, 10);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date));
}

function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return formatMetric(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 87)}...` : value;
  return JSON.stringify(value);
}

function formatMetric(value: number): string {
  return Math.abs(value) >= 1000 ? value.toLocaleString() : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function labelFromPath(path: string): string {
  return path.split(".").slice(-2).map(humanize).join(" / ");
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function apiJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

async function responseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: unknown; code?: unknown };
    const error = typeof parsed.error === "string" ? parsed.error : text;
    return typeof parsed.code === "string" ? `${error} (${parsed.code})` : error;
  } catch {
    return text || `${response.status} ${response.statusText}`;
  }
}

function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
}

function reviveMemories(raw: unknown[]): Memory[] {
  return raw.map(reviveMemory);
}

function reviveMemory(raw: unknown): Memory {
  const memory = raw as Memory & { createdAt?: string | Date; updatedAt?: string | Date; archivedAt?: string | Date; lastAccessedAt?: string | Date };
  return {
    ...memory,
    createdAt: toDate(memory.createdAt),
    updatedAt: toDate(memory.updatedAt),
    archivedAt: memory.archivedAt ? toDate(memory.archivedAt) : undefined,
    lastAccessedAt: memory.lastAccessedAt ? toDate(memory.lastAccessedAt) : undefined
  };
}

function toDate(value: string | Date | undefined): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date();
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function ageDays(value: Date | string): number {
  return Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id;
}

function tagList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function needsReview(memory: Memory): boolean {
  return memory.tags.includes("needs-review") || memory.trust < 0.56 || memory.source.confidence < 0.55;
}

function draftFromMemory(memory: Memory): DraftMemory {
  return {
    id: memory.id,
    content: memory.content,
    tags: memory.tags.join(", "),
    visibility: memory.consent?.visibility ?? "private",
    trust: memory.trust
  };
}

function isSecretConnectorKey(key: string): boolean {
  return /(TOKEN|SECRET|PASSWORD|API_KEY|APP_KEY|PRIVATE_KEY|PAT|OAUTH)/i.test(key);
}

function providerConfigKeys(providerId: VendorProvider): string[] {
  const provider = vendorProviders.find((item) => item.id === providerId) ?? vendorProviders[0];
  return [...new Set(provider.env)];
}

function connectorEnvAliases(key: string): string[] {
  if (key === "MEMORY_DISCORD_BOT_TOKEN") return ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_TOKEN"];
  if (key === "MEMORY_SLACK_TOKEN") return ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_BOT_TOKEN"];
  if (key === "MEMORY_GITHUB_TOKEN") return ["MEMORY_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"];
  if (key === "MEMORY_JIRA_API_TOKEN") return ["MEMORY_JIRA_API_TOKEN", "JIRA_API_TOKEN"];
  if (key === "MEMORY_CONFLUENCE_API_TOKEN") return ["MEMORY_CONFLUENCE_API_TOKEN", "CONFLUENCE_API_TOKEN", "MEMORY_JIRA_API_TOKEN"];
  if (key === "MEMORY_NOTION_TOKEN") return ["MEMORY_NOTION_TOKEN", "NOTION_TOKEN"];
  if (key === "MEMORY_LINEAR_API_KEY") return ["MEMORY_LINEAR_API_KEY", "LINEAR_API_KEY"];
  if (key === "MEMORY_GITLAB_TOKEN") return ["MEMORY_GITLAB_TOKEN", "GITLAB_TOKEN"];
  if (key === "MEMORY_AZURE_DEVOPS_TOKEN") return ["MEMORY_AZURE_DEVOPS_TOKEN", "AZURE_DEVOPS_EXT_PAT"];
  if (key === "MEMORY_TEAMS_TOKEN") return ["MEMORY_TEAMS_TOKEN", "MICROSOFT_GRAPH_TOKEN"];
  if (key === "MEMORY_GOOGLE_TOKEN") return ["MEMORY_GOOGLE_TOKEN", "GOOGLE_OAUTH_TOKEN"];
  if (key === "MEMORY_ASANA_TOKEN") return ["MEMORY_ASANA_TOKEN", "ASANA_ACCESS_TOKEN"];
  if (key === "MEMORY_CLICKUP_TOKEN") return ["MEMORY_CLICKUP_TOKEN", "CLICKUP_API_TOKEN"];
  if (key === "MEMORY_SENTRY_TOKEN") return ["MEMORY_SENTRY_TOKEN", "SENTRY_AUTH_TOKEN"];
  if (key === "MEMORY_DATADOG_API_KEY") return ["MEMORY_DATADOG_API_KEY", "DD_API_KEY", "DATADOG_API_KEY"];
  if (key === "MEMORY_DATADOG_APP_KEY") return ["MEMORY_DATADOG_APP_KEY", "DD_APP_KEY", "DATADOG_APP_KEY"];
  if (key === "MEMORY_PAGERDUTY_TOKEN") return ["MEMORY_PAGERDUTY_TOKEN", "PAGERDUTY_TOKEN"];
  if (key === "MEMORY_POSTHOG_TOKEN") return ["MEMORY_POSTHOG_TOKEN", "POSTHOG_PERSONAL_API_KEY"];
  return [key];
}

function connectorIdForProvider(providerId: VendorProvider): string {
  if (providerId === "teams") return "official-microsoft-teams";
  return `official-${providerId}`;
}

function titleFor(view: ViewId): string {
  return {
    overview: "Operator cockpit",
    memories: "Memory CRUD",
    connectors: "Connector control",
    dreaming: "Dreaming and maintenance",
    harnesses: "Harness installer",
    reports: "Stats and reports"
  }[view];
}

function subtitleFor(view: ViewId): string {
  return {
    overview: "The live runtime, memory quality, connectors, modules, and next operator actions in one dense view.",
    memories: "Create, edit, verify, archive, delete, and export memory records without leaving the workbench.",
    connectors: "Register vendor manifests, inspect health, trigger polls, and install runtime modules.",
    dreaming: "Plan and run memory maintenance with visible actions and review queues.",
    harnesses: "Prepare install commands for agent lifecycle harnesses and local automation hooks.",
    reports: "Load metrics, audit, compliance, storage, and benchmark payloads from the same API."
  }[view];
}
