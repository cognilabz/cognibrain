#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const out = optionValue("--out") ?? "artifacts/arena/native-competitors.json";
const count = optionValue("--count") ?? "30";
const gbrainRepo = process.env.MEMORY_ARENA_GBRAIN_REPO ?? join(root, ".cognibrain", "vendor", "gbrain");
const gbrainHome = process.env.MEMORY_ARENA_GBRAIN_HOME ?? join(root, ".cognibrain", "native-runners", "gbrain-home");

const installations = {
  mem0: installMem0(),
  gbrain: installGBrain()
};

const env = {
  ...process.env,
  MEMORY_ARENA_GBRAIN_COMMAND: `${process.execPath} ${join(root, "scripts", "competitors", "gbrain-runner.mjs")}`,
  MEMORY_ARENA_GBRAIN_PROOF_LEVEL: "same-run-cli",
  MEMORY_ARENA_GBRAIN_REPO: gbrainRepo,
  MEMORY_ARENA_GBRAIN_HOME: gbrainHome
};

if (process.env.MEM0_API_KEY || process.env.MEMORY_ARENA_MEM0_API_KEY) {
  env.MEMORY_ARENA_MEM0_COMMAND = `${process.execPath} ${join(root, "scripts", "competitors", "mem0-runner.mjs")}`;
  env.MEMORY_ARENA_MEM0_PROOF_LEVEL = "same-run-cloud-api";
  env.MEMORY_ARENA_MEM0_API_KEY = process.env.MEM0_API_KEY ?? process.env.MEMORY_ARENA_MEM0_API_KEY;
  if (process.env.MEM0_BASE_URL) env.MEMORY_ARENA_MEM0_BASE_URL = process.env.MEM0_BASE_URL;
}

const arena = spawnSync("npx", ["tsx", "src/eval/arena.ts", "--systems", "cognibrain,mem0,graphiti,cognee,langmem,gbrain", "--benchmark", "cognicode", "--count", count, "--out", "artifacts/arena/run.json"], {
  cwd: root,
  env,
  encoding: "utf8",
  timeout: Number(process.env.MEMORY_ARENA_NATIVE_TIMEOUT_MS ?? 900_000),
  maxBuffer: 40 * 1024 * 1024
});
if (arena.status !== 0) {
  writeReport({ installations, arena: commandEntry(arena), published: null });
  console.error(arena.stderr || arena.stdout);
  process.exit(arena.status ?? 1);
}

const publish = spawnSync("npm", ["run", "benchmark:arena:publish"], {
  cwd: root,
  env,
  encoding: "utf8",
  timeout: 120_000,
  maxBuffer: 20 * 1024 * 1024
});
const report = writeReport({ installations, arena: commandEntry(arena), published: commandEntry(publish) });
console.log(JSON.stringify(report, null, 2));
if (publish.status !== 0) process.exit(publish.status ?? 1);

function installMem0() {
  const cli = spawnSync("npm", ["exec", "--yes", "--package", "@mem0/cli@0.2.7", "--", "mem0", "--version"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024
  });
  const sdk = spawnSync("npm", ["view", "mem0ai@3.0.3", "repository", "exports", "--json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024
  });
  const registry = spawnSync("npm", ["view", "mem0ai@3.0.3", "version", "--json"], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 20 * 1024 * 1024
  });
  return {
    package: "mem0ai@3.0.3 + @mem0/cli@0.2.7",
    installed: cli.status === 0 && sdk.status === 0 && registry.status === 0,
    cli: commandEntry(cli),
    sdk: commandEntry(sdk),
    registry: commandEntry(registry),
    liveRunnable: Boolean(process.env.MEM0_API_KEY || process.env.MEMORY_ARENA_MEM0_API_KEY),
    blockedReason: process.env.MEM0_API_KEY || process.env.MEMORY_ARENA_MEM0_API_KEY ? null : "missing MEM0_API_KEY or MEMORY_ARENA_MEM0_API_KEY"
  };
}

function installGBrain() {
  mkdirSync(dirname(gbrainRepo), { recursive: true });
  let clone = null;
  if (!existsSync(join(gbrainRepo, "src", "cli.ts"))) {
    clone = spawnSync("git", ["clone", "--depth=1", "https://github.com/garrytan/gbrain.git", gbrainRepo], {
      cwd: root,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 20 * 1024 * 1024
    });
    if (clone.status !== 0) return { repo: gbrainRepo, installed: false, clone: commandEntry(clone), install: null, version: null };
  }
  const install = spawnSync("bun", ["install", "--frozen-lockfile"], {
    cwd: gbrainRepo,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 20 * 1024 * 1024
  });
  const version = readVersion(join(gbrainRepo, "package.json"));
  return {
    repo: gbrainRepo,
    version,
    installed: install.status === 0,
    clone: clone ? commandEntry(clone) : { ok: true, status: 0, stdoutTail: "already cloned", stderrTail: "" },
    install: commandEntry(install),
    liveRunnable: install.status === 0
  };
}

function writeReport(details) {
  const arenaReport = readJson("artifacts/arena/run.json", { systems: [] });
  const systems = Array.isArray(arenaReport.systems) ? arenaReport.systems : [];
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "native-competitor-run",
    count: Number(count),
    installations: details.installations,
    arena: details.arena,
    published: details.published,
    systems: systems.map((system) => ({
      system: system.system,
      displayName: system.displayName,
      proofLevel: system.proofLevel,
      adapterMode: system.adapterMode,
      score: system.score,
      repeatedMistakeRate: system.metrics?.repeatedMistakeRate,
      scenarioCount: system.scenarioCount,
      runner: system.runner
    })),
    realCompetitorRuns: systems.filter((system) => system.system !== "cognibrain" && ["same-run-native", "same-run-cloud-api", "same-run-cli", "vendor-signed", "real-customer-field"].includes(system.proofLevel)).length,
    blocked: [
      details.installations.mem0.blockedReason ? { system: "mem0", reason: details.installations.mem0.blockedReason } : null
    ].filter(Boolean)
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function commandEntry(result) {
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    error: result.error?.message
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
}

function readVersion(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function tail(value = "", limit = 3000) {
  return String(value).slice(-limit);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
