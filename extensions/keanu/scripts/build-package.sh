#!/bin/bash
# Build @the-marathon-continues/keanu npm package
# BSD 3-Clause - nervous system only (no convergence layer)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEANU_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$KEANU_DIR/dist"

echo "Building @the-marathon-continues/keanu..."

# Clean
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Compile TypeScript
echo "Compiling TypeScript..."
cd "$KEANU_DIR"
npx tsc -p tsconfig.package.json

# Copy non-code assets
echo "Copying assets..."
cp "$KEANU_DIR/SING.md" "$DIST_DIR/"
cp "$KEANU_DIR/LICENSE.npm" "$DIST_DIR/LICENSE"
cp "$KEANU_DIR/README.npm.md" "$DIST_DIR/README.md"
cp "$KEANU_DIR/package.npm.json" "$DIST_DIR/package.json"

# Copy gymnasium types (needed for harness)
mkdir -p "$DIST_DIR/gymnasium"

echo "Build complete!"
echo ""
echo "To publish:"
echo "  cd $DIST_DIR"
echo "  npm publish --access public"
echo ""
echo "To test locally:"
echo "  cd $DIST_DIR"
echo "  npm pack"
