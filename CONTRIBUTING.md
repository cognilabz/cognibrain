# Contributing

Thanks for helping improve cognibrain. The project values changes that make memory behavior more accurate, auditable, and easy for real users to understand.

## Local Setup

```bash
npm install
npm run verify
```

Start the local API and dashboard:

```bash
./bin/cognibrain.mjs start
```

For foreground development, run the two services separately:

```bash
npm run dev
npm run dashboard
```

## Development Rules

- Keep memory claims evidence-backed.
- Add or update tests for retrieval, lifecycle, connector, or benchmark behavior changes.
- Do not weaken benchmark gates to make a change pass.
- Keep docs readable for non-developers when behavior changes user expectations.
- Do not store secrets or real sensitive transcripts in fixtures, docs, screenshots, or examples.

## Before Submitting

```bash
npm run test
npm run eval
npm run build
```

For benchmark changes, run the affected command:

```bash
npm run benchmark:locomo -- --top-k 20
npm run benchmark:longmemeval -- --top-k 20
npm run benchmark:beam -- --split 100K --top-k 20
npm run benchmark:beam:500k
npm run benchmark:arena
npm run audit:docs
```

Update benchmark docs only from generated artifacts.

## Pull Request Checklist

- Tests pass.
- Docs explain any user-visible behavior change.
- New memories, summaries, or benchmark claims include provenance.
- Connector changes have an opt-out or clear local scope.
- CLI screenshots are refreshed with `npm run docs:cli-screenshots` when terminal UI changes.
- Dashboard screenshots are refreshed when the optional dashboard changes.
