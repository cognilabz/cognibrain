import { createHmac, createPublicKey, createVerify, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { relationTypeSchema } from "../serverSchemas";
import type { AuthResult, AuthStatusReport } from "../server";
import type { DreamCycleReport, ExtractionReport, HarnessLifecycleEventReport, Memory } from "../../core";

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const requestAuth = new WeakMap<IncomingMessage, AuthResult>();

export function rememberRequestAuth(request: IncomingMessage, auth: AuthResult): void {
  requestAuth.set(request, auth);
}

export class PayloadTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
  }
}

export class ActorScopeError extends Error {}

export function json(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    const limit = requestBodyLimitBytes();
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(new PayloadTooLargeError(limit));
      }
    });
    request.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const violation = actorScopeViolation(requestAuth.get(request)?.statusReport, parsed);
        if (violation) reject(new ActorScopeError(violation));
        else resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

export function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  setCommonHeaders(response);
  if (status === 204 || payload === null) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload, null, 2));
}

export function sendText(response: ServerResponse, status: number, payload: string, contentType = "text/plain"): void {
  response.statusCode = status;
  setCommonHeaders(response);
  response.setHeader("Content-Type", contentType);
  response.end(payload);
}

export function applyRequestHeaders(request: IncomingMessage, response: ServerResponse): void {
  response.setHeader("X-Request-ID", request.headers["x-request-id"]?.toString() || randomUUID());
  applyCors(request, response);
}

export function setCommonHeaders(response: ServerResponse): void {
  if (!response.hasHeader("Access-Control-Allow-Origin")) response.setHeader("Access-Control-Allow-Origin", corsDefaultOrigin());
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-api-key, x-actor-id, x-request-id");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

export function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin?.toString();
  const allowed = configuredCorsOrigins();
  if (!origin) {
    response.setHeader("Access-Control-Allow-Origin", corsDefaultOrigin());
    return;
  }
  if (!allowed.length || allowed.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", allowed.length ? origin : corsDefaultOrigin());
    response.setHeader("Vary", "Origin");
    return;
  }
  response.setHeader("Access-Control-Allow-Origin", "null");
}

export function corsDefaultOrigin(): string {
  const allowed = configuredCorsOrigins();
  return allowed[0] ?? (productionMode() ? "null" : String.fromCharCode(42));
}

export function configuredCorsOrigins(): string[] {
  return (process.env.MEMORY_CORS_ORIGINS ?? process.env.COGNIBRAIN_CORS_ORIGINS ?? process.env.MEMORY_ALLOWED_ORIGINS ?? process.env.COGNIBRAIN_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function checkRateLimit(request: IncomingMessage): { allowed: boolean; resetAt: number } {
  const max = Number(process.env.MEMORY_RATE_LIMIT_MAX ?? (productionMode() ? 120 : 0));
  if (!max) return { allowed: true, resetAt: Date.now() };
  const windowMs = Number(process.env.MEMORY_RATE_LIMIT_WINDOW_MS ?? 60_000);
  const key = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || request.socket.remoteAddress || "local";
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }
  current.count += 1;
  return { allowed: current.count <= max, resetAt: current.resetAt };
}

export function requestBodyLimitBytes(): number {
  return Number(process.env.MEMORY_REQUEST_BODY_LIMIT_BYTES ?? (productionMode() ? 1_048_576 : 10_485_760));
}

export function productionMode(): boolean {
  return process.env.MEMORY_SECURITY_MODE === "production"
    || process.env.COGNIBRAIN_SECURITY_MODE === "production"
    || process.env.MEMORY_PRODUCTION_MODE === "true"
    || process.env.COGNIBRAIN_PRODUCTION_MODE === "true";
}

export function authenticate(request: IncomingMessage, pathname: string): AuthResult {
  const configured = configuredApiKeys();
  const jwtConfigured = jwtVerifierConfigured();
  const requiresAuth = process.env.MEMORY_REQUIRE_AUTH === "true" || configured.length > 0 || jwtConfigured || productionMode();
  const statusReport = requiresAuth
    ? { mode: jwtConfigured ? "jwt-oidc" as const : "api-key" as const, protected: true, actorId: request.headers["x-actor-id"]?.toString() }
    : { mode: "open-local-dev" as const, protected: false, warning: "API authentication is disabled for local development. Set MEMORY_API_KEYS or MEMORY_REQUIRE_AUTH=true before exposing this server." };
  if (!requiresAuth || pathname === "/health") return { allowed: true, status: 200, statusReport };
  const token = request.headers["x-api-key"]?.toString() ?? bearerToken(request.headers.authorization);
  if (!token) return { allowed: false, status: 401, error: "API key required", code: "auth_required", statusReport };
  if (jwtConfigured && bearerToken(request.headers.authorization)) {
    const verified = verifyJwt(token);
    if (!verified.valid) return { allowed: false, status: 403, error: verified.error ?? "Invalid JWT", code: "jwt_invalid", statusReport };
    return {
      allowed: true,
      status: 200,
      statusReport: {
        mode: "jwt-oidc",
        protected: true,
        actorId: verified.actorId,
        userId: verified.userId,
        orgId: verified.orgId,
        projectId: verified.projectId,
        scopes: verified.scopes
      }
    };
  }
  if (!configured.length) return { allowed: false, status: 403, error: "No API keys or JWT verifier are configured", code: "auth_not_configured", statusReport };
  if (!configured.some((key) => secureEqual(key, token))) return { allowed: false, status: 403, error: "Invalid API key", code: "auth_invalid", statusReport };
  return { allowed: true, status: 200, statusReport: { ...statusReport, actorId: request.headers["x-actor-id"]?.toString() ?? "api-key" } };
}

export function configuredApiKeys(): string[] {
  return (process.env.MEMORY_API_KEYS ?? process.env.MEMORY_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export function bearerToken(header?: string): string | undefined {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function jwtVerifierConfigured(): boolean {
  return Boolean((process.env.MEMORY_JWT_ISSUER || process.env.MEMORY_TENANT_AUTH_CONFIG) && (process.env.MEMORY_JWT_AUDIENCE || process.env.MEMORY_TENANT_AUTH_CONFIG) && (process.env.MEMORY_JWT_HS256_SECRET || process.env.MEMORY_JWT_PUBLIC_KEY || process.env.MEMORY_JWT_PUBLIC_KEY_BASE64 || process.env.MEMORY_JWKS_JSON || process.env.MEMORY_JWKS_PATH || process.env.MEMORY_JWKS_URL));
}

export function verifyJwt(token: string): { valid: boolean; error?: string; actorId?: string; userId?: string; orgId?: string; projectId?: string; scopes?: string[] } {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, error: "JWT must have three segments" };
  const [encodedHeader, encodedPayload, signature] = parts;
  let header: { alg?: string; typ?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as { alg?: string; typ?: string };
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as Record<string, unknown>;
  } catch {
    return { valid: false, error: "JWT header or payload is not valid JSON" };
  }
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBytes = base64UrlDecode(signature);
  const verified = header.alg === "HS256"
    ? verifyHs256(signingInput, signatureBytes)
    : header.alg === "RS256"
      ? verifyRs256(signingInput, signatureBytes, header.kid)
      : false;
  if (!verified) return { valid: false, error: `Unsupported or invalid JWT signature (${header.alg ?? "missing alg"})` };
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) return { valid: false, error: "JWT expired" };
  if (typeof payload.nbf === "number" && payload.nbf > now) return { valid: false, error: "JWT not active yet" };
  const tenantConfig = tenantAuthConfig(payload);
  const allowedIssuers = tenantConfig?.allowedIssuers ?? splitEnv(process.env.MEMORY_JWT_ISSUERS) ?? (process.env.MEMORY_JWT_ISSUER ? [process.env.MEMORY_JWT_ISSUER] : undefined);
  if (allowedIssuers?.length && !allowedIssuers.includes(String(payload.iss ?? ""))) return { valid: false, error: "JWT issuer mismatch" };
  const expectedAudience = tenantConfig?.allowedAudiences?.[0] ?? process.env.MEMORY_JWT_AUDIENCE;
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud.map(String) : typeof aud === "string" ? [aud] : [];
  const allowedAudiences = tenantConfig?.allowedAudiences ?? (expectedAudience ? [expectedAudience] : undefined);
  if (allowedAudiences?.length && !audiences.some((item) => allowedAudiences.includes(item))) return { valid: false, error: "JWT audience mismatch" };
  const userId = stringClaim(payload, "userId") ?? stringClaim(payload, "sub");
  const projectId = stringClaim(payload, "projectId") ?? stringClaim(payload, "project_id");
  if (tenantConfig?.allowedProjects?.length && projectId && !tenantConfig.allowedProjects.includes(projectId)) return { valid: false, error: "JWT project mismatch" };
  const scopes = [...new Set([...jwtScopes(payload), ...roleToScopes(payload)])];
  return {
    valid: true,
    actorId: stringClaim(payload, "actorId") ?? userId,
    userId,
    orgId: stringClaim(payload, "orgId") ?? stringClaim(payload, "org_id"),
    projectId,
    scopes
  };
}

export function verifyHs256(signingInput: string, signature: Buffer): boolean {
  const secret = process.env.MEMORY_JWT_HS256_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  return buffersEqual(expected, signature);
}

export function verifyRs256(signingInput: string, signature: Buffer, kid?: string): boolean {
  const key = jwtPublicKey(kid);
  if (!key) return false;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(key, signature);
}

type JwksKey = Record<string, unknown> & { kid?: string };

export function jwtPublicKey(kid?: string): string | ReturnType<typeof createPublicKey> | undefined {
  const direct = process.env.MEMORY_JWT_PUBLIC_KEY ?? (process.env.MEMORY_JWT_PUBLIC_KEY_BASE64 ? Buffer.from(process.env.MEMORY_JWT_PUBLIC_KEY_BASE64, "base64").toString("utf8") : undefined);
  if (direct) return direct;
  const jwks = loadJwks();
  if (!jwks?.keys?.length) return undefined;
  const selected = kid ? jwks.keys.find((key) => key.kid === kid) : jwks.keys[0];
  if (!selected) return undefined;
  try {
    return createPublicKey({ key: selected as never, format: "jwk" });
  } catch {
    return undefined;
  }
}

export function loadJwks(): { keys: JwksKey[] } | undefined {
  const jwksUrl = process.env.MEMORY_JWKS_URL;
  const raw = process.env.MEMORY_JWKS_JSON
    ?? (process.env.MEMORY_JWKS_PATH ? readFileSync(process.env.MEMORY_JWKS_PATH, "utf8") : undefined)
    ?? (jwksUrl ? loadJwksFromDiscoveryUrl(jwksUrl) : undefined);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { keys?: JwksKey[] };
    return { keys: Array.isArray(parsed.keys) ? parsed.keys : [] };
  } catch {
    return undefined;
  }
}

export function loadJwksFromDiscoveryUrl(jwksUrl: string): string | undefined {
  const cachePath = process.env.MEMORY_JWKS_CACHE_PATH;
  const maxAgeMs = Number(process.env.MEMORY_JWKS_CACHE_MAX_AGE_MS ?? 5 * 60_000);
  if (cachePath && existsSync(cachePath)) {
    const stat = JSON.parse(readFileSync(cachePath, "utf8")) as { fetchedAt?: number; body?: string };
    if (stat.body && stat.fetchedAt && Date.now() - stat.fetchedAt < maxAgeMs) return stat.body;
  }
  const body = execFileSync(process.execPath, ["-e", JWKS_DISCOVERY_WORKER], {
    input: JSON.stringify({ jwksUrl }),
    encoding: "utf8",
    timeout: Number(process.env.MEMORY_JWKS_FETCH_TIMEOUT_MS ?? 5_000),
    maxBuffer: 1_000_000
  });
  if (cachePath) writeFileSync(cachePath, JSON.stringify({ fetchedAt: Date.now(), body }));
  return body;
}

export function tenantAuthConfig(payload: Record<string, unknown>): { allowedIssuers?: string[]; allowedAudiences?: string[]; allowedProjects?: string[] } | undefined {
  const raw = process.env.MEMORY_TENANT_AUTH_CONFIG;
  if (!raw) return undefined;
  const orgId = stringClaim(payload, "orgId") ?? stringClaim(payload, "org_id");
  try {
    const config = JSON.parse(raw) as Record<string, { allowedIssuers?: string[]; allowedAudiences?: string[]; allowedProjects?: string[] }>;
    return (orgId && config[orgId]) || config.default;
  } catch {
    return undefined;
  }
}

export function roleToScopes(payload: Record<string, unknown>): string[] {
  const rawRoles = payload.roles ?? payload.role;
  const roles = Array.isArray(rawRoles) ? rawRoles.map(String) : typeof rawRoles === "string" ? rawRoles.split(/\s+/) : [];
  const defaultMap: Record<string, string[]> = {
    reader: ["memory:read"],
    writer: ["memory:read", "memory:write"],
    operator: ["memory:read", "memory:write", "dream:write", "connector:read"],
    admin: ["memory:admin"],
    "connector-admin": ["connector:admin", "memory:read"],
    "security-admin": ["security:admin", "policy:admin"],
    "service-account": ["memory:read", "memory:write", "connector:write", "dream:write"]
  };
  let configured: Record<string, string[]> = {};
  try {
    configured = process.env.MEMORY_ROLE_SCOPE_MAP ? JSON.parse(process.env.MEMORY_ROLE_SCOPE_MAP) : {};
  } catch {
    configured = {};
  }
  return roles.flatMap((role) => configured[role] ?? defaultMap[role] ?? []);
}

function splitEnv(value?: string): string[] | undefined {
  const values = value?.split(",").map((item) => item.trim()).filter(Boolean);
  return values?.length ? values : undefined;
}

const JWKS_DISCOVERY_WORKER = `
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", async () => {
  const { jwksUrl } = JSON.parse(input || "{}");
  const response = await fetch(jwksUrl, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("JWKS discovery failed: " + response.status);
  process.stdout.write(await response.text());
}).catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;

export function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

export function buffersEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function secureEqual(a: string, b: string): boolean {
  return buffersEqual(Buffer.from(a), Buffer.from(b));
}

export function stringClaim(payload: Record<string, unknown>, key: string): string | undefined {
  return typeof payload[key] === "string" && payload[key] ? payload[key] : undefined;
}

export function jwtScopes(payload: Record<string, unknown>): string[] {
  const raw = payload.scope ?? payload.scp ?? payload.scopes;
  if (typeof raw === "string") return raw.split(/\s+/).filter(Boolean);
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

export function authorizeRoute(method: string, pathname: string, auth: AuthStatusReport): { allowed: boolean; reason?: string } {
  if (auth.mode !== "jwt-oidc") return { allowed: true };
  const scopes = new Set(auth.scopes ?? []);
  if (scopes.has("admin") || scopes.has("memory:admin")) return { allowed: true };
  const permission = routePermission(method, pathname);
  if (!permission) return { allowed: true };
  const accepted = [permission.scope, ...permission.legacyScopes];
  if (accepted.some((scope) => scopes.has(scope))) return { allowed: true };
  return { allowed: false, reason: `Missing required scope: ${permission.scope}` };
}

export type ResourceAuthorizationTarget = {
  resource?: RoutePermission["resource"];
  action?: RoutePermission["action"];
  path?: string;
  userId?: string;
  orgId?: string;
  projectId?: string;
  connectorId?: string;
  memoryId?: string;
  contextPackId?: string;
  evidencePackId?: string;
  dreamJobId?: string;
  found?: boolean;
  lookupReason?: string;
};

export function authorizeResource(auth: AuthStatusReport, action: RoutePermission["action"], resource: ResourceAuthorizationTarget): { allowed: boolean; reason?: string } {
  if (auth.mode !== "jwt-oidc") return { allowed: true };
  if (auth.scopes?.some((scope) => scope === "admin" || scope === "memory:admin" || scope === "memory:all")) return { allowed: true };
  const denied = scopedResourceViolation(auth, resource);
  if (denied) return { allowed: false, reason: denied };
  const resourceName = resource.resource ?? "memory";
  const scopedPermission = `${resourceName}:${action}`;
  if (auth.scopes?.some((scope) => scope === scopedPermission || scope === `${resourceName}:admin`)) return { allowed: true };
  return { allowed: true };
}

export function routeScope(method: string, pathname: string): string | undefined {
  return routePermission(method, pathname)?.scope;
}

export type RoutePermission = {
  scope: string;
  resource: "memory" | "graph" | "connector" | "dream" | "policy" | "security" | "ops" | "platform";
  action: "read" | "write" | "admin";
  legacyScopes: string[];
};

export function routePermission(method: string, pathname: string): RoutePermission | undefined {
  if (pathname === "/health" || pathname === "/auth/status" || pathname === "/openapi.json" || pathname === "/sdk/openapi") return undefined;
  const action: RoutePermission["action"] = adminRoute(pathname) ? "admin" : method === "GET" ? "read" : "write";
  const resource = routeResource(pathname);
  const legacyScopes = action === "admin"
    ? ["memory:admin"]
    : action === "read"
      ? ["memory:read"]
      : ["memory:write"];
  return {
    scope: `${resource}:${action}`,
    resource,
    action,
    legacyScopes
  };
}

function adminRoute(pathname: string): boolean {
  return [
    "/policy",
    "/retention",
    "/security",
    "/privacy",
    "/compliance",
    "/managed",
    "/migration",
    "/backup"
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function routeResource(pathname: string): RoutePermission["resource"] {
  if (pathname.startsWith("/graph") || pathname.startsWith("/entities")) return "graph";
  if (pathname.startsWith("/connectors")) return "connector";
  if (pathname.startsWith("/dream") || pathname.startsWith("/reflection") || pathname.startsWith("/harness") || pathname.startsWith("/verification") || pathname.startsWith("/sources/revalidate") || pathname.startsWith("/maintenance/dream-due")) return "dream";
  if (pathname.startsWith("/policy") || pathname.startsWith("/retention")) return "policy";
  if (pathname.startsWith("/security") || pathname.startsWith("/privacy") || pathname.startsWith("/compliance")) return "security";
  if (pathname.startsWith("/storage") || pathname.startsWith("/providers") || pathname.startsWith("/metrics") || pathname.startsWith("/maintenance") || pathname.startsWith("/translate") || pathname.startsWith("/migration") || pathname.startsWith("/backup")) return "ops";
  if (pathname.startsWith("/managed") || pathname.startsWith("/marketplace") || pathname.startsWith("/brains") || pathname.startsWith("/sources") || pathname.startsWith("/agents") || pathname.startsWith("/personas") || pathname.startsWith("/events") || pathname.startsWith("/audit") || pathname.startsWith("/webhooks") || pathname.startsWith("/benchmarks")) return "platform";
  return "memory";
}

export function actorScopeViolation(auth: AuthStatusReport | undefined, value: unknown): string | undefined {
  if (!auth || auth.mode !== "jwt-oidc") return undefined;
  if (auth.scopes?.some((scope) => scope === "admin" || scope === "memory:admin" || scope === "memory:all")) return undefined;
  if (!value || typeof value !== "object") return undefined;
  return scopedResourceViolation(auth, value as Record<string, unknown>);
}

function scopedResourceViolation(auth: AuthStatusReport, body: Record<string, unknown>): string | undefined {
  for (const observed of collectScopedValues(body)) {
    const expected = auth[observed.authKey];
    if (expected && observed.value && observed.value !== expected) return `${observed.key} must match authenticated actor scope`;
  }
  return undefined;
}

export function collectScopedValues(value: unknown, seen = new Set<unknown>()): Array<{ key: string; authKey: keyof AuthStatusReport; value: string }> {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  const out: Array<{ key: string; authKey: keyof AuthStatusReport; value: string }> = [];
  if (Array.isArray(value)) {
    for (const item of value) out.push(...collectScopedValues(item, seen));
    return out;
  }
  const body = value as Record<string, unknown>;
  const checks: Array<[keyof AuthStatusReport, string]> = [["userId", "userId"], ["orgId", "orgId"], ["projectId", "projectId"]];
  for (const [authKey, bodyKey] of checks) {
    const observed = body[bodyKey];
    if (typeof observed === "string") out.push({ key: bodyKey, authKey, value: observed });
  }
  for (const nested of Object.values(body)) out.push(...collectScopedValues(nested, seen));
  return out;
}

export function parseRelationTypes(value: string | null): z.infer<typeof relationTypeSchema>[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((item) => relationTypeSchema.parse(item.trim())).filter(Boolean);
}

export function sourceKind(value: string | null): "human" | "reviewed_code" | "tool" | "agent" | "transcript" | "import" | undefined {
  return value === "human" || value === "reviewed_code" || value === "tool" || value === "agent" || value === "transcript" || value === "import" ? value : undefined;
}

export function serialize(value: Memory) {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    lastAccessedAt: value.lastAccessedAt?.toISOString(),
    archivedAt: value.archivedAt?.toISOString()
  };
}

export function serializeDreamCycleReport(report: DreamCycleReport) {
  return {
    created: report.created.map(serialize),
    demoted: report.demoted.map(serialize),
    contradictions: report.contradictions.map((item) => ({
      kept: serialize(item.kept),
      demoted: serialize(item.demoted),
      reason: item.reason
    })),
    lifecycle: report.lifecycle,
    dreamCycle: report.dreamCycle
  };
}

export function serializeHarnessLifecycleEvent(report: HarnessLifecycleEventReport) {
  return {
    eventMemory: serialize(report.eventMemory),
    actionMemory: report.actionMemory ? serialize(report.actionMemory) : undefined,
    dream: {
      plan: report.dream.plan,
      report: report.dream.report ? serializeDreamCycleReport(report.dream.report) : undefined
    }
  };
}

export function serializeExtractionReport(report: ExtractionReport) {
  return {
    memories: report.memories.map(serialize),
    entityLinks: report.entityLinks,
    stages: report.stages,
    failures: report.failures,
    claims: report.claims,
    durabilityDecisions: report.durabilityDecisions,
    enrichmentCandidates: report.enrichmentCandidates,
    learnedRules: report.learnedRules
  };
}
