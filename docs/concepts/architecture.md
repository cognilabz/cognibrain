# Architecture

Cognibrain is designed as a local-first, self-hosted system with clear boundaries between its open-source core and optional commercial surface.

## System Overview

```mermaid
graph TB
    subgraph "Agent Hosts"
        Codex[OpenAI Codex]
        Cursor[Cursor]
        Custom[Custom Agents]
        CI[CI/CD Runners]
    end

    subgraph "Integration Layer"
        MCP[MCP Server<br/>stdio protocol]
        HarnessCLI[Harness CLI<br/>JSON lifecycle]
        SDK[SDK / HTTP Client]
    end

    subgraph "Cognibrain Core"
        API[HTTP API Server]
        MemEngine[Memory Engine]
        Retrieval[Retrieval & Ranking]
        Graph[Memory Graph]
        Policy[Policy Engine]
        Guards[Action Guards]
        Dream[Dream Cycle Engine]
    end

    subgraph "Storage Layer"
        LocalJSON[(Local JSON)]
        SQLite[(SQLite)]
        Postgres[(PostgreSQL)]
    end

    subgraph "Connectors"
        GH[GitHub]
        Jira[Jira]
        Slack[Slack]
        More[16+ others]
    end

    subgraph "Optional Commercial"
        OpUI[Operator UI<br/>Next.js Dashboard]
    end

    Codex --> MCP
    Cursor --> MCP
    Custom --> HarnessCLI
    CI --> HarnessCLI
    SDK --> API

    MCP --> API
    HarnessCLI --> API

    API --> MemEngine
    API --> Guards
    API --> Dream
    MemEngine --> Retrieval
    MemEngine --> Graph
    MemEngine --> Policy
    MemEngine --> LocalJSON
    MemEngine --> SQLite
    MemEngine --> Postgres

    API --> GH
    API --> Jira
    API --> Slack
    API --> More

    OpUI --> API
```

## Component Boundaries

### Integration Layer

The integration layer adapts different client protocols to the unified HTTP API:

| Component | Protocol | Consumers |
|-----------|----------|-----------|
| MCP Server | stdio (Model Context Protocol) | Codex, Cursor, MCP-native agents |
| Harness CLI | Shell process + JSON stdout | Any shell-capable agent, git hooks, CI |
| SDK/HTTP | REST over HTTP | Product integrations, dashboards, custom runtimes |

All three surfaces are stateless proxies — they translate requests into API calls and format responses for their protocol.

### Memory Engine

The core memory engine handles:

- **Storage**: CRUD operations on memory items
- **Retrieval**: Relevance-ranked context retrieval within token budgets
- **Graph**: Relationships between memories (supersedes, contradicts, relates-to)
- **Policy**: Scoping rules, access control, and governance
- **Guards**: Pre-action safety checks against stored knowledge

### Storage Layer

Pluggable storage backends:

| Backend | Use Case | Characteristics |
|---------|----------|-----------------|
| Local JSON | Solo development | Zero-config, file-based, fast startup |
| SQLite | Local durable | Single-file database, good for single-machine |
| PostgreSQL | Team/production | Full ACID, concurrent access, scalable |

### Dream Cycle Engine

Runs asynchronously to maintain memory health:

- Staleness detection
- Contradiction identification
- Summary consolidation
- Operator review queue management

### Connector System

Bidirectional integration with external systems:

- **Ingest**: Pull events from external systems → create memories
- **Emit**: Push memory-linked context back to external systems
- **Sync**: Bidirectional state synchronization

## Data Flow

### Agent Lifecycle Flow

```mermaid
sequenceDiagram
    participant Agent
    participant API as HTTP API
    participant Engine as Memory Engine
    participant Store as Storage

    Agent->>API: POST /api/context
    API->>Engine: getContextPack(task, budget)
    Engine->>Store: query relevant memories
    Store-->>Engine: ranked memories
    Engine-->>API: context pack
    API-->>Agent: {context, memoriesUsed, tokenCount}

    Agent->>API: POST /api/guard
    API->>Engine: checkGuard(action)
    Engine->>Store: query guards & blockers
    Store-->>Engine: matching guards
    Engine-->>API: guard result
    API-->>Agent: {allowed, warnings, blockers}

    Agent->>API: POST /api/outcome
    API->>Engine: recordOutcome(command, exitCode)
    Engine->>Store: persist outcome
    API-->>Agent: {recorded: true}
```

### Connector Ingest Flow

```mermaid
sequenceDiagram
    participant Ext as External System
    participant Conn as Connector Driver
    participant API as HTTP API
    participant Engine as Memory Engine

    Ext->>Conn: Event (webhook/poll)
    Conn->>Conn: Normalize to memory fields
    Conn->>API: POST /api/memories
    API->>Engine: store(normalizedMemory)
    Engine-->>API: {id, stored: true}
```

## Design Principles

1. **Local-first**: Works fully offline on a single machine with no external dependencies
2. **Text-first**: CLI output is readable in small terminals, CI logs, and remote shells
3. **Daemon-optional**: Direct local access available for simple setups; daemon for production
4. **Surface-agnostic**: Same memory engine regardless of how you connect
5. **Evidence-backed**: Claims and benchmarks require artifact proof
6. **Operator-in-the-loop**: Automated maintenance surfaces items for human review, never auto-deletes
