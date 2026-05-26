import React, { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, Download, Eye, GitBranch, ListFilter, Network, Pin, Plus, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Trash2, WifiOff } from "lucide-react";
import { activateGraph, exportMemoryGraph, findGraphPaths, type FeedbackKind, type Memory, type ReflectionReport, type SearchResult } from "../../../core";
import { engineeringKindFilters } from "../../constants";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom } from "../../types";
import { ageLabel, clusterEntities, itemLabel, needsReview, reviewReason, scopeLabel, shortId, supersessionLabel, timelineEvents, viewTitle, viewSubtitle } from "../../utils";
import { ActionLog, MemoryMini, Metric, OutputGroup, engineeringKindLabel } from "../viewShared";

export function MemoryView({
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
