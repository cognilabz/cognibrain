# GitHub Connector

## Install

Set deployment credentials:

```bash
export MEMORY_GITHUB_REPO=owner/repo
export MEMORY_GITHUB_TOKEN=...
```

Then verify the built-in connector:

```bash
npm run verify:vendor-connectors
npm run verify:vendor-live
```

## Product Demo

1. A PR review requests a change.
2. The GitHub connector ingests the review comment with `sourceRef.url`.
3. The review correction becomes Engineering Memory.
4. The next patch receives the correction through a coding context pack.
5. Patch Evidence Trail links back to the PR comment.

Replay data: [`../../fixtures/connectors/github-review-demo.json`](../../fixtures/connectors/github-review-demo.json).

Run the hermetic product demo:

```bash
npm run demo:github-review
```

The demo uses the built-in `official-github` connector, stores the PR review comment with `sourceRef.url`, creates a `review_correction`, builds a Patch Evidence Trail with `npm test`, and writes `artifacts/demos/github-review.json`.

## Maturity

`vendor-smoke required`: hermetic GitHub REST driver proof exists. Tenant certification requires fresh credentials and a target PR or issue for dry-run writeback.

## Troubleshoot

- Keep writeback dry-run until the target issue or PR is approved.
- Inspect `/connectors/health`.
- Never store raw tokens in memory content.

Claim IDs: `CB-CLAIM-CONNECTORS`, `CB-CLAIM-CONNECTOR-MATURITY`.
