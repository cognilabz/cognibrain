#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const extraArgs = process.argv.slice(2);
const arenaArgs = [
  "tsx",
  "src/eval/arena.ts",
  "--systems",
  "cognibrain,mem0,graphiti,zep,cognee,langmem,gbrain,basicmemory",
  "--benchmark",
  "cognicode",
  "--count",
  "300",
  "--difficulty",
  "hard",
  "--noise-ratio",
  "0.5",
  "--sessions",
  "12",
  "--repos",
  "100",
  "--stale-ratio",
  "0.25",
  "--connector-mix",
  "github,jira,confluence,notion,slack",
  "--out",
  "artifacts/arena/run.json",
  ...extraArgs
];

const env = {
  ...process.env,
  MEMORY_ARENA_AUTO_NATIVE: process.env.MEMORY_ARENA_AUTO_NATIVE ?? "false",
  MEMORY_ARENA_LANGMEM_COMMAND: process.env.MEMORY_ARENA_LANGMEM_COMMAND ?? `${process.execPath} ${join(root, "scripts", "benchmark", "competitors", "native-python-runner.mjs")} --system langmem`,
  MEMORY_ARENA_LANGMEM_PROOF_LEVEL: process.env.MEMORY_ARENA_LANGMEM_PROOF_LEVEL ?? "same-run-native",
  MEMORY_ARENA_RUNNER_TIMEOUT_MS: process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS ?? "60000",
  MEMORY_ARENA_PYTHON_RUNNER_TIMEOUT_MS: process.env.MEMORY_ARENA_PYTHON_RUNNER_TIMEOUT_MS ?? "60000"
};

const arena = spawnSync("npx", arenaArgs, {
  cwd: root,
  env,
  encoding: "utf8",
  timeout: Number(process.env.MEMORY_ARENA_HARD_TIMEOUT_MS ?? 900_000),
  maxBuffer: 60 * 1024 * 1024
});
process.stdout.write(arena.stdout ?? "");
process.stderr.write(arena.stderr ?? "");
if (arena.status !== 0) process.exit(arena.status ?? 1);

const publish = spawnSync("node", ["scripts/internal/run-task.mjs", "benchmark:arena:publish"], {
  cwd: root,
  env,
  encoding: "utf8",
  timeout: 120_000,
  maxBuffer: 20 * 1024 * 1024
});
process.stdout.write(publish.stdout ?? "");
process.stderr.write(publish.stderr ?? "");
if (publish.status !== 0) process.exit(publish.status ?? 1);
