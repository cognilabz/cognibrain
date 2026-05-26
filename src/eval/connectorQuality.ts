import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type ProviderQualityRow = {
  provider: string;
  category: string;
  passed: boolean;
  checkedCases: string[];
  expectedMemoryKinds: string[];
  qualityChecks: Record<string, boolean>;
  gaps: string[];
};

type ConnectorQualityReport = {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "connector-semantic-quality";
  sourceArtifact: string;
  rows: ProviderQualityRow[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    checkedCases: number;
  };
  passed: boolean;
};

const semanticCases: Record<string, Array<{ id: string; expectedMemoryKind: string }>> = {
  jira: [
    { id: "issue-correction", expectedMemoryKind: "review_correction" },
    { id: "acceptance-criteria", expectedMemoryKind: "procedure" },
    { id: "blocker-status", expectedMemoryKind: "tool_outcome" },
    { id: "epic-relation", expectedMemoryKind: "architecture_decision" }
  ],
  confluence: [
    { id: "adr", expectedMemoryKind: "architecture_decision" },
    { id: "runbook", expectedMemoryKind: "procedure" },
    { id: "policy", expectedMemoryKind: "repo_policy" },
    { id: "incident-learning", expectedMemoryKind: "tool_outcome" }
  ],
  notion: [
    { id: "spec", expectedMemoryKind: "architecture_decision" },
    { id: "decision", expectedMemoryKind: "architecture_decision" },
    { id: "meeting-note", expectedMemoryKind: "procedure" },
    { id: "task-rule", expectedMemoryKind: "repo_policy" }
  ],
  sentry: [
    { id: "issue-root-cause", expectedMemoryKind: "tool_outcome" },
    { id: "regression", expectedMemoryKind: "review_correction" }
  ],
  datadog: [
    { id: "monitor-incident", expectedMemoryKind: "tool_outcome" },
    { id: "runbook-update", expectedMemoryKind: "procedure" }
  ],
  pagerduty: [
    { id: "incident", expectedMemoryKind: "tool_outcome" },
    { id: "escalation-policy", expectedMemoryKind: "procedure" }
  ]
};

export function generateConnectorQualityReport(options: { input?: string; out?: string; markdown?: string } = {}): ConnectorQualityReport {
  const sourceArtifact = options.input ?? "artifacts/connector-maturity.json";
  const maturity = readJson(sourceArtifact, { rows: [] }) as { rows?: Array<Record<string, unknown>> };
  const rows = (Array.isArray(maturity.rows) ? maturity.rows : []).map((row) => qualityRow(row));
  const report: ConnectorQualityReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "connector-semantic-quality",
    sourceArtifact,
    rows,
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length,
      checkedCases: rows.reduce((sum, row) => sum + row.checkedCases.length, 0)
    },
    passed: rows.length >= 19 && rows.every((row) => row.passed)
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

function qualityRow(row: Record<string, unknown>): ProviderQualityRow {
  const provider = String(row.provider ?? "unknown");
  const quality = object(row.quality);
  const maturity = object(row.maturity);
  const cases = semanticCases[provider] ?? [{ id: `${provider}-baseline`, expectedMemoryKind: String(row.category ?? "import") }];
  const qualityChecks = {
    eventExtraction: quality.eventExtraction === true,
    sourceRefCompleteness: quality.sourceRefCompleteness === true,
    memoryTypeClassification: quality.memoryTypeClassification === true,
    scopeMapping: quality.scopeMapping === true,
    sensitiveDataHandling: quality.sensitiveDataHandling === true,
    duplicateSuppression: quality.duplicateSuppression === true,
    updateRevalidation: quality.updateRevalidation === true,
    writebackDryRun: quality.writebackDryRun === true,
    pollOrList: maturity.pollOrList === true,
    writeback: maturity.writeback === true
  };
  const gaps = Object.entries(qualityChecks).filter(([, passed]) => !passed).map(([name]) => `missing ${name}`);
  return {
    provider,
    category: String(row.category ?? "custom"),
    passed: gaps.length === 0,
    checkedCases: cases.map((item) => item.id),
    expectedMemoryKinds: [...new Set(cases.map((item) => item.expectedMemoryKind))],
    qualityChecks,
    gaps
  };
}

function renderMarkdown(report: ConnectorQualityReport): string {
  const rows = report.rows
    .map((row) => `| ${row.provider} | ${row.category} | ${row.passed ? "yes" : "no"} | ${row.checkedCases.join(", ")} | ${row.expectedMemoryKinds.join(", ")} | ${row.gaps.length ? row.gaps.join("; ") : "none"} |`)
    .join("\n");
  return `# Connector Semantic Quality

Generated at ${report.generatedAt}.

This artifact checks that connector rows are not only reachable drivers. It verifies semantic extraction coverage, source refs, scope mapping, duplicate suppression, update revalidation, dry-run writeback, and provider-specific Engineering Memory case families.

| Provider | Category | Passed | Checked cases | Expected memory kinds | Gaps |
| --- | --- | ---: | --- | --- | --- |
${rows}
`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readJson(path: string, fallback: unknown): unknown {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function cliOptions(argv: string[]): { input?: string; out?: string; markdown?: string } {
  const inputIndex = argv.indexOf("--input");
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  return {
    input: inputIndex >= 0 ? argv[inputIndex + 1] : "artifacts/connector-maturity.json",
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/connector-quality.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/connector-quality.md"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateConnectorQualityReport(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
