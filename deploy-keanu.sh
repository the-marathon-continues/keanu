#!/usr/bin/env bash
# Deploy keanu: typecheck → test → lint → restart gateway.
# One command. No drama.

set -euo pipefail

cd "$(dirname "$0")"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[0;90m'
BOLD='\033[1m'
RESET='\033[0m'

step() { printf "${BOLD}▸ %s${RESET}\n" "$1"; }
pass() { printf "${GREEN}  ✓ %s${RESET}\n" "$1"; }
fail() { printf "${RED}  ✗ %s${RESET}\n" "$1"; exit 1; }

# 1. Typecheck
step "Typechecking"
if npx tsc --noEmit; then
  pass "Types clean"
else
  fail "Type errors — fix before deploying"
fi

# 2. Keanu tests
step "Running keanu tests"
if npx vitest run --config vitest.extensions.config.ts; then
  pass "Tests passing"
else
  fail "Tests failing — fix before deploying"
fi

# 3. Lint
step "Linting"
if pnpm check; then
  pass "Lint clean"
else
  fail "Lint errors — fix before deploying"
fi

# 4. Restart gateway
step "Restarting gateway"
PID=$(pgrep -f openclaw-gateway || true)
if [[ -z "$PID" ]]; then
  printf "${DIM}  gateway not running — skipping restart${RESET}\n"
else
  kill -USR1 "$PID"
  pass "Sent SIGUSR1 to gateway (PID $PID)"
fi

printf "\n${GREEN}${BOLD}Keanu deployed.${RESET}\n"
