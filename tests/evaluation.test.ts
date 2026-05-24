import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runEvaluation } from "../src/eval/run";
import { runLocomoBenchmark } from "../src/eval/locomo";
import { runLongMemEvalBenchmark } from "../src/eval/longmemeval";
import { runMarketGate } from "../src/eval/marketGate";
import { runBeamBenchmark } from "../src/eval/beam";

describe("self verification benchmark loop", () => {
  it("beats local baselines and satisfies the synthetic token-efficiency gate", () => {
    const report = runEvaluation();
    expect(report.passed).toBe(true);
    expect(report.ours.accuracy).toBeGreaterThan(Math.max(...report.baselines.map((item) => item.accuracy)));
    expect(report.ours.meanTokens).toBeLessThan(report.marketGate.requiredMeanTokensUnder);
  });

  it("runs an official LoCoMo evidence-recall slice with the user simulator", () => {
    const report = runLocomoBenchmark({
      maxQuestions: 40,
      topK: 10,
      outputPath: "artifacts/test-locomo-report.json"
    });
    expect(report.ours.total).toBe(40);
    expect(report.ours.accuracy).toBeGreaterThan(Math.max(...report.baselines.map((item) => item.accuracy)));
  }, 15_000);

  it("runs a LongMemEval-style answer-session recall fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-lme-"));
    const datasetPath = join(dir, "longmemeval.json");
    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          question_id: "q1",
          question_type: "single-session-user",
          question: "What degree did I graduate with?",
          answer: "Business Administration",
          answer_session_ids: ["answer_1"],
          haystack_dates: ["2023/05/20", "2023/05/21"],
          haystack_session_ids: ["distractor_1", "answer_1"],
          haystack_sessions: [
            [{ role: "user", content: "I like green tea in the morning." }],
            [{ role: "user", content: "I graduated with a Business Administration degree." }]
          ]
        }
      ])
    );
    const report = runLongMemEvalBenchmark({
      datasetPath,
      topK: 1,
      outputPath: join(dir, "report.json")
    });
    expect(report.passed).toBe(true);
    expect(report.ours.correct).toBe(1);
  });

  it("runs a BEAM-style retrieval nugget fixture with the user simulator", async () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-beam-"));
    const datasetPath = join(dir, "beam.json");
    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          conversation_id: "beam-fixture-1",
          conversation_seed: { category: "Coding", id: 1, title: "Fixture" },
          chat: [
            [
              { role: "user", content: "I decided to use Redis for the cache layer.", index: "1,1" },
              { role: "assistant", content: "Noted. Redis will back the cache layer.", index: "1,2" }
            ]
          ],
          probing_questions:
            "{'information_extraction': [{'question': 'Which technology did I choose for the cache layer?', 'ideal_response': 'The user chose Redis for the cache layer.', 'rubric': ['Redis', 'cache layer']}]}"
        }
      ])
    );
    const report = await runBeamBenchmark({
      datasetPath,
      maxConversations: 1,
      topK: 2,
      outputPath: join(dir, "report.json")
    });
    expect(report.ours.total).toBe(1);
    expect(report.ours.correct).toBe(1);
  });

  it("imports directly comparable competitor artifacts for the market gate", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-market-"));
    const locomoPath = join(dir, "locomo.json");
    const longMemEvalPath = join(dir, "longmemeval.json");
    const competitorsPath = join(dir, "competitors.json");
    const outputPath = join(dir, "market.json");
    const reportShape = {
      ours: { name: "open-memory-harness", accuracy: 0.9, correct: 9, total: 10 },
      baselines: [{ name: "keyword-only", accuracy: 0.7, correct: 7, total: 10 }]
    };
    writeFileSync(
      locomoPath,
      JSON.stringify({
        ...reportShape,
        source: { name: "LoCoMo", metric: "Evidence recall@K against LoCoMo QA evidence dialog ids" }
      })
    );
    writeFileSync(
      longMemEvalPath,
      JSON.stringify({
        ...reportShape,
        source: { name: "LongMemEval-S", metric: "Answer-session recall@K against answer_session_ids" }
      })
    );
    writeFileSync(
      competitorsPath,
      JSON.stringify({
        competitors: [
          {
            name: "fixture-vendor",
            sourceUrl: "https://example.com/fixture-vendor",
            benchmarks: [
              {
                dataset: "LongMemEval-S",
                metric: "Answer-session recall@K against answer_session_ids",
                accuracy: 0.8,
                comparable: true,
                topK: 20,
                notes: "Fixture uses the same dataset, metric and top-K as the local market gate."
              }
            ]
          }
        ]
      })
    );
    const report = runMarketGate({ locomoPath, longMemEvalPath, competitorsPath, outputPath });
    expect(report.passed).toBe(true);
    expect(report.directMarketComparison.configured).toBe(true);
    expect(report.directMarketComparison.passed).toBe(true);
  });

  it("treats perfect benchmark ties as saturated without allowing lower ties", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-market-saturated-"));
    const locomoPath = join(dir, "locomo.json");
    const longMemEvalPath = join(dir, "longmemeval.json");
    const outputPath = join(dir, "market.json");
    writeFileSync(
      locomoPath,
      JSON.stringify({
        ours: { name: "open-memory-harness", accuracy: 0.9, correct: 9, total: 10 },
        baselines: [{ name: "keyword-only", accuracy: 0.7, correct: 7, total: 10 }],
        source: { name: "LoCoMo", metric: "Evidence recall@K against LoCoMo QA evidence dialog ids" }
      })
    );
    writeFileSync(
      longMemEvalPath,
      JSON.stringify({
        ours: { name: "open-memory-harness", accuracy: 1, correct: 10, total: 10 },
        baselines: [{ name: "keyword-only", accuracy: 1, correct: 10, total: 10 }],
        source: { name: "LongMemEval-S", metric: "Answer-session recall@K against answer_session_ids" }
      })
    );

    const saturated = runMarketGate({ locomoPath, longMemEvalPath, outputPath });
    expect(saturated.passed).toBe(true);
    expect(saturated.benchmarks.find((item) => item.dataset === "LongMemEval-S")?.saturated).toBe(true);

    writeFileSync(
      longMemEvalPath,
      JSON.stringify({
        ours: { name: "open-memory-harness", accuracy: 0.8, correct: 8, total: 10 },
        baselines: [{ name: "keyword-only", accuracy: 0.8, correct: 8, total: 10 }],
        source: { name: "LongMemEval-S", metric: "Answer-session recall@K against answer_session_ids" }
      })
    );
    const lowerTie = runMarketGate({ locomoPath, longMemEvalPath, outputPath });
    expect(lowerTie.passed).toBe(false);
    expect(lowerTie.benchmarks.find((item) => item.dataset === "LongMemEval-S")?.saturated).toBe(false);
  });
});
