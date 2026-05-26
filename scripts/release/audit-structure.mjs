#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const packageJson = readJson("package.json");
const readme = read("README.md");
const packageFiles = new Set(packageJson.files ?? []);
const checks = [];

checks.push(check("scripts are grouped by role", () => {
  const rootScripts = readdirSync(join(root, "scripts"), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  return rootScripts.length === 1 && rootScripts[0] === "README.md";
}, { allowedRootFiles: ["scripts/README.md"] }));

checks.push(check("script package commands use grouped paths", () => {
  const scripts = Object.values(packageJson.scripts ?? {}).join("\n");
  return [
    "scripts/runtime/start-local.mjs",
    "scripts/runtime/install-codex-skill.mjs",
    "scripts/release/audit-docs.mjs",
    "scripts/release/audit-product-truth.mjs",
    "scripts/release/release-check.mjs",
    "scripts/benchmark/benchmark-hard-arena.mjs",
    "scripts/demo/demo-proof.mjs"
  ].every((path) => scripts.includes(path));
}));

checks.push(check("SDKs live under sdk", () => {
  return exists("sdk/typescript/client.ts")
    && exists("sdk/python/cognibrain_client.py")
    && !exists("src/sdk/client.ts")
    && packageFiles.has("sdk/typescript/")
    && packageFiles.has("sdk/python/cognibrain_client.py");
}, { publicSdkRoots: ["sdk/typescript", "sdk/python"] }));

checks.push(check("generated and local-only outputs are not packaged", () => {
  const forbidden = [
    "artifacts/",
    "public/benchmark-arena/",
    "public/leaderboard/",
    "data/benchmarks/",
    "sdk/python/build/",
    "sdk/python/cognibrain.egg-info",
    ".memory-harness.json",
    "output/"
  ];
  return forbidden.every((path) => !packageFiles.has(path));
}, { packageFiles: [...packageFiles].filter((path) => /^(artifacts|public\/benchmark|public\/leaderboard|data\/benchmarks|output)/.test(path)) }));

checks.push(check("public repository map covers top-level folders", () => {
  return [
    "`bin/`",
    "`src/`",
    "`sdk/typescript/`",
    "`sdk/python/`",
    "`scripts/`",
    "`fixtures/`",
    "`templates/`",
    "`docker/`",
    "`deploy/`",
    "`data/benchmarks/`"
  ].every((needle) => readme.includes(needle));
}));

checks.push(check("tracked source files stay reviewable", () => {
  const large = trackedSourceFiles()
    .filter((file) => lineCount(file) > 2500)
    .filter((file) => !["package-lock.json", "bin/cognibrain.mjs", "src/api/service.ts", "tests/core.test.ts"].includes(file));
  return large.length === 0;
}, { legacyLargeFiles: ["bin/cognibrain.mjs", "src/api/service.ts", "tests/core.test.ts"] }));

for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}`);
writeReport(checks);
if (checks.some((item) => !item.passed)) process.exit(1);

function check(name, predicate, evidence = {}) {
  let passed = false;
  let error;
  try {
    passed = Boolean(predicate());
  } catch (caught) {
    error = caught?.message ?? String(caught);
  }
  return { name, passed, evidence, error };
}

function exists(path) {
  try {
    return statSync(join(root, path)).isFile() || statSync(join(root, path)).isDirectory();
  } catch {
    return false;
  }
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function trackedSourceFiles() {
  return [
    ...walk("bin").filter((path) => path.endsWith(".mjs")),
    ...walk("src").filter((path) => path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".mjs")),
    ...walk("tests").filter((path) => path.endsWith(".ts"))
  ];
}

function walk(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function lineCount(path) {
  return read(path).split(/\r?\n/).length;
}

function writeReport(items) {
  const summary = {
    total: items.length,
    passed: items.filter((item) => item.passed).length,
    failed: items.filter((item) => !item.passed).length
  };
  console.log(`structure audit: ${summary.passed}/${summary.total} passed`);
}
