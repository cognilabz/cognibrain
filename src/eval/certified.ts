import { execFileSync } from "node:child_process";
import { runAnswerGenerationBenchmark } from "./answerGeneration";

export function runCertifiedBenchmarks(args = process.argv.slice(2)) {
  const retrievalOnly = args.includes("--retrieval-only");
  run("npx", ["tsx", "src/eval/locomo.ts", "--top-k", "20"]);
  run("npx", ["tsx", "src/eval/longmemeval.ts", "--top-k", "20"]);
  run("npx", ["tsx", "src/eval/beam.ts", "--split", "100K", "--top-k", "20"]);
  run("npx", ["tsx", "src/eval/beam.ts", "--split", "500K", "--top-k", "20", "--out", "artifacts/beam-500k-report.json"]);
  if (!retrievalOnly) {
    runAnswerGenerationBenchmark({ outputPath: "artifacts/answer-generation.json" });
  }
  run("npx", ["tsx", "src/eval/marketGate.ts"]);
  return { retrievalOnly, answerGeneration: !retrievalOnly };
}

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: "inherit" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runCertifiedBenchmarks();
  console.log(JSON.stringify(report, null, 2));
}
