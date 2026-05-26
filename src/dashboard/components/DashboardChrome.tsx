import React from "react";
import { Activity, Archive, BarChart3, Cpu, GitBranch, Network, ShieldCheck, Sparkles } from "lucide-react";
import type { Memory } from "../../core";
import type { ConnectorHealth, RuntimeStatus, ViewId } from "../types";
import { logoUrl, platformSignals, viewItems } from "../constants";
import { operatorControls } from "../fixtures";
import { viewSubtitle, viewTitle } from "../utils";
import { Metric } from "./views";

export function DashboardChrome({
  view,
  setView,
  runtime,
  runtimeNotice,
  health,
  reviewCount,
  connectorHealth,
  cleanRiskyMemories,
  runDreamCycle
}: {
  view: ViewId;
  setView: (view: ViewId) => void;
  runtime: RuntimeStatus;
  runtimeNotice: string;
  health: { healthScore: number; active: number; averageTrust: number; freshness: number };
  reviewCount: number;
  connectorHealth: ConnectorHealth[];
  cleanRiskyMemories: () => void;
  runDreamCycle: () => void;
}) {
  return (
    <>
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
    </>
  );
}
