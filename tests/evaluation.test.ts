import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runEvaluation } from "../src/eval/run";
import { runLocomoBenchmark } from "../src/eval/locomo";
import { runLongMemEvalBenchmark } from "../src/eval/longmemeval";
import { runMarketGate } from "../src/eval/marketGate";
import { runBeamBenchmark } from "../src/eval/beam";
import { runAnswerGenerationBenchmark } from "../src/eval/answerGeneration";

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
      ours: {
        name: "open-memory-harness",
        accuracy: 0.9,
        correct: 9,
        total: 10,
        details: [{ id: "fixture-q1", question: "Which session contains the answer?", passed: true, score: 1, expectedEvidence: ["answer-session"], retrievedEvidence: ["answer-session"] }]
      },
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
                notes: "Fixture uses the same dataset, metric and top-K as the local market gate.",
                questions: [
                  {
                    id: "fixture-q1",
                    passed: true,
                    score: 1,
                    expected: ["answer-session"],
                    retrieved: ["answer-session"]
                  }
                ]
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
    expect(report.directMarketComparison.comparisons[0].questions[0]).toMatchObject({ id: "fixture-q1", matched: true });
    expect(report.benchmarks.find((item) => item.dataset === "LongMemEval-S")?.questions[0].id).toBe("fixture-q1");
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

  it("runs external answerer and judge commands for answer-generation artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-answer-provider-"));
    const reportPath = join(dir, "nextgen.json");
    const providerPath = join(dir, "provider.mjs");
    const outputPath = join(dir, "answers.json");
    writeFileSync(
      reportPath,
      JSON.stringify({
        suites: [
          {
            id: "external-proof",
            details: [{ id: "q1", question: "What cache is used?", expected: ["redis"], retrieved: ["Redis backs the cache."] }]
          }
        ]
      })
    );
    writeFileSync(
      providerPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); if (payload.task === "answer") console.log(JSON.stringify({ answer: "Redis backs the cache." })); else console.log(JSON.stringify({ score: 1, passed: true, reason: "external judge matched redis" })); });`
    );
    const previousAnswerer = process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND;
    const previousAnswererArgs = process.env.MEMORY_BENCHMARK_ANSWERER_ARGS;
    const previousJudge = process.env.MEMORY_BENCHMARK_JUDGE_COMMAND;
    const previousJudgeArgs = process.env.MEMORY_BENCHMARK_JUDGE_ARGS;
    try {
      process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND = process.execPath;
      process.env.MEMORY_BENCHMARK_ANSWERER_ARGS = providerPath;
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = process.execPath;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = providerPath;
      const artifact = runAnswerGenerationBenchmark({ reports: [reportPath], outputPath });
      expect(artifact.datasets[0].questions[0].generatedAnswer).toBe("Redis backs the cache.");
      expect(artifact.datasets[0].questions[0].judge.reason).toBe("external judge matched redis");
      expect(artifact.summary.meanScore).toBe(1);
    } finally {
      process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND = previousAnswerer;
      process.env.MEMORY_BENCHMARK_ANSWERER_ARGS = previousAnswererArgs;
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = previousJudge;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = previousJudgeArgs;
    }
  });
});
