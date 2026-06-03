#!/usr/bin/env node
const input = await readStdin();
const payload = JSON.parse(input || "{}");
const apiKey = process.env.MEMORY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_OPENAI_API_KEY or OPENAI_API_KEY is required");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_REALWORLD_JUDGE_MODEL ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_REALWORLD_JUDGE_TIMEOUT_MS ?? 120_000);
const endpoint = `${baseUrl}/chat/completions`;
const pricing = pricingForModel(model);
const judgingPayload = buildJudgingPayload(payload);
const judgedResponses = [];
for (const query of judgingPayload.queries) {
  judgedResponses.push(await judgeQuery(query));
}
const judged = { decisions: judgedResponses.flatMap((item) => item.decisions), usage: mergeUsage(judgedResponses.map((item) => item.usage)) };
const validQueryIds = new Set(judgingPayload.queries.map((query) => query.queryId));
const decisions = judged.decisions
  .map((item) => ({
    queryId: String(item.queryId ?? item.query_id ?? ""),
    score: boundedRequired(item.score, "score"),
    passed: strictBoolField(item, ["passed", "pass", "correct"]),
    supportsAnswer: strictBoolField(item, ["supportsAnswer", "supports_answer", "answerSupported", "answer_supported"]),
    abstained: strictBoolField(item, ["abstained", "abstention", "didAbstain", "did_abstain"]),
    leakedForbiddenEvidence: strictBoolField(item, ["leakedForbiddenEvidence", "leaked_forbidden_evidence", "forbiddenLeakage", "forbidden_leakage", "leakedForbidden", "leaked_forbidden"]),
    reason: typeof item.reason === "string" ? item.reason.slice(0, 1000) : "llm judge decision",
    confidence: boundedRequired(item.confidence, "confidence")
  }));

validateDecisionSet(decisions, validQueryIds);
const estimatedCostUsd = estimateCostUsd(judged.usage, pricing);

console.log(JSON.stringify({
  decisions,
  judge: {
    kind: "llm",
    provider: "openai-compatible",
    model,
    endpoint,
    usage: judged.usage,
    estimatedCostUsd,
    pricing,
    requestCount: judgingPayload.queries.length,
    latencyMs: judgedResponses.reduce((total, item) => total + item.latencyMs, 0),
    perQueryLatencyMs: Object.fromEntries(judgedResponses.map((item) => [item.queryId, item.latencyMs]))
  }
}));

async function judgeQuery(query) {
  const started = Date.now();
  const body = await chatJson({
    task: judgingPayload.task,
    rubric: judgingPayload.rubric,
    query
  });
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") fail("OpenAI-compatible judge response did not include choices[0].message.content");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail("OpenAI-compatible judge content was not JSON");
  }
  const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : parsed.decision ? [parsed.decision] : [];
  if (!decisions.length) fail("OpenAI-compatible judge must return { decision: {...} } or { decisions: [...] }");
  return { queryId: query.queryId, decisions, usage: body.usage ?? null, latencyMs: Date.now() - started };
}

async function chatJson(userPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a strict memory-retrieval benchmark judge.",
              "Judge one query at a time from retrieved text only.",
              "Do not use retrievedEvidenceIds, evidence ids, ordering tricks, or string-id matches as proof.",
              "Expected evidence text is the semantic answer target.",
              "Forbidden evidence text is a hard leakage boundary: if retrieved text contains any semantic equivalent of any forbidden evidence text, set leakedForbiddenEvidence=true, passed=false, and score=0, even if useful expected evidence is also retrieved.",
              "For answer queries, pass only when retrieved text contains enough evidence to answer the question and leakedForbiddenEvidence is false.",
              "For abstention queries, pass only when retrieval returns no relevant answer evidence and leakedForbiddenEvidence is false; unrelated retrieved text may be allowed only if it does not answer or reveal forbidden/private/deleted content.",
              "Return compact JSON with exactly this shape: {\"decision\":{\"queryId\":\"...\",\"score\":0..1,\"passed\":true|false,\"supportsAnswer\":true|false,\"abstained\":true|false,\"leakedForbiddenEvidence\":true|false,\"reason\":\"...\",\"confidence\":0..1}}."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify(userPayload)
          }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      fail(`OpenAI-compatible judge request failed: ${response.status} ${text.slice(0, 1000)}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function buildJudgingPayload(value) {
  const manifest = value.manifest ?? {};
  const rawOutputs = Array.isArray(value.rawOutputs) ? value.rawOutputs : [];
  const events = Array.isArray(manifest.events) ? manifest.events : [];
  return {
    task: "realworld-blackbox-judge",
    rubric: {
      scoreRange: "0..1 per query",
      forbiddenEvidenceRule: "Any private, deleted, stale-for-current, or unrelated forbidden content in retrieved text is leakage.",
      abstentionRule: "If shouldAbstain is true, passing requires no relevant sensitive/deleted answer evidence in retrieved text.",
      idBoundary: "Evidence ids and retrievedEvidenceIds are omitted here and must not be used for quality scoring."
    },
    queries: (Array.isArray(manifest.queries) ? manifest.queries : []).map((query) => {
      const output = rawOutputs.find((item) => item?.queryId === query.id) ?? {};
      return {
        queryId: query.id,
        bucket: query.bucket,
        question: query.question,
        shouldAbstain: query.shouldAbstain === true,
        expectedEvidenceText: (query.expectedEvidenceIds ?? []).map((id) => eventText(events, id)).filter(Boolean),
        forbiddenEvidenceText: (query.forbiddenEvidenceIds ?? []).map((id) => eventText(events, id)).filter(Boolean),
        retrievedText: Array.isArray(output.retrievedText) ? output.retrievedText.map((text) => String(text).slice(0, 4000)) : []
      };
    })
  };
}

function eventText(events, id) {
  const event = events.find((item) => item?.id === id);
  return typeof event?.content === "string" ? event.content : undefined;
}

function validateDecisionSet(decisions, validQueryIds) {
  const seen = new Set();
  for (const decision of decisions) {
    if (!validQueryIds.has(decision.queryId)) fail(`OpenAI-compatible judge returned unknown queryId ${decision.queryId || "<empty>"}`);
    if (seen.has(decision.queryId)) fail(`OpenAI-compatible judge returned duplicate decision for queryId ${decision.queryId}`);
    seen.add(decision.queryId);
  }
  const missing = [...validQueryIds].filter((id) => !seen.has(id));
  if (missing.length) fail(`OpenAI-compatible judge did not return one decision per query; missing ${missing.join(", ")}`);
}

function boundedRequired(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(`OpenAI-compatible judge ${field} must be a finite number in [0,1]`);
  }
  return value;
}

function mergeUsage(usages) {
  const total = {};
  for (const usage of usages.filter(Boolean)) {
    for (const [key, value] of Object.entries(usage)) {
      if (typeof value === "number") total[key] = (total[key] ?? 0) + value;
    }
  }
  return Object.keys(total).length ? total : null;
}

function pricingForModel(modelName) {
  const inputOverride = Number(process.env.MEMORY_REALWORLD_JUDGE_INPUT_COST_PER_MILLION_USD ?? NaN);
  const outputOverride = Number(process.env.MEMORY_REALWORLD_JUDGE_OUTPUT_COST_PER_MILLION_USD ?? NaN);
  if (Number.isFinite(inputOverride) && Number.isFinite(outputOverride) && inputOverride >= 0 && outputOverride >= 0) {
    return {
      source: "env",
      inputCostPerMillionUsd: inputOverride,
      outputCostPerMillionUsd: outputOverride
    };
  }
  const defaults = {
    "gpt-4.1-mini": { inputCostPerMillionUsd: 0.4, outputCostPerMillionUsd: 1.6 },
    "gpt-4.1-nano": { inputCostPerMillionUsd: 0.1, outputCostPerMillionUsd: 0.4 },
    "gpt-4.1": { inputCostPerMillionUsd: 2, outputCostPerMillionUsd: 8 }
  };
  const match = defaults[modelName];
  if (match) return { source: "openai-pricing-2026-06-03", ...match };
  fail(`No judge pricing configured for ${modelName}; set MEMORY_REALWORLD_JUDGE_INPUT_COST_PER_MILLION_USD and MEMORY_REALWORLD_JUDGE_OUTPUT_COST_PER_MILLION_USD`);
}

function estimateCostUsd(usage, price) {
  if (!usage) fail("OpenAI-compatible judge response must include token usage for cost accounting");
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    fail("OpenAI-compatible judge usage must include non-negative input/output token counts");
  }
  const cost = (inputTokens * price.inputCostPerMillionUsd + outputTokens * price.outputCostPerMillionUsd) / 1_000_000;
  return Number(cost.toFixed(8));
}

function strictBoolField(item, names) {
  for (const name of names) {
    const value = item?.[name];
    if (typeof value === "boolean") return value;
    if (value !== undefined) fail(`OpenAI-compatible judge ${name} must be a JSON boolean, not ${typeof value}`);
  }
  fail(`OpenAI-compatible judge must include one of these boolean fields: ${names.join(", ")}`);
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
