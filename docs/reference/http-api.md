# HTTP API

The HTTP API is the unified backend that powers the CLI, MCP server, and SDKs. It provides RESTful endpoints for all memory operations, search, connectors, governance, and system management.

## Base URL

```
http://localhost:8787
```

The default port is `8787`. Override with `COGNIBRAIN_PORT` or `--port` on `cognibrain start`.

## Authentication

=== "API Key"

    ```bash
    curl -H "X-API-Key: your-key" http://localhost:8787/api/memories
    ```

=== "Bearer Token"

    ```bash
    curl -H "Authorization: Bearer your-jwt" http://localhost:8787/api/memories
    ```

=== "No Auth (local dev)"

    ```bash
    curl http://localhost:8787/api/memories
    ```

!!! note
    Local `solo-dev` profile doesn't require authentication. Production deployments should always configure auth.

## OpenAPI Specification

The full OpenAPI spec is available at runtime:

```bash
curl http://localhost:8787/openapi.json
```

Use this for generating clients, testing with Swagger UI, or integration validation.

## Core Endpoints

### Memories

#### List Memories

```http
GET /api/memories
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `scope` | string | Filter by scope (`repo`, `user`, `global`, `task`) |
| `status` | string | Filter by status (`active`, `stale`, `review`) |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "memories": [
    {
      "id": "mem_abc123",
      "content": "Always run npm test before release",
      "scope": "repo",
      "status": "active",
      "createdAt": "2026-06-01T10:00:00Z",
      "lastRecalledAt": "2026-06-10T14:30:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

#### Create Memory

```http
POST /api/memories
```

**Request body:**

```json
{
  "content": "This repo uses npm test before release",
  "scope": "repo"
}
```

**Response:**

```json
{
  "id": "mem_abc123",
  "content": "This repo uses npm test before release",
  "scope": "repo",
  "status": "active",
  "createdAt": "2026-06-11T12:00:00Z"
}
```

#### Get Memory

```http
GET /api/memories/:id
```

#### Update Memory

```http
PATCH /api/memories/:id
```

#### Archive Memory

```http
DELETE /api/memories/:id
```

### Context & Retrieval

#### Get Context Pack

```http
POST /api/context
```

**Request body:**

```json
{
  "task": "prepare the release patch",
  "repo": "cognilabz/cognibrain",
  "tokenBudget": 1200
}
```

**Response:**

```json
{
  "context": "Relevant memories for this task...",
  "memoriesUsed": 5,
  "tokenCount": 890
}
```

#### Get Coding Context

```http
POST /api/coding-context
```

**Request body:**

```json
{
  "task": "fix auth refresh",
  "files": ["src/auth.ts"]
}
```

### Action Guards

#### Check Guard

```http
POST /api/guard
```

**Request body:**

```json
{
  "action": "edit src/api/server.ts"
}
```

**Response:**

```json
{
  "allowed": true,
  "warnings": [],
  "blockers": []
}
```

### Evidence

#### Record Outcome

```http
POST /api/outcome
```

**Request body:**

```json
{
  "command": "npm test",
  "exitCode": 0
}
```

#### Record Patch Evidence

```http
POST /api/patch-evidence
```

**Request body:**

```json
{
  "task": "release patch",
  "files": ["package.json"],
  "commands": ["npm test"]
}
```

**Response:**

```json
{
  "evidenceId": "ev_xyz789",
  "task": "release patch",
  "files": ["package.json"],
  "commands": ["npm test"],
  "memoriesUsed": ["mem_abc123"]
}
```

#### Get Evidence Pack

```http
POST /api/evidence-pack
```

### Connectors

#### List Connectors

```http
GET /api/connectors
```

#### Add Connector

```http
POST /api/connectors
```

#### Connector Health

```http
GET /api/connectors/:id/health
```

### System

#### Health Check

```http
GET /api/health
```

**Response:**

```json
{
  "status": "healthy",
  "memoryCount": 42,
  "uptime": 86400,
  "version": "0.1.0"
}
```

#### Dream Cycle

```http
POST /api/dream-cycle
```

#### Conflicts

```http
GET /api/conflicts
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "MEMORY_NOT_FOUND",
    "message": "Memory with ID mem_xyz does not exist",
    "status": 404
  }
}
```

Common error codes:

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid credentials |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `MEMORY_NOT_FOUND` | 404 | Memory ID doesn't exist |
| `VALIDATION_ERROR` | 422 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

Default rate limits for the local daemon:

| Endpoint | Limit |
|----------|-------|
| Read operations | 1000/min |
| Write operations | 100/min |
| Context/search | 200/min |

Production deployments can configure custom limits via environment variables.
