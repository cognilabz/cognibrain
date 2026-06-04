#!/usr/bin/env node
const input = JSON.parse(await readStdin() || "{}");
const apiKey = process.env.MEMORY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_OPENAI_API_KEY or OPENAI_API_KEY is required");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_MODEL
  ?? process.env.MEMORY_OPERATOR_MEMORY_JUDGE_MODEL
  ?? process.env.MEMORY_ARENA_JUDGE_MODEL
  ?? process.env.MEMORY_REALWORLD_JUDGE_MODEL
  ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_OPERATOR_MEMORY_QUALITY_OPENAI_JUDGE_TIMEOUT_MS ?? 120_000);
const endpoint = `${baseUrl}/chat/completions`;
const pricing = pricingForModel(model);

const judgedResponse = await chatJson({
  instruction: [
    "Judge the full Operator Memory Dream Benchmark report.",
    "This is a report-level semantic quality gate, not a deterministic scoreboard.",
    "Do not trust local diagnostic scores, exact string overlap, scenario ids, JSON field names, or runner-proposed checks as proof by themselves.",
    "Use the supplied scenario evidence semantically: does the Cognibrain system demonstrate source-aware current truth selection, stale truth suppression, source revalidation, belief revision, connector refresh/failure accounting, and safe handling of deleted or unverified release-critical sources?",
    "Fail if the evidence is too thin, if Cognibrain has relevant unresolved scenario failures, or if the margin is only supported by local deterministic checks.",
    "Return strict compact JSON with boolean passed, score in 0..1, reason, and optional evidence.",
  ].join(" "),
  outputShape: {
    passed: "boolean",
    score: "0..1",
    reason: "short",
    evidence: "optional object",
  },
  contract: input.contract,
  scenarioCount: input.scenarioCount,
  cognibrainScore: input.cognibrainScore,
  bestBaselineScore: input.bestBaselineScore,
  leaderboard: input.leaderboard,
  systems: trimSystems(input.systems),
});

const normalized = normalize(judgedResponse.value);
console.log(JSON.stringify({
  ...normalized,
  evidence: {
    ...(normalized.evidence ?? {}),
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
            content: "You are a strict neutral report-level benchmark judge for source-aware agent memory systems. Return only valid compact JSON matching the requested schema.",
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
      fail(`OpenAI-compatible Operator Memory quality judge request failed: ${response.status} ${body.slice(0, 1000)}`);
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") fail("OpenAI-compatible Operator Memory quality judge response did not include JSON content");
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
  if (typeof value?.passed !== "boolean") fail("Operator Memory quality judge passed must be a JSON boolean");
  if (typeof value.score !== "number" || !Number.isFinite(value.score) || value.score < 0 || value.score > 1) {
    fail("Operator Memory quality judge score must be a finite 0..1 number");
  }
  return {
    passed: value.passed,
    score: value.score,
    reason: typeof value.reason === "string" ? value.reason.slice(0, 1000) : "openai-compatible operator memory quality judge decision",
    evidence: value.evidence && typeof value.evidence === "object" && !Array.isArray(value.evidence) ? value.evidence : undefined,
  };
}

function trimSystems(systems) {
  if (!Array.isArray(systems)) return [];
  return systems.map((system) => ({
    system: system?.system,
    displayName: system?.displayName,
    proofLevel: system?.proofLevel,
    adapterMode: system?.adapterMode,
    score: system?.score,
    metrics: system?.metrics,
    capabilityGaps: system?.capabilityGaps,
    scenarios: Array.isArray(system?.scenarios) ? system.scenarios.map((scenario) => ({
      scenarioId: scenario?.scenarioId,
      title: scenario?.title,
      kind: scenario?.kind,
      score: scenario?.score,
      checks: scenario?.checks,
      capabilityGaps: scenario?.capabilityGaps,
      evidence: trimEvidence(scenario?.evidence),
    })) : [],
  }));
}

function trimEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return evidence;
  return {
    injectedContents: Array.isArray(evidence.injectedContents) ? evidence.injectedContents.map((item) => String(item).slice(0, 1000)) : undefined,
    staleBeliefStates: evidence.staleBeliefStates,
    connectorState: evidence.connectorState,
    dreamJob: evidence.dreamJob,
    structuredChecks: evidence.structuredChecks,
    judge: evidence.judge,
    nativeEvidence: evidence.nativeEvidence,
  };
}

function pricingForModel(modelName) {
  const inputOverride = Number(process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_INPUT_COST_PER_MILLION_USD ?? process.env.MEMORY_OPERATOR_MEMORY_JUDGE_INPUT_COST_PER_MILLION_USD ?? NaN);
  const outputOverride = Number(process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? process.env.MEMORY_OPERATOR_MEMORY_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? NaN);
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
  fail(`No Operator Memory quality judge pricing configured for ${modelName}; set MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_INPUT_COST_PER_MILLION_USD and MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_OUTPUT_COST_PER_MILLION_USD`);
}

function estimateCostUsd(usage, price) {
  if (!usage) fail("OpenAI-compatible Operator Memory quality judge response must include token usage for cost accounting");
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    fail("OpenAI-compatible Operator Memory quality judge usage must include non-negative input/output token counts");
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
