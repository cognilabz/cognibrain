import { defaultService } from "../api/service";

const command = process.argv[2];
const payload = JSON.parse(process.env.COGNIBRAIN_LIFECYCLE_PAYLOAD_JSON ?? process.env.COGNIBRAIN_HARNESS_PAYLOAD_JSON ?? "{}");

async function main() {
  switch (command) {
    case "context":
      return defaultService.codingContextPack(payload);
    case "guard":
      return defaultService.guardAction(payload);
    case "outcome":
      return defaultService.recordHarnessAction(payload);
    case "correction":
      return defaultService.recordCodeCorrection(payload);
    case "patch-evidence":
      return defaultService.patchEvidenceTrail(payload);
    case "session-end":
      return prepare("harness_session_end", { ...payload, sourceRefresh: payload.sourceRefresh ?? false });
    case "handoff":
      return prepare("harness_handoff", { ...payload, sourceRefresh: payload.sourceRefresh ?? true });
    case "release-prepare":
      return prepare("before_release", { ...payload, sourceRefresh: payload.sourceRefresh ?? true, budget: payload.budget ?? "release" });
    case "dream-plan":
      return defaultService.dreamPlan(payload);
    case "health":
      return defaultService.health(payload.userId);
    case "source-revalidate":
      return payload.memoryId
        ? defaultService.revalidateMemory(payload.memoryId, payload.userId)
        : defaultService.revalidateSourceRefs(payload.userId, { connectorIds: payload.connectorIds, limit: payload.limit });
    case "conflicts":
      return defaultService.listConflictSets(payload.status);
    default:
      throw new Error(`Unsupported harness local-direct command: ${command}`);
  }
}

function prepare(trigger: "harness_session_end" | "harness_handoff" | "before_release", input: Record<string, unknown>) {
  const prepared = defaultService.prepareDream({
    ...input,
    trigger,
    mode: input.mode ?? "dream"
  } as any);
  return {
    plan: prepared.plan,
    report: prepared.report
  };
}

main()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
