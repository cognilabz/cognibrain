import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildApiDescription } from "../api/apiDescription";
import { API_ROUTE_CONTRACTS, CLI_COMMAND_CONTRACTS, MEMCTL_COMMAND_CONTRACTS, type CommandContract } from "../api/releaseContract";

type Check = {
  name: string;
  ok: boolean;
  details?: Record<string, unknown>;
};

const root = process.cwd();
const out = arg("--out") ?? "artifacts/release-contract-audit.json";
const checks: Check[] = [];

const routeKeys = new Set(API_ROUTE_CONTRACTS.flatMap((contract) => contract.methods.map((method) => routeKey(contract.path, method))));
const routePaths = new Set(API_ROUTE_CONTRACTS.map((contract) => contract.path));
const duplicateRouteKeys = duplicates(API_ROUTE_CONTRACTS.flatMap((contract) => contract.methods.map((method) => routeKey(contract.path, method))));
const routeContractIssues = API_ROUTE_CONTRACTS.flatMap((contract) => {
  const issues: string[] = [];
  if (!contract.path.startsWith("/")) issues.push("path must start with /");
  if (!contract.methods.length) issues.push("at least one method required");
  if (contract.methods.some((method) => method !== method.toUpperCase())) issues.push("methods must be uppercase");
  if (!contract.stability) issues.push("stability required");
  if (!contract.surface) issues.push("surface required");
  return issues.map((issue) => ({ path: contract.path, issue }));
});
checks.push(check("api route contracts are explicit and unique", duplicateRouteKeys.length === 0 && routeContractIssues.length === 0, {
  duplicateRouteKeys,
  routeContractIssues,
  routeCount: API_ROUTE_CONTRACTS.length
}));

const openapi = buildApiDescription({ mode: "api-key", protected: true });
const uncontractedOperations: string[] = [];
for (const [path, operations] of Object.entries(openapi.paths as Record<string, Record<string, Record<string, unknown>>>)) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!operation["x-cognibrain-stability"] || operation["x-cognibrain-stability"] === "uncontracted") {
      uncontractedOperations.push(routeKey(path, method.toUpperCase()));
    }
  }
}
checks.push(check("openapi operations carry stability metadata", uncontractedOperations.length === 0, { uncontractedOperations }));

const serverRouteFiles = [
  "src/api/server.ts",
  "src/api/server/routes/memoryRoutes.ts",
  "src/api/server/routes/connectorRoutes.ts",
  "src/api/server/routes/graphRoutes.ts",
  "src/api/server/routes/platformRoutes.ts",
  "src/api/server/dreamRoutes.ts"
];
const literalPaths = new Set<string>();
for (const file of serverRouteFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/url\.pathname\s*={2,3}\s*"([^"]+)"/g)) literalPaths.add(match[1]);
  for (const match of source.matchAll(/url\.pathname\s*={2,3}\s*'([^']+)'/g)) literalPaths.add(match[1]);
}
const missingLiteralContracts = [...literalPaths]
  .filter((path) => path !== "/" && path !== "/v1")
  .filter((path) => !routePaths.has(path));
checks.push(check("literal HTTP routes are present in release contract", missingLiteralContracts.length === 0, {
  missingLiteralContracts,
  literalRouteCount: literalPaths.size
}));

const cliCommands = new Set(CLI_COMMAND_CONTRACTS.map((contract) => contract.command));
const cliDuplicates = duplicates(CLI_COMMAND_CONTRACTS.map((contract) => `${contract.surface}:${contract.command}`));
checks.push(check("operator CLI commands have stability labels", cliDuplicates.length === 0 && CLI_COMMAND_CONTRACTS.every(validCommandContract), {
  commandCount: CLI_COMMAND_CONTRACTS.length,
  cliDuplicates
}));

const memctlUsage = readFileSync("src/cli/memctl.ts", "utf8").match(/memctl <([^>]+)>/s)?.[1] ?? "";
const usageMemctlCommands = memctlUsage.split("|").map((command) => command.trim()).filter(Boolean);
const memctlCommands = new Set(MEMCTL_COMMAND_CONTRACTS.map((contract) => contract.command));
const missingMemctlContracts = usageMemctlCommands.filter((command) => !memctlCommands.has(command));
const staleMemctlContracts = [...memctlCommands].filter((command) => !usageMemctlCommands.includes(command));
checks.push(check("memctl usage commands have stability labels", missingMemctlContracts.length === 0 && staleMemctlContracts.length === 0 && MEMCTL_COMMAND_CONTRACTS.every(validCommandContract), {
  usageCommandCount: usageMemctlCommands.length,
  contractCommandCount: MEMCTL_COMMAND_CONTRACTS.length,
  missingMemctlContracts,
  staleMemctlContracts
}));

const usageSource = readFileSync("bin/lib/usage.mjs", "utf8");
const packageJsonSource = readFileSync("package.json", "utf8");
const missingCliUsage = [...cliCommands].filter((command) => !cliCommandAppearsInUsage(command, usageSource, packageJsonSource));
checks.push(check("operator CLI stability contracts map to published usage", missingCliUsage.length === 0, { missingCliUsage }));

const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  summary: {
    total: checks.length,
    passed: checks.filter((item) => item.ok).length,
    failed: checks.filter((item) => !item.ok).length,
    apiRoutes: API_ROUTE_CONTRACTS.length,
    cliCommands: CLI_COMMAND_CONTRACTS.length,
    memctlCommands: MEMCTL_COMMAND_CONTRACTS.length
  },
  checks,
  stability: stabilitySummary()
};

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

if (report.summary.failed > 0) {
  console.error(`release contract audit failed: ${report.summary.failed}/${report.summary.total} checks failed`);
  for (const item of checks.filter((check) => !check.ok)) console.error(`- ${item.name}: ${JSON.stringify(item.details ?? {})}`);
  process.exit(1);
}

console.log(`release contract audit passed: ${report.summary.passed}/${report.summary.total} checks`);

function check(name: string, ok: boolean, details?: Record<string, unknown>): Check {
  return { name, ok, details };
}

function validCommandContract(contract: CommandContract): boolean {
  return Boolean(contract.command && contract.stability && contract.surface);
}

function routeKey(path: string, method: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function duplicates(items: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const item of items) {
    if (seen.has(item)) dupes.add(item);
    seen.add(item);
  }
  return [...dupes];
}

function stabilitySummary() {
  const all = [
    ...API_ROUTE_CONTRACTS.map((item) => ({ kind: "api", stability: item.stability })),
    ...CLI_COMMAND_CONTRACTS.map((item) => ({ kind: "cli", stability: item.stability })),
    ...MEMCTL_COMMAND_CONTRACTS.map((item) => ({ kind: "memctl", stability: item.stability }))
  ];
  return all.reduce<Record<string, number>>((summary, item) => {
    const key = `${item.kind}.${item.stability}`;
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function cliCommandAppearsInUsage(command: string, usageSource: string, packageJsonSource: string): boolean {
  if (command === "cognibrain") return usageSource.includes("cognibrain");
  if (command === "cognibrain-connect") return packageJsonSource.includes('"cognibrain-connect"');
  return usageSource.includes(`cognibrain ${command}`) || new RegExp(`(?:\\||\\s)${escapeRegExp(command)}(?:\\||\\s|$)`).test(usageSource);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
