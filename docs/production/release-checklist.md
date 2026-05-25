# Release Checklist

Run:

```bash
npm run release:check
```

The command runs unit tests, build, status verification, CogniCodeBench, plan audits, Postgres verification, connector compatibility, publish doctor, package dry-run and Python SDK tests. It writes `artifacts/release-check.json`.

## Manual Review

- README links to status, claims, production readiness and CogniCodeBench.
- Marketing claims map to claim IDs.
- Managed SaaS language remains future/deployment-specific.
- Vendor connector claims mention fresh credential smoke requirements.
- GitHub issues for plan gaps are linked from the PR.

Claim ID: `CB-CLAIM-RELEASE`.
