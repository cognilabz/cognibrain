#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const checks = [];

checks.push(check("reality evidence table exists", () => existsSync("artifacts/public/evidence-table/index.json")));
checks.push(check("reality evidence table blocks market claims unless gate passes", () => {
  const artifact = readJson("artifacts/public/evidence-table/index.json");
  return artifact.protocol === "emrp-v1"
    && artifact.claimGate
    && artifact.claimGate.marketClaimAllowed === false
    && artifact.publication.status === "evidence-table-only"
    && artifact.systems.every((system) => system.marketClaimAllowed === false && system.leaderboardEligible === false);
}));
checks.push(check("reality leaderboard is absent while market gate is blocked", () => {
  const artifact = readJson("artifacts/public/evidence-table/index.json");
  return artifact.claimGate.marketClaimAllowed || !existsSync("artifacts/public/leaderboard/reality.json");
}));
checks.push(check("reality docs avoid positive market-superiority phrases", () => {
  const docs = [
    "benchmarks/reality/README.md",
    "benchmarks/reality/rubrics/answer-quality-v1.md",
    "benchmarks/reality/rubrics/engineering-action-v1.md",
    "benchmarks/reality/rubrics/privacy-boundary-v1.md",
    "docs/benchmarks.md",
    "docs/assets/benchmark-results.svg"
  ].map((path) => readFileSync(path, "utf8")).join("\n").toLowerCase();
  return unboundedMarketLanguageLines(docs).length === 0;
}));
checks.push(check("reality claim gate requires original commands and shared judge traces", () => {
  const source = readFileSync("src/eval/reality/claimGate.ts", "utf8");
  const types = readFileSync("src/eval/reality/types.ts", "utf8");
  const report = readFileSync("src/eval/reality/report.ts", "utf8");
  return source.includes("originalCompetitorCommandProofRecorded")
    && source.includes("rawOutputsFromOriginalCommands")
    && source.includes("sharedJudgeTracesRecorded")
    && source.includes("noDeterministicScaffoldOutputs")
    && source.includes("cognibrainEligibleSystemPresent")
    && source.includes("system.provenance?.originalCommandExecuted === true")
    && source.includes("system.provenance?.rawOutputsFromOriginalCommand === true")
    && source.includes("system.provenance?.sharedJudgeTrace === true")
    && source.includes("system.provenance?.deterministicScaffold !== false")
    && source.includes("manifestFrozenBeforeRun: isRealityIsoTimestamp(input.lock.frozenAt) && isRealityProofHash(input.lock.sha256)")
    && source.includes("export function isRealityIsoTimestamp")
    && source.includes("system.provenance?.manifestSha256 === expectedManifestSha256")
    && source.includes("system.provenance?.inputStreamSha256 === expectedManifestSha256")
    && source.includes("const commandProofCompetitors = majorCompetitors.filter((system) => isRealityClaimPublishableSystem(system, input.lock.sha256))")
    && source.includes("sameInputStream: eligibleOriginalSystems.length > 0 && eligibleOriginalSystems.every((system) => hasSameInputStreamProof(system, input.lock.sha256))")
    && !source.includes("sameInputStream: true")
    && source.includes("sameBudgets: input.sameBudgets === true")
    && !source.includes("sameBudgets: input.sameBudgets ?? true")
    && source.includes("isRealityProofHash(input.publicArtifactHash)")
    && source.includes("isRealityProofHash(input.independentReplicationHash)")
    && source.includes("sameBudgets: input.sameBudgets === true && isRealityProofHash(input.sameBudgetsProof)")
    && source.includes("sameJudge: input.sameJudge === true && isRealityProofHash(input.sameJudgeProof)")
    && !source.includes("publicArtifactHashPresent: Boolean(input.publicArtifactHash)")
    && !source.includes("independentReplicationHashPresent: Boolean(input.independentReplicationHash)")
    && source.includes("const qualityClaimAllowed = gates.manifestFrozenBeforeRun")
    && source.includes("&& gates.sameInputStream")
    && source.includes("&& gates.sameBudgets")
    && source.includes("&& gates.cognibrainEligibleSystemPresent")
    && source.includes("Deterministic scaffold outputs cannot open quality, market, or leaderboard claims.")
    && types.includes("originalCommandExecuted: boolean")
    && types.includes("sharedJudgeTrace: boolean")
    && types.includes("manifestSha256: string | null")
    && types.includes("inputStreamSha256: string | null")
    && types.includes("cognibrainEligibleSystemPresent: boolean")
    && report.includes("const verifiedClaimGate = realityClaimGate")
    && report.includes("const verifiedManifestHash = report.manifestLock.sha256")
    && report.includes("!isRealityProofHash(report.manifestHash)")
    && report.includes("!isRealityProofHash(verifiedManifestHash)")
    && report.includes("report.manifestHash !== verifiedManifestHash")
    && report.includes("!isRealityIsoTimestamp(report.generatedAt)")
    && report.includes("!isRealityIsoTimestamp(report.manifestLock.frozenAt)")
    && report.includes("Date.parse(report.manifestLock.frozenAt) > Date.parse(report.generatedAt)")
    && report.includes("isRealityClaimPublishableSystem(system, verifiedManifestHash)")
    && !report.includes("isRealityClaimPublishableSystem(system, report.manifestHash)")
    && report.includes("const validatedClaimEvidence =")
    && report.includes("isRealityProofHash(report.claimEvidence?.publicArtifactHash)")
    && report.includes("isRealityProofHash(report.claimEvidence?.independentReplicationHash)")
    && report.includes("sameJudge: isRealityProofHash(report.claimEvidence?.sameJudgeTraceId)")
    && report.includes("sameBudgets: isRealityProofHash(report.claimEvidence?.sameBudgetsProof)")
    && !report.includes("sameJudge: Boolean(report.claimEvidence?.sameJudgeTraceId)")
    && !report.includes("sameBudgets: Boolean(report.claimEvidence?.sameBudgetsProof)")
    && report.includes("sameJudgeTraceId: isRealityProofHash(report.claimEvidence?.sameJudgeTraceId)")
    && report.includes("sameBudgetsProof: isRealityProofHash(report.claimEvidence?.sameBudgetsProof)")
    && report.includes("claimEvidence: validatedClaimEvidence")
    && report.includes("Public artifact hash:")
    && report.includes("Independent replication hash:")
    && report.includes("Same judge proof:")
    && report.includes("Same budgets proof:")
    && report.includes("report.claimEvidence?.publicArtifactHash")
    && report.includes("report.claimEvidence?.sameJudgeTraceId")
    && report.includes("if (verifiedClaimGate.leaderboardAllowed)");
}));
checks.push(check("reality publish clamps row claim flags to the revalidated gate", () => {
  const report = readFileSync("src/eval/reality/report.ts", "utf8");
  return report.includes("const rowClaimPublishable = isRealityClaimPublishableSystem(system, verifiedManifestHash)")
    && report.includes("Row failed revalidated per-system provenance/eligibility gates.")
    && report.includes("qualityClaimAllowed: verifiedClaimGate.qualityClaimAllowed && rowClaimPublishable && system.qualityClaimAllowed")
    && report.includes("marketClaimAllowed: verifiedClaimGate.marketClaimAllowed && rowClaimPublishable && system.marketClaimAllowed")
    && report.includes("leaderboardEligible: verifiedClaimGate.leaderboardAllowed && rowClaimPublishable && system.leaderboardEligible")
    && !report.includes("qualityClaimAllowed: system.qualityClaimAllowed")
    && !report.includes("marketClaimAllowed: system.marketClaimAllowed")
    && !report.includes("leaderboardEligible: system.leaderboardEligible");
}));
checks.push(check("reality claim publication requires per-row provenance eligibility", () => {
  const source = readFileSync("src/eval/reality/claimGate.ts", "utf8");
  const runner = readFileSync("src/eval/reality/runner.ts", "utf8");
  return source.includes("export function isRealityClaimPublishableSystem")
    && source.includes("originalKinds.includes(system.adapterKind)")
    && source.includes("sameManifest")
    && source.includes("expectedManifestSha256")
    && source.includes("hasOriginalCommandProof(system)")
    && source.includes("hasOriginalCommandRawOutputProof(system)")
    && source.includes("hasSharedJudgeTraceProof(system)")
    && source.includes("!hasDeterministicScaffoldBlocker(system)")
    && source.includes("system.blockingReasons.length === 0")
    && source.includes("system.errors.length === 0")
    && source.includes("system.metrics.estimatedCostUsd !== null")
    && source.includes("system.metrics.p95LatencyMs !== null")
    && runner.includes("manifestSha256,")
    && runner.includes("inputStreamSha256: manifestSha256");
}));
checks.push(check("benchmark summary artifacts exist", () => {
  return existsSync("artifacts/public/benchmark-summary.json")
    && existsSync("artifacts/docs/benchmark-summary.md")
    && existsSync("docs/assets/benchmark-summary.svg");
}));
checks.push(check("benchmark summary is generated from current claim gate state", () => {
  const summary = readJson("artifacts/public/benchmark-summary.json");
  const reality = readJson("artifacts/public/evidence-table/index.json");
  return summary.schemaVersion === "1.0"
    && summary.claimLevel === "local-diagnostic"
    && summary.marketLeaderboardAllowed === false
    && summary.marketGate.allowed === reality.claimGate.marketClaimAllowed
    && summary.evidence.length <= 5
    && summary.keyResults.length <= 7;
}));
checks.push(check("docs-visible benchmark page uses Benchmark Evidence structure", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.startsWith("# Benchmark Evidence")
    && docs.includes("## Current Verdict")
    && docs.includes("## Evidence Matrix")
    && docs.includes("## What The Numbers Mean")
    && docs.includes("## Key Results")
    && docs.includes("## Known Limits And Failures")
    && docs.includes("## Reproduce / Artifacts")
    && docs.includes("## Appendix")
    && docs.includes("assets/benchmark-summary.svg");
}));
checks.push(check("docs-visible benchmark page states current EMRP market-proof blocker", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("Market leaderboard: Not open")
    && docs.includes("original competitor")
    && docs.includes("shared judge");
}));
checks.push(check("docs-visible score tables do not contain blocked or unscored rows", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  const scoreSections = extractSections(docs, ["## Evidence Matrix", "## Key Results"]);
  return !/\|\s*[^|\n]*(credential-blocked|missing:blocked|not scored)[^|\n]*\|/i.test(scoreSections);
}));
checks.push(check("docs-visible market gate carries blocked state as requirements", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("## Market Gate Status")
    && docs.includes("| Same judge traces | Missing |")
    && docs.includes("| Original competitor command outputs | Missing |")
    && docs.includes("| Public artifact hash | Missing |")
    && docs.includes("| Independent replication hash | Missing |")
    && docs.includes("| Market leaderboard | Closed |");
}));
checks.push(check("reality evidence table renders blockers before diagnostic scores", () => {
  const report = readFileSync("src/eval/reality/report.ts", "utf8");
  const runner = readFileSync("src/eval/reality/runner.ts", "utf8");
  return report.includes("| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |")
    && runner.includes("| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |");
}));
checks.push(check("docs-visible benchmark tables carry adjacent evidence and boundaries", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("| Question | Best current evidence | Result | Claim status | Limitation |")
    && docs.includes("| Result | Value | Evidence | Boundary |")
    && docs.includes("Each visible number above is backed by a generated timestamp and artifact path.")
    && !docs.includes("| Baseline | Score |")
    && !docs.includes("| System | Proof level | Claim status | Mode | Scenarios | Score |");
}));
checks.push(check("docs-visible competitor names stay out of score tables while gate is closed", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  const scoreSections = extractSections(docs, ["## Evidence Matrix", "## Key Results"]);
  return !/\b(Mem0|Zep|LangMem|Basic Memory|Graphiti|Cognee|GBrain)\b/.test(scoreSections)
    && docs.includes("original competitor systems");
}));
checks.push(check("summary SVG has no blocked competitor or not-scored bars", () => {
  const svg = readFileSync("docs/assets/benchmark-summary.svg", "utf8");
  return svg.includes("Benchmark Evidence")
    && svg.includes("Closed market gates are not rendered as scores")
    && !/not scored|credential-blocked|Mem0|Zep|LangMem|Basic Memory|Graphiti|Cognee|GBrain/i.test(svg);
}));

for (const item of checks) console.log(`${item.passed ? "ok" : "FAIL"} ${item.name}`);
const failed = checks.filter((item) => !item.passed);
if (failed.length) {
  console.error(`benchmark truth audit failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`benchmark truth audit passed: ${checks.length}/${checks.length}`);

function check(name, predicate) {
  let passed = false;
  try {
    passed = Boolean(predicate());
  } catch {
    passed = false;
  }
  return { name, passed };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractSections(text, headings) {
  return headings.map((heading) => {
    const start = text.indexOf(heading);
    if (start < 0) return "";
    const next = text.indexOf("\n## ", start + heading.length);
    return text.slice(start, next < 0 ? text.length : next);
  }).join("\n");
}

function unboundedMarketLanguageLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /\b(beats|outperforms|sota|market-leading|winner|best|leaderboard|score)\b/i.test(line))
    .filter((line) => !/\b(no|not|never|blocked|diagnostic|boundary|claim|eligible|eligibility|artifact|protocol|evidence|classifier|proof|question|replaced|until|unless)\b/i.test(line));
}
