import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function MarketplaceView({
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
