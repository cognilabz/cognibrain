import type { RealityRawOutput, RealitySystemResult, RealityTask } from "./types";

export function scoreRealityOutputs(tasks: RealityTask[], outputs: RealityRawOutput[]): Pick<RealitySystemResult, "metrics"> & { trace: unknown[] } {
  const byTask = new Map(outputs.map((output) => [output.taskId, output]));
  let expectedHits = 0;
  let expectedTotal = 0;
  let forbiddenHits = 0;
  let actionHits = 0;
  const trace = tasks.map((task) => {
    const output = byTask.get(task.id);
    const evidence = new Set(output?.evidenceIds ?? []);
    const expected = task.query.expectedEvidenceIds.filter((id) => evidence.has(id)).length;
    const forbidden = task.query.forbiddenEvidenceIds.filter((id) => evidence.has(id)).length;
    const action = output?.action === task.query.expectedAction;
    expectedHits += expected;
    expectedTotal += task.query.expectedEvidenceIds.length;
    forbiddenHits += forbidden;
    if (action) actionHits += 1;
    return { taskId: task.id, expected, forbidden, action, latencyMs: output?.latencyMs ?? null };
  });
  const latencies = outputs.map((output) => output.latencyMs).sort((a, b) => a - b);
  const evidenceRecall = expectedTotal === 0 ? 1 : expectedHits / expectedTotal;
  const forbiddenLeakageRate = tasks.length === 0 ? 0 : forbiddenHits / tasks.length;
  const actionAccuracy = tasks.length === 0 ? 0 : actionHits / tasks.length;
  const score = Math.max(0, (evidenceRecall * 0.45) + ((1 - forbiddenLeakageRate) * 0.35) + (actionAccuracy * 0.2));
  return {
    metrics: {
      score,
      expectedEvidenceRecall: evidenceRecall,
      forbiddenLeakageRate,
      actionAccuracy,
      p50LatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      estimatedCostUsd: 0
    },
    trace
  };
}

function percentile(values: number[], q: number) {
  if (values.length === 0) return null;
  return values[Math.min(values.length - 1, Math.floor((values.length - 1) * q))];
}
