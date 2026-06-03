#!/usr/bin/env node
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const repo = resolve(process.env.MEMORY_ARENA_GBRAIN_REPO ?? join(root, ".cognibrain", "vendor", "gbrain"));
const home = resolve(process.env.MEMORY_ARENA_GBRAIN_HOME ?? join(root, ".cognibrain", "native-runners", "gbrain-home"));

const input = JSON.parse(await readStdin());
const scenario = input.scenario;
const started = Date.now();
const gaps = [
  "GBrain search/capture does not expose Cognibrain's typed pre-tool action guard",
  "GBrain does not emit Cognibrain Patch Evidence Trail objects for commands/files"
];

try {
  if (!existsSync(join(repo, "src", "cli.ts"))) throw new Error(`GBrain repo not found at ${repo}`);
  ensureGBrainHome();
  const memoryText = [
    `CogniCode scenario: ${scenario.id}`,
    `Repository: ${scenario.repoSeed.name}`,
    `Framework: ${scenario.repoSeed.framework}`,
    `Correction: ${scenario.correction.content}`,
    `Correct action: ${scenario.correction.correctAction}`,
    `Expected command: ${scenario.expected.command}`,
    `Expected files: ${scenario.expected.filesChanged.join(", ")}`,
    scenario.expected.staleRuleSuppressed ? `Stale rule to suppress: ${scenario.expected.staleRuleSuppressed}` : "",
    `Wrong action recorded for contrast only: ${scenario.wrongAction.command ?? scenario.wrongAction.reason}`
  ].filter(Boolean).join("\n");
  const slug = `cognicode/${scenario.id}/correction`;
  const capture = runGBrain(["capture", memoryText, "--slug", slug, "--type", "note", "--json"]);
  if (capture.status !== 0) throw new Error(`gbrain capture failed: ${tail(capture.stderr || capture.stdout)}`);
  const searches = [
    runGBrain(["search", `${scenario.repoSeed.name} ${scenario.nextTask} ${scenario.correction.correctAction}`]),
    runGBrain(["search", scenario.correction.content]),
    runGBrain(["search", scenario.correction.correctAction])
  ];
  const failedSearch = searches.find((search) => search.status !== 0);
  if (failedSearch) throw new Error(`gbrain search failed: ${tail(failedSearch.stderr || failedSearch.stdout)}`);

  const searchOutput = searches.map((search) => search.stdout).join("\n");
  const get = runGBrain(["get", slug]);
  if (get.status !== 0) throw new Error(`gbrain get failed: ${tail(get.stderr || get.stdout)}`);
  console.log(JSON.stringify({
    capabilityGaps: gaps,
    latencyMs: Date.now() - started,
    evidence: {
      runner: "gbrain-cli",
      proofLevel: "same-run-cli",
      repo,
      home,
      slug,
      note: "Raw runner evidence only. Scenario checks must be produced by MEMORY_ARENA_JUDGE_COMMAND; this runner does not self-score.",
      capture: parseJson(capture.stdout),
      searchTail: tail(searchOutput, 1200),
      getTail: tail(get.stdout, 1200)
    }
  }));
} catch (error) {
  console.log(JSON.stringify({
    capabilityGaps: [`GBrain runner failed: ${error.message}`, ...gaps],
    latencyMs: Date.now() - started,
    evidence: {
      runner: "gbrain-cli",
      repo,
      home,
      failed: true,
      error: error.message
    }
  }));
}

function ensureGBrainHome() {
  mkdirSync(home, { recursive: true });
  const expected = join(home, ".gbrain", "brain.pglite");
  if (existsSync(expected)) return;
  const init = runGBrain(["init", "--pglite", "--no-embedding", "--yes", "--non-interactive", "--json"], { timeout: 120_000 });
  if (init.status !== 0) throw new Error(`gbrain init failed: ${tail(init.stderr || init.stdout)}`);
}

function runGBrain(args, options = {}) {
  return spawnSync("bun", ["run", "src/cli.ts", ...args], {
    cwd: repo,
    env: {
      ...process.env,
      HOME: home,
      GBRAIN_CONTRIBUTOR_MODE: "0",
      NO_COLOR: "1"
    },
    encoding: "utf8",
    timeout: options.timeout ?? Number(process.env.MEMORY_ARENA_GBRAIN_TIMEOUT_MS ?? 60_000),
    maxBuffer: 20 * 1024 * 1024
  });
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
