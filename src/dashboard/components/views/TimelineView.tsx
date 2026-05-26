import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function TimelineView({
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
