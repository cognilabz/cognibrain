#!/usr/bin/env node
const input = JSON.parse(await readStdin() || "{}");
const apiKey = process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_OPENAI_API_KEY ?? process.env.MEMORY_COGNICODEBENCH_JUDGE_OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_COGNICODEBENCH_QUALITY_JUDGE_OPENAI_API_KEY or MEMORY_COGNICODEBENCH_JUDGE_OPENAI_API_KEY is required for the explicit CogniCodeBench benchmark harness");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_MODEL
  ?? process.env.MEMORY_COGNICODEBENCH_JUDGE_MODEL
  ?? process.env.MEMORY_ARENA_JUDGE_MODEL
  ?? process.env.MEMORY_REALWORLD_JUDGE_MODEL
  ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_COGNICODEBENCH_QUALITY_OPENAI_JUDGE_TIMEOUT_MS ?? 120_000);
const endpoint = `${baseUrl}/chat/completions`;
const pricing = pricingForModel(model);

const judgedResponse = await chatJson({
  instruction: [
    "Judge the full CogniCodeBench engineering-memory report.",
    "This is a report-level semantic quality gate, not a deterministic scoreboard.",
    "Do not trust local deterministic scores, exact string overlap, token overlap, regex matches, scenario ids, JSON field names, hidden expected fields, or runner-proposed checks as proof by themselves.",
    "Use the supplied semantic scenario evidence: correction carryover, repeated wrong-action suppression, procedure recall, patch plausibility from visible repo metadata, evidence completeness, stale or wrong memory suppression, sourceRef correctness, granular patch behavior, and long-horizon recall.",
    "Fail if evidence is too thin, if hidden expected commands/files appear to have leaked into patch planning, if Cognibrain has relevant unresolved scenario failures, or if the margin is only supported by local deterministic diagnostics.",
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
  metrics: input.metrics,
  diagnostics: input.diagnostics,
  baselines: input.baselines,
  ablation: input.ablation,
  scenarioEvidence: trimScenarioEvidence(input.results, input.scenarios),
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
      runtimeIsolation: "benchmark-harness-only",
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
            content: "You are a strict neutral report-level benchmark judge for engineering-memory coding agents. Return only valid compact JSON matching the requested schema.",
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
      fail(`OpenAI-compatible CogniCodeBench quality judge request failed: ${response.status} ${body.slice(0, 1000)}`);
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") fail("OpenAI-compatible CogniCodeBench quality judge response did not include JSON content");
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
  if (typeof value?.passed !== "boolean") fail("CogniCodeBench quality judge passed must be a JSON boolean");
  if (typeof value.score !== "number" || !Number.isFinite(value.score) || value.score < 0 || value.score > 1) {
    fail("CogniCodeBench quality judge score must be a finite 0..1 number");
  }
  return {
    passed: value.passed,
    score: value.score,
    reason: typeof value.reason === "string" ? value.reason.slice(0, 1000) : "openai-compatible CogniCodeBench quality judge decision",
    evidence: value.evidence && typeof value.evidence === "object" && !Array.isArray(value.evidence) ? value.evidence : undefined,
  };
}

function trimScenarioEvidence(results, scenarios) {
  const scenarioById = new Map(Array.isArray(scenarios) ? scenarios.map((scenario) => [scenario?.id, scenario]) : []);
  const rows = Array.isArray(results) ? results : [];
  const failures = rows.filter((row) => row?.passed === false);
  const candidates = failures.length ? failures : rows;
  return candidates.slice(0, 120).map((row) => {
    const scenario = scenarioById.get(row?.id);
    return {
      id: row?.id,
      category: scenario?.category,
      difficulty: scenario?.difficulty,
      task: truncate(scenario?.nextTask, 600),
      correction: trimCorrection(scenario?.correction),
      wrongAction: trimWrongAction(scenario?.wrongAction),
      expectedSummary: trimExpectedSummary(scenario?.expected),
      passed: row?.passed,
      score: row?.score,
      checks: row?.checks,
      errors: row?.errors,
      evidence: trimEvidence(row?.evidence),
    };
  });
}

function trimCorrection(correction) {
  if (!correction || typeof correction !== "object") return undefined;
  return {
    kind: correction.memoryKind,
    content: truncate(correction.content, 800),
    correctAction: truncate(correction.correctAction, 400),
  };
}

function trimWrongAction(action) {
  if (!action || typeof action !== "object") return undefined;
  return {
    command: truncate(action.command, 300),
    reason: truncate(action.reason, 500),
    filesChanged: action.filesChanged,
  };
}

function trimExpectedSummary(expected) {
  if (!expected || typeof expected !== "object") return undefined;
  return {
    referencedKinds: expected.referencedKinds,
    blockedAction: truncate(expected.blockedAction, 300),
    staleRuleSuppressed: truncate(expected.staleRuleSuppressed, 300),
    filesChangedCount: Array.isArray(expected.filesChanged) ? expected.filesChanged.length : undefined,
    commandPresent: typeof expected.command === "string" && expected.command.length > 0,
  };
}

function trimEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return undefined;
  return {
    guardSeverity: evidence.guardSeverity,
    referencedKinds: evidence.referencedKinds,
    sourceRefs: evidence.sourceRefs,
    patchProposal: trimPatchProposal(evidence.patchProposal),
    patchChecks: evidence.patchChecks,
  };
}

function trimPatchProposal(patchProposal) {
  if (!patchProposal || typeof patchProposal !== "object") return undefined;
  return {
    mode: patchProposal.mode,
    status: patchProposal.status,
    command: truncate(patchProposal.command, 300),
    filesChanged: Array.isArray(patchProposal.filesChanged) ? patchProposal.filesChanged.slice(0, 12) : patchProposal.filesChanged,
    reason: truncate(patchProposal.reason, 700),
    evidenceKinds: patchProposal.evidence?.evidenceKinds,
  };
}

function truncate(value, limit) {
  return typeof value === "string" ? value.slice(0, limit) : value;
}

function pricingForModel(modelName) {
  const inputOverride = Number(process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_INPUT_COST_PER_MILLION_USD ?? process.env.MEMORY_COGNICODEBENCH_JUDGE_INPUT_COST_PER_MILLION_USD ?? NaN);
  const outputOverride = Number(process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? process.env.MEMORY_COGNICODEBENCH_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? NaN);
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
  fail(`No CogniCodeBench quality judge pricing configured for ${modelName}; set MEMORY_COGNICODEBENCH_QUALITY_JUDGE_INPUT_COST_PER_MILLION_USD and MEMORY_COGNICODEBENCH_QUALITY_JUDGE_OUTPUT_COST_PER_MILLION_USD`);
}

function estimateCostUsd(usage, price) {
  if (!usage) fail("OpenAI-compatible CogniCodeBench quality judge response must include token usage for cost accounting");
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    fail("OpenAI-compatible CogniCodeBench quality judge usage must include non-negative input/output token counts");
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
