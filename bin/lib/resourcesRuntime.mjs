import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { HEAVY_GENERATED_EXCLUDE_PATTERNS, VS_CODE_LOW_RESOURCE_SETTINGS } from "./harnessRuntime.mjs";
import { nativeRunnerRoot, originalBenchmarkRoot, vendorBenchmarkRoot } from "../../scripts/benchmark/cache-root.mjs";

const WORKSPACE_BENCHMARK_CACHE_TARGETS = Object.freeze([
  ".cognibrain/original-benchmarks",
  ".cognibrain/native-runners",
  ".cognibrain/vendor"
]);

const RESOURCE_FOOTPRINT_TARGETS = Object.freeze([
  ".memory-harness.json",
  ".cognibrain",
  ".cognibrain/original-benchmarks",
  ".cognibrain/native-runners",
  ".cognibrain/vendor",
  ".cognibrain/integrations",
  "artifacts",
  "data/benchmarks",
  "dist",
  "output",
  ".playwright-cli"
]);

export function resourceFootprint({ root, runtimeRoot, launchCwd, readJson, runtimeStatus, pruneRequested = false, dryRun = false }) {
  const developerArtifactRoot = runtimeRoot === root ? runtimeRoot : root;
  const pruneTargets = benchmarkCacheTargets(runtimeRoot).map((target) => ({ ...target, ...pathFootprint(target.path) })).filter((row) => row.exists);
  const reclaimedBytes = pruneTargets.reduce((sum, row) => sum + row.bytes, 0);
  if (pruneRequested && !dryRun) {
    for (const row of pruneTargets) rmSync(row.path, { recursive: true, force: true });
  }
  const rows = resourceFootprintTargets(runtimeRoot).map((target) => {
    const { name, path } = typeof target === "string" ? {
      name: target,
      path: join(target.startsWith("artifacts") || target.startsWith("data/") || target === "dist" || target === "output" || target === ".playwright-cli" ? developerArtifactRoot : runtimeRoot, target)
    } : target;
    return { name, path, ...pathFootprint(path) };
  });
  const remainingBenchmarkCacheBytes = benchmarkCacheTargets(runtimeRoot)
    .map((target) => pathFootprint(target.path))
    .reduce((sum, row) => sum + row.bytes, 0);
  return {
    schemaVersion: "1.0",
    runtimeRoot,
    generatedAt: new Date().toISOString(),
    runtime: runtimeStatus(),
    generated: {
      totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
      benchmarkCacheBytes: remainingBenchmarkCacheBytes,
      rows
    },
    localRuntimeState: localRuntimeStateBreakdown(join(runtimeRoot, ".memory-harness.json")),
    activeProcesses: activeNonRuntimeBenchmarkProcesses(runtimeRoot),
    vscode: vscodeResourceSettingsHealth({ launchCwd, readJson }),
    prune: {
      requested: pruneRequested,
      dryRun,
      targets: pruneTargets,
      reclaimedBytes
    },
    commands: [
      "cognibrain config vscode",
      "cognibrain resources --json",
      "cognibrain resources --prune-benchmark-caches"
    ]
  };
}

function resourceFootprintTargets(runtimeRoot) {
  return [
    ...RESOURCE_FOOTPRINT_TARGETS,
    ...externalBenchmarkCacheTargets(runtimeRoot)
  ];
}

function benchmarkCacheTargets(runtimeRoot) {
  return [
    ...WORKSPACE_BENCHMARK_CACHE_TARGETS.map((name) => ({ name, path: join(runtimeRoot, name) })),
    ...externalBenchmarkCacheTargets(runtimeRoot)
  ];
}

function externalBenchmarkCacheTargets(runtimeRoot) {
  const externalTargets = [
    { name: "user-cache/original-benchmarks", path: originalBenchmarkRoot() },
    { name: "user-cache/native-runners", path: nativeRunnerRoot() },
    { name: "user-cache/vendor", path: vendorBenchmarkRoot() }
  ];
  return externalTargets.filter((target) => !target.path.startsWith(`${runtimeRoot}/`));
}

export function formatResourceFootprint(result) {
  const lines = [
    "cognibrain resources",
    `runtime root: ${result.runtimeRoot}`,
    `runtime: api ${result.runtime.api?.resources?.rssMb ?? "n/a"} MB RSS, cpu ${result.runtime.api?.resources?.cpuPercent ?? "n/a"}%, mode ${result.runtime.api?.runtime ?? "unknown"}, dashboard ${result.runtime.dashboard?.alive ? "on" : "off"}`,
    `generated total: ${formatBytes(result.generated.totalBytes)}`,
    `benchmark caches: ${formatBytes(result.generated.benchmarkCacheBytes)}`
  ];
  for (const row of result.generated.rows) lines.push(`- ${row.name}: ${formatBytes(row.bytes)} (${row.files} files)`);
  if (result.localRuntimeState?.present) {
    lines.push(`local state: ${formatBytes(result.localRuntimeState.bytes)}, evidence packs ${result.localRuntimeState.evidencePacks?.count ?? 0} (${formatBytes(result.localRuntimeState.evidencePacks?.bytes ?? 0)}), audit events ${result.localRuntimeState.auditEvents?.count ?? 0}`);
  }
  lines.push(`active non-runtime benchmark processes: ${result.activeProcesses.benchmarkProcesses.length}`);
  for (const row of result.activeProcesses.benchmarkProcesses.slice(0, 5)) {
    lines.push(`- pid ${row.pid}: cpu ${row.cpuPercent}%, rss ${formatBytes(row.rssKb * 1024)}, ${row.command}`);
  }
  if (result.vscode.settingsPresent) {
    lines.push(`VS Code excludes: watcher missing ${result.vscode.missingWatcherExcludes.length}, search missing ${result.vscode.missingSearchExcludes.length}`);
    lines.push(`VS Code low-resource settings: missing ${result.vscode.missingLowResourceSettings.length}`);
  } else {
    lines.push("VS Code excludes: settings missing; run cognibrain config vscode");
  }
  if (result.prune.requested) {
    const verb = result.prune.dryRun ? "Would remove" : "Removed";
    lines.push(`${verb} ${result.prune.targets.length} benchmark cache directories, reclaimed ${formatBytes(result.prune.reclaimedBytes)}.`);
  }
  return lines;
}

function activeNonRuntimeBenchmarkProcesses(runtimeRoot) {
  const rows = processRows();
  const benchmarkProcesses = rows
    .filter((row) => row.command.includes(runtimeRoot))
    .filter((row) => /\b(benchmark|src\/eval|scripts\/benchmark|arena|release-check)\b/i.test(row.command))
    .filter((row) => !/bin\/lib\/lightweightMcpServer\.mjs|dist\/api\/server\.mjs|src\/api\/server\.ts|scripts\/runtime\/start-local\.mjs/.test(row.command))
    .map((row) => ({
      ...row,
      classification: "non-runtime-benchmark"
    }));
  return {
    source: "ps",
    benchmarkProcesses,
    totalCpuPercent: round1(benchmarkProcesses.reduce((sum, row) => sum + row.cpuPercent, 0)),
    totalRssKb: benchmarkProcesses.reduce((sum, row) => sum + row.rssKb, 0),
    note: "These are developer verification or benchmark processes, not normal API/MCP/dashboard runtime."
  };
}

function processRows() {
  try {
    const output = execFileSync("ps", ["-axo", "pid,ppid,pcpu,rss,command"], { encoding: "utf8", timeout: 2_000 });
    return output.trim().split(/\r?\n/).slice(1).map((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
      if (!match) return undefined;
      return {
        pid: Number(match[1]),
        parentPid: Number(match[2]),
        cpuPercent: Number(match[3]),
        rssKb: Number(match[4]),
        command: match[5]
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function localRuntimeStateBreakdown(path) {
  if (!existsSync(path)) return { present: false, path, bytes: 0, arrays: [] };
  const stat = lstatSync(path);
  if (!stat.isFile()) return { present: false, path, bytes: stat.size, arrays: [] };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { present: true, path, bytes: stat.size, parseable: false, error: error instanceof Error ? error.message : String(error), arrays: [] };
  }
  const arrays = Object.entries(parsed)
    .filter(([, value]) => Array.isArray(value))
    .map(([name, value]) => {
      const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
      return { name, count: value.length, bytes };
    })
    .sort((left, right) => right.bytes - left.bytes || right.count - left.count);
  const evidencePacks = arrays.find((row) => row.name === "evidencePacks") ?? { name: "evidencePacks", count: 0, bytes: 0 };
  const auditEvents = arrays.find((row) => row.name === "auditEvents") ?? { name: "auditEvents", count: 0, bytes: 0 };
  return {
    present: true,
    path,
    bytes: stat.size,
    parseable: true,
    topArrays: arrays.slice(0, 8),
    evidencePacks,
    auditEvents
  };
}

function pathFootprint(path) {
  if (!existsSync(path)) return { exists: false, bytes: 0, files: 0, directories: 0 };
  const stat = lstatSync(path);
  if (!stat.isDirectory()) return { exists: true, bytes: stat.size, files: 1, directories: 0 };
  let bytes = 0;
  let files = 0;
  let directories = 1;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = join(current, entry.name);
      let childStat;
      try {
        childStat = lstatSync(child);
      } catch {
        continue;
      }
      if (childStat.isDirectory()) {
        directories += 1;
        stack.push(child);
      } else {
        files += 1;
        bytes += childStat.size;
      }
    }
  }
  return { exists: true, bytes, files, directories };
}

function vscodeResourceSettingsHealth({ launchCwd, readJson }) {
  const settingsPath = join(launchCwd, ".vscode", "settings.json");
  const settings = readJson(settingsPath, {});
  const watcher = settings["files.watcherExclude"] ?? {};
  const search = settings["search.exclude"] ?? {};
  return {
    settingsPath,
    settingsPresent: existsSync(settingsPath),
    requiredExcludes: HEAVY_GENERATED_EXCLUDE_PATTERNS,
    missingWatcherExcludes: HEAVY_GENERATED_EXCLUDE_PATTERNS.filter((pattern) => watcher[pattern] !== true),
    missingSearchExcludes: HEAVY_GENERATED_EXCLUDE_PATTERNS.filter((pattern) => search[pattern] !== true),
    requiredLowResourceSettings: VS_CODE_LOW_RESOURCE_SETTINGS,
    missingLowResourceSettings: missingVsCodeLowResourceSettings(settings)
  };
}

function missingVsCodeLowResourceSettings(settings) {
  const missing = [];
  for (const [key, expected] of Object.entries(VS_CODE_LOW_RESOURCE_SETTINGS)) {
    const actual = settings[key];
    if (key === "typescript.tsserver.watchOptions") {
      const expectedExcludes = expected.excludeDirectories ?? [];
      const actualExcludes = Array.isArray(actual?.excludeDirectories) ? actual.excludeDirectories : [];
      if (!expectedExcludes.every((pattern) => actualExcludes.includes(pattern))) missing.push(key);
    } else if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || !expected.every((pattern) => actual.includes(pattern))) missing.push(key);
    } else if (expected && typeof expected === "object") {
      if (JSON.stringify(actual ?? {}) !== JSON.stringify(expected)) missing.push(key);
    } else if (actual !== expected) {
      missing.push(key);
    }
  }
  return missing;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
