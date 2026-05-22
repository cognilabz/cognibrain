import type { BenchmarkCase, MemoryInput } from "../core";

export const benchmarkMemories: MemoryInput[] = [
  {
    userId: "bench",
    content: "Project Atlas uses TypeScript for all new harness components.",
    entities: ["atlas", "typescript", "harness"],
    tags: ["project", "language"],
    source: { kind: "human", confidence: 0.96 },
    timestamp: "2026-01-12T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Project Atlas stores validated facts with line-level citations and commit provenance.",
    entities: ["atlas", "citations", "provenance"],
    tags: ["trust", "project"],
    source: { kind: "reviewed_code", confidence: 0.94 },
    timestamp: "2026-01-13T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Mira prefers concise final answers but wants proof for validation-heavy work.",
    entities: ["mira", "proof", "validation"],
    tags: ["user", "preference"],
    source: { kind: "human", confidence: 0.98 },
    timestamp: "2026-02-10T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "The browser connector should verify localhost dashboards before frontend work is considered done.",
    entities: ["browser", "localhost", "dashboard"],
    tags: ["procedure", "frontend"],
    source: { kind: "human", confidence: 0.91 },
    timestamp: "2026-03-01T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Audio transcript said Mira has tonsil pain, but this was never confirmed.",
    entities: ["mira", "tonsil", "transcript"],
    tags: ["low-confidence"],
    source: { kind: "transcript", confidence: 0.22 },
    timestamp: "2026-03-05T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Mira confirmed she does not have tonsil pain; demote the transcript memory.",
    entities: ["mira", "tonsil", "confirmed"],
    tags: ["correction", "health"],
    source: { kind: "human", confidence: 0.99 },
    timestamp: "2026-03-06T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "cognibrain must retrieve with semantic, keyword, entity, temporal, trust, and graph signals.",
    entities: ["open memory", "semantic", "keyword", "entity", "temporal", "trust", "graph"],
    tags: ["retrieval", "architecture"],
    source: { kind: "reviewed_code", confidence: 0.96 },
    timestamp: "2026-04-01T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Reflection jobs cluster repeated memories and create compact long-term summaries.",
    entities: ["reflection", "summaries", "long-term"],
    tags: ["reflection", "dreaming"],
    source: { kind: "reviewed_code", confidence: 0.88 },
    timestamp: "2026-04-02T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Harness hooks run before_llm_call, after_llm_call, and on_error for integration.",
    entities: ["harness", "before_llm_call", "after_llm_call", "on_error"],
    tags: ["integration", "hooks"],
    source: { kind: "reviewed_code", confidence: 0.9 },
    timestamp: "2026-04-03T10:00:00.000Z"
  },
  {
    userId: "bench",
    content: "Old vector-only memory often misses temporal corrections and multi-hop project preferences.",
    entities: ["vector", "temporal", "multi-hop"],
    tags: ["baseline", "weakness"],
    source: { kind: "import", confidence: 0.7 },
    timestamp: "2026-04-04T10:00:00.000Z"
  }
];

export const benchmarkCases: BenchmarkCase[] = [
  {
    id: "single-hop-language",
    kind: "single-hop",
    query: "What language should Project Atlas use for new harness components?",
    expectedIds: ["atlas", "typescript"]
  },
  {
    id: "multi-hop-proof",
    kind: "multi-hop",
    query: "What does Mira want when validation work is heavy?",
    expectedIds: ["mira", "proof", "validation"]
  },
  {
    id: "temporal-correction",
    kind: "temporal",
    query: "Does Mira have tonsil pain?",
    expectedIds: ["does not have tonsil pain", "confirmed"],
    disallowedIds: ["never confirmed"]
  },
  {
    id: "architecture-signals",
    kind: "single-hop",
    query: "Which retrieval signals does cognibrain combine?",
    expectedIds: ["semantic", "keyword", "entity", "temporal", "trust", "graph"]
  },
  {
    id: "integration-hooks",
    kind: "single-hop",
    query: "Which hook names integrate the memory service with harnesses?",
    expectedIds: ["before_llm_call", "after_llm_call", "on_error"]
  },
  {
    id: "frontend-proof",
    kind: "multi-hop",
    query: "What must verify localhost dashboards before frontend work is done?",
    expectedIds: ["browser", "localhost", "dashboard"]
  },
  {
    id: "reflection-summary",
    kind: "single-hop",
    query: "What do reflection jobs create from repeated memories?",
    expectedIds: ["compact", "long-term", "summaries"]
  },
  {
    id: "abstention",
    kind: "abstention",
    query: "What is Mira's favorite database engine?",
    expectedIds: []
  }
];
