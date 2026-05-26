#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(root, "bin", "cognibrain.mjs");
const outDir = join(root, "artifacts", "demos");
const mode = process.argv[2] ?? "--all";

if (!existsSync(cli)) throw new Error(`Missing CLI at ${cli}`);
mkdirSync(outDir, { recursive: true });

try {
  const reports = {};
  if (mode === "--all" || mode === "--why-used") reports.whyUsed = runWhyUsedDemo();
  if (mode === "--all" || mode === "--cognicode") reports.cogniCodeBench = runCogniCodeDemoReplay();
  if (mode === "--all" || mode === "--github-review") reports.githubReview = runGitHubReviewDemo();
  if (mode === "--all") {
    const summary = {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      passed: Object.values(reports).every((report) => report.passed),
      reports
    };
    writeJson("proof-demos.json", summary);
  }
  const failed = Object.values(reports).filter((report) => !report.passed);
  if (failed.length) {
    console.error(`proof demo failed: ${failed.map((report) => report.id).join(", ")}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ passed: true, generated: Object.keys(reports) }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function runWhyUsedDemo() {
  const { dir, env } = demoEnv("why-used-demo", { MEMORY_PROJECT_ID: "atlas-api", MEMORY_REPO: "atlas-api", MEMORY_BRANCH: "main" });
  try {
    const wrong = memory(["action", "pnpm test"], {
      ...env,
      MEMORY_EXIT_CODE: "1",
      MEMORY_FAILURE_REASON: "CI uses npm test, not pnpm.",
      MEMORY_FILES_TOUCHED: "src/generated/api.generated.ts",
      MEMORY_OUTPUT_SUMMARY: "pnpm unsupported; generated file touched"
    });
    const correction = memory(["code-correction", "Do not use pnpm in this repo; use npm test and do not edit generated files."], {
      ...env,
      MEMORY_PREVIOUS_MEMORY_ID: wrong.id,
      MEMORY_PREVIOUS_WRONG_ACTION: "pnpm test",
      MEMORY_CORRECT_ACTION: "npm test",
      MEMORY_ENGINEERING_KIND: "repo_policy",
      MEMORY_FILE_PATTERN: "**/*.generated.ts"
    });
    const memoryIds = [wrong.id, correction.id, ...(correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [])];
    const evidence = memory(["why-used", "Why should Atlas use npm test and avoid generated files?"], env);
    const guard = memory(["action-guard", "pnpm test"], env);
    const trail = memory(["patch-evidence", "release validation"], {
      ...env,
      MEMORY_MEMORY_IDS: memoryIds.join(","),
      MEMORY_COMMANDS_RUN: "npm test",
      MEMORY_FILES_CHANGED: "src/validation/inviteValidation.ts"
    });
    const report = {
      schemaVersion: "1.0",
      id: "why-used-demo",
      generatedAt: new Date().toISOString(),
      passed: Boolean(
        evidence.results?.length &&
        guard.severity !== "allow" &&
        trail.correctionIds?.includes(correction.id) &&
        trail.forbiddenActionsAvoided?.some((item) => item.forbiddenAction?.includes("pnpm") || item.content.includes("pnpm")) &&
        trail.proceduresRecalled?.some((item) => item.command === "npm test" || item.content.includes("npm test")) &&
        !trail.summary?.commandsRun?.includes("pnpm test")
      ),
      steps: {
        wrongActionId: wrong.id,
        correctionId: correction.id,
        derivedMemoryIds: correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [],
        evidencePackId: evidence.id,
        actionGuardSeverity: guard.severity,
        patchEvidenceTrailId: trail.id
      },
      evidence,
      guard,
      trail
    };
    writeJson("why-used.json", report);
    return report;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCogniCodeDemoReplay() {
  const fixture = json("fixtures/cognicodebench/demo-repos.json");
  const replays = fixture.demos.map((demo) => {
    const { dir, env } = demoEnv(`cognicode-${demo.id}`, {
      MEMORY_PROJECT_ID: demo.id,
      MEMORY_REPO: demo.id,
      MEMORY_BRANCH: demo.id === "legacy-app" ? "legacy" : "main"
    });
    try {
      const wrong = memory(["action", demo.wrongAction], {
        ...env,
        MEMORY_EXIT_CODE: "1",
        MEMORY_FAILURE_REASON: demo.correction,
        MEMORY_FILES_TOUCHED: inferredTouchedFile(demo)
      });
      const correction = memory(["code-correction", demo.correction], {
        ...env,
        MEMORY_PREVIOUS_MEMORY_ID: wrong.id,
        MEMORY_PREVIOUS_WRONG_ACTION: demo.wrongAction,
        MEMORY_CORRECT_ACTION: demo.expectedNextAction,
        MEMORY_ENGINEERING_KIND: inferredKind(demo)
      });
      const memoryIds = [wrong.id, correction.id, ...(correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [])];
      const context = memory(["coding-context", demo.nextTask], env);
      const guard = memory(["action-guard", demo.wrongAction], env);
      const trail = memory(["patch-evidence", demo.nextTask], {
        ...env,
        MEMORY_MEMORY_IDS: memoryIds.join(","),
        MEMORY_COMMANDS_RUN: demo.expectedNextAction,
        MEMORY_FILES_CHANGED: inferredChangedFile(demo)
      });
      return {
        id: demo.id,
        repoType: demo.repoType,
        beforeTask: demo.beforeTask,
        nextTask: demo.nextTask,
        passed: Boolean(
          context.sections?.some((section) => section.evidence?.some((item) => item.memoryId === correction.id || item.content.includes(demo.correction.slice(0, 24)))) &&
          trail.memoryIds?.includes(correction.id) &&
          trail.proceduresRecalled?.some((item) => item.content.includes(demo.expectedNextAction) || item.command === demo.expectedNextAction)
        ),
        wrongActionId: wrong.id,
        correctionId: correction.id,
        derivedMemoryIds: correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [],
        contextPackId: context.id,
        actionGuardSeverity: guard.severity,
        patchEvidenceTrailId: trail.id,
        expectedNextAction: demo.expectedNextAction
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  const report = {
    schemaVersion: "1.0",
    id: "cognicodebench-demo-replay",
    generatedAt: new Date().toISOString(),
    scenarioCount: replays.length,
    passed: replays.length === 5 && replays.every((replay) => replay.passed),
    replays
  };
  writeJson("cognicodebench-demo-replay.json", report);
  return report;
}

function runGitHubReviewDemo() {
  const fixture = json("fixtures/connectors/github-review-demo.json");
  const demo = fixture.demo;
  const { dir, env } = demoEnv("github-review-demo", { MEMORY_PROJECT_ID: "atlas", MEMORY_REPO: "atlas", MEMORY_BRANCH: "main" });
  try {
    const sync = memory(["connector-sync", fixture.connectorId, demo.reviewComment.body], {
      ...env,
      MEMORY_EXTERNAL_ID: "discussion_r1",
      MEMORY_SOURCE_URI: demo.reviewComment.url,
      MEMORY_METADATA_JSON: JSON.stringify({
        repo: "example/atlas",
        pullRequest: 42,
        author: demo.reviewComment.author,
        url: demo.reviewComment.url
      })
    });
    const syncedIds = sync.memoryIds ?? [];
    const syncedMemories = syncedIds.map((id) => memory(["inspect", id], env));
    const correction = memory(["code-correction", demo.memory.content], {
      ...env,
      MEMORY_ENGINEERING_KIND: demo.memory.kind,
      MEMORY_CORRECT_ACTION: "npm test",
      MEMORY_PREVIOUS_WRONG_ACTION: "pnpm test",
      MEMORY_EVIDENCE_IDS: syncedIds.join(",")
    });
    const memoryIds = [...syncedIds, correction.id, ...(correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [])];
    const evidence = memory(["why-used", "Which PR review correction applies before running tests?"], env);
    const trail = memory(["patch-evidence", "apply PR review feedback"], {
      ...env,
      MEMORY_MEMORY_IDS: memoryIds.join(","),
      MEMORY_COMMANDS_RUN: demo.nextPatchEvidence.commandsRun.join(","),
      MEMORY_FILES_CHANGED: "src/validation/inviteValidation.ts"
    });
    const serialized = JSON.stringify({ syncedMemories, evidence, trail });
    const report = {
      schemaVersion: "1.0",
      id: "github-review-demo",
      generatedAt: new Date().toISOString(),
      connectorId: fixture.connectorId,
      passed: Boolean(
        fixture.connectorId === "official-github" &&
        syncedIds.length &&
        serialized.includes(demo.reviewComment.url) &&
        trail.correctionIds?.includes(correction.id) &&
        trail.summary?.commandsRun?.includes("npm test")
      ),
      pullRequest: demo.pullRequest,
      reviewCommentUrl: demo.reviewComment.url,
      syncRecordId: sync.id,
      syncedMemoryIds: syncedIds,
      correctionId: correction.id,
      evidencePackId: evidence.id,
      patchEvidenceTrailId: trail.id,
      sourceRefs: syncedMemories.map((memory) => memory.provenance?.sourceRef).filter(Boolean),
      trail
    };
    writeJson("github-review.json", report);
    return report;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function demoEnv(name, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), "cognibrain-demo-"));
  return {
    dir,
    env: {
      ...process.env,
      MEMORY_DB_PATH: join(dir, `${name}.json`),
      MEMORY_USER_ID: name,
      MEMORY_AGENT_ID: "codex",
      MEMORY_AUTO_DREAM: "false",
      ...extra
    }
  };
}

function memory(args, env) {
  return JSON.parse(execFileSync(process.execPath, [cli, "memory", ...args], { cwd: root, env, encoding: "utf8" }));
}

function json(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function writeJson(name, payload) {
  writeFileSync(join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function inferredKind(demo) {
  if (/review/i.test(demo.correction)) return "review_correction";
  if (/generated|lockfile|not edit/i.test(demo.correction)) return "generated_file_rule";
  if (/pytest|npm test|package-local/i.test(demo.expectedNextAction)) return "test_strategy";
  if (/legacy|migration/i.test(demo.correction)) return "migration_note";
  return "repo_policy";
}

function inferredTouchedFile(demo) {
  if (/React/i.test(demo.repoType)) return "src/routes/generated.ts";
  if (/Python/i.test(demo.repoType)) return "package.json";
  if (/Monorepo/i.test(demo.repoType)) return "pnpm-lock.yaml";
  if (/Legacy/i.test(demo.repoType)) return "services/export.ts";
  return "src/generated/api.generated.ts";
}

function inferredChangedFile(demo) {
  if (/React/i.test(demo.repoType)) return "src/components/settings/BillingSettings.tsx";
  if (/Python/i.test(demo.repoType)) return "app/routes/readiness.py";
  if (/Monorepo/i.test(demo.repoType)) return "packages/payments/src/refunds.ts";
  if (/Legacy/i.test(demo.repoType)) return "lib/exports/invoice.ts";
  return "src/validation/inviteValidation.ts";
}
