import type { ConnectorSyncRecord } from "../../core";
import { vendorEnv, type FetchLike, type VendorFetchResult, type VendorPagedFetchResult } from "../vendorConfig";

export function githubRepo(): { owner: string; repo: string } {
  const full = process.env.MEMORY_GITHUB_REPO ?? process.env.GITHUB_REPOSITORY ?? "";
  const [owner, repo] = full.split("/");
  if (!owner || !repo) throw new Error("MEMORY_GITHUB_REPO must be owner/repo");
  return { owner, repo };
}

export function githubHeaders(): Record<string, string> {
  const token = vendorEnv(process.env, "MEMORY_GITHUB_TOKEN");
  return {
    accept: "application/vnd.github+json",
    "user-agent": "cognibrain-vendor-connector/0.1",
    "x-github-api-version": process.env.MEMORY_GITHUB_API_VERSION ?? "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

export function slackHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, "MEMORY_SLACK_TOKEN")}`,
    "content-type": "application/json; charset=utf-8",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function discordHeaders(): Record<string, string> {
  const raw = vendorEnv(process.env, "MEMORY_DISCORD_BOT_TOKEN") ?? "";
  const authorization = /^(Bot|Bearer)\s+/i.test(raw) ? raw : `Bot ${raw}`;
  return {
    authorization,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function atlassianHeaders(product: "jira" | "confluence"): Record<string, string> {
  const emailKey = product === "jira" ? "MEMORY_JIRA_EMAIL" : "MEMORY_CONFLUENCE_EMAIL";
  const tokenKey = product === "jira" ? "MEMORY_JIRA_API_TOKEN" : "MEMORY_CONFLUENCE_API_TOKEN";
  const email = vendorEnv(process.env, emailKey) ?? "";
  const token = vendorEnv(process.env, tokenKey) ?? "";
  return {
    accept: "application/json",
    authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function notionHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, "MEMORY_NOTION_TOKEN")}`,
    "content-type": "application/json",
    "notion-version": process.env.MEMORY_NOTION_VERSION ?? "2022-06-28",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function linearHeaders(): Record<string, string> {
  return {
    authorization: vendorEnv(process.env, "MEMORY_LINEAR_API_KEY") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function gitlabHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "private-token": vendorEnv(process.env, "MEMORY_GITLAB_TOKEN") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function azureDevOpsHeaders(): Record<string, string> {
  const token = vendorEnv(process.env, "MEMORY_AZURE_DEVOPS_TOKEN") ?? "";
  return {
    accept: "application/json",
    authorization: `Basic ${Buffer.from(`:${token}`).toString("base64")}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function bearerHeaders(tokenKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${vendorEnv(process.env, tokenKey) ?? ""}`,
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function clickUpHeaders(): Record<string, string> {
  return {
    authorization: vendorEnv(process.env, "MEMORY_CLICKUP_TOKEN") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}

export function datadogHeaders(): Record<string, string> {
  return {
    "dd-api-key": vendorEnv(process.env, "MEMORY_DATADOG_API_KEY") ?? "",
    "dd-application-key": vendorEnv(process.env, "MEMORY_DATADOG_APP_KEY") ?? "",
    "content-type": "application/json",
    "user-agent": "cognibrain-vendor-connector/0.1"
  };
}


export function requestShape(method: "GET" | "POST" | "PUT" | "PATCH", url: string, headers: Record<string, string>, body = ""): NonNullable<ConnectorSyncRecord["request"]> {
  return { method, url, headers, body };
}

export function recordRequest(request: NonNullable<ConnectorSyncRecord["request"]>): NonNullable<ConnectorSyncRecord["request"]> {
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower.includes("token") || lower.includes("secret") || lower.includes("key")) return [key, "<redacted>"];
    return [key, value];
  }));
  return { ...request, headers };
}

export async function fetchJson<T>(request: NonNullable<ConnectorSyncRecord["request"]>, fetchImpl: FetchLike, timeoutMs: number): Promise<VendorFetchResult<T>> {
  const maxAttempts = Math.max(1, Number(process.env.MEMORY_VENDOR_RETRY_ATTEMPTS ?? 3));
  let rateLimitRetries = 0;
  let lastError = "vendor request failed";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" ? undefined : request.body,
        signal: AbortSignal.timeout(Math.max(1, timeoutMs))
      });
      const headers = responseHeaders(response);
      const json = await response.json().catch(() => undefined) as T | undefined;
      if (retryableStatus(response.status) && attempt < maxAttempts) {
        rateLimitRetries += response.status === 429 ? 1 : 0;
        await sleep(retryDelayMs(headers["retry-after"], attempt));
        continue;
      }
      return { ok: response.ok, status: response.status, json, headers, attempts: attempt, rateLimitRetries, error: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "vendor request failed";
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs(undefined, attempt));
        continue;
      }
      return { ok: false, status: 0, headers: {}, attempts: attempt, rateLimitRetries, error: lastError };
    }
  }
  return { ok: false, status: 0, headers: {}, attempts: maxAttempts, rateLimitRetries, error: lastError };
}

export async function fetchPagedJson<TItem, TJson>(
  initialRequest: NonNullable<ConnectorSyncRecord["request"]>,
  fetchImpl: FetchLike,
  timeoutMs: number,
  options: {
    items: (json: TJson | undefined) => TItem[];
    nextPage: (result: VendorFetchResult<TJson>, request: NonNullable<ConnectorSyncRecord["request"]>, pageIndex: number) => string | undefined;
  }
): Promise<VendorPagedFetchResult<TItem, TJson>> {
  const maxPages = Math.max(1, Number(process.env.MEMORY_VENDOR_MAX_PAGES ?? 5));
  const items: TItem[] = [];
  const requests: Array<NonNullable<ConnectorSyncRecord["request"]>> = [];
  let current = initialRequest;
  let last: VendorFetchResult<TJson> = { ok: false, status: 0, headers: {}, attempts: 0, rateLimitRetries: 0, error: "not requested" };
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    requests.push(current);
    last = await fetchJson<TJson>(current, fetchImpl, timeoutMs);
    if (!last.ok) break;
    items.push(...options.items(last.json));
    const next = options.nextPage(last, current, pageIndex);
    if (!next) break;
    current = { ...current, url: next };
  }
  return { ...last, items, pageCount: requests.length, requests };
}

export function apiUrl(base: string, path: string, query: Record<string, string | undefined> = {}): string {
  const url = new URL(`${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") url.searchParams.set(key, value);
  return url.toString();
}

export function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

export function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function retryDelayMs(retryAfter: string | undefined, attempt: number): number {
  if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter)) return Math.min(2_000, Math.max(0, Number(retryAfter) * 1000));
  if (retryAfter) {
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(2_000, Math.max(0, date - Date.now()));
  }
  return Math.min(2_000, 100 * 2 ** Math.max(0, attempt - 1));
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nextLink(headers: Record<string, string>): string | undefined {
  const link = headers.link;
  if (!link) return undefined;
  const segment = link.split(",").find((part) => /\brel="?next"?/i.test(part));
  const match = segment?.match(/<([^>]+)>/);
  return match?.[1];
}

export function discordJumpUrl(message: Record<string, unknown>, channel: string): string | undefined {
  const guildId = message.guild_id ?? "@me";
  const id = message.id;
  return id ? `https://discord.com/channels/${guildId}/${channel}/${id}` : undefined;
}

export function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(value: unknown, fallback: string | undefined): string {
  return typeof value === "string" && value.length ? value : fallback ?? "";
}
