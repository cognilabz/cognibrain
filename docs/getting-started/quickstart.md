# Quick Start

Get Cognibrain running and store your first memory in under 5 minutes.

## 1. Install and Initialize

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --yes
```

You should see output confirming the `solo-dev` profile is active with local storage.

## 2. Check Status

```bash
npx cognibrain status
```

This shows runtime state, memory health, active connections, and suggested next actions.

## 3. Add Your First Memory

```bash
npx cognibrain memories add "This repo uses npm test before every release."
```

Memories are durable facts that agents can recall. They persist across sessions and restarts.

## 4. Retrieve Context for a Task

```bash
npx cognibrain memories coding-context "prepare the release patch"
```

Cognibrain returns a compact context pack with relevant memories for the given task — your release memory will appear here.

## 5. Guard an Action

```bash
npx cognibrain guard --action "edit src/api/server.ts" --json
```

The action guard checks if any memories warn against or constrain the planned action. JSON output makes it easy for agents to parse programmatically.

## 6. Record Patch Evidence

```bash
npx cognibrain patch-evidence --task "release patch" --json
```

After completing work, record what files changed, what commands ran, and what memories were relevant. This builds the audit trail.

## 7. Run Proof

```bash
npx cognibrain proof
```

The proof command summarizes the current evidence state — what's been recorded, what's verified, and what needs attention.

---

## Full Lifecycle Example

Here's a complete agent lifecycle in one flow:

```bash
# Before starting work
npx cognibrain context --task "fix auth token refresh" --json

# Before a risky operation
npx cognibrain guard --action "npm test" --json

# After the operation completes
npx cognibrain outcome --command "npm test" --exit-code 0 --json

# After completing the task
npx cognibrain patch-evidence --task "fix auth token refresh" --json

# End the session
npx cognibrain session-end --json
```

!!! tip "MCP-native agents"
    If your agent supports MCP (Model Context Protocol), you can use the MCP integration instead of CLI commands. See [MCP Integration](../guides/mcp-integration.md) for setup.

## What's Next?

<div class="grid cards" markdown>

-   :material-console:{ .lg .middle } __CLI Usage__

    ---

    Deep dive into all CLI commands and workflows.

    [:octicons-arrow-right-24: CLI Guide](../guides/cli-usage.md)

-   :material-connection:{ .lg .middle } __Connectors__

    ---

    Connect GitHub, Jira, Slack, and 16+ other systems.

    [:octicons-arrow-right-24: Connectors](../guides/connectors.md)

-   :material-brain:{ .lg .middle } __Memory Management__

    ---

    Learn how memories are stored, scoped, and maintained.

    [:octicons-arrow-right-24: Memory Management](../guides/memory-management.md)

-   :material-cog:{ .lg .middle } __Configuration__

    ---

    Environment variables, profiles, and runtime settings.

    [:octicons-arrow-right-24: Configuration](../reference/configuration.md)

</div>
