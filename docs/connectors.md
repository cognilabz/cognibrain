# Connectors

cognibrain is CLI-first and MCP-compatible.

The CLI is the human and automation surface: install, start, stop, status, health checks, memory commands, and CI-friendly scripting. MCP is the agent tool surface: let compatible harnesses retrieve, write, and inspect memory without shell parsing.

```bash
./bin/cognibrain.mjs setup --all-harnesses
./bin/cognibrain.mjs status
./bin/cognibrain.mjs memory search "project conventions"
./bin/cognibrain.mjs mcp
```

This mirrors the current AI-tooling direction: make the install path a small memorable command, then let each harness opt into deeper integration.

Harness config commands:

```bash
./bin/cognibrain.mjs config codex
./bin/cognibrain.mjs config claude
./bin/cognibrain.mjs config cursor
./bin/cognibrain.mjs config vscode
```

Generated MCP configs call the packaged CLI with `--runtime-root <project>`, so an npm-installed package stores memory in the target project instead of inside `node_modules`.

## Generic Hook Contract

The repo already includes `HarnessMemoryHook`:

- `beforeLlmCall(context)` retrieves relevant memories and returns `memoryContext`.
- `afterLlmCall(context, response)` stores an episodic outcome memory.

See `src/connectors/harnessHook.ts`.

## MCP Server

The repo now includes a stdio MCP server:

```bash
./bin/cognibrain.mjs mcp
```

Tools:

- `memory_add`
- `memory_search`
- `memory_context_pack`
- `memory_list`
- `memory_reflect`
- `memory_dream`
- `memory_health`
- `memory_maintenance_status`

Prompt:

- `memory_usage_policy`

Use stdio MCP for local harnesses first. Add Streamable HTTP later when remote/multi-user deployments need it.

Recommended client policy:

- call `memory_search` before multi-step work, repo archaeology, debugging loops, or user-preference-sensitive edits,
- call `memory_context_pack` when the retrieved result set needs to fit into a small prompt budget,
- call `memory_add` only for durable facts, user corrections, stable repo conventions, benchmark evidence, or verified integration discoveries,
- call `memory_maintenance_status` to inspect automatic dream policy and counters,
- call `memory_dream` before handoff, release, imports, contradiction cleanup, or scheduled maintenance windows,
- never store secrets, credentials, private keys, or raw sensitive transcripts without an explicit connector policy.

Connector quality bar:

- every stored memory must include provenance,
- every generated instruction file should be reproducible from stored memories,
- every dynamic retrieval path should have an off switch,
- every connector should support project-only scope before team or global scope.

## Claude Code

Best available surface:

- project or user settings hooks,
- MCP tools,
- plugins and Skills.

Claude Code hooks are configured in settings files such as `~/.claude/settings.json`, `.claude/settings.json`, and `.claude/settings.local.json`. Hooks are organized by event names and matchers, and command hooks can run local memory commands. A practical connector can use:

- `UserPromptSubmit` or equivalent prompt hook to retrieve memories,
- `PostToolUse` to record successful tool outcomes,
- `Notification` or review hooks to surface reflection conflicts,
- MCP server tools for `memory_search`, `memory_add`, and `memory_reflect`.

Enhancement path:

1. Use `./bin/cognibrain.mjs mcp` as a local stdio MCP server.
2. Add a Claude plugin containing hooks plus a Skill that documents memory usage.
3. Store per-project policy in `.claude/settings.json`.
4. Start from `templates/claude/settings.json` for shell-hook experiments.
5. Add a generated Skill that teaches Claude when to retrieve, cite, and store memories.

Source: https://docs.anthropic.com/en/docs/claude-code/hooks

## GitHub Copilot

Best available surface:

- `.github/copilot-instructions.md`,
- `.github/instructions/*.instructions.md`,
- `AGENTS.md`,
- prompt files,
- MCP where available in the IDE.

GitHub documents repository-wide instructions, path-specific instructions, and agent instructions. Copilot can load `.github/copilot-instructions.md`, path-specific instruction files, and nearest `AGENTS.md` files for agent workflows.

Enhancement path:

1. Generate `.github/copilot-instructions.md` from high-trust project memories.
2. Generate path-specific `.github/instructions/*.instructions.md` from scoped memories.
3. Add an MCP bridge for dynamic retrieval in IDEs that support it.
4. Use accepted/rejected suggestions as feedback signals when available.
5. Start from `templates/copilot/copilot-instructions.md`.
6. Add a generator that writes scoped `.github/instructions/*.instructions.md` files from high-trust path-tagged memories.

Source: https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions

## OpenAI Codex

Best available surface:

- MCP servers,
- `AGENTS.md`,
- local wrapper scripts,
- Codex app/CLI configuration.

OpenAI documents MCP setup for Codex and editor workflows. A memory connector should expose a local MCP server, then document an `AGENTS.md` snippet instructing Codex to call memory search before long-running tasks and memory add after durable discoveries.

Enhancement path:

1. Use the stdio command `./bin/cognibrain.mjs mcp`.
2. Run `./bin/cognibrain.mjs skill install` to install the packaged Codex Skill into `~/.codex/skills/cognibrain`.
3. Use `./bin/cognibrain.mjs start` to start the backend and dashboard together.
4. Start from `templates/codex/AGENTS.md` for repo-local policy.
5. Add Streamable HTTP later for remote Codex environments.
6. Keep repo-local memory policy compact so Codex can use MCP without overloading the prompt.

Source: https://platform.openai.com/docs/docs-mcp

## Cursor

Best available surface:

- MCP,
- project rules,
- agent mode context.

Cursor documents MCP as a way to connect external tools and data sources. A connector should prioritize MCP tools plus a small project rules file that explains when the agent should call them.

Enhancement path:

1. Reuse the same MCP server used for Codex and Claude.
2. Provide a `.cursor/rules/open-memory.mdc` template or adapt `templates/cursor/open-memory.mdc`.
3. Add workspace-level enable/disable and privacy scope controls.
4. Start from `templates/cursor/open-memory.mdc`.
5. Add generated rule files per workspace when a project has strong local conventions.

## Feedback Signals

The highest-value connector enhancement is not another storage API. It is feedback ingestion:

- accepted edits become low-confidence procedural memories,
- rejected edits become high-value negative examples,
- failing tests become project-specific risk memories,
- user corrections become high-confidence preference or repo-convention memories,
- benchmark misses become evaluation memories tagged by dataset, metric, and failure mode.

Connectors should not store every turn. They should store small, verified, reusable facts with enough provenance to delete or audit later.

Source: https://docs.cursor.com/context/model-context-protocol

## Connector Enhancement Matrix

| Harness | Current repo surface | Best next enhancement | Verification |
| --- | --- | --- | --- |
| Claude Code | stdio MCP plus hook template | Package a Claude plugin with `UserPromptSubmit` retrieval, runtime auto-start, and `PostToolUse` feedback capture | Run a prompt-hook smoke test that proves retrieved memory appears in model context |
| GitHub Copilot | instruction templates plus MCP-compatible server | Generate `.github/copilot-instructions.md` and scoped `.github/instructions/*.instructions.md` from high-trust memories | Open the generated files and run an MCP tool-list check in a supported IDE |
| OpenAI Codex | stdio MCP plus `AGENTS.md` and Skill template | Install Skill, start backend/dashboard with one command, and generate compact project memory policy | `memory_maintenance_status` works and `memory_search` returns project memories |
| Cursor | stdio MCP plus project rule template | Generate `.cursor/rules/open-memory.mdc` from `templates/cursor/open-memory.mdc` and project/global MCP config examples | Cursor MCP tools list includes memory tools and a retrieval query returns bounded context |

The first implementation target should be instruction-file generation because it is low risk, reviewable in git, and works even when an IDE's dynamic MCP support is disabled.

## Connector Roadmap

Highest leverage next work:

1. Streamable HTTP MCP transport for remote/shared deployments.
2. Instruction-file generators for Copilot, Codex, Claude, and Cursor.
3. Feedback adapters that record accepted changes, rejected suggestions, failing tests, and user corrections.
4. Privacy policies per connector: personal, project, team, never-store.
