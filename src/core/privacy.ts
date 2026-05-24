import { DEFAULT_CONSENT } from "./config";
import type { ConsentPolicy, Memory, MemoryInput } from "./types";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface RedactionPolicy {
  mode: "off" | "redact" | "reject" | "archive" | "encrypt";
  encryptionKey?: string;
  encryptionKeyId?: string;
  encryptionKeyVersion?: string;
}

export interface RedactionResult {
  input?: MemoryInput;
  rejected: boolean;
  matches: Array<{ detector: string; count: number }>;
}

export interface DecryptionKeyMaterial {
  keyId?: string;
  keyVersion?: string;
  key: string;
}

export interface DecryptionResult {
  ok: boolean;
  content?: string;
  keyId?: string;
  keyVersion?: string;
  keyFingerprint?: string;
  error?: string;
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
                keyFingerprint: encrypted.keyFingerprint,
                keyId: policy.encryptionKeyId ?? process.env.MEMORY_ENCRYPTION_KEY_ID ?? "local",
                keyVersion: policy.encryptionKeyVersion ?? process.env.MEMORY_ENCRYPTION_KEY_VERSION ?? "1"
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

export function decryptMemoryContent(memory: Memory, keyring: DecryptionKeyMaterial[]): DecryptionResult {
  const privacy = memory.metadata.privacy as { encrypted?: boolean; algorithm?: string; iv?: string; authTag?: string; keyId?: string; keyVersion?: string; keyFingerprint?: string } | undefined;
  if (!privacy?.encrypted) return { ok: true, content: memory.content };
  const match = memory.content.match(/^\[encrypted:([^:]+):(.+)\]$/);
  if (!match) return { ok: false, error: "encrypted memory content is missing ciphertext envelope" };
  const [, algorithm, ciphertext] = match;
  if (algorithm !== "aes-256-gcm" || privacy.algorithm !== "aes-256-gcm") return { ok: false, error: `unsupported encryption algorithm: ${algorithm}` };
  if (!privacy.iv || !privacy.authTag) return { ok: false, error: "encrypted memory is missing iv/authTag metadata" };
  const ordered = [...keyring].sort((a, b) => Number(b.keyId === privacy.keyId) - Number(a.keyId === privacy.keyId));
  for (const material of ordered) {
    if (!material.key || material.key.length < 16) continue;
    try {
      const normalized = createHash("sha256").update(material.key).digest();
      const fingerprint = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
      if (privacy.keyFingerprint && fingerprint !== privacy.keyFingerprint && material.keyId === privacy.keyId) continue;
      const decipher = createDecipheriv("aes-256-gcm", normalized, Buffer.from(privacy.iv, "base64url"));
      decipher.setAuthTag(Buffer.from(privacy.authTag, "base64url"));
      const content = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
      return {
        ok: true,
        content,
        keyId: material.keyId ?? privacy.keyId,
        keyVersion: material.keyVersion ?? privacy.keyVersion,
        keyFingerprint: fingerprint
      };
    } catch {
      continue;
    }
  }
  return { ok: false, error: "no key material could decrypt the encrypted memory" };
}

export function keyFingerprint(key: string | undefined): string | undefined {
  if (!key || key.length < 16) return undefined;
  return createHash("sha256").update(createHash("sha256").update(key).digest()).digest("hex").slice(0, 16);
}

export function normalizeConsent(input: MemoryInput): MemoryInput {
  const consent: ConsentPolicy = {
    ...DEFAULT_CONSENT,
    ...(input.consent ?? {})
  };
  return { ...input, consent };
}
