import { MemoryStore } from "./store";
import { RetrievalEngine } from "./retrieval";
import type { DomainModule } from "./domain";
import type { DomainEvaluationCase, DomainEvaluationReport } from "./types";

export function runDomainEvaluation(domain: DomainModule, cases: DomainEvaluationCase[] = domain.evaluationCases ?? []): DomainEvaluationReport {
  let correct = 0;
  const details: DomainEvaluationReport["details"] = [];
  for (const testCase of cases) {
    const store = new MemoryStore();
    for (const input of testCase.memories) store.add(domain.enrich ? domain.enrich(input) : input);
    const results = new RetrievalEngine(store, domain.retrievalWeights).search({ userId: "domain-eval", query: testCase.query, limit: 5 });
    const retrieved = results.map((result) => result.memory.content);
    const passed = testCase.expected.every((needle) => retrieved.some((content) => content.toLowerCase().includes(needle.toLowerCase())));
    if (passed) correct += 1;
    details.push({ id: testCase.id, passed, retrieved, expected: testCase.expected });
  }
  return {
    domainId: domain.id,
    passed: cases.length === 0 || correct === cases.length,
    accuracy: cases.length ? correct / cases.length : 1,
    total: cases.length,
    correct,
    generatedAt: new Date().toISOString(),
    details
  };
}
