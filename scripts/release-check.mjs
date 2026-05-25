#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const artifactPath = join(root, "artifacts", "release-check.json");
const steps = [
  ["unit tests", "npm", ["run", "test"]],
  ["dashboard build", "npm", ["run", "build"]],
  ["status verifier", "npm", ["run", "verify:status"]],
  ["CogniCodeBench", "npm", ["run", "benchmark:cognicode"]],
  ["Benchmark Arena", "npm", ["run", "benchmark:arena"]],
  ["first-win demo", "npm", ["run", "demo:plan1_5"]],
  ["plan1_3 audit", "npm", ["run", "audit:plan1_3"]],
  ["plan1_4 audit", "npm", ["run", "audit:plan1_4"]],
  ["plan1_5 audit", "npm", ["run", "audit:plan1_5"]],
  ["Postgres verifier", "npm", ["run", "verify:postgres"]],
  ["connector compatibility", "npm", ["run", "verify:compatibility"]],
  ["local runtime start", process.execPath, ["bin/cognibrain.mjs", "start"]],
  ["publish doctor", "npm", ["run", "doctor:publish"]],
  ["npm pack dry-run", "npm", ["pack", "--dry-run"]],
  ["Python SDK tests", "python3", ["-m", "unittest", "discover", "-s", "sdk/python/tests"]]
];

const results = [];
for (const [name, command, args] of steps) {
  const startedAt = new Date();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
  const finishedAt = new Date();
  const entry = {
    name,
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    ok: result.status === 0,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    error: result.error?.message
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
    entry.stderrTail ? `stderr tail:\n${entry.stderrTail}` : "",
    entry.stdoutTail ? `stdout tail:\n${entry.stdoutTail}` : ""
  ].filter(Boolean).join("\n");
}
