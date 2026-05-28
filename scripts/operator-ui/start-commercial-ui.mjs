#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const operatorUiPath = join(root, "operator-ui");
const configPath = join(operatorUiPath, "next.config.mjs");

if (!existsSync(configPath)) {
  console.error("Cognibrain Operator UI is a commercial add-on and is not included in the OSS package.");
  console.error("Install or mount the licensed operator-ui add-on, then run this command again.");
  process.exit(2);
}

const next = join(root, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const command = existsSync(next) ? next : "next";
const result = spawnSync(command, ["dev", operatorUiPath, "-H", "0.0.0.0", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});

process.exit(result.status ?? 1);
