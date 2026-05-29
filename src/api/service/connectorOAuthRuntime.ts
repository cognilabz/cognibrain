import { execFileSync } from "node:child_process";
import type { ConnectorAuthSession, ConnectorManifest } from "../../core";
import { contentHash } from "./helpers";

export interface TokenSecretStore {
  storeToken(input: { connectorId: string; tokenKind: "access" | "refresh"; tokenHash: string; expiresAt?: string }): { secretRef: string; tokenHash: string; expiresAt?: string };
  refreshToken(input: { connectorId: string; refreshTokenRef: string; refreshTokenHash?: string; manifest: ConnectorManifest }): { secretRef: string; tokenHash: string; expiresAt?: string; refreshSecretRef?: string; refreshTokenHash?: string };
  revokeToken(input: { connectorId: string; secretRef?: string; tokenHash?: string; manifest?: ConnectorManifest }): { revokedRef?: string; revokedHash?: string };
}

export class ReferenceOnlyTokenSecretStore implements TokenSecretStore {
  storeToken(input: { connectorId: string; tokenKind: "access" | "refresh"; tokenHash: string; expiresAt?: string }) {
    const secretRef = `secret://oauth/${input.connectorId}/${input.tokenKind}/${input.tokenHash.slice(0, 18)}`;
    return { secretRef, tokenHash: input.tokenHash, expiresAt: input.expiresAt };
  }

  refreshToken(input: { connectorId: string; refreshTokenRef: string; refreshTokenHash?: string; manifest: ConnectorManifest }) {
    const tokenHash = contentHash(`${input.connectorId}:${input.refreshTokenRef}:${Date.now()}`).slice(2);
    const refreshTokenHash = input.refreshTokenHash ?? contentHash(`${input.refreshTokenRef}:refresh`).slice(2);
    return {
      secretRef: `secret://oauth/${input.connectorId}/access/${tokenHash.slice(0, 18)}`,
      tokenHash,
      expiresAt: new Date(Date.now() + Number(process.env.MEMORY_OAUTH_REFRESH_EXPIRES_IN_MS ?? 3_600_000)).toISOString(),
      refreshSecretRef: input.refreshTokenRef,
      refreshTokenHash
    };
  }

  revokeToken(input: { connectorId: string; secretRef?: string; tokenHash?: string }) {
    return { revokedRef: input.secretRef, revokedHash: input.tokenHash };
  }
}

export function beginConnectorOAuth(service: any, connectorId: string, input: { redirectUri?: string; scopes?: string[]; stateSalt?: string } = {}): ConnectorAuthSession {
  const manifest = service.connectorManifests.get(connectorId);
  if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
  if (manifest.auth !== "oauth") throw new Error(`Connector ${connectorId} does not use OAuth`);
  if (!manifest.oauth?.authorizeUrl) throw new Error(`Connector ${connectorId} is missing oauth.authorizeUrl`);
  const now = new Date().toISOString();
  const redirectUri = input.redirectUri ?? manifest.oauth.redirectUri;
  const scopes = input.scopes ?? manifest.oauth.scopes ?? [];
  const state = contentHash(`${connectorId}:${now}:${input.stateSalt ?? ""}`).slice(2, 26);
  const authorizeUrl = new URL(manifest.oauth.authorizeUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", resolveSecretRef(manifest.oauth.clientIdRef) ?? manifest.oauth.clientIdRef ?? `${connectorId}-client`);
  authorizeUrl.searchParams.set("state", state);
  if (redirectUri) authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  if (scopes.length) authorizeUrl.searchParams.set("scope", scopes.join(" "));
  const session: ConnectorAuthSession = {
    id: `auth_${contentHash(`${connectorId}:${state}`).slice(2, 14)}`,
    connectorId,
    state,
    status: "pending",
    authorizeUrl: authorizeUrl.toString(),
    redirectUri,
    scopes,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
  };
  service.connectorAuthSessions.set(session.id, session);
  service.recordAudit("connector.auth", { metadata: { connectorId, sessionId: session.id, status: session.status, scopes } });
  service.persist();
  return session;
}

export function completeConnectorOAuth(service: any, input: { connectorId: string; state: string; code?: string; tokenRef?: string; error?: string }): ConnectorAuthSession {
  const session = [...service.connectorAuthSessions.values()].find((item) => item.connectorId === input.connectorId && item.state === input.state);
  if (!session) throw new Error(`OAuth session not found for connector ${input.connectorId}`);
  const now = new Date().toISOString();
  const manifest = service.connectorManifests.get(input.connectorId);
  const exchanged = !input.error && !input.tokenRef && input.code && manifest?.oauth?.tokenUrl && manifest.oauth.clientSecretRef
    ? exchangeOAuthCode(manifest, session, input.code)
    : undefined;
  const accessSecret = exchanged ? tokenSecretStore(service).storeToken({ connectorId: input.connectorId, tokenKind: "access", tokenHash: exchanged.tokenHash, expiresAt: exchanged.accessTokenExpiresAt }) : undefined;
  const refreshSecret = exchanged?.refreshTokenHash ? tokenSecretStore(service).storeToken({ connectorId: input.connectorId, tokenKind: "refresh", tokenHash: exchanged.refreshTokenHash }) : undefined;
  const tokenRef = input.tokenRef ?? accessSecret?.secretRef ?? (input.code ? `oauth://${input.connectorId}/${contentHash(input.code).slice(2, 12)}` : undefined);
  const updated: ConnectorAuthSession = {
    ...session,
    status: input.error ? "failed" : "authorized",
    tokenRef,
    refreshTokenRef: refreshSecret?.secretRef,
    tokenHash: accessSecret?.tokenHash ?? exchanged?.tokenHash ?? (input.code || tokenRef ? contentHash(`${input.code ?? ""}:${tokenRef ?? ""}`).slice(2) : undefined),
    refreshTokenHash: refreshSecret?.tokenHash ?? exchanged?.refreshTokenHash,
    accessTokenExpiresAt: accessSecret?.expiresAt ?? exchanged?.accessTokenExpiresAt,
    error: input.error,
    updatedAt: now
  };
  service.connectorAuthSessions.set(session.id, updated);
  if (manifest && updated.status === "authorized" && tokenRef) {
    service.connectorManifests.set(manifest.id, {
      ...manifest,
      updatedAt: now,
      list: manifest.list ? { ...manifest.list, authRef: manifest.list.authRef ?? tokenRef } : manifest.list,
      poll: manifest.poll ? { ...manifest.poll, authRef: manifest.poll.authRef ?? tokenRef } : manifest.poll,
      writeback: manifest.writeback ? { ...manifest.writeback, authRef: manifest.writeback.authRef ?? tokenRef } : manifest.writeback
    });
  }
  service.recordAudit("connector.auth", { metadata: { connectorId: input.connectorId, sessionId: session.id, status: updated.status, tokenRef: updated.tokenRef } });
  service.persist();
  return updated;
}

export function revokeConnectorAuth(service: any, connectorId: string, actorId = "system"): ConnectorAuthSession[] {
  const now = new Date().toISOString();
  const revoked: ConnectorAuthSession[] = [];
  for (const session of service.connectorAuthSessions.values()) {
    if (session.connectorId !== connectorId || session.status === "revoked") continue;
    const manifest = service.connectorManifests.get(connectorId);
    const accessRevoke = tokenSecretStore(service).revokeToken({ connectorId, secretRef: session.tokenRef, tokenHash: session.tokenHash, manifest });
    const refreshRevoke = tokenSecretStore(service).revokeToken({ connectorId, secretRef: session.refreshTokenRef, tokenHash: session.refreshTokenHash, manifest });
    const updated: ConnectorAuthSession = {
      ...session,
      status: "revoked",
      tokenRef: undefined,
      refreshTokenRef: undefined,
      revokedAt: now,
      updatedAt: now,
      error: undefined,
      metadata: { ...(session.metadata ?? {}), revokedRefs: [accessRevoke.revokedRef, refreshRevoke.revokedRef].filter(Boolean) }
    };
    service.connectorAuthSessions.set(session.id, updated);
    revoked.push(updated);
  }
  const manifest = service.connectorManifests.get(connectorId);
  if (manifest) {
    service.connectorManifests.set(connectorId, {
      ...manifest,
      updatedAt: now,
      list: manifest.list ? { ...manifest.list, authRef: undefined } : manifest.list,
      poll: manifest.poll ? { ...manifest.poll, authRef: undefined } : manifest.poll,
      writeback: manifest.writeback ? { ...manifest.writeback, authRef: undefined } : manifest.writeback
    });
  }
  service.recordAudit("connector.auth", { actorId, metadata: { connectorId, status: "revoked", sessions: revoked.length } });
  service.persist();
  return revoked;
}

export function refreshConnectorOAuth(service: any, connectorId: string): ConnectorAuthSession {
  const manifest = service.connectorManifests.get(connectorId);
  if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
  const session = [...service.connectorAuthSessions.values()]
    .filter((item: ConnectorAuthSession) => item.connectorId === connectorId && item.status === "authorized" && item.refreshTokenRef)
    .sort((a: ConnectorAuthSession, b: ConnectorAuthSession) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (!session) throw new Error(`No refreshable OAuth session for connector ${connectorId}`);
  const refreshed = tokenSecretStore(service).refreshToken({ connectorId, refreshTokenRef: session.refreshTokenRef!, refreshTokenHash: session.refreshTokenHash, manifest });
  const now = new Date().toISOString();
  const updated: ConnectorAuthSession = {
    ...session,
    tokenRef: refreshed.secretRef,
    tokenHash: refreshed.tokenHash,
    refreshTokenRef: refreshed.refreshSecretRef ?? session.refreshTokenRef,
    refreshTokenHash: refreshed.refreshTokenHash ?? session.refreshTokenHash,
    accessTokenExpiresAt: refreshed.expiresAt,
    updatedAt: now,
    metadata: { ...(session.metadata ?? {}), secretRef: refreshed.secretRef, refreshedAt: now }
  };
  service.connectorAuthSessions.set(session.id, updated);
  service.recordAudit("connector.auth", { metadata: { connectorId, sessionId: session.id, status: "refreshed", secretRef: updated.tokenRef } });
  service.persist();
  return updated;
}

export function connectorAuthStatus(service: any, connectorId?: string): ConnectorAuthSession[] {
  return [...service.connectorAuthSessions.values()]
    .filter((session) => !connectorId || session.connectorId === connectorId)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function tokenSecretStore(service: any): TokenSecretStore {
  return service.tokenSecretStore ?? new ReferenceOnlyTokenSecretStore();
}

function exchangeOAuthCode(manifest: ConnectorManifest, session: ConnectorAuthSession, code: string): {
  tokenRef: string;
  refreshTokenRef?: string;
  tokenHash: string;
  refreshTokenHash?: string;
  accessTokenExpiresAt?: string;
} {
  if (!manifest.oauth?.tokenUrl) throw new Error(`Connector ${manifest.id} is missing oauth.tokenUrl`);
  const clientId = resolveSecretRef(manifest.oauth.clientIdRef) ?? manifest.oauth.clientIdRef;
  const clientSecret = resolveSecretRef(manifest.oauth.clientSecretRef);
  if (!clientSecret) throw new Error(`Connector ${manifest.id} is missing resolvable oauth.clientSecretRef`);
  const exchange = JSON.parse(execFileSync(process.execPath, ["-e", OAUTH_EXCHANGE_WORKER], {
    encoding: "utf8",
    input: JSON.stringify({
      tokenUrl: manifest.oauth.tokenUrl,
      code,
      redirectUri: session.redirectUri,
      clientId,
      clientSecret
    }),
    timeout: Number(process.env.MEMORY_OAUTH_EXCHANGE_TIMEOUT_MS ?? 10_000),
    maxBuffer: 1_000_000
  })) as { accessTokenHash: string; refreshTokenHash?: string; expiresIn?: number };
  const suffix = exchange.accessTokenHash.slice(0, 18);
  const refreshSuffix = exchange.refreshTokenHash?.slice(0, 18);
  return {
    tokenRef: `secret://oauth/${manifest.id}/access/${suffix}`,
    refreshTokenRef: refreshSuffix ? `secret://oauth/${manifest.id}/refresh/${refreshSuffix}` : undefined,
    tokenHash: exchange.accessTokenHash,
    refreshTokenHash: exchange.refreshTokenHash,
    accessTokenExpiresAt: exchange.expiresIn ? new Date(Date.now() + exchange.expiresIn * 1000).toISOString() : undefined
  };
}

function resolveSecretRef(ref?: string): string | undefined {
  if (!ref) return undefined;
  if (ref.startsWith("env:")) return process.env[ref.slice(4)];
  if (ref.startsWith("secret://")) {
    const envName = `MEMORY_SECRET_${ref.slice("secret://".length).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toUpperCase()}`;
    return process.env[envName];
  }
  return undefined;
}

const OAUTH_EXCHANGE_WORKER = `
const { createHash } = require("node:crypto");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", async () => {
  try {
    const request = JSON.parse(input || "{}");
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", request.code);
    if (request.redirectUri) body.set("redirect_uri", request.redirectUri);
    if (request.clientId) body.set("client_id", request.clientId);
    if (request.clientSecret) body.set("client_secret", request.clientSecret);
    const response = await fetch(request.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.error || "OAuth token exchange failed");
    const accessToken = payload.access_token;
    if (typeof accessToken !== "string" || !accessToken) throw new Error("OAuth token endpoint did not return access_token");
    const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
    process.stdout.write(JSON.stringify({
      accessTokenHash: hash(accessToken),
      refreshTokenHash: typeof payload.refresh_token === "string" && payload.refresh_token ? hash(payload.refresh_token) : undefined,
      expiresIn: Number.isFinite(Number(payload.expires_in)) ? Number(payload.expires_in) : undefined
    }));
  } catch (error) {
    process.stderr.write(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
});
`;
