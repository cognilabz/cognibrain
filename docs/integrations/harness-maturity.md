# Harness Maturity Matrix

Generated at 2026-05-26T11:11:02.989Z from the harness package manifest, setup output and golden-path simulator.

Current checked state: 16 generated harness packages, 10 MCP-capable targets, 13 pre-tool guard targets, 15 correction-capture targets, 15 patch-evidence targets and 16 golden-path demos. Non-native rows are marked without claiming vendor-native hooks.

| Harness | Status | Config | Skill/rules | MCP | Pre-LLM context | Pre-tool guard | Telemetry | Correction | Evidence trail | Install wizard | Doctor | E2E demo | Gaps |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| OpenAI Codex CLI | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| Claude Code | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| GitHub Copilot | generated-partial | yes | yes | no | no | no | yes | yes | yes | yes | yes | yes | MCP-native hook not claimed; pre-tool action guard not natively hooked |
| Cursor | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| VS Code MCP | generated-e2e-proven | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | yes | skill/rules package not generated |
| OpenCode | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| OpenClaw | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| LangGraph | generated-e2e-proven | yes | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | MCP-native hook not claimed |
| CrewAI | generated-e2e-proven | yes | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | MCP-native hook not claimed |
| Windsurf | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| Continue.dev | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| Aider | generated-partial | yes | yes | no | yes | no | yes | yes | yes | yes | yes | yes | MCP-native hook not claimed; pre-tool action guard not natively hooked; Aider uses file-based instructions plus CLI feedback commands rather than MCP-native hooks. |
| Roo Code / Cline | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| Goose | generated-e2e-proven | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | none |
| Sourcegraph Amp | instruction-only | yes | yes | no | no | no | no | no | no | yes | yes | yes | MCP-native hook not claimed; pre-tool action guard not natively hooked; Instruction handoff is generated; a native pre-tool hook is not claimed. |
| Devin-style external agent mode | generated-e2e-proven | yes | yes | no | yes | yes | yes | yes | yes | yes | yes | yes | MCP-native hook not claimed; Generic external-agent contract is generated; a vendor-native Devin hook is not claimed. |

Evidence:

- `artifacts/harness-maturity.json` contains the machine-readable matrix.
- `npm run harness:maturity` regenerates this document and the artifact.
- Golden-path demos simulate install -> context -> action guard -> telemetry -> correction -> evidence for generated harness rows.
- External-agent modes use the generated JSON-command contract unless a vendor-native hook is available.
