# Connectors

cognibrain is CLI-first and MCP-compatible.

The CLI is the human and automation surface: install, start, stop, status, health checks, memory commands, and CI-friendly scripting. MCP is the agent tool surface: let compatible harnesses retrieve, write, and inspect memory without shell parsing.

```bash
./bin/cognibrain.mjs setup --all-harnesses
./bin/cognibrain.mjs status
./bin/cognibrain.mjs memory search "project conventions"
./bin/cognibrain.mjs memory connectors
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

## Official Connector Manifests

The runtime seeds official manifests for common work systems:

- `official-email`
- `official-chat`
- `official-project_management`
- `official-docs`
- `official-code`
- `official-calendar`
- `official-cloud_storage`

Each manifest declares connector kind, version, direction (`ingest`, `export`, or `two_way`), auth style, capabilities (`ingest`, `export`, `webhook`, `poll`, `writeback`, `media`, `translation`), default source kind, and metadata mapping. Custom manifests can be registered through the CLI or HTTP API:

```bash
./bin/cognibrain.mjs memory connector-register '{"id":"support-chat","name":"Support Chat","kind":"chat","version":"1.0.0","direction":"two_way","capabilities":["ingest","webhook","writeback"],"auth":"token","defaultSourceKind":"transcript","metadataMapping":{"channel":"metadata.channel","messageId":"externalId"}}'
./bin/cognibrain.mjs memory connector-sync support-chat "Support confirmed the release note owner."
MEMORY_CONNECTOR_OPERATION=summary MEMORY_EXTERNAL_ID=thread-1 MEMORY_CONNECTOR_TARGET_JSON='{"channel":"support","threadId":"thread-1"}' ./bin/cognibrain.mjs memory connector-writeback support-chat "Release note owner confirmed."
./bin/cognibrain.mjs memory connector-sync-records support-chat
```

Connector sync records preserve external ids, applied memory ids, timestamps, export payloads, HTTP request plans, status codes, and failure text. Invalid manifests are rejected before they can write memory, for example writeback on an ingest-only connector.

Writeback-capable manifests can include a `writeback` block with an endpoint, method, auth reference, and allowed operations. Without an endpoint, `connector-writeback` and `/connectors/writeback` create a queued dry-run plan for review. With an endpoint and `dryRun:false`, Cognibrain sends the source-specific payload as HTTP using `x-cognibrain-connector`, `x-cognibrain-operation`, and optional HMAC `x-cognibrain-signature` headers.

## Provider And Media Hooks

The JSON-command provider adapter supports `extract`, `translate`, `expand`, `rerank`, `verify`, `contradiction`, and `summarize` tasks with deterministic fallbacks. This keeps the one-click install local-first, while letting teams plug in OCR, ASR, vision, NLI, translation, or cross-encoder tools.

```bash
./bin/cognibrain.mjs memory provider-status
MEMORY_LANGUAGE=de ./bin/cognibrain.mjs memory translate "Speicher soll nicht fehler"
MEMORY_MEDIA_TYPE=audio MEMORY_LANGUAGE=de ./bin/cognibrain.mjs memory media-ingest "Speicher soll release notes erfassen."
```

Media events retain `mediaType`, `language`, `uri`, `mimeType`, translated content, and original content metadata so operators can audit how a non-text source became memory.

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
- every connector sync must preserve external ids and source metadata,
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
4. Source-specific writeback adapters for GitHub, Slack/Discord, docs, issue trackers, and calendar systems.
5. Privacy policies per connector: personal, project, team, never-store.

Webhook delivery is no longer only a placeholder queue. The HTTP API and CLI can drain queued deliveries through real outbound `POST` calls with delivery ids, event-type headers, optional HMAC signatures, status-code capture, and retry backoff. Keep connector-specific writeback separate from this generic webhook transport so source APIs can enforce their own auth, rate limits, and conflict handling.
