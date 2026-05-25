import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { MemoryService } from "../api/service";
import { HarnessMemoryHook } from "../connectors/harnessHook";

interface ConnectorLiveReport {
  schemaVersion: "1.0";
  generatedAt: string;
  checks: Record<string, boolean>;
  calls: Array<{ url?: string; body: string }>;
  harnesses: string[];
  harnessRuns: HarnessGoldenPathRun[];
  passed: boolean;
}

interface HarnessGoldenPathRun {
  harness: string;
  repo: string;
  checks: Record<string, boolean>;
  codingContextPackId?: string;
  patchEvidenceTrailId?: string;
  passed: boolean;
}

export async function runConnectorLiveVerification(out?: string): Promise<ConnectorLiveReport> {
  const service = new MemoryService();
  const calls: Array<{ url?: string; body: string }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      calls.push({ url: request.url, body });
      response.setHeader("content-type", "application/json");
      const [, connector, action] = request.url?.split("/") ?? [];
      if (action === "list") {
        response.end(JSON.stringify({ items: [{ externalId: `${connector}-item-1`, title: `${connector} live item` }] }));
        return;
      }
      if (action === "poll" && connector === "github") {
        response.end(JSON.stringify({ events: [
          { role: "tool", content: "GitHub PR decision approved Atlas depends on CacheClient for the release gate.", externalId: "pr-42", uri: "https://github.com/cognilabz/cognibrain/pull/42", source: { kind: "reviewed_code", confidence: 0.96 }, metadata: { eventType: "pr_decision", repo: "cognilabz/cognibrain", pullRequest: 42, author: "reviewer" } },
          { role: "tool", content: "GitHub Actions test failure requires npm test before release.", externalId: "run-7", uri: "https://github.com/cognilabz/cognibrain/actions/runs/7", source: { kind: "tool", confidence: 0.9 }, metadata: { eventType: "test_failure", repo: "cognilabz/cognibrain", command: "npm test" } }
        ] }));
        return;
      }
      if (action === "poll" && connector === "slack") {
        response.end(JSON.stringify({ events: [
          { role: "user", content: "Slack thread decision: Team decided Atlas must use Postgres for release notes.", externalId: "slack-thread-1", uri: "https://slack.example/archives/C1/p123", source: { kind: "transcript", confidence: 0.86 }, metadata: { eventType: "thread_decision", channel: "eng", threadId: "123", reviewRequired: true, visibility: "org", reactions: { white_check_mark: 4 } } }
        ] }));
        return;
      }
      if (action === "poll" && connector === "discord") {
        response.end(JSON.stringify({ events: [
          { role: "user", content: "Discord thread decision candidate says support bot should cite evidence before action.", externalId: "discord-msg-1", uri: "https://discord.example/channels/1/2/3", source: { kind: "transcript", confidence: 0.84 }, metadata: { eventType: "thread_decision", channel: "memory-os", reviewRequired: true, visibility: "org", mentions: ["support-bot"] } }
        ] }));
        return;
      }
      response.writeHead(202);
      response.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
    const base = `http://127.0.0.1:${address.port}`;
    installConnector(service, "official-github", "GitHub", "code", `${base}/github`);
    installConnector(service, "official-slack", "Slack", "chat", `${base}/slack`);
    installConnector(service, "official-discord", "Discord", "chat", `${base}/discord`);

    const oauth = service.beginConnectorOAuth("official-github", { stateSalt: "live-verify" });
    const authorized = service.completeConnectorOAuth({ connectorId: "official-github", state: oauth.state, code: "gh-code" });
    const githubList = await service.listConnectorItems("official-github");
    const githubSync = await service.pollConnector("official-github", { userId: "u1", orgId: "org1", projectId: "cognibrain" });
    const githubWriteback = await service.writebackConnector("official-github", { operation: "comment", externalId: "pr-42", content: "Memory-linked release decision", target: { repo: "cognilabz/cognibrain", pullRequest: 42 }, dryRun: false });

    const slackSync = await service.pollConnector("official-slack", { userId: "u1", orgId: "org1", projectId: "cognibrain" });
    const slackWriteback = await service.writebackConnector("official-slack", { operation: "summary", externalId: "slack-thread-1", content: "Decision captured for review", target: { channel: "eng", threadId: "123" }, dryRun: false });
    const discordSync = await service.pollConnector("official-discord", { userId: "u1", orgId: "org1", projectId: "cognibrain" });
    const revoked = service.revokeConnectorAuth("official-github", "live-verifier");

    const memories = service.list("u1");
    const prDecision = memories.find((memory) => memory.metadata.externalId === "pr-42");
    const testFailure = memories.find((memory) => memory.metadata.externalId === "run-7");
    const slackDecision = memories.find((memory) => memory.metadata.externalId === "slack-thread-1");
    const discordDecision = memories.find((memory) => memory.metadata.externalId === "discord-msg-1");
    const graph = service.graphExport({ userId: "u1", relationTypes: ["depends_on"] }) as { edges?: Array<{ type: string; targetEntity?: string }> };
    const harness = verifyHarnessPackages();
    const harnessRun = verifyHarnessGoldenPath();

    const checks = {
      connectorAuthSecretHash: authorized.status === "authorized" && Boolean(authorized.tokenHash) && !String(authorized.tokenHash).includes("gh-code"),
      connectorRevoke: revoked.length > 0 && service.connectorAuthStatus("official-github").every((session) => session.status === "revoked"),
      githubListPollWrite: githubList.status === "applied" && githubSync.status === "applied" && githubWriteback.status === "applied",
      githubPrDecisionMemory: Boolean(prDecision?.tags.includes("pr-decision")),
      githubTestFailureActionMemory: Boolean(testFailure?.tags.includes("test-failure") && testFailure.tags.includes("harness-action")),
      githubRepoGraphEdges: Boolean(graph.edges?.some((edge) => edge.type === "depends_on")),
      slackDecisionReviewQueue: Boolean(slackDecision?.beliefState === "needs_verification" && service.verificationQueue("u1").items.some((item) => item.memoryId === slackDecision.id)),
      slackConsentVisibility: slackDecision?.consent.visibility === "org",
      slackWriteback: slackWriteback.status === "applied",
      discordDecisionReviewQueue: Boolean(discordDecision?.beliefState === "needs_verification" && service.verificationQueue("u1").items.some((item) => item.memoryId === discordDecision.id)),
      syncStatusVisible: service.connectorHealth().filter((item) => ["official-github", "official-slack", "official-discord"].includes(item.connectorId)).every((item) => item.records > 0),
      harnessPackages: harness.passed,
      claudeGoldenPathRun: harnessRun.passed
    };
    const report: ConnectorLiveReport = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      checks,
      calls,
      harnesses: harness.harnesses,
      harnessRuns: [harnessRun],
      passed: Object.values(checks).every(Boolean)
    };
    if (out) {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { dirname } = await import("node:path");
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify(report, null, 2));
    }
    return report;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function verifyHarnessGoldenPath(): HarnessGoldenPathRun {
  const repo = "demo-claude-code";
  const service = new MemoryService({ autoDream: { enabled: false } });
  const codebaseScope = { repo, branch: "main", harness: "claude" };
  service.recordCodeCorrection({
    userId: "harness-demo",
    appId: "claude",
    projectId: repo,
    content: "Do not use pnpm in demo-claude-code; use npm test before release and do not edit generated files.",
    kind: "repo_policy",
    correctAction: "npm test",
    codebase: codebaseScope
  });
  service.recordCodeCorrection({
    userId: "harness-demo",
    appId: "claude",
    projectId: repo,
    content: "Before tool calls in demo-claude-code, recall repo policy, inspect the validation folder, then run npm test after the patch.",
    kind: "procedure",
    correctAction: "inspect validation and run npm test",
    codebase: codebaseScope
  });
  const hook = new HarnessMemoryHook(service, { maxMemories: 8, tokenBudget: 700 });
  const context = {
    userId: "harness-demo",
    agentId: "claude-code",
    appId: "claude",
    projectId: repo,
    sessionId: "claude-demo-run",
    prompt: "Fix validation in the demo repo without repeating the package-manager mistake.",
    codebaseScope
  };

  const session = hook.startSession(context);
  const preTool = hook.beforeToolCall(context, { command: "pnpm test", cwd: `/tmp/${repo}` });
  const action = hook.afterToolCall(context, {
    command: "npm test",
    cwd: `/tmp/${repo}`,
    exitCode: 0,
    filesChanged: ["src/validation/userValidation.ts"],
    tests: [{ name: "npm test", status: "passed", output: "ok" }]
  });
  const correction = hook.captureCorrection(context, {
    content: "Reviewer correction: the Claude Code connector must store package-manager corrections and cite patch evidence.",
    previousWrongAction: "pnpm test",
    correctAction: "npm test",
    kind: "review_correction",
    evidenceIds: action ? [action.id] : []
  });
  const trail = hook.finishPatch(context, {
    task: "fix demo validation",
    filesChanged: ["src/validation/userValidation.ts"],
    commandsRun: ["npm test"],
    memoryIds: [action?.id, correction?.id].filter((id): id is string => Boolean(id))
  });
  const checks = {
    sessionStartContext: Boolean(session.codingContextPack?.sections.some((section) => section.evidence.length > 0) && session.memoryContext.includes("npm test")),
    preToolProcedureRecall: preTool.procedures.some((result) => result.memory.content.includes("Before tool calls")),
    actionGuardWarns: preTool.guard?.severity === "warn" && preTool.guard.alternatives.includes("npm test"),
    postToolOutcomeMemory: Boolean(action?.tags.includes("harness-action") && action.tags.includes("success-pattern")),
    userCorrectionCaptured: Boolean(correction?.tags.includes("engineering-correction") && correction.tags.includes("engineering:review_correction")),
    patchEvidenceTrail: Boolean(trail && action && correction && trail.toolOutcomeIds.includes(action.id) && trail.correctionIds.includes(correction.id))
  };
  return {
    harness: "claude",
    repo,
    checks,
    codingContextPackId: session.codingContextPack?.id,
    patchEvidenceTrailId: trail?.id,
    passed: Object.values(checks).every(Boolean)
  };
}

function installConnector(service: MemoryService, id: string, name: string, kind: "code" | "chat", baseUrl: string): void {
  service.registerConnectorManifest({
    id,
    name,
    kind,
    version: "1.0.0",
    direction: "two_way",
    capabilities: ["ingest", "webhook", "poll", "writeback"],
    auth: "oauth",
    defaultSourceKind: kind === "code" ? "reviewed_code" : "transcript",
    metadataMapping: { externalId: "externalId", channel: "metadata.channel", repo: "metadata.repo" },
    privacyPolicy: "project",
    oauth: { authorizeUrl: `${baseUrl}/oauth/authorize`, tokenUrl: `${baseUrl}/oauth/token`, clientIdRef: `secret://${id}/client-id`, scopes: kind === "code" ? ["repo:read", "pull_requests:read"] : ["messages.read", "messages.write"] },
    list: { endpoint: `${baseUrl}/list`, method: "POST" },
    poll: { endpoint: `${baseUrl}/poll`, method: "POST" },
    writeback: { endpoint: `${baseUrl}/write/{externalId}`, method: "POST", operations: ["comment", "summary", "memory_link"] }
  });
}

function verifyHarnessPackages(): { passed: boolean; harnesses: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-"));
  try {
    const result = spawnSync(process.execPath, [join(process.cwd(), "bin", "cognibrain.mjs"), "setup", "--all-harnesses", "--no-start", "--no-doctor", "--no-skill"], { cwd: dir, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
    if (result.status !== 0) return { passed: false, harnesses: [] };
    const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8")) as { harnesses?: Record<string, unknown> };
    const harnesses = Object.keys(manifest.harnesses ?? {});
    return { passed: ["codex", "claude", "copilot", "cursor", "vscode"].every((name) => harnesses.includes(name)), harnesses };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function cliOptions(argv: string[]): { out?: string } {
  const index = argv.indexOf("--out");
  return { out: index >= 0 ? argv[index + 1] : "artifacts/connectors-live.json" };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runConnectorLiveVerification(cliOptions(process.argv.slice(2)).out)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.passed) process.exit(1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
