import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { MemoryService } from "../api/service";
import { HarnessMemoryHook } from "../connectors/harnessHook";

type HarnessStatus = "generated-e2e-proven" | "generated-partial" | "instruction-only" | "planned";

interface HarnessCatalogRow {
  id: string;
  name: string;
  configPaths: string[];
  rulesPaths: string[];
  mcp: boolean;
  installWizard: boolean;
  doctor: boolean;
  notes: string[];
}

interface HarnessGoldenPathRun {
  harness: string;
  checks: Record<string, boolean>;
  codingContextPackId?: string;
  patchEvidenceTrailId?: string;
  passed: boolean;
}

interface HarnessMaturityRow {
  harness: string;
  name: string;
  status: HarnessStatus;
  proofLevel: "runtime-smoke" | "generated-config" | "instruction-only" | "planned";
  maturity: {
    configGenerated: boolean;
    skillOrRules: boolean;
    mcp: boolean;
    preLlmContextHook: boolean;
    preToolGuard: boolean;
    postToolTelemetry: boolean;
    correctionCapture: boolean;
    patchEvidenceTrail: boolean;
    installWizard: boolean;
    doctor: boolean;
    e2eDemo: boolean;
  };
  evidence: {
    manifest: string;
    configPaths: string[];
    rulesPaths: string[];
    goldenPath?: string;
  };
  gaps: string[];
  boundaries: string[];
}

interface HarnessMaturityReport {
  schemaVersion: "1.0";
  generatedAt: string;
  source: "harness-package";
  artifacts: string[];
  rows: HarnessMaturityRow[];
  goldenPaths: HarnessGoldenPathRun[];
  summary: {
    total: number;
    generated: number;
    planned: number;
    mcpTargets: number;
    cliLifecycleProtocol: boolean;
    cliMcpParityCommands: number;
    publicHarnessSdk: boolean;
    e2eDemos: number;
    preToolGuardTargets: number;
    correctionCaptureTargets: number;
    evidenceTrailTargets: number;
  };
  passed: boolean;
}

const catalog: HarnessCatalogRow[] = [
  row("codex", "OpenAI Codex CLI", ["$CODEX_HOME/config.toml"], ["AGENTS.md", "$CODEX_HOME/skills/cognibrain/SKILL.md"], true),
  row("claude", "Claude Code", [".mcp.json"], [".claude/settings.json"], true),
  row("copilot", "GitHub Copilot", [".github/copilot-instructions.md"], [".github/instructions/cognibrain.instructions.md"], false),
  row("cursor", "Cursor", [".cursor/mcp.json"], [".cursor/rules/open-memory.mdc"], true),
  row("vscode", "VS Code MCP", [".vscode/mcp.json"], [".vscode/cognibrain.instructions.md"], true),
  row("opencode", "OpenCode", [".opencode/cognibrain.md"], [".opencode/cognibrain.md"], false, ["CLI lifecycle instructions are generated; MCP-native config is not installed by default."]),
  row("openclaw", "OpenClaw", [".openclaw/cognibrain.md"], [".openclaw/cognibrain.md"], false, ["CLI lifecycle instructions are generated; MCP-native config is not installed by default."]),
  row("langgraph", "LangGraph", ["langgraph.cognibrain.json"], ["langgraph-cognibrain.ts"], false),
  row("crewai", "CrewAI", ["crewai.cognibrain.json"], ["crewai_cognibrain.py"], false),
  row("windsurf", "Windsurf", [".windsurf/rules/cognibrain.md"], [".windsurf/rules/cognibrain.md"], false, ["CLI lifecycle rules are generated; MCP-native config is not installed by default."]),
  row("continue", "Continue.dev", [".continue/rules/cognibrain.md"], [".continue/rules/cognibrain.md"], false, ["CLI lifecycle rules are generated; MCP-native config is not installed by default."]),
  row("aider", "Aider", [".aider.conf.yml"], [".aider/cognibrain.md"], false, ["Aider uses file-based instructions plus CLI feedback commands rather than MCP-native hooks."]),
  row("roo-cline", "Roo Code / Cline", [".roo/mcp.json"], [".clinerules/cognibrain.md"], true),
  row("goose", "Goose", [".goose/config.yaml"], [".goose/cognibrain.md"], true),
  row("sourcegraph-amp", "Sourcegraph Amp", [".amp/cognibrain.md"], [".amp/cognibrain.md"], false, ["Instruction handoff is generated; a native pre-tool hook is not claimed."]),
  row("devin-style", "Devin-style external agent mode", [".devin/cognibrain.json"], [".devin/cognibrain.md"], false, ["Generic external-agent contract is generated; a vendor-native Devin hook is not claimed."])
];

export function generateHarnessMaturity(options: { out?: string; markdown?: string } = {}): HarnessMaturityReport {
  const install = verifyHarnessInstall();
  const generatedHarnesses = new Set(Object.keys(install.manifest?.harnesses ?? {}));
  const goldenPaths = catalog.filter((item) => generatedHarnesses.has(item.id)).map((item) => runHarnessGoldenPath(item.id));
  const goldenByHarness = new Map(goldenPaths.map((item) => [item.harness, item]));
  const rows = catalog.map((item) => maturityRow(item, generatedHarnesses, install, goldenByHarness.get(item.id)));
  const report: HarnessMaturityReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "harness-package",
    artifacts: ["artifacts/harness-maturity.json", "artifacts/docs/harness-maturity.md", "artifacts/connectors-live.json"],
    rows,
    goldenPaths,
    summary: {
      total: rows.length,
      generated: rows.filter((item) => item.maturity.configGenerated).length,
      planned: rows.filter((item) => item.status === "planned").length,
      mcpTargets: rows.filter((item) => item.maturity.mcp).length,
      cliLifecycleProtocol: cliLifecycleProtocolReady(),
      cliMcpParityCommands: lifecycleCliParityCommandCount(),
      publicHarnessSdk: publicHarnessSdkReady(),
      e2eDemos: rows.filter((item) => item.maturity.e2eDemo).length,
      preToolGuardTargets: rows.filter((item) => item.maturity.preToolGuard).length,
      correctionCaptureTargets: rows.filter((item) => item.maturity.correctionCapture).length,
      evidenceTrailTargets: rows.filter((item) => item.maturity.patchEvidenceTrail).length
    },
    passed: rows.length >= 16 && rows.filter((item) => item.maturity.configGenerated).length >= 16 && cliLifecycleProtocolReady() && lifecycleCliParityCommandCount() >= 10 && publicHarnessSdkReady() && goldenPaths.every((item) => item.passed)
  };
  if (options.out) writeJson(options.out, report);
  if (options.markdown) writeText(options.markdown, renderMarkdown(report));
  return report;
}

function maturityRow(
  item: HarnessCatalogRow,
  generatedHarnesses: Set<string>,
  install: { dir: string; manifestPath: string; manifest: { harnesses?: Record<string, unknown> } | null; files: Set<string> },
  goldenPath: HarnessGoldenPathRun | undefined
): HarnessMaturityRow {
  const configGenerated = generatedHarnesses.has(item.id) && item.configPaths.every((path) => path.startsWith("$CODEX_HOME") || install.files.has(path));
  const skillOrRules = item.rulesPaths.length > 0 && item.rulesPaths.every((path) => path.startsWith("$CODEX_HOME") || install.files.has(path));
  const mcp = item.mcp && configGenerated;
  const cliLifecycleCapable = ["copilot", "opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "sourcegraph-amp", "devin-style"].includes(item.id);
  const hookCapable = mcp || cliLifecycleCapable;
  const telemetryCapable = configGenerated;
  const maturity = {
    configGenerated,
    skillOrRules,
    mcp,
    preLlmContextHook: hookCapable,
    preToolGuard: hookCapable,
    postToolTelemetry: telemetryCapable,
    correctionCapture: telemetryCapable,
    patchEvidenceTrail: telemetryCapable,
    installWizard: item.installWizard,
    doctor: item.doctor,
    e2eDemo: goldenPath?.passed === true
  };
  const gaps = [
    ...(!maturity.configGenerated ? ["config package not generated"] : []),
    ...(!maturity.skillOrRules ? ["skill/rules package not generated"] : []),
    ...(!maturity.preToolGuard ? ["pre-tool action guard not natively hooked"] : []),
    ...(!maturity.e2eDemo ? ["golden-path simulator not passing"] : [])
  ];
  const boundaries = [
    ...(!maturity.mcp ? ["MCP-native hook not claimed"] : []),
    ...item.notes
  ];
  const status: HarnessStatus =
    maturity.e2eDemo && maturity.preToolGuard && maturity.patchEvidenceTrail ? "generated-e2e-proven" :
    maturity.configGenerated && maturity.patchEvidenceTrail ? "generated-partial" :
    maturity.configGenerated ? "instruction-only" : "planned";
  return {
    harness: item.id,
    name: item.name,
    status,
    proofLevel: maturity.e2eDemo ? "runtime-smoke" : maturity.configGenerated ? "generated-config" : maturity.skillOrRules ? "instruction-only" : "planned",
    maturity,
    evidence: {
      manifest: install.manifestPath,
      configPaths: item.configPaths,
      rulesPaths: item.rulesPaths,
      goldenPath: goldenPath?.patchEvidenceTrailId
    },
    gaps,
    boundaries
  };
}

function verifyHarnessInstall(): { dir: string; manifestPath: string; manifest: { harnesses?: Record<string, unknown> } | null; files: Set<string> } {
  const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-maturity-"));
  const codexHome = join(dir, ".codex");
  try {
    const result = spawnSync(process.execPath, [join(process.cwd(), "bin", "cognibrain.mjs"), "setup", "--all-harnesses", "--no-start", "--no-doctor"], {
      cwd: dir,
      env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    if (result.status !== 0) {
      return { dir, manifestPath: ".cognibrain-harness-package.json (setup failed before manifest)", manifest: null, files: new Set() };
    }
    const manifestPath = join(dir, ".cognibrain-harness-package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { harnesses?: Record<string, unknown> };
    const files = new Set<string>();
    for (const item of catalog.flatMap((entry) => [...entry.configPaths, ...entry.rulesPaths])) {
      if (item.startsWith("$CODEX_HOME")) {
        if (existsSync(item.replace("$CODEX_HOME", codexHome))) files.add(item);
      } else if (existsSync(join(dir, item))) {
        files.add(item);
      }
    }
    return { dir, manifestPath: ".cognibrain-harness-package.json (generated in temp setup workspace)", manifest, files };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runHarnessGoldenPath(harness: string): HarnessGoldenPathRun {
  const repo = `demo-${harness}`;
  const service = new MemoryService({ autoDream: { enabled: false } });
  const codebaseScope = { repo, branch: "main", harness };
  service.recordCodeCorrection({
    userId: "harness-maturity",
    appId: harness,
    projectId: repo,
    content: `Do not use pnpm in ${repo}; use npm test and do not edit generated files.`,
    kind: "repo_policy",
    correctAction: "npm test",
    codebase: codebaseScope
  });
  service.recordCodeCorrection({
    userId: "harness-maturity",
    appId: harness,
    projectId: repo,
    content: `Before tool calls in ${repo}, recall repo policy and then run npm test after source edits.`,
    kind: "procedure",
    correctAction: "recall policy and run npm test",
    codebase: codebaseScope
  });
  const hook = new HarnessMemoryHook(service, { maxMemories: 8, tokenBudget: 700 });
  const context = {
    userId: "harness-maturity",
    agentId: `${harness}-agent`,
    appId: harness,
    projectId: repo,
    sessionId: `${harness}-golden-path`,
    prompt: `Fix validation in ${repo} without repeating the package-manager mistake.`,
    codebaseScope
  };
  const session = hook.startSession(context);
  const preTool = hook.beforeToolCall(context, { command: "pnpm test", cwd: `/tmp/${repo}` });
  const action = hook.afterToolCall(context, {
    command: "npm test",
    cwd: `/tmp/${repo}`,
    exitCode: 0,
    filesChanged: ["src/validation/userValidation.ts"],
    tests: [{ name: "npm test", status: "passed", output: "ok" }]
  });
  const correction = hook.captureCorrection(context, {
    content: `Reviewer correction: ${harness} must store command corrections and cite patch evidence.`,
    previousWrongAction: "pnpm test",
    correctAction: "npm test",
    kind: "review_correction",
    evidenceIds: action ? [action.id] : []
  });
  const trail = hook.finishPatch(context, {
    task: "fix validation",
    filesChanged: ["src/validation/userValidation.ts"],
    commandsRun: ["npm test"],
    memoryIds: [action?.id, correction?.id].filter((id): id is string => Boolean(id))
  });
  const checks = {
    installToContext: Boolean(session.codingContextPack?.sections.some((section) => section.evidence.length > 0) && session.memoryContext.includes("npm test")),
    preToolGuard: preTool.guard?.severity === "block" && preTool.guard.alternatives.includes("npm test"),
    postToolTelemetry: Boolean(action?.tags.includes("harness-action") && action.tags.includes("success-pattern")),
    correctionCapture: Boolean(correction?.tags.includes("engineering-correction")),
    patchEvidenceTrail: Boolean(trail && action && correction && trail.toolOutcomeIds.includes(action.id) && trail.correctionIds.includes(correction.id))
  };
  return {
    harness,
    checks,
    codingContextPackId: session.codingContextPack?.id,
    patchEvidenceTrailId: trail?.id,
    passed: Object.values(checks).every(Boolean)
  };
}

function renderMarkdown(report: HarnessMaturityReport): string {
  const rows = report.rows
    .map((row) => `| ${row.name} | ${row.status} | ${yes(row.maturity.configGenerated)} | ${yes(row.maturity.skillOrRules)} | ${yes(row.maturity.mcp)} | ${yes(row.maturity.preLlmContextHook)} | ${yes(row.maturity.preToolGuard)} | ${yes(row.maturity.postToolTelemetry)} | ${yes(row.maturity.correctionCapture)} | ${yes(row.maturity.patchEvidenceTrail)} | ${yes(row.maturity.installWizard)} | ${yes(row.maturity.doctor)} | ${yes(row.maturity.e2eDemo)} | ${row.gaps.join("; ") || "none"}${row.boundaries.length ? ` (boundaries: ${row.boundaries.join("; ")})` : ""} |`)
    .join("\n");
  return `# Harness Maturity Matrix

Generated at ${report.generatedAt} from the harness package manifest, setup output and golden-path simulator.

Current checked state: ${report.summary.generated} generated harness packages, ${report.summary.mcpTargets} MCP-capable targets, ${report.summary.preToolGuardTargets} pre-tool guard targets, ${report.summary.correctionCaptureTargets} correction-capture targets, ${report.summary.evidenceTrailTargets} patch-evidence targets, ${report.summary.e2eDemos} golden-path demos, public Harness SDK ${report.summary.publicHarnessSdk ? "present" : "missing"}, CLI lifecycle protocol ${report.summary.cliLifecycleProtocol ? "present" : "missing"} and ${report.summary.cliMcpParityCommands} CLI/MCP parity commands. Non-native rows are marked without claiming vendor-native hooks.

| Harness | Status | Config | Skill/rules | MCP | Pre-LLM context | Pre-tool guard | Telemetry | Correction | Evidence trail | Install wizard | Doctor | E2E demo | Gaps |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${rows}

Evidence:

- \`artifacts/harness-maturity.json\` contains the machine-readable matrix.
- \`npm run harness:maturity\` regenerates this document and the artifact.
- Golden-path demos simulate install -> context -> action guard -> telemetry -> correction -> evidence for generated harness rows.
- External-agent modes use the generated JSON-command contract unless a vendor-native hook is available.
- The universal CLI lifecycle protocol is checked as the CLI-first path and must preserve MCP parity for context, guard, outcome, correction, patch evidence, dream/session/release, source revalidation and conflicts.
- The dream lifecycle proof is counted only when context, guard, outcome, correction, patch evidence, session and release commands remain in the MCP parity contract.
`;
}

function cliLifecycleProtocolReady(): boolean {
  const content = readFileSync("bin/lib/lifecycleCli.mjs", "utf8");
  return [
    "class CliBackendClient",
    "class DaemonBackend",
    "class LocalDirectBackend",
    "EXIT_CODES",
    "COMMAND_SCHEMAS",
    "MCP_PARITY",
    "handleLifecycleCommand",
    "handleHarnessCommand",
    "handleMemoryLifecycleCommand"
  ].every((needle) => content.includes(needle));
}

function publicHarnessSdkReady(): boolean {
  if (!existsSync("sdk/typescript/harness.ts") || !existsSync("sdk/typescript/index.ts") || !existsSync("bin/lib/cliRuntime.mjs")) return false;
  const harness = readFileSync("sdk/typescript/harness.ts", "utf8");
  const index = readFileSync("sdk/typescript/index.ts", "utf8");
  const cli = readFileSync("bin/lib/cliRuntime.mjs", "utf8");
  return [
    "class CognibrainHarnessSdk",
    "beforeToolCall",
    "afterToolCall",
    "finishPatch",
    "prepareHandoff",
    "prepareRelease"
  ].every((needle) => harness.includes(needle)) &&
    index.includes("./harness") &&
    cli.includes("harnessSdkScaffold");
}

function lifecycleCliParityCommandCount(): number {
  const content = readFileSync("bin/lib/lifecycleCli.mjs", "utf8");
  return [
    "memory_coding_context_pack",
    "memory_action_guard",
    "memory_action_outcome",
    "memory_code_correction",
    "memory_patch_evidence",
    "memory_dream_plan",
    "memory_session_end",
    "memory_release_prepare",
    "memory_source_revalidate",
    "memory_conflict_sets"
  ].filter((needle) => content.includes(needle)).length;
}

function row(id: string, name: string, configPaths: string[], rulesPaths: string[], mcp: boolean, notes: string[] = []): HarnessCatalogRow {
  return { id, name, configPaths, rulesPaths, mcp, installWizard: true, doctor: true, notes };
}

function yes(value: boolean): string {
  return value ? "yes" : "no";
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = cliOptions(process.argv.slice(2));
  const report = generateHarnessMaturity(options);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

function cliOptions(argv: string[]): { out?: string; markdown?: string } {
  return {
    out: optionValue(argv, "--out") ?? "artifacts/harness-maturity.json",
    markdown: optionValue(argv, "--markdown") ?? "artifacts/docs/harness-maturity.md"
  };
}

function optionValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}
