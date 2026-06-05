#!/usr/bin/env node
import { rmSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outdir = resolve(root, "dist", "sdk", "typescript");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    index: resolve(root, "sdk", "typescript", "index.ts"),
    client: resolve(root, "sdk", "typescript", "client.ts"),
    connectors: resolve(root, "sdk", "typescript", "connectors.ts"),
    harness: resolve(root, "sdk", "typescript", "harness.ts")
  },
  outdir,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  sourcemap: false,
  logLevel: "info"
});
