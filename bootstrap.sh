#!/usr/bin/env bash
set -euo pipefail

echo "=== Open Memory Harness Bootstrap ==="

command -v npm >/dev/null 2>&1 || { echo "Error: npm is required"; exit 1; }

INSTALL_CODEX_SKILL=0
START_LOCAL=0
RUN_VERIFY=1
SELF_HOSTED=0

for arg in "$@"; do
  case "$arg" in
    --self-hosted)
      SELF_HOSTED=1
      INSTALL_CODEX_SKILL=1
      START_LOCAL=1
      ;;
    --all)
      INSTALL_CODEX_SKILL=1
      START_LOCAL=1
      ;;
    --install-codex-skill)
      INSTALL_CODEX_SKILL=1
      ;;
    --start)
      START_LOCAL=1
      ;;
    --no-verify)
      RUN_VERIFY=0
      ;;
    --help|-h)
      echo "Usage: ./bootstrap.sh [--self-hosted] [--all] [--install-codex-skill] [--start] [--no-verify]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./bootstrap.sh [--self-hosted] [--all] [--install-codex-skill] [--start] [--no-verify]"
      exit 1
      ;;
  esac
done

npm install

if [[ "$RUN_VERIFY" == "1" ]]; then
  npm run verify
fi

if [[ "$INSTALL_CODEX_SKILL" == "1" ]]; then
  node bin/cognibrain.mjs skill install
fi

if [[ "$START_LOCAL" == "1" ]]; then
  if [[ "$SELF_HOSTED" == "1" ]]; then
    node bin/cognibrain.mjs setup --self-hosted --no-skill
  else
    node bin/cognibrain.mjs start
  fi
fi

echo ""
echo "Bootstrap complete."
echo "Self-hosted: ./bootstrap.sh --self-hosted"
echo "One command: ./bootstrap.sh --all"
echo "Status:      ./bin/cognibrain.mjs status"
echo "Stop:        ./bin/cognibrain.mjs stop"
