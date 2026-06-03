#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url).pathname;
const [taskName, ...passthrough] = process.argv.slice(2);

const tasks = {
  "test": cmd("npm", ["test"]),
  "build": cmd("npm", ["run", "build"]),
  "eval": cmd("npx", ["tsx", "src/eval/run.ts"]),
  "eval:nextgen": cmd("npx", ["tsx", "src/eval/nextgen.ts", "--out", "artifacts/nextgen-eval.json"]),
  "benchmark:locomo": cmd("npx", ["tsx", "src/eval/locomo.ts"]),
  "benchmark:longmemeval": cmd("npx", ["tsx", "src/eval/longmemeval.ts"]),
  "benchmark:beam": cmd("npx", ["tsx", "src/eval/beam.ts"]),
  "benchmark:external:hard": cmd("npx", ["tsx", "src/eval/externalHard.ts", "--out", "artifacts/external-hard-summary.json", "--markdown", "artifacts/docs/external-hard.md"]),
  "benchmark:external:basic-memory": cmd(".cognibrain/native-runners/competitors-venv/bin/python", ["scripts/benchmark/competitors/basic_memory_external_runner.py", "--out", "artifacts/external-basic-memory.json", "--markdown", "artifacts/docs/external-basic-memory.md"]),
  "benchmark:original:public": cmd("node", ["scripts/benchmark/benchmark-original-public.mjs"]),
  "benchmark:realworld:protocol": cmd("node", ["scripts/benchmark/benchmark-realworld-protocol.mjs"]),
  "benchmark:realworld:blackbox": cmd("npx", ["tsx", "src/eval/realworldBlackbox.ts", "--out", "artifacts/realworld-blackbox.json", "--markdown", "artifacts/docs/realworld-blackbox.md"]),
  "benchmark:realworld:basicmemory": cmd("npx", ["tsx", "src/eval/realworldBlackbox.ts", "--out", "artifacts/realworld-blackbox-openai-intelligence.json", "--markdown", "artifacts/docs/realworld-blackbox-openai-intelligence.md", "--success-out", "artifacts/realworld-blackbox-openai-intelligence-success.json", "--success-markdown", "artifacts/docs/realworld-blackbox-openai-intelligence-success.md", "--systems", "cognibrain,basicmemory,keyword"]),
  "benchmark:realworld:competitors": cmd("node", ["scripts/benchmark/benchmark-realworld-native-competitors.mjs"]),
  "benchmark:realworld:openai-judge": cmd("node", ["scripts/benchmark/realworld-openai-judge.mjs"]),
  "benchmark:realworld:openai-intelligence": cmd("node", ["scripts/benchmark/openai-memory-intelligence.mjs"]),
  "benchmark:nextgen": cmd("npx", ["tsx", "src/eval/nextgenBenchmarks.ts", "--out", "artifacts/nextgen-benchmarks.json"]),
  "benchmark:cognicode:generate": cmd("npx", ["tsx", "src/eval/cognicodeBench.ts", "--generate-only", "--count", "1000", "--difficulty", "hard", "--noise-ratio", "0.5", "--sessions", "12", "--repos", "100", "--stale-ratio", "0.25", "--connector-mix", "github,jira,confluence,notion,slack", "--scenarios-out", "artifacts/cognicodebench/scenarios.json", "--out", "artifacts/cognicodebench/generate-report.json"]),
  "benchmark:cognicode": cmd("npx", ["tsx", "src/eval/cognicodeBench.ts", "--count", "1000", "--difficulty", "hard", "--noise-ratio", "0.5", "--sessions", "12", "--repos", "100", "--stale-ratio", "0.25", "--connector-mix", "github,jira,confluence,notion,slack", "--scenarios-out", "artifacts/cognicodebench/scenarios.json", "--out", "artifacts/cognicodebench/run.json"]),
  "benchmark:arena": cmd("node", ["scripts/benchmark/benchmark-hard-arena.mjs"]),
  "benchmark:arena:run": cmd("npx", ["tsx", "src/eval/arena.ts", "--systems", "cognibrain,mem0,graphiti,cognee,langmem,gbrain,basicmemory", "--benchmark", "cognicode", "--out", "artifacts/arena/run.json"]),
  "benchmark:arena:publish": cmd("npx", ["tsx", "src/eval/publishArena.ts", "--input", "artifacts/arena/run.json", "--out", "artifacts/public/benchmark-arena", "--markdown", "artifacts/docs/latest-arena.md"]),
  "benchmark:competitors:native": cmd("node", ["scripts/benchmark/benchmark-native-competitors.mjs"]),
  "benchmark:beam:500k": cmd("npx", ["tsx", "src/eval/beam.ts", "--split", "500K", "--top-k", "20", "--out", "artifacts/beam-500k-report.json"]),
  "benchmark:beam:1m": cmd("npx", ["tsx", "src/eval/beam.ts", "--split", "1M", "--top-k", "20", "--out", "artifacts/beam-1m-report.json"]),
  "benchmark:market": cmd("npx", ["tsx", "src/eval/marketGate.ts"]),
  "benchmark:answer-generation": cmd("npx", ["tsx", "src/eval/answerGeneration.ts", "--out", "artifacts/answer-generation.json"]),
  "benchmark:load": cmd("npx", ["tsx", "src/eval/load.ts", "--out", "artifacts/load-benchmark.json"]),
  "benchmark:hardening": cmd("npx", ["tsx", "src/eval/benchmarkHardening.ts", "--out", "artifacts/benchmark-hardening.json", "--markdown", "artifacts/docs/benchmark-hardening.md"]),
  "benchmark:release": cmd("npx", ["tsx", "src/eval/benchmarkRelease.ts", "--out", "artifacts/public/cognicodebench-release.json", "--markdown", "artifacts/docs/cognicodebench-release.md"]),
  "benchmark:svg": cmd("node", ["scripts/release/render-benchmark-svg.mjs"]),
  "benchmark:operator-memory": cmd("npx", ["tsx", "src/eval/operatorMemoryBenchmark.ts", "--out", "artifacts/operator-memory-benchmark.json", "--markdown", "artifacts/docs/operator-memory-benchmark.md"]),
  "benchmark:operator-memory:native": cmd("node", ["scripts/benchmark/operator-memory-native-competitors.mjs", "--out", "artifacts/operator-memory-native-competitors.json", "--markdown", "artifacts/docs/operator-memory-native-competitors.md"]),
  "benchmark:certified": cmd("npx", ["tsx", "src/eval/certified.ts"]),
  "demo:first-win": cmd("node", ["scripts/demo/demo-first-win.mjs"]),
  "demo:why-used": cmd("node", ["scripts/demo/demo-proof.mjs", "--why-used"]),
  "demo:cognicodebench": cmd("node", ["scripts/demo/demo-proof.mjs", "--cognicode"]),
  "demo:github-review": cmd("node", ["scripts/demo/demo-proof.mjs", "--github-review"]),
  "demo:proof": cmd("node", ["scripts/demo/demo-proof.mjs"]),
  "leaderboard": cmd("npx", ["tsx", "src/eval/leaderboard.ts", "--out", "artifacts/leaderboard.json"]),
  "leaderboard:publish": seq("leaderboard", ["npx", "tsx", "src/eval/publishLeaderboard.ts", "--input", "artifacts/leaderboard.json", "--out", "artifacts/public/leaderboard"], "benchmark:arena:publish"),
  "verify:postgres": cmd("npx", ["tsx", "src/eval/postgresLive.ts", "--out", "artifacts/postgres-live.json"]),
  "verify:connectors": cmd("npx", ["tsx", "src/eval/connectorsLive.ts", "--out", "artifacts/connectors-live.json"]),
  "verify:vendor-connectors": cmd("npx", ["tsx", "src/eval/vendorConnectorsLive.ts", "--out", "artifacts/vendor-connectors-live.json"]),
  "verify:vendor-api-specs": cmd("npx", ["tsx", "src/eval/vendorApiSpecs.ts", "--input", "artifacts/vendor-connectors-live.json", "--out", "artifacts/vendor-api-specs.json"]),
  "verify:vendor-live": cmd("npx", ["tsx", "src/eval/vendorCredentialSmoke.ts", "--out", "artifacts/vendor-live-smoke.json"]),
  "connectors:webhooks": cmd("npx", ["tsx", "src/eval/connectorWebhooks.ts", "--out", "artifacts/connector-webhooks.json"]),
  "connectors:transport": cmd("npx", ["tsx", "src/eval/connectorTransportProof.ts", "--out", "artifacts/connector-transport.json"]),
  "connectors:quality": cmd("npx", ["tsx", "src/eval/connectorQuality.ts", "--out", "artifacts/connector-quality.json", "--markdown", "artifacts/docs/connector-quality.md"]),
  "connectors:certification": cmd("npx", ["tsx", "src/eval/connectorCertification.ts", "--out", "artifacts/connector-certification.json", "--markdown", "artifacts/docs/connector-certification.md"]),
  "connectors:maturity": cmd("npx", ["tsx", "src/eval/connectorMaturity.ts", "--out", "artifacts/connector-maturity.json", "--markdown", "artifacts/docs/connector-maturity.md"]),
  "harness:maturity": cmd("npx", ["tsx", "src/eval/harnessMaturity.ts", "--out", "artifacts/harness-maturity.json", "--markdown", "artifacts/docs/harness-maturity.md"]),
  "operator:maturity": cmd("npx", ["tsx", "src/eval/operatorOsMaturity.ts", "--out", "artifacts/operator-os-maturity.json", "--markdown", "artifacts/docs/operator-os.md"]),
  "verify:compatibility": seq("verify:connectors", "verify:vendor-connectors", "verify:vendor-api-specs", "verify:vendor-live", "connectors:webhooks", "connectors:transport", "connectors:maturity", "connectors:quality", "connectors:certification", "connectors:maturity"),
  "verify:status": cmd("node", ["scripts/release/verify-status.mjs"]),
  "verify:selfhosted:claims": cmd("node", ["scripts/release/verify-selfhosted.mjs"]),
  "certify:production": cmd("node", ["scripts/release/certify-production.mjs"]),
  "audit:structure": cmd("node", ["scripts/release/audit-structure.mjs"]),
  "audit:docs": cmd("node", ["scripts/release/audit-docs.mjs"]),
  "audit:truth": cmd("node", ["scripts/release/audit-product-truth.mjs"]),
  "audit:plan-gaps": cmd("npx", ["tsx", "src/eval/planGaps.ts", "--out", "artifacts/plan-gaps-audit.json", "--markdown", "artifacts/docs/plan-gaps.md"]),
  "release:contract": cmd("npx", ["tsx", "src/eval/releaseContract.ts", "--out", "artifacts/release-contract-audit.json"]),
  "doctor:publish": cmd("node", ["bin/cognibrain.mjs", "doctor", "--publish"]),
  "verify:nextgen": seq("test", "eval", "eval:nextgen", "benchmark:nextgen", "benchmark:cognicode", "benchmark:arena", "benchmark:realworld:protocol", "benchmark:realworld:blackbox", "benchmark:release", "demo:first-win", ["node", "scripts/internal/run-task.mjs", "benchmark:answer-generation", "--reports", "artifacts/nextgen-benchmarks.json,artifacts/cognicodebench/run.json"], "leaderboard", "verify:compatibility", "harness:maturity", "operator:maturity", "benchmark:hardening", "verify:status", "audit:structure", "audit:docs", "release:contract", "audit:truth", "audit:plan-gaps", "build"),
  "verify:selfhosted": seq("verify:nextgen", "verify:postgres", "verify:selfhosted:claims", "doctor:publish", ["npm", "pack", "--dry-run"], ["python3", "-m", "unittest", "discover", "-s", "sdk/python/tests"])
};

if (!taskName || taskName === "help" || taskName === "--help") {
  printUsage(0);
}

const task = tasks[taskName];
if (!task) {
  console.error(`Unknown internal task: ${taskName}`);
  printUsage(1);
}

runTask(task, passthrough);

function cmd(command, args = []) {
  return { kind: "cmd", command, args };
}

function seq(...items) {
  return { kind: "seq", items };
}

function runTask(task, extraArgs = []) {
  if (typeof task === "string") return runTask(tasks[task], []);
  if (Array.isArray(task)) return runCommand(task[0], task.slice(1), []);
  if (task.kind === "seq") {
    for (const item of task.items) runTask(item, []);
    return;
  }
  runCommand(task.command, task.args, extraArgs);
}

function runCommand(command, args, extraArgs) {
  const result = spawnSync(command, [...args, ...extraArgs], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function printUsage(exitCode) {
  const names = Object.keys(tasks).sort().join("\n  ");
  console.log(`Usage: npm run internal -- <task> [args...]\n\nInternal tasks:\n  ${names}`);
  process.exit(exitCode);
}
