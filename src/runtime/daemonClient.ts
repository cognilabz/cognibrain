import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { sanitizedRuntimeEnv } from "../core/runtimeEnv";

export type DaemonHttpRoute = {
  method: string;
  path: string;
  body?: unknown;
};

export type DaemonClientOptions = {
  root?: string;
  runtimeRoot?: string;
  baseUrl?: string;
  autostartEnv?: string;
  autostartLockName?: string;
  autostartTimeoutMs?: number;
  headers?: Record<string, string>;
};

export type DaemonRouteResolver = (operation: string, input?: unknown) => DaemonHttpRoute;

export class RuntimeDaemonClient {
  readonly root: string;
  readonly runtimeRoot: string;
  readonly autostartEnv: string;
  readonly autostartLockName: string;
  readonly autostartTimeoutMs: number;
  readonly headers: Record<string, string>;
  readonly routeResolver: DaemonRouteResolver;
  baseUrl: string;

  constructor(routeResolver: DaemonRouteResolver, options: DaemonClientOptions = {}) {
    this.root = resolve(options.root ?? process.cwd());
    this.runtimeRoot = resolve(options.runtimeRoot ?? process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? process.cwd());
    this.baseUrl = stripSlash(options.baseUrl ?? discoverDaemonUrl(this.runtimeRoot));
    this.autostartEnv = options.autostartEnv ?? "COGNIBRAIN_RUNTIME_AUTOSTART";
    this.autostartLockName = options.autostartLockName ?? "runtime-start.lock";
    this.autostartTimeoutMs = options.autostartTimeoutMs ?? 12_000;
    this.headers = options.headers ?? authHeadersFromEnv();
    this.routeResolver = routeResolver;
  }

  async call<TInput, TOutput>(operation: string, input?: TInput): Promise<TOutput> {
    const route = this.routeResolver(operation, input);
    await this.ensureReachable();
    return httpJson<TOutput>(route.method, `${this.baseUrl}${route.path}`, route.body, this.headers);
  }

  async health(input: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return this.call("health", input);
  }

  async ensureReachable(): Promise<void> {
    if (await this.isReachable()) return;
    if (process.env[this.autostartEnv] === "false") throw new Error(`cognibrain daemon unavailable at ${this.baseUrl}`);
    autostartDaemon({
      root: this.root,
      runtimeRoot: this.runtimeRoot,
      lockName: this.autostartLockName,
      timeoutMs: this.autostartTimeoutMs
    });
    this.baseUrl = stripSlash(discoverDaemonUrl(this.runtimeRoot));
    if (await this.isReachable()) return;
    throw new Error(`cognibrain daemon unavailable at ${this.baseUrl}`);
  }

  private async isReachable(): Promise<boolean> {
    try {
      const health = await httpJson<{ ok?: boolean }>("GET", `${this.baseUrl}/health`, undefined, this.headers, 800);
      return Boolean(health.ok);
    } catch {
      return false;
    }
  }
}

export function discoverDaemonUrl(runtimeRoot: string): string {
  const explicit = process.env.MEMORY_API_URL ?? process.env.COGNIBRAIN_API_URL ?? process.env.COGNIBRAIN_URL;
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

export function authHeadersFromEnv(): Record<string, string> {
  const bearer = process.env.MEMORY_BEARER_TOKEN;
  const apiKey = bearer ? undefined : process.env.MEMORY_API_KEY ?? process.env.COGNIBRAIN_API_KEY ?? process.env.COGNIBRAIN_API_TOKEN;
  return Object.fromEntries(Object.entries({
    authorization: bearer ? `Bearer ${bearer}` : undefined,
    "x-api-key": apiKey,
    "x-actor-id": process.env.MEMORY_ACTOR_ID ?? process.env.COGNIBRAIN_ACTOR_ID
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

export function queryString(input?: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      continue;
    }
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function httpJson<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}, timeoutMs = 4_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error ?? payload.message ?? `${url} returned ${response.status}`);
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function autostartDaemon(options: { root: string; runtimeRoot: string; lockName?: string; timeoutMs?: number }): void {
  const lockPath = join(options.runtimeRoot, ".cognibrain", options.lockName ?? "runtime-start.lock");
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockFd: number | undefined;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch {
    return;
  }
  try {
    writeFileSync(lockFd, `${process.pid}\n`);
    spawnSync(process.execPath, [join(options.root, "bin", "cognibrain.mjs"), "--runtime-root", options.runtimeRoot, "start"], {
      cwd: options.root,
      env: sanitizedRuntimeEnv(),
      stdio: "ignore",
      timeout: options.timeoutMs ?? 12_000
    });
  } finally {
    rmSync(lockPath, { force: true });
  }
}

export function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function readJson(path: string): any {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
