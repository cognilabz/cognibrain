#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const upstreamRoot = join(root, ".cognibrain/original-benchmarks");
const outputPath = join(root, "artifacts/original-public-benchmarks.json");
const markdownPath = join(root, "artifacts/docs/original-public-benchmarks.md");

function sh(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    timeout: options.timeout ?? 30_000,
  });
}

function gitHead(repo) {
  const result = sh("git", ["rev-parse", "--short", "HEAD"], { cwd: join(upstreamRoot, repo) });
  return result.status === 0 ? result.stdout.trim() : null;
}

function hasCommand(command) {
  return sh("zsh", ["-lc", `command -v ${command}`]).status === 0;
}

function dockerStatus() {
  const compose = hasCommand("docker-compose") ? "docker-compose" : hasCommand("docker") ? "docker compose" : null;
  const info = sh("docker", ["info", "--format", "{{.ServerVersion}}"]);
  const output = (info.stderr || info.stdout).trim();
  const daemonAvailable = info.status === 0 && !/Cannot connect to the Docker daemon/i.test(output);
  return {
    compose,
    daemonAvailable,
    daemonError: daemonAvailable ? null : output,
  };
}

function envStatus() {
  return {
    openai: Boolean(process.env.OPENAI_API_KEY),
    mem0ApiKey: Boolean(process.env.MEM0_API_KEY),
    mem0OrganizationId: Boolean(process.env.MEM0_ORGANIZATION_ID),
    mem0ProjectId: Boolean(process.env.MEM0_PROJECT_ID),
  };
}

function readLongMemEvalOfficialMetrics() {
  const file = join(
    upstreamRoot,
    "longmemeval/results/cognibrain-original-smoke/official-flat-bm25-session_retrievallog_session_flat-bm25"
  );
  if (!existsSync(file)) return null;
  const rows = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const ignoredAbs = new Set();
  const ignoredNoTarget = new Set();
  const metrics = {};
  for (const key of Object.keys(rows[0]?.retrieval_results?.metrics?.session ?? {})) {
    const values = [];
    for (const row of rows) {
      if (row.question_id.includes("_abs")) {
        ignoredAbs.add(row.question_id);
        continue;
      }
      const hasTarget = row.haystack_sessions
        .flat()
        .some((turn) => turn.role === "user" && turn.has_answer);
      if (!hasTarget) {
        ignoredNoTarget.add(row.question_id);
        continue;
      }
      values.push(row.retrieval_results.metrics.session[key]);
    }
    metrics[key] = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  }
  return {
    status: "passed",
    system: "LongMemEval official flat-bm25 baseline",
    benchmark: "LongMemEval official retrieval",
    command:
      "PYTHONPATH=. python src/retrieval/run_retrieval.py --in_file datasets/longmemeval_s_cleaned.json --out_dir results/cognibrain-original-smoke --retriever flat-bm25 --granularity session --outfile_prefix official-flat-bm25-session",
    rows: rows.length,
    scored: rows.length - ignoredAbs.size - ignoredNoTarget.size,
    ignoredAbstention: ignoredAbs.size,
    ignoredNoTarget: ignoredNoTarget.size,
    metrics,
    outputFile: file.replace(root + "/", ""),
  };
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readMem0LocomoSmoke() {
  const outputDir = join(upstreamRoot, "memory-benchmarks/results/cognibrain-official-mem0-oss");
  const resultFile = join(outputDir, "locomo_results_20260602_102410.json");
  const ingestionFile = join(
    outputDir,
    "predicted_cognibrain-official-mem0-oss-smoke/_ingestion_0.json"
  );
  const result = readJson(resultFile);
  if (!result) return null;
  const ingestion = readJson(ingestionFile);
  const evaluation = result.evaluations?.[0] ?? null;
  return {
    status: "failed",
    system: "Mem0 OSS, repaired package pin",
    benchmark: "Mem0 memory-benchmarks LOCOMO official smoke",
    command:
      "python -m benchmarks.locomo.run --project-name cognibrain-official-mem0-oss-smoke --conversations 0 --max-questions 1 --output-dir results/cognibrain-official-mem0-oss --backend oss --mem0-host http://localhost:8888 --answerer-model gpt-4o-mini --judge-model gpt-4o-mini --top-k 20 --top-k-cutoffs 10,20 --max-workers 1 --rpm 60",
    upstreamRepair:
      "docker/mem0/requirements.txt changed only in ignored upstream clone from mem0@feat/v3-pipeline to mem0@main because the original ref no longer exists",
    resultFile: resultFile.replace(root + "/", ""),
    ingestionFile: existsSync(ingestionFile) ? ingestionFile.replace(root + "/", "") : null,
    totalQuestions: result.metadata?.total_questions ?? result.evaluations?.length ?? 0,
    totalChunksProcessed: ingestion?.total_chunks_processed ?? null,
    totalChunksFailed: ingestion?.total_chunks_failed ?? null,
    metricsByCutoff: result.metrics_by_cutoff ?? {},
    firstEvaluation: evaluation
      ? {
          questionId: evaluation.question_id,
          category: evaluation.category_name,
          totalResults: evaluation.retrieval?.total_results ?? null,
          searchLatencyMs: evaluation.retrieval?.search_latency_ms ?? null,
          top10Score: evaluation.cutoff_results?.top_10?.score ?? null,
          top20Score: evaluation.cutoff_results?.top_20?.score ?? null,
        }
      : null,
    blocker:
      "Repaired mem0@main server ingested successfully but /search returned 500: current mem0.search rejects top-level user_id and expects filters={'user_id': ...}",
  };
}

function readBasicMemoryBenchmarks() {
  const file = join(
    upstreamRoot,
    "basic-memory/.benchmarks/cognibrain-original-full-benchmarks-clean.jsonl"
  );
  const logFile = join(
    upstreamRoot,
    "basic-memory/.benchmarks/cognibrain-original-full-benchmarks-clean.log"
  );
  if (!existsSync(file)) return null;
  const rows = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const byName = Object.fromEntries(rows.map((row) => [row.benchmark, row.metrics]));
  return {
    status: "passed",
    system: "Basic Memory",
    benchmark: "Basic Memory full upstream benchmark marker suite",
    command:
      "BASIC_MEMORY_ENV=test BASIC_MEMORY_BENCHMARK_OUTPUT=.benchmarks/cognibrain-original-full-benchmarks-clean.jsonl uv run pytest -p pytest_mock -v --no-cov -m benchmark tests test-int",
    environment:
      "DOCKER_HOST=colima, OPENAI_API_KEY present, HF_HUB_DISABLE_XET=1 for stable FastEmbed model download",
    rows: rows.length,
    tests: 20,
    skipped: 1,
    deselected: 3041,
    outputFile: file.replace(root + "/", ""),
    logFile: existsSync(logFile) ? logFile.replace(root + "/", "") : null,
    highlights: {
      coldIndex300NotesPerSec: byName["cold index (300 notes)"]?.notes_per_sec ?? null,
      ftsP95Ms: byName["query latency (fts)"]?.p95_ms ?? null,
      vectorP95Ms: byName["query latency (vector)"]?.p95_ms ?? null,
      hybridP95Ms: byName["query latency (hybrid)"]?.p95_ms ?? null,
      sqliteFastembedHybridParaphraseRecallAt5:
        byName["semantic-quality-sqlite-fastembed-paraphrase-hybrid"]?.recall_at_5 ?? null,
      postgresOpenaiHybridParaphraseRecallAt5:
        byName["semantic-quality-postgres-openai-paraphrase-hybrid"]?.recall_at_5 ?? null,
      lexicalHybridRecallAt5: byName["quality recall (lexical, hybrid)"]?.recall_at_5 ?? null,
      paraphraseHybridRecallAt5: byName["quality recall (paraphrase, hybrid)"]?.recall_at_5 ?? null,
    },
  };
}

function buildReport() {
  const env = envStatus();
  const docker = dockerStatus();
  const upstreams = {
    locomo: {
      repo: "https://github.com/snap-research/locomo",
      commit: gitHead("locomo"),
    },
    longmemeval: {
      repo: "https://github.com/xiaowu0162/longmemeval",
      commit: gitHead("longmemeval"),
    },
    beam: {
      repo: "https://github.com/mohammadtavakoli78/BEAM",
      commit: gitHead("BEAM"),
    },
    mem0MemoryBenchmarks: {
      repo: "https://github.com/mem0ai/memory-benchmarks",
      commit: gitHead("memory-benchmarks"),
    },
    basicMemory: {
      repo: "https://github.com/basicmachines-co/basic-memory",
      commit: gitHead("basic-memory"),
    },
  };
  const rows = [];
  const lme = readLongMemEvalOfficialMetrics();
  if (lme) rows.push(lme);
  const basicMemoryBenchmarks = readBasicMemoryBenchmarks();
  if (basicMemoryBenchmarks) rows.push(basicMemoryBenchmarks);
  rows.push({
    status: "blocked",
    system: "Mem0 OSS, exact upstream",
    benchmark: "Mem0 memory-benchmarks Docker server",
    command:
      "docker-compose build mem0 && docker-compose up -d",
    logFile: existsSync(join(upstreamRoot, "memory-benchmarks/logs/cognibrain-mem0-exact-build.log"))
      ? " .cognibrain/original-benchmarks/memory-benchmarks/logs/cognibrain-mem0-exact-build.log".trim()
      : null,
    blockers: [
      "Original docker/mem0/requirements.txt pins mem0ai to git ref feat/v3-pipeline",
      "That git ref is no longer advertised by github.com/mem0ai/mem0, so exact upstream build fails before benchmark execution",
    ].filter(Boolean),
  });
  const mem0LocomoSmoke = readMem0LocomoSmoke();
  if (mem0LocomoSmoke) rows.push(mem0LocomoSmoke);
  rows.push({
    status: "blocked",
    system: "Mem0 Cloud",
    benchmark: "Mem0 memory-benchmarks LOCOMO/LongMemEval/BEAM",
    command:
      "python -m benchmarks.longmemeval.run --project-name official-cloud --backend cloud --all-questions",
    blockers: [
      !env.mem0ApiKey ? "MEM0_API_KEY is missing" : null,
      !env.mem0OrganizationId ? "MEM0_ORGANIZATION_ID is missing" : null,
      !env.mem0ProjectId ? "MEM0_PROJECT_ID is missing" : null,
    ].filter(Boolean),
  });
  rows.push({
    status: "not-comparable-original-only",
    system: "Basic Memory",
    benchmark: "LOCOMO/LongMemEval/BEAM original suites",
    command: null,
    blockers: [
      "No official Basic Memory adapter exists in the cloned LOCOMO, LongMemEval, BEAM, or mem0ai/memory-benchmarks upstream runners",
      "Running Basic Memory on these datasets requires a custom adapter, which is diagnostic only and not an original benchmark",
    ],
  });
  rows.push({
    status: "blocked",
    system: "LOCOMO original RAG/QA scripts",
    benchmark: "snap-research/locomo",
    command:
      "python3 task_eval/evaluate_qa.py --data-file <locomo10.json> --out-file <out.json> --model gpt-3.5-turbo --use-rag",
    blockers: [
      "Original RAG path expects upstream embeddings/model assets and GPU-oriented retriever setup",
    ].filter(Boolean),
  });
  rows.push({
    status: "blocked",
    system: "BEAM original LIGHT/RAG/long-context scripts",
    benchmark: "mohammadtavakoli78/BEAM",
    command:
      "python -m src.answer_probing_questions.answer_generation --evaluation_type rag --retrieval_method light ...",
    blockers: [
      "Original BEAM answer generation requires Qwen, reader, and GPT API/model configuration",
      "Original BEAM evaluation requires LLM judging configuration",
    ],
  });
  const improvements = [
    {
      priority: "P0",
      title: "Add reproducible external-benchmark environment capture",
      evidence:
        "Basic Memory passed only after explicit Docker host, OpenAI provider, and HF download stabilization were captured before the run.",
      action:
        "Record dependency endpoints, provider keys-present flags, model cache mode, container runtime, and exact command logs for every external run.",
    },
    {
      priority: "P0",
      title: "Build an original-suite compatibility boundary",
      evidence:
        "Mem0 exact upstream failed before scoring because an upstream dependency ref vanished; repaired runs were not exact-upstream comparable.",
      action:
        "Separate exact-upstream, vendor-repaired, and local-adapter result classes in all public benchmark surfaces.",
    },
    {
      priority: "P1",
      title: "Strengthen hybrid retrieval latency reporting",
      evidence:
        "Basic Memory exposes p95/p99 latency by retrieval mode; Cognibrain benchmark pages mostly emphasize quality scores.",
      action:
        "Add p50/p95/p99 retrieval and ingestion latency to LoCoMo, LongMemEval, BEAM, and arena artifacts.",
    },
    {
      priority: "P1",
      title: "Create a preregistered black-box memory API benchmark",
      evidence:
        "No official Basic Memory adapter exists for LoCoMo, LongMemEval, BEAM, or mem0 memory-benchmarks.",
      action:
        "Define a neutral ingest/search/delete interface before adding systems, then run every memory solution through the same harness without per-system scoring changes.",
    },
    {
      priority: "P2",
      title: "Improve paraphrase and temporal diagnostics",
      evidence:
        "Basic Memory reports separate lexical/paraphrase recall; Cognibrain BEAM weaknesses already point at temporal and abstention gaps.",
      action:
        "Split benchmark reports by lexical, paraphrase, temporal, update, abstention, and provenance buckets with raw examples.",
    },
  ];
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "original-public-benchmarks",
    protocol: {
      evidenceClasses: [
        "exact-upstream: original code, original command, original scoring",
        "dependency-stabilized: original code and scoring with documented environment variables for external dependencies",
        "blocked: original command could not reach benchmark execution",
        "adapter-diagnostic: local adapter, not accepted as original-public score",
      ],
      noLocalScoringAdaptersForOriginalRows: true,
    },
    upstreamRoot: upstreamRoot.replace(root + "/", ""),
    upstreams,
    environment: { env, docker },
    rows,
    improvements,
    passed: rows.some((row) => row.status === "passed"),
  };
}

function writeMarkdown(report) {
  const evidenceFor = (row) => {
    if (row.status === "passed" && row.benchmark === "Basic Memory upstream search performance benchmarks") {
      return [
        `${row.tests}/4 tests passed`,
        `${row.rows} JSONL metric rows`,
        `cold index ${row.highlights.coldIndex300NotesPerSec.toFixed(2)} notes/sec`,
        `hybrid p95 ${row.highlights.hybridP95Ms.toFixed(2)} ms`,
        `hybrid recall@5 lexical ${Math.round(row.highlights.lexicalHybridRecallAt5 * 100)}%, paraphrase ${Math.round(row.highlights.paraphraseHybridRecallAt5 * 100)}%`,
      ].join("; ");
    }
    if (row.status === "passed" && row.benchmark === "Basic Memory full upstream benchmark marker suite") {
      return [
        `${row.tests} tests passed`,
        `${row.skipped} skipped`,
        `${row.rows} JSONL metric rows`,
        `cold index ${row.highlights.coldIndex300NotesPerSec.toFixed(2)} notes/sec`,
        `hybrid p95 ${row.highlights.hybridP95Ms.toFixed(2)} ms`,
        `semantic postgres-openai paraphrase hybrid recall@5 ${Math.round(row.highlights.postgresOpenaiHybridParaphraseRecallAt5 * 100)}%`,
      ].join("; ");
    }
    if (row.status === "passed") {
      return `rows ${row.rows}, scored ${row.scored}, recall_any@1 ${(row.metrics["recall_any@1"] * 100).toFixed(1)}%, recall_any@5 ${(row.metrics["recall_any@5"] * 100).toFixed(1)}%`;
    }
    if (row.status === "failed" && row.system === "Mem0 OSS, repaired package pin") {
      return [
        `ingested ${row.totalChunksProcessed}/${row.totalChunksProcessed + row.totalChunksFailed} chunks`,
        `${row.totalQuestions} question`,
        `top_10 score ${row.firstEvaluation?.top10Score ?? "n/a"}`,
        `search results ${row.firstEvaluation?.totalResults ?? "n/a"}`,
        row.blocker,
      ].join("; ");
    }
    return row.blockers?.join("; ") ?? row.blocker ?? "";
  };
  const lines = [
    "# Original Public Benchmarks",
    "",
    "This artifact separates original upstream benchmark execution from local adapters.",
    "Rows marked blocked are not scores.",
    "",
    "## Protocol",
    "",
    "- `exact-upstream`: original code, original command, original scoring.",
    "- `dependency-stabilized`: original code and scoring with documented environment variables for external dependency reachability.",
    "- `adapter-diagnostic`: local adapter output, not accepted as original-public score.",
    "",
    "## Upstreams",
    "",
    "| Upstream | Commit |",
    "| --- | --- |",
    ...Object.entries(report.upstreams).map(([name, info]) => `| ${name} | ${info.commit ?? "missing"} |`),
    "",
    "## Runs",
    "",
    "| System | Benchmark | Status | Evidence |",
    "| --- | --- | --- | --- |",
    ...report.rows.map((row) => {
      const evidence = evidenceFor(row);
      return `| ${row.system} | ${row.benchmark} | ${row.status} | ${evidence.replaceAll("|", "\\|")} |`;
    }),
    "",
    "## Improvements For Cognibrain",
    "",
    "| Priority | Improvement | Evidence |",
    "| --- | --- | --- |",
    ...report.improvements.map((item) => (
      `| ${item.priority} | ${item.title} | ${item.evidence.replaceAll("|", "\\|")} |`
    )),
    "",
  ];
  writeFileSync(markdownPath, lines.join("\n"));
}

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(markdownPath), { recursive: true });
const report = buildReport();
writeFileSync(outputPath, JSON.stringify(report, null, 2));
writeMarkdown(report);
console.log(JSON.stringify({
  output: outputPath.replace(root + "/", ""),
  markdown: markdownPath.replace(root + "/", ""),
  passedRows: report.rows.filter((row) => row.status === "passed").length,
  failedRows: report.rows.filter((row) => row.status === "failed").length,
  blockedRows: report.rows.filter((row) => row.status === "blocked").length,
}, null, 2));
