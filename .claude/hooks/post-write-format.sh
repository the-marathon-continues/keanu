#!/bin/bash
# Auto-format after file write. Matches codebase conventions.

FILE="$1"
[ -z "$FILE" ] && exit 0

EXT="${FILE##*.}"

case "$EXT" in
  ts|tsx|js|jsx)
    npx prettier --write "$FILE" 2>/dev/null
    ;;
  py)
    black "$FILE" 2>/dev/null
    ruff check --fix "$FILE" 2>/dev/null
    ;;
esac
