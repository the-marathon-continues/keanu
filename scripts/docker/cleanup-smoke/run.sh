#!/usr/bin/env bash
set -euo pipefail

cd /repo

export KEANU_STATE_DIR="/tmp/openclaw-test"
export KEANU_CONFIG_PATH="${KEANU_STATE_DIR}/openclaw.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${KEANU_STATE_DIR}/credentials"
mkdir -p "${KEANU_STATE_DIR}/agents/main/sessions"
echo '{}' >"${KEANU_CONFIG_PATH}"
echo 'creds' >"${KEANU_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${KEANU_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm openclaw reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${KEANU_CONFIG_PATH}"
test ! -d "${KEANU_STATE_DIR}/credentials"
test ! -d "${KEANU_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${KEANU_STATE_DIR}/credentials"
echo '{}' >"${KEANU_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm openclaw uninstall --state --yes --non-interactive

test ! -d "${KEANU_STATE_DIR}"

echo "OK"
