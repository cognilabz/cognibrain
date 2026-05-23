import { DEFAULT_CONSENT } from "./config";
import type { ConsentPolicy, MemoryInput } from "./types";

export interface RedactionPolicy {
  mode: "off" | "redact" | "reject" | "archive";
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
  const metadata = matches.length
    ? {
        ...input.metadata,
        privacy: {
          redacted: true,
          action: policy.mode,
          detectors: matches,
          checkedAt: new Date().toISOString()
        }
      }
    : input.metadata;
  return {
    input: normalizeConsent({
      ...input,
      content,
      metadata,
      ...(matches.length && policy.mode === "archive" ? { metadata: { ...metadata, archivedOnWrite: true } } : {})
    }),
    rejected: false,
    matches
  };
}

export function normalizeConsent(input: MemoryInput): MemoryInput {
  const consent: ConsentPolicy = {
    ...DEFAULT_CONSENT,
    ...(input.consent ?? {})
  };
  return { ...input, consent };
}
