#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const keep = process.argv.includes("--keep");
const workDir = mkdtempSync(join(tmpdir(), "cognibrain-pack-smoke-"));
const packDir = join(workDir, "pack");
const installDir = join(workDir, "install");
const runtimeRoot = join(workDir, "runtime");
const codexHome = join(workDir, "codex");
const results = [];

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(installDir, { recursive: true });
  mkdirSync(runtimeRoot, { recursive: true });
  mkdirSync(codexHome, { recursive: true });
  run("npm pack", "npm", ["pack", "--pack-destination", packDir], { cwd: root });
  const packOutput = results.at(-1)?.stdout ?? "";
  const tarball = packOutput
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith(".tgz"));
  if (!tarball) throw new Error(`npm pack did not report a tarball:\n${packOutput}`);
  const tarballPath = join(packDir, tarball);

  run("npm init", "npm", ["init", "-y"], { cwd: installDir });
  run("install packed tarball", "npm", ["install", tarballPath], { cwd: installDir });

  const smokeEnv = {
    ...process.env,
    COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
    CODEX_HOME: codexHome,
    MEMORY_DB_PATH: join(runtimeRoot, "memory.json"),
    MEMORY_AUTO_DREAM: "false"
  };

  run("installed init", "npx", ["cognibrain", "init", "--yes", "--no-start", "--no-skill", "--no-doctor"], { cwd: installDir, env: smokeEnv });
  run("installed health", "npx", ["cognibrain", "health", "--json"], { cwd: installDir, env: smokeEnv });
  run("installed MCP help", "npx", ["cognibrain", "mcp", "--help"], { cwd: installDir, env: smokeEnv });
  run("installed SDK and storage imports", "npx", ["tsx", "--eval", importSmokeSource()], { cwd: installDir, env: smokeEnv });

  console.log(`pack smoke passed: ${results.length}/${results.length} checks`);
} finally {
  try {
    spawnSync("npx", ["cognibrain", "stop"], { cwd: installDir, env: { ...process.env, COGNIBRAIN_RUNTIME_ROOT: runtimeRoot }, stdio: "ignore" });
  } catch {
    // best-effort cleanup
  }
  if (keep) console.log(`pack smoke kept temp dir: ${workDir}`);
  else rmSync(workDir, { recursive: true, force: true });
}

function run(name, command, args, options = {}) {
  const cwd = options.cwd ?? root;
  const result = spawnSync(command, args, {
    cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const entry = {
    name,
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message
  };
  results.push(entry);
  console.log(`${entry.ok ? "ok" : "FAIL"} ${name}`);
  if (!entry.ok) {
    console.error([
      `pack smoke failed at "${name}".`,
      `Command: ${entry.command}`,
      entry.error ? `Error: ${entry.error}` : "",
      entry.stderr.trim() ? `stderr:\n${tail(entry.stderr)}` : "",
      entry.stdout.trim() ? `stdout:\n${tail(entry.stdout)}` : ""
    ].filter(Boolean).join("\n"));
    process.exit(entry.status || 1);
  }
  return entry;
}

function importSmokeSource() {
  return `
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const packageRoot = join(process.cwd(), "node_modules", "@cognilabz", "cognibrain");
  const client = await import("@cognilabz/cognibrain/sdk/typescript/client");
  const harness = await import("@cognilabz/cognibrain/sdk/typescript/harness");
  const connectors = await import("@cognilabz/cognibrain/sdk/typescript/connectors");
  const mcp = await import(pathToFileURL(join(packageRoot, "src", "connectors", "mcpServer.ts")).href);
  const postgres = await import(pathToFileURL(join(packageRoot, "src", "api", "repositories", "postgresRepository.ts")).href);

  if (typeof client.CognibrainClient !== "function") throw new Error("CognibrainClient export missing");
  if (typeof harness.CognibrainHarnessSdk !== "function") throw new Error("CognibrainHarnessSdk export missing");
  if (typeof connectors.createPlatformIntegration !== "function") throw new Error("createPlatformIntegration export missing");
  if (typeof mcp.createOpenMemoryMcpServer !== "function") throw new Error("MCP server export missing");
  if (typeof postgres.AsyncPostgresMemoryRepository !== "function") throw new Error("Postgres repository export missing");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;
}

function tail(value = "") {
  return value.trim().split(/\r?\n/).filter(Boolean).slice(-40).join("\n");
}
