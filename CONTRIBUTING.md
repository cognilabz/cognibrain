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

## Agent Live Review Loop

For agent-operated changes that are intended to land:

- Verify locally before committing. If verification fails, stop and report the failed command plus a capped log tail unless the user explicitly asks for a failing checkpoint.
- Default to `main` only for low-risk, fully verified work. Use a branch or PR for migrations, auth/security changes, destructive data operations, large refactors, dependency upgrades, release automation, or work that cannot be fully verified locally.
- Never force-push or rewrite published `main`. For non-main branches, history rewrites require explicit user approval and must be called out as destructive.
- Before commit, confirm only intended files are staged, avoid generated artifacts/caches/logs unless required, and inspect staged changes for secrets, credentials, private keys, `.env` data, customer data, and accidental local artifacts.
- Before pushing to `main`, fetch and confirm the local branch is based on current `origin/main`; after any rebase or merge, rerun verification before pushing.
- Before push, record the commit SHA, changed files, verification commands, known risks, and CI status as `not observed`, `pending`, `passed`, or `failed`. After push, confirm the worktree is clean and fix any CI failures before treating the loop as complete.
- Ask the live review coworker to review the pushed commit or diff after each push, including the commit SHA, changed-files summary, verification results, CI status, and known risks.
- Implement actionable correctness, safety, and regression feedback, then verify, commit, push, and repeat. Defer preference-only scope expansion only with an explicit reason and ask the recheck to validate that deferral.
- Do not treat AI review as sufficient for security-sensitive, privacy-sensitive, licensing, payment, deployment, production-data, or release-critical changes; require explicit human approval before completion.
- Do not stop on the first approval. Ask one final recheck for the final commit SHA focused on missed improvements, stop-event mistakes, regressions, uncovered edge cases, and unsafe deferred feedback. Stop only after that final SHA-specific recheck returns no actionable improvements.

## Pull Request Checklist

- Tests pass.
- Docs explain any user-visible behavior change.
- New memories, summaries, or benchmark claims include provenance.
- Connector changes have an opt-out or clear local scope.
- CLI screenshots are refreshed with `npm run docs:cli-screenshots` when terminal UI changes.
- Dashboard screenshots are refreshed when the optional dashboard changes.
