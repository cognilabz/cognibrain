#!/usr/bin/env node
import { rmSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outdir = resolve(root, "dist", "api");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [resolve(root, "src", "api", "server.ts")],
  outdir,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  splitting: true,
  entryNames: "server",
  chunkNames: "chunks/[name]-[hash]",
  outExtension: { ".js": ".mjs" },
  external: ["pg"],
  banner: {
    js: "import * as __cognibrainModule from 'node:module'; const require = __cognibrainModule.createRequire(import.meta.url);"
  },
  sourcemap: false,
  logLevel: "info"
});
