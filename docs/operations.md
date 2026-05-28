# Operations Guide

Cognibrain is designed to run as a self-hosted service controlled by the CLI. Docker is optional. The CLI is the required control plane.

## Runbook

```bash
cognibrain status
cognibrain doctor --fix
cognibrain service status
cognibrain proof
npm run release:check
```

## Runtime State

Local runtime data is written under `.cognibrain/` by default. Set `COGNIBRAIN_RUNTIME_ROOT` to move it.

Generated reports belong under `artifacts/`. `artifacts/` is ignored by git and excluded from the npm package.

## Service Management

```bash
cognibrain service plan
cognibrain service install --activate
cognibrain service logs
cognibrain service restart
cognibrain service uninstall --deactivate
```

Supported native managers:

| Platform | Manager |
| --- | --- |
| Linux | systemd user service by default; system service with `--system`. |
| macOS | launchd LaunchAgent by default; LaunchDaemon with `--system`. |
| Windows | Task Scheduler startup task. |

## Storage

| Mode | Use |
| --- | --- |
| Local/default | Fast local development and solo agent memory. |
| SQLite | Local durable row store. |
| Postgres | Team or production-like deployment. |

Postgres checks should be run against the target database:

```bash
npm run internal -- verify:postgres
```

Record the resulting artifact with the deployment evidence for that target.

## Security

Use API keys for local automation and JWT/OIDC where a deployment already has an identity provider. In strict policy mode, unmatched policy checks default-deny.

Recommended hosted posture:

- Set an API key or OIDC verifier.
- Run with DB-backed persistence.
- Keep connector tokens in environment variables, a secret manager or the runtime-local connector config file used by the Operator UI.
- Keep runtime evidence with the deployment change record.

## Docker And Deploy

Docker files and Kubernetes manifests are included as optional packaging under `docker/` and `deploy/`. They are not required for local usage.
