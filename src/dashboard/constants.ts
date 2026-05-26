import React from "react";
import { BarChart3, Clock3, Database, GitBranch, Network, ShoppingBag, SlidersHorizontal, Sparkles, Terminal } from "lucide-react";
import type { EngineeringKindFilter, ViewId } from "./types";

export const viewItems: Array<{ id: ViewId; label: string; icon: React.ElementType; note: string }> = [
  { id: "memories", label: "Store", icon: Database, note: "Inspect facts" },
  { id: "recall", label: "Recall", icon: SlidersHorizontal, note: "Tune context" },
  { id: "graph", label: "Graph", icon: GitBranch, note: "Explain paths" },
  { id: "timeline", label: "Time", icon: Clock3, note: "Patterns" },
  { id: "dream", label: "Dream", icon: Sparkles, note: "Repair memory" },
  { id: "marketplace", label: "Market", icon: ShoppingBag, note: "Modules" },
  { id: "proof", label: "Proof", icon: BarChart3, note: "Verify claims" }
];

export const engineeringKindFilters: EngineeringKindFilter[] = [
  "all",
  "repo_policy",
  "architecture_decision",
  "review_correction",
  "tool_outcome",
  "procedure",
  "forbidden_action",
  "migration_note",
  "test_strategy",
  "dependency_rule",
  "generated_file_rule"
];

export const logoUrl = new URL("../../docs/assets/cognilabz-logo.png", import.meta.url).href;

export const platformSignals = [
  { label: "CLI", value: "setup installs skill + runtime", icon: Terminal },
  { label: "API", value: "scoped HTTP and MCP store", icon: Network },
  { label: "Dream", value: "staleness and pattern maintenance", icon: Sparkles }
];
