import type { MemoryInput } from "../core";
import type { MarketplaceModuleCard } from "./types";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export const seedMemories: MemoryInput[] = [
  {
    userId: "demo",
    content: "Codex prefers compact memory citations with source lines and rollout ids.",
    source: { kind: "human", confidence: 0.96 },
    tags: ["preference", "workflow"],
    entities: ["Codex"],
    timestamp: daysAgo(5),
    pinned: true
  },
  {
    userId: "demo",
    content: "Project Daybreaker parity work must use simulator and backend proof before claiming done.",
    source: { kind: "reviewed_code", confidence: 0.9 },
    tags: ["daybreaker", "proof", "workflow"],
    entities: ["Daybreaker"],
    timestamp: daysAgo(8)
  },
  {
    userId: "demo",
    content: "Copilot bundle edits live under /Users/michaelhubeny/.copilot/pkg/universal.",
    source: { kind: "tool", confidence: 0.74 },
    tags: ["copilot", "path"],
    entities: ["Copilot"],
    timestamp: daysAgo(18)
  },
  {
    userId: "demo",
    content: "Memory retrieval should combine semantic, keyword, entity, temporal, trust, and graph signals.",
    source: { kind: "human", confidence: 0.94 },
    tags: ["retrieval", "benchmark", "architecture"],
    timestamp: daysAgo(2)
  },
  {
    userId: "demo",
    content: "Transcribed audio memories have lower source confidence until verified by a human.",
    source: { kind: "agent", confidence: 0.63 },
    tags: ["transcript", "quality"],
    timestamp: daysAgo(42)
  },
  {
    userId: "demo",
    content: "Audio transcript said Mira has tonsil pain, but this was never confirmed.",
    source: { kind: "transcript", confidence: 0.34 },
    tags: ["health", "transcript", "needs-review"],
    entities: ["Mira"],
    timestamp: daysAgo(96)
  },
  {
    userId: "demo",
    content: "Mira confirmed she does not have tonsil pain; demote the transcript memory.",
    source: { kind: "human", confidence: 0.95 },
    tags: ["health", "correction"],
    entities: ["Mira"],
    timestamp: daysAgo(1)
  },
  {
    userId: "demo",
    content: "Old vector-only memory often misses temporal corrections and multi-hop project preferences.",
    source: { kind: "import", confidence: 0.61 },
    tags: ["benchmark", "retrieval"],
    timestamp: daysAgo(65)
  },
  {
    userId: "demo",
    content: "Operator reviews memory graph and benchmark proof every Friday before release work.",
    source: { kind: "human", confidence: 0.92 },
    tags: ["pattern", "release", "review"],
    entities: ["operator", "memory graph", "benchmark proof"],
    timestamp: daysAgo(10),
    temporal: { eventAt: daysAgo(10).toISOString() }
  },
  {
    userId: "demo",
    content: "Repo policy: before Cognibrain release work, run npm run release:check and keep managed SaaS claims out of self-hosted launch copy.",
    source: { kind: "reviewed_code", confidence: 0.96 },
    tags: ["engineering-memory", "engineering:repo_policy", "release"],
    entities: ["Cognibrain", "release"],
    timestamp: daysAgo(1),
    metadata: {
      engineering: {
        kind: "repo_policy",
        codebase: { repo: "cognibrain", branch: "main" },
        confidence: 0.92,
        command: "npm run release:check"
      }
    }
  },
  {
    userId: "demo",
    content: "Inferred pattern: release reviews often combine graph paths, dream output, and benchmark proof.",
    source: { kind: "agent", confidence: 0.7 },
    tags: ["pattern", "needs-review"],
    entities: ["release review", "graph paths", "benchmark proof"],
    timestamp: daysAgo(3),
    metadata: {
      patternReview: { status: "pending", support: 3, confidence: 0.72, cadence: "weekly:friday" }
    }
  }
];

export const marketplaceModules: MarketplaceModuleCard[] = [
  {
    id: "connector-chat",
    kind: "connector",
    name: "Chat Connector",
    version: "1.0.0",
    status: "installed",
    summary: "Ingests chat transcripts with external ids, source mapping, and webhook sync.",
    manifest: { connectorId: "official-chat", capabilities: ["ingest", "webhook", "writeback"] }
  },
  {
    id: "persona-operator",
    kind: "persona",
    name: "Operator Persona",
    version: "1.0.0",
    status: "available",
    summary: "Concise summaries, stricter privacy defaults, and high trust weighting.",
    manifest: { id: "operator", summaryStyle: "concise", privacyDefault: "private", weights: { trust: 0.34, graph: 0.2 } }
  },
  {
    id: "domain-coding",
    kind: "domain",
    name: "Coding Domain",
    version: "1.0.0",
    status: "installed",
    summary: "Recognizes APIs, packages, tests, repo paths, and code relations.",
    manifest: { aliases: ["repo", "api", "cli"], tags: ["code", "test", "package"] }
  },
  {
    id: "profile-recall-safe",
    kind: "retrieval_profile",
    name: "High-Precision Recall",
    version: "1.0.0",
    status: "available",
    summary: "Raises trust and graph path evidence while lowering recency-only pressure.",
    manifest: { weights: { trust: 0.36, graph: 0.22, semantic: 0.2, temporal: 0.06 } }
  }
];

export const certifiedBenchmarks = [
  {
    dataset: "LoCoMo",
    metric: "evidence recall@20",
    ours: "1095/1536",
    accuracy: 71.29,
    baseline: "best included 981/1536",
    margin: 7.42,
    artifact: "artifacts/locomo-report.json"
  },
  {
    dataset: "LongMemEval-S",
    metric: "answer-session recall@20",
    ours: "497/500",
    accuracy: 99.4,
    baseline: "keyword-only 495/500",
    margin: 0.4,
    artifact: "artifacts/longmemeval-report.json"
  },
  {
    dataset: "BEAM 100K",
    metric: "retrieval nugget score@20",
    ours: "386/400",
    accuracy: 96.5,
    baseline: "Graphonomous public 95.0%",
    margin: 1.5,
    artifact: "artifacts/beam-report.json"
  },
  {
    dataset: "BEAM 500K",
    metric: "retrieval nugget score@20",
    ours: "683/700",
    accuracy: 97.57,
    baseline: "Graphonomous public 96.9%",
    margin: 0.67,
    artifact: "artifacts/beam-500k-report.json"
  },
  {
    dataset: "CogniCodeBench",
    metric: "engineering-memory score",
    ours: "100/100",
    accuracy: 100,
    baseline: "best ablation below full",
    margin: 18,
    artifact: "artifacts/cognicodebench/run.json"
  },
  {
    dataset: "Benchmark Arena",
    metric: "same-run arena score",
    ours: "0.9722 score",
    accuracy: 97.22,
    baseline: "best API-shape 66.67%",
    margin: 30.55,
    artifact: "artifacts/arena/run.json"
  }
];

export const beamCategories = [
  ["abstention", "70/70"],
  ["contradiction", "70/70"],
  ["event ordering", "70/70"],
  ["information extraction", "65/70"],
  ["instruction following", "70/70"],
  ["knowledge update", "69/70"],
  ["multi-session", "65/70"],
  ["preference", "69/70"],
  ["summarization", "70/70"],
  ["temporal", "65/70"]
];

export const nextgenProof = [
  ["engineering memory", "10 typed kinds"],
  ["action guard", "do/don't before tools"],
  ["patch evidence", "corrections + outcomes"],
  ["graph inference", "typed rules"],
  ["path explainer", "multi-hop"],
  ["brain/source scope", "team-ready"],
  ["audit events", "queued webhooks"],
  ["compliance report", "retention proof"],
  ["marketplace", "persona install"]
];

export const harnessProof = [
  ["Claude Code", "setup package"],
  ["OpenAI Codex", "skill + MCP"],
  ["Cursor / VS Code", "workspace scope"],
  ["GitHub", "review + CI memory"]
];

export const harnessRunProof = [
  ["Claude Code", "context -> guard -> outcome -> evidence"],
  ["Codex", "context pack + MCP tools"],
  ["Cursor / VS Code", "telemetry-ready workspace"],
  ["GitHub", "review and CI writeback"]
];

export const patchEvidenceProof = [
  ["context pack", "code_ctx_* linked when supplied by EvidencePack"],
  ["memories used", "citation, trust and graph paths retained"],
  ["corrections applied", "reviewed corrections and derived policies"],
  ["procedures recalled", "next command and success pattern"],
  ["forbidden actions", "repeated mistakes blocked before tools"],
  ["commands run", "patch summary captures exact validation"],
  ["tool outcomes", "exit code, duration and touched files"],
  ["stale excluded", "superseded rules kept out of context"]
];

export const benchmarkArenaProof = [
  ["adapter contract", "same scenario stream"],
  ["Cognibrain", "same-run-full"],
  ["Mem0", "same-run-api-shape"],
  ["Graphiti/Zep", "same-run-api-shape"],
  ["Cognee", "same-run-api-shape"],
  ["LangMem", "same-run-native"],
  ["GBrain", "same-run-api-shape"],
  ["internal table", "artifacts/public/benchmark-arena"]
];

export const operatorControls = [
  "configurable weights",
  "privacy redaction",
  "scope filters",
  "feedback learning",
  "graph paths",
  "time review",
  "brain scope",
  "audit trail",
  "marketplace"
];
