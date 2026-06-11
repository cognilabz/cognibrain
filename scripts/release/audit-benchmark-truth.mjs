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
    && report.includes("report.manifestHash !== verifiedManifestHash")
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
checks.push(check("docs-visible benchmark page preserves public-results boundary", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("Public-results boundary:")
    && docs.includes("marketClaimAllowed=true")
    && docs.includes("must not be used as competitor-proof");
}));
checks.push(check("docs-visible benchmark page states current EMRP market-proof blocker", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("Current checked EMRP status:")
    && docs.includes("original competitor command")
    && docs.includes("shared judge traces");
}));
checks.push(check("docs-visible arena rows are demoted from competitor comparisons", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  const svg = readFileSync("docs/assets/benchmark-results.svg", "utf8");
  return /not original product\s+runs or competitor comparisons/.test(docs)
    && svg.includes("Arena Internal Diagnostics")
    && svg.includes("not competitor comparisons");
}));
checks.push(check("docs-visible benchmark chart labels diagnostics as not market proof", () => {
  const svg = readFileSync("docs/assets/benchmark-results.svg", "utf8");
  return svg.includes("Benchmark Diagnostics (Not Market Proof)")
    && svg.includes("not quality, competitor, or market-leadership proof")
    && svg.includes("diagnostic only · claim blocked");
}));
checks.push(check("reality evidence table renders blockers before diagnostic scores", () => {
  const report = readFileSync("src/eval/reality/report.ts", "utf8");
  const runner = readFileSync("src/eval/reality/runner.ts", "utf8");
  return report.includes("| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |")
    && runner.includes("| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |");
}));
checks.push(check("docs-visible benchmark tables carry adjacent proof and claim status", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("| Metric | Diagnostic result | Proof | Claim status |")
    && docs.includes("| Baseline | Diagnostic score | Repeated mistake rate | Proof | Claim status |")
    && docs.includes("| System | Benchmark | Status | Evidence | Proof | Claim status |")
    && docs.includes("| System | Proof level | Claim status | Mode | Scenarios | Diagnostic score |")
    && docs.includes("| System | Proof level | Claim status | Mode | Scenarios | Diagnostic score | Repeated mistake rate |")
    && !docs.includes("| Baseline | Score |")
    && !docs.includes("| System | Proof level | Claim status | Mode | Scenarios | Score |");
}));
checks.push(check("original public benchmark rows carry adjacent proof and claim status", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("| LongMemEval official flat-bm25 baseline | LongMemEval official retrieval | Passed |")
    && docs.includes("`exact-upstream-single-system` | claim blocked; not cross-system market proof")
    && docs.includes("| Basic Memory | Basic Memory full upstream benchmark marker suite | Passed |")
    && docs.includes("`exact-upstream-single-system` | claim blocked; not same-protocol market proof");
}));
checks.push(check("native competitor rows are not scored while judge is missing", () => {
  const docs = readFileSync("docs/benchmarks.md", "utf8");
  return docs.includes("| Mem0 | `same-run-native` | Judge required; claim blocked | `native-command` | 30 | not scored | not scored |")
    && docs.includes("| LangMem | `same-run-native` | Judge required; claim blocked | `native-command` | 30 | not scored | not scored |")
    && docs.includes("| GBrain | `same-run-cli` | Judge required; claim blocked | `cli-command` | 30 | not scored | not scored |")
    && docs.includes("| Basic Memory | `same-run-native` | Judge required; claim blocked | `native-command` | 30 | not scored | not scored |");
}));
checks.push(check("SVG judge-blocked native rows render as not scored", () => {
  const source = readFileSync("scripts/release/render-benchmark-svg.mjs", "utf8");
  const svg = readFileSync("docs/assets/benchmark-results.svg", "utf8");
  return source.includes("isJudgeBlockedArenaRow")
    && source.includes("notScored")
    && svg.includes("not scored")
    && svg.includes("same-run-native · judge required · claim blocked")
    && !new RegExp("LangMem[\\s\\S]{0,320}>0\\.0%</text>").test(svg);
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

function unboundedMarketLanguageLines(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /\b(beats|outperforms|sota|market-leading|winner|best|leaderboard|score)\b/i.test(line))
    .filter((line) => !/\b(no|not|never|blocked|diagnostic|boundary|claim|eligible|eligibility|artifact|protocol|evidence|classifier|proof|question|replaced|until|unless)\b/i.test(line));
}
