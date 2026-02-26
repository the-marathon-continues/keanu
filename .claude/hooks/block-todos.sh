#!/bin/bash
# Block commits that introduce new TODOs.
# No TODOs. No placeholders. Handle it now or descope it explicitly.

STAGED_DIFF=$(git diff --cached 2>/dev/null)

if echo "$STAGED_DIFF" | grep -i "^\+.*TODO" > /dev/null 2>&1; then
  echo "BLOCKED: New TODO found in staged changes."
  echo "Either implement it now or explicitly descope it in the plan."
  echo ""
  echo "TODOs found:"
  echo "$STAGED_DIFF" | grep -n "^\+.*TODO"
  exit 1
fi
