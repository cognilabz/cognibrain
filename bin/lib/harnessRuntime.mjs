import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function createHarnessRuntime({ root, launchCwd, rawArgs, readJson, writeJson }) {
function writeHarnessConfig(target) {
  switch (target) {
    case "all":
      writeCodexConfig();
      writeClaudeConfig();
      writeCopilotConfig();
      writeCursorConfig();
      writeVsCodeConfig();
      writeOpenCodeConfig();
      writeOpenClawConfig();
      writeLangGraphConfig();
      writeCrewAIConfig();
      writeWindsurfConfig();
      writeContinueConfig();
      writeAiderConfig();
      writeRooClineConfig();
      writeGooseConfig();
      writeSourcegraphAmpConfig();
      writeDevinStyleConfig();
      writeHarnessPackageManifest();
      break;
    case "codex":
      writeCodexConfig();
      break;
    case "claude":
      writeClaudeConfig();
      break;
    case "copilot":
      writeCopilotConfig();
      break;
    case "cursor":
      writeCursorConfig();
      break;
    case "vscode":
      writeVsCodeConfig();
      break;
    case "opencode":
      writeOpenCodeConfig();
      break;
    case "openclaw":
      writeOpenClawConfig();
      break;
    case "langgraph":
      writeLangGraphConfig();
      break;
    case "crewai":
      writeCrewAIConfig();
      break;
    case "windsurf":
      writeWindsurfConfig();
      break;
    case "continue":
      writeContinueConfig();
      break;
    case "aider":
      writeAiderConfig();
      break;
    case "roo-cline":
      writeRooClineConfig();
      break;
    case "goose":
      writeGooseConfig();
      break;
    case "sourcegraph-amp":
      writeSourcegraphAmpConfig();
      break;
    case "devin-style":
      writeDevinStyleConfig();
      break;
    default:
      console.error("Usage: cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai|windsurf|continue|aider|roo-cline|goose|sourcegraph-amp|devin-style>");
      process.exit(1);
  }
}

function writeCodexConfig() {
  const configPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");
  mkdirSync(dirname(configPath), { recursive: true });
  const current = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  if (current.includes("[mcp_servers.cognibrain]")) {
    console.log(`Codex MCP config already present: ${configPath}`);
  } else {
    const block = [
      "",
      "[mcp_servers.cognibrain]",
      `command = ${tomlString(process.execPath)}`,
      `args = [${tomlString(join(root, "bin", "lib", "lightweightMcpServer.mjs"))}]`,
      `[mcp_servers.cognibrain.env]`,
      `COGNIBRAIN_RUNTIME_ROOT = ${tomlString(launchCwd)}`,
      ""
    ].join("\n");
    writeFileSync(configPath, `${current.trimEnd()}${block}`);
    console.log(`Wrote Codex MCP config: ${configPath}`);
  }
  writeTemplateFile(join(launchCwd, "AGENTS.md"), "templates/codex/AGENTS.md");
  writeHarnessPackageManifest();
}

function writeClaudeConfig() {
  const path = join(launchCwd, ".mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote Claude MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".claude", "settings.json"), "templates/claude/settings.json");
  writeHarnessPackageManifest();
}

function writeCopilotConfig() {
  writeTemplateFile(join(launchCwd, ".github", "copilot-instructions.md"), "templates/copilot/copilot-instructions.md");
  writeTextFile(join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"), generatedCopilotScopedInstructions());
  writeHarnessPackageManifest();
}

function writeCursorConfig() {
  const path = join(launchCwd, ".cursor", "mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote Cursor MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".cursor", "rules", "open-memory.mdc"), "templates/cursor/open-memory.mdc");
  writeHarnessPackageManifest();
}

function writeVsCodeConfig() {
  const path = join(launchCwd, ".vscode", "mcp.json");
  const json = readJson(path, { servers: {} });
  json.servers ??= {};
  json.servers.cognibrain = { type: "stdio", ...stdioServerConfig() };
  writeJson(path, json);
  console.log(`Wrote VS Code MCP config: ${path}`);
  writeVsCodeResourceSettings();
  writeTemplateFile(join(launchCwd, ".vscode", "cognibrain.instructions.md"), "templates/vscode/cognibrain.instructions.md");
  writeHarnessPackageManifest();
}

function writeVsCodeResourceSettings() {
  const path = join(launchCwd, ".vscode", "settings.json");
  const json = readJson(path, {});
  const excludes = {
    "**/.cognibrain/**": true,
    "**/.memory-harness.json": true,
    "**/artifacts/**": true,
    "**/data/benchmarks/**": true,
    "**/dist/**": true,
    "**/node_modules/**": true,
    "**/operator-ui/.next/**": true,
    "**/.playwright-cli/**": true,
    "**/output/**": true
  };
  json["files.watcherExclude"] = { ...(json["files.watcherExclude"] ?? {}), ...excludes };
  json["search.exclude"] = { ...(json["search.exclude"] ?? {}), ...excludes };
  writeJson(path, json);
  console.log(`Wrote VS Code resource excludes: ${path}`);
}

function writeOpenCodeConfig() {
  writeTemplateFile(join(launchCwd, ".opencode", "cognibrain.md"), "templates/opencode/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeOpenClawConfig() {
  writeTemplateFile(join(launchCwd, ".openclaw", "cognibrain.md"), "templates/openclaw/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeLangGraphConfig() {
  writeTemplateFile(join(launchCwd, "langgraph.cognibrain.json"), "templates/langgraph/langgraph.cognibrain.json");
  writeTemplateFile(join(launchCwd, "langgraph-cognibrain.ts"), "templates/langgraph/langgraph-cognibrain.ts");
  writeHarnessPackageManifest();
}

function writeCrewAIConfig() {
  writeTemplateFile(join(launchCwd, "crewai.cognibrain.json"), "templates/crewai/crewai.cognibrain.json");
  writeTemplateFile(join(launchCwd, "crewai_cognibrain.py"), "templates/crewai/crewai_cognibrain.py");
  writeHarnessPackageManifest();
}

function writeWindsurfConfig() {
  writeTemplateFile(join(launchCwd, ".windsurf", "rules", "cognibrain.md"), "templates/windsurf/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeContinueConfig() {
  writeTemplateFile(join(launchCwd, ".continue", "rules", "cognibrain.md"), "templates/continue/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeAiderConfig() {
  writeTextFile(join(launchCwd, ".aider.conf.yml"), generatedAiderConfig());
  writeTemplateFile(join(launchCwd, ".aider", "cognibrain.md"), "templates/aider/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeRooClineConfig() {
  const path = join(launchCwd, ".roo", "mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  writeTemplateFile(join(launchCwd, ".clinerules", "cognibrain.md"), "templates/roo-cline/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeGooseConfig() {
  writeTextFile(join(launchCwd, ".goose", "config.yaml"), generatedGooseConfig());
  writeTemplateFile(join(launchCwd, ".goose", "cognibrain.md"), "templates/goose/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeSourcegraphAmpConfig() {
  writeTemplateFile(join(launchCwd, ".amp", "cognibrain.md"), "templates/sourcegraph-amp/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeDevinStyleConfig() {
  writeJson(join(launchCwd, ".devin", "cognibrain.json"), generatedExternalAgentContract("devin-style"));
  writeTemplateFile(join(launchCwd, ".devin", "cognibrain.md"), "templates/devin-style/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeTemplateFile(targetPath, templatePath) {
  const content = readFileSync(join(root, templatePath), "utf8")
    .replaceAll("/ABSOLUTE/PATH/TO/cognibrain", root)
    .replaceAll("__COGNIBRAIN_ROOT__", root);
  writeTextFile(targetPath, content);
}

function writeTextFile(targetPath, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (existsSync(targetPath)) {
    const current = readFileSync(targetPath, "utf8");
    if (current === normalized) {
      console.log(`cognibrain integration file already current: ${targetPath}`);
      return;
    }
    if (current.includes("cognibrain") && shouldRefreshHarnessFiles()) {
      writeFileSync(targetPath, normalized);
      console.log(`Refreshed cognibrain integration file: ${targetPath}`);
      return;
    }
    if (current.includes("cognibrain")) {
      const sidecar = `${targetPath}.cognibrain`;
      mkdirSync(dirname(sidecar), { recursive: true });
      writeFileSync(sidecar, normalized);
      console.log(`Wrote reviewable cognibrain integration update: ${sidecar}`);
      return;
    }
    const sidecar = `${targetPath}.cognibrain`;
    mkdirSync(dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, normalized);
    console.log(`Wrote reviewable cognibrain sidecar: ${sidecar}`);
    return;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, normalized);
  console.log(`Wrote harness file: ${targetPath}`);
}

function shouldRefreshHarnessFiles() {
  return rawArgs.includes("--refresh") || rawArgs.includes("--force");
}

function writeGeneratedFile(targetPath, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (existsSync(targetPath)) {
    const current = readFileSync(targetPath, "utf8");
    if (current === normalized) {
      console.log(`SDK file already current: ${targetPath}`);
      return;
    }
    const sidecar = `${targetPath}.cognibrain`;
    mkdirSync(dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, normalized);
    console.log(`Wrote reviewable SDK sidecar: ${sidecar}`);
    return;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, normalized);
  console.log(`Wrote SDK file: ${targetPath}`);
}

function generatedCopilotScopedInstructions() {
  return `---
applyTo: "**/*"
---

# cognibrain scoped memory policy

Use the local cognibrain runtime for durable project memory. Start it with \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} start\`.

Before multi-step coding or debugging, use the daemon-backed CLI lifecycle: \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} context --task "<task>" --json\`. Before shell commands or file edits with durable side effects, run \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} guard --action "<command>" --json\`. If this host exposes cognibrain MCP tools, they are optional native adapters for the same lifecycle contract.

After durable discoveries, record source-backed facts with \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory add "<fact>"\`. Finish non-trivial patches with \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} patch-evidence --task "<task>" --json\`.

Use feedback adapters through the CLI:

- accepted suggestion: \`MEMORY_CONNECTOR_FEEDBACK_KIND=accepted_change node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory feedback-injection "<query>" accepted\`
- rejected suggestion: \`MEMORY_CONNECTOR_FEEDBACK_KIND=rejected_suggestion node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory feedback-injection "<query>" rejected\`
- failing test: \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory add "A harness suggestion caused a failing test: <summary>"\`
`;
}

function generatedAiderConfig() {
  return `read:
  - .aider/cognibrain.md
`;
}

function generatedGooseConfig() {
  return `extensions:
  cognibrain:
    type: stdio
    command: ${JSON.stringify(process.execPath)}
    args:
      - ${JSON.stringify(join(root, "bin", "cognibrain.mjs"))}
      - "--runtime-root"
      - ${JSON.stringify(launchCwd)}
      - "mcp"
`;
}

function generatedExternalAgentContract(target) {
  const cli = join(root, "bin", "cognibrain.mjs");
  return {
    schemaVersion: "1.0",
    target,
    runtimeRoot: launchCwd,
    protocol: "json-command",
    commands: {
      contextPack: `${process.execPath} ${cli} --runtime-root ${launchCwd} context --task "$TASK" --json`,
      preToolGuard: `${process.execPath} ${cli} --runtime-root ${launchCwd} guard --action "$COMMAND" --json`,
      recordAction: `${process.execPath} ${cli} --runtime-root ${launchCwd} outcome --command "$COMMAND" --json`,
      recordCorrection: `${process.execPath} ${cli} --runtime-root ${launchCwd} correction --text "$CORRECTION" --json`,
      patchEvidence: `${process.execPath} ${cli} --runtime-root ${launchCwd} patch-evidence --task "$TASK" --json`
    },
    safety: {
      secrets: "do not store secret values; pass env var names or redacted refs only",
      destructiveActions: "call preToolGuard before shell/file operations with durable side effects",
      evidence: "record command, files, test outcome and sourceRefs after tool use"
    },
    generatedAt: new Date().toISOString()
  };
}

function writeHarnessPackageManifest() {
  const path = join(launchCwd, ".cognibrain-harness-package.json");
  writeJson(path, {
    schemaVersion: "1.0",
    runtimeRoot: launchCwd,
    packageRoot: root,
    harnesses: {
      codex: {
        mcpConfig: join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml"),
        policyFile: join(launchCwd, "AGENTS.md"),
        skill: join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md"),
        feedback: ["cognibrain context", "cognibrain guard", "memory_add", "memory_maintenance_status", "memory_dream"]
      },
      claude: {
        mcpConfig: join(launchCwd, ".mcp.json"),
        hooks: join(launchCwd, ".claude", "settings.json"),
        feedback: ["PostToolUse maintenance hook", "memory feedback-injection"]
      },
      copilot: {
        repositoryInstructions: join(launchCwd, ".github", "copilot-instructions.md"),
        scopedInstructions: join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"),
        feedback: ["accepted_change", "rejected_suggestion", "failing_test"]
      },
      cursor: {
        mcpConfig: join(launchCwd, ".cursor", "mcp.json"),
        rule: join(launchCwd, ".cursor", "rules", "open-memory.mdc"),
        feedback: ["cognibrain context", "cognibrain guard", "memory add", "optional MCP context adapter", "memory_dream"]
      },
      vscode: {
        mcpConfig: join(launchCwd, ".vscode", "mcp.json"),
        feedback: ["cognibrain context", "cognibrain guard", "memory add", "optional MCP context adapter", "connector-telemetry"]
      },
      opencode: {
        instructions: join(launchCwd, ".opencode", "cognibrain.md"),
        protocol: "cli-lifecycle",
        feedback: ["cognibrain context", "cognibrain outcome", "connector-telemetry", "memory_dream"]
      },
      openclaw: {
        instructions: join(launchCwd, ".openclaw", "cognibrain.md"),
        protocol: "cli-lifecycle",
        feedback: ["cognibrain context", "cognibrain outcome", "connector-telemetry", "memory_dream"]
      },
      langgraph: {
        config: join(launchCwd, "langgraph.cognibrain.json"),
        helper: join(launchCwd, "langgraph-cognibrain.ts"),
        feedback: ["context pack middleware", "tool outcome telemetry"]
      },
      crewai: {
        config: join(launchCwd, "crewai.cognibrain.json"),
        helper: join(launchCwd, "crewai_cognibrain.py"),
        feedback: ["task memory prefetch", "tool outcome telemetry"]
      },
      windsurf: {
        rules: join(launchCwd, ".windsurf", "rules", "cognibrain.md"),
        protocol: "cli-lifecycle",
        feedback: ["cognibrain context", "cognibrain guard", "connector-telemetry", "memory_dream"]
      },
      continue: {
        rules: join(launchCwd, ".continue", "rules", "cognibrain.md"),
        protocol: "cli-lifecycle",
        feedback: ["cognibrain context", "cognibrain correction", "accepted_change", "rejected_suggestion"]
      },
      aider: {
        config: join(launchCwd, ".aider.conf.yml"),
        instructions: join(launchCwd, ".aider", "cognibrain.md"),
        feedback: ["cognibrain context", "cognibrain guard", "cognibrain outcome", "test outcome telemetry"]
      },
      "roo-cline": {
        mcpConfig: join(launchCwd, ".roo", "mcp.json"),
        rules: join(launchCwd, ".clinerules", "cognibrain.md"),
        feedback: ["cognibrain context", "cognibrain outcome", "tool outcome telemetry", "correction capture"]
      },
      goose: {
        config: join(launchCwd, ".goose", "config.yaml"),
        instructions: join(launchCwd, ".goose", "cognibrain.md"),
        feedback: ["cognibrain context", "cognibrain outcome", "tool outcome telemetry"]
      },
      "sourcegraph-amp": {
        instructions: join(launchCwd, ".amp", "cognibrain.md"),
        feedback: ["context recall instructions", "evidence trail handoff"]
      },
      "devin-style": {
        config: join(launchCwd, ".devin", "cognibrain.json"),
        instructions: join(launchCwd, ".devin", "cognibrain.md"),
        feedback: ["json-command context pack", "pre-tool action guard", "patch evidence handoff"]
      }
    }
  });
  console.log(`Wrote harness package manifest: ${path}`);
}

function harnessTemplateHealth() {
  const templates = [
    "templates/codex/AGENTS.md",
    "templates/codex/cognibrain-skill/SKILL.md",
    "templates/claude/settings.json",
    "templates/copilot/copilot-instructions.md",
    "templates/cursor/open-memory.mdc",
    "templates/vscode/cognibrain.instructions.md",
    "templates/opencode/cognibrain.md",
    "templates/openclaw/cognibrain.md",
    "templates/langgraph/langgraph.cognibrain.json",
    "templates/langgraph/langgraph-cognibrain.ts",
    "templates/crewai/crewai.cognibrain.json",
    "templates/crewai/crewai_cognibrain.py",
    "templates/windsurf/cognibrain.md",
    "templates/continue/cognibrain.md",
    "templates/aider/cognibrain.md",
    "templates/roo-cline/cognibrain.md",
    "templates/goose/cognibrain.md",
    "templates/sourcegraph-amp/cognibrain.md",
    "templates/devin-style/cognibrain.md"
  ];
  const missing = templates.filter((template) => !existsSync(join(root, template)));
  return { ok: missing.length === 0, detail: missing.length ? `missing ${missing.join(", ")}` : `${templates.length} templates available` };
}

function harnessGeneratedHealth() {
  const expected = [
    join(launchCwd, "AGENTS.md"),
    join(launchCwd, ".mcp.json"),
    join(launchCwd, ".claude", "settings.json"),
    join(launchCwd, ".github", "copilot-instructions.md"),
    join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"),
    join(launchCwd, ".cursor", "mcp.json"),
    join(launchCwd, ".cursor", "rules", "open-memory.mdc"),
    join(launchCwd, ".vscode", "mcp.json"),
    join(launchCwd, ".vscode", "cognibrain.instructions.md"),
    join(launchCwd, ".opencode", "cognibrain.md"),
    join(launchCwd, ".openclaw", "cognibrain.md"),
    join(launchCwd, "langgraph.cognibrain.json"),
    join(launchCwd, "langgraph-cognibrain.ts"),
    join(launchCwd, "crewai.cognibrain.json"),
    join(launchCwd, "crewai_cognibrain.py"),
    join(launchCwd, ".windsurf", "rules", "cognibrain.md"),
    join(launchCwd, ".continue", "rules", "cognibrain.md"),
    join(launchCwd, ".aider.conf.yml"),
    join(launchCwd, ".aider", "cognibrain.md"),
    join(launchCwd, ".roo", "mcp.json"),
    join(launchCwd, ".clinerules", "cognibrain.md"),
    join(launchCwd, ".goose", "config.yaml"),
    join(launchCwd, ".goose", "cognibrain.md"),
    join(launchCwd, ".amp", "cognibrain.md"),
    join(launchCwd, ".devin", "cognibrain.json"),
    join(launchCwd, ".devin", "cognibrain.md"),
    join(launchCwd, ".cognibrain-harness-package.json")
  ];
  const missing = expected.filter((path) => !existsSync(path));
  return { ok: missing.length === 0, detail: missing.length ? `run cognibrain setup --all-harnesses; missing ${missing.map((path) => path.replace(`${launchCwd}/`, "")).join(", ")}` : "Codex, Claude, Copilot, Cursor, VS Code, OpenCode, OpenClaw, LangGraph, CrewAI, Windsurf, Continue, Aider, Roo/Cline, Goose, Sourcegraph Amp and Devin-style configs present" };
}

function connectorProofHealth() {
  const maturity = readJson(join(root, "artifacts", "connector-maturity.json"), { rows: [] });
  const rows = Array.isArray(maturity.rows) ? maturity.rows : [];
  const minimum = process.env.MEMORY_CONNECTOR_MIN_PROOF_LEVEL ?? "live-smoke-ready";
  const below = rows.filter((row) => !connectorProofAtLeast(row?.proofLevel, minimum));
  const tenantVerified = rows.filter((row) => row?.maturity?.tenantVerified === true).length;
  if (!rows.length) return { ok: true, level: "warn", detail: "connector maturity artifact missing; run npm run connectors:maturity" };
  return {
    ok: below.length === 0,
    level: below.length === 0 ? "ok" : "warn",
    detail: below.length === 0
      ? `${rows.length} connector rows meet ${minimum}; ${tenantVerified} tenant-verified`
      : `${below.length}/${rows.length} connector rows below ${minimum}: ${below.slice(0, 5).map((row) => `${row.provider}:${row.proofLevel}`).join(", ")}`
  };
}

function connectorProofAtLeast(actual, minimum) {
  const order = ["manifest-only", "cli-config", "driver-code", "hermetic-tested", "live-smoke-ready", "tenant-verified", "production-certified"];
  const actualIndex = order.indexOf(actual);
  const minimumIndex = order.indexOf(minimum);
  return actualIndex >= 0 && minimumIndex >= 0 && actualIndex >= minimumIndex;
}

function stdioServerConfig() {
  return {
    command: process.execPath,
    args: [join(root, "bin", "lib", "lightweightMcpServer.mjs")],
    env: {
      COGNIBRAIN_RUNTIME_ROOT: launchCwd
    }
  };
}

function tomlString(value) {
  return JSON.stringify(value);
}

return {
  writeHarnessConfig,
  writeHarnessPackageManifest,
  writeGeneratedFile,
  harnessTemplateHealth,
  harnessGeneratedHealth,
  connectorProofHealth,
  stdioServerConfig
};
}
