#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizedRuntimeEnv } from "../../bin/lib/runtimeEnv.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRoot = resolve(process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd());
const defaultDbPath = process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json");
const stateDir = join(runtimeRoot, ".cognibrain");
const statePath = join(stateDir, "local-runtime.json");
const apiStartPort = Number(process.env.PORT ?? 8787);
const uiStartPort = Number(process.env.NEXT_PORT ?? 5173);
const args = new Set(process.argv.slice(2));
const withDashboard = args.has("--dashboard") || args.has("--with-dashboard") || process.env.COGNIBRAIN_DASHBOARD === "true";
const operatorUiPath = join(root, "operator-ui");
const dashboardConfigPath = join(operatorUiPath, "next.config.mjs");

if (args.has("--status")) {
  await printStatus();
} else if (args.has("--stop")) {
  stopRuntime();
} else if (args.has("--daemon")) {
  await startDaemon();
} else {
  await startForeground();
}

async function startDaemon() {
  mkdirSync(stateDir, { recursive: true });
  const apiRuntime = resolveApiRuntime();
  const next = withDashboard ? requireExecutable("next") : null;
  if (withDashboard) requireCommercialOperatorUi();
  const current = readState();
  if (current && isAlive(current.api?.pid) && (!withDashboard || isAlive(current.ui?.pid))) {
    console.log(withDashboard && current.ui?.url ? `cognibrain already running: ${current.api.url} and ${current.ui.url}` : `cognibrain API already running: ${current.api.url}`);
    return;
  }
  if (current) stopRuntime();

  const apiPort = await findOpenPort(apiStartPort);
  const apiLog = openSync(join(stateDir, "api.log"), "a");
  const api = spawn(apiRuntime.command, apiRuntime.args, {
    cwd: root,
    detached: true,
    env: {
      ...sanitizedRuntimeEnv(),
      NODE_ENV: process.env.NODE_ENV === "test" ? "development" : process.env.NODE_ENV,
      COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
      HOST: process.env.HOST ?? "127.0.0.1",
      PORT: String(apiPort),
      MEMORY_DB_PATH: defaultDbPath
    },
    stdio: ["ignore", apiLog, apiLog]
  });
  let ui = null;
  let uiPort = null;
  if (withDashboard) {
    uiPort = await findOpenPort(uiStartPort);
    const uiLog = openSync(join(stateDir, "dashboard.log"), "a");
    ui = spawn(next, ["dev", operatorUiPath, "-H", "127.0.0.1", "-p", String(uiPort)], {
      cwd: root,
      detached: true,
      env: { ...sanitizedRuntimeEnv(), NODE_ENV: process.env.NODE_ENV === "test" ? "development" : process.env.NODE_ENV, COGNIBRAIN_RUNTIME_ROOT: runtimeRoot, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://127.0.0.1:${apiPort}` },
      stdio: ["ignore", uiLog, uiLog]
    });
    ui.unref();
  }
  api.unref();

  const state = {
    startedAt: new Date().toISOString(),
    root,
    runtimeRoot,
    api: { pid: api.pid, port: apiPort, url: `http://127.0.0.1:${apiPort}`, runtime: apiRuntime.runtime, entrypoint: apiRuntime.entrypoint, processModel: apiRuntime.processModel },
    ui: ui ? { pid: ui.pid, port: uiPort, url: `http://127.0.0.1:${uiPort}` } : null,
    dbPath: defaultDbPath
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  await waitForUrl(`${state.api.url}/health`, Number(process.env.COGNIBRAIN_API_READY_TIMEOUT_MS ?? 30_000));
  if (state.ui?.url) await waitForUrl(state.ui.url, 20_000);
  console.log(`cognibrain API: ${state.api.url}`);
  console.log(state.ui?.url ? `cognibrain UI:  ${state.ui.url}` : "cognibrain UI:  optional; run cognibrain dashboard");
  console.log(`runtime state:   ${statePath}`);
}

async function startForeground() {
  const apiRuntime = resolveApiRuntime();
  const next = withDashboard ? requireExecutable("next") : null;
  if (withDashboard) requireCommercialOperatorUi();
  const apiPort = await findOpenPort(apiStartPort);
  const api = spawn(apiRuntime.command, apiRuntime.args, {
    cwd: root,
    env: {
      ...sanitizedRuntimeEnv(),
      NODE_ENV: process.env.NODE_ENV === "test" ? "development" : process.env.NODE_ENV,
      COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
      HOST: process.env.HOST ?? "127.0.0.1",
      PORT: String(apiPort),
      MEMORY_DB_PATH: defaultDbPath
    },
    stdio: "inherit"
  });
  let ui = null;
  let uiPort = null;
  if (withDashboard) {
    uiPort = await findOpenPort(uiStartPort);
    ui = spawn(next, ["dev", operatorUiPath, "-H", "127.0.0.1", "-p", String(uiPort)], {
      cwd: root,
      env: { ...sanitizedRuntimeEnv(), NODE_ENV: process.env.NODE_ENV === "test" ? "development" : process.env.NODE_ENV, COGNIBRAIN_RUNTIME_ROOT: runtimeRoot, NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://127.0.0.1:${apiPort}` },
      stdio: "inherit"
    });
  }

  console.log(`cognibrain API: http://127.0.0.1:${apiPort}`);
  console.log(`cognibrain API runtime: ${apiRuntime.runtime}`);
  console.log(uiPort ? `cognibrain UI:  http://127.0.0.1:${uiPort}` : "cognibrain UI:  optional; rerun with --dashboard");
  const stop = () => {
    api.kill("SIGTERM");
    if (ui) ui.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

function stopRuntime() {
  const state = readState();
  if (!state) {
    console.log("No cognibrain runtime state found.");
    return;
  }
  for (const service of [state.api, state.ui].filter(Boolean)) {
    if (isAlive(service?.pid)) process.kill(service.pid, "SIGTERM");
  }
  rmSync(statePath, { force: true });
  console.log("Stopped cognibrain local runtime.");
}

function requireCommercialOperatorUi() {
  if (existsSync(dashboardConfigPath)) return;
  console.error("Cognibrain Operator UI is a commercial add-on and is not included in the OSS package.");
  console.error("Install or mount the licensed operator-ui add-on, then run with --dashboard again.");
  process.exit(2);
}

function resolveApiRuntime() {
  const forced = process.env.COGNIBRAIN_API_RUNTIME ?? "auto";
  const builtEntrypoint = join(root, "dist", "api", "server.mjs");
  if (forced === "built" || (forced === "auto" && existsSync(builtEntrypoint))) {
    if (!existsSync(builtEntrypoint)) {
      console.error("COGNIBRAIN_API_RUNTIME=built requested, but dist/api/server.mjs is missing. Provide a built API entrypoint or unset COGNIBRAIN_API_RUNTIME.");
      process.exit(1);
    }
    return {
      runtime: "built-node",
      entrypoint: builtEntrypoint,
      processModel: "single-process",
      command: process.execPath,
      args: [builtEntrypoint]
    };
  }
  if (forced === "tsx-cli") {
    const tsx = requireExecutable("tsx");
    return {
      runtime: "source-tsx-cli",
      entrypoint: "src/api/server.ts",
      processModel: "may-fork",
      command: tsx,
      args: ["src/api/server.ts"]
    };
  }
  if (forced !== "auto" && forced !== "source" && forced !== "node-import-tsx") {
    console.error(`Unsupported COGNIBRAIN_API_RUNTIME=${forced}. Use auto, built, source, node-import-tsx, or tsx-cli.`);
    process.exit(1);
  }
  requireExecutable("tsx");
  return {
    runtime: "source-node-import-tsx",
    entrypoint: "src/api/server.ts",
    processModel: "single-process",
    command: process.execPath,
    args: ["--import", "tsx", "src/api/server.ts"]
  };
}

async function printStatus() {
  const state = readState();
  if (!state) {
    console.log("cognibrain local runtime is not started by this script.");
    return;
  }
  const apiAlive = isAlive(state.api?.pid);
  const uiAlive = isAlive(state.ui?.pid);
  const apiHealth = apiAlive ? await requestJson(`${state.api.url}/health`).catch(() => null) : null;
  console.log(JSON.stringify({ ...state, alive: { api: apiAlive, ui: uiAlive }, apiHealth }, null, 2));
}

function readState() {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findOpenPort(start) {
  for (let port = start; port < start + 50; port += 1) {
    if (await isPortOpen(port)) return port;
  }
  throw new Error(`No open port found from ${start} to ${start + 49}`);
}

function isPortOpen(port) {
  return new Promise((resolveOpen) => {
    const server = net.createServer();
    server.once("error", () => resolveOpen(false));
    server.once("listening", () => server.close(() => resolveOpen(true)));
    server.listen(port, "127.0.0.1");
  });
}

function waitForUrl(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolveWait, reject) => {
    const check = () => {
      requestJson(url)
        .then(() => resolveWait())
        .catch((error) => {
          if (Date.now() - started > timeoutMs) {
            reject(error);
            return;
          }
          setTimeout(check, 250);
        });
    };
    check();
  });
}

function requestJson(url) {
  return new Promise((resolveRequest, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }
        try {
          resolveRequest(body ? JSON.parse(body) : {});
        } catch {
          resolveRequest({ body });
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(1_500, () => {
      request.destroy(new Error(`${url} timed out`));
    });
  });
}

function requireExecutable(name) {
  const executable = resolveExecutable(name);
  if (!executable) {
    console.error(`${name} is missing. Run npm install or reinstall the cognibrain package.`);
    process.exit(1);
  }
  return executable;
}

function resolveExecutable(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  for (const candidate of [
    join(root, "node_modules", ".bin", `${name}${suffix}`),
    join(root, "..", ".bin", `${name}${suffix}`),
    join(root, "..", "..", ".bin", `${name}${suffix}`)
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  if (commandExists(name)) return name;
  return null;
}

function commandExists(name) {
  const result = spawnSync(name, ["--version"], { cwd: root, env: process.env, stdio: "ignore" });
  return result.status === 0;
}
