import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function RecallView({
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
