import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { sanitizedRuntimeEnv } from "./runtimeEnv.mjs";

export function discoverDaemonUrl(runtimeRoot, explicitUrl) {
  const explicit = explicitUrl ?? process.env.MEMORY_API_URL ?? process.env.COGNIBRAIN_API_URL ?? process.env.COGNIBRAIN_URL;
  if (explicit) return stripSlash(explicit);
  for (const file of [
    join(runtimeRoot, ".cognibrain", "runtime.json"),
    join(runtimeRoot, ".cognibrain", "local-runtime.json")
  ]) {
    const state = readJson(file);
    if (state?.api?.url) return stripSlash(state.api.url);
  }
  return "http://127.0.0.1:8787";
}

export async function httpJson(method, url, body, options = {}) {
  const timeoutMs = options.timeoutMs ?? 4_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(options.headers ?? {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = parseJson(text);
    if (!response.ok) {
      const error = new Error(payload.error ?? payload.message ?? `${url} returned ${response.status}`);
      error.code = payload.code ?? "http_error";
      if (options.exitCodes) error.exitCode = response.status === 401 || response.status === 403 ? options.exitCodes.authConfigError : options.exitCodes.genericFailure;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function queryString(input = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      continue;
    }
    if (typeof value === "object" && !(value instanceof Date)) continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function authHeadersFromEnv() {
  const bearer = process.env.MEMORY_BEARER_TOKEN;
  const apiKey = bearer ? undefined : process.env.MEMORY_API_KEY ?? process.env.COGNIBRAIN_API_KEY ?? process.env.COGNIBRAIN_API_TOKEN;
  return cleanHeaders({
    authorization: bearer ? `Bearer ${bearer}` : undefined,
    "x-api-key": apiKey,
    "x-actor-id": process.env.MEMORY_ACTOR_ID ?? process.env.COGNIBRAIN_ACTOR_ID
  });
}

export function authHeadersFromOptions(options) {
  const authEnvName = stringOption(options, "auth-env");
  const authEnvValue = authEnvName ? process.env[authEnvName] : undefined;
  const bearer = stringOption(options, "bearer-token") ?? process.env.MEMORY_BEARER_TOKEN ?? bearerFromAuthEnv(authEnvName, authEnvValue);
  const apiKey = bearer ? undefined : stringOption(options, "api-key") ?? apiKeyFromAuthEnv(authEnvName, authEnvValue) ?? process.env.MEMORY_API_KEY ?? process.env.COGNIBRAIN_API_KEY ?? process.env.COGNIBRAIN_API_TOKEN;
  return cleanHeaders({
    authorization: bearer ? `Bearer ${bearer}` : undefined,
    "x-api-key": apiKey,
    "x-actor-id": process.env.MEMORY_ACTOR_ID ?? process.env.COGNIBRAIN_ACTOR_ID
  });
}

export async function autostartDaemon(options) {
  const lockPath = join(options.runtimeRoot, ".cognibrain", options.lockName ?? "daemon-start.lock");
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockFd;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch {
    if (options.waitOnLockedMs) await sleep(options.waitOnLockedMs);
    return false;
  }
  try {
    writeFileSync(lockFd, `${process.pid}\n`);
    spawnSync(process.execPath, [join(options.root, "bin", "cognibrain.mjs"), "--runtime-root", options.runtimeRoot, "start"], {
      cwd: options.cwd ?? options.root,
      env: sanitizedRuntimeEnv(),
      stdio: options.stdio ?? "ignore",
      encoding: options.encoding,
      maxBuffer: options.maxBuffer,
      timeout: options.timeoutMs
    });
    return true;
  } finally {
    if (lockFd !== undefined) closeSync(lockFd);
    rmSync(lockPath, { force: true });
  }
}

export function stripSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function cleanHeaders(headers) {
  const entries = Object.entries(headers).filter(([, value]) => value !== undefined && value !== "");
  return entries.length ? Object.fromEntries(entries) : {};
}

function bearerFromAuthEnv(name, value) {
  if (!name || !value) return undefined;
  return /BEARER|JWT/i.test(name) ? value : undefined;
}

function apiKeyFromAuthEnv(name, value) {
  if (!name || !value) return undefined;
  return /BEARER|JWT/i.test(name) ? undefined : value;
}

function stringOption(options, name) {
  const value = options?.values?.get(name);
  return Array.isArray(value) ? value[value.length - 1] : value;
}

function readJson(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { body: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
