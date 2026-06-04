#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { nativeRunnerRoot } from "./cache-root.mjs";
import { commandEntry, runCommand } from "./streaming-command.mjs";

const root = new URL("../..", import.meta.url).pathname;
const out = optionValue("--out") ?? "artifacts/realworld-blackbox-openai-intelligence.json";
const markdown = optionValue("--markdown") ?? "artifacts/docs/realworld-blackbox-openai-intelligence.md";
const successOut = optionValue("--success-out") ?? "artifacts/realworld-blackbox-openai-intelligence-success.json";
const successMarkdown = optionValue("--success-markdown") ?? "artifacts/docs/realworld-blackbox-openai-intelligence-success.md";
const installOut = optionValue("--install-out") ?? "artifacts/realworld-native-competitors.json";
const systems = optionValue("--systems") ?? "cognibrain,basicmemory,langmem,keyword";
const pythonVenv = process.env.MEMORY_REALWORLD_COMPETITOR_VENV
  ?? process.env.MEMORY_ARENA_COMPETITOR_VENV
  ?? nativeRunnerRoot("competitors-venv");
const pythonBin = process.env.MEMORY_REALWORLD_COMPETITOR_PYTHON
  ?? process.env.MEMORY_ARENA_COMPETITOR_PYTHON
  ?? join(pythonVenv, "bin", "python");

const installations = {
  pythonCompetitors: await installPythonCompetitors(),
  basicmemory: await pythonPackageStatus("basic-memory"),
  langmem: await pythonPackageStatus("langmem")
};

const env = {
  ...process.env,
  COGNIBRAIN_NATIVE_RUNNER_ROOT: process.env.COGNIBRAIN_NATIVE_RUNNER_ROOT ?? nativeRunnerRoot(),
  MEMORY_REALWORLD_BASICMEMORY_COMMAND: process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND
    ?? `${pythonBin} ${join(root, "scripts", "benchmark", "competitors", "basic_memory_realworld_runner.py")}`,
  MEMORY_REALWORLD_LANGMEM_COMMAND: process.env.MEMORY_REALWORLD_LANGMEM_COMMAND
    ?? `${pythonBin} ${join(root, "scripts", "benchmark", "competitors", "langmem_realworld_runner.py")}`,
  MEMORY_REALWORLD_COMMAND_TIMEOUT_MS: process.env.MEMORY_REALWORLD_COMMAND_TIMEOUT_MS ?? "300000",
  MEMORY_REALWORLD_JUDGE_TIMEOUT_MS: process.env.MEMORY_REALWORLD_JUDGE_TIMEOUT_MS ?? "300000"
};

if (!env.MEMORY_REALWORLD_JUDGE_COMMAND && (process.env.MEMORY_OPENAI_API_KEY || process.env.OPENAI_API_KEY)) {
  env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${join(root, "scripts", "benchmark", "realworld-openai-judge.mjs")}`;
  env.MEMORY_REALWORLD_JUDGE_KIND = "llm";
}

const realworld = await runCommand("npx", [
  "tsx",
  "src/eval/realworldBlackbox.ts",
  "--out",
  out,
  "--markdown",
  markdown,
  "--success-out",
  successOut,
  "--success-markdown",
  successMarkdown,
  "--systems",
  systems
], {
  cwd: root,
  env,
  timeout: Number(process.env.MEMORY_REALWORLD_NATIVE_TIMEOUT_MS ?? 900_000)
});

const report = writeReport({ installations, realworld: commandEntry(realworld) });
console.log(JSON.stringify(report, null, 2));
if (realworld.status !== 0) {
  console.error(realworld.stderr || realworld.stdout);
  process.exit(realworld.status ?? 1);
}

async function installPythonCompetitors() {
  const pythonCandidate = process.env.MEMORY_REALWORLD_PYTHON ?? process.env.MEMORY_ARENA_PYTHON ?? process.env.PYTHON ?? "python3";
  const packages = [
    "basic-memory==0.21.5",
    "langmem==0.0.30"
  ];
  const uv = await runCommand("uv", ["--version"], {
    cwd: root,
    timeout: 30_000
  });
  let venv = { status: 0, stdout: "already exists", stderr: "" };
  if (!existsSync(pythonBin)) {
    mkdirSync(dirname(pythonVenv), { recursive: true });
    venv = uv.status === 0 ? await runCommand("uv", ["venv", pythonVenv, "--python", pythonCandidate], {
      cwd: root,
      timeout: 180_000
    }) : await runCommand(pythonCandidate, ["-m", "venv", pythonVenv], {
      cwd: root,
      timeout: 180_000
    });
    if (venv.status !== 0) return { installed: false, uv: commandEntry(uv), venv: pythonVenv, create: commandEntry(venv), install: null };
  }

  const install = uv.status === 0 ? await runCommand("uv", ["pip", "install", "--python", pythonBin, ...packages], {
    cwd: root,
    timeout: 600_000
  }) : await runCommand(pythonBin, ["-m", "pip", "install", ...packages], {
    cwd: root,
    timeout: 600_000
  });
  return {
    installed: install.status === 0 && existsSync(pythonBin),
    python: pythonBin,
    packages,
    installer: uv.status === 0 ? "uv" : "python-venv-pip",
    uv: commandEntry(uv),
    create: commandEntry(venv),
    install: commandEntry(install)
  };
}

function writeReport(details) {
  const realworldReport = readJson(out, { systems: [], eligibilityGate: {}, leaderboardEligible: false });
  const systems = Array.isArray(realworldReport.systems) ? realworldReport.systems : [];
  const originalSystems = systems.filter((system) => system.system !== "cognibrain" && system.evidenceClass === "same-run-command");
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "realworld-native-competitor-run",
    benchmark: "realworld-blackbox-v1",
    output: out,
    markdown,
    installations: details.installations,
    realworld: details.realworld,
    systems: systems.map((system) => ({
      system: system.system,
      displayName: system.displayName,
      evidenceClass: system.evidenceClass,
      adapterMode: system.adapterMode,
      qualityClaimAllowed: system.qualityClaimAllowed,
      comparativeSmokeEligible: system.comparativeSmokeEligible,
      leaderboardEligible: system.leaderboardEligible,
      judgeStatus: system.judge?.status,
      blockedReason: system.blockedReason,
      rawOutputCount: Array.isArray(system.rawOutputs) ? system.rawOutputs.length : 0,
      runner: system.setup?.runner
    })),
    originalRawOutputRuns: originalSystems.filter((system) => Array.isArray(system.rawOutputs) && system.rawOutputs.length > 0).length,
    judgeBlockedOriginalRuns: originalSystems.filter((system) => system.qualityClaimAllowed === false && system.judge?.status === "blocked").length,
    comparativeSmokeEligible: realworldReport.comparativeSmokeEligible === true,
    leaderboardEligible: realworldReport.leaderboardEligible === true,
    marketClaimAllowed: realworldReport.marketClaimAllowed === true,
    eligibilityGate: realworldReport.eligibilityGate ?? {},
    claimBoundary: "Original competitors are executed as same-manifest raw-output systems; quality and comparative-smoke eligibility require the configured central LLM/harness judge, while market and leaderboard claims remain blocked by the RealWorld claim boundary."
  };
  mkdirSync(dirname(installOut), { recursive: true });
  writeFileSync(installOut, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function pythonPackageStatus(packageName) {
  if (!existsSync(pythonBin)) return { package: packageName, installed: false, version: null, python: pythonBin };
  const version = await runCommand(pythonBin, ["-c", `import importlib.metadata as m; print(m.version(${JSON.stringify(packageName)}))`], {
    cwd: root,
    timeout: 30_000
  });
  return {
    package: packageName,
    installed: version.status === 0,
    version: version.status === 0 ? version.stdout.trim() : null,
    python: pythonBin,
    check: commandEntry(version)
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(isAbsolute(path) ? path : join(root, path), "utf8"));
  } catch {
    return fallback;
  }
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
