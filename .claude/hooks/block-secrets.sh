#!/bin/bash
# Block commits with accidentally committed secrets.

STAGED_DIFF=$(git diff --cached 2>/dev/null)

PATTERNS=(
  "AKIA[0-9A-Z]{16}"
  "sk-[a-zA-Z0-9]{48}"
  "ghp_[a-zA-Z0-9]{36}"
  "-----BEGIN.*PRIVATE KEY-----"
)

for pattern in "${PATTERNS[@]}"; do
  if echo "$STAGED_DIFF" | grep -Ei "$pattern" > /dev/null 2>&1; then
    echo "BLOCKED: Potential secret detected in staged changes."
    echo "Pattern: $pattern"
    exit 1
  fi
done
