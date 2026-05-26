#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const home = process.env.HOME;
if (!home && !process.env.CODEX_HOME) {
  console.error("CODEX_HOME or HOME is required to install the Codex skill.");
  process.exit(1);
}

const codexHome = resolve(process.env.CODEX_HOME ?? join(home, ".codex"));
const skillDir = join(codexHome, "skills", "cognibrain");
const sourcePath = join(root, "templates", "codex", "cognibrain-skill", "SKILL.md");
const targetPath = join(skillDir, "SKILL.md");
const template = readFileSync(sourcePath, "utf8");
const content = template.replaceAll("__COGNIBRAIN_ROOT__", root);

mkdirSync(skillDir, { recursive: true });
writeFileSync(targetPath, content);

console.log(`Installed Codex skill: ${targetPath}`);
console.log(`Start local memory runtime: node ${join(root, "bin", "cognibrain.mjs")} start`);
