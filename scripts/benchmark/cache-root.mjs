import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";

export function benchmarkCacheRoot(...parts) {
  const configured = process.env.COGNIBRAIN_BENCHMARK_CACHE_ROOT;
  const base = configured && configured.trim()
    ? configured
    : defaultCacheRoot();
  return resolve(base, ...parts);
}

export function nativeRunnerRoot(...parts) {
  return benchmarkCacheRoot("native-runners", ...parts);
}

export function originalBenchmarkRoot(...parts) {
  return benchmarkCacheRoot("original-benchmarks", ...parts);
}

export function vendorBenchmarkRoot(...parts) {
  return benchmarkCacheRoot("vendor", ...parts);
}

function defaultCacheRoot() {
  if (process.env.XDG_CACHE_HOME) return join(process.env.XDG_CACHE_HOME, "cognibrain");
  if (platform() === "darwin") return join(homedir(), "Library", "Caches", "cognibrain");
  return join(homedir(), ".cache", "cognibrain");
}
