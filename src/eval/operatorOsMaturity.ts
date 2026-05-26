import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface OperatorRow {
  surface: string;
  cliCommands: string[];
  tuiView: boolean;
  actionPalette: boolean;
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
  surface("Home", ["cognibrain", "cognibrain status"], ["id: \"home\"", "cognibrain proof"], ["tests/cli.test.ts"]),
  surface("Memories", ["cognibrain memories", "cognibrain memory inspect <id>", "cognibrain memory retract <id>"], ["id: \"memories\"", "id: \"memory-management\"", "Review Queue"], ["tests/cli.test.ts", "src/cli/memctl.ts"]),
  surface("Evidence", ["cognibrain memory evidence-pack <query>", "cognibrain memory graph <query>"], ["evidence packs", "graph and timeline"], ["src/cli/memctl.ts"]),
  surface("Connectors", ["cognibrain connector wizard github", "cognibrain connector doctor", "cognibrain connector list"], ["id: \"connector-wizard\"", "id: \"connectors\""], ["tests/cli.test.ts"]),
  surface("Runtime", ["cognibrain service plan", "cognibrain service logs", "cognibrain status"], ["id: \"service\"", "service logs"], ["tests/cli.test.ts"]),
  surface("Config", ["cognibrain config show", "cognibrain config doctor", "cognibrain config all"], ["id: \"config\"", "Setup profile"], ["tests/cli.test.ts"]),
  surface("Benchmarks", ["npm run benchmark:arena", "npm run audit:truth", "cognibrain proof"], ["id: \"reports\"", "Proof and benchmark reports"], ["tests/evaluation.test.ts"]),
  surface("Logs", ["cognibrain service logs", "cognibrain doctor --publish"], ["service logs", "Readiness doctor"], ["bin/cognibrain.mjs"]),
  surface("Policies", ["cognibrain memory policy-rule", "cognibrain memory policy-evaluate"], ["id: \"policies\"", "Policy rules"], ["src/cli/memctl.ts", "src/api/server.ts"]),
  surface("Retention", ["cognibrain memory retention-rule", "cognibrain memory retention-enforce"], ["id: \"retention\"", "Retention and compliance"], ["src/cli/memctl.ts", "src/api/server.ts"]),
  surface("Docs", ["cognibrain proof", "npm run audit:docs"], ["docs/status.md", "docs/claims.md"], ["scripts/audit-docs.mjs"])
];

export function generateOperatorOsMaturity(options: { out?: string; markdown?: string } = {}): OperatorOsReport {
  const files = {
    cli: read("bin/cognibrain.mjs"),
    ink: read("src/cli/inkApp.mjs"),
    memctl: read("src/cli/memctl.ts"),
    server: read("src/api/server.ts"),
    packageJson: read("package.json"),
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
  const cliCommands = item.commands.filter((command) => commandIncludes(files.cli + files.memctl + files.packageJson, command));
  const tuiView = item.tuiNeedles.every((needle) => all.includes(needle));
  const actionPalette = files.ink.includes("ACTION PALETTE") && item.commands.some((command) => files.ink.includes(command.split(" <")[0]) || files.ink.includes(command));
  const transactionalPath = cliCommands.length === item.commands.length && files.ink.includes("runActionCommand") && files.ink.includes("actionNeedsConfirmation");
  const validation = item.evidence.every((path) => existsSync(path)) || item.evidence.every((path) => all.includes(path));
  const gaps = [
    ...(cliCommands.length !== item.commands.length ? [`missing CLI commands: ${item.commands.filter((command) => !cliCommands.includes(command)).join(", ")}`] : []),
    ...(!tuiView ? ["missing TUI view evidence"] : []),
    ...(!actionPalette ? ["missing action palette path"] : []),
    ...(!transactionalPath ? ["missing transactional command execution path"] : []),
    ...(!validation ? ["missing validation evidence"] : [])
  ];
  return {
    surface: item.name,
    cliCommands: item.commands,
    tuiView,
    actionPalette,
    transactionalPath,
    validation,
    evidence: item.evidence,
    passed: gaps.length === 0,
    gaps
  };
}

function surface(name: string, commands: string[], tuiNeedles: string[], evidence: string[]) {
  return { name, commands, tuiNeedles, evidence };
}

function commandIncludes(content: string, command: string): boolean {
  if (command.startsWith("npm run ")) return content.includes(`"${command.replace(/^npm run /, "")}"`);
  const compact = command.replace(/^cognibrain\s+memory\s+/, "").replace(/^cognibrain\s+memories\s+/, "").replace(/^cognibrain\s+/, "");
  const first = compact.split(/\s+/)[0];
  return content.includes(command) || content.includes(`case "${first}"`) || content.includes(compact.split(" <")[0]);
}

function renderMarkdown(report: OperatorOsReport): string {
  const rows = report.rows
    .map((row) => `| ${row.surface} | ${row.passed ? "yes" : "no"} | ${row.tuiView ? "yes" : "no"} | ${row.actionPalette ? "yes" : "no"} | ${row.transactionalPath ? "yes" : "no"} | ${row.gaps.length ? row.gaps.join("; ") : "none"} |`)
    .join("\n");
  return `# Terminal Operator OS Maturity

Generated at ${report.generatedAt}.

This artifact checks that the terminal surface covers the product workflows through command-backed TUI actions, validation and non-browser operator paths.

| Surface | Passed | TUI view | Action palette | Transactional path | Gaps |
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
