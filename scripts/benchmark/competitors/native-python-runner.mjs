#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeRunnerRoot } from "../cache-root.mjs";
import { runCommand } from "../streaming-command.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const system = optionValue("--system") ?? process.env.COGNIBRAIN_COMPETITOR_SYSTEM;
const python = process.env.MEMORY_ARENA_COMPETITOR_PYTHON ?? join(nativeRunnerRoot("competitors-venv"), "bin", "python");
const script = join(root, "scripts", "benchmark", "competitors", "native_python_runner.py");
const started = Date.now();
const stdin = await readStdin();
const defaultTimeoutMs = Math.max(1_000, Number(process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS ?? 30_000) - 1_000);
const timeoutMs = Number(process.env.MEMORY_ARENA_PYTHON_RUNNER_TIMEOUT_MS ?? defaultTimeoutMs);

if (!system) {
  printBlocked("unknown", "missing --system argument");
  process.exit(0);
}

if (!existsSync(python) || !existsSync(script)) {
  printBlocked(system, `native Python runner is not installed; run npm run internal -- benchmark:competitors:native`);
  process.exit(0);
}

const result = await runCommand(python, [script, "--system", system], {
  cwd: root,
  input: stdin,
  env: {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    MEM0_TELEMETRY: process.env.MEM0_TELEMETRY ?? "false",
    COGNIBRAIN_NATIVE_RUNNER_ROOT: process.env.COGNIBRAIN_NATIVE_RUNNER_ROOT ?? nativeRunnerRoot()
  },
  timeout: timeoutMs,
  captureLimit: Number(process.env.MEMORY_ARENA_PYTHON_RUNNER_OUTPUT_LIMIT ?? 200_000)
});

if (result.status === 0 && result.stdout.trim() && !result.truncatedStdout) {
  process.stdout.write(result.stdout.trim());
  process.stdout.write("\n");
  process.exit(0);
}

console.log(JSON.stringify({
  proofLevel: "credential-blocked",
  adapterMode: "blocked-command",
  capabilityGaps: [result.truncatedStdout ? `${system} native runner stdout exceeded bounded output capture before producing trusted JSON` : `${system} native runner failed before producing JSON`],
  runnerContract: arenaRunnerContract(),
  latencyMs: Date.now() - started,
  evidence: {
    runner: "native-python-runner",
    system,
    timeoutMs,
    signal: result.signal,
    status: result.status ?? 1,
    truncatedStdout: result.truncatedStdout,
    truncatedStderr: result.truncatedStderr,
    stderrTail: tail(result.stderr),
    stdoutTail: tail(result.stdout),
    error: result.error
  }
}));

function printBlocked(blockedSystem, reason) {
  console.log(JSON.stringify({
    proofLevel: "credential-blocked",
    adapterMode: "blocked-command",
    capabilityGaps: [reason],
    runnerContract: arenaRunnerContract(),
    latencyMs: Date.now() - started,
    evidence: {
      runner: "native-python-runner",
      system: blockedSystem,
      blocked: true,
      reason
    }
  }));
}

function arenaRunnerContract() {
  return {
    rawEvidenceOnly: true,
    selfScoredChecksAllowed: false,
    scoreableChecksRequireJudge: true,
    judgeEnv: "MEMORY_ARENA_JUDGE_COMMAND",
    judgeProtocol: "cognibrain-arena-llm-harness-judge-v1"
  };
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function tail(value = "", limit = 2000) {
  return String(value ?? "").slice(-limit);
}

function readStdin() {
  return new Promise((resolveRead, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolveRead(text));
    process.stdin.on("error", reject);
  });
}
