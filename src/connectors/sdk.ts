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

export function createConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): ConnectorManifest {
  const now = new Date().toISOString();
  validateConnectorManifest(input);
  return {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
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

function validateConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt">): void {
  if (!input.id.trim()) throw new Error("Connector manifest id is required");
  if (!input.name.trim()) throw new Error("Connector manifest name is required");
  if (!input.version.trim()) throw new Error("Connector manifest version is required");
  if (!input.capabilities.length) throw new Error("Connector manifest needs at least one capability");
  if (input.direction === "ingest" && input.capabilities.includes("writeback")) throw new Error("Ingest-only connectors cannot declare writeback");
  if (input.direction === "export" && input.capabilities.includes("ingest")) throw new Error("Export-only connectors cannot declare ingest");
  if (input.auth === "oauth" && !input.oauth?.authorizeUrl) throw new Error("OAuth connectors need oauth.authorizeUrl");
}
