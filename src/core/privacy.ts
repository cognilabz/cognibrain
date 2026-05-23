import { DEFAULT_CONSENT } from "./config";
import type { ConsentPolicy, MemoryInput } from "./types";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

export interface RedactionPolicy {
  mode: "off" | "redact" | "reject" | "archive" | "encrypt";
  encryptionKey?: string;
}

export interface RedactionResult {
  input?: MemoryInput;
  rejected: boolean;
  matches: Array<{ detector: string; count: number }>;
}

const SECRET_PATTERNS: Array<{ detector: string; pattern: RegExp }> = [
  { detector: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g },
  { detector: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { detector: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { detector: "generic-secret", pattern: /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^"'\s]{6,}/gi },
  { detector: "high-entropy-token", pattern: /\b[A-Za-z0-9_/-]{32,}\b/g },
  { detector: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi }
];

export function applyRedactionPolicy(input: MemoryInput, policy: RedactionPolicy = { mode: "redact" }): RedactionResult {
  if (policy.mode === "off") return { input: normalizeConsent(input), rejected: false, matches: [] };
  let content = input.content;
  const matches: RedactionResult["matches"] = [];
  for (const { detector, pattern } of SECRET_PATTERNS) {
    const found = content.match(pattern) ?? [];
    if (!found.length) continue;
    matches.push({ detector, count: found.length });
    if (policy.mode === "redact" || policy.mode === "archive") {
      content = content.replace(pattern, `[redacted:${detector}]`);
    }
  }
  if (matches.length && policy.mode === "reject") {
    return { rejected: true, matches };
  }
  const encrypted = matches.length && policy.mode === "encrypt" ? encryptText(content, policy.encryptionKey ?? process.env.MEMORY_ENCRYPTION_KEY) : undefined;
  if (matches.length && policy.mode === "encrypt" && !encrypted) {
    return { rejected: true, matches: [...matches, { detector: "missing-encryption-key", count: 1 }] };
  }
  const metadata = matches.length
    ? {
        ...input.metadata,
        privacy: {
          redacted: true,
          action: policy.mode,
          detectors: matches,
          checkedAt: new Date().toISOString(),
          ...(encrypted
            ? {
                encrypted: true,
                algorithm: encrypted.algorithm,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                keyFingerprint: encrypted.keyFingerprint
              }
            : {})
        }
      }
    : input.metadata;
  return {
    input: normalizeConsent({
      ...input,
      content: encrypted ? `[encrypted:${encrypted.algorithm}:${encrypted.ciphertext}]` : content,
      metadata,
      ...(matches.length && policy.mode === "archive" ? { metadata: { ...metadata, archivedOnWrite: true } } : {})
    }),
    rejected: false,
    matches
  };
}

function encryptText(content: string, key: string | undefined) {
  if (!key || key.length < 16) return undefined;
  const normalized = createHash("sha256").update(key).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalized, iv);
  const ciphertext = Buffer.concat([cipher.update(content, "utf8"), cipher.final()]).toString("base64url");
  return {
    algorithm: "aes-256-gcm",
    ciphertext,
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyFingerprint: createHash("sha256").update(normalized).digest("hex").slice(0, 16)
  };
}

export function normalizeConsent(input: MemoryInput): MemoryInput {
  const consent: ConsentPolicy = {
    ...DEFAULT_CONSENT,
    ...(input.consent ?? {})
  };
  return { ...input, consent };
}
