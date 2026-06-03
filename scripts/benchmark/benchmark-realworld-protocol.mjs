#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const outputPath = optionValue("--out") ?? "artifacts/realworld-benchmark-protocol.json";
const markdownPath = optionValue("--markdown") ?? "artifacts/docs/realworld-benchmark-protocol.md";
const openaiIntelligenceSummary = summarizeRealWorldArtifact("artifacts/realworld-blackbox-openai-intelligence.json");

const gate = [
  {
    id: "preregistered-before-system-tuning",
    required: true,
    rule: "Dataset, prompts, scoring, budgets, and adapter contract are frozen before adding or tuning any system.",
  },
  {
    id: "same-input-stream",
    required: true,
    rule: "Every system receives the same corpus, update events, deletions, questions, time cutoffs, and negative examples.",
  },
  {
    id: "black-box-product-run",
    required: true,
    rule: "Each system is run through its original product package, service, CLI, SDK, or official API, not a capability profile.",
  },
  {
    id: "same-scoring-code",
    required: true,
    rule: "All outputs are scored by the same LLM/harness judge command, model, rubric, sampling, and retries; deterministic evidence matches are diagnostics only.",
  },
  {
    id: "no-per-system-prompt-tuning",
    required: true,
    rule: "Ingest/query prompts and retrieval budgets are generic or vendor-documented defaults; per-system fixes are logged as repaired/diagnostic.",
  },
  {
    id: "raw-output-retention",
    required: true,
    rule: "Raw inputs, outputs, logs, errors, versions, commits, package pins, cost, latency, and scorer traces are retained.",
  },
  {
    id: "weakness-taxonomy",
    required: true,
    rule: "Results are stratified by task type so wins and failures are visible, not averaged into one flattering score.",
  },
  {
    id: "leaderboard-eligibility",
    required: true,
    rule: "A result enters a comparative leaderboard only if it satisfies every required gate above.",
  },
];

const realWorldBuckets = [
  {
    id: "customer-support-long-conversations",
    source: "Public/support-style multi-session conversations or generated fixtures frozen before system runs.",
    metrics: ["answer correctness", "evidence recall", "unsupported-answer abstention", "latency", "cost"],
  },
  {
    id: "software-engineering-repo-work",
    source: "Real OSS repos plus issues, PRs, failed commands, corrections, and follow-up tasks.",
    metrics: ["procedure recall", "wrong-action suppression", "patch evidence completeness", "source citation correctness"],
  },
  {
    id: "personal-project-notes",
    source: "Long-lived notes with aliases, relationships, stale decisions, and mixed lexical/paraphrase queries.",
    metrics: ["lexical recall", "paraphrase recall", "entity disambiguation", "relationship recall"],
  },
  {
    id: "temporal-updates-contradictions",
    source: "Tasks where old facts are superseded by newer facts and the older fact remains retrievable but unsafe.",
    metrics: ["fresh-fact precision", "stale-fact suppression", "timestamp reasoning", "citation freshness"],
  },
  {
    id: "negative-and-privacy-boundaries",
    source: "Questions that should abstain plus memories marked private, deleted, unsafe, or out of scope.",
    metrics: ["abstention precision", "leakage rate", "deletion compliance", "unsafe-injection suppression"],
  },
];

const currentArtifacts = [
  classifyArtifact({
    path: "artifacts/realworld-blackbox.json",
    className: "neutral-blackbox-smoke",
    leaderboardEligible: false,
    why: "Runs a preregistered generic reset/ingest/query/export contract with raw outputs and latency/cost fields, but quality scoring is blocked until an LLM/harness judge is configured and current checked competitors are command-blocked.",
    allowedUse: "Readiness proof for the neutral harness, raw-output diagnostics, and setup/latency visibility for systems that are actually executed.",
    missingForLeaderboard: ["LLM/harness judge command configured", "at least two original non-baseline systems executed on the same manifest", "external competitor commands configured", "larger third-party-sourced task set"],
  }),
  classifyArtifact({
    path: "artifacts/realworld-blackbox-openai-intelligence.json",
    className: openaiIntelligenceSummary.originalEligibleSystems >= 2
      ? "llm-intelligence-neutral-comparative-smoke"
      : openaiIntelligenceSummary.originalRawOutputSystems >= 2
        ? "native-original-raw-output-smoke"
        : "llm-intelligence-neutral-smoke",
    leaderboardEligible: false,
    why: openaiIntelligenceSummary.exists
      ? `Runs ${openaiIntelligenceSummary.originalRawOutputSystems} original non-baseline system(s) on the frozen manifest (${openaiIntelligenceSummary.originalRawOutputSystemNames.join(", ") || "none"}), with ${openaiIntelligenceSummary.originalEligibleSystems} LLM/harness judged original system(s). It remains a small neutral smoke, not a market leaderboard.`
      : "Configured as the LLM-intelligence neutral smoke artifact, but no current artifact exists.",
    allowedUse: openaiIntelligenceSummary.originalEligibleSystems >= 2
      ? "Comparative smoke evidence on realworld-blackbox-v1, including raw outputs, latency and LLM/harness-judged quality for attached original systems."
      : openaiIntelligenceSummary.originalRawOutputSystems >= 2
        ? "Comparative raw-output smoke evidence on realworld-blackbox-v1; score, recall, abstention and leakage metrics remain blocked until the shared LLM/harness judge succeeds."
        : "Evidence that provider-driven retrieval can suppress stale/forbidden evidence before the final LLM judge scores delivered outputs.",
    missingForLeaderboard: openaiIntelligenceSummary.originalEligibleSystems >= 2
      ? ["larger third-party-sourced task set", "more original memory systems executed without repair", "latency and cost budget preregistered for LLM intelligence"]
      : openaiIntelligenceSummary.originalRawOutputSystems >= 2
        ? ["LLM/harness judge command succeeds on the current raw outputs", "larger third-party-sourced task set", "more original memory systems executed without repair", "latency and cost budget preregistered for LLM intelligence"]
      : ["at least two original non-baseline systems executed on the same manifest", "external competitor commands configured", "larger third-party-sourced task set", "latency and cost budget preregistered for LLM intelligence"],
  }),
  classifyArtifact({
    path: "artifacts/realworld-blackbox-openai-intelligence-success.json",
    className: "llm-intelligence-last-successful-judged-smoke",
    leaderboardEligible: false,
    why: "Stores the most recent scoreable LLM/harness judged run separately from the latest attempt, so credential-blocked reruns do not overwrite scientific success evidence.",
    allowedUse: "Historical successful judged smoke evidence only; use alongside the latest-attempt artifact and never as proof that current credentials or current external state are green.",
    missingForLeaderboard: ["current latest attempt also scoreable", "larger third-party-sourced task set", "more original memory systems executed without repair", "latency and cost budget preregistered for LLM intelligence"],
  }),
  classifyArtifact({
    path: "artifacts/original-public-benchmarks.json",
    className: "upstream-original-evidence",
    leaderboardEligible: false,
    why: "Runs original upstream benchmark code or records original-run blockers, but it does not run all memory systems on the same neutral real-world protocol.",
    allowedUse: "Evidence about upstream reproducibility, Basic Memory's own benchmark strengths, LongMemEval BM25 baseline behavior, and Mem0 setup/API drift.",
    missingForLeaderboard: ["same black-box task stream for all systems", "same scoring code across all systems", "all systems executed without custom adapters"],
  }),
  classifyArtifact({
    path: "artifacts/external-hard-summary.json",
    className: "cognibrain-public-dataset-stress",
    leaderboardEligible: false,
    why: "Stresses Cognibrain against local baselines on public datasets, but the baselines are not original product runs.",
    allowedUse: "Cognibrain regression and weakness tracking on LoCoMo, LongMemEval, and BEAM-style retrieval tasks.",
    missingForLeaderboard: ["original competitor systems", "raw competitor outputs", "same external product lifecycle"],
  }),
  classifyArtifact({
    path: "artifacts/arena/run.json",
    className: "cognibrain-designed-adapter-diagnostic",
    leaderboardEligible: false,
    why: "Uses Cognibrain-oriented coding-memory scenarios and capability-profile adapters for several competitors.",
    allowedUse: "Internal product gap analysis for correction carry-over, guard behavior, and patch-evidence lifecycle.",
    missingForLeaderboard: ["third-party scenario source", "black-box product execution for every system", "vendor-neutral task definition"],
  }),
  classifyArtifact({
    path: "artifacts/arena/native-competitors.json",
    className: "native-smoke-on-cognibrain-designed-scenarios",
    leaderboardEligible: false,
    why: "Executes some native competitor paths, but still uses Cognibrain-designed scenarios and lifecycle checks.",
    allowedUse: "Smoke proof that competitor runners start and return bounded diagnostic outputs.",
    missingForLeaderboard: ["real-world neutral task source", "external scoring rubric", "complete non-profiled competitor coverage"],
  }),
  classifyArtifact({
    path: "artifacts/external-basic-memory.json",
    className: "custom-adapter-diagnostic",
    leaderboardEligible: false,
    why: "Runs Basic Memory through a local adapter built here, not an official upstream benchmark or vendor-defined adapter.",
    allowedUse: "Hypothesis generation about Basic Memory strengths on BEAM-like retrieval and weaknesses on session-level conversation recall.",
    missingForLeaderboard: ["official Basic Memory adapter or preregistered generic adapter", "raw system parity checks", "same product-default setup used for all competitors"],
  }),
  classifyArtifact({
    path: "artifacts/cognicodebench/run.json",
    className: "internal-product-benchmark",
    leaderboardEligible: false,
    why: "High-value Cognibrain regression suite, but the task family is built around Cognibrain's product lifecycle.",
    allowedUse: "Cognibrain internal quality gates and regression prevention.",
    missingForLeaderboard: ["external task provenance", "competitor-neutral lifecycle", "public preregistration"],
  }),
];

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  benchmark: "realworld-benchmark-protocol",
  status: "protocol-ready-results-not-yet-comparative",
  conclusion:
    "No checked artifact currently qualifies as a market-wide real-world leaderboard. Existing results remain useful, but they must be labeled as upstream self-evidence, Cognibrain stress tests, adapter diagnostics, or neutral comparative smokes until the larger market gate is satisfied.",
  requiredGate: gate,
  neutralBlackBoxContract: {
    phases: ["reset", "ingest-corpus", "ingest-updates", "apply-deletions-or-privacy-marks", "query", "answer-or-retrieve", "export-raw-outputs", "teardown"],
    fixedBudgets: {
      retrievalTopK: "predeclared per task family",
      answerModel: "same answerer or no answerer for all systems",
      judgeModel: "same judge model and rubric for all systems",
      retries: "same retry budget for all systems",
      ingestWallClock: "recorded, not normalized away",
    },
    allowedSystemSpecificConfig:
      "Only documented default setup, credentials, endpoint URLs, and storage paths. Any API compatibility repair demotes the row to repaired/diagnostic unless preregistered.",
  },
  realWorldBuckets,
  currentArtifacts,
  leaderboardEligibleArtifacts: currentArtifacts.filter((artifact) => artifact.leaderboardEligible).map((artifact) => artifact.path),
  nextCognibrainImprovements: [
    {
      priority: "P0",
      item: "Attach a fixed LLM/harness judge command before reporting any quality score.",
      reason: "The neutral harness now refuses score, recall, abstention and leakage quality claims without MEMORY_REALWORLD_JUDGE_COMMAND.",
    },
    openaiIntelligenceSummary.originalEligibleSystems >= 2
      ? {
          priority: "P0",
          item: "Expand the neutral black-box harness beyond the first original competitor smoke.",
          reason: `Current checked smoke has ${openaiIntelligenceSummary.originalEligibleSystems} original non-baseline systems; a market claim still needs more original systems and a larger third-party-sourced task set.`,
        }
      : openaiIntelligenceSummary.originalRawOutputSystems >= 2
        ? {
            priority: "P0",
            item: "Attach a successful LLM/harness judge to the current original raw-output competitor smoke.",
            reason: `Current checked smoke has ${openaiIntelligenceSummary.originalRawOutputSystems} original non-baseline raw-output systems (${openaiIntelligenceSummary.originalRawOutputSystemNames.join(", ")}), but quality metrics remain blocked until the shared judge succeeds.`,
          }
      : {
          priority: "P0",
          item: "Attach original competitor commands to the neutral black-box harness before more comparative claims.",
          reason: "The neutral harness exists, but current checked Mem0, Basic Memory, LangMem, Graphiti, Zep, Cognee and GBrain rows are command-blocked.",
        },
    {
      priority: "P0",
      item: "Demote any capability-profile competitor score from public leaderboard language.",
      reason: "Profile adapters encode assumptions about competitor capabilities and can silently flatter our lifecycle design.",
    },
    {
      priority: "P1",
      item: "Reduce LLM intelligence latency with batching, caching, or smaller specialist judges.",
      reason: "The OpenAI-compatible retrieval intelligence smoke improves quality but adds multi-second p95 query latency.",
    },
    {
      priority: "P1",
      item: "Report cost, latency percentiles, setup failure rate, and raw error classes beside quality.",
      reason: "Basic Memory's upstream suite exposes p95 latency and indexing throughput; Cognibrain reports should match that operational visibility.",
    },
    {
      priority: "P1",
      item: "Split weakness reporting by lexical, paraphrase, temporal, update, abstention, provenance, deletion, and privacy buckets.",
      reason: "A single average hides where systems are genuinely better or worse.",
    },
    {
      priority: "P1",
      item: "Add real OSS engineering workflows as a third-party-sourced bucket.",
      reason: "Cognibrain's strongest internal story is coding lifecycle memory, so the fair version must come from external repos/issues rather than our own scenario generator.",
    },
    {
      priority: "P2",
      item: "Add an evidence-class gate to docs and release checks.",
      reason: "The docs should fail or visibly warn when a non-eligible diagnostic artifact is presented like a comparative leaderboard.",
    },
  ],
};

writeJson(outputPath, report);
writeMarkdown(markdownPath, report);

console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  status: report.status,
  leaderboardEligibleArtifacts: report.leaderboardEligibleArtifacts.length,
  currentArtifactClasses: report.currentArtifacts.map((artifact) => ({
    path: artifact.path,
    className: artifact.className,
    exists: artifact.exists,
    leaderboardEligible: artifact.leaderboardEligible,
  })),
}, null, 2));

function classifyArtifact({ path, className, leaderboardEligible, why, allowedUse, missingForLeaderboard }) {
  const absolute = join(root, path);
  return {
    path,
    exists: existsSync(absolute),
    sha256: existsSync(absolute) ? sha256(absolute) : null,
    className,
    leaderboardEligible,
    why,
    allowedUse,
    missingForLeaderboard,
  };
}

function summarizeRealWorldArtifact(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return { exists: false, originalEligibleSystems: 0, originalSystemNames: [], originalRawOutputSystems: 0, originalRawOutputSystemNames: [] };
  try {
    const value = JSON.parse(readFileSync(absolute, "utf8"));
    const systems = Array.isArray(value.systems) ? value.systems : [];
    const original = systems.filter((system) => system?.system !== "keyword" && system?.evidenceClass !== "local-baseline" && system?.leaderboardEligible === true);
    const originalRawOutput = systems.filter((system) =>
      system?.system !== "keyword" &&
      system?.system !== "cognibrain" &&
      system?.evidenceClass === "same-run-command" &&
      Array.isArray(system?.rawOutputs) &&
      system.rawOutputs.length > 0
    );
    return {
      exists: true,
      originalEligibleSystems: original.length,
      originalSystemNames: original.map((system) => system.displayName ?? system.system).filter(Boolean),
      originalRawOutputSystems: originalRawOutput.length,
      originalRawOutputSystemNames: originalRawOutput.map((system) => system.displayName ?? system.system).filter(Boolean),
    };
  } catch {
    return { exists: true, originalEligibleSystems: 0, originalSystemNames: [], originalRawOutputSystems: 0, originalRawOutputSystemNames: [] };
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeJson(path, value) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function writeMarkdown(path, report) {
  const absolute = join(root, path);
  const lines = [
    "# Real-World Benchmark Protocol",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "This is a preregistration and evidence-classification artifact, not a leaderboard.",
    "",
    "## Current Conclusion",
    "",
    report.conclusion,
    "",
    "## Leaderboard Gate",
    "",
    "| Gate | Required | Rule |",
    "| --- | --- | --- |",
    ...report.requiredGate.map((item) => `| \`${item.id}\` | ${item.required ? "Yes" : "No"} | ${item.rule} |`),
    "",
    "## Current Artifact Classes",
    "",
    "| Artifact | Exists | Class | Leaderboard eligible | Use | Missing for leaderboard |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.currentArtifacts.map((artifact) =>
      `| \`${artifact.path}\` | ${artifact.exists ? "Yes" : "No"} | \`${artifact.className}\` | ${artifact.leaderboardEligible ? "Yes" : "No"} | ${artifact.allowedUse} | ${artifact.missingForLeaderboard.join("; ")} |`
    ),
    "",
    "## Real-World Buckets",
    "",
    "| Bucket | Source | Metrics |",
    "| --- | --- | --- |",
    ...report.realWorldBuckets.map((bucket) => `| \`${bucket.id}\` | ${bucket.source} | ${bucket.metrics.join(", ")} |`),
    "",
    "## Cognibrain Improvement Backlog",
    "",
    "| Priority | Item | Reason |",
    "| --- | --- | --- |",
    ...report.nextCognibrainImprovements.map((item) => `| ${item.priority} | ${item.item} | ${item.reason} |`),
    "",
  ];
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${lines.join("\n")}`);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
