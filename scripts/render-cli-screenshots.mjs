#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "bin", "cognibrain.mjs");
const outDir = join(root, "docs", "assets");
const runtimeRoot = mkdtempSync(join(tmpdir(), "cognibrain-cli-screens-"));
const env = {
  ...process.env,
  COGNIBRAIN_FORCE_INK: "true",
  COLUMNS: "120",
  FORCE_COLOR: "1",
  MEMORY_AUTO_DREAM: "false",
  MEMORY_USER_ID: "cli-screenshot",
  MEMORY_DB_PATH: join(runtimeRoot, "memory.json")
};
delete env.NO_COLOR;

const ansiColors = {
  30: "#1e2a32",
  31: "#ff7b72",
  32: "#8ee6a5",
  33: "#ffd166",
  34: "#7db7ff",
  35: "#d6a2ff",
  36: "#82e6f2",
  37: "#e8f2f1",
  90: "#8da3aa",
  91: "#ff9a95",
  92: "#a7f3bd",
  93: "#ffe08a",
  94: "#9cc8ff",
  95: "#e1b5ff",
  96: "#a1eef7",
  97: "#f4faf9"
};

const captures = [
  { name: "cli-home", command: "cognibrain", args: [] },
  { name: "cli-memories", command: "cognibrain memories", args: ["memories"] },
  { name: "cli-connections", command: "cognibrain connections", args: ["connections"] },
  { name: "cli-service", command: "cognibrain service plan --platform linux", args: ["service", "plan", "--platform", "linux"] },
  { name: "cli-config", command: "cognibrain config show", args: ["config", "show"] },
  { name: "cli-sdk", command: "cognibrain sdk list", args: ["sdk", "list"] }
];

try {
  mkdirSync(outDir, { recursive: true });
  seedRuntime();
  for (const capture of captures) {
    const output = run(capture.args).trimEnd();
    const svg = terminalSvg({ command: capture.command, output });
    const path = join(outDir, `${capture.name}.svg`);
    await writeFile(path, svg);
    console.log(`wrote ${path}`);
  }
} finally {
  if (existsSync(runtimeRoot)) rmSync(runtimeRoot, { recursive: true, force: true });
}

function seedRuntime() {
  run(["init", "--profile", "solo-dev", "--yes", "--dry-run", "--no-start", "--no-doctor", "--no-skill", "--no-demo"]);
  run(["memory", "add", "The CLI is the primary self-hosted operator surface."]);
  run(["memory", "add", "Connector setup, service automation, SDK scaffolds and doctor checks are visible in the terminal."]);
  run(["connections", "add", "github", "--set", "repo=cognilabz/cognibrain", "--token-env", "MEMORY_GITHUB_TOKEN"]);
  run(["connections", "add", "storage-sqlite", "--set", "path=.cognibrain/memory.sqlite"]);
}

function run(args) {
  return execFileSync(process.execPath, [cli, "--runtime-root", runtimeRoot, ...args], {
    cwd: runtimeRoot,
    env,
    encoding: "utf8",
    timeout: 30_000
  });
}

function terminalSvg({ command, output }) {
  const lines = output.split("\n");
  const fontSize = 15;
  const lineHeight = 21;
  const longest = Math.max(command.length + 2, ...lines.map((line) => visualLength(line)));
  const width = Math.max(940, Math.min(1320, Math.ceil(longest * 8.7) + 76));
  const height = 78 + lines.length * lineHeight + 34;
  const body = lines.map((line, index) => {
    const y = 78 + index * lineHeight;
    return `<text x="30" y="${y}" fill="#e8f2f1" font-family="Menlo, Consolas, monospace" font-size="${fontSize}">${ansiToSvg(line)}</text>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(command)} terminal screenshot">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07131f"/>
      <stop offset="58%" stop-color="#0b1826"/>
      <stop offset="100%" stop-color="#13251f"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#020711" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#edf3f6"/>
  <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="14" fill="url(#bg)" filter="url(#shadow)"/>
  <rect x="18" y="18" width="${width - 36}" height="44" rx="14" fill="#0e1f31"/>
  <rect x="36" y="35" width="10" height="10" rx="5" fill="#ff6b65"/>
  <rect x="54" y="35" width="10" height="10" rx="5" fill="#ffd166"/>
  <rect x="72" y="35" width="10" height="10" rx="5" fill="#66d19e"/>
  <text x="104" y="45" fill="#98dce9" font-family="Menlo, Consolas, monospace" font-size="14" font-weight="600">$ ${escapeXml(command)}</text>
  <g>
${body}
  </g>
</svg>
`;
}

function visualLength(value) {
  return String(value).replace(/\u001b\[[0-9;]*m/g, "").length;
}

function ansiToSvg(value) {
  const text = String(value);
  const matches = [...text.matchAll(/\u001b\[([0-9;]*)m/g)];
  if (!matches.length) return escapeXmlPreserved(text);
  let cursor = 0;
  let color = "#e8f2f1";
  let bold = false;
  const spans = [];
  for (const match of matches) {
    if (match.index > cursor) spans.push(span(text.slice(cursor, match.index), color, bold));
    const codes = String(match[1] || "0").split(";").map((code) => Number(code || "0"));
    for (const code of codes) {
      if (code === 0) {
        color = "#e8f2f1";
        bold = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 22) {
        bold = false;
      } else if (code === 39) {
        color = "#e8f2f1";
      } else if (ansiColors[code]) {
        color = ansiColors[code];
      }
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) spans.push(span(text.slice(cursor), color, bold));
  return spans.join("");
}

function span(text, color, bold) {
  if (!text) return "";
  return `<tspan fill="${color}"${bold ? ` font-weight="700"` : ""}>${escapeXmlPreserved(text)}</tspan>`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXmlPreserved(value) {
  return escapeXml(value).replace(/ /g, "&#160;");
}
