# Install And Setup

Cognibrain runs as a local/self-hosted API with a stable operator CLI. The browser Operator UI is optional and separately licensed.

## Requirements

- Node.js 20 or newer
- npm
- Python 3 only if you use or test the Python SDK
- Postgres only for Postgres-backed deployments; local development can use the default local runtime

## Install From npm

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --profile solo-dev --yes
npx cognibrain doctor --fix
npx cognibrain status
```

Useful profiles:

| Profile | Use |
| --- | --- |
| `solo-dev` | Local coding-agent memory on one machine. |
| `team` | Shared team setup with explicit connector and service configuration. |
| `enterprise` | Stricter auth, service and storage planning. |
| `benchmark` | Reproducible benchmark and proof workflows. |

## Install From Checkout

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
./bin/cognibrain.mjs init --profile solo-dev --yes
./bin/cognibrain.mjs doctor --fix
```

## Start And Stop

```bash
npx cognibrain start
npx cognibrain status
npx cognibrain stop
```

The commercial Operator UI starts only when requested and only from a checkout
or deployment that includes the licensed `operator-ui/` add-on:

```bash
npx cognibrain dashboard
```

## Service Install

For a machine that should restart Cognibrain automatically:

```bash
npx cognibrain service plan
npx cognibrain service install --activate
npx cognibrain service status
```

For a self-hosted package smoke:

```bash
npm run verify:selfhosted
```

## Configuration

Runtime state lives under `.cognibrain/` by default, or under `COGNIBRAIN_RUNTIME_ROOT` when set.

Common environment variables:

| Variable | Purpose |
| --- | --- |
| `MEMORY_API_KEY` | API key expected by the local API. |
| `MEMORY_DB_URL` or `MEMORY_POSTGRES_URL` | Postgres connection string for DB-backed deployments. |
| `MEMORY_POLICY_MODE` | Use `production` for default-deny policy behavior. |
| `MEMORY_OIDC_ISSUER` | Optional JWT/OIDC issuer. |
| `MEMORY_OIDC_AUDIENCE` | Optional JWT/OIDC audience. |

Secrets should be stored in the environment, a secret manager or the runtime-local connector config file used by the Operator UI. Do not commit connector secrets or copy them into docs, issues or support bundles.
