#!/usr/bin/env node
const input = JSON.parse(await readStdin() || "{}");
const apiKey = process.env.MEMORY_ARENA_JUDGE_OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_ARENA_JUDGE_OPENAI_API_KEY is required for the explicit Arena benchmark harness judge");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_ARENA_JUDGE_MODEL ?? process.env.MEMORY_REALWORLD_JUDGE_MODEL ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_ARENA_OPENAI_JUDGE_TIMEOUT_MS ?? 120_000);
const endpoint = `${baseUrl}/chat/completions`;
const pricing = pricingForModel(model);
const checks = [
  "correctionCarryover",
  "repeatedMistakeAvoided",
  "procedureRecall",
  "patchCorrectness",
  "evidenceCompleteness",
  "wrongMemorySuppression",
];

const judgedResponse = await chatJson({
  instruction: [
    "Judge one CogniCode memory benchmark scenario from raw runner evidence.",
    "Do not trust runner-proposed checks; they are advisory and may be produced by heuristics.",
    "Do not use exact string overlap, ids, file names, or JSON field names as proof by themselves.",
    "Use semantic evidence: did the memory system retrieve enough relevant correction/procedure evidence, avoid the recorded wrong action, and provide enough provenance to justify the next coding action?",
    "Return every required check as a strict JSON boolean, plus confidence in 0..1 and a short reason.",
  ].join(" "),
  outputShape: {
    checks: Object.fromEntries(checks.map((key) => [key, "boolean"])),
    confidence: "0..1",
    reason: "short",
  },
  requiredChecks: checks,
  system: input.system,
  scenario: input.scenario,
  runnerEvidence: input.runnerOutput?.evidence ?? input.runnerOutput,
});

const normalized = normalize(judgedResponse.value);
console.log(JSON.stringify({
  ...normalized,
  judge: {
    kind: "llm",
    provider: "openai-compatible",
    model,
    endpoint,
    usage: judgedResponse.usage,
    estimatedCostUsd: estimateCostUsd(judgedResponse.usage, pricing),
    pricing,
    latencyMs: judgedResponse.latencyMs,
  },
}));

async function chatJson(userPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const started = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a strict neutral benchmark judge for agent memory systems. Return only valid compact JSON matching the requested schema.",
          },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      fail(`OpenAI-compatible Arena judge request failed: ${response.status} ${body.slice(0, 1000)}`);
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") fail("OpenAI-compatible Arena judge response did not include JSON content");
    return {
      value: JSON.parse(content),
      usage: body.usage ?? null,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalize(value) {
  const rawChecks = value?.checks;
  if (!rawChecks || typeof rawChecks !== "object") fail("Arena judge must return a checks object");
  const normalizedChecks = {};
  for (const key of checks) {
    if (typeof rawChecks[key] !== "boolean") fail(`Arena judge check ${key} must be a JSON boolean`);
    normalizedChecks[key] = rawChecks[key];
  }
  if (typeof value.confidence !== "number" || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    fail("Arena judge confidence must be a finite 0..1 number");
  }
  return {
    checks: normalizedChecks,
    confidence: value.confidence,
    reason: typeof value.reason === "string" ? value.reason.slice(0, 1000) : "openai-compatible arena judge decision",
  };
}

function pricingForModel(modelName) {
  const inputOverride = Number(process.env.MEMORY_ARENA_JUDGE_INPUT_COST_PER_MILLION_USD ?? NaN);
  const outputOverride = Number(process.env.MEMORY_ARENA_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? NaN);
  if (Number.isFinite(inputOverride) && Number.isFinite(outputOverride) && inputOverride >= 0 && outputOverride >= 0) {
    return {
      source: "env",
      inputCostPerMillionUsd: inputOverride,
      outputCostPerMillionUsd: outputOverride,
    };
  }
  const defaults = {
    "gpt-4.1-mini": { inputCostPerMillionUsd: 0.4, outputCostPerMillionUsd: 1.6 },
    "gpt-4.1-nano": { inputCostPerMillionUsd: 0.1, outputCostPerMillionUsd: 0.4 },
    "gpt-4.1": { inputCostPerMillionUsd: 2, outputCostPerMillionUsd: 8 },
  };
  const match = defaults[modelName];
  if (match) return { source: "openai-pricing-2026-06-03", ...match };
  fail(`No Arena judge pricing configured for ${modelName}; set MEMORY_ARENA_JUDGE_INPUT_COST_PER_MILLION_USD and MEMORY_ARENA_JUDGE_OUTPUT_COST_PER_MILLION_USD`);
}

function estimateCostUsd(usage, price) {
  if (!usage) fail("OpenAI-compatible Arena judge response must include token usage for cost accounting");
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    fail("OpenAI-compatible Arena judge usage must include non-negative input/output token counts");
  }
  const cost = (inputTokens * price.inputCostPerMillionUsd + outputTokens * price.outputCostPerMillionUsd) / 1_000_000;
  return Number(cost.toFixed(8));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}
