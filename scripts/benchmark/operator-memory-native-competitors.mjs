#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { nativeRunnerRoot } from "./cache-root.mjs";
import { commandEntry, runCommand } from "./streaming-command.mjs";

const root = new URL("../..", import.meta.url).pathname;
const out = optionValue("--out") ?? "artifacts/operator-memory-native-competitors.json";
const markdown = optionValue("--markdown") ?? "artifacts/docs/operator-memory-native-competitors.md";
const pythonVenv = process.env.MEMORY_OPERATOR_MEMORY_COMPETITOR_VENV
  ?? process.env.MEMORY_ARENA_COMPETITOR_VENV
  ?? nativeRunnerRoot("competitors-venv");
const pythonBin = process.env.MEMORY_OPERATOR_MEMORY_COMPETITOR_PYTHON
  ?? process.env.MEMORY_ARENA_COMPETITOR_PYTHON
  ?? join(pythonVenv, "bin", "python");
const runner = join(root, "scripts", "benchmark", "competitors", "operator-memory-native-python-runner.mjs");
const skipInstall = process.argv.includes("--skip-install") || process.env.MEMORY_OPERATOR_MEMORY_SKIP_INSTALL === "true";

const installations = {
  pythonCompetitors: skipInstall ? skippedPythonCompetitors() : await ensurePythonCompetitors(),
  mem0: await pythonPackageStatus("mem0ai"),
  graphiti: await pythonPackageStatus("graphiti-core"),
  cognee: await pythonPackageStatus("cognee"),
  langmem: await pythonPackageStatus("langmem")
};

const env = {
  ...process.env,
  COGNIBRAIN_NATIVE_RUNNER_ROOT: process.env.COGNIBRAIN_NATIVE_RUNNER_ROOT ?? nativeRunnerRoot(),
  MEMORY_OPERATOR_MEMORY_COMPETITOR_PYTHON: pythonBin,
  MEMORY_OPERATOR_MEMORY_MEM0_COMMAND: `${process.execPath} ${runner} --system mem0`,
  MEMORY_OPERATOR_MEMORY_LANGMEM_COMMAND: `${process.execPath} ${runner} --system langmem`,
  MEMORY_OPERATOR_MEMORY_GRAPHITI_COMMAND: `${process.execPath} ${runner} --system graphiti`,
  MEMORY_OPERATOR_MEMORY_COGNEE_COMMAND: `${process.execPath} ${runner} --system cognee`,
  MEMORY_OPERATOR_MEMORY_RUNNER_TIMEOUT_MS: process.env.MEMORY_OPERATOR_MEMORY_RUNNER_TIMEOUT_MS ?? "120000",
  MEMORY_OPERATOR_MEMORY_PYTHON_RUNNER_TIMEOUT_MS: process.env.MEMORY_OPERATOR_MEMORY_PYTHON_RUNNER_TIMEOUT_MS ?? "120000"
};

if (!env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND && (process.env.MEMORY_OPENAI_API_KEY || process.env.OPENAI_API_KEY)) {
  env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND = `${process.execPath} ${join(root, "scripts", "benchmark", "operator-memory-openai-judge.mjs")}`;
}

const benchmark = await runCommand("npx", [
  "tsx",
  "src/eval/operatorMemoryBenchmark.ts",
  "--systems",
  "cognibrain-dream,retrieval-only,connector-import-only,reflect-only,recency-only,mem0-native,langmem-native,graphiti-native,cognee-native",
  "--out",
  "artifacts/operator-memory-benchmark.json",
  "--markdown",
  "artifacts/docs/operator-memory-benchmark.md"
], {
  cwd: root,
  env,
  timeout: Number(process.env.MEMORY_OPERATOR_MEMORY_NATIVE_TIMEOUT_MS ?? 600_000)
});

if (benchmark.status !== 0) {
  const report = writeReport({ installations, benchmark: commandEntry(benchmark), operatorMemory: null });
  console.error(benchmark.stderr || benchmark.stdout);
  console.log(JSON.stringify(report, null, 2));
  process.exit(benchmark.status ?? 1);
}

const report = writeReport({
  installations,
  benchmark: commandEntry(benchmark),
  operatorMemory: readJson("artifacts/operator-memory-benchmark.json", null)
});
console.log(JSON.stringify(report, null, 2));

async function ensurePythonCompetitors() {
  const uv = await runCommand("uv", ["--version"], {
    cwd: root,
    timeout: 30_000
  });
  if (uv.status !== 0) return { installed: false, blockedReason: "uv is required to install isolated Python competitor packages", uv: commandEntry(uv), venv: pythonVenv, install: null };

  const pythonCandidate = process.env.MEMORY_OPERATOR_MEMORY_PYTHON ?? process.env.MEMORY_ARENA_PYTHON ?? "/opt/homebrew/bin/python3.13";
  let create = { status: 0, stdout: "already exists", stderr: "" };
  if (!existsSync(pythonBin)) {
    mkdirSync(dirname(pythonVenv), { recursive: true });
    create = await runCommand("uv", ["venv", pythonVenv, "--python", pythonCandidate], {
      cwd: root,
      timeout: 180_000
    });
    if (create.status !== 0) return { installed: false, uv: commandEntry(uv), venv: pythonVenv, create: commandEntry(create), install: null };
  }

  const packages = [
    "mem0ai==2.0.2",
    "graphiti-core[kuzu]==0.29.1",
    "langmem==0.0.30",
    "cognee==1.1.0",
    "fastembed==0.7.3"
  ];
  const install = await runCommand("uv", ["pip", "install", "--python", pythonBin, ...packages], {
    cwd: root,
    timeout: 600_000
  });
  return {
    installed: install.status === 0 && existsSync(pythonBin),
    python: pythonBin,
    packages,
    uv: commandEntry(uv),
    create: commandEntry(create),
    install: commandEntry(install)
  };
}

function skippedPythonCompetitors() {
  return {
    installed: false,
    blockedReason: "native Python competitor installation skipped; command runners still emit credential-blocked raw-evidence contracts when the venv is unavailable",
    venv: pythonVenv,
    install: null
  };
}

function writeReport(details) {
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "operator-memory-native-competitor-run",
    installations: details.installations,
    benchmark: details.benchmark,
    systems: (details.operatorMemory?.systems ?? []).map((system) => ({
      system: system.system,
      displayName: system.displayName,
      proofLevel: system.proofLevel,
      adapterMode: system.adapterMode,
      score: system.score,
      metrics: system.metrics,
      scenarioCount: system.scenarios?.length ?? 0,
      runner: system.runner,
      runnerContract: system.runnerContract,
      capabilityGaps: system.capabilityGaps
    })),
    summary: details.operatorMemory?.summary ?? null,
    realCompetitorRuns: (details.operatorMemory?.systems ?? []).filter((system) => system.system !== "cognibrain-dream" && ["same-run-native", "same-run-cloud-api"].includes(system.proofLevel)).length,
    blocked: (details.operatorMemory?.systems ?? [])
      .filter((system) => system.system !== "cognibrain-dream" && system.proofLevel === "credential-blocked")
      .map((system) => ({ system: system.system, displayName: system.displayName, gaps: system.capabilityGaps }))
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  if (details.operatorMemory) {
    mkdirSync(dirname(markdown), { recursive: true });
    writeFileSync(markdown, renderSummary(report));
  }
  return report;
}

function renderSummary(report) {
  const rows = report.systems.map((system) => `| ${system.displayName} | ${points(system.score)} | ${system.proofLevel} | ${system.adapterMode} | ${points(system.metrics?.currentTruthAccuracy ?? 0)} | ${points(system.metrics?.staleSuppressionRate ?? 0)} | ${points(system.metrics?.sourceRevalidationRate ?? 0)} |`).join("\n");
  return `# Operator Memory Native Competitor Run

Generated at ${report.generatedAt}.

| System | Score | Proof | Adapter | Current truth | Stale suppression | Source revalidation |
| --- | ---: | --- | --- | ---: | ---: | ---: |
${rows}

Real competitor runs: ${report.realCompetitorRuns}.

Market claim allowed: ${report.summary?.marketSuperiorityClaimAllowed ? "yes" : "no"}.

Blockers:
${(report.summary?.marketSuperiorityBlockers ?? []).map((item) => `- ${item}`).join("\n")}
`;
}

async function pythonPackageStatus(packageName) {
  if (!existsSync(pythonBin)) return { package: packageName, installed: false, version: null, python: pythonBin };
  const result = await runCommand(pythonBin, ["-c", `import importlib.metadata as m; print(m.version(${JSON.stringify(packageName)}))`], {
    cwd: root,
    timeout: 30_000
  });
  return {
    package: packageName,
    installed: result.status === 0,
    version: result.status === 0 ? result.stdout.trim() : null,
    python: pythonBin,
    check: commandEntry(result)
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
}

function points(value) {
  return `${Math.round(value * 1000)}/1000`;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
