#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cognibrain = join(root, "bin", "cognibrain.mjs");
const rawArgs = process.argv.slice(2);

const aliases = new Map([
  ["all", "all-harnesses"],
  ["all-harnesses", "all-harnesses"],
  ["codex", "codex"],
  ["openai-codex", "codex"],
  ["claude", "claude"],
  ["claude-code", "claude"],
  ["copilot", "copilot"],
  ["github-copilot", "copilot"],
  ["cursor", "cursor"],
  ["vscode", "vscode"],
  ["vs-code", "vscode"]
]);

if (rawArgs.includes("--help") || rawArgs.includes("-h") || rawArgs.includes("help")) usage(0);

let targetArg;
for (let index = 0; index < rawArgs.length; index += 1) {
  const item = rawArgs[index];
  if (item === "--runtime-root") {
    index += 1;
    continue;
  }
  if (!item.startsWith("-")) {
    targetArg = item;
    break;
  }
}
if (!targetArg) usage(1);

const target = aliases.get(targetArg);
if (!target) usage(1);

const passthrough = [];
const globalArgs = [];
for (let index = 0; index < rawArgs.length; index += 1) {
  const item = rawArgs[index];
  if (item === targetArg) continue;
  if (item === "--runtime-root") {
    globalArgs.push(item, rawArgs[index + 1]);
    index += 1;
    continue;
  }
  passthrough.push(item);
}

const setupFlag = target === "all-harnesses" ? "--all-harnesses" : `--${target}`;
const setupArgs = [...globalArgs, "setup", setupFlag, ...passthrough];
const setup = spawnSync(process.execPath, [cognibrain, ...setupArgs], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
});
if (setup.status !== 0) process.exit(setup.status ?? 1);

const manifestPath = join(process.cwd(), ".cognibrain-harness-package.json");
const manifest = readHarnessManifest(manifestPath);
const label = target === "all-harnesses" ? "all harnesses" : targetArg;
console.log(`cognibrain connector package ready for ${label}.`);
if (manifest) {
  const harnesses = Object.keys(manifest.harnesses ?? {}).join(", ");
  console.log(`manifest: ${manifestPath}`);
  console.log(`harnesses: ${harnesses || "none"}`);
}
console.log(`health: ${process.execPath} ${cognibrain} ${globalArgs.join(" ")} doctor --publish`);

function readHarnessManifest(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function usage(exitCode) {
  console.log(`cognibrain-connect

Usage:
  npx cognibrain-connect <codex|claude-code|cursor|github-copilot|vscode|all> [--runtime-root <path>] [--no-start] [--no-doctor]

Examples:
  npx cognibrain-connect claude-code
  npx cognibrain-connect codex --no-start
  npx cognibrain-connect all --runtime-root ${join(homedir(), "project")}

The command installs the packaged skill/config for the selected harness, writes a reviewable
.cognibrain-harness-package.json with feedback adapters, starts the local API/dashboard unless
--no-start is passed, then runs the cognibrain doctor unless --no-doctor is passed.
`);
  process.exit(exitCode);
}
