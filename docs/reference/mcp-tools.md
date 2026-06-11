# MCP Tools

Complete reference for the Model Context Protocol tools exposed by the Cognibrain MCP server.

## Server Configuration

The MCP server runs as a stdio process:

```bash
npx cognibrain mcp serve
```

Agent hosts connect to it through their MCP configuration (see [MCP Integration Guide](../guides/mcp-integration.md)).

## Tool Reference

### `cognibrain_context`

Retrieve a context pack of relevant memories for a task.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "task": {
      "type": "string",
      "description": "Description of the task to get context for"
    },
    "repo": {
      "type": "string",
      "description": "Repository identifier (owner/name)"
    },
    "tokenBudget": {
      "type": "number",
      "description": "Maximum tokens to return",
      "default": 1200
    }
  },
  "required": ["task"]
}
```

**Output:**

```json
{
  "context": "Relevant memories formatted as compact context...",
  "memoriesUsed": 5,
  "tokenCount": 890
}
```

---

### `cognibrain_coding_context`

Retrieve codebase-specific corrections and conventions.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "task": {
      "type": "string",
      "description": "Current coding task"
    },
    "files": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Files being edited"
    }
  },
  "required": ["task"]
}
```

**Output:**

```json
{
  "corrections": [
    { "content": "Use npm test, not pnpm test", "scope": "repo" }
  ],
  "conventions": [
    { "content": "All API routes require auth middleware", "scope": "repo" }
  ]
}
```

---

### `cognibrain_guard`

Check a planned action against known guards.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "description": "The action to check (command or file edit)"
    }
  },
  "required": ["action"]
}
```

**Output:**

```json
{
  "allowed": true,
  "warnings": [],
  "blockers": []
}
```

When blocked:

```json
{
  "allowed": false,
  "warnings": ["This file is auto-generated"],
  "blockers": ["Editing dist/ files is blocked by repo policy"]
}
```

---

### `cognibrain_memory_add`

Store a durable memory.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "content": {
      "type": "string",
      "description": "Memory content to store"
    },
    "scope": {
      "type": "string",
      "enum": ["repo", "user", "global", "task"],
      "default": "repo"
    }
  },
  "required": ["content"]
}
```

**Output:**

```json
{
  "id": "mem_abc123",
  "stored": true
}
```

---

### `cognibrain_correction`

Record a human correction as a memory.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "description": "The correction from the human operator"
    }
  },
  "required": ["text"]
}
```

---

### `cognibrain_patch_evidence`

Record files changed, commands run, and memories used.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "task": {
      "type": "string",
      "description": "Task that was completed"
    },
    "files": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Files that were modified"
    },
    "commands": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Commands that were executed"
    }
  },
  "required": ["task"]
}
```

**Output:**

```json
{
  "evidenceId": "ev_xyz789",
  "recorded": true
}
```

---

### `cognibrain_health`

Inspect system health and memory statistics.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {}
}
```

**Output:**

```json
{
  "status": "healthy",
  "memoryCount": 42,
  "staleCandidates": 2,
  "lastDreamCycle": "2026-06-10T08:00:00Z"
}
```

---

### `cognibrain_outcome`

Record the result of a command execution.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "command": {
      "type": "string",
      "description": "Command that was run"
    },
    "exitCode": {
      "type": "number",
      "description": "Exit code (0 = success)"
    },
    "stderr": {
      "type": "string",
      "description": "Standard error output (on failure)"
    }
  },
  "required": ["command", "exitCode"]
}
```

---

### `cognibrain_session_end`

Signal the end of the current agent session.

**Input Schema:**

```json
{
  "type": "object",
  "properties": {
    "runDreamIfDue": {
      "type": "boolean",
      "description": "Trigger dream cycle if enough time has passed",
      "default": false
    }
  }
}
```

## Tool Categories

| Category | Tools | Purpose |
|----------|-------|---------|
| **Pre-action** | `context`, `coding_context`, `guard` | Get context and check safety before acting |
| **Post-action** | `outcome`, `patch_evidence`, `correction` | Record what happened |
| **Management** | `memory_add`, `health`, `session_end` | Store memories and manage lifecycle |
