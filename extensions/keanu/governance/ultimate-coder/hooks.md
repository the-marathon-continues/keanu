# Hooks Implementation Guide

Hooks turn coding rules into enforced automation. They execute every time,
cost zero context tokens, and catch problems before they reach review.

## Hook Types

| Hook         | When It Fires                 | Use For                                     |
| ------------ | ----------------------------- | ------------------------------------------- |
| PreToolUse   | Before Claude executes a tool | Block dangerous operations, validate inputs |
| PostToolUse  | After Claude executes a tool  | Auto-format, run tests, validate output     |
| Notification | On specific events            | Alerts, logging, progress tracking          |

## Configuration

Hooks live in `.claude/hooks/` or are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "write",
        "command": "bash .claude/hooks/pre-write.sh $FILE"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "write",
        "command": "bash .claude/hooks/post-write.sh $FILE"
      }
    ]
  }
}
```

## Essential Hook Implementations

### 1. Block Sensitive File Modifications

```bash
#!/bin/bash
# .claude/hooks/pre-write.sh
# Prevents writes to critical files without explicit approval

PROTECTED_FILES=(
  ".env"
  ".env.local"
  "*.key"
  "*.pem"
  "docker-compose.prod.yml"
  "Makefile"
)

FILE="$1"
for pattern in "${PROTECTED_FILES[@]}"; do
  if [[ "$FILE" == $pattern ]]; then
    echo "BLOCKED: $FILE is a protected file. Requires explicit human approval."
    exit 1
  fi
done
```

### 2. Auto-Format After Write

```bash
#!/bin/bash
# .claude/hooks/post-write.sh
# Auto-formats files after Claude writes them

FILE="$1"
EXT="${FILE##*.}"

case "$EXT" in
  js|jsx|ts|tsx)
    npx prettier --write "$FILE" 2>/dev/null
    ;;
  py)
    black "$FILE" 2>/dev/null
    ruff check --fix "$FILE" 2>/dev/null
    ;;
  go)
    gofmt -w "$FILE" 2>/dev/null
    ;;
  rs)
    rustfmt "$FILE" 2>/dev/null
    ;;
esac
```

### 3. Run Related Tests After Code Change

```bash
#!/bin/bash
# .claude/hooks/post-write-test.sh
# Finds and runs tests related to the changed file

FILE="$1"
BASENAME=$(basename "$FILE" | sed 's/\.[^.]*$//')

# Find matching test files
TEST_FILES=$(find . -name "*${BASENAME}*test*" -o -name "*test*${BASENAME}*" -o -name "*${BASENAME}*spec*" 2>/dev/null)

if [ -n "$TEST_FILES" ]; then
  echo "Running related tests for $FILE..."
  # Adapt to your test runner
  npm test -- --testPathPattern="$BASENAME" 2>/dev/null || \
  pytest -k "$BASENAME" 2>/dev/null || \
  go test ./... -run "$BASENAME" 2>/dev/null
fi
```

### 4. Block TODOs in Commits

```bash
#!/bin/bash
# .claude/hooks/pre-commit-no-todos.sh
# Blocks commits that introduce new TODOs

STAGED_DIFF=$(git diff --cached)

if echo "$STAGED_DIFF" | grep -i "^\+.*TODO" > /dev/null; then
  echo "BLOCKED: New TODO found in staged changes."
  echo "Either implement it now or explicitly descope it in the plan."
  echo ""
  echo "TODOs found:"
  echo "$STAGED_DIFF" | grep -n "^\+.*TODO"
  exit 1
fi
```

### 5. Secret Detection

```bash
#!/bin/bash
# .claude/hooks/pre-commit-secrets.sh
# Scans for accidentally committed secrets

PATTERNS=(
  "AKIA[0-9A-Z]{16}"           # AWS Access Key
  "sk-[a-zA-Z0-9]{48}"         # OpenAI/Anthropic API Key
  "ghp_[a-zA-Z0-9]{36}"        # GitHub Personal Access Token
  "-----BEGIN.*PRIVATE KEY-----" # Private keys
  "password\s*=\s*['\"]"        # Hardcoded passwords
)

STAGED_DIFF=$(git diff --cached)

for pattern in "${PATTERNS[@]}"; do
  if echo "$STAGED_DIFF" | grep -Ei "$pattern" > /dev/null; then
    echo "BLOCKED: Potential secret detected in staged changes."
    echo "Pattern: $pattern"
    exit 1
  fi
done
```

### 6. Ralph Wiggum Loop (Autonomous Continuation)

For overnight/autonomous builds. The Stop hook forces continuation until
the agent signals genuine completion.

```bash
#!/bin/bash
# .claude/hooks/stop-hook.sh
# Prevents premature stopping during autonomous builds

# Check if the agent signaled genuine completion
if grep -q "COMPLETE" /tmp/agent-status 2>/dev/null; then
  echo "Agent signaled completion. Allowing stop."
  exit 0
fi

# Check iteration count to prevent infinite loops
ITER=$(cat /tmp/agent-iterations 2>/dev/null || echo "0")
MAX_ITER=50

if [ "$ITER" -ge "$MAX_ITER" ]; then
  echo "Max iterations ($MAX_ITER) reached. Forcing stop."
  exit 0
fi

# Increment counter
echo $((ITER + 1)) > /tmp/agent-iterations

echo "NOT COMPLETE. Continue working. Check SHARED_TASK_NOTES.md for current state."
exit 1
```

## Hook Best Practices

1. **Keep hooks fast.** They run on every tool use. Slow hooks = slow coding.
2. **Fail loudly.** When a hook blocks something, explain why clearly.
3. **Don't over-hook.** Start with 2-3 essential hooks. Add more as needed.
4. **Test your hooks.** A broken hook blocks all work. Test them independently.
5. **Log hook activity.** Write to `.claude/hooks.log` for debugging.
