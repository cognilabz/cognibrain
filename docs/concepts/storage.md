# Storage & Persistence

Cognibrain supports multiple storage backends, from zero-config local files to production-grade PostgreSQL.

## Storage Backends

### Local JSON

The default for `solo-dev` profile. Zero configuration required.

```bash
npx cognibrain init --yes  # Uses local-json by default
```

- **Location**: `.cognibrain/memories.json`
- **Best for**: Solo developers, quick experiments, local agent memory
- **Limitations**: Single process only, no concurrent access, not suitable for teams

### SQLite

Local durable storage in a single file.

```bash
npx cognibrain connections add storage-sqlite
```

- **Location**: `.cognibrain/cognibrain.db`
- **Best for**: Single-machine deployments needing durability and query capabilities
- **Limitations**: Single-writer at a time, not suitable for multi-node

### PostgreSQL

Full relational database for team and production deployments.

```bash
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
```

- **Connection**: Via `MEMORY_DB_URL` or `MEMORY_POSTGRES_URL`
- **Best for**: Team deployments, production, multi-node access
- **Features**: Full ACID, concurrent access, backup/restore, replication

## Data Model

### Memory Item

Every memory stored in Cognibrain has this structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `mem_abc123`) |
| `content` | string | The memory text |
| `scope` | enum | `repo`, `user`, `global`, `task` |
| `status` | enum | `active`, `stale`, `review`, `archived` |
| `source` | string | How this memory was created |
| `authority` | number | Ranking weight (corrections > auto-ingested) |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last modification |
| `lastRecalledAt` | timestamp | Last time included in a context pack |
| `recallCount` | number | Total times recalled |
| `metadata` | object | Additional structured data |

### Memory Relationships

Memories can have directed relationships:

```mermaid
graph LR
    A[Memory A] -->|supersedes| B[Memory B]
    A -->|contradicts| C[Memory C]
    D[Memory D] -->|relates-to| A
```

| Relationship | Meaning |
|-------------|---------|
| `supersedes` | This memory replaces an older one |
| `contradicts` | These memories conflict (needs resolution) |
| `relates-to` | These memories are topically related |

### Evidence Record

Patch evidence is stored alongside memories:

| Field | Type | Description |
|-------|------|-------------|
| `evidenceId` | string | Unique identifier |
| `task` | string | Task description |
| `files` | string[] | Files changed |
| `commands` | string[] | Commands executed |
| `memoriesUsed` | string[] | Memory IDs that were recalled |
| `createdAt` | timestamp | When the evidence was recorded |

## Retrieval & Ranking

When a context pack is requested, the retrieval engine:

1. **Filters** by scope (repo, user, global) and status (active only)
2. **Scores** relevance against the task description
3. **Ranks** by composite score: relevance × authority × freshness
4. **Fills** the token budget with highest-ranked items
5. **Formats** into a compact context string

```mermaid
graph LR
    A[All Active Memories] --> B[Scope Filter]
    B --> C[Relevance Scoring]
    C --> D[Authority Weighting]
    D --> E[Token Budget Fill]
    E --> F[Context Pack]
```

### Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Relevance | High | Semantic similarity to task description |
| Authority | Medium | Source credibility (operator > agent > auto) |
| Freshness | Low | Recency of creation or last recall |
| Recall frequency | Low | How often this memory has been useful |

## Backup & Migration

### Local → SQLite

```bash
npx cognibrain connections add storage-sqlite
npx cognibrain service restart
```

### SQLite → PostgreSQL

```bash
export MEMORY_POSTGRES_URL="postgresql://user:pass@host:5432/cognibrain"
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
npx cognibrain service restart
```

### Backup

```bash
# Local JSON — just copy the file
cp .cognibrain/memories.json backup/

# SQLite
sqlite3 .cognibrain/cognibrain.db ".backup backup/cognibrain.db"

# PostgreSQL
pg_dump $MEMORY_POSTGRES_URL > backup/cognibrain.sql
```

## Storage Verification

Verify storage health for your deployment:

```bash
npx cognibrain doctor --fix
npx cognibrain connections doctor
```

For PostgreSQL specifically:

```bash
npm run internal -- verify:postgres
```
