import { getEngineeringMetadata } from "./engineeringMemory";
import type { CurrentTruthDecision, Memory, SearchResult } from "./types";

export type TruthGateAction = "inject" | "review" | "exclude" | "revalidate";

export type TruthGateDecision =
  | { action: "inject"; reason: string }
  | { action: "review"; reason: string }
  | { action: "exclude"; reason: string }
  | { action: "revalidate"; reason: string };

export interface TruthGateMetrics {
  excluded: number;
  reviewed: number;
  missingClaim: number;
  suppressedClaims: number;
  revalidate: number;
}

export interface TruthGateInput {
  memory: Memory;
  truthDecision?: CurrentTruthDecision;
}

export interface TruthGateResult {
  decision: TruthGateDecision;
  truth?: NonNullable<SearchResult["truth"]>;
  unsafeToInject: boolean;
  metric: keyof TruthGateMetrics | "inject";
  suppressedClaimCount: number;
}

export function evaluateTruthGate(input: TruthGateInput): TruthGateResult {
  const explicitClaim = Boolean(input.memory.metadata?.claim);
  const engineering = getEngineeringMetadata(input.memory);
  if (engineering && !explicitClaim) {
    return {
      decision: { action: "review", reason: "truth review required: engineering memory lacks claim record" },
      unsafeToInject: true,
      metric: "missingClaim",
      suppressedClaimCount: 0
    };
  }

  const truthDecision = input.truthDecision;
  if (!truthDecision) {
    return {
      decision: { action: "inject", reason: "no explicit truth claim required for this memory" },
      unsafeToInject: false,
      metric: "inject",
      suppressedClaimCount: 0
    };
  }

  const truth = truthSummaryForDecision(truthDecision);
  const suppressedClaimCount = truth.suppressedClaimIds.length;
  const selectedDifferentMemory = truthDecision.state === "selected" && truthDecision.selectedMemoryId && truthDecision.selectedMemoryId !== input.memory.id;
  if (explicitClaim && selectedDifferentMemory) {
    return {
      decision: { action: "exclude", reason: `truth excluded: ${truthDecision.reason}` },
      truth,
      unsafeToInject: true,
      metric: "excluded",
      suppressedClaimCount
    };
  }

  if (explicitClaim && truthDecision.state === "uncertain") {
    return {
      decision: { action: "review", reason: `truth review required: ${truthDecision.reason}` },
      truth,
      unsafeToInject: true,
      metric: "reviewed",
      suppressedClaimCount
    };
  }

  if (explicitClaim && truthDecision.state === "missing") {
    return {
      decision: { action: "revalidate", reason: `truth revalidation required: ${truthDecision.reason}` },
      truth,
      unsafeToInject: true,
      metric: "revalidate",
      suppressedClaimCount
    };
  }

  return {
    decision: { action: "inject", reason: `truth ${truthDecision.state}: ${truthDecision.reason}` },
    truth,
    unsafeToInject: false,
    metric: "inject",
    suppressedClaimCount
  };
}

export function applyTruthGateDecision(
  result: SearchResult,
  truthDecision?: CurrentTruthDecision,
  recordMetric?: (metric: keyof TruthGateMetrics | "inject", suppressedClaimCount: number) => void
): SearchResult {
  const gate = evaluateTruthGate({ memory: result.memory, truthDecision });
  recordMetric?.(gate.metric, gate.suppressedClaimCount);
  const explanation = [...(result.explanation ?? []), gate.decision.reason];
  if (gate.decision.action === "inject") {
    return { ...result, truth: gate.truth, explanation };
  }
  const decision = gate.decision.action === "exclude" ? "exclude" : result.decision === "exclude" ? "exclude" : "review";
  return {
    ...result,
    truth: gate.truth,
    decision,
    unsafeToInject: true,
    explanation
  };
}

export function createTruthGateMetrics(): TruthGateMetrics {
  return { excluded: 0, reviewed: 0, missingClaim: 0, suppressedClaims: 0, revalidate: 0 };
}

function truthSummaryForDecision(truthDecision: CurrentTruthDecision): NonNullable<SearchResult["truth"]> {
  return {
    selectedClaimId: truthDecision.selectedClaimId,
    selectedMemoryId: truthDecision.selectedMemoryId,
    currentTruthState: truthDecision.state,
    suppressedClaimIds: truthDecision.suppressedClaimIds ?? [],
    reason: truthDecision.reason,
    conflictSetId: truthDecision.conflictSetId
  };
}
