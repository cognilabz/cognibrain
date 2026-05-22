const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has",
  "have", "in", "is", "it", "its", "of", "on", "or", "that", "the", "to", "with",
  "what", "when", "where", "which", "who", "why", "how", "does", "do", "did", "done",
  "we", "our"
]);

const TOKEN_ALIASES = new Map<string, string>([
  ["children", "child"],
  ["kid", "child"],
  ["kids", "child"],
  ["trans", "transgender"],
  ["sunrise", "sun"],
  ["sunset", "sun"],
  ["destress", "relax"],
  ["de-stress", "relax"],
  ["relaxation", "relax"],
  ["relaxing", "relax"]
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bde-stress\b/g, "destress")
    .replace(/[_./:-]+/g, " ")
    .replace(/[^a-z0-9äöüß\-]+/gi, " ")
    .split(/\s+/)
    .map(stem)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function stem(token: string): string {
  const alias = TOKEN_ALIASES.get(token);
  if (alias) return alias;
  if (token.length > 7 && token.endsWith("ation")) return token.slice(0, -5) + "e";
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ion")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function extractEntities(text: string): string[] {
  const explicit = text.match(/`([^`]+)`/g)?.map((value) => value.replace(/`/g, "")) ?? [];
  const quoted = text.match(/["']([^"']+)["']/g)?.map((value) => value.replace(/["']/g, "")) ?? [];
  const capitalized = text.match(/\b[A-Z][A-Za-z0-9_-]{2,}\b/g) ?? [];
  const paths = text.match(/(?:\/|\b)[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+/g) ?? [];
  return unique([...explicit, ...quoted, ...capitalized, ...paths, ...compoundEntities(text)].map(cleanEntity).filter(Boolean));
}

function compoundEntities(text: string): string[] {
  const tokens = unique(entityTokens(text));
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`);
    if (index < tokens.length - 2) phrases.push(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }
  return phrases.slice(0, 12);
}

function cleanEntity(value: string): string {
  const cleaned = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (cleaned.length < 3 || STOP_WORDS.has(cleaned) || GENERIC_ENTITY_TOKENS.has(cleaned)) return "";
  return cleaned;
}

function entityTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\bde-stress\b/g, "destress")
    .replace(/[_./:-]+/g, " ")
    .replace(/[^a-z0-9äöüß\-]+/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !/^\d+$/.test(token) && !STOP_WORDS.has(token) && !GENERIC_ENTITY_TOKENS.has(token));
}

const GENERIC_ENTITY_TOKENS = new Set([
  "agent",
  "agents",
  "memory",
  "memories",
  "project",
  "should",
  "would",
  "could",
  "said",
  "says",
  "caption",
  "conversation",
  "participants",
  "session",
  "summary",
  "before",
  "after"
]);

export function cosineLike(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let overlap = 0;
  for (const token of aSet) if (bSet.has(token)) overlap += 1;
  return overlap / Math.sqrt(aSet.size * bSet.size);
}

export function keywordCoverage(query: string[], content: string[]): number {
  if (query.length === 0) return 0;
  const contentSet = new Set(content);
  const hits = query.filter((token) => contentSet.has(token)).length;
  return hits / query.length;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
