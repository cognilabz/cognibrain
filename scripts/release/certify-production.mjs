#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const args = process.argv.slice(2);
const quick = args.includes("--quick");
const artifactPath = valueAfter("--out") ?? "artifacts/production-certification.json";

const requiredSteps = [
  ["unit tests", "npm", ["run", "test"]],
  ["dashboard build", "npm", ["run", "build"]],
  ["release contract audit", "npm", ["run", "internal", "--", "release:contract"]],
  ["full plan gap audit", "npm", ["run", "internal", "--", "audit:plan-gaps"]],
  ["operator maturity", "npm", ["run", "internal", "--", "operator:maturity"]],
  ["harness maturity", "npm", ["run", "internal", "--", "harness:maturity"]],
  ["connector certification", "npm", ["run", "internal", "--", "connectors:certification"]]
];

const fullSteps = [
  ["benchmark hardening", "npm", ["run", "internal", "--", "benchmark:hardening"]],
  ["connector compatibility", "npm", ["run", "internal", "--", "verify:compatibility"]],
  ["npm pack dry-run", "npm", ["pack", "--dry-run"]],
  ["npm pack smoke install", "node", ["scripts/release/pack-smoke.mjs"]],
  ["Python SDK tests", "python3", ["-m", "unittest", "discover", "-s", "sdk/python/tests"]]
];

const liveSteps = process.env.MEMORY_PRODUCTION_CERTIFY_LIVE === "true"
  ? [
      ["Postgres verifier", "npm", ["run", "internal", "--", "verify:postgres"]],
      ["tenant connector live smoke", "npm", ["run", "internal", "--", "verify:vendor-live"]]
    ]
  : [];

const steps = [...requiredSteps, ...(quick ? [] : fullSteps), ...liveSteps];
const results = [];
for (const [name, command, stepArgs] of steps) {
  const startedAt = new Date();
  const result = spawnSync(command, stepArgs, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
  const finishedAt = new Date();
  const entry = {
    name,
    command: [command, ...stepArgs].join(" "),
    ok: result.status === 0,
    status: result.status ?? 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    error: result.error?.message
  };
  results.push(entry);
  writeReport(results);
  console.log(`${entry.ok ? "ok" : "FAIL"} ${name} (${entry.durationMs}ms)`);
  if (!entry.ok) process.exit(entry.status || 1);
}

const finalReport = writeReport(results);
console.log(`production certification ${finalReport.summary.productionCertified ? "certified" : "candidate"}: ${finalReport.summary.passed}/${finalReport.summary.total} checks`);

function writeReport(items) {
  const connectorCertification = readJson("artifacts/connector-certification.json", { summary: {}, rows: [] });
  const productTruth = readJson("artifacts/product-truth-audit.json", { summary: {} });
  const productionCertifiedConnectors = Number(connectorCertification.summary?.productionCertified ?? 0);
  const tenantVerifiedConnectors = Number(connectorCertification.summary?.tenantVerified ?? 0);
  const liveProofEnabled = process.env.MEMORY_PRODUCTION_CERTIFY_LIVE === "true";
  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: quick ? "quick-production-certification" : "production-certification",
    summary: {
      total: items.length,
      passed: items.filter((item) => item.ok).length,
      failed: items.filter((item) => !item.ok).length,
      selfHostedCandidate: items.every((item) => item.ok) && productTruth.summary?.selfHostedCandidate !== false,
      productionCertified: items.every((item) => item.ok) && liveProofEnabled && productionCertifiedConnectors > 0,
      liveProofEnabled,
      tenantVerifiedConnectors,
      productionCertifiedConnectors,
      boundary: liveProofEnabled
        ? "production certification requires deployment-owned live storage, live connector, and owner approval artifacts"
        : "quick/local certification proves self-hosted candidate gates only; live tenant certification is not claimed"
    },
    steps: items
  };
  mkdirSync(dirname(join(root, artifactPath)), { recursive: true });
  writeFileSync(join(root, artifactPath), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    return fallback;
  }
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function tail(value = "") {
  return value.trim().split(/\r?\n/).filter(Boolean).slice(-30).join("\n");
}
