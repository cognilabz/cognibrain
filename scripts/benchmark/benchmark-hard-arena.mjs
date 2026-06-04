#!/usr/bin/env node
import { join } from "node:path";
import { runCommand } from "./streaming-command.mjs";

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

const arena = await runCommand("npx", arenaArgs, {
  cwd: root,
  env,
  timeout: Number(process.env.MEMORY_ARENA_HARD_TIMEOUT_MS ?? process.env.MEMORY_RELEASE_CHECK_ARENA_TIMEOUT_MS ?? 1_800_000),
  forwardOutput: true
});
if (arena.status !== 0) process.exit(arena.status ?? 1);

const publish = await runCommand("node", ["scripts/internal/run-task.mjs", "benchmark:arena:publish"], {
  cwd: root,
  env,
  timeout: 120_000,
  forwardOutput: true
});
if (publish.status !== 0) process.exit(publish.status ?? 1);
