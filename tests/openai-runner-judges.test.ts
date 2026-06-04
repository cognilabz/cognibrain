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
