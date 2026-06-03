#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const input = JSON.parse(await readStdin());
const scenario = input.scenario;
const started = Date.now();
const apiKey = process.env.MEM0_API_KEY ?? process.env.MEMORY_ARENA_MEM0_API_KEY;
const baseUrl = process.env.MEM0_BASE_URL ?? process.env.MEMORY_ARENA_MEM0_BASE_URL;
const gaps = [
  "Mem0 does not expose Cognibrain's typed pre-tool action guard in this adapter",
  "Mem0 does not emit Cognibrain Patch Evidence Trail objects for commands/files"
];

if (!apiKey) {
  console.log(JSON.stringify({
    capabilityGaps: ["MEM0_API_KEY is not configured, so no cloud/API same-run was executed", ...gaps],
    latencyMs: Date.now() - started,
    evidence: {
      runner: "mem0-cli",
      proofLevel: "credential-blocked",
      package: "@mem0/cli@0.2.7",
      blocked: true
    }
  }));
  process.exit(0);
}

try {
  const userId = `cognibrain-arena-${scenario.id}`;
  const memoryText = [
    `CogniCode scenario: ${scenario.id}`,
    `Repository: ${scenario.repoSeed.name}`,
    `Correction: ${scenario.correction.content}`,
    `Correct action: ${scenario.correction.correctAction}`,
    `Expected command: ${scenario.expected.command}`,
    `Expected files: ${scenario.expected.filesChanged.join(", ")}`
  ].join("\n");
  const addArgs = [
    "exec", "--yes", "--package", "@mem0/cli@0.2.7", "--", "mem0",
    "add", memoryText,
    "--user-id", userId,
    "--no-infer",
    "--metadata", JSON.stringify({ benchmark: "cognicode", scenarioId: scenario.id }),
    "--api-key", apiKey,
    "-o", "json"
  ];
  if (baseUrl) addArgs.push("--base-url", baseUrl);
  const add = spawnSync("npm", addArgs, { encoding: "utf8", timeout: 120_000, maxBuffer: 20 * 1024 * 1024 });
  if (add.status !== 0) throw new Error(`mem0 add failed: ${tail(add.stderr || add.stdout)}`);

  const searchArgs = [
    "exec", "--yes", "--package", "@mem0/cli@0.2.7", "--", "mem0",
    "search", `${scenario.repoSeed.name} ${scenario.nextTask} ${scenario.correction.correctAction}`,
    "--user-id", userId,
    "--keyword",
    "--api-key", apiKey,
    "-o", "json"
  ];
  if (baseUrl) searchArgs.push("--base-url", baseUrl);
  const search = spawnSync("npm", searchArgs, { encoding: "utf8", timeout: 120_000, maxBuffer: 20 * 1024 * 1024 });
  if (search.status !== 0) throw new Error(`mem0 search failed: ${tail(search.stderr || search.stdout)}`);

  console.log(JSON.stringify({
    capabilityGaps: gaps,
    latencyMs: Date.now() - started,
    evidence: {
      runner: "mem0-cli",
      proofLevel: "same-run-cloud-api",
      package: "@mem0/cli@0.2.7",
      baseUrlConfigured: Boolean(baseUrl),
      note: "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
      add: parseJson(add.stdout),
      search: parseJson(search.stdout) ?? tail(search.stdout, 1200)
    }
  }));
} catch (error) {
  console.log(JSON.stringify({
    capabilityGaps: [`Mem0 runner failed: ${error.message}`, ...gaps],
    latencyMs: Date.now() - started,
    evidence: {
      runner: "mem0-cli",
      failed: true,
      error: error.message
    }
  }));
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function tail(value, limit = 2000) {
  return String(value ?? "").slice(-limit);
}

function readStdin() {
  return new Promise((resolveRead, reject) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolveRead(text));
    process.stdin.on("error", reject);
  });
}
