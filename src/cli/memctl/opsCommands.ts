import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { MemoryService } from "../../api/service";
import { buildLeaderboardArtifact } from "../../eval/leaderboard";
import { runNextgenBenchmarkSuites } from "../../eval/nextgenBenchmarks";
import {
  codebaseScopeFromEnv,
  csvList,
  engineeringKindFromEnv,
  fail,
  graphExplainStrategyFromEnv,
  isFeedbackKind,
  managedPlanFromEnv,
  managedTenantStatusFromEnv,
  metadataFromEnv,
  observationStyleFromEnv,
  optionValue,
  permissionsFromEnv,
  privacyComputeDimensionsFromEnv,
  privacyDefaultFromEnv,
  relationTypesFromEnv,
  retrievalModeFromEnv,
  searchFiltersFromEnv,
  summaryStyleFromEnv
} from "./env";

type CommandContext = { service: MemoryService; userId: string };

export async function handleOpsCommands(command: string | undefined, args: string[], context: CommandContext): Promise<boolean> {
  const { service, userId } = context;
  switch (command) {
  case "benchmark-nextgen": {
    console.log(JSON.stringify(runNextgenBenchmarkSuites(args[0] ?? "artifacts/nextgen-benchmarks.json", process.env.MEMORY_BENCHMARK_TREND_PATH ?? "artifacts/benchmark-trend.json"), null, 2));
    return true;
  }
  case "leaderboard": {
    console.log(JSON.stringify(buildLeaderboardArtifact({ outputPath: args[0] ?? "artifacts/leaderboard.json", nextgenPath: process.env.MEMORY_NEXTGEN_BENCHMARK_PATH, evaluationPath: process.env.MEMORY_EVALUATION_REPORT_PATH }), null, 2));
    return true;
  }
  case "benchmark-proof": {
    const output = execFileSync("npm", ["run", "--silent", "internal", "--", "benchmark:release"], { encoding: "utf8", maxBuffer: 2_000_000 });
    console.log(output.trim());
    return true;
  }
  case "production-certify": {
    const output = execFileSync("npm", ["run", "release:certify", "--silent"], { encoding: "utf8", maxBuffer: 5_000_000 });
    console.log(output.trim());
    return true;
  }
  case "provider-status": {
    console.log(JSON.stringify(service.providerStatus(), null, 2));
    return true;
  }
  case "translate": {
    const text = args.join(" ");
    if (!text) fail("Usage: memctl translate <text>");
    console.log(JSON.stringify(service.translateText(text, process.env.MEMORY_LANGUAGE, process.env.MEMORY_TARGET_LANGUAGE ?? "en"), null, 2));
    return true;
  }
  case "consent": {
    const [memoryId, visibility] = args;
    if (!memoryId || !["private", "user", "org", "public"].includes(visibility)) fail("Usage: memctl consent <memory-id> <private|user|org|public>");
    console.log(JSON.stringify(service.updateConsent(memoryId, { visibility: visibility as "private" | "user" | "org" | "public" }), null, 2));
    return true;
  }
  case "revert": {
    const [memoryId, auditEventId] = args;
    if (!memoryId) fail("Usage: memctl revert <memory-id> [audit-event-id]");
    console.log(JSON.stringify(service.revertMemory(memoryId, auditEventId), null, 2));
    return true;
  }
  case "offline-add": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl offline-add <content>");
    console.log(
      JSON.stringify(
        service.queueOfflineOperation({
          type: "add",
          userId,
          clientMutationId: process.env.MEMORY_CLIENT_MUTATION_ID,
          input: {
            userId,
            content,
            brainId: process.env.MEMORY_BRAIN_ID,
            sourceId: process.env.MEMORY_SOURCE_ID,
            orgId: process.env.MEMORY_ORG_ID,
            source: { kind: "human", confidence: 0.9 }
          }
        }),
        null,
        2
      )
    );
    return true;
  }
  case "offline-update": {
    const [memoryId, ...contentParts] = args;
    if (!memoryId || contentParts.length === 0) fail("Usage: memctl offline-update <memory-id> <content>");
    console.log(JSON.stringify(service.queueOfflineOperation({ type: "update", userId, memoryId, patch: { content: contentParts.join(" ") } }), null, 2));
    return true;
  }
  case "sync": {
    console.log(JSON.stringify(service.syncOfflineOperations(), null, 2));
    return true;
  }
  case "sync-status": {
    console.log(JSON.stringify(service.syncStatus(), null, 2));
    return true;
  }
  case "lifecycle-preview": {
    console.log(JSON.stringify(service.lifecyclePreview(userId), null, 2));
    return true;
  }
  case "dream-policy": {
    console.log(JSON.stringify(service.adaptiveDreamPolicy(userId), null, 2));
    return true;
  }
  case "observations": {
    console.log(JSON.stringify(service.generateObservations(userId, { style: observationStyleFromEnv(), persist: process.env.MEMORY_PERSIST_OBSERVATIONS === "true", limit: process.env.MEMORY_OBSERVATION_LIMIT ? Number(process.env.MEMORY_OBSERVATION_LIMIT) : undefined }), null, 2));
    return true;
  }
  case "predictions": {
    console.log(JSON.stringify(service.predictionReport(userId, { query: args.join(" ") || undefined, limit: process.env.MEMORY_PREDICTION_LIMIT ? Number(process.env.MEMORY_PREDICTION_LIMIT) : undefined }), null, 2));
    return true;
  }
  case "export": {
    console.log(JSON.stringify(service.exportUser(userId), null, 2));
    return true;
  }
  case "delete-user": {
    console.log(JSON.stringify({ deleted: service.deleteUser(userId) }, null, 2));
    return true;
  }
  }
  return false;
}
