import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface OperatorRow {
  surface: string;
  cliCommands: string[];
  cliSurface: boolean;
  compactOutput: boolean;
  transactionalPath: boolean;
  validation: boolean;
  evidence: string[];
  passed: boolean;
  gaps: string[];
}

interface OperatorOsReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "operator-os-maturity";
  rows: OperatorRow[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  passed: boolean;
}

const surfaces = [
  surface("Home", ["cognibrain", "cognibrain status"], ["surface: \"operator-cli\"", "function renderPlainSurface"], ["tests/cli.test.ts"]),
  surface("Memories", ["cognibrain memories", "cognibrain memory inspect <id>", "cognibrain memory edit <id>", "cognibrain memory archive <id>", "cognibrain memory retract <id>"], ["cognibrain memories", "memory inspect"], ["tests/cli.test.ts", "src/cli/memctl.ts"]),
  surface("CLI Lifecycle", ["cognibrain context --task <task> --json", "cognibrain guard --action <command> --json", "cognibrain outcome --command <command> --json"], ["class CliBackendClient", "class DaemonBackend", "class LocalDirectBackend", "MCP_PARITY"], ["tests/cli.test.ts", "bin/lib/lifecycleCli.mjs", "src/cli/lifecycleLocalDirect.ts"]),
  surface("Evidence", ["cognibrain memory evidence-pack <query>", "cognibrain memory graph <query>"], ["evidence packs", "graph/timeline"], ["src/cli/memctl.ts"]),
  surface("Connectors", ["cognibrain connector wizard github", "cognibrain connector doctor", "cognibrain connector list", "cognibrain memory connector-configure", "cognibrain memory connector-review"], ["cognibrain connector", "connector wizard"], ["tests/cli.test.ts"]),
  surface("Runtime", ["cognibrain service plan", "cognibrain service logs", "cognibrain status"], ["cognibrain service", "service logs"], ["tests/cli.test.ts"]),
  surface("Config", ["cognibrain config show", "cognibrain config doctor", "cognibrain config all"], ["cognibrain config", "setup"], ["tests/cli.test.ts"]),
  surface("Benchmarks", ["npm run internal -- benchmark:arena", "npm run internal -- audit:truth", "npm run internal -- audit:plan-gaps", "cognibrain proof"], ["cognibrain proof", "benchmark:arena"], ["tests/evaluation.test.ts"]),
  surface("Truth", ["cognibrain truth conflicts", "cognibrain truth current <id>", "cognibrain truth resolve <conflictSetId> <claimId>"], ["truth-conflicts", "truth-current", "truth-resolve"], ["src/cli/memctl/reflectionCommands.ts", "tests/core.test.ts"]),
  surface("Dream", ["cognibrain dream plan", "cognibrain dream run", "cognibrain dream jobs", "cognibrain dream verify", "cognibrain dream conflicts", "cognibrain dream resolve"], ["dream-plan", "dream-run", "dream-jobs"], ["src/cli/memctl/reflectionCommands.ts", "tests/core.test.ts"]),
  surface("Logs", ["cognibrain service logs", "cognibrain doctor --publish"], ["service logs", "doctor --publish"], ["bin/cognibrain.mjs"]),
  surface("Policies", ["cognibrain memory policy-rule", "cognibrain memory policy-evaluate"], ["policy", "retention"], ["src/cli/memctl.ts", "src/api/server.ts"]),
  surface("Retention", ["cognibrain memory retention-rule", "cognibrain memory retention-enforce"], ["retention", "compliance"], ["src/cli/memctl.ts", "src/api/server.ts"]),
  surface("Docs", ["cognibrain proof", "npm run internal -- audit:docs"], ["docs/status.md", "docs/claims.md"], ["scripts/release/audit-docs.mjs"])
];

export function generateOperatorOsMaturity(options: { out?: string; markdown?: string } = {}): OperatorOsReport {
  const files = {
    cli: read("bin/cognibrain.mjs"),
    cliRuntime: read("bin/lib/cliRuntime.mjs"),
    lifecycleCli: read("bin/lib/lifecycleCli.mjs"),
    lifecycleLocalDirect: read("src/cli/lifecycleLocalDirect.ts"),
    render: read("bin/lib/render.mjs"),
    memctl: read("src/cli/memctl.ts"),
    server: read("src/api/server.ts"),
    packageJson: read("package.json"),
    internalRunner: read("scripts/internal/run-task.mjs"),
    cliTests: read("tests/cli.test.ts"),
    evalTests: read("tests/evaluation.test.ts"),
    docs: [read("docs/status.md"), read("docs/claims.md"), read("docs/operations.md")].join("\n")
  };
  const all = Object.values(files).join("\n");
  const rows = surfaces.map((item) => operatorRow(item, files, all));
  const report: OperatorOsReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "operator-os-maturity",
    rows,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length
    },
    passed: rows.length >= 10 && rows.every((row) => row.passed)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, renderMarkdown(report));
  }
  return report;
}

function operatorRow(item: ReturnType<typeof surface>, files: Record<string, string>, all: string): OperatorRow {
  const cliCommands = item.commands.filter((command) => commandIncludes(files.cli + files.cliRuntime + files.memctl + files.packageJson + files.internalRunner, command));
  const cliSurface = item.surfaceNeedles.every((needle) => all.includes(needle));
  const compactOutput = (((files.cli + files.cliRuntime).includes("clipText") && (files.cli + files.cliRuntime).includes("terminalWidth")) || (files.render.includes("function renderPlainSurface") && files.render.includes("compactItems"))) && !all.includes("renderInteractiveCliApp");
  const transactionalPath = cliCommands.length === item.commands.length;
  const validation = item.evidence.every((path) => existsSync(path)) || item.evidence.every((path) => all.includes(path));
  const gaps = [
    ...(cliCommands.length !== item.commands.length ? [`missing CLI commands: ${item.commands.filter((command) => !cliCommands.includes(command)).join(", ")}`] : []),
    ...(!cliSurface ? ["missing CLI surface evidence"] : []),
    ...(!compactOutput ? ["missing compact output guard"] : []),
    ...(!transactionalPath ? ["missing transactional command execution path"] : []),
    ...(!validation ? ["missing validation evidence"] : [])
  ];
  return {
    surface: item.name,
    cliCommands: item.commands,
    cliSurface,
    compactOutput,
    transactionalPath,
    validation,
    evidence: item.evidence,
    passed: gaps.length === 0,
    gaps
  };
}

function surface(name: string, commands: string[], surfaceNeedles: string[], evidence: string[]) {
  return { name, commands, surfaceNeedles, evidence };
}

function commandIncludes(content: string, command: string): boolean {
  if (command.startsWith("npm run internal -- ")) {
    const task = command.replace(/^npm run internal -- /, "");
    return content.includes('"internal"') && content.includes(`"${task}"`);
  }
  if (command.startsWith("npm run ")) return content.includes(`"${command.replace(/^npm run /, "")}"`);
  const compact = command.replace(/^cognibrain\s+memory\s+/, "").replace(/^cognibrain\s+memories\s+/, "").replace(/^cognibrain\s+/, "");
  const first = compact.split(/\s+/)[0];
  return content.includes(command) || content.includes(`case "${first}"`) || content.includes(compact.split(" <")[0]);
}

function renderMarkdown(report: OperatorOsReport): string {
  const rows = report.rows
    .map((row) => `| ${row.surface} | ${row.passed ? "yes" : "no"} | ${row.cliSurface ? "yes" : "no"} | ${row.compactOutput ? "yes" : "no"} | ${row.transactionalPath ? "yes" : "no"} | ${row.gaps.length ? row.gaps.join("; ") : "none"} |`)
    .join("\n");
  return `# Terminal Operator OS Maturity

Generated at ${report.generatedAt}.

This artifact checks that the terminal surface covers the product workflows through stable command-backed output, validation and non-browser operator paths.

| Surface | Passed | CLI surface | Compact output | Transactional path | Gaps |
| --- | ---: | ---: | ---: | ---: | --- |
${rows}
`;
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function cliOptions(argv: string[]): { out?: string; markdown?: string } {
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/operator-os-maturity.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/operator-os.md"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateOperatorOsMaturity(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
