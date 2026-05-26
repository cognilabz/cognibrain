#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./lib/cliRuntime.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await runCli({ root, launchCwd: process.cwd(), rawArgs: process.argv.slice(2) });
