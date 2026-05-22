#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = resolve(process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd());
const defaultDbPath = process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json");
const stateDir = join(runtimeRoot, ".cognibrain");
const statePath = join(stateDir, "local-runtime.json");
const apiStartPort = Number(process.env.PORT ?? 8787);
const uiStartPort = Number(process.env.VITE_PORT ?? 5173);
const args = new Set(process.argv.slice(2));

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
  const tsx = requireExecutable("tsx");
  const vite = requireExecutable("vite");
  const current = readState();
  if (current && isAlive(current.api?.pid) && isAlive(current.ui?.pid)) {
    console.log(`cognibrain already running: ${current.api.url} and ${current.ui.url}`);
    return;
  }
  if (current) stopRuntime();

  const apiPort = await findOpenPort(apiStartPort);
  const uiPort = await findOpenPort(uiStartPort);
  const apiLog = openSync(join(stateDir, "api.log"), "a");
  const uiLog = openSync(join(stateDir, "dashboard.log"), "a");
  const api = spawn(tsx, ["src/api/server.ts"], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
      HOST: process.env.HOST ?? "127.0.0.1",
      PORT: String(apiPort),
      MEMORY_DB_PATH: defaultDbPath
    },
    stdio: ["ignore", apiLog, apiLog]
  });
  const ui = spawn(vite, ["--host", "127.0.0.1", "--port", String(uiPort), "--strictPort"], {
    cwd: root,
    detached: true,
    env: { ...process.env, COGNIBRAIN_RUNTIME_ROOT: runtimeRoot, VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${apiPort}` },
    stdio: ["ignore", uiLog, uiLog]
  });
  api.unref();
  ui.unref();

  const state = {
    startedAt: new Date().toISOString(),
    root,
    runtimeRoot,
    api: { pid: api.pid, port: apiPort, url: `http://localhost:${apiPort}` },
    ui: { pid: ui.pid, port: uiPort, url: `http://localhost:${uiPort}` },
    dbPath: defaultDbPath
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  await waitForUrl(`${state.api.url}/health`, 8_000);
  await waitForUrl(state.ui.url, 8_000);
  console.log(`cognibrain API: ${state.api.url}`);
  console.log(`cognibrain UI:  ${state.ui.url}`);
  console.log(`runtime state:   ${statePath}`);
}

async function startForeground() {
  const tsx = requireExecutable("tsx");
  const vite = requireExecutable("vite");
  const apiPort = await findOpenPort(apiStartPort);
  const uiPort = await findOpenPort(uiStartPort);
  const api = spawn(tsx, ["src/api/server.ts"], {
    cwd: root,
    env: {
      ...process.env,
      COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
      HOST: process.env.HOST ?? "127.0.0.1",
      PORT: String(apiPort),
      MEMORY_DB_PATH: defaultDbPath
    },
    stdio: "inherit"
  });
  const ui = spawn(vite, ["--host", "127.0.0.1", "--port", String(uiPort), "--strictPort"], {
    cwd: root,
    env: { ...process.env, COGNIBRAIN_RUNTIME_ROOT: runtimeRoot, VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${apiPort}` },
    stdio: "inherit"
  });

  console.log(`cognibrain API: http://localhost:${apiPort}`);
  console.log(`cognibrain UI:  http://localhost:${uiPort}`);
  const stop = () => {
    api.kill("SIGTERM");
    ui.kill("SIGTERM");
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
  for (const service of [state.api, state.ui]) {
    if (isAlive(service?.pid)) process.kill(service.pid, "SIGTERM");
  }
  rmSync(statePath, { force: true });
  console.log("Stopped cognibrain local runtime.");
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
