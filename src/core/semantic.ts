import { cosineLike, extractEntities, keywordCoverage, tokenize } from "./text";
import type { DurabilityDecision, MemoryExtractionEvent, MemoryRelation } from "./types";

export interface SemanticConcept {
  id: string;
  examples: string[];
  threshold?: number;
}

export interface SemanticMatch {
  id: string;
  score: number;
  matchedExample?: string;
}

export function bestConceptMatch(text: string, concepts: SemanticConcept[]): SemanticMatch | undefined {
  const matches = concepts.map((concept) => ({ ...conceptScore(text, concept.examples), id: concept.id, threshold: concept.threshold ?? 0.58 }));
  return matches
    .filter((match) => match.score >= match.threshold)
    .sort((a, b) => b.score - a.score)[0];
}

export function conceptScore(text: string, examples: string[]): { score: number; matchedExample?: string } {
  const textTokens = tokenize(text);
  const textEntities = new Set(extractEntities(text));
  let best = { score: 0, matchedExample: undefined as string | undefined };
  for (const example of examples) {
    const exampleTokens = tokenize(example);
    if (!exampleTokens.length) continue;
    const tokenScore = Math.max(keywordCoverage(exampleTokens, textTokens), cosineLike(exampleTokens, textTokens));
    const entities = extractEntities(example);
    const entityScore = entities.length ? entities.filter((entity) => textEntities.has(entity)).length / entities.length : 0;
    const score = Math.max(tokenScore, tokenScore * 0.75 + entityScore * 0.25);
    if (score > best.score) best = { score, matchedExample: example };
  }
  return best;
}

export function relationHintsFromSemantics(content: string, entities: string[], role?: MemoryExtractionEvent["role"]): MemoryRelation[] {
  const relations: MemoryRelation[] = [];
  if (role === "tool") relations.push({ type: "executed_by", targetEntity: "tool", confidence: 0.8 });
  if (role === "assistant") relations.push({ type: "suggested_by", targetEntity: "agent", confidence: 0.7 });
  const relation = bestConceptMatch(content, RELATION_CONCEPTS);
  if (!relation) return relations;
  const type = relation.id as MemoryRelation["type"];
  for (const targetEntity of entities.slice(0, 4)) {
    relations.push({ type, targetEntity, confidence: Math.max(0.55, Math.min(0.78, relation.score)) });
  }
  return relations;
}

export function durabilityDecision(content: string, event: MemoryExtractionEvent, sensitivity: DurabilityDecision["sensitivity"]): Omit<DurabilityDecision, "contentPreview"> {
  const role = event.role;
  if (sensitivity === "secret") {
    return { action: "ask_user", reason: "potential secret requires redaction policy or explicit operator approval", durability: "ask_user", sensitivity, confidence: 0.9 };
  }
  const trimmed = content.trim();
  if (trimmed.length < 8 || bestConceptMatch(trimmed, SMALLTALK_CONCEPTS)) {
    return { action: "ignore", reason: "smalltalk or acknowledgement is not durable memory", durability: "ephemeral", sensitivity, confidence: 0.86 };
  }
  const temporary = bestConceptMatch(trimmed, TEMPORARY_CONCEPTS);
  if (temporary) {
    return { action: "working_memory", reason: "explicitly marked as temporary or session-scoped", durability: "session_only", sensitivity, confidence: Math.max(0.78, temporary.score) };
  }
  const durable = bestConceptMatch(trimmed, DURABLE_FACT_CONCEPTS);
  if (role === "assistant" && !durable) {
    return { action: "session_only", reason: "assistant output without durable confirmation stays out of long-term memory", durability: "session_only", sensitivity, confidence: 0.7 };
  }
  return { action: "store", reason: "durable fact or tool evidence", durability: "durable", sensitivity, confidence: Math.max(0.82, durable?.score ?? 0) };
}

export function domainTagFor(content: string, domain: string): string[] {
  const concept = DOMAIN_CONCEPTS.find((item) => item.id === domain);
  if (!concept) return [];
  return bestConceptMatch(content, [concept]) ? [domain] : [];
}

const RELATION_CONCEPTS: SemanticConcept[] = [
  { id: "imports", examples: ["imports from package", "module imported from dependency", "source package import"], threshold: 0.5 },
  { id: "calls", examples: ["calls endpoint", "requests api route", "uses http endpoint", "sends api request"], threshold: 0.5 },
  { id: "depends_on", examples: ["depends on service", "requires dependency", "uses component", "needs module"], threshold: 0.5 },
  { id: "confirmed_by", examples: ["confirmed by test", "verified by review", "passed validation", "evidence confirms"], threshold: 0.5 }
];

const SMALLTALK_CONCEPTS: SemanticConcept[] = [
  { id: "smalltalk", examples: ["thanks", "thank you", "okay", "sounds good", "cool", "great", "ja danke"], threshold: 0.85 }
];

const TEMPORARY_CONCEPTS: SemanticConcept[] = [
  { id: "temporary", examples: ["temporary for this session", "scratch draft only", "working note", "nur diese session"], threshold: 0.58 }
];

const DURABLE_FACT_CONCEPTS: SemanticConcept[] = [
  { id: "durable", examples: ["confirmed decision", "verified fix", "requires policy", "uses tool", "must do", "should follow", "resolved issue", "preferred workflow"], threshold: 0.48 }
];

const DOMAIN_CONCEPTS: SemanticConcept[] = [
  { id: "coding", examples: ["api endpoint", "cli command", "function class test", "repository package import", "code module"], threshold: 0.5 },
  { id: "research", examples: ["paper study citation", "source reference doi arxiv", "publication evidence"], threshold: 0.5 },
  { id: "legal", examples: ["contract clause regulation", "statute gdpr policy", "legal agreement"], threshold: 0.5 },
  { id: "finance", examples: ["invoice revenue payment", "forecast budget audit", "financial control"], threshold: 0.5 },
  { id: "sales", examples: ["account customer opportunity", "deal pipeline renewal", "champion buyer sponsor"], threshold: 0.5 },
  { id: "support", examples: ["support ticket case", "incident outage escalation", "customer requester sla"], threshold: 0.5 },
  { id: "healthcare", examples: ["patient diagnosis medication", "treatment clinic hipaa", "medical care"], threshold: 0.5 },
  { id: "security", examples: ["incident alert vulnerability", "cve secret token iam", "security finding"], threshold: 0.5 }
];
