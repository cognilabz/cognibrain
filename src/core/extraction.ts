import { extractEntities, unique } from "./text";
import { bestConceptMatch, durabilityDecision, relationHintsFromSemantics } from "./semantic";
import type { DurabilityDecision, MemoryClaim, MemoryExtractionEvent, MemoryInput, MemoryRelation, MemoryScope, Provenance } from "./types";

export interface ExtractionOptions {
  brainId?: string;
  sourceId?: string;
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  deviceId?: string;
  runId?: string;
}

export function extractAddOnlyMemories(events: MemoryExtractionEvent[], options: ExtractionOptions): MemoryInput[] {
  const inputs: MemoryInput[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    const facts = splitFacts(event.content);
    for (const fact of facts) {
      const key = `${event.role}:${fact.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entities = extractEntities(fact);
      const source = event.source ?? { ...sourceForRole(event.role), uri: event.uri };
      const claim = extractClaim(fact, event, options, source, entities);
      const durability = classifyDurability(fact, event, claim);
      inputs.push({
        ...options,
        content: fact,
        type: event.role === "tool" ? "procedural" : event.role === "assistant" ? "episodic" : "project",
        layer: event.role === "tool" ? "procedural" : "episodic",
        source,
        sourceRef: event.sourceRef,
        tags: unique(["extracted", event.role, event.mediaType ? `media:${event.mediaType}` : "media:text", event.language ? `lang:${event.language}` : undefined].filter(Boolean) as string[]),
        entities,
        relations: relationHints(fact, entities, event.role),
        timestamp: event.timestamp,
        metadata: {
          ...(event.metadata ?? {}),
          extraction: {
            mode: "single-pass-add-only",
            role: event.role,
            mediaType: event.mediaType ?? "text",
            language: event.language,
            uri: event.uri,
            mimeType: event.mimeType,
            extractedAt: new Date().toISOString()
          },
          claim,
          durabilityDecision: durability
        }
      });
    }
  }
  return inputs;
}

export function extractClaim(content: string, event: MemoryExtractionEvent, scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">, source: Provenance = event.source ?? sourceForRole(event.role), entities = extractEntities(content)): MemoryClaim {
  const trimmed = content.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();
  const nowMatch = trimmed.match(/^(.+?)\s+now\s+(uses|requires|depends on|calls|imports|prefers)\s+(.+?)(?:\s+for\s+(.+))?[.!]?$/i);
  const simpleMatch = trimmed.match(/^(.+?)\s+(uses|requires|depends on|calls|imports|prefers|confirmed|verifies|verified)\s+(.+?)(?:\s+for\s+(.+))?[.!]?$/i);
  const match = nowMatch ?? simpleMatch;
  const sensitivity = sensitivityFor(trimmed);
  const durability = durabilityFor(trimmed, event, sensitivity);
  const subject = cleanupClaimPart(match?.[1] ?? entities[0] ?? source.kind);
  const predicate = normalizePredicate(match?.[2] ?? (event.role === "tool" ? "executed" : bestConceptMatch(lower, [{ id: "confirmed", examples: ["confirmed", "verified", "passed validation"], threshold: 0.62 }]) ? "confirmed" : "mentions"));
  const object = cleanupClaimPart(match?.[3] ?? trimmed);
  return {
    id: claimId(trimmed, event.timestamp),
    subject,
    predicate,
    object,
    qualifiers: {
      ...(match?.[4] ? { purpose: cleanupClaimPart(match[4]) } : {}),
      role: event.role,
      ...(event.mediaType ? { mediaType: event.mediaType } : {}),
      ...(event.language ? { language: event.language } : {})
    },
    time: event.timestamp,
    source,
    confidence: Math.min(1, Math.max(0, source.confidence * (match ? 1 : 0.82))),
    durability,
    sensitivity,
    scope: {
      userId: scope.userId,
      brainId: scope.brainId,
      sourceId: scope.sourceId,
      agentId: scope.agentId,
      sessionId: scope.sessionId,
      appId: scope.appId,
      orgId: scope.orgId,
      projectId: scope.projectId,
      deviceId: scope.deviceId,
      runId: scope.runId
    }
  };
}

export function classifyDurability(content: string, event: MemoryExtractionEvent, claim = extractClaim(content, event, { userId: "unknown" })): DurabilityDecision {
  const text = content.trim();
  const lower = text.toLowerCase();
  const sensitivity = claim.sensitivity;
  return { contentPreview: preview(text), ...durabilityDecision(lower, event, sensitivity) };
}

function splitFacts(content: string): string[] {
  return content
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 8)
    .slice(0, 12);
}

function sourceForRole(role: MemoryExtractionEvent["role"]): Provenance {
  if (role === "user" || role === "operator") return { kind: "human", confidence: 0.9 };
  if (role === "tool") return { kind: "tool", confidence: 0.82 };
  if (role === "assistant") return { kind: "agent", confidence: 0.64 };
  return { kind: "import", confidence: 0.6 };
}

function durabilityFor(content: string, event: MemoryExtractionEvent, sensitivity: MemoryClaim["sensitivity"]): MemoryClaim["durability"] {
  if (sensitivity === "secret") return "ask_user";
  return durabilityDecision(content, event, sensitivity).durability;
}

function sensitivityFor(content: string): MemoryClaim["sensitivity"] {
  if (/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^"'\s]{6,}/i.test(content) || /\bghp_[A-Za-z0-9_]{20,}\b/.test(content)) return "secret";
  if (/\b(ssn|social security|health|diagnosis|medical|bank account|credit card)\b/i.test(content)) return "regulated";
  if (/\b(email|phone|address|birthday|private)\b/i.test(content)) return "personal";
  return "none";
}

function normalizePredicate(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "_").replace(/verified|verifies/, "confirmed");
}

function cleanupClaimPart(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function claimId(content: string, timestamp?: Date | string): string {
  let hash = 2166136261;
  for (const char of `${content}:${timestamp ?? ""}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `claim_${(hash >>> 0).toString(36)}`;
}

function preview(content: string): string {
  return content.length > 120 ? `${content.slice(0, 117)}...` : content;
}

function relationHints(content: string, entities: string[], role: MemoryExtractionEvent["role"]): MemoryRelation[] {
  return relationHintsFromSemantics(content, entities, role);
}
