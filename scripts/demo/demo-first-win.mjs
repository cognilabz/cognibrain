#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const cli = join(root, "bin", "cognibrain.mjs");
const outDir = join(root, "artifacts", "demos");

if (!existsSync(cli)) throw new Error(`Missing CLI at ${cli}`);
mkdirSync(outDir, { recursive: true });

try {
  const report = runFirstWinDemo();
  writeJson("first-win.json", report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function runFirstWinDemo() {
  const dir = mkdtempSync(join(tmpdir(), "cognibrain-first-win-"));
  const env = {
    ...process.env,
    MEMORY_DB_PATH: join(dir, "memory.json"),
    MEMORY_USER_ID: "first-win-user",
    MEMORY_AGENT_ID: "codex",
    MEMORY_PROJECT_ID: "atlas-api",
    MEMORY_REPO: "atlas-api",
    MEMORY_BRANCH: "main",
    MEMORY_AUTO_DREAM: "false",
    MEMORY_GITHUB_REPO: "cognilabz/cognibrain",
    MEMORY_GITHUB_TOKEN: "demo-token-not-saved"
  };
  try {
    const init = command(dir, env, ["init", "--profile", "solo-dev", "--yes", "--no-start", "--no-doctor", "--no-skill", "--no-demo"]);
    const connector = command(dir, env, ["connector", "add", "github"]);
    const doctor = command(dir, env, ["doctor", "--fix", "--no-start", "--no-skill"]);
    const wrongAction = memory(dir, env, ["action", "pnpm test"], {
      MEMORY_EXIT_CODE: "1",
      MEMORY_FAILURE_REASON: "Repo uses npm scripts; pnpm is not installed in CI.",
      MEMORY_FILES_TOUCHED: "src/generated/api.generated.ts",
      MEMORY_OUTPUT_SUMMARY: "pnpm failed and generated output was edited"
    });
    const correction = memory(dir, env, ["code-correction", "Do not use pnpm or edit generated API files in atlas-api; use npm test and change source files instead."], {
      MEMORY_PREVIOUS_MEMORY_ID: wrongAction.id,
      MEMORY_PREVIOUS_WRONG_ACTION: "pnpm test",
      MEMORY_CORRECT_ACTION: "npm test",
      MEMORY_ENGINEERING_KIND: "repo_policy",
      MEMORY_FILE_PATTERN: "**/*.generated.ts"
    });
    const memoryIds = [wrongAction.id, correction.id, ...(correction.metadata?.correctionPipeline?.derivedMemoryIds ?? [])];
    const context = memory(dir, env, ["coding-context", "Fix the atlas-api validation bug after pnpm test failed and choose the right npm test command."]);
    const guard = memory(dir, env, ["action-guard", "pnpm test"], {}, { allowFailure: true });
    const trail = memory(dir, env, ["patch-evidence", "fix atlas-api validation bug"], {
      MEMORY_MEMORY_IDS: memoryIds.join(","),
      MEMORY_COMMANDS_RUN: "npm test",
      MEMORY_FILES_CHANGED: "src/validation/inviteValidation.ts"
    });
    const setupState = jsonFile(join(dir, ".cognibrain", "setup-state.json"));
    const connectorState = jsonFile(join(dir, ".cognibrain", "connectors", "github.json"));
    const serializedState = JSON.stringify({ setupState, connectorState, wrongAction, correction, context, guard, trail });
    const contextData = context.data ?? context;
    const contextHasActionEvidence = contextData.sections?.some((section) => JSON.stringify(section).includes("npm test")) ||
      contextData.excludedStaleRules?.some((rule) => ["repo_policy", "forbidden_action", "procedure"].includes(rule.kind));
    const guardSeverity = guard.severity ?? guard.data?.severity;
    const trailData = trail.data ?? trail;
    const report = {
      schemaVersion: "1.0",
      id: "first-win-demo",
      generatedAt: new Date().toISOString(),
      mode: "guided_self_hosted",
      passed: Boolean(
        setupState.profile === "solo-dev" &&
        connectorState.configured === true &&
        connectorState.requiredEnv.every((item) => item.valueRef?.startsWith("env:")) &&
        !serializedState.includes("demo-token-not-saved") &&
        contextHasActionEvidence &&
        guardSeverity !== "allow" &&
        trailData.summary?.commandsRun?.includes("npm test") &&
        trailData.correctionIds?.includes(correction.id)
      ),
      install: {
        profile: setupState.profile,
        harnesses: setupState.harnesses,
        connectorId: connectorState.connectorId,
        initOutput: init.split("\n").filter(Boolean).slice(0, 5),
        connectorOutput: connector.split("\n").filter(Boolean).slice(0, 5),
        doctorOutput: doctor.split("\n").filter(Boolean).slice(0, 8)
      },
      firstWin: {
        wrongActionId: wrongAction.id,
        correctionId: correction.id,
        contextPackId: contextData.id ?? context.id,
        contextInjectedSections: contextData.sections?.length ?? 0,
        contextSuppressedEvidence: contextData.excludedStaleRules?.length ?? 0,
        actionGuardSeverity: guardSeverity,
        patchEvidenceTrailId: trailData.id ?? trail.id
      }
    };
    return report;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function command(cwd, env, args) {
  return execFileSync(process.execPath, [cli, "--runtime-root", cwd, ...args], { cwd, env, encoding: "utf8" });
}

function memory(cwd, env, args, extraEnv = {}, options = {}) {
  if (!options.allowFailure) return JSON.parse(command(cwd, { ...env, ...extraEnv }, ["memory", ...args]));
  const result = spawnSync(process.execPath, [cli, "--runtime-root", cwd, "memory", ...args], {
    cwd,
    env: { ...env, ...extraEnv },
    encoding: "utf8"
  });
  if (result.status === 0 || result.stdout) return JSON.parse(result.stdout);
  throw new Error(result.stderr || `Command failed with status ${result.status}`);
}

function jsonFile(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(name, payload) {
  writeFileSync(join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`);
}
