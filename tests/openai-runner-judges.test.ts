import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function listenOnAllowedPort(server: ReturnType<typeof createServer>): Promise<void> {
  for (let port = 18181; port <= 18220; port += 1) {
    const listened = await new Promise<boolean>((resolve, reject) => {
      const cleanup = () => {
        server.off("error", onError);
      };
      const onError = (error: NodeJS.ErrnoException) => {
        cleanup();
        if (error.code === "EADDRINUSE") resolve(false);
        else reject(error);
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        cleanup();
        resolve(true);
      });
    });
    if (listened) return;
  }
  throw new Error("could not bind a local fixture server port");
}

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  await listenOnAllowedPort(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server did not bind to a TCP port");
  return `http://127.0.0.1:${address.port}/v1`;
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function runNodeScript(args: string[], options: { cwd: string; input: string; timeout: number; env: NodeJS.ProcessEnv }): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr });
    });
    child.stdin.end(options.input);
  });
}

describe("OpenAI-compatible runner judges", () => {
  it("records OpenAI-compatible operator-memory judge usage, cost and latency", async () => {
    const observed: { authorization?: string; responseFormat?: unknown } = {};
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        observed.authorization = request.headers.authorization;
        observed.responseFormat = payload.response_format;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                checks: {
                  currentTruthSelected: true,
                  staleTruthSuppressed: true,
                  sourceRefRevalidated: true,
                  connectorRefreshAccounted: false,
                  beliefRevisionApplied: true,
                  failureContained: false
                },
                confidence: 0.87,
                reason: "fixture openai-compatible operator judge"
              })
            }
          }],
          usage: { prompt_tokens: 100, completion_tokens: 25 }
        }));
      });
    });
    const baseUrl = await listen(server);
    try {
      const result = await runNodeScript([join(process.cwd(), "scripts/benchmark/operator-memory-openai-judge.mjs")], {
        cwd: process.cwd(),
        input: JSON.stringify({ system: "mem0-native", scenario: { id: "source-update" }, runnerOutput: { evidence: { text: "current source-backed evidence" } } }),
        timeout: 10_000,
        env: { ...process.env, MEMORY_OPENAI_API_KEY: "fixture-key", MEMORY_OPENAI_BASE_URL: baseUrl, MEMORY_OPERATOR_MEMORY_JUDGE_MODEL: "gpt-4.1-mini" }
      });
      expect(result.status).toBe(0);
      expect(observed.authorization).toBe("Bearer fixture-key");
      expect(observed.responseFormat).toEqual({ type: "json_object" });
      const output = JSON.parse(result.stdout);
      expect(output.checks.currentTruthSelected).toBe(true);
      expect(output.judge).toMatchObject({
        kind: "llm",
        provider: "openai-compatible",
        model: "gpt-4.1-mini",
        usage: { prompt_tokens: 100, completion_tokens: 25 },
        estimatedCostUsd: 0.00008
      });
      expect(output.judge.latencyMs).toBeGreaterThanOrEqual(0);
      expect(output.judge.pricing).toMatchObject({ inputCostPerMillionUsd: 0.4, outputCostPerMillionUsd: 1.6 });
    } finally {
      await close(server);
    }
  });

  it("records OpenAI-compatible operator-memory report quality judge usage, cost and latency", async () => {
    const observed: { authorization?: string; responseFormat?: unknown; userPayload?: unknown } = {};
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        observed.authorization = request.headers.authorization;
        observed.responseFormat = payload.response_format;
        observed.userPayload = JSON.parse(payload.messages[1].content);
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                passed: true,
                score: 0.92,
                reason: "fixture openai-compatible operator quality judge",
                evidence: { reviewer: "fixture" }
              })
            }
          }],
          usage: { prompt_tokens: 200, completion_tokens: 50 }
        }));
      });
    });
    const baseUrl = await listen(server);
    try {
      const result = await runNodeScript([join(process.cwd(), "scripts/benchmark/operator-memory-quality-openai-judge.mjs")], {
        cwd: process.cwd(),
        input: JSON.stringify({
          contract: "cognibrain-operator-memory-quality-llm-harness-judge-v1",
          scenarioCount: 1,
          cognibrainScore: 1,
          bestBaselineScore: 0.4,
          leaderboard: [{ system: "Cognibrain source-aware Dream", score: 1, proofLevel: "same-run-full" }],
          systems: [{
            system: "cognibrain-dream",
            displayName: "Cognibrain source-aware Dream",
            proofLevel: "same-run-full",
            adapterMode: "full-local",
            score: 1,
            metrics: { currentTruthAccuracy: 1 },
            scenarios: [{
              scenarioId: "source-update",
              title: "Source update",
              kind: "source_update",
              score: 1,
              checks: {
                currentTruthSelected: true,
                staleTruthSuppressed: true,
                sourceRefRevalidated: true,
                connectorRefreshAccounted: true,
                beliefRevisionApplied: true,
                failureContained: true
              },
              evidence: { injectedContents: ["current semantic source-backed evidence"], topContents: ["omitted from trimmed payload"] }
            }]
          }]
        }),
        timeout: 10_000,
        env: { ...process.env, MEMORY_OPENAI_API_KEY: "fixture-key", MEMORY_OPENAI_BASE_URL: baseUrl, MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_MODEL: "gpt-4.1-mini" }
      });
      expect(result.status).toBe(0);
      expect(observed.authorization).toBe("Bearer fixture-key");
      expect(observed.responseFormat).toEqual({ type: "json_object" });
      expect(JSON.stringify(observed.userPayload)).not.toContain("omitted from trimmed payload");
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        passed: true,
        score: 0.92,
        reason: "fixture openai-compatible operator quality judge",
        evidence: {
          reviewer: "fixture",
          judge: {
            kind: "llm",
            provider: "openai-compatible",
            model: "gpt-4.1-mini",
            usage: { prompt_tokens: 200, completion_tokens: 50 },
            estimatedCostUsd: 0.00016
          }
        }
      });
      expect(output.evidence.judge.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      await close(server);
    }
  });

  it("records OpenAI-compatible CogniCodeBench report quality judge usage, cost and latency", async () => {
    const observed: { authorization?: string; responseFormat?: unknown; userPayload?: unknown } = {};
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        observed.authorization = request.headers.authorization;
        observed.responseFormat = payload.response_format;
        observed.userPayload = JSON.parse(payload.messages[1].content);
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                passed: true,
                score: 0.91,
                reason: "fixture openai-compatible CogniCodeBench quality judge",
                evidence: { reviewer: "fixture" }
              })
            }
          }],
          usage: { prompt_tokens: 300, completion_tokens: 75 }
        }));
      });
    });
    const baseUrl = await listen(server);
    try {
      const result = await runNodeScript([join(process.cwd(), "scripts/benchmark/cognicodebench-quality-openai-judge.mjs")], {
        cwd: process.cwd(),
        input: JSON.stringify({
          contract: "cognibrain-cognicodebench-quality-llm-harness-judge-v1",
          scenarioCount: 1,
          metrics: { score: 1, correctionCarryover: 1 },
          diagnostics: { integrity: { expectedLeakage: 0.01, expectedDirectPatchHarness: false } },
          baselines: [{ name: "recency", score: 0.52 }],
          ablation: { no_source_graph: { score: 0.71, deltaFromFull: -0.29 } },
          scenarios: [{
            id: "cognicode-001",
            nextTask: "Fix the cache invalidation regression.",
            correction: { memoryKind: "test_strategy", content: "Use the integration regression harness.", correctAction: "npm run test:integration" },
            wrongAction: { command: "npm test", reason: "misses integration path", filesChanged: ["src/cache.ts"] },
            expected: { referencedKinds: ["test_strategy"], filesChanged: ["src/cache.ts"], command: "npm run test:integration" }
          }],
          results: [{
            id: "cognicode-001",
            passed: true,
            score: 1,
            checks: { correctionRecalled: true, wrongActionSuppressed: true, patchCorrect: true },
            evidence: {
              guardSeverity: "block",
              referencedKinds: ["test_strategy"],
              patchProposal: {
                mode: "external-harness",
                status: "passed",
                command: "npm run test:integration",
                filesChanged: ["src/cache.ts"],
                reason: "semantic correction evidence",
                evidence: { evidenceKinds: ["test_strategy"], evidenceMemoryIds: ["omitted from trimmed payload"] }
              }
            }
          }]
        }),
        timeout: 10_000,
        env: { ...process.env, MEMORY_OPENAI_API_KEY: "fixture-key", MEMORY_OPENAI_BASE_URL: baseUrl, MEMORY_COGNICODEBENCH_QUALITY_JUDGE_MODEL: "gpt-4.1-mini" }
      });
      expect(result.status).toBe(0);
      expect(observed.authorization).toBe("Bearer fixture-key");
      expect(observed.responseFormat).toEqual({ type: "json_object" });
      expect(JSON.stringify(observed.userPayload)).not.toContain("omitted from trimmed payload");
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({
        passed: true,
        score: 0.91,
        reason: "fixture openai-compatible CogniCodeBench quality judge",
        evidence: {
          reviewer: "fixture",
          judge: {
            kind: "llm",
            provider: "openai-compatible",
            model: "gpt-4.1-mini",
            usage: { prompt_tokens: 300, completion_tokens: 75 },
            estimatedCostUsd: 0.00024,
            runtimeIsolation: "benchmark-harness-only"
          }
        }
      });
      expect(output.evidence.judge.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      await close(server);
    }
  });

  it("records OpenAI-compatible Arena judge usage, cost and latency", async () => {
    const observed: { authorization?: string; responseFormat?: unknown } = {};
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        const payload = JSON.parse(body);
        observed.authorization = request.headers.authorization;
        observed.responseFormat = payload.response_format;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                checks: {
                  correctionCarryover: true,
                  repeatedMistakeAvoided: false,
                  procedureRecall: true,
                  patchCorrectness: false,
                  evidenceCompleteness: true,
                  wrongMemorySuppression: false
                },
                confidence: 0.89,
                reason: "fixture openai-compatible arena judge"
              })
            }
          }],
          usage: { prompt_tokens: 100, completion_tokens: 25 }
        }));
      });
    });
    const baseUrl = await listen(server);
    try {
      const result = await runNodeScript([join(process.cwd(), "scripts/benchmark/arena-openai-judge.mjs")], {
        cwd: process.cwd(),
        input: JSON.stringify({ system: "mem0", scenario: { id: "cognicode-001" }, runnerOutput: { evidence: { text: "raw runner evidence" } } }),
        timeout: 10_000,
        env: { ...process.env, MEMORY_OPENAI_API_KEY: "fixture-key", MEMORY_OPENAI_BASE_URL: baseUrl, MEMORY_ARENA_JUDGE_MODEL: "gpt-4.1-mini" }
      });
      expect(result.status).toBe(0);
      expect(observed.authorization).toBe("Bearer fixture-key");
      expect(observed.responseFormat).toEqual({ type: "json_object" });
      const output = JSON.parse(result.stdout);
      expect(output.checks.correctionCarryover).toBe(true);
      expect(output.judge).toMatchObject({
        kind: "llm",
        provider: "openai-compatible",
        model: "gpt-4.1-mini",
        usage: { prompt_tokens: 100, completion_tokens: 25 },
        estimatedCostUsd: 0.00008
      });
      expect(output.judge.latencyMs).toBeGreaterThanOrEqual(0);
      expect(output.judge.pricing).toMatchObject({ inputCostPerMillionUsd: 0.4, outputCostPerMillionUsd: 1.6 });
    } finally {
      await close(server);
    }
  });

  it("fails OpenAI-compatible runner judges closed when token usage is missing", async () => {
    const cases = [
      {
        script: "scripts/benchmark/arena-openai-judge.mjs",
        env: { MEMORY_ARENA_JUDGE_MODEL: "gpt-4.1-mini" },
        input: { system: "mem0", scenario: { id: "cognicode-001" }, runnerOutput: { evidence: { text: "raw runner evidence" } } },
        content: {
          checks: {
            correctionCarryover: true,
            repeatedMistakeAvoided: false,
            procedureRecall: true,
            patchCorrectness: false,
            evidenceCompleteness: true,
            wrongMemorySuppression: false
          },
          confidence: 0.89,
          reason: "fixture openai-compatible arena judge"
        },
        stderr: "OpenAI-compatible Arena judge response must include token usage"
      },
      {
        script: "scripts/benchmark/operator-memory-openai-judge.mjs",
        env: { MEMORY_OPERATOR_MEMORY_JUDGE_MODEL: "gpt-4.1-mini" },
        input: { system: "mem0-native", scenario: { id: "source-update" }, runnerOutput: { evidence: { text: "current source-backed evidence" } } },
        content: {
          checks: {
            currentTruthSelected: true,
            staleTruthSuppressed: true,
            sourceRefRevalidated: true,
            connectorRefreshAccounted: false,
            beliefRevisionApplied: true,
            failureContained: false
          },
          confidence: 0.87,
          reason: "fixture openai-compatible operator judge"
        },
        stderr: "OpenAI-compatible Operator Memory judge response must include token usage"
      },
      {
        script: "scripts/benchmark/operator-memory-quality-openai-judge.mjs",
        env: { MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_MODEL: "gpt-4.1-mini" },
        input: {
          contract: "cognibrain-operator-memory-quality-llm-harness-judge-v1",
          scenarioCount: 1,
          cognibrainScore: 1,
          bestBaselineScore: 0.4,
          leaderboard: [],
          systems: []
        },
        content: {
          passed: true,
          score: 0.9,
          reason: "fixture openai-compatible operator quality judge"
        },
        stderr: "OpenAI-compatible Operator Memory quality judge response must include token usage"
      },
      {
        script: "scripts/benchmark/cognicodebench-quality-openai-judge.mjs",
        env: { MEMORY_COGNICODEBENCH_QUALITY_JUDGE_MODEL: "gpt-4.1-mini" },
        input: {
          contract: "cognibrain-cognicodebench-quality-llm-harness-judge-v1",
          scenarioCount: 1,
          metrics: {},
          diagnostics: {},
          baselines: [],
          ablation: {},
          scenarios: [],
          results: []
        },
        content: {
          passed: true,
          score: 0.9,
          reason: "fixture openai-compatible CogniCodeBench quality judge"
        },
        stderr: "OpenAI-compatible CogniCodeBench quality judge response must include token usage"
      }
    ];

    for (const item of cases) {
      const server = createServer((request, response) => {
        request.resume();
        request.on("end", () => {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(item.content) } }]
          }));
        });
      });
      const baseUrl = await listen(server);
      try {
        const result = await runNodeScript([join(process.cwd(), item.script)], {
          cwd: process.cwd(),
          input: JSON.stringify(item.input),
          timeout: 10_000,
          env: { ...process.env, MEMORY_OPENAI_API_KEY: "fixture-key", MEMORY_OPENAI_BASE_URL: baseUrl, ...item.env }
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(item.stderr);
      } finally {
        await close(server);
      }
    }
  });
});
