#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCommand } from "../benchmark/streaming-command.mjs";

const root = new URL("../..", import.meta.url).pathname;
const artifactPath = join(root, "artifacts", "release-check.json");
const defaultStepTimeoutMs = envNumber("MEMORY_RELEASE_CHECK_STEP_TIMEOUT_MS", 15 * 60_000);
const stepTimeouts = new Map([
  ["unit tests", envNumber("MEMORY_RELEASE_CHECK_TEST_TIMEOUT_MS", 10 * 60_000)],
  ["dashboard build", envNumber("MEMORY_RELEASE_CHECK_BUILD_TIMEOUT_MS", 5 * 60_000)],
  ["CogniCodeBench", envNumber("MEMORY_RELEASE_CHECK_COGNICODE_TIMEOUT_MS", 5 * 60_000)],
  ["Benchmark Arena", envNumber("MEMORY_RELEASE_CHECK_ARENA_TIMEOUT_MS", 30 * 60_000)],
  ["Postgres verifier", envNumber("MEMORY_RELEASE_CHECK_POSTGRES_TIMEOUT_MS", 5 * 60_000)],
  ["npm pack dry-run", envNumber("MEMORY_RELEASE_CHECK_PACK_TIMEOUT_MS", 5 * 60_000)],
  ["npm pack smoke install", envNumber("MEMORY_RELEASE_CHECK_PACK_SMOKE_TIMEOUT_MS", 5 * 60_000)],
  ["Python SDK tests", envNumber("MEMORY_RELEASE_CHECK_PYTHON_TIMEOUT_MS", 5 * 60_000)]
]);
const steps = [
  ["unit tests", "npm", ["run", "test"]],
  ["dashboard build", "npm", ["run", "build"]],
  ["CogniCodeBench", "npm", ["run", "internal", "--", "benchmark:cognicode"]],
  ["Benchmark Arena", "npm", ["run", "internal", "--", "benchmark:arena"]],
  ["first-win demo", "npm", ["run", "internal", "--", "demo:first-win"]],
  ["release contract audit", "npm", ["run", "internal", "--", "release:contract"]],
  ["Postgres verifier", "npm", ["run", "internal", "--", "verify:postgres"]],
  ["connector compatibility", "npm", ["run", "internal", "--", "verify:compatibility"]],
  ["connector maturity", "npm", ["run", "internal", "--", "connectors:maturity"]],
  ["harness maturity", "npm", ["run", "internal", "--", "harness:maturity"]],
  ["operator maturity", "npm", ["run", "internal", "--", "operator:maturity"]],
  ["benchmark hardening", "npm", ["run", "internal", "--", "benchmark:hardening"]],
  ["benchmark release manifest", "npm", ["run", "internal", "--", "benchmark:release"]],
  ["public benchmark publish", "npm", ["run", "internal", "--", "leaderboard:publish"]],
  ["local runtime start", process.execPath, ["bin/cognibrain.mjs", "start"]],
  ["publish doctor", "npm", ["run", "internal", "--", "doctor:publish"]],
  ["npm pack dry-run", "npm", ["pack", "--dry-run"]],
  ["npm pack smoke install", "node", ["scripts/release/pack-smoke.mjs"]],
  ["Python SDK tests", "python3", ["-m", "unittest", "discover", "-s", "sdk/python/tests"]]
];

const results = [];
for (const [name, command, args] of steps) {
  const startedAt = new Date();
  const timeoutMs = stepTimeouts.get(name) ?? defaultStepTimeoutMs;
  const result = await runCommand(command, args, {
    cwd: root,
    env: process.env,
    timeout: timeoutMs,
    captureLimit: 20 * 1024 * 1024
  });
  const finishedAt = new Date();
  const entry = {
    name,
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    ok: result.status === 0 && !result.timedOut,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    timeoutMs,
    timedOut: result.timedOut,
    signal: result.signal,
    truncatedStdout: result.truncatedStdout,
    truncatedStderr: result.truncatedStderr,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    error: result.error
  };
  results.push(entry);
  writeReport(results);
  console.log(`${entry.ok ? "ok" : "FAIL"} ${name} (${entry.durationMs}ms)`);
  if (!entry.ok) {
    console.error(actionableFailure(entry));
    process.exit(entry.status || 1);
  }
}

console.log(`release check passed: ${results.length}/${steps.length} steps`);

function writeReport(items) {
  mkdirSync(join(root, "artifacts"), { recursive: true });
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    summary: {
      total: items.length,
      passed: items.filter((item) => item.ok).length,
      failed: items.filter((item) => !item.ok).length
    },
    steps: items
  };
  writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
}

function tail(value = "") {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(-40).join("\n");
}

function actionableFailure(entry) {
  return [
    `release:check failed at "${entry.name}".`,
    `Command: ${entry.command}`,
    `Artifact: artifacts/release-check.json`,
    entry.timedOut ? `Timed out after ${entry.timeoutMs}ms.` : "",
    entry.stderrTail ? `stderr tail:\n${entry.stderrTail}` : "",
    entry.stdoutTail ? `stdout tail:\n${entry.stdoutTail}` : ""
  ].filter(Boolean).join("\n");
}

function envNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
