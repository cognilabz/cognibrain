import { execFileSync } from "node:child_process";
import { runAnswerGenerationBenchmark } from "./answerGeneration";

export function runCertifiedBenchmarks(args = process.argv.slice(2)) {
  const retrievalOnly = args.includes("--retrieval-only");
  run("npm", ["run", "benchmark:locomo", "--", "--top-k", "20"]);
  run("npm", ["run", "benchmark:longmemeval", "--", "--top-k", "20"]);
  run("npm", ["run", "benchmark:beam", "--", "--split", "100K", "--top-k", "20"]);
  run("npm", ["run", "benchmark:beam:500k"]);
  if (!retrievalOnly) {
    runAnswerGenerationBenchmark({ outputPath: "artifacts/answer-generation.json" });
  }
  run("npm", ["run", "benchmark:market"]);
  return { retrievalOnly, answerGeneration: !retrievalOnly };
}

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: "inherit" });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runCertifiedBenchmarks();
  console.log(JSON.stringify(report, null, 2));
}
