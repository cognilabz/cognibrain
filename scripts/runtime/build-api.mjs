#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outfile = resolve(root, "dist", "api", "server.mjs");

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [resolve(root, "src", "api", "server.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: {
    js: "import * as __cognibrainModule from 'node:module'; const require = __cognibrainModule.createRequire(import.meta.url);"
  },
  sourcemap: false,
  logLevel: "info"
});
