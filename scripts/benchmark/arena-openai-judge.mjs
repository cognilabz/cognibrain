#!/usr/bin/env node
const input = JSON.parse(await readStdin() || "{}");
const apiKey = process.env.MEMORY_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_OPENAI_API_KEY or OPENAI_API_KEY is required");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_ARENA_JUDGE_MODEL ?? process.env.MEMORY_REALWORLD_JUDGE_MODEL ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_ARENA_OPENAI_JUDGE_TIMEOUT_MS ?? 120_000);
const checks = [
  "correctionCarryover",
  "repeatedMistakeAvoided",
  "procedureRecall",
  "patchCorrectness",
  "evidenceCompleteness",
  "wrongMemorySuppression",
];

const judged = await chatJson({
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

const normalized = normalize(judged);
console.log(JSON.stringify({
  ...normalized,
  judge: {
    kind: "llm",
    provider: "openai-compatible",
    model,
    endpoint: `${baseUrl}/chat/completions`,
  },
}));

async function chatJson(userPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
    return JSON.parse(content);
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
