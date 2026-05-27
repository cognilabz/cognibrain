#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const system = optionValue("--system") ?? process.env.COGNIBRAIN_OPERATOR_MEMORY_COMPETITOR_SYSTEM;
const python = process.env.MEMORY_OPERATOR_MEMORY_COMPETITOR_PYTHON
  ?? process.env.MEMORY_ARENA_COMPETITOR_PYTHON
  ?? join(root, ".cognibrain", "native-runners", "competitors-venv", "bin", "python");
const script = join(root, "scripts", "benchmark", "competitors", "operator_memory_native_runner.py");
const started = Date.now();
const stdin = await readStdin();

if (!system) {
  printBlocked("unknown", "missing --system argument");
  process.exit(0);
}

if (!existsSync(python) || !existsSync(script)) {
  printBlocked(system, "operator-memory native Python runner is not installed; run npm run internal -- benchmark:competitors:native first");
  process.exit(0);
}

const result = spawnSync(python, [script, "--system", system], {
  cwd: root,
  input: stdin,
  encoding: "utf8",
  env: {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    MEM0_TELEMETRY: process.env.MEM0_TELEMETRY ?? "false",
    COGNIBRAIN_NATIVE_RUNNER_ROOT: process.env.COGNIBRAIN_NATIVE_RUNNER_ROOT ?? join(root, ".cognibrain", "native-runners")
  },
  timeout: Number(process.env.MEMORY_OPERATOR_MEMORY_PYTHON_RUNNER_TIMEOUT_MS ?? 120_000),
  maxBuffer: 20 * 1024 * 1024
});

if (result.status === 0 && result.stdout.trim()) {
  process.stdout.write(result.stdout.trim());
  process.stdout.write("\n");
  process.exit(0);
}

console.log(JSON.stringify({
  proofLevel: "credential-blocked",
  adapterMode: "blocked-command",
  checks: emptyChecks(),
  capabilityGaps: [`${system} operator-memory native runner failed before producing JSON`],
  latencyMs: Date.now() - started,
  evidence: {
    runner: "operator-memory-native-python-runner",
    system,
    status: result.status ?? 1,
    stderrTail: tail(result.stderr),
    stdoutTail: tail(result.stdout),
    error: result.error?.message
  }
}));

function printBlocked(blockedSystem, reason) {
  console.log(JSON.stringify({
    proofLevel: "credential-blocked",
    adapterMode: "blocked-command",
    checks: emptyChecks(),
    capabilityGaps: [reason],
    latencyMs: Date.now() - started,
    evidence: {
      runner: "operator-memory-native-python-runner",
      system: blockedSystem,
      blocked: true,
      reason
    }
  }));
}

function emptyChecks() {
  return {
    currentTruthSelected: false,
    staleTruthSuppressed: false,
    sourceRefRevalidated: false,
    connectorRefreshAccounted: false,
    beliefRevisionApplied: false,
    failureContained: false
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
