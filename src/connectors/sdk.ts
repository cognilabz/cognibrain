import type { ConnectorManifest, MemoryExtractionEvent, MemoryScope } from "../core";

export type ConnectorEventInput = Partial<MemoryExtractionEvent> & {
  content: string;
  externalId?: string;
  url?: string;
  author?: string;
  version?: string;
};

export interface ConnectorAdapter {
  list?(): Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
  poll?(cursor?: string): Promise<ConnectorEventInput[]> | ConnectorEventInput[];
  writeback?(input: Record<string, unknown>): Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface ConnectorRuntimeContext {
  manifest: ConnectorManifest;
  scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">;
}

export interface ConnectorWritebackPlan {
  connectorId: string;
  operation?: "tag" | "comment" | "status" | "summary" | "memory_link";
  payload: Record<string, unknown>;
  dryRun: boolean;
}

export type PlatformRecord = Record<string, unknown>;

export interface PlatformIntegrationConfig {
  provider: string;
  connectorId: string;
  envPrefix: string;
  baseUrlEnv: string;
  tokenEnv: string;
  settings: Record<string, string>;
}

export interface PlatformIntegrationOptions {
  id?: string;
  name: string;
  kind?: ConnectorManifest["kind"];
  version?: string;
  direction?: ConnectorManifest["direction"];
  capabilities?: ConnectorManifest["capabilities"];
  auth?: ConnectorManifest["auth"];
  defaultSourceKind?: ConnectorManifest["defaultSourceKind"];
  metadataMapping?: Record<string, string>;
  privacyPolicy?: ConnectorManifest["privacyPolicy"];
  envPrefix?: string;
  listEndpoint?: string;
  pollEndpoint?: string;
  writebackEndpoint?: string;
  writebackOperations?: NonNullable<ConnectorManifest["writeback"]>["operations"];
  oauth?: ConnectorManifest["oauth"];
}

export interface PlatformIntegrationHandlers<TRecord extends PlatformRecord = PlatformRecord> {
  list?(input: { config: PlatformIntegrationConfig }): Promise<TRecord[]> | TRecord[];
  poll?(input: { cursor?: string; config: PlatformIntegrationConfig }): Promise<Array<TRecord | ConnectorEventInput>> | Array<TRecord | ConnectorEventInput>;
  writeback?(input: { payload: Record<string, unknown>; dryRun: boolean; config: PlatformIntegrationConfig }): Promise<Record<string, unknown>> | Record<string, unknown>;
  health?(input: { config: PlatformIntegrationConfig }): Promise<Record<string, unknown>> | Record<string, unknown>;
  mapRecord?(record: TRecord): ConnectorEventInput;
}

export interface PlatformIntegration<TRecord extends PlatformRecord = PlatformRecord> {
  manifest: ConnectorManifest;
  config: PlatformIntegrationConfig;
  exampleConfig: PlatformIntegrationConfig;
  adapter: ConnectorAdapter;
  list(): Promise<TRecord[]>;
  poll(cursor?: string): Promise<ConnectorEventInput[]>;
  pollEvents(scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">, cursor?: string): Promise<MemoryExtractionEvent[]>;
  normalize(records: Array<TRecord | ConnectorEventInput>, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): MemoryExtractionEvent[];
  writeback(payload: Record<string, unknown>, dryRun?: boolean): Promise<Record<string, unknown>>;
  health(): Promise<Record<string, unknown>>;
}

export function createConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): ConnectorManifest {
  const now = new Date().toISOString();
  validateConnectorManifest(input);
  return {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

export function createPlatformIntegration<TRecord extends PlatformRecord = PlatformRecord>(
  options: PlatformIntegrationOptions,
  handlers: PlatformIntegrationHandlers<TRecord> = {}
): PlatformIntegration<TRecord> {
  const id = platformId(options.id ?? options.name);
  const envPrefix = options.envPrefix ?? `MEMORY_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const direction = options.direction ?? "two_way";
  const capabilities = options.capabilities ?? defaultCapabilities(direction);
  const manifest = createConnectorManifest({
    id,
    name: options.name,
    kind: options.kind ?? "custom",
    version: options.version ?? "1.0.0",
    direction,
    capabilities,
    auth: options.auth ?? "token",
    defaultSourceKind: options.defaultSourceKind ?? "import",
    metadataMapping: options.metadataMapping ?? {
      externalId: "externalId",
      url: "source.uri",
      author: "sourceRef.author",
      platform: "metadata.platform"
    },
    privacyPolicy: options.privacyPolicy ?? "project",
    list: options.listEndpoint ? { endpoint: options.listEndpoint, method: "GET", authRef: `env:${envPrefix}_TOKEN` } : undefined,
    poll: options.pollEndpoint ? { endpoint: options.pollEndpoint, method: "GET", authRef: `env:${envPrefix}_TOKEN` } : undefined,
    writeback: capabilities.includes("writeback")
      ? {
          endpoint: options.writebackEndpoint,
          method: "POST",
          authRef: `env:${envPrefix}_TOKEN`,
          operations: options.writebackOperations ?? ["comment", "summary", "memory_link"]
        }
      : undefined,
    oauth: options.oauth
  });
  const config: PlatformIntegrationConfig = {
    provider: id,
    connectorId: manifest.id,
    envPrefix,
    baseUrlEnv: `${envPrefix}_BASE_URL`,
    tokenEnv: `${envPrefix}_TOKEN`,
    settings: {
      baseUrl: `env:${envPrefix}_BASE_URL`,
      token: `env:${envPrefix}_TOKEN`
    }
  };
  const context = (scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">): ConnectorRuntimeContext => ({ manifest, scope });
  const toEventInput = (record: TRecord | ConnectorEventInput): ConnectorEventInput => {
    if (isConnectorEventInput(record)) return record;
    return handlers.mapRecord ? handlers.mapRecord(record as TRecord) : mapPlatformRecord(record as TRecord, { platform: id });
  };
  const integration: PlatformIntegration<TRecord> = {
    manifest,
    config,
    exampleConfig: config,
    adapter: {
      list: handlers.list ? () => handlers.list?.({ config }) ?? [] : undefined,
      poll: async (cursor?: string) => integration.poll(cursor),
      writeback: (payload: Record<string, unknown>) => integration.writeback(payload, true)
    },
    async list() {
      return (await handlers.list?.({ config })) ?? [];
    },
    async poll(cursor?: string) {
      const records = (await handlers.poll?.({ cursor, config })) ?? [];
      return records.map(toEventInput);
    },
    async pollEvents(scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">, cursor?: string) {
      return runConnectorPoll(integration.adapter, context(scope), cursor);
    },
    normalize(records: Array<TRecord | ConnectorEventInput>, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">) {
      return records.map((record) => normalizeConnectorEvent(toEventInput(record), context(scope)));
    },
    async writeback(payload: Record<string, unknown>, dryRun = true) {
      if (handlers.writeback) return handlers.writeback({ payload, dryRun, config });
      return createWritebackPlan(manifest, payload, dryRun) as unknown as Record<string, unknown>;
    },
    async health() {
      const custom = (await handlers.health?.({ config })) ?? {};
      return {
        ok: custom.ok ?? true,
        provider: id,
        connectorId: manifest.id,
        direction: manifest.direction,
        capabilities: manifest.capabilities,
        env: {
          baseUrl: `env:${config.baseUrlEnv}`,
          token: `env:${config.tokenEnv}`
        },
        ...custom
      };
    }
  };
  return integration;
}

export function normalizeConnectorEvent(input: ConnectorEventInput, context: ConnectorRuntimeContext): MemoryExtractionEvent {
  return {
    role: input.role ?? "tool",
    content: input.content,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source ?? { kind: "import", confidence: 0.9 },
    uri: input.uri ?? input.url,
    sourceRef: {
      connectorId: context.manifest.id,
      externalId: input.externalId,
      url: input.url,
      author: input.author,
      timestamp: input.timestamp ?? new Date().toISOString(),
      version: input.version
    },
    metadata: {
      connectorId: context.manifest.id,
      externalId: input.externalId,
      author: input.author,
      version: input.version,
      connectorKind: context.manifest.kind,
      privacyPolicy: context.manifest.privacyPolicy ?? "project",
      ...(input.metadata ?? {})
    }
  };
}

export function connectorAuthHeaders(manifest: ConnectorManifest, authRef?: string): Record<string, string> {
  if (manifest.auth === "none") return {};
  const tokenRef = authRef ?? manifest.list?.authRef ?? manifest.poll?.authRef ?? manifest.writeback?.authRef;
  if (!tokenRef) return {};
  if (manifest.auth === "api_key") return { "x-cognibrain-auth-ref": tokenRef };
  return { authorization: `Bearer ${tokenRef}` };
}

export function createWritebackPlan(manifest: ConnectorManifest, payload: Record<string, unknown>, dryRun = true): ConnectorWritebackPlan {
  if (!manifest.capabilities.includes("writeback")) throw new Error(`Connector ${manifest.id} does not support writeback`);
  return {
    connectorId: manifest.id,
    operation: manifest.writeback?.operations?.[0],
    payload,
    dryRun
  };
}

export async function runConnectorPoll(adapter: ConnectorAdapter, context: ConnectorRuntimeContext, cursor?: string): Promise<MemoryExtractionEvent[]> {
  const events = (await adapter.poll?.(cursor)) ?? [];
  return events.map((event) => normalizeConnectorEvent(event, context));
}

export function mapPlatformRecord(record: PlatformRecord, defaults: { platform?: string; contentPrefix?: string } = {}): ConnectorEventInput {
  const title = pickString(record, ["title", "name", "subject", "summary", "key"]);
  const body = pickString(record, ["content", "body", "text", "description", "message", "note"]);
  const content = [defaults.contentPrefix, title, body].filter(Boolean).join("\n\n") || JSON.stringify(redactLikelySecrets(record));
  return {
    content,
    externalId: pickString(record, ["externalId", "id", "gid", "uuid", "key", "number"]),
    url: pickString(record, ["url", "html_url", "webUrl", "permalink", "link"]),
    author: pickString(record, ["author", "creator", "user", "actor", "assignee"]),
    timestamp: pickString(record, ["timestamp", "updatedAt", "updated_at", "createdAt", "created_at"]),
    version: pickString(record, ["version", "etag", "revision"]),
    metadata: {
      platform: defaults.platform,
      status: pickString(record, ["status", "state"]),
      type: pickString(record, ["type", "kind"]),
      labels: record.labels,
      ...(isPlainObject(record.metadata) ? record.metadata : {})
    }
  };
}

function validateConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt">): void {
  if (!input.id.trim()) throw new Error("Connector manifest id is required");
  if (!input.name.trim()) throw new Error("Connector manifest name is required");
  if (!input.version.trim()) throw new Error("Connector manifest version is required");
  if (!input.capabilities.length) throw new Error("Connector manifest needs at least one capability");
  if (input.direction === "ingest" && input.capabilities.includes("writeback")) throw new Error("Ingest-only connectors cannot declare writeback");
  if (input.direction === "export" && input.capabilities.includes("ingest")) throw new Error("Export-only connectors cannot declare ingest");
  if (input.auth === "oauth" && !input.oauth?.authorizeUrl) throw new Error("OAuth connectors need oauth.authorizeUrl");
}

function defaultCapabilities(direction: ConnectorManifest["direction"]): ConnectorManifest["capabilities"] {
  if (direction === "ingest") return ["ingest", "poll"];
  if (direction === "export") return ["export", "writeback"];
  return ["ingest", "poll", "writeback"];
}

function platformId(value: string): string {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) throw new Error("Platform integration id is required");
  return id;
}

function pickString(record: PlatformRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (isPlainObject(value)) {
      const nested = pickString(value, ["name", "login", "email", "id", "key"]);
      if (nested) return nested;
    }
  }
  return undefined;
}

function isConnectorEventInput(record: PlatformRecord | ConnectorEventInput): record is ConnectorEventInput {
  return typeof (record as ConnectorEventInput).content === "string";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function redactLikelySecrets(value: PlatformRecord): PlatformRecord {
  const redacted: PlatformRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = /token|secret|password|apiKey|authorization/i.test(key) ? "[redacted]" : entry;
  }
  return redacted;
}
