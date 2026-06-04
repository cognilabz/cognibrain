#!/usr/bin/env node
const task = process.argv[2] || "unknown";
const input = JSON.parse(await readStdin() || "{}");
const apiKey = process.env.MEMORY_INTELLIGENCE_OPENAI_API_KEY;
if (!apiKey) fail("MEMORY_INTELLIGENCE_OPENAI_API_KEY is required for the explicit memory-intelligence harness command");

const baseUrl = (process.env.MEMORY_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.MEMORY_INTELLIGENCE_MODEL ?? process.env.MEMORY_REALWORLD_JUDGE_MODEL ?? "gpt-4.1-mini";
const timeoutMs = Number(process.env.MEMORY_INTELLIGENCE_OPENAI_TIMEOUT_MS ?? 60_000);

if (task === "contradiction") {
  const judged = await chatJson({
    instruction: [
      "Classify whether memory A and memory B semantically contradict each other.",
      "Return label=contradiction only when both memories make incompatible claims about the same subject/property.",
      "Prefer contradiction for current-vs-stale facts that cannot both be the current truth.",
      "Do not rely on string ids, metadata ids, or exact token overlap."
    ].join(" "),
    outputShape: { label: "entailment|neutral|contradiction", confidence: "0..1", reason: "short" },
    a: slimMemory(input.a),
    b: slimMemory(input.b),
    key: input.key
  });
  console.log(JSON.stringify({
    label: ["entailment", "neutral", "contradiction"].includes(judged.label) ? judged.label : "neutral",
    confidence: bounded(judged.confidence, 0.5),
    reason: typeof judged.reason === "string" ? judged.reason.slice(0, 500) : "openai memory intelligence contradiction"
  }));
  process.exit(0);
}

if (task === "evidence") {
  if (!Array.isArray(input.results) || input.results.length === 0) {
    console.log(JSON.stringify({
      answerable: false,
      confidence: 0.94,
      reason: "no retrieved memories were available for semantic evidence judgement",
      decisions: []
    }));
    process.exit(0);
  }
  const judged = await chatJson({
    instruction: [
      "Judge whether the retrieved memories provide usable evidence for the query.",
      "Mark answerable=true only when delivered memories contain enough semantic evidence to answer.",
      "For private, deleted, secret, credential, token, or unsupported-answer queries, mark answerable=false unless the results safely refuse or contain only unrelated non-sensitive evidence.",
      "Return per-memory decisions. Use exclude for irrelevant, stale-for-current, private, deleted, unsafe, or contradicted evidence. Use review for uncertain evidence.",
      "Do not rely on string ids or regex-like matching; judge semantic support."
    ].join(" "),
    outputShape: {
      answerable: "boolean",
      confidence: "0..1",
      reason: "short",
      decisions: [{ id: "memory id", decision: "include|warn|review|exclude", confidence: "0..1", reason: "short" }]
    },
    query: input.query,
    now: input.now,
    results: Array.isArray(input.results) ? input.results.map(slimResult) : []
  });
  console.log(JSON.stringify({
    answerable: judged.answerable === true,
    confidence: bounded(judged.confidence, judged.answerable === true ? 0.76 : 0.68),
    reason: typeof judged.reason === "string" ? judged.reason.slice(0, 500) : "openai memory intelligence evidence",
    decisions: Array.isArray(judged.decisions) ? judged.decisions.flatMap(normalizeDecision) : []
  }));
  process.exit(0);
}

if (task === "verify") {
  console.log(JSON.stringify({ decisions: [] }));
  process.exit(0);
}

if (task === "rerank") {
  console.log(JSON.stringify({ ranking: Array.isArray(input.results) ? input.results.map((result) => result.id).filter(Boolean) : [] }));
  process.exit(0);
}

if (task === "expand") {
  console.log(JSON.stringify({ expansions: [] }));
  process.exit(0);
}

console.log(JSON.stringify({}));

async function chatJson(userPayload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
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
            content: "You are a strict memory intelligence provider. Return only valid compact JSON matching the requested output shape."
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
      const body = await response.text().catch(() => "");
      fail(`OpenAI-compatible memory intelligence request failed: ${response.status} ${body.slice(0, 1000)}`);
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") fail("OpenAI-compatible memory intelligence response did not include JSON content");
    return JSON.parse(content);
  } finally {
    clearTimeout(timeout);
  }
}

function slimMemory(memory) {
  return {
    id: memory?.id,
    content: memory?.content,
    tags: memory?.tags,
    entities: memory?.entities,
    trust: memory?.trust,
    createdAt: memory?.createdAt,
    temporal: memory?.temporal,
    source: memory?.source
  };
}

function slimResult(result) {
  return {
    id: result?.id,
    score: result?.score,
    signals: result?.signals,
    memory: slimMemory(result?.memory)
  };
}

function normalizeDecision(item) {
  if (!item || typeof item.id !== "string") return [];
  const decision = ["include", "warn", "review", "exclude"].includes(item.decision) ? item.decision : undefined;
  return [{
    id: item.id,
    decision,
    confidence: typeof item.confidence === "number" ? bounded(item.confidence, 0.5) : undefined,
    reason: typeof item.reason === "string" ? item.reason.slice(0, 500) : undefined
  }];
}

function bounded(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
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
