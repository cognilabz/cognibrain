# Connectors

cognibrain is CLI-first and MCP-compatible.

The CLI is the human and automation surface: install, start, stop, status, health checks, memory commands, and CI-friendly scripting. MCP is the agent tool surface: let compatible harnesses retrieve, write, and inspect memory without shell parsing.

```bash
./bin/cognibrain.mjs setup --all-harnesses
npx cognibrain-connect claude-code
npx cognibrain-connect all --no-start
./bin/cognibrain.mjs status
./bin/cognibrain.mjs memory search "project conventions"
./bin/cognibrain.mjs memory connectors
./bin/cognibrain.mjs mcp
```

This mirrors the current AI-tooling direction: make the install path a small memorable command, then let each harness opt into deeper integration.
`cognibrain-connect` is the npm-bin surface for that path. It accepts `codex`, `claude-code`, `cursor`, `github-copilot`, `vscode`, or `all`, delegates to the same setup engine, writes `.cognibrain-harness-package.json`, and prints a `doctor --publish` health command after installation.

Harness config commands:

```bash
./bin/cognibrain.mjs config codex
./bin/cognibrain.mjs config claude
./bin/cognibrain.mjs config copilot
./bin/cognibrain.mjs config cursor
./bin/cognibrain.mjs config vscode
```

Generated harness packages call the packaged CLI with `--runtime-root <project>`, so an npm-installed package stores memory in the target project instead of inside `node_modules`. `setup --all-harnesses` writes:

- Codex: `~/.codex/config.toml`, `~/.codex/skills/cognibrain/SKILL.md`, and project `AGENTS.md`.
- Claude Code: project `.mcp.json` and `.claude/settings.json` hooks.
- GitHub Copilot: `.github/copilot-instructions.md` and `.github/instructions/cognibrain.instructions.md`.
- Cursor: `.cursor/mcp.json` and `.cursor/rules/open-memory.mdc`.
- Review manifest: `.cognibrain-harness-package.json` with feedback adapters and generated paths.

Existing non-cognibrain instruction files are not overwritten; a `.cognibrain` sidecar is written for review.

Install, update, uninstall:

```bash
./bin/cognibrain.mjs setup --all-harnesses
./bin/cognibrain.mjs setup --all-harnesses --no-start
./bin/cognibrain.mjs doctor --publish
rm -f AGENTS.md.cognibrain .github/copilot-instructions.md.cognibrain .github/instructions/cognibrain.instructions.md .claude/settings.json.cognibrain .cursor/rules/open-memory.mdc.cognibrain .cognibrain-harness-package.json
```

## Official Connector Manifests

The runtime seeds official manifests for common work systems:

- `official-email`
- `official-chat`
- `official-project_management`
- `official-docs`
- `official-code`
- `official-calendar`
- `official-cloud_storage`

Each manifest declares connector kind, version, direction (`ingest`, `export`, or `two_way`), auth style, capabilities (`ingest`, `export`, `webhook`, `poll`, `writeback`, `media`, `translation`), default source kind, metadata mapping, privacy policy, optional list/poll endpoints, and optional writeback configuration. Custom manifests can be registered through the CLI or HTTP API:

```bash
./bin/cognibrain.mjs memory connector-register '{"id":"support-chat","name":"Support Chat","kind":"chat","version":"1.0.0","direction":"two_way","capabilities":["ingest","webhook","writeback"],"auth":"token","defaultSourceKind":"transcript","metadataMapping":{"channel":"metadata.channel","messageId":"externalId"}}'
./bin/cognibrain.mjs memory connector-health support-chat
./bin/cognibrain.mjs memory connector-list support-chat
./bin/cognibrain.mjs memory connector-poll support-chat
./bin/cognibrain.mjs memory connector-sync support-chat "Support confirmed the release note owner."
MEMORY_CONNECTOR_OPERATION=summary MEMORY_EXTERNAL_ID=thread-1 MEMORY_CONNECTOR_TARGET_JSON='{"channel":"support","threadId":"thread-1"}' ./bin/cognibrain.mjs memory connector-writeback support-chat "Release note owner confirmed."
MEMORY_MEMORY_IDS=mem_123 MEMORY_EXTERNAL_ID=thread-1 ./bin/cognibrain.mjs memory connector-feedback support-chat accepted_change "Accepted connector suggestion."
./bin/cognibrain.mjs memory connector-sync-records support-chat
```

Connector sync records preserve external ids, applied memory ids, timestamps, export payloads, HTTP request plans, status codes, and failure text. Invalid manifests are rejected before they can write memory, for example writeback on an ingest-only connector.

OAuth connectors can declare an `oauth` block. The runtime then manages a stateful local OAuth lifecycle without storing plaintext tokens:

```bash
./bin/cognibrain.mjs memory connector-auth-begin support-docs
./bin/cognibrain.mjs memory connector-auth-callback support-docs <state> <code-or-token-ref>
./bin/cognibrain.mjs memory connector-auth support-docs
```

`connector-auth-begin` emits an authorization URL with state, redirect URI and scopes. `connector-auth-callback` stores only a token reference plus hash, then attaches that `authRef` to list/poll/writeback blocks that need it.

List/poll-capable manifests can include endpoint blocks. `connector-list` returns external items without writing memory. `connector-poll` expects a JSON body with `events`, then routes those events through the same add-only extraction path as `connector-sync`. Set `privacyPolicy:"never_store"` for connectors that should prove polling without storing any event content. Writeback-capable manifests can include a `writeback` block with an endpoint, method, auth reference, and allowed operations. Without an endpoint, `connector-writeback` and `/connectors/writeback` create a queued dry-run plan for review. With an endpoint and `dryRun:false`, Cognibrain sends the source-specific payload as HTTP using `x-cognibrain-connector`, `x-cognibrain-operation`, and optional HMAC `x-cognibrain-signature` headers. `connector-feedback` and `/connectors/feedback` convert accepted changes, rejected suggestions, failing tests, and user corrections into trust/importance updates plus a durable feedback memory.

Native harness packages should prefer `connector-telemetry` or `POST /connectors/telemetry` over asking users to run manual feedback commands. The telemetry endpoint accepts `accepted_suggestion`, `rejected_suggestion`, `context_pack_feedback`, and `tool_outcome` events. Accepted/rejected suggestion events become connector feedback memories and update linked memory trust. Context-pack feedback creates retrieval training samples and learned profile updates. Tool outcomes become first-class harness action memories, so later retrieval can answer what command, test, or fix worked last time.

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

The repo now includes stdio and Streamable HTTP MCP transports:

```bash
./bin/cognibrain.mjs mcp
./bin/cognibrain.mjs mcp --http --port 8791
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

Use stdio MCP for local harnesses and Streamable HTTP MCP when a remote, browser, or shared client needs an HTTP session transport. Both transports expose the same memory tools and policy prompt; connector packages should choose the transport that matches the harness instead of changing memory behavior.

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
6. Use `./bin/cognibrain.mjs mcp --http` only where Claude-side remote MCP transport is available and policy allows it.

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
5. Use Streamable HTTP MCP for remote Codex environments that support HTTP MCP sessions.
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
| Claude Code | stdio MCP plus hook template | `setup --all-harnesses` writes `.mcp.json`, `.claude/settings.json`, runtime auto-start, and `PostToolUse` maintenance feedback | Generated settings contain the package path and MCP config |
| GitHub Copilot | instruction templates plus MCP-compatible server | `setup --all-harnesses` writes repository and scoped instruction files with feedback commands | Generated files match templates plus scoped feedback adapter |
| OpenAI Codex | stdio MCP plus `AGENTS.md` and Skill template | Installs Skill, starts backend/dashboard with one command, and generates compact project memory policy | `memory_maintenance_status` works and `memory_search` returns project memories |
| Cursor | stdio MCP plus project rule template | `setup --all-harnesses` writes `.cursor/mcp.json` and `.cursor/rules/open-memory.mdc` | Cursor MCP config and rule file are generated deterministically |

The implemented baseline is instruction-file generation plus MCP config because it is low risk, reviewable in git, and works even when an IDE's dynamic MCP support is disabled. The remaining product work is native telemetry from each IDE or harness: accepted/rejected suggestions, tool outcomes, and context-pack feedback without relying on users to run feedback commands manually.

## Connector Roadmap

Highest leverage next work:

1. Deepen packaged installers for Claude Code, Codex, Copilot, and Cursor with harness-native health checks and telemetry.
2. Add connector-specific writeback adapters for GitHub, Jira, Linear, Slack, Notion, Drive, Gmail and Calendar.
3. Add typed connector packages that collect accepted/rejected suggestion feedback automatically.
4. Add operator controls for connector consent, retention, and project-only scoping.
5. Publish per-connector examples that prove context-pack injection, feedback, and writeback end to end.

Webhook delivery is no longer only a placeholder queue. The HTTP API and CLI can drain queued deliveries through real outbound `POST` calls with delivery ids, event-type headers, optional HMAC signatures, status-code capture, and retry backoff. Keep connector-specific writeback separate from this generic webhook transport so source APIs can enforce their own auth, rate limits, and conflict handling.
