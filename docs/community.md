# Community And Adoption

## What Exists Now

- Marketplace submissions have a local lifecycle: `marketplace-submit` -> `marketplace-scan` -> `marketplace-review` -> `marketplace-publish` -> `marketplace-install`.
- Published modules carry security scan status, publisher/source metadata, rating averages, review counts, and install counts as trust signals.
- Public leaderboard publication is generated from `artifacts/leaderboard.json` into `public/leaderboard/leaderboard.json` plus a static `index.html`; anonymization and comparable-methodology checks are enforced before writing.
- Community operating templates below are repo-owned and ready for issues, release notes, and scheduled review queues.

## Planned External Channels

- Public Slack/Discord, webinars, office hours, hackathons, and bounty sponsorships still require external accounts and calendar ownership.
- Until those channels exist, GitHub issues, discussions, generated leaderboard artifacts, and release notes are the canonical community surfaces.

## Contribution Surfaces

- Connector contributions should include a manifest, privacy defaults, metadata mapping, and a local sync smoke. Use `.github/ISSUE_TEMPLATE/connector.yml`.
- Domain modules should include aliases, enrichment behavior, retrieval weights, privacy expectations, and at least one evaluation fixture. Use `.github/ISSUE_TEMPLATE/domain-module.yml`.
- Benchmark contributions should include anonymized fixtures, metric definition, and a leaderboard artifact. Use `.github/ISSUE_TEMPLATE/benchmark.yml`.
- Bounties should reference one GitHub issue, an acceptance test, and expected artifact output. Bounty issues should avoid broad "make memory better" wording and point to a runnable proof command.

## Marketplace Review Commands

```bash
./bin/cognibrain.mjs memory marketplace-submit dahuby '{"id":"persona-reviewer","kind":"persona","name":"Reviewer","version":"1.0.0","description":"Review defaults","manifest":{"id":"reviewer","label":"Reviewer","summaryStyle":"concise"}}' https://github.com/cognilabz/cognibrain/pull/1
./bin/cognibrain.mjs memory marketplace-scan submission_id
./bin/cognibrain.mjs memory marketplace-review submission_id operator 5 "Manifest, security scan and docs are complete."
./bin/cognibrain.mjs memory marketplace-publish submission_id
./bin/cognibrain.mjs memory marketplace-rate persona-reviewer user 5 "Installed cleanly."
```

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
