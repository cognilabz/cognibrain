#!/usr/bin/env node
import { resolve } from "node:path";
import { MemoryService } from "../api/service";
import type { FeedbackKind } from "../core";

const userId = process.env.MEMORY_USER_ID ?? process.env.USER ?? "local";
const dbPath = resolve(process.env.MEMORY_DB_PATH ?? ".memory-harness.json");
const service = new MemoryService({
  persistencePath: dbPath,
  autoDream: {
    enabled: process.env.MEMORY_AUTO_DREAM !== "false",
    intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
    writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
  }
});

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "add": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl add <content>");
    const memory = service.add({ userId, content, source: { kind: "human", confidence: 0.95 } });
    console.log(JSON.stringify(memory, null, 2));
    break;
  }
  case "extract": {
    const content = args.join(" ");
    if (!content) fail("Usage: memctl extract <conversation-or-event-text>");
    const report = service.extract([{ role: "user", content }], {
      userId,
      agentId: process.env.MEMORY_AGENT_ID,
      sessionId: process.env.MEMORY_SESSION_ID,
      appId: process.env.MEMORY_APP_ID,
      orgId: process.env.MEMORY_ORG_ID,
      projectId: process.env.MEMORY_PROJECT_ID
    });
    console.log(JSON.stringify(report, null, 2));
    break;
  }
  case "search": {
    const query = args.join(" ");
    if (!query) fail("Usage: memctl search <query>");
    const results = service.search({ userId, query, limit: 5 });
    console.log(
      results
        .map((result, index) => `${index + 1}. ${result.score.toFixed(2)} ${result.memory.content}\n   ${result.citation}`)
        .join("\n")
    );
    break;
  }
  case "reflect":
  case "dream": {
    const report = command === "dream" ? service.dream(userId) : service.reflect(userId);
    console.log(
      [
        `created=${report.created.length}`,
        `demoted=${report.demoted.length}`,
        `contradictions=${report.contradictions.length}`,
        `faded=${report.lifecycle.faded}`,
        `archived=${report.lifecycle.archived}`,
        `reorganized=${report.lifecycle.reorganized}`,
        `quality=${report.lifecycle.qualityScore.toFixed(2)}`
      ].join(" ")
    );
    break;
  }
  case "health": {
    console.log(JSON.stringify(service.health(userId), null, 2));
    break;
  }
  case "maintenance": {
    console.log(JSON.stringify(service.maintenanceStatus(), null, 2));
    break;
  }
  case "feedback": {
    const [memoryId, kind, ...note] = args;
    if (!memoryId || !kind) fail("Usage: memctl feedback <memory-id> <helpful|wrong|stale|always_include|never_include|private|shareable> [note]");
    if (!isFeedbackKind(kind)) {
      fail(`Unsupported feedback kind: ${kind}`);
    }
    console.log(JSON.stringify(service.feedback({ memoryId, kind, userId, note: note.join(" ") || undefined }), null, 2));
    break;
  }
  case "metrics": {
    console.log(JSON.stringify(service.metricsReport(), null, 2));
    break;
  }
  case "export": {
    console.log(JSON.stringify(service.exportUser(userId), null, 2));
    break;
  }
  case "delete-user": {
    console.log(JSON.stringify({ deleted: service.deleteUser(userId) }, null, 2));
    break;
  }
  default:
    fail("Usage: memctl <add|extract|search|reflect|dream|health|maintenance|feedback|metrics|export|delete-user> ...");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isFeedbackKind(value: string): value is FeedbackKind {
  return ["helpful", "wrong", "stale", "always_include", "never_include", "private", "shareable"].includes(value);
}
