import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function GraphView({ memories }: { memories: Memory[] }) {
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
