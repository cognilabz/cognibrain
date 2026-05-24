import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function updateReadmeMarketClaims(options: { readmePath?: string; marketGatePath?: string } = {}) {
  const readmePath = options.readmePath ?? "README.md";
  const marketGatePath = options.marketGatePath ?? "artifacts/market-gate-public.json";
  const readme = readFileSync(readmePath, "utf8");
  const gate = existsSync(marketGatePath) ? JSON.parse(readFileSync(marketGatePath, "utf8")) : undefined;
  const rows = gate?.benchmarks?.length
    ? gate.benchmarks.map((benchmark: { dataset: string; saturated?: boolean; ours: { correct: number; total: number; accuracy: number }; bestBaseline: { name: string; accuracy: number } }) => {
        const verb = benchmark.saturated ? "Saturates with" : "Beats";
        return `| ${benchmark.dataset} | \`${benchmark.ours.correct}/${benchmark.ours.total}\`, \`${pct(benchmark.ours.accuracy)}\` | ${verb} ${benchmark.bestBaseline.name} \`${pct(benchmark.bestBaseline.accuracy)}\` |`;
      })
    : ["| No generated market gate artifact found | `n/a` | Run `npm run benchmark:market` |"];
  const block = [
    "<!-- benchmark-claims:start -->",
    "| Dataset | cognibrain | Result |",
    "| --- | ---: | --- |",
    ...rows,
    "<!-- benchmark-claims:end -->"
  ].join("\n");
  const next = readme.match(/<!-- benchmark-claims:start -->[\s\S]*?<!-- benchmark-claims:end -->/)
    ? readme.replace(/<!-- benchmark-claims:start -->[\s\S]*?<!-- benchmark-claims:end -->/, block)
    : readme.replace(/Latest checked evidence:\n\n[\s\S]*?\n\nThe public market gate/, `Latest checked evidence:\n\n${block}\n\nThe public market gate`);
  writeFileSync(readmePath, next);
  return { readmePath, marketGatePath, updated: next !== readme };
}

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(updateReadmeMarketClaims(), null, 2));
}
