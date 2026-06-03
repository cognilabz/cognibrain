import { describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runEvaluation } from "../src/eval/run";
import { runLocomoBenchmark } from "../src/eval/locomo";
import { runLongMemEvalBenchmark } from "../src/eval/longmemeval";
import { buildExternalHardSummary, summarize as summarizeExternalHardRow } from "../src/eval/externalHard";
import { runMarketGate } from "../src/eval/marketGate";
import { runBeamBenchmark } from "../src/eval/beam";
import { runAnswerGenerationBenchmark } from "../src/eval/answerGeneration";
import { runCogniCodeBench } from "../src/eval/cognicodeBench";
import { generateConnectorMaturity } from "../src/eval/connectorMaturity";
import { generateConnectorCertification } from "../src/eval/connectorCertification";
import { generateConnectorQualityReport } from "../src/eval/connectorQuality";
import { runConnectorTransportProof } from "../src/eval/connectorTransportProof";
import { generateConnectorWebhookProof } from "../src/eval/connectorWebhooks";
import { runVendorConnectorVerification } from "../src/eval/vendorConnectorsLive";
import { verifyVendorApiSpecs } from "../src/eval/vendorApiSpecs";
import { runVendorCredentialSmoke } from "../src/eval/vendorCredentialSmoke";
import { generateHarnessMaturity } from "../src/eval/harnessMaturity";
import { generateOperatorOsMaturity } from "../src/eval/operatorOsMaturity";
import { generateBenchmarkHardeningReport } from "../src/eval/benchmarkHardening";
import { generateBenchmarkRelease, validateBenchmarkReleaseManifest } from "../src/eval/benchmarkRelease";
import { generateRealWorldBlackBoxBenchmark } from "../src/eval/realworldBlackbox";
import { generatePlanGapAudit } from "../src/eval/planGaps";
import { runOperatorMemoryBenchmark } from "../src/eval/operatorMemoryBenchmark";
import { publishArenaReport } from "../src/eval/publishArena";
import { runBenchmarkArena } from "../src/eval/arena";
import { CLI_COMMAND_CONTRACTS, MEMCTL_COMMAND_CONTRACTS } from "../src/api/releaseContract";

const heavyBenchmarkTimeout = 180_000;
const nativeRunnerBenchmarkTimeout = 30_000;

type ConnectorBaseArtifacts = {
  vendorContract: string;
  apiSpecs: string;
  liveSmoke: string;
  webhookProof: string;
  transport: string;
};

let connectorBaseArtifactsPromise: Promise<ConnectorBaseArtifacts> | undefined;

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

function connectorBaseArtifacts(): Promise<ConnectorBaseArtifacts> {
  connectorBaseArtifactsPromise ??= (async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-base-"));
    const paths = {
      vendorContract: join(dir, "vendor-connectors-live.json"),
      apiSpecs: join(dir, "vendor-api-specs.json"),
      liveSmoke: join(dir, "vendor-live-smoke.json"),
      webhookProof: join(dir, "connector-webhooks.json"),
      transport: join(dir, "connector-transport.json")
    };
    await runVendorConnectorVerification(paths.vendorContract);
    verifyVendorApiSpecs({ input: paths.vendorContract, out: paths.apiSpecs });
    await runVendorCredentialSmoke({ out: paths.liveSmoke });
    generateConnectorWebhookProof({ out: paths.webhookProof });
    await runConnectorTransportProof({ out: paths.transport });
    return paths;
  })();
  return connectorBaseArtifactsPromise;
}

describe("self verification benchmark loop", () => {
  it("beats local baselines and satisfies the synthetic token-efficiency gate", () => {
    const report = runEvaluation();
    expect(report.passed).toBe(true);
    expect(report.diagnosticPassed).toBe(true);
    expect(report.claimBoundary.proof).toBe("local-diagnostic");
    expect(report.claimBoundary.qualityClaimAllowed).toBe(false);
    expect(report.claimBoundary.marketClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toContain("substring-diagnostic");
    expect(report.ours.accuracy).toBeGreaterThan(Math.max(...report.baselines.map((item) => item.accuracy)));
    expect(report.ours.meanTokens).toBeLessThan(report.marketGate.requiredMeanTokensUnder);
  }, 30_000);

  it("runs an official LoCoMo evidence-recall slice with the user simulator", () => {
    const report = runLocomoBenchmark({
      maxQuestions: 40,
      topK: 10,
      outputPath: "artifacts/test-locomo-report.json"
    });
    expect(report.ours.total).toBe(40);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("locomo-evidence-id-recall-diagnostic");
    expect(report.claimBoundary.marketClaimAllowed).toBe(false);
    expect(report.ours.accuracy).toBeGreaterThan(Math.max(...report.baselines.map((item) => item.accuracy)));
  }, 240_000);

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
    expect(report.diagnosticPassed).toBe(true);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("longmemeval-answer-session-id-recall-diagnostic");
    expect(report.ours.correct).toBe(1);
  }, 30_000);

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
    expect(report.passed).toBe(false);
    expect(report.diagnosticPassed).toBe(false);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("beam-rubric-support-diagnostic");
    expect(report.claimBoundary.claimBlockers[0]).toContain("diagnostic only");
  });

  it("keeps external-hard public dataset stress summaries diagnostic-only without scoreable proof", () => {
    const row = summarizeExternalHardRow("fixture-locomo", "LoCoMo", "evidence_recall_at_1", { topK: 1 }, "fixture.json", {
      passed: true,
      diagnosticPassed: true,
      proof: "local-diagnostic",
      qualityClaimAllowed: false,
      claimBoundary: { scorer: "locomo-evidence-id-recall-diagnostic" },
      ours: { accuracy: 0.8 },
      baselines: [{ name: "keyword-only", accuracy: 0.6 }]
    });
    const report = buildExternalHardSummary([row], { generatedAt: "2026-06-02T00:00:00.000Z" });
    expect(row.passed).toBe(false);
    expect(row.diagnosticPassed).toBe(true);
    expect(row.scoreable).toBe(false);
    expect(row.proof).toBe("local-diagnostic");
    expect(report.passed).toBe(false);
    expect(report.diagnosticPassed).toBe(true);
    expect(report.claimAllowed).toBe(false);
    expect(report.proofLevel).toBe("diagnostic-public-dataset-stress");
    expect(report.claimBlockers[0]).toContain("locomo-evidence-id-recall-diagnostic");
  }, nativeRunnerBenchmarkTimeout);

  it("allows external-hard stress rows only when child artifacts are LLM or public-benchmark scoreable", () => {
    const row = summarizeExternalHardRow("fixture-beam", "BEAM 100K", "retrieval_nugget_score_at_5", { topK: 5 }, "fixture.json", {
      passed: true,
      diagnosticPassed: true,
      proof: "llm-harness",
      qualityClaimAllowed: true,
      judge: { kind: "provider-evidence-support", status: "passed" },
      ours: { accuracy: 0.8 },
      baselines: [{ name: "keyword-only", accuracy: 0.6 }]
    });
    const report = buildExternalHardSummary([row], { generatedAt: "2026-06-02T00:00:00.000Z" });
    expect(row.passed).toBe(true);
    expect(row.scoreable).toBe(true);
    expect(row.proof).toBe("llm-harness");
    expect(report.passed).toBe(true);
    expect(report.claimAllowed).toBe(true);
    expect(report.claimBlockers).toEqual([]);
  }, nativeRunnerBenchmarkTimeout);

  it("can score BEAM fixtures through a harness evidence judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-beam-provider-"));
    const datasetPath = join(dir, "beam.json");
    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          conversation_id: "beam-provider-fixture-1",
          conversation_seed: { category: "Coding", id: 1, title: "Provider Fixture" },
          chat: [[{ role: "user", content: "I decided to use Redis for the cache layer.", index: "1,1" }]],
          probing_questions:
            "{'information_extraction': [{'question': 'Which technology did I choose for the cache layer?', 'ideal_response': 'The user chose Redis for the cache layer.', 'rubric': ['Redis', 'cache layer']}]}"
        }
      ])
    );
    const report = await runBeamBenchmark({
      datasetPath,
      maxConversations: 1,
      topK: 2,
      outputPath: join(dir, "report.json"),
      evidenceJudge: {
        judgeEvidence: ({ results }) => ({
          answerable: results.length > 0,
          confidence: 0.94,
          reason: "harness fixture judge"
        })
      }
    });
    expect(report.proof).toBe("llm-harness");
    expect(report.qualityClaimAllowed).toBe(true);
    expect(report.passed).toBe(report.diagnosticPassed);
    expect(report.claimBoundary.claimBlockers).toEqual([]);
    expect(report.ours.correct).toBe(1);
    expect(report.ours.judge.kind).toBe("provider-evidence-support");
  });

  it("fails BEAM provider-required runs instead of silently using a deterministic judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-beam-require-provider-"));
    const datasetPath = join(dir, "beam.json");
    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          conversation_id: "beam-require-provider-fixture-1",
          conversation_seed: { category: "Coding", id: 1, title: "Require Provider Fixture" },
          chat: [[{ role: "user", content: "I decided to use Redis for the cache layer.", index: "1,1" }]],
          probing_questions:
            "{'information_extraction': [{'question': 'Which technology did I choose for the cache layer?', 'ideal_response': 'The user chose Redis for the cache layer.', 'rubric': ['Redis', 'cache layer']}]}"
        }
      ])
    );
    await expect(runBeamBenchmark({
      datasetPath,
      maxConversations: 1,
      topK: 2,
      outputPath: join(dir, "report.json"),
      requireEvidenceJudge: true
    })).rejects.toThrow(/evidence judge is required/i);
  });

  it("imports directly comparable competitor artifacts for the market gate", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-market-"));
    const locomoPath = join(dir, "locomo.json");
    const longMemEvalPath = join(dir, "longmemeval.json");
    const competitorsPath = join(dir, "competitors.json");
    const outputPath = join(dir, "market.json");
    const reportShape = {
      qualityClaimAllowed: true,
      ours: {
        name: "open-memory-harness",
        accuracy: 0.9,
        correct: 9,
        total: 10,
        judge: { kind: "provider-evidence-support", status: "passed" },
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
    const report = runMarketGate({ locomoPath, longMemEvalPath, competitorsPath, outputPath, beamPath: "", beam500kPath: "" });
    expect(report.passed).toBe(true);
    expect(report.claimAllowed).toBe(true);
    expect(report.proofLevel).toBe("direct-comparable-market-superiority");
    expect(report.directMarketComparison.configured).toBe(true);
    expect(report.directMarketComparison.passed).toBe(true);
    expect(report.directMarketComparison.comparisons[0].questions[0]).toMatchObject({ id: "fixture-q1", matched: true });
    expect(report.benchmarks.find((item) => item.dataset === "LongMemEval-S")?.questions[0].id).toBe("fixture-q1");
  });

  it("generates connector proof levels and quality scores from checked artifacts", async () => {
    const base = await connectorBaseArtifacts();
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-maturity-"));
    const report = generateConnectorMaturity({
      out: join(dir, "connector-maturity.json"),
      markdown: join(dir, "connector-maturity.md"),
      vendorContract: base.vendorContract,
      apiSpecs: base.apiSpecs,
      liveSmoke: base.liveSmoke,
      webhookProof: base.webhookProof
    });
    expect(report.passed).toBe(true);
    expect(report.proofLevels).toEqual([
      "manifest-only",
      "cli-config",
      "driver-code",
      "hermetic-tested",
      "live-smoke-ready",
      "tenant-verified",
      "production-certified"
    ]);
    expect(report.summary.total).toBeGreaterThanOrEqual(19);
    expect(report.summary.liveSmokeReady).toBeGreaterThanOrEqual(19);
    expect(report.summary.webhookVerified).toBeGreaterThanOrEqual(10);
    expect(report.summary.tenantVerified).toBe(0);
    expect(report.rows.find((row) => row.provider === "jira")?.proofLevel).toBe("live-smoke-ready");
    expect(report.rows.find((row) => row.provider === "github")?.maturity.webhook).toBe(true);
    expect(report.rows.every((row) => row.qualityScore > 0)).toBe(true);
  }, 30_000);

  it("proves connector transport retry and pagination behavior", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-transport-"));
    const report = await runConnectorTransportProof({ out: join(dir, "connector-transport.json") });
    expect(report.passed).toBe(true);
    expect(report.checks.rateLimitBackoff).toBe(true);
    expect(report.checks.cursorPagination).toBe(true);
    expect(report.checks.transientRetry).toBe(true);
    expect(report.listItems).toBeGreaterThanOrEqual(2);
    expect(report.pollEvents).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it("generates connector semantic quality and certification boundaries", async () => {
    const base = await connectorBaseArtifacts();
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-certification-"));
    const maturityPath = join(dir, "connector-maturity.json");
    generateConnectorMaturity({
      out: maturityPath,
      markdown: join(dir, "connector-maturity.md"),
      vendorContract: base.vendorContract,
      apiSpecs: base.apiSpecs,
      liveSmoke: base.liveSmoke,
      webhookProof: base.webhookProof
    });
    const qualityPath = join(dir, "connector-quality.json");
    const quality = generateConnectorQualityReport({
      input: maturityPath,
      out: qualityPath,
      markdown: join(dir, "connector-quality.md")
    });
    const certification = generateConnectorCertification({
      out: join(dir, "connector-certification.json"),
      markdown: join(dir, "connector-certification.md"),
      maturityInput: maturityPath,
      liveSmokeInput: base.liveSmoke,
      transportInput: base.transport,
      qualityInput: qualityPath
    });
    expect(quality.passed).toBe(true);
    expect(quality.summary.checkedCases).toBeGreaterThanOrEqual(19);
    expect(certification.passed).toBe(true);
    expect(certification.summary.credentialBlocked).toBeGreaterThanOrEqual(19);
    expect(certification.summary.productionCertified).toBe(0);
  }, 30_000);

  it("requires signed live-smoke and owner artifacts for tenant and production connector certification", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-signed-cert-"));
    const maturityPath = join(dir, "maturity.json");
    const livePath = join(dir, "live.json");
    const qualityPath = join(dir, "quality.json");
    const transportPath = join(dir, "transport.json");
    writeFileSync(maturityPath, JSON.stringify({
      rows: [{
        provider: "github",
        connectorId: "official-github",
        maturity: {
          hermeticFixture: true,
          apiSpec: true,
          liveSmokeSupport: true,
          webhook: true,
          tenantVerified: true,
          productionCertified: true
        },
        evidence: {}
      }]
    }));
    writeFileSync(qualityPath, JSON.stringify({ rows: [{ provider: "github", passed: true }] }));
    writeFileSync(transportPath, JSON.stringify({ passed: true }));
    writeFileSync(livePath, JSON.stringify({
      writebackEnabled: false,
      providers: [{
        provider: "github",
        checks: { noPlainTokenRetained: true },
        signature: { status: "verified", signer: "tenant" },
        ownerApproval: { status: "approved", actor: "owner", signedAt: "2026-05-27T00:00:00.000Z" }
      }]
    }));
    const certified = generateConnectorCertification({ maturityInput: maturityPath, liveSmokeInput: livePath, qualityInput: qualityPath, transportInput: transportPath });
    expect(certified.rows[0].state).toBe("production-certified");

    writeFileSync(livePath, JSON.stringify({
      writebackEnabled: false,
      providers: [{ provider: "github", checks: { noPlainTokenRetained: true } }]
    }));
    const unsigned = generateConnectorCertification({ maturityInput: maturityPath, liveSmokeInput: livePath, qualityInput: qualityPath, transportInput: transportPath });
    expect(unsigned.rows[0].state).toBe("credential-blocked");
    expect(unsigned.rows[0].checks.tenantLiveSmoke).toBe(false);
  });

  it("proves priority connector webhook signature, replay, normalization, and review queue paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connector-webhooks-"));
    const report = generateConnectorWebhookProof({ out: join(dir, "connector-webhooks.json") });
    expect(report.passed).toBe(true);
    expect(report.summary.total).toBeGreaterThanOrEqual(10);
    expect(report.rows.every((row) => row.checks.signatureValidation && row.checks.replayProtection)).toBe(true);
    expect(report.rows.every((row) => row.checks.eventNormalization && row.checks.reviewQueue && row.checks.sourceRef)).toBe(true);
  });

  it("generates a harness maturity matrix with golden-path proof", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-maturity-"));
    const report = generateHarnessMaturity({
      out: join(dir, "harness-maturity.json"),
      markdown: join(dir, "harness-maturity.md")
    });
    expect(report.passed).toBe(true);
    expect(report.summary.total).toBeGreaterThanOrEqual(16);
    expect(report.summary.generated).toBeGreaterThanOrEqual(16);
    expect(report.rows.find((row) => row.harness === "windsurf")?.maturity.configGenerated).toBe(true);
    expect(report.rows.find((row) => row.harness === "continue")?.maturity.configGenerated).toBe(true);
    expect(report.rows.find((row) => row.harness === "continue")?.maturity.mcp).toBe(false);
    expect(report.rows.find((row) => row.harness === "devin-style")?.maturity.configGenerated).toBe(true);
    expect(report.goldenPaths.every((path) => path.passed)).toBe(true);
    expect(readFileSync(join(dir, "harness-maturity.md"), "utf8")).toContain("Harness Maturity Matrix");
  }, 20_000);

  it("generates terminal operator OS and benchmark hardening proof artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-benchmark-"));
    const operator = generateOperatorOsMaturity({
      out: join(dir, "operator-os-maturity.json"),
      markdown: join(dir, "operator-os.md")
    });
    const benchmark = generateBenchmarkHardeningReport({
      out: join(dir, "benchmark-hardening.json"),
      markdown: join(dir, "benchmark-hardening.md")
    });
    expect(operator.passed).toBe(true);
    expect(operator.rows.find((row) => row.surface === "Truth")?.passed).toBe(true);
    expect(operator.rows.find((row) => row.surface === "Dream")?.passed).toBe(true);
    expect(operator.rows.find((row) => row.surface === "Policies")?.passed).toBe(true);
    expect(operator.rows.find((row) => row.surface === "Retention")?.passed).toBe(true);
    expect(benchmark.passed).toBe(true);
    expect(benchmark.dataset.sha256).toHaveLength(64);
    expect(benchmark.realRepoTrack.repoCount).toBeGreaterThanOrEqual(5);
  });

  it("generates immutable benchmark release manifests and the code-backed plan gap audit", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-plan-gaps-"));
    const scenarios = join(dir, "scenarios.json");
    writeFileSync(scenarios, JSON.stringify([{ id: "s1", query: "release-critical truth" }]));
    const release = generateBenchmarkRelease({
      out: join(dir, "cognicodebench-release.json"),
      markdown: join(dir, "cognicodebench-release.md"),
      scenarioPath: scenarios
    });
    expect(release.releases.find((item) => item.id === "cognicodebench-v2.0" && item.split === "public-dev")?.sha256).toHaveLength(64);
    expect(release.releases.some((item) => item.split === "hidden-eval-placeholder")).toBe(true);
    expect(validateBenchmarkReleaseManifest(release)).toBe(true);
    expect(release.publication).toMatchObject({ qualityClaimAllowed: false, marketClaimAllowed: false, leaderboardEligible: false });
    expect(release.scorecardProofLevels).toContain("same-run-api-shape");
    expect(release.scorecardProofLevels).not.toContain("api-shape");
    expect(release.releases.every((item) => item.claimBoundary.claimAllowed === false && item.claimBoundary.qualityClaimAllowed === false && item.claimBoundary.marketClaimAllowed === false && item.claimBoundary.leaderboardEligible === false)).toBe(true);
    expect(release.releases.every((item) => item.claimBoundary.claimBlockers.length > 0)).toBe(true);
    const markdown = readFileSync(join(dir, "cognicodebench-release.md"), "utf8");
    expect(markdown).toContain("not LLM/harness quality proof or market leaderboard proof");
    expect(markdown).toContain("Claim allowed");
    const invalid = JSON.parse(JSON.stringify(release));
    invalid.releases[0].claimBoundary.qualityClaimAllowed = true;
    expect(() => validateBenchmarkReleaseManifest(invalid)).toThrow(/cannot allow quality/);
    const gaps = generatePlanGapAudit({ out: join(dir, "plan-gaps.json"), markdown: join(dir, "plan-gaps.md") });
    expect(gaps.checks.map((item) => item.area)).toEqual(expect.arrayContaining(["storage", "security", "truth", "dream", "connectors", "harness", "operator", "benchmarks", "enterprise"]));
  });

  it("runs the neutral real-world black-box harness without enabling a premature leaderboard", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-blackbox-"));
    try {
      delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-blackbox.json"),
        markdown: join(dir, "realworld-blackbox.md"),
        systems: ["cognibrain", "keyword", "mem0"]
      });
      const cognibrain = report.systems.find((system) => system.system === "cognibrain");
      const queriesByBucket = report.manifest.queries.reduce<Record<string, number>>((counts, query) => {
        counts[query.bucket] = (counts[query.bucket] ?? 0) + 1;
        return counts;
      }, {});
      expect(report.manifestHash).toHaveLength(64);
      expect(report.manifest.queries.length).toBeGreaterThanOrEqual(15);
      expect(Object.values(queriesByBucket).every((count) => count >= 3)).toBe(true);
      expect(report.manifest.queries.filter((query) => query.shouldAbstain).length).toBeGreaterThanOrEqual(3);
      expect(report.leaderboardEligible).toBe(false);
      expect(report.eligibilityGate.manifestCoverageReady).toBe(true);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(true);
      expect(report.eligibilityGate.costLatencyRecorded).toBe(true);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
      expect(cognibrain?.qualityClaimAllowed).toBe(false);
      expect(cognibrain?.judge.kind).toBe("missing");
      expect(cognibrain?.metrics.score).toBeNull();
      expect(cognibrain?.metrics.recall).toBeNull();
      expect(cognibrain?.retrievalDiagnostics.note).toContain("Diagnostic only");
      expect(cognibrain?.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(cognibrain?.rawOutputs.flatMap((output) => output.retrievedText).join("\n")).not.toMatch(/evidence_id:/);
      expect(cognibrain?.metrics.p95LatencyMs).toBeGreaterThanOrEqual(0);
      expect(report.systems.find((system) => system.system === "mem0")?.evidenceClass).toBe("credential-blocked");
      expect(readFileSync(join(dir, "realworld-blackbox.md"), "utf8")).toContain("Real-World Black-Box Benchmark");
      expect(readFileSync(join(dir, "realworld-blackbox.md"), "utf8")).toContain("not scored");
      expect(existsSync("scripts/benchmark/realworld-openai-judge.mjs")).toBe(true);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  });

  it("scores the real-world black-box harness only through a configured harness judge", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-judge-"));
    const judgePath = join(dir, "judge.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture harness judge decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions, judge: "fixture-harness" })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-blackbox-judged.json"),
        markdown: join(dir, "realworld-blackbox-judged.md"),
        systems: ["cognibrain"]
      });
      const cognibrain = report.systems.find((system) => system.system === "cognibrain");
      expect(report.leaderboardEligible).toBe(false);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(true);
      expect(report.eligibilityGate.enoughOriginalSystems).toBe(false);
      expect(cognibrain?.qualityClaimAllowed).toBe(true);
      expect(cognibrain?.judge.kind).toBe("harness");
      expect(cognibrain?.metrics.score).toBe(1);
      expect(cognibrain?.metrics.forbiddenLeakageRate).toBe(0);
      expect(cognibrain?.setup.judgeRaw).toMatchObject({ judge: "fixture-harness" });
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  });

  it("requires Cognibrain plus two judged original competitor commands for real-world comparative smoke eligibility without market claims", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const previousBasicMemoryCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const previousLangMemCommand = process.env.MEMORY_REALWORLD_LANGMEM_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-market-gate-"));
    const judgePath = join(dir, "judge.mjs");
    const competitorPath = join(dir, "competitor.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture harness judge decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions, judge: "fixture-market-gate" })); });`
    );
    writeFileSync(
      competitorPath,
      `
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  const rawOutputs = payload.manifest.queries.map(query => {
    const ids = query.expectedEvidenceIds.slice(0, query.topK);
    return {
      queryId: query.id,
      retrievedEvidenceIds: ids,
      retrievedText: ids.map(id => "fixture judged evidence " + id),
      latencyMs: 1,
      raw: { queryId: query.id, system: payload.system }
    };
  });
  console.log(JSON.stringify({
    schemaVersion: "1.0",
    system: payload.system,
    displayName: payload.system,
    qualityClaimAllowed: true,
    judge: { kind: "harness", status: "passed", reason: "fixture judged external command" },
    metrics: { score: 1, recall: 1, abstentionPrecision: 1, forbiddenLeakageRate: 0, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 1, estimatedCostUsd: 0 },
    rawOutputs,
    setup: { runner: "fixture-original-command" }
  }));
});
`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${competitorPath}`;
      process.env.MEMORY_REALWORLD_LANGMEM_COMMAND = `${process.execPath} ${competitorPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-market-gate.json"),
        systems: ["cognibrain", "basicmemory", "langmem", "keyword"]
      });
      expect(report.comparativeSmokeEligible).toBe(true);
      expect(report.leaderboardEligible).toBe(false);
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.status).toBe("comparative-smoke-eligible-results-not-market-leaderboard");
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(true);
      expect(report.eligibilityGate.enoughOriginalSystems).toBe(true);
      expect(report.leaderboardEligibleSystems).toEqual([]);
      expect(report.comparativeSmokeEligibleSystems).toEqual(expect.arrayContaining(["cognibrain", "basicmemory", "langmem"]));
      expect(report.comparativeSmokeEligibleSystems).not.toContain("keyword");
      expect(report.systems.filter((system) => system.leaderboardEligible)).toEqual([]);
      expect(report.systems.filter((system) => system.comparativeSmokeEligible).map((system) => system.system)).toEqual(expect.arrayContaining(["cognibrain", "basicmemory", "langmem"]));
      expect(report.claimBoundary).toMatchObject({
        claimAllowed: false,
        comparativeSmokeEligible: true,
        leaderboardEligible: false,
        marketClaimAllowed: false
      });
      expect(report.claimBoundary.claimBlockers.join(" ")).toContain("larger third-party-sourced task set");
      expect(report.systems.find((system) => system.system === "basicmemory")?.evidenceClass).toBe("same-run-command");
      expect(report.systems.find((system) => system.system === "langmem")?.evidenceClass).toBe("same-run-command");
      expect(report.improvementSignals.some((signal) => signal.evidence.includes("Cognibrain and 2 original competitors"))).toBe(true);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
      if (previousBasicMemoryCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousBasicMemoryCommand;
      if (previousLangMemCommand === undefined) delete process.env.MEMORY_REALWORLD_LANGMEM_COMMAND;
      else process.env.MEMORY_REALWORLD_LANGMEM_COMMAND = previousLangMemCommand;
    }
  }, 30_000);

  it("blocks malformed real-world judge decisions while retaining same-run raw outputs", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-malformed-judge-"));
    const judgePath = join(dir, "malformed-judge.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const first = payload.manifest.queries[0]; console.log(JSON.stringify({ decisions: [{ queryId: first.id, score: 1, passed: true, supportsAnswer: true, abstained: false, leakedForbiddenEvidence: false, reason: "fixture one", confidence: 0.99 }, { queryId: first.id, score: 1, passed: true, supportsAnswer: true, abstained: false, leakedForbiddenEvidence: false, reason: "fixture duplicate", confidence: 0.99 }] })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-malformed-judge.json"),
        systems: ["cognibrain"]
      });
      const cognibrain = report.systems[0];
      expect(cognibrain.qualityClaimAllowed).toBe(false);
      expect(cognibrain.leaderboardEligible).toBe(false);
      expect(cognibrain.metrics.score).toBeNull();
      expect(cognibrain.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(cognibrain.blockedReason).toContain("duplicate decision");
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  }, nativeRunnerBenchmarkTimeout);

  it("blocks inconsistent real-world judge decisions even when the judge returns a complete decision set", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-inconsistent-judge-"));
    const judgePath = join(dir, "inconsistent-judge.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map((query, index) => ({ queryId: query.id, score: index === 0 ? 0.8 : 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: index === 0, reason: "fixture inconsistent semantic judge decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-inconsistent-judge.json"),
        systems: ["cognibrain"]
      });
      const cognibrain = report.systems[0];
      expect(cognibrain.qualityClaimAllowed).toBe(false);
      expect(cognibrain.leaderboardEligible).toBe(false);
      expect(cognibrain.metrics.score).toBeNull();
      expect(cognibrain.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(cognibrain.blockedReason).toContain("forbidden leakage must force passed=false");
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  }, nativeRunnerBenchmarkTimeout);

  it("preserves the last successful judged real-world artifact across blocked reruns", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-success-"));
    const judgePath = join(dir, "judge.mjs");
    const latestPath = join(dir, "latest.json");
    const successPath = join(dir, "success.json");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture harness judge decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions, judge: "fixture-harness" })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      const judged = await generateRealWorldBlackBoxBenchmark({
        out: latestPath,
        successOut: successPath,
        systems: ["cognibrain"]
      });
      expect(judged.systems[0].qualityClaimAllowed).toBe(true);
      expect(JSON.parse(readFileSync(successPath, "utf8")).systems[0].metrics.score).toBe(1);

      delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      const blocked = await generateRealWorldBlackBoxBenchmark({
        out: latestPath,
        successOut: successPath,
        systems: ["cognibrain"]
      });
      expect(blocked.systems[0].qualityClaimAllowed).toBe(false);
      expect(JSON.parse(readFileSync(latestPath, "utf8")).systems[0].metrics.score).toBeNull();
      expect(JSON.parse(readFileSync(successPath, "utf8")).systems[0].metrics.score).toBe(1);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  });

  it("retains original command raw outputs when the external judge is blocked", async () => {
    const previousCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-command-blocked-"));
    const commandPath = join(dir, "blocked-command.mjs");
    writeFileSync(
      commandPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const rawOutputs = payload.manifest.queries.map(query => ({ queryId: query.id, retrievedEvidenceIds: [], retrievedText: [], latencyMs: 1, raw: { query: query.id } })); console.log(JSON.stringify({ schemaVersion: "1.0", system: "basicmemory", displayName: "Basic Memory", qualityClaimAllowed: false, blockedReason: "fixture judge credential blocked", judge: { kind: "missing", status: "blocked", reason: "fixture judge credential blocked" }, metrics: { score: null, recall: null, abstentionPrecision: null, forbiddenLeakageRate: null, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 0, estimatedCostUsd: 0 }, retrievalDiagnostics: { deterministicEvidenceIdMatch: true, expectedHits: 0, forbiddenHits: 0, abstentionNoResult: 0, note: "raw outputs retained but judge blocked" }, rawOutputs, setup: { runner: "fixture-original-command" } })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-command-blocked.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.evidenceClass).not.toBe("credential-blocked");
      expect(basicMemory.adapterMode).toBe("external-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.leaderboardEligible).toBe(false);
      expect(basicMemory.judge).toMatchObject({ kind: "missing", status: "blocked" });
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(report.eligibilityGate.sameManifestForAllSystems).toBe(true);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(true);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousCommand;
    }
  });

  it("does not trust external command self-judged metrics without central real-world judge recomputation", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const previousBasicMemoryCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-self-judged-command-"));
    const commandPath = join(dir, "self-judged-command.mjs");
    writeFileSync(
      commandPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const rawOutputs = payload.manifest.queries.map(query => ({ queryId: query.id, retrievedEvidenceIds: query.expectedEvidenceIds.slice(0, query.topK), retrievedText: query.expectedEvidenceIds.map(id => "fixture evidence " + id), latencyMs: 1, raw: { queryId: query.id } })); console.log(JSON.stringify({ schemaVersion: "1.0", system: "basicmemory", displayName: "Basic Memory", qualityClaimAllowed: true, judge: { kind: "harness", status: "passed", reason: "fixture self judged metrics" }, metrics: { score: 1, recall: 1, abstentionPrecision: 1, forbiddenLeakageRate: 0, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 1, estimatedCostUsd: 0 }, rawOutputs, setup: { runner: "fixture-self-judged-command" } })); });`
    );
    try {
      delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-self-judged-command.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.leaderboardEligible).toBe(false);
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(basicMemory.blockedReason).toContain("central MEMORY_REALWORLD_JUDGE_COMMAND recomputation is required");
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
      if (previousBasicMemoryCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousBasicMemoryCommand;
    }
  });

  it("classifies configured external command JSON failures as same-run diagnostics, not credential blockers", async () => {
    const previousCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-command-invalid-json-"));
    const commandPath = join(dir, "invalid-json-command.mjs");
    writeFileSync(commandPath, `process.stdout.write("not-json");`);
    try {
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-command-invalid-json.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.adapterMode).toBe("external-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.leaderboardEligible).toBe(false);
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(0);
      expect(basicMemory.blockedReason).toContain("JSON parse failed");
      expect(basicMemory.setup.commandBlocked).toBe(true);
      expect(basicMemory.setup.rawOutputContractValid).toBe(false);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(false);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousCommand;
    }
  });

  it("blocks malformed blocked-run latency metrics without discarding raw outputs", async () => {
    const previousCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-command-metric-contract-"));
    const commandPath = join(dir, "malformed-metric-command.mjs");
    writeFileSync(
      commandPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const rawOutputs = payload.manifest.queries.map(query => ({ queryId: query.id, retrievedEvidenceIds: [], retrievedText: [], latencyMs: 1, raw: { query: query.id } })); console.log(JSON.stringify({ schemaVersion: "1.0", system: "basicmemory", displayName: "Basic Memory", qualityClaimAllowed: false, blockedReason: "fixture judge credential blocked", judge: { kind: "missing", status: "blocked", reason: "fixture judge credential blocked" }, metrics: { score: null, recall: null, abstentionPrecision: null, forbiddenLeakageRate: null, p50LatencyMs: 1, p95LatencyMs: -5, ingestLatencyMs: 0, estimatedCostUsd: -1 }, rawOutputs, setup: { runner: "fixture-original-command" } })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-command-metric-contract.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(basicMemory.blockedReason).toContain("blocked external p95LatencyMs");
      expect(basicMemory.setup.metricContractValid).toBe(false);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(true);
      expect(report.eligibilityGate.costLatencyRecorded).toBe(false);
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousCommand;
    }
  });

  it("blocks malformed external judged metrics without discarding original command raw outputs", async () => {
    const previousCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-command-malformed-"));
    const commandPath = join(dir, "malformed-command.mjs");
    writeFileSync(
      commandPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const rawOutputs = payload.manifest.queries.map(query => ({ queryId: query.id, retrievedEvidenceIds: [], retrievedText: [], latencyMs: 1, raw: { query: query.id } })); console.log(JSON.stringify({ schemaVersion: "1.0", system: "basicmemory", displayName: "Basic Memory", qualityClaimAllowed: true, judge: { kind: "harness", status: "passed", reason: "fixture malformed metrics" }, metrics: { score: 1.2, recall: 1, abstentionPrecision: 1, forbiddenLeakageRate: 0, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 0, estimatedCostUsd: 0 }, rawOutputs, setup: { runner: "fixture-original-command" } })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-command-malformed.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.leaderboardEligible).toBe(false);
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(basicMemory.blockedReason).toContain("central MEMORY_REALWORLD_JUDGE_COMMAND recomputation is required");
      expect(report.eligibilityGate.rawOutputsRetained).toBe(true);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousCommand;
    }
  });

  it("blocks external raw outputs that do not exactly match the frozen manifest queries", async () => {
    const previousCommand = process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-command-raw-contract-"));
    const commandPath = join(dir, "malformed-raw-command.mjs");
    writeFileSync(
      commandPath,
      `
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  const queries = payload.manifest.queries;
  const rawOutputs = queries.map(query => ({ queryId: query.id, retrievedEvidenceIds: [], retrievedText: [], latencyMs: 1, raw: { query: query.id } }));
  rawOutputs[rawOutputs.length - 1] = { ...rawOutputs[0] };
  console.log(JSON.stringify({
    schemaVersion: "1.0",
    system: "basicmemory",
    displayName: "Basic Memory",
    qualityClaimAllowed: false,
    judge: { kind: "missing", status: "blocked", reason: "fixture judge blocked" },
    metrics: { score: null, recall: null, abstentionPrecision: null, forbiddenLeakageRate: null, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 0, estimatedCostUsd: 0 },
    rawOutputs,
    setup: { runner: "fixture-original-command" }
  }));
});
`
    );
    try {
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${commandPath}`;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-command-raw-contract.json"),
        systems: ["basicmemory"]
      });
      const basicMemory = report.systems[0];
      expect(basicMemory.evidenceClass).toBe("same-run-command");
      expect(basicMemory.qualityClaimAllowed).toBe(false);
      expect(basicMemory.leaderboardEligible).toBe(false);
      expect(basicMemory.metrics.score).toBeNull();
      expect(basicMemory.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(basicMemory.blockedReason).toContain("duplicate queryId");
      expect(basicMemory.setup.rawOutputContractValid).toBe(false);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(false);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND;
      else process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = previousCommand;
    }
  });

  it("retains Cognibrain raw outputs when the configured judge fails after retrieval", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-judge-blocked-"));
    const judgePath = join(dir, "blocked-judge.mjs");
    const fakeSecret = "sk-proj-fixture-secret-token-1234567890abcdefghijklmnopqrstuvwxyz";
    writeFileSync(judgePath, `console.error("fixture judge credential blocked ${fakeSecret}"); process.exit(1);`);
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath} --api-key ${fakeSecret}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      const outPath = join(dir, "realworld-judge-blocked.json");
      const report = await generateRealWorldBlackBoxBenchmark({
        out: outPath,
        systems: ["cognibrain"]
      });
      const cognibrain = report.systems[0];
      expect(cognibrain.evidenceClass).toBe("same-run-full");
      expect(cognibrain.qualityClaimAllowed).toBe(false);
      expect(cognibrain.judge).toMatchObject({ kind: "missing", status: "blocked" });
      expect(cognibrain.metrics.score).toBeNull();
      expect(cognibrain.rawOutputs).toHaveLength(report.manifest.queries.length);
      expect(cognibrain.rawOutputs.some((output) => output.retrievedText.length > 0)).toBe(true);
      expect(report.eligibilityGate.sameManifestForAllSystems).toBe(true);
      expect(report.eligibilityGate.rawOutputsRetained).toBe(true);
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
      expect(report.runProvenance.judge.commandFingerprint).toHaveLength(64);
      const artifact = readFileSync(outPath, "utf8");
      expect(artifact).not.toContain(fakeSecret);
      expect(artifact).not.toContain("--api-key");
      expect(artifact).toContain("[redacted:secret]");
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  });

  it("rejects string-coerced booleans from the OpenAI real-world judge wrapper", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.setHeader("connection", "close");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                decision: {
                  queryId: "q1",
                  score: 1,
                  passed: "true",
                  supportsAnswer: "true",
                  abstained: "false",
                  leakedForbiddenEvidence: "false",
                  reason: "fixture invalid string booleans",
                  confidence: 0.9
                }
              })
            }
          }]
        }));
      });
    });
    await listenOnAllowedPort(server);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture server did not expose a port");
      const payload = {
        manifest: {
          queries: [{ id: "q1", question: "What fixed NovaRetail?", expectedEvidenceIds: ["e1"], topK: 3 }],
          events: [{ id: "e1", content: "Redis pipeline batching fixed NovaRetail checkout timeouts." }]
        },
        rawOutputs: [{ queryId: "q1", retrievedText: ["Redis pipeline batching fixed NovaRetail checkout timeouts."] }]
      };
      const result = await runNodeScript(["scripts/benchmark/realworld-openai-judge.mjs"], {
        cwd: process.cwd(),
        input: `${JSON.stringify(payload)}\n`,
        timeout: 10_000,
        env: {
          ...process.env,
          MEMORY_OPENAI_API_KEY: "fixture-key",
          MEMORY_OPENAI_BASE_URL: `http://127.0.0.1:${address.port}`
        }
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("must be a JSON boolean");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("records OpenAI real-world judge usage and estimated scorer cost", async () => {
    const server = createServer((request, response) => {
      request.resume();
      request.on("end", () => {
        response.setHeader("content-type", "application/json");
        response.setHeader("connection", "close");
        response.end(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                decision: {
                  queryId: "q1",
                  score: 1,
                  passed: true,
                  supportsAnswer: true,
                  abstained: false,
                  leakedForbiddenEvidence: false,
                  reason: "fixture semantic judge decision",
                  confidence: 0.9
                }
              })
            }
          }],
          usage: { prompt_tokens: 1000, completion_tokens: 500 }
        }));
      });
    });
    await listenOnAllowedPort(server);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture server did not expose a port");
      const payload = {
        manifest: {
          queries: [{ id: "q1", question: "What fixed NovaRetail?", expectedEvidenceIds: ["e1"], topK: 3 }],
          events: [{ id: "e1", content: "Redis pipeline batching fixed NovaRetail checkout timeouts." }]
        },
        rawOutputs: [{ queryId: "q1", retrievedText: ["Redis pipeline batching fixed NovaRetail checkout timeouts."] }]
      };
      const result = await runNodeScript(["scripts/benchmark/realworld-openai-judge.mjs"], {
        cwd: process.cwd(),
        input: `${JSON.stringify(payload)}\n`,
        timeout: 10_000,
        env: {
          ...process.env,
          MEMORY_OPENAI_API_KEY: "fixture-key",
          MEMORY_OPENAI_BASE_URL: `http://127.0.0.1:${address.port}`,
          MEMORY_REALWORLD_JUDGE_MODEL: "gpt-4.1-mini"
        }
      });
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.judge).toMatchObject({
        kind: "llm",
        model: "gpt-4.1-mini",
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
        pricing: {
          source: "openai-pricing-2026-06-03",
          inputCostPerMillionUsd: 0.4,
          outputCostPerMillionUsd: 1.6
        },
        requestCount: 1
      });
      expect(parsed.judge.estimatedCostUsd).toBe(0.0012);
      expect(parsed.judge.perQueryLatencyMs.q1).toBeGreaterThanOrEqual(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("blocks LLM real-world judge decisions that omit scorer cost evidence", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-llm-cost-gate-"));
    const judgePath = join(dir, "llm-no-cost-judge.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture llm judge decision without cost", confidence: 0.99 })); console.log(JSON.stringify({ decisions, judge: { kind: "llm", usage: { prompt_tokens: 10, completion_tokens: 2 } } })); });`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "llm";
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-llm-no-cost.json"),
        systems: ["cognibrain"]
      });
      const cognibrain = report.systems[0];
      expect(cognibrain.qualityClaimAllowed).toBe(false);
      expect(cognibrain.metrics.score).toBeNull();
      expect(cognibrain.metrics.estimatedCostUsd).toBe(0);
      expect(cognibrain.blockedReason).toContain("positive estimatedCostUsd");
      expect(report.eligibilityGate.llmOrHarnessJudged).toBe(false);
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
    }
  });

  it("exports only delivered real-world retrieval evidence while retaining excluded diagnostics", async () => {
    const previousJudgeCommand = process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
    const previousJudgeKind = process.env.MEMORY_REALWORLD_JUDGE_KIND;
    const previousIntelligenceCommand = process.env.MEMORY_INTELLIGENCE_COMMAND;
    const previousIntelligenceArgs = process.env.MEMORY_INTELLIGENCE_ARGS;
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-delivered-"));
    const judgePath = join(dir, "judge.mjs");
    const intelligencePath = join(dir, "intelligence.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture harness judge decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions })); });`
    );
    writeFileSync(
      intelligencePath,
      `
const task = process.argv[2];
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  if (task !== "evidence") {
    console.log(JSON.stringify({}));
    return;
  }
  const query = String(payload.query || "");
  const decisions = payload.results.map(result => {
    const content = result.memory.content;
    const include =
      (query.includes("Acme Billing") && content.includes("Postgres")) ||
      (query.includes("NovaRetail") && content.includes("NovaRetail")) ||
      (!query.includes("Acme Billing") && !query.includes("NovaRetail") && !content.includes("February pilot") && !content.includes("CobaltLane"));
    const decision = content.includes("February pilot") ? "exclude" : content.includes("CobaltLane") ? "review" : include ? "include" : "exclude";
    return { id: result.id, decision, confidence: 0.95, reason: "fixture harness evidence decision" };
  });
  console.log(JSON.stringify({ answerable: true, confidence: 0.95, reason: "fixture harness evidence", decisions }));
});
`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      process.env.MEMORY_INTELLIGENCE_COMMAND = process.execPath;
      process.env.MEMORY_INTELLIGENCE_ARGS = intelligencePath;
      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-blackbox-delivered.json"),
        markdown: join(dir, "realworld-blackbox-delivered.md"),
        systems: ["cognibrain"]
      });
      const acme = report.systems[0].rawOutputs.find((output) => output.queryId === "q-acme-current-db");
      expect(acme?.retrievedText.join("\n")).not.toContain("Postgres");
      expect(acme?.retrievedText.join("\n")).not.toContain("February pilot");
      expect(acme?.raw).toEqual(expect.arrayContaining([
        expect.objectContaining({ evidenceId: "temporal-acme-db-current", delivered: false, decision: "review", unsafeToInject: true })
      ]));
      expect(acme?.raw).toEqual(expect.arrayContaining([
        expect.objectContaining({ evidenceId: "temporal-acme-db-old", delivered: false, decision: "exclude" })
      ]));
      const support = report.systems[0].rawOutputs.find((output) => output.queryId === "q-support-novaretail-fix");
      expect(support?.retrievedText.join("\n")).toContain("NovaRetail");
      expect(support?.retrievedText.join("\n")).not.toContain("CobaltLane");
      expect(support?.raw).toEqual(expect.arrayContaining([
        expect.objectContaining({ evidenceId: "support-cobaltlane-decoy", delivered: false, decision: "review", unsafeToInject: true })
      ]));
    } finally {
      if (previousJudgeCommand === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_COMMAND;
      else process.env.MEMORY_REALWORLD_JUDGE_COMMAND = previousJudgeCommand;
      if (previousJudgeKind === undefined) delete process.env.MEMORY_REALWORLD_JUDGE_KIND;
      else process.env.MEMORY_REALWORLD_JUDGE_KIND = previousJudgeKind;
      if (previousIntelligenceCommand === undefined) delete process.env.MEMORY_INTELLIGENCE_COMMAND;
      else process.env.MEMORY_INTELLIGENCE_COMMAND = previousIntelligenceCommand;
      if (previousIntelligenceArgs === undefined) delete process.env.MEMORY_INTELLIGENCE_ARGS;
      else process.env.MEMORY_INTELLIGENCE_ARGS = previousIntelligenceArgs;
    }
  }, heavyBenchmarkTimeout);

  it("covers truth and dream workbench commands in the release contract", () => {
    const cliCommands = new Set(CLI_COMMAND_CONTRACTS.map((contract) => contract.command));
    const memctlCommands = new Set(MEMCTL_COMMAND_CONTRACTS.map((contract) => contract.command));
    expect([...cliCommands]).toEqual(expect.arrayContaining(["truth", "dream"]));
    expect([...memctlCommands]).toEqual(expect.arrayContaining([
      "truth-current",
      "truth-conflicts",
      "truth-resolve",
      "dream-plan",
      "dream-run",
      "dream-start",
      "dream-jobs",
      "dream-cancel",
      "dream-retry",
      "dream-verify",
      "dream-conflicts",
      "dream-resolve"
    ]));
  });

  it("runs the operator memory dream benchmark and blocks unsupported market claims", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-"));
    const report = await runOperatorMemoryBenchmark({
      out: join(dir, "operator-memory-benchmark.json"),
      markdown: join(dir, "operator-memory-benchmark.md")
    });
    expect(report.passed).toBe(true);
    expect(report.diagnosticPassed).toBe(true);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.marketClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("operator-memory-local-check-diagnostic");
    expect(report.claimBoundary.claimBlockers[0]).toContain("deterministic diagnostics only");
    expect(report.judge.kind).toBe("missing");
    expect(report.summary.localBaselineSuperiority).toBe(true);
    expect(report.summary.cognibrainHasFailures).toBe(true);
    expect(report.summary.cognibrainScore).toBeGreaterThan(report.summary.bestBaselineScore);
    expect(report.summary.cognibrainScore).toBeLessThan(1);
    expect(report.summary.marketSuperiorityClaimAllowed).toBe(false);
    expect(report.summary.marketSuperiorityBlockers.length).toBeGreaterThan(0);
    const markdown = readFileSync(join(dir, "operator-memory-benchmark.md"), "utf8");
    expect(markdown).toContain("Operator Memory Dream Benchmark");
    expect(markdown).toContain("Quality claim allowed: no");
    expect(markdown).toContain("Local operator-memory scores are diagnostics only");
  });

  it("allows operator-memory quality claims only after a strict report-level LLM harness judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-quality-"));
    const judgePath = join(dir, "quality-judge.mjs");
    writeFileSync(
      judgePath,
      `process.stdin.resume(); process.stdin.on("end", () => { console.log(JSON.stringify({ passed: true, score: 0.93, reason: "report-level harness judged source-aware behavior", evidence: { reviewer: "fixture" } })); });`
    );
    const previous = process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_COMMAND;
    try {
      process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      const report = await runOperatorMemoryBenchmark({
        out: join(dir, "operator-memory-quality.json"),
        markdown: join(dir, "operator-memory-quality.md")
      });
      expect(report.diagnosticPassed).toBe(true);
      expect(report.proof).toBe("llm-harness");
      expect(report.qualityClaimAllowed).toBe(true);
      expect(report.claimBoundary.scorer).toBe("operator-memory-llm-harness-judge");
      expect(report.judge).toMatchObject({ kind: "llm-harness-command", status: "passed", score: 0.93 });
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.claimBoundary.claimBlockers.some((item) => item.includes("same-run native/cloud"))).toBe(true);
      expect(readFileSync(join(dir, "operator-memory-quality.md"), "utf8")).toContain("Quality claim allowed: yes");
    } finally {
      if (previous === undefined) delete process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_COMMAND;
      else process.env.MEMORY_OPERATOR_MEMORY_QUALITY_JUDGE_COMMAND = previous;
    }
  });

  it("does not score native operator-memory competitor self-checks without an LLM harness judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-native-"));
    const providerPath = join(dir, "native-provider.mjs");
    writeFileSync(
      providerPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const failed = payload.scenario.kind === "connector_failure"; console.log(JSON.stringify({ proofLevel: "same-run-native", adapterMode: "native-command", runnerContract: { rawEvidenceOnly: true, selfScoredChecksAllowed: false, scoreableChecksRequireJudge: true, judgeEnv: "MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND", judgeProtocol: "cognibrain-operator-memory-llm-harness-judge-v1" }, checks: { currentTruthSelected: true, staleTruthSuppressed: failed, sourceRefRevalidated: false, connectorRefreshAccounted: false, beliefRevisionApplied: false, failureContained: failed }, capabilityGaps: ["fixture native runner has no source-aware dream"], latencyMs: 1, evidence: { scenarioId: payload.scenario.id } })); });`
    );
    const previous = process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND;
    const previousJudge = process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND;
    try {
      process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND = `${process.execPath} ${providerPath}`;
      delete process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND;
      const report = await runOperatorMemoryBenchmark({
        out: join(dir, "operator-memory-native.json"),
        markdown: join(dir, "operator-memory-native.md"),
        systems: ["cognibrain-dream", "mem0-native"]
      });
      const mem0 = report.systems.find((system) => system.system === "mem0-native");
      expect(mem0?.proofLevel).toBe("same-run-native");
      expect(mem0?.runner?.commandEnv).toBe("MEMORY_OPERATOR_MEMORY_MEM0_COMMAND");
      expect(mem0?.score).toBe(0);
      expect(mem0?.scenarios[0]?.evidence.structuredChecks).toBe(false);
      expect(mem0?.scenarios[0]?.evidence.runnerSelfChecksIgnored).toBe(true);
      expect(mem0?.scenarios[0]?.evidence.runnerContract).toMatchObject({
        rawEvidenceOnly: true,
        selfScoredChecksAllowed: false,
        scoreableChecksRequireJudge: true,
        judgeEnv: "MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND"
      });
      expect(mem0?.runnerContract).toMatchObject({
        rawEvidenceOnly: true,
        selfScoredChecksAllowed: false,
        scoreableChecksRequireJudge: true,
        observedScenarioContracts: 10,
        scenarioCount: 10
      });
      expect(mem0?.scenarios[0]?.evidence.judge).toEqual({ kind: "missing" });
      expect(mem0?.capabilityGaps.join(" ")).toContain("self-scored operator-memory checks");
      expect(report.summary.cognibrainScore).toBeGreaterThan(mem0?.score ?? 0);
      expect(report.summary.marketSuperiorityClaimAllowed).toBe(false);
      expect(report.summary.marketSuperiorityBlockers.some((item) => item.includes("Mem0") && item.includes("unjudged"))).toBe(true);
      expect(report.summary.marketSuperiorityBlockers.some((item) => item.includes("Graphiti"))).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND;
      else process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND = previous;
      if (previousJudge === undefined) delete process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND;
      else process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND = previousJudge;
    }
  }, nativeRunnerBenchmarkTimeout);

  it("scores native operator-memory competitor evidence only after a strict LLM harness judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-judged-"));
    const providerPath = join(dir, "native-provider.mjs");
    const judgePath = join(dir, "judge.mjs");
    writeFileSync(
      providerPath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); console.log(JSON.stringify({ proofLevel: "same-run-native", adapterMode: "native-command", checks: { currentTruthSelected: "true", staleTruthSuppressed: "true", sourceRefRevalidated: "true", connectorRefreshAccounted: "true", beliefRevisionApplied: "true", failureContained: "true" }, capabilityGaps: ["fixture native runner requires central judge"], latencyMs: 1, evidence: { retrievedText: "semantic evidence for " + payload.scenario.id } })); });`
    );
    writeFileSync(
      judgePath,
      `process.stdin.resume(); process.stdin.on("end", () => { console.log(JSON.stringify({ checks: { currentTruthSelected: true, staleTruthSuppressed: true, sourceRefRevalidated: true, connectorRefreshAccounted: false, beliefRevisionApplied: true, failureContained: false }, confidence: 0.92, reason: "central harness judged raw evidence" })); });`
    );
    const previous = process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND;
    const previousJudge = process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND;
    try {
      process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND = `${process.execPath} ${providerPath}`;
      process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      const report = await runOperatorMemoryBenchmark({
        out: join(dir, "operator-memory-judged.json"),
        markdown: join(dir, "operator-memory-judged.md"),
        systems: ["cognibrain-dream", "mem0-native"]
      });
      const mem0 = report.systems.find((system) => system.system === "mem0-native");
      expect(mem0?.proofLevel).toBe("same-run-native");
      expect(mem0?.score).toBeGreaterThan(0);
      expect(mem0?.scenarios[0]?.evidence.structuredChecks).toBe(true);
      expect(mem0?.scenarios[0]?.evidence.runnerSelfChecksIgnored).toBe(false);
      expect(mem0?.scenarios[0]?.evidence.judge).toMatchObject({
        kind: "llm-harness-command",
        confidence: 0.92,
        reason: "central harness judged raw evidence"
      });
      expect(report.summary.marketSuperiorityClaimAllowed).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND;
      else process.env.MEMORY_OPERATOR_MEMORY_MEM0_COMMAND = previous;
      if (previousJudge === undefined) delete process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND;
      else process.env.MEMORY_OPERATOR_MEMORY_JUDGE_COMMAND = previousJudge;
    }
  }, 30_000);

  it("includes Basic Memory in the Arena competitor matrix with bounded proof", async () => {
    const previous = process.env.MEMORY_ARENA_AUTO_NATIVE;
    try {
      process.env.MEMORY_ARENA_AUTO_NATIVE = "false";
      const report = await runBenchmarkArena({ systems: ["basicmemory"], count: 2 });
      const basicMemory = report.systems.find((system) => system.system === "basicmemory");
      expect(basicMemory?.displayName).toBe("Basic Memory");
      expect(basicMemory?.proofLevel).toBe("same-run-api-shape");
      expect(basicMemory?.capabilityGaps.join(" ")).toContain("pre-tool action guard");
      expect(basicMemory?.score).toBeGreaterThan(0);
    } finally {
      process.env.MEMORY_ARENA_AUTO_NATIVE = previous;
    }
  });

  it("keeps Benchmark Arena diagnostic passes claim-blocked without a report-level harness judge", async () => {
    const previousJudge = process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
    const previousAutoNative = process.env.MEMORY_ARENA_AUTO_NATIVE;
    try {
      delete process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
      process.env.MEMORY_ARENA_AUTO_NATIVE = "false";
      const report = await runBenchmarkArena({ systems: ["cognibrain", "mem0", "graphiti", "cognee", "langmem"], count: 2 });
      expect(report.passed).toBe(true);
      expect(report.diagnosticPassed).toBe(true);
      expect(report.qualityClaimAllowed).toBe(false);
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.leaderboardEligible).toBe(false);
      expect(report.judge).toMatchObject({ kind: "missing", status: "missing", score: null });
      expect(report.claimBoundary).toMatchObject({
        proof: "arena-local-diagnostic",
        scorer: "arena-local-scenario-diagnostic",
        claimAllowed: false,
        qualityClaimAllowed: false,
        marketClaimAllowed: false,
        leaderboardEligible: false
      });
      expect(report.claimBoundary.claimBlockers.join(" ")).toContain("MEMORY_ARENA_QUALITY_JUDGE_COMMAND");
    } finally {
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND = previousJudge;
      if (previousAutoNative === undefined) delete process.env.MEMORY_ARENA_AUTO_NATIVE;
      else process.env.MEMORY_ARENA_AUTO_NATIVE = previousAutoNative;
    }
  });

  it("allows Benchmark Arena quality claims only through a report-level LLM harness judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-quality-judge-"));
    const judgePath = join(dir, "judge.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); if (payload.contract !== "cognibrain-arena-quality-llm-harness-judge-v1") throw new Error("bad contract"); console.log(JSON.stringify({ passed: true, score: 0.94, reason: "fixture report-level judge validated Arena evidence", evidence: { systems: payload.systems.length } })); });`
    );
    const previousJudge = process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
    const previousAutoNative = process.env.MEMORY_ARENA_AUTO_NATIVE;
    try {
      process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_ARENA_AUTO_NATIVE = "false";
      const report = await runBenchmarkArena({ systems: ["cognibrain", "mem0", "graphiti", "cognee", "langmem"], count: 2 });
      expect(report.diagnosticPassed).toBe(true);
      expect(report.qualityClaimAllowed).toBe(true);
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.leaderboardEligible).toBe(false);
      expect(report.judge).toMatchObject({ kind: "llm-harness-command", status: "passed", score: 0.94 });
      expect(report.claimBoundary).toMatchObject({
        proof: "arena-llm-harness-judge",
        scorer: "arena-report-llm-harness-judge",
        claimAllowed: true,
        qualityClaimAllowed: true,
        marketClaimAllowed: false,
        leaderboardEligible: false
      });
      expect(report.claimBoundary.claimBlockers.join(" ")).toContain("Market superiority remains blocked");
    } finally {
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_QUALITY_JUDGE_COMMAND = previousJudge;
      if (previousAutoNative === undefined) delete process.env.MEMORY_ARENA_AUTO_NATIVE;
      else process.env.MEMORY_ARENA_AUTO_NATIVE = previousAutoNative;
    }
  }, 30_000);

  it("does not score external Arena runner self-checks without an LLM harness judge", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-self-checks-"));
    const runnerPath = join(dir, "runner.mjs");
    writeFileSync(
      runnerPath,
      `process.stdin.resume(); process.stdin.on("end", () => { console.log(JSON.stringify({ proofLevel: "same-run-native", adapterMode: "native-command", runnerContract: { rawEvidenceOnly: true, selfScoredChecksAllowed: false, scoreableChecksRequireJudge: true, judgeEnv: "MEMORY_ARENA_JUDGE_COMMAND", judgeProtocol: "cognibrain-arena-llm-harness-judge-v1" }, checks: { correctionCarryover: true, repeatedMistakeAvoided: true, procedureRecall: true, patchCorrectness: true, evidenceCompleteness: true, wrongMemorySuppression: true }, capabilityGaps: [], latencyMs: 1, evidence: { retrievedText: "runner claims everything passed" } })); });`
    );
    const previousCommand = process.env.MEMORY_ARENA_MEM0_COMMAND;
    const previousProof = process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
    const previousJudge = process.env.MEMORY_ARENA_JUDGE_COMMAND;
    try {
      process.env.MEMORY_ARENA_MEM0_COMMAND = `${process.execPath} ${runnerPath}`;
      process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = "same-run-native";
      delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      const report = await runBenchmarkArena({ systems: ["mem0"], count: 1 });
      const mem0 = report.systems[0];
      expect(mem0.score).toBe(0);
      expect(mem0.capabilityGaps.join(" ")).toContain("self-scored checks");
      expect(mem0.scenarios[0].evidence.runnerSelfChecksIgnored).toBe(true);
      expect(mem0.scenarios[0].evidence.structuredChecks).toBe(false);
      expect(mem0.scenarios[0].evidence.runnerContract).toMatchObject({
        rawEvidenceOnly: true,
        selfScoredChecksAllowed: false,
        scoreableChecksRequireJudge: true,
        judgeEnv: "MEMORY_ARENA_JUDGE_COMMAND"
      });
      expect(mem0.runnerContract).toMatchObject({
        rawEvidenceOnly: true,
        selfScoredChecksAllowed: false,
        scoreableChecksRequireJudge: true,
        observedScenarioContracts: 1,
        scenarioCount: 1
      });
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_ARENA_MEM0_COMMAND;
      else process.env.MEMORY_ARENA_MEM0_COMMAND = previousCommand;
      if (previousProof === undefined) delete process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
      else process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = previousProof;
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_JUDGE_COMMAND = previousJudge;
    }
  });

  it("fails closed when an external Arena runner times out", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-runner-timeout-"));
    const runnerPath = join(dir, "runner-timeout.mjs");
    writeFileSync(
      runnerPath,
      `process.stdin.resume(); process.stdin.on("end", () => setTimeout(() => console.log(JSON.stringify({ proofLevel: "same-run-native", adapterMode: "native-command", evidence: { late: true } })), 2000));`
    );
    const previousCommand = process.env.MEMORY_ARENA_MEM0_COMMAND;
    const previousProof = process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
    const previousJudge = process.env.MEMORY_ARENA_JUDGE_COMMAND;
    const previousTimeout = process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS;
    try {
      process.env.MEMORY_ARENA_MEM0_COMMAND = `${process.execPath} ${runnerPath}`;
      process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = "same-run-native";
      process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS = "100";
      delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      const report = await runBenchmarkArena({ systems: ["mem0"], count: 2 });
      const mem0 = report.systems[0];
      expect(mem0.score).toBe(0);
      expect(mem0.scenarios[0].evidence.runnerFailed).toBe(true);
      expect(mem0.scenarios[0].evidence.runnerDisabled).toBe(true);
      expect(mem0.scenarios[0].evidence.timeoutMs).toBe(100);
      expect(mem0.scenarios[1].evidence.runnerDisabled).toBe(true);
      expect(mem0.scenarios[1].evidence.disabledAfterScenario).toBe(mem0.scenarios[0].id);
      expect(mem0.capabilityGaps.join(" ")).toContain("runner failed");
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_ARENA_MEM0_COMMAND;
      else process.env.MEMORY_ARENA_MEM0_COMMAND = previousCommand;
      if (previousProof === undefined) delete process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
      else process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = previousProof;
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_JUDGE_COMMAND = previousJudge;
      if (previousTimeout === undefined) delete process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS;
      else process.env.MEMORY_ARENA_RUNNER_TIMEOUT_MS = previousTimeout;
    }
  }, 30_000);

  it("disables an external Arena runner after blocked-command evidence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-runner-blocked-json-"));
    const runnerPath = join(dir, "runner-blocked.mjs");
    writeFileSync(
      runnerPath,
      `process.stdin.resume(); process.stdin.on("end", () => { console.log(JSON.stringify({ proofLevel: "credential-blocked", adapterMode: "blocked-command", capabilityGaps: ["fixture native runner failed before producing JSON"], latencyMs: 7, evidence: { runner: "fixture", error: "fixture timeout" } })); });`
    );
    const previousCommand = process.env.MEMORY_ARENA_MEM0_COMMAND;
    const previousProof = process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
    const previousJudge = process.env.MEMORY_ARENA_JUDGE_COMMAND;
    try {
      process.env.MEMORY_ARENA_MEM0_COMMAND = `${process.execPath} ${runnerPath}`;
      process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = "same-run-native";
      delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      const report = await runBenchmarkArena({ systems: ["mem0"], count: 2 });
      const mem0 = report.systems[0];
      expect(mem0.proofLevel).toBe("credential-blocked");
      expect(mem0.adapterMode).toBe("blocked-command");
      expect(mem0.scenarios[0].evidence.runnerDisabled).toBe(true);
      expect(mem0.scenarios[0].evidence.evidence).toEqual(expect.objectContaining({ runner: "fixture", error: "fixture timeout" }));
      expect(mem0.scenarios[1].evidence.runnerDisabled).toBe(true);
      expect(mem0.scenarios[1].evidence.disabledAfterScenario).toBe(mem0.scenarios[0].id);
      expect(mem0.capabilityGaps.join(" ")).toContain("disabling runner");
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_ARENA_MEM0_COMMAND;
      else process.env.MEMORY_ARENA_MEM0_COMMAND = previousCommand;
      if (previousProof === undefined) delete process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
      else process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = previousProof;
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_JUDGE_COMMAND = previousJudge;
    }
  }, 30_000);

  it("scores external Arena runner evidence only after strict LLM harness judge validation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-judged-"));
    const runnerPath = join(dir, "runner.mjs");
    const judgePath = join(dir, "judge.mjs");
    writeFileSync(
      runnerPath,
      `process.stdin.resume(); process.stdin.on("end", () => { console.log(JSON.stringify({ proofLevel: "same-run-native", adapterMode: "native-command", checks: { correctionCarryover: false, repeatedMistakeAvoided: false, procedureRecall: false, patchCorrectness: false, evidenceCompleteness: false, wrongMemorySuppression: false }, capabilityGaps: [], latencyMs: 1, evidence: { retrievedText: "raw product evidence for neutral judge" } })); });`
    );
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { JSON.parse(input); console.log(JSON.stringify({ checks: { correctionCarryover: true, repeatedMistakeAvoided: false, procedureRecall: true, patchCorrectness: false, evidenceCompleteness: true, wrongMemorySuppression: false }, confidence: 0.91, reason: "fixture LLM harness judge" })); });`
    );
    const previousCommand = process.env.MEMORY_ARENA_MEM0_COMMAND;
    const previousProof = process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
    const previousJudge = process.env.MEMORY_ARENA_JUDGE_COMMAND;
    try {
      process.env.MEMORY_ARENA_MEM0_COMMAND = `${process.execPath} ${runnerPath}`;
      process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = "same-run-native";
      process.env.MEMORY_ARENA_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      const report = await runBenchmarkArena({ systems: ["mem0"], count: 1 });
      const mem0 = report.systems[0];
      expect(mem0.score).toBe(0.5);
      expect(mem0.scenarios[0].evidence.structuredChecks).toBe(true);
      expect(mem0.scenarios[0].evidence.judge).toEqual(expect.objectContaining({ kind: "llm-harness-command", confidence: 0.91 }));
    } finally {
      if (previousCommand === undefined) delete process.env.MEMORY_ARENA_MEM0_COMMAND;
      else process.env.MEMORY_ARENA_MEM0_COMMAND = previousCommand;
      if (previousProof === undefined) delete process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL;
      else process.env.MEMORY_ARENA_MEM0_PROOF_LEVEL = previousProof;
      if (previousJudge === undefined) delete process.env.MEMORY_ARENA_JUDGE_COMMAND;
      else process.env.MEMORY_ARENA_JUDGE_COMMAND = previousJudge;
    }
  });

  it("keeps Basic Memory external public benchmark heuristics diagnostic unless a harness judge is configured", () => {
    const source = readFileSync("scripts/benchmark/competitors/basic_memory_external_runner.py", "utf8");
    expect(source).toContain("MEMORY_EXTERNAL_PUBLIC_JUDGE_COMMAND");
    expect(source).toContain('"qualityClaimAllowed"');
    expect(source).toContain('"heuristicDiagnostics"');
    expect(source).toContain('"accuracy": None');
    expect(source).toContain("Diagnostic only. These values are produced by evidence-id, token, or substring heuristics");
  });

  it("renders public benchmark SVG rows with proof and claim boundaries", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-benchmark-svg-"));
    const outputPath = join(dir, "benchmark-results.svg");
    const result = spawnSync(process.execPath, ["scripts/release/render-benchmark-svg.mjs", outputPath], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    expect(result.status).toBe(0);
    const svg = readFileSync(outputPath, "utf8");
    expect(svg).toContain("Diagnostic rows are not quality or market proof unless LLM/harness claim status says so");
    expect(svg).toContain("Public Benchmark Datasets");
    expect(svg).toContain("claim blocked");
    expect(svg).toContain("diagnostic pass");
    expect(svg).toContain("api-shape diagnostic");
    expect(svg).toContain("not market proof");
    expect(svg).toContain("ablation diagnostic");
    const ablationSection = svg.slice(svg.indexOf("CogniCodeBench Ablation"));
    expect(ablationSection).not.toContain("bar-cognibrain");
    const cleanDir = mkdtempSync(join(tmpdir(), "cognibrain-benchmark-svg-clean-"));
    const cleanOutputPath = join(cleanDir, "benchmark-results.svg");
    const cleanResult = spawnSync(process.execPath, [join(process.cwd(), "scripts/release/render-benchmark-svg.mjs"), cleanOutputPath], {
      cwd: cleanDir,
      encoding: "utf8"
    });
    expect(cleanResult.status).toBe(0);
    const cleanSvg = readFileSync(cleanOutputPath, "utf8");
    expect(cleanSvg).toContain("claim blocked");
    expect(cleanSvg).toContain("diagnostic pass");
    expect(cleanSvg).toContain("api-shape diagnostic");
    expect(cleanSvg).toContain("ablation diagnostic");
  });

  it("publishes a marketing scorecard with bars and per-scenario details", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-publish-"));
    const inputPath = join(dir, "arena.json");
    const marketGatePath = join(dir, "market-gate.json");
    const outputDir = join(dir, "public");
    const markdownPath = join(dir, "latest-arena.md");
    const checks = {
      correctionCarryover: true,
      repeatedMistakeAvoided: true,
      procedureRecall: true,
      patchCorrectness: true,
      evidenceCompleteness: true,
      wrongMemorySuppression: true
    };
    writeFileSync(
      inputPath,
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-05-26T00:00:00.000Z",
        benchmark: "BenchmarkArena",
        benchmarkInput: "cognicode",
        adapterContract: {
          proofLevels: {
            "same-run-full": "Full local product run.",
            "same-run-native": "Real native package run."
          }
        },
        systems: [
          {
            system: "cognibrain",
            displayName: "Cognibrain",
            score: 1,
            proofLevel: "same-run-full",
            scenarioCount: 1,
            metrics: {
              repeatedMistakeRate: 0,
              correctionCarryover: 1,
              procedureRecall: 1,
              patchCorrectness: 1,
              evidenceCompleteness: 1,
              wrongMemorySuppression: 1
            },
            capabilityGaps: [],
            scenarios: [{ id: "scenario-1", score: 1, checks, evidence: {} }]
          },
          {
            system: "mem0",
            displayName: "Mem0",
            score: 0.5,
            proofLevel: "same-run-native",
            scenarioCount: 1,
            metrics: {
              repeatedMistakeRate: 1,
              correctionCarryover: 1,
              procedureRecall: 1,
              patchCorrectness: 0,
              evidenceCompleteness: 0,
              wrongMemorySuppression: 0
            },
            capabilityGaps: ["no typed action guard"],
            scenarios: [{ id: "scenario-1", score: 0.5, checks: { ...checks, patchCorrectness: false, evidenceCompleteness: false, wrongMemorySuppression: false }, evidence: {} }]
          }
        ],
        leaderboard: [
          { system: "Cognibrain", score: 1, proofLevel: "same-run-full", repeatedMistakeRate: 0, gaps: 0 },
          { system: "Mem0", score: 0.5, proofLevel: "same-run-native", repeatedMistakeRate: 1, gaps: 1 }
        ],
        winner: "Cognibrain",
        passed: true
      })
    );
    writeFileSync(
      marketGatePath,
      JSON.stringify({
        generatedAt: "2026-05-26T00:00:00.000Z",
        proofLevel: "certified-public-benchmark-baseline-superiority",
        passed: true,
        diagnosticPassed: true,
        claimAllowed: true,
        claimBlockers: [],
        benchmarks: [
          {
            dataset: "LoCoMo",
            metric: "Evidence recall@K",
            passed: true,
            diagnosticPassed: true,
            scoreable: true,
            proof: "public-benchmark",
            ours: { correct: 9, total: 10, accuracy: 0.9 },
            bestBaseline: { name: "keyword-only", correct: 7, total: 10, accuracy: 0.7 },
            margin: 0.2,
            questions: [{ id: "q1" }]
          }
        ]
      })
    );

    publishArenaReport({ inputPath, outputDir, markdownPath, marketGatePath });
    const markdown = readFileSync(markdownPath, "utf8");
    const html = readFileSync(join(outputDir, "index.html"), "utf8");
    expect(markdown).toContain("## Synthetic Diagnostic Scorecard");
    expect(markdown).toContain("Claim allowed: yes");
    expect(markdown).toContain("native run; LLM/harness judge required");
    expect(markdown).toContain("[#########.........]");
    expect(markdown).toContain("## Scenario Score Matrix");
    expect(markdown).toContain("## Public Benchmark Gate");
    expect(markdown).toContain("Claim allowed: yes");
    expect(markdown).toContain("| LoCoMo | Evidence recall@K | public-benchmark | Yes | Yes |");
    expect(html).toContain("Hard Benchmark Diagnostic");
    expect(html).toContain("Top diagnostic score");
    expect(html).toContain("Market claim");
    expect(html).toContain("Claim allowed: <strong>yes</strong>");
    expect(html).toContain("class=\"bar\"");
    expect(existsSync(join(outputDir, "scorecard.html"))).toBe(true);
  });

  it("publishes diagnostic public benchmark gates with claim blockers instead of quality claims", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-arena-publish-diagnostic-"));
    const inputPath = join(dir, "arena.json");
    const marketGatePath = join(dir, "market-gate.json");
    const outputDir = join(dir, "public");
    const markdownPath = join(dir, "latest-arena.md");
    const checks = {
      correctionCarryover: true,
      repeatedMistakeAvoided: true,
      procedureRecall: true,
      patchCorrectness: true,
      evidenceCompleteness: true,
      wrongMemorySuppression: true
    };
    writeFileSync(
      inputPath,
      JSON.stringify({
        schemaVersion: "1.0",
        generatedAt: "2026-05-26T00:00:00.000Z",
        benchmark: "BenchmarkArena",
        benchmarkInput: "cognicode",
        adapterContract: { proofLevels: { "same-run-full": "Full local product run." } },
        systems: [
          {
            system: "cognibrain",
            displayName: "Cognibrain",
            score: 1,
            proofLevel: "same-run-full",
            scenarioCount: 1,
            metrics: {
              repeatedMistakeRate: 0,
              correctionCarryover: 1,
              procedureRecall: 1,
              patchCorrectness: 1,
              evidenceCompleteness: 1,
              wrongMemorySuppression: 1
            },
            capabilityGaps: [],
            scenarios: [{ id: "scenario-1", score: 1, checks, evidence: {} }]
          },
          {
            system: "baseline",
            displayName: "Baseline",
            score: 0.5,
            proofLevel: "same-run-api-shape",
            scenarioCount: 1,
            metrics: {
              repeatedMistakeRate: 1,
              correctionCarryover: 0,
              procedureRecall: 0,
              patchCorrectness: 0,
              evidenceCompleteness: 0,
              wrongMemorySuppression: 0
            },
            capabilityGaps: ["profile row"],
            scenarios: [{ id: "scenario-1", score: 0.5, checks: { ...checks, correctionCarryover: false }, evidence: {} }]
          }
        ],
        leaderboard: [
          { system: "Cognibrain", score: 1, proofLevel: "same-run-full", repeatedMistakeRate: 0, gaps: 0 },
          { system: "Baseline", score: 0.5, proofLevel: "same-run-api-shape", repeatedMistakeRate: 1, gaps: 1 }
        ],
        winner: "Cognibrain",
        passed: true
      })
    );
    writeFileSync(
      marketGatePath,
      JSON.stringify({
        generatedAt: "2026-05-26T00:00:00.000Z",
        proofLevel: "diagnostic-public-benchmark-baseline",
        passed: false,
        diagnosticPassed: true,
        claimAllowed: false,
        claimBlockers: ["LoCoMo is local-diagnostic; require LLM/harness proof before claim"],
        benchmarks: [
          {
            dataset: "LoCoMo",
            metric: "Evidence recall@K",
            passed: false,
            diagnosticPassed: true,
            scoreable: false,
            proof: "local-diagnostic",
            ours: { correct: 9, total: 10, accuracy: 0.9 },
            bestBaseline: { name: "keyword-only", correct: 7, total: 10, accuracy: 0.7 },
            margin: 0.2,
            questions: [{ id: "q1" }]
          }
        ]
      })
    );

    publishArenaReport({ inputPath, outputDir, markdownPath, marketGatePath });
    const markdown = readFileSync(markdownPath, "utf8");
    const html = readFileSync(join(outputDir, "index.html"), "utf8");
    const json = JSON.parse(readFileSync(join(outputDir, "results.json"), "utf8"));
    expect(markdown).toContain("## Synthetic Diagnostic Scorecard");
    expect(markdown).toContain("Claim allowed: no");
    expect(markdown).toContain("api-shape diagnostic; claim blocked");
    expect(markdown).toContain("| LoCoMo | Evidence recall@K | local-diagnostic | No | Yes |");
    expect(markdown).toContain("LoCoMo is local-diagnostic");
    expect(html).not.toContain("Best score");
    expect(html).toContain("Top diagnostic score");
    expect(html).toContain("Market claim</span><strong>Blocked");
    expect(html).toContain("Claim allowed: <strong>no</strong>");
    expect(html).toContain("Public benchmark claim blockers");
    expect(json.publicBenchmarkGate.claimAllowed).toBe(false);
    expect(json.publication.claimAllowed).toBe(false);
    expect(json.publication.claimScope).toContain("market and quality claims require publicBenchmarkGate.claimAllowed=true");
    expect(json.publicBenchmarkGate.benchmarks[0]).toMatchObject({ proof: "local-diagnostic", passed: false, diagnosticPassed: true, scoreable: false });
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

    const saturated = runMarketGate({ locomoPath, longMemEvalPath, outputPath, beamPath: "", beam500kPath: "" });
    expect(saturated.passed).toBe(false);
    expect(saturated.diagnosticPassed).toBe(true);
    expect(saturated.proofLevel).toBe("diagnostic-public-benchmark-baseline");
    expect(saturated.claimBlockers.some((item) => item.includes("LongMemEval-S is local-diagnostic"))).toBe(true);
    expect(saturated.benchmarks.find((item) => item.dataset === "LongMemEval-S")?.saturated).toBe(true);

    writeFileSync(
      longMemEvalPath,
      JSON.stringify({
        ours: { name: "open-memory-harness", accuracy: 0.8, correct: 8, total: 10 },
        baselines: [{ name: "keyword-only", accuracy: 0.8, correct: 8, total: 10 }],
        source: { name: "LongMemEval-S", metric: "Answer-session recall@K against answer_session_ids" }
      })
    );
    const lowerTie = runMarketGate({ locomoPath, longMemEvalPath, outputPath, beamPath: "", beam500kPath: "" });
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
      expect(artifact.proof).toBe("llm-harness");
      expect(artifact.qualityClaimAllowed).toBe(true);
      expect(artifact.datasets[0].proof).toBe("llm-harness");
      expect(artifact.datasets[0].qualityClaimAllowed).toBe(true);
      expect(artifact.datasets[0].claimBoundary.claimBlockers).toEqual([]);
      expect(artifact.datasets[0].questions[0].judge.kind).toBe("llm-harness");
      expect(artifact.datasets[0].questions[0].judge.qualityClaimAllowed).toBe(true);
      expect(artifact.datasets[0].questions[0].judge.reason).toBe("external judge matched redis");
      expect(artifact.summary.meanScore).toBe(1);
    } finally {
      process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND = previousAnswerer;
      process.env.MEMORY_BENCHMARK_ANSWERER_ARGS = previousAnswererArgs;
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = previousJudge;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = previousJudgeArgs;
    }
  });

  it("fails closed on malformed external answer-generation judge contracts", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-answer-provider-malformed-"));
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
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); if (payload.task === "answer") console.log(JSON.stringify({ answer: "Redis backs the cache." })); else console.log(JSON.stringify({ score: 1, passed: "true", reason: "malformed boolean" })); });`
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
      expect(artifact.proof).toBe("local-diagnostic");
      expect(artifact.qualityClaimAllowed).toBe(false);
      expect(artifact.claimBoundary.claimBlockers[0]).toContain("external LLM/harness judge");
      expect(artifact.datasets[0].qualityClaimAllowed).toBe(false);
      expect(artifact.datasets[0].questions[0].judge.kind).toBe("blocked");
      expect(artifact.datasets[0].questions[0].judge.qualityClaimAllowed).toBe(false);
      expect(artifact.datasets[0].questions[0].judge).toMatchObject({ score: 0, passed: false });
      expect(artifact.datasets[0].questions[0].judge.reason).toContain("passed must be a boolean");
      expect(artifact.summary.meanScore).toBe(0);
    } finally {
      process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND = previousAnswerer;
      process.env.MEMORY_BENCHMARK_ANSWERER_ARGS = previousAnswererArgs;
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = previousJudge;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = previousJudgeArgs;
    }
  });

  it("does not fall back to deterministic answer-generation scoring when a configured judge command fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-answer-provider-unparseable-"));
    const reportPath = join(dir, "nextgen.json");
    const providerPath = join(dir, "provider.mjs");
    const outputPath = join(dir, "answers.json");
    writeFileSync(
      reportPath,
      JSON.stringify({
        suites: [
          {
            id: "external-proof",
            details: [{ id: "q1", question: "What cache is used?", expected: ["redis"], actual: "Redis backs the cache." }]
          }
        ]
      })
    );
    writeFileSync(providerPath, `process.stdin.resume(); process.stdin.on("end", () => { console.log("not-json"); });`);
    const previousJudge = process.env.MEMORY_BENCHMARK_JUDGE_COMMAND;
    const previousJudgeArgs = process.env.MEMORY_BENCHMARK_JUDGE_ARGS;
    try {
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = process.execPath;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = providerPath;
      const artifact = runAnswerGenerationBenchmark({ reports: [reportPath], outputPath });
      expect(artifact.qualityClaimAllowed).toBe(false);
      expect(artifact.datasets[0].questions[0].judge).toMatchObject({
        kind: "blocked",
        score: 0,
        passed: false,
        qualityClaimAllowed: false
      });
      expect(artifact.datasets[0].questions[0].judge.reason).toContain("no valid JSON object");
      expect(artifact.summary.meanScore).toBe(0);
    } finally {
      process.env.MEMORY_BENCHMARK_JUDGE_COMMAND = previousJudge;
      process.env.MEMORY_BENCHMARK_JUDGE_ARGS = previousJudgeArgs;
    }
  });

  it("runs CogniCodeBench with correction carryover, action guards, and ablations", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-cognicode-"));
    const report = runCogniCodeBench({
      count: 12,
      outputPath: join(dir, "run.json"),
      scenariosPath: join(dir, "scenarios.json")
    });
    expect(report.scenarioCount).toBe(12);
    expect(report.passed).toBe(report.diagnosticPassed);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.marketClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("cognicodebench-local-scenario-diagnostic");
    expect(report.claimBoundary.claimBlockers[0]).toContain("deterministic diagnostics only");
    expect(report.judge).toMatchObject({ kind: "missing", status: "missing" });
    expect(report.scenarios.every((scenario) => scenario.passed)).toBe(true);
    expect(report.metrics.correctionCarryoverRate).toBe(1);
    expect(report.metrics.repeatedMistakeRate).toBe(0);
    expect(report.scenarioFactory.availableRepoTemplates).toBeGreaterThanOrEqual(100);
    expect(report.scenarioFactory.availableCorrectionTypes).toBeGreaterThanOrEqual(20);
    expect(report.metrics.sourceRefCorrectness).toBe(1);
    expect(report.metrics.granularPatchCorrectness).toBe(1);
    expect(report.diagnostics.integrity.overfitRisk).toBe("low");
    expect(report.diagnostics.integrity.metrics).toMatchObject({
      expectedDirectPatchHarness: false,
      externalPatchHarnessRate: 0,
      bestBaseline: expect.any(Number),
      fullScore: expect.any(Number)
    });
    expect(report.harnessContracts.qualityJudge).toMatchObject({
      configured: false,
      requiredForQualityClaim: true,
      reportLevel: true,
      semanticJudgeRequired: true,
      strictJson: true,
      failClosed: true,
      forbidsStringRegexScoring: true
    });
    expect(report.harnessContracts.patchProposal).toMatchObject({
      configured: false,
      hiddenExpectedFieldsProvided: false,
      visibleRepoMetadataOnly: true,
      strictJson: true,
      failClosed: true
    });
    expect(report.harnessContracts.ablation).toMatchObject({
      patchSimulationUsesHiddenExpected: false,
      hiddenExpectedEvaluatorOnly: true
    });
    expect(report.diagnostics.weaknesses).toEqual([]);
    expect(new Set(report.scenarios.map((scenario) => scenario.evidence.patchProposal.mode))).toEqual(new Set(["context-derived"]));
    expect(report.methodology.requiredExternalProofForQualityClaim).toContain("ablation baselines may simulate from visible repo metadata only; hidden expected commands and files stay evaluator-only");
    expect(report.baselines.every((baseline) => baseline.notes.some((note) => note.includes("hidden expected commands/files are evaluator-only")))).toBe(true);
    expect(report.ablation.cognibrain_full.score).toBeGreaterThan(report.ablation.no_memory.score);
    expect(report.ablation.cognibrain_full.score).toBeGreaterThan(report.ablation.procedure_only.score);
    expect(report.ablation.cognibrain_full.score).toBeGreaterThan(report.ablation.temporal_only.score);
    expect(report.ablation.cognibrain_full.score).toBeGreaterThan(report.ablation.semantic_only.score);
    expect(report.baselines.map((baseline) => baseline.name)).toContain("cognibrain_without_corrections");
    expect(report.examples).toHaveLength(5);
  }, nativeRunnerBenchmarkTimeout);

  it("can route CogniCodeBench patch proposals through an external harness without hidden expected fields", () => {
    const previousPatchCommand = process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND;
    try {
      const dir = mkdtempSync(join(tmpdir(), "open-memory-cognicode-patch-"));
      const patchPath = join(dir, "patch.mjs");
      writeFileSync(
        patchPath,
        `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); if (payload.contract !== "cognibrain-cognicodebench-patch-proposal-harness-v1") throw new Error("bad contract"); if ("expected" in payload) throw new Error("hidden expected fields leaked"); const files = payload.repoSeed.files; const byPurpose = (needle) => files.find((file) => file.purpose.includes(needle) && !file.generated)?.path; const serviceTypes = new Set(["library_correction","temporal_migration_correction","review_feedback_correction","security_pattern_correction","performance_regression_correction","api_contract_correction","schema_migration_correction","build_tool_correction","dependency_version_correction","feature_flag_correction","observability_correction"]); const testTypes = new Set(["test_correction","release_gate_correction"]); const file = testTypes.has(payload.correctionType) ? byPurpose("regression test") : serviceTypes.has(payload.correctionType) ? byPurpose("service") : byPurpose("owner implementation"); console.log(JSON.stringify({ command: payload.repoSeed.testCommand, filesChanged: [file], reason: "fixture external patch harness used visible repo metadata and coding context only" })); });`
      );
      process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND = `${process.execPath} ${JSON.stringify(patchPath)}`;
      const report = runCogniCodeBench({
        count: 100,
        outputPath: join(dir, "run.json"),
        scenariosPath: join(dir, "scenarios.json")
      });
      expect(report.diagnosticPassed).toBe(true);
      expect(report.scenarios.every((scenario) => scenario.evidence.patchProposal.mode === "external-harness")).toBe(true);
      expect(report.scenarios.every((scenario) => scenario.passed)).toBe(true);
    } finally {
      if (previousPatchCommand === undefined) delete process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND;
      else process.env.MEMORY_COGNICODEBENCH_PATCH_COMMAND = previousPatchCommand;
    }
  }, 90_000);

  it("allows CogniCodeBench quality claims only through a report-level LLM/harness judge", () => {
    const previousJudge = process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND;
    try {
      const dir = mkdtempSync(join(tmpdir(), "open-memory-cognicode-judge-"));
      const judgePath = join(dir, "judge.mjs");
      writeFileSync(
        judgePath,
        `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); if (payload.contract !== "cognibrain-cognicodebench-quality-llm-harness-judge-v1") throw new Error("bad contract"); console.log(JSON.stringify({ passed: true, score: 0.91, reason: "fixture judged semantic engineering-memory evidence", evidence: { scenarios: payload.scenarioCount } })); });`
      );
      process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND = `${process.execPath} ${JSON.stringify(judgePath)}`;
      const report = runCogniCodeBench({
        count: 100,
        outputPath: join(dir, "run.json"),
        scenariosPath: join(dir, "scenarios.json")
      });
      expect(report.diagnosticPassed).toBe(true);
      expect(report.qualityClaimAllowed).toBe(true);
      expect(report.proof).toBe("llm-harness");
      expect(report.claimBoundary.scorer).toBe("cognicodebench-llm-harness-judge");
      expect(report.harnessContracts.qualityJudge.configured).toBe(true);
      expect(report.judge).toMatchObject({ kind: "llm-harness-command", status: "passed", score: 0.91 });
      expect(report.marketClaimAllowed).toBe(false);
      expect(report.claimBoundary.claimBlockers.some((item) => item.includes("Market superiority requires"))).toBe(true);
    } finally {
      if (previousJudge === undefined) delete process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND;
      else process.env.MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND = previousJudge;
    }
  }, 90_000);

  it("generates CogniCodeBench scenarios as a passing generation artifact", () => {
    const dir = mkdtempSync(join(tmpdir(), "open-memory-cognicode-generate-"));
    const report = runCogniCodeBench({
      count: 10,
      generateOnly: true,
      outputPath: join(dir, "generate.json"),
      scenariosPath: join(dir, "scenarios.json")
    });
    expect(report.mode).toBe("scenario_generation");
    expect(report.passed).toBe(true);
    expect(report.diagnosticPassed).toBe(true);
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.claimBoundary.proof).toBe("local-diagnostic");
    expect(report.judge.reason).toContain("Scenario-generation mode");
    expect(report.scenarioCount).toBe(10);
    expect(report.generation.scenariosWritten).toBe(true);
    expect(report.scenarios).toHaveLength(0);
    expect(report.difficultyDistribution.easy + report.difficultyDistribution.medium + report.difficultyDistribution.hard + report.difficultyDistribution.evil).toBe(10);
  });
});
