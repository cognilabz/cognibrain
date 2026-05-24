# Community And Adoption

## Contribution Surfaces

- Connector contributions should include a manifest, privacy defaults, metadata mapping, and a local sync smoke. Use `.github/ISSUE_TEMPLATE/connector.yml`.
- Domain modules should include aliases, enrichment behavior, retrieval weights, privacy expectations, and at least one evaluation fixture. Use `.github/ISSUE_TEMPLATE/domain-module.yml`.
- Benchmark contributions should include anonymized fixtures, metric definition, and a leaderboard artifact. Use `.github/ISSUE_TEMPLATE/benchmark.yml`.
- Bounties should reference one GitHub issue, an acceptance test, and expected artifact output. Bounty issues should avoid broad "make memory better" wording and point to a runnable proof command.

## Recognition

Release notes should call out merged connectors, domain modules, benchmark fixtures, and documentation improvements with contributor handles when available.

## Office Hours

Use the `benchmark`, `connector`, `domain-module`, and `docs` labels to group weekly review queues. Public claims should link to generated artifacts rather than screenshots or prose-only statements.

## First Contribution Paths

- Run [one-click local setup](tutorials/one-click-local.md), then open a docs issue with any broken command.
- Add a connector with [connector authoring](tutorials/connector-authoring.md), then attach sync output to the connector issue template.
- Validate graph, temporal, and pattern behaviour with [graph/time/pattern tutorial](tutorials/graph-temporal-patterns.md).
- Validate privacy defaults with [privacy and retention tutorial](tutorials/privacy-retention.md).
- Package domain behaviour with [domain module tutorial](tutorials/domain-module.md).
