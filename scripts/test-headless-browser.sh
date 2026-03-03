#!/bin/bash
# Test headless browser connection
# Usage: ./scripts/test-headless-browser.sh [cdp-url]

CDP_URL="${1:-http://localhost:3000}"

echo "Testing headless browser at $CDP_URL..."

# Check CDP endpoint
if curl -sf "$CDP_URL/json/version" > /dev/null 2>&1; then
  echo "CDP endpoint: OK"
  curl -s "$CDP_URL/json/version" | jq -r '.Browser // "Unknown"' | xargs -I{} echo "Browser: {}"
else
  echo "CDP endpoint: FAILED"
  echo "Make sure the browser is running:"
  echo "  docker compose --profile browser up -d"
  exit 1
fi

# Check available pages
PAGES=$(curl -s "$CDP_URL/json/list" 2>/dev/null)
PAGE_COUNT=$(echo "$PAGES" | jq -r 'length // 0')
echo "Pages available: $PAGE_COUNT"

echo ""
echo "Headless browser is ready!"
echo "Use in keanu with: profile=\"headless\""
