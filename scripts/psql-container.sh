#!/usr/bin/env bash
set -euo pipefail

container_name="${MEMORY_POSTGRES_CONTAINER_NAME:-cognibrain-planv1-postgres}"
exec container exec -i "$container_name" psql "$@"
