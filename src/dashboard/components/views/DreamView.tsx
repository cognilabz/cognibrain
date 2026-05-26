import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function DreamView({
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
