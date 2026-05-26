import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FeedbackKind, Memory, ReflectionReport, SearchResult } from "../../core";
import type { EngineeringKindFilter, MarketplaceModuleCard, MemoryFilter, RoutePreview, RuntimeStatus, TimeZoom, ViewId } from "../types";
import { DreamView, GraphView, MarketplaceView, MemoryView, ProofView, RecallView, TimelineView } from "./views";

export function ViewRouter({
  view,
  filter,
  setFilter,
  engineeringFilter,
  setEngineeringFilter,
  memories,
  filteredMemories,
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
  lastClean,
  query,
  setQuery,
  results,
  routePreview,
  retrievalWeights,
  setRetrievalWeights,
  graphDepth,
  setGraphDepth,
  timeZoom,
  setTimeZoom,
  lastCycle,
  runDreamCycle,
  lifecyclePolicy,
  setLifecyclePolicy,
  modules,
  installModule,
  runtime,
  installingModuleId,
  marketplaceNotice,
  artifactText,
  setArtifactText,
  artifactSummary
}: {
  view: ViewId;
  filter: MemoryFilter;
  setFilter: (filter: MemoryFilter) => void;
  engineeringFilter: EngineeringKindFilter;
  setEngineeringFilter: (filter: EngineeringKindFilter) => void;
  memories: Memory[];
  filteredMemories: Memory[];
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
  query: string;
  setQuery: (value: string) => void;
  results: SearchResult[];
  routePreview: RoutePreview;
  retrievalWeights: Record<string, number>;
  setRetrievalWeights: Dispatch<SetStateAction<{ semantic: number; keyword: number; entity: number; temporal: number; behavioral: number; trust: number; graph: number; access: number }>>;
  graphDepth: number;
  setGraphDepth: Dispatch<SetStateAction<number>>;
  timeZoom: TimeZoom;
  setTimeZoom: (zoom: TimeZoom) => void;
  lastCycle: ReflectionReport | null;
  runDreamCycle: () => void;
  lifecyclePolicy: { fadeAfterDays: number; archiveAfterDays: number };
  setLifecyclePolicy: Dispatch<SetStateAction<{ fadeAfterDays: number; archiveAfterDays: number }>>;
  modules: MarketplaceModuleCard[];
  installModule: (moduleId: string) => void;
  runtime: RuntimeStatus;
  installingModuleId: string | null;
  marketplaceNotice: string;
  artifactText: string;
  setArtifactText: (value: string) => void;
  artifactSummary: ReturnType<typeof import("./views").summarizeArtifact>;
}) {
  return (
    <>
      {view === "memories" ? (
        <MemoryView
          filter={filter}
          setFilter={setFilter}
          engineeringFilter={engineeringFilter}
          setEngineeringFilter={setEngineeringFilter}
          memories={filteredMemories}
          selectedMemory={selectedMemory}
          newMemory={newMemory}
          setNewMemory={setNewMemory}
          addMemory={addMemory}
          selectMemory={selectMemory}
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
        />
      ) : null}

      {view === "recall" ? (
        <RecallView
          query={query}
          setQuery={setQuery}
          results={results}
          selectedMemory={selectedMemory}
          selectMemory={selectMemory}
          routePreview={routePreview}
          retrievalWeights={retrievalWeights}
          setRetrievalWeights={setRetrievalWeights}
          graphDepth={graphDepth}
          setGraphDepth={setGraphDepth}
        />
      ) : null}

      {view === "graph" ? <GraphView memories={memories} /> : null}

      {view === "timeline" ? (
        <TimelineView
          memories={memories}
          timeZoom={timeZoom}
          setTimeZoom={setTimeZoom}
          applyFeedback={applyFeedback}
          selectMemory={selectMemory}
        />
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

      {view === "marketplace" ? (
        <MarketplaceView modules={modules} installModule={installModule} runtime={runtime} installingModuleId={installingModuleId} notice={marketplaceNotice} />
      ) : null}

      {view === "proof" ? (
        <ProofView artifactText={artifactText} setArtifactText={setArtifactText} artifactSummary={artifactSummary} metrics={runtime.metrics} />
      ) : null}
    </>
  );
}
