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
    "benchmarks/reality/rubrics/privacy-boundary-v1.md"
  ].map((path) => readFileSync(path, "utf8")).join("\n").toLowerCase();
  return !/\b(beats|outperforms|sota|market-leading)\b/.test(docs);
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
