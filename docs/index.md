---
hide:
  - navigation
  - toc
---

# Cognibrain

**Self-hosted engineering memory for coding agents.**

Stop fixing the same agent mistake twice. Cognibrain stores durable engineering context — repo rules, reviewer corrections, failed commands, connector events, and patch evidence — then returns compact context before the next agent action.

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } __Getting Started__

    ---

    Install Cognibrain and have your first memory working in under 5 minutes.

    [:octicons-arrow-right-24: Quick Start](getting-started/quickstart.md)

-   :material-book-open-variant:{ .lg .middle } __Guides__

    ---

    Step-by-step walkthroughs for CLI, MCP, harness, connectors, and memory management.

    [:octicons-arrow-right-24: Explore Guides](guides/index.md)

-   :material-code-json:{ .lg .middle } __Reference__

    ---

    Complete API, SDK, CLI, and configuration reference documentation.

    [:octicons-arrow-right-24: API Reference](reference/index.md)

-   :material-server:{ .lg .middle } __Operations__

    ---

    Self-host, deploy with Docker, monitor health, and secure your instance.

    [:octicons-arrow-right-24: Operations Guide](operations/index.md)

</div>

## Install

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --yes
npx cognibrain status
```

## Why Cognibrain?

| Problem | Cognibrain Solution |
|---------|-------------------|
| Agents repeat the same mistakes | Durable corrections survive across sessions |
| Context is lost between runs | Memory retrieval returns relevant facts before each action |
| No audit trail for agent decisions | Patch evidence and proof registers track what happened |
| Scattered integration configs | Unified connector system with 19+ first-party integrations |
| No guardrails on agent actions | Action guards warn or block known-bad operations |
