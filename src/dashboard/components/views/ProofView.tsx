import React, { useMemo } from "react";
import { Activity, BarChart3, CheckCircle2, FileJson, GitBranch, Network } from "lucide-react";
import type { MetricsReport } from "../../../core";
import { beamCategories, benchmarkArenaProof, certifiedBenchmarks, harnessProof, harnessRunProof, nextgenProof, patchEvidenceProof } from "../../fixtures";

export function ProofView({
  artifactText,
  setArtifactText,
  artifactSummary,
  metrics
}: {
  artifactText: string;
  setArtifactText: (value: string) => void;
  artifactSummary: string[];
  metrics?: MetricsReport;
}) {
  return (
    <section className="proof-layout">
      <div className="benchmark-grid">
        {certifiedBenchmarks.map((benchmark) => (
          <article key={benchmark.dataset} className="benchmark-card">
            <div>
              <span>{benchmark.metric}</span>
              <strong>{benchmark.dataset}</strong>
            </div>
            <b>{benchmark.accuracy.toFixed(2)}%</b>
            <small>cognibrain {benchmark.ours}</small>
            <small>Best baseline {benchmark.baseline}</small>
            <em>+{benchmark.margin.toFixed(2)}pp margin</em>
            <code>{benchmark.artifact}</code>
          </article>
        ))}
      </div>
      <div className="proof-split">
        <div className="panel">
          <h2><Activity size={17} /> Runtime Analytics</h2>
          <div className="ability-list">
            <div className="ability-row"><span>searches</span><strong>{metrics?.searches ?? 0}</strong></div>
            <div className="ability-row"><span>no-hit</span><strong>{metrics?.noHitSearches ?? 0}</strong></div>
            <div className="ability-row"><span>low confidence</span><strong>{metrics?.lowConfidenceSearches ?? 0}</strong></div>
            <div className="ability-row"><span>benchmark runs</span><strong>{metrics?.benchmarkRuns ?? 0}</strong></div>
          </div>
        </div>
        <div className="panel">
          <h2><CheckCircle2 size={17} /> BEAM Ability Breakdown</h2>
          <div className="ability-list">
            {beamCategories.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><GitBranch size={17} /> Nextgen Substrate</h2>
          <div className="ability-list">
            {nextgenProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><BarChart3 size={17} /> Benchmark Arena</h2>
          <div className="ability-list">
            {benchmarkArenaProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><Network size={17} /> Harness Packages</h2>
          <div className="ability-list">
            {harnessProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><Activity size={17} /> Harness Runs</h2>
          <div className="ability-list">
            {harnessRunProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><FileJson size={17} /> Patch Evidence Trail</h2>
          <div className="ability-list">
            {patchEvidenceProof.map(([label, value]) => (
              <div key={label} className="ability-row">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><BarChart3 size={17} /> Proof Trend</h2>
          <div className="trend-list">
            {certifiedBenchmarks.map((benchmark) => (
              <div key={benchmark.dataset} className="trend-row">
                <span>{benchmark.dataset}</span>
                <meter min={0} max={100} value={benchmark.accuracy} />
                <strong>+{benchmark.margin.toFixed(2)}pp</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2><FileJson size={17} /> Artifact Inspector</h2>
          <p>Paste local or CI-uploaded benchmark JSON to inspect proof without leaving the operator console.</p>
          <textarea
            value={artifactText}
            onChange={(event) => setArtifactText(event.target.value)}
            placeholder="Paste market-gate.json or a benchmark report JSON"
          />
          <div className="artifact-summary">
            {artifactSummary.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <CogniCodeBenchAblation artifactText={artifactText} />
        </div>
      </div>
    </section>
  );
}

export function CogniCodeBenchAblation({ artifactText }: { artifactText: string }) {
  const rows = useMemo(() => {
    if (!artifactText.trim()) return [];
    try {
      const parsed = JSON.parse(artifactText) as {
        benchmark?: string;
        ablation?: Record<string, { score?: number; deltaFromFull?: number }>;
      };
      if (parsed.benchmark !== "CogniCodeBench" || !parsed.ablation) return [];
      return Object.entries(parsed.ablation)
        .map(([name, value]) => ({
          name,
          score: Number(value.score ?? 0),
          delta: Number(value.deltaFromFull ?? 0)
        }))
        .sort((a, b) => b.score - a.score);
    } catch {
      return [];
    }
  }, [artifactText]);
  if (!rows.length) return null;
  return (
    <div className="trend-list" aria-label="CogniCodeBench ablation chart">
      {rows.map((row) => (
        <div key={row.name} className="trend-row">
          <span>{row.name}</span>
          <meter min={0} max={100} value={Math.round(row.score * 100)} />
          <strong>{(row.score * 100).toFixed(1)}%</strong>
        </div>
      ))}
    </div>
  );
}

export function summarizeArtifact(value: string): string[] {
  if (!value.trim()) return ["Paste an artifact to inspect pass status, proof level, and benchmark rows."];
  try {
    const parsed = JSON.parse(value) as {
      passed?: boolean;
      proofLevel?: string;
      source?: { name?: string };
      ours?: { correct?: number; total?: number; accuracy?: number };
      benchmarks?: Array<{
        dataset?: string;
        name?: string;
        margin?: number;
        accuracy?: number;
        ours?: { correct?: number; total?: number; accuracy?: number };
        questions?: Array<{ id: string; passed?: boolean; score?: number; expected?: string[]; retrieved?: string[] }>;
      }>;
      datasets?: Array<{
        dataset: string;
        score: number;
        total?: number;
        questions?: Array<{ id: string; generatedAnswer?: string; expected?: string[]; judge?: { passed?: boolean; score?: number; reason?: string } }>;
      }>;
      benchmark?: string;
      scenarioCount?: number;
      systems?: Array<{ displayName?: string; score?: number; proofLevel?: string; metrics?: { repeatedMistakeRate?: number }; capabilityGaps?: string[] }>;
      leaderboard?: Array<{ system?: string; score?: number; proofLevel?: string; repeatedMistakeRate?: number; gaps?: number }>;
      metrics?: {
        correctionCarryoverRate?: number;
        repeatedMistakeRate?: number;
        procedureRecallRate?: number;
        wrongMemorySuppression?: number;
      };
      ablation?: Record<string, { score?: number }>;
      harnessRuns?: Array<{ harness?: string; repo?: string; passed?: boolean; checks?: Record<string, boolean> }>;
      checks?: Record<string, boolean>;
    };
    if (parsed.harnessRuns?.length) {
      return [
        `connectorProof passed=${String(parsed.passed)} checks=${Object.values(parsed.checks ?? {}).filter(Boolean).length}/${Object.keys(parsed.checks ?? {}).length}`,
        ...parsed.harnessRuns.map((run) => {
          const passed = Object.values(run.checks ?? {}).filter(Boolean).length;
          const total = Object.keys(run.checks ?? {}).length;
          return `${run.harness ?? "harness"} repo=${run.repo ?? "n/a"} passed=${String(run.passed)} ${passed}/${total}`;
        })
      ];
    }
    if (parsed.benchmark === "CogniCodeBench") {
      const full = parsed.ablation?.cognibrain_full?.score ?? 0;
      const bestBaseline = Math.max(...Object.entries(parsed.ablation ?? {}).filter(([name]) => name !== "cognibrain_full").map(([, value]) => value.score ?? 0), 0);
      return [
        `benchmark=CogniCodeBench scenarios=${parsed.scenarioCount ?? 0}`,
        `passed=${String(parsed.passed)} full=${(full * 100).toFixed(2)}% bestBaseline=${(bestBaseline * 100).toFixed(2)}%`,
        `correctionCarryover=${parsed.metrics?.correctionCarryoverRate ?? 0}`,
        `repeatedMistakeRate=${parsed.metrics?.repeatedMistakeRate ?? 1}`,
        `procedureRecall=${parsed.metrics?.procedureRecallRate ?? 0}`,
        `wrongMemorySuppression=${parsed.metrics?.wrongMemorySuppression ?? 0}`
      ];
    }
    if (parsed.benchmark === "BenchmarkArena") {
      const winner = parsed.leaderboard?.[0];
      const cognibrain = parsed.systems?.find((system) => system.displayName === "Cognibrain");
      return [
        `benchmark=BenchmarkArena scenarios=${parsed.scenarioCount ?? 0}`,
        `winner=${winner?.system ?? "unknown"} score=${(((winner?.score ?? 0) as number) * 100).toFixed(2)}% proof=${winner?.proofLevel ?? "unknown"}`,
        `cognibrainProof=${cognibrain?.proofLevel ?? "unknown"} repeatedMistakeRate=${cognibrain?.metrics?.repeatedMistakeRate ?? "n/a"}`,
        `systems=${parsed.systems?.length ?? parsed.leaderboard?.length ?? 0}`,
        `boundary=API-shape rows are not vendor-hosted certifications`
      ];
    }
    if (parsed.benchmarks) {
      const failedRows = parsed.benchmarks.flatMap((benchmark) =>
        (benchmark.questions ?? [])
          .filter((question) => question.passed === false)
          .slice(0, 4)
          .map((question) => `${benchmark.dataset ?? benchmark.name ?? "benchmark"}/${question.id}: failed, expected ${(question.expected ?? []).slice(0, 3).join(", ") || "n/a"}`)
      );
      return [
        `passed=${parsed.passed === undefined ? "not provided" : String(parsed.passed)}`,
        `proof=${parsed.proofLevel ?? "unknown"}`,
        ...parsed.benchmarks.map((benchmark) => {
          const label = benchmark.dataset ?? benchmark.name ?? "benchmark";
          const score = benchmark.ours?.correct !== undefined && benchmark.ours?.total !== undefined
            ? `${benchmark.ours.correct}/${benchmark.ours.total}`
            : benchmark.accuracy !== undefined
              ? `${(benchmark.accuracy * 100).toFixed(2)}%`
              : "score unavailable";
          const margin = benchmark.margin !== undefined ? `, margin ${(benchmark.margin * 100).toFixed(2)}pp` : "";
          return `${label}: ${score}${margin}, questions=${benchmark.questions?.length ?? 0}`;
        }),
        ...(failedRows.length ? ["Failed question rows:", ...failedRows] : ["Failed question rows: none in artifact"])
      ];
    }
    if (parsed.datasets) {
      const failedRows = parsed.datasets.flatMap((dataset) =>
        (dataset.questions ?? [])
          .filter((question) => question.judge?.passed === false)
          .slice(0, 4)
          .map((question) => `${dataset.dataset}/${question.id}: score ${(question.judge?.score ?? 0).toFixed(2)}, expected ${(question.expected ?? []).slice(0, 3).join(", ") || "n/a"}`)
      );
      return [
        `answer-artifact datasets=${parsed.datasets.length}`,
        ...parsed.datasets.map((dataset) => `${dataset.dataset}: score ${(dataset.score * 100).toFixed(2)}%, questions=${dataset.total ?? dataset.questions?.length ?? 0}`),
        ...(failedRows.length ? ["Failed judged rows:", ...failedRows] : ["Failed judged rows: none in artifact"])
      ];
    }
    if (parsed.ours) {
      return [
        `dataset=${parsed.source?.name ?? "unknown"}`,
        `passed=${String(parsed.passed)}`,
        `score=${parsed.ours.correct}/${parsed.ours.total}`,
        `accuracy=${(((parsed.ours.accuracy ?? 0) * 100)).toFixed(2)}%`
      ];
    }
    return ["Artifact parsed, but no known benchmark fields were found."];
  } catch (error) {
    return [`Invalid JSON: ${(error as Error).message}`];
  }
}
