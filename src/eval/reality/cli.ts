import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { realityAdapters } from "./adapters";
import { freezeRealityManifest, loadRealityManifest } from "./manifest";
import { publishRealityEvidenceTable } from "./report";
import { runRealityBenchmark } from "./runner";

const command = process.argv[2] ?? "run";
const args = process.argv.slice(3);

function arg(name: string, fallback?: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function requiredArg(name: string, fallback: string) {
  return arg(name, fallback) ?? fallback;
}

if (command === "freeze") {
  console.log(JSON.stringify(freezeRealityManifest({
    manifestPath: arg("--manifest"),
    lockPath: arg("--lock"),
    count: Number(arg("--count", "60"))
  }), null, 2));
} else if (command === "run" || command === "judge") {
  const outPath = requiredArg("--out", command === "judge" ? "artifacts/reality/emrp-v1-judge.json" : "artifacts/reality/emrp-v1-report.json");
  const report = runRealityBenchmark({
    manifestPath: arg("--manifest"),
    lockPath: arg("--lock"),
    outPath,
    markdownPath: arg("--markdown", "artifacts/docs/reality-emrp-v1.md"),
    systems: arg("--systems")?.split(",")
  });
  if (command === "judge" && !process.env.MEMORY_REALITY_JUDGE_COMMAND) {
    report.claimGate.blockers.unshift("MEMORY_REALITY_JUDGE_COMMAND is not configured; judge step is recorded as blocked.");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify({ outPath, marketClaimAllowed: report.claimGate.marketClaimAllowed, systems: report.systems.length }, null, 2));
} else if (command === "publish") {
  console.log(JSON.stringify(publishRealityEvidenceTable({ inputPath: arg("--input"), outputDir: arg("--out") }), null, 2));
} else if (command === "verify") {
  const { tasks, lock } = loadRealityManifest(arg("--manifest"), arg("--lock"));
  console.log(JSON.stringify({ ok: true, protocol: lock.protocol, taskCount: tasks.length, sha256: lock.sha256 }, null, 2));
} else if (command === "competitors") {
  console.log(JSON.stringify({
    protocol: "emrp-v1",
    adapters: realityAdapters.map((adapter) => ({
      system: adapter.system,
      adapterKind: adapter.adapterKind,
      commandEnv: adapter.commandEnv ?? null,
      majorCompetitor: adapter.majorCompetitor,
      originalImplementation: adapter.originalImplementation,
      profileModelForbidden: Boolean(adapter.profileModelForbidden)
    }))
  }, null, 2));
} else {
  console.error(`Unknown reality benchmark command: ${command}`);
  process.exit(1);
}
