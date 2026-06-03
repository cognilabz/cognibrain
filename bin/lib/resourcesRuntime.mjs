import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { HEAVY_GENERATED_EXCLUDE_PATTERNS } from "./harnessRuntime.mjs";

const BENCHMARK_CACHE_TARGETS = Object.freeze([
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
  const rows = RESOURCE_FOOTPRINT_TARGETS.map((name) => {
    const base = name.startsWith("artifacts") || name.startsWith("data/") || name === "dist" || name === "output" || name === ".playwright-cli"
      ? developerArtifactRoot
      : runtimeRoot;
    const path = join(base, name);
    return { name, path, ...pathFootprint(path) };
  });
  const pruneTargets = BENCHMARK_CACHE_TARGETS.map((name) => {
    const path = join(runtimeRoot, name);
    return { name, path, ...pathFootprint(path) };
  }).filter((row) => row.exists);
  const reclaimedBytes = pruneTargets.reduce((sum, row) => sum + row.bytes, 0);
  if (pruneRequested && !dryRun) {
    for (const row of pruneTargets) rmSync(row.path, { recursive: true, force: true });
  }
  return {
    schemaVersion: "1.0",
    runtimeRoot,
    generatedAt: new Date().toISOString(),
    runtime: runtimeStatus(),
    generated: {
      totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
      benchmarkCacheBytes: pruneTargets.reduce((sum, row) => sum + row.bytes, 0),
      rows
    },
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

export function formatResourceFootprint(result) {
  const lines = [
    "cognibrain resources",
    `runtime root: ${result.runtimeRoot}`,
    `runtime: api ${result.runtime.api?.resources?.rssMb ?? "n/a"} MB RSS, cpu ${result.runtime.api?.resources?.cpuPercent ?? "n/a"}%, dashboard ${result.runtime.dashboard?.alive ? "on" : "off"}`,
    `generated total: ${formatBytes(result.generated.totalBytes)}`,
    `benchmark caches: ${formatBytes(result.generated.benchmarkCacheBytes)}`
  ];
  for (const row of result.generated.rows) lines.push(`- ${row.name}: ${formatBytes(row.bytes)} (${row.files} files)`);
  if (result.vscode.settingsPresent) {
    lines.push(`VS Code excludes: watcher missing ${result.vscode.missingWatcherExcludes.length}, search missing ${result.vscode.missingSearchExcludes.length}`);
  } else {
    lines.push("VS Code excludes: settings missing; run cognibrain config vscode");
  }
  if (result.prune.requested) {
    const verb = result.prune.dryRun ? "Would remove" : "Removed";
    lines.push(`${verb} ${result.prune.targets.length} benchmark cache directories, reclaimed ${formatBytes(result.prune.reclaimedBytes)}.`);
  }
  return lines;
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
    missingSearchExcludes: HEAVY_GENERATED_EXCLUDE_PATTERNS.filter((pattern) => search[pattern] !== true)
  };
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
