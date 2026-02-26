#!/usr/bin/env bash
# Keanu installer.
# curl -fsSL https://raw.githubusercontent.com/the-marathon-continues/keanu/main/install.sh | bash
#
# Downloads the latest release, installs deps, symlinks the CLI.
# Works on macOS and Linux. Requires Node 22+ and git.

set -euo pipefail

REPO="the-marathon-continues/keanu"
INSTALL_DIR="${KEANU_HOME:-$HOME/.keanu}"
BIN_NAME="keanu"

# ── colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
DIM='\033[0;90m'
RESET='\033[0m'

step()  { printf "\n${BOLD}▸ %s${RESET}\n" "$1"; }
pass()  { printf "${GREEN}  ✓ %s${RESET}\n" "$1"; }
warn()  { printf "${YELLOW}  ! %s${RESET}\n" "$1"; }
fail()  { printf "${RED}  ✗ %s${RESET}\n" "$1" >&2; exit 1; }
info()  { printf "${DIM}  %s${RESET}\n" "$1"; }

# ── preflight ───────────────────────────────────────────────
step "Checking requirements"

command -v git >/dev/null 2>&1 || fail "git is required. Install it first."
pass "git"

command -v node >/dev/null 2>&1 || fail "Node.js is required (22+). Install it: https://nodejs.org"
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  fail "Node.js 22+ required, found v$(node -v). Update: https://nodejs.org"
fi
pass "node $(node -v)"

# Install pnpm if missing
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found — installing"
  npm install -g pnpm || fail "Could not install pnpm"
fi
pass "pnpm $(pnpm -v)"

# ── resolve version ─────────────────────────────────────────
step "Resolving version"

VERSION="${KEANU_VERSION:-latest}"

if [ "$VERSION" = "latest" ]; then
  # Try GitHub API for latest release tag
  RELEASE_INFO=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null || echo "")
  if [ -n "$RELEASE_INFO" ] && echo "$RELEASE_INFO" | grep -q '"tag_name"'; then
    VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | head -1 | sed 's/.*"v\?\([^"]*\)".*/\1/')
    info "Latest release: v$VERSION"
  else
    VERSION="main"
    info "No releases found — installing from main branch"
  fi
fi

# ── download ────────────────────────────────────────────────
step "Installing keanu"

if [ "$VERSION" = "main" ]; then
  # Clone from main
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing install at $INSTALL_DIR"
    cd "$INSTALL_DIR"
    git pull --ff-only origin main || fail "git pull failed"
  else
    if [ -d "$INSTALL_DIR" ]; then
      warn "$INSTALL_DIR exists but isn't a git repo — backing up"
      mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi
    git clone "https://github.com/$REPO.git" "$INSTALL_DIR" || fail "git clone failed"
  fi
else
  # Download release tarball
  TARBALL_URL="https://github.com/$REPO/releases/download/v${VERSION}/keanu-v${VERSION}.tar.gz"
  TMPDIR=$(mktemp -d)
  trap "rm -rf '$TMPDIR'" EXIT

  info "Downloading v$VERSION..."
  if curl --fail --location --progress-bar --output "$TMPDIR/keanu.tar.gz" "$TARBALL_URL"; then
    mkdir -p "$INSTALL_DIR"
    tar -xzf "$TMPDIR/keanu.tar.gz" -C "$INSTALL_DIR" --strip-components=1
  else
    warn "Release tarball not found — falling back to git clone"
    VERSION="main"
    if [ -d "$INSTALL_DIR/.git" ]; then
      cd "$INSTALL_DIR" && git pull --ff-only origin main || fail "git pull failed"
    else
      git clone "https://github.com/$REPO.git" "$INSTALL_DIR" || fail "git clone failed"
    fi
  fi
fi

pass "Source at $INSTALL_DIR"

# ── install deps ────────────────────────────────────────────
step "Installing dependencies"

cd "$INSTALL_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install || fail "pnpm install failed"
pass "Dependencies installed"

# ── setup config ────────────────────────────────────────────
step "Configuring"

OPENCLAW_DIR="$HOME/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
mkdir -p "$OPENCLAW_DIR"

if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" <<'CONF'
{
  "meta": {
    "name": "keanu"
  },
  "channels": {
    "whatsapp": { "enabled": false },
    "telegram": { "enabled": false }
  },
  "plugins": {
    "entries": {
      "keanu": { "enabled": true },
      "whatsapp": { "enabled": false },
      "telegram": { "enabled": false }
    }
  }
}
CONF
  pass "Config created at $CONFIG_FILE"
else
  info "Config already exists at $CONFIG_FILE"
fi

# ── symlink CLI ─────────────────────────────────────────────
step "Setting up CLI"

chmod +x "$INSTALL_DIR/keanu"

add_to_path() {
  local shell_name
  shell_name="$(basename "${SHELL:-/bin/bash}")"
  local rc_file path_line

  case "$shell_name" in
    zsh)   rc_file="$HOME/.zshrc" ;;
    bash)  rc_file="$HOME/.bashrc" ;;
    fish)  rc_file="$HOME/.config/fish/config.fish" ;;
    *)     rc_file="$HOME/.profile" ;;
  esac

  if [ "$shell_name" = "fish" ]; then
    path_line="set -gx PATH $INSTALL_DIR \$PATH"
  else
    path_line="export PATH=\"$INSTALL_DIR:\$PATH\""
  fi

  if ! grep -q "$INSTALL_DIR" "$rc_file" 2>/dev/null; then
    echo "" >> "$rc_file"
    echo "# keanu" >> "$rc_file"
    echo "$path_line" >> "$rc_file"
    warn "Added $INSTALL_DIR to PATH in $rc_file"
  fi

  pass "Added to PATH via $rc_file (restart your terminal)"
}

# Try /usr/local/bin first (most reliable)
if [ -w /usr/local/bin ] || [ -w "$(dirname /usr/local/bin)" ]; then
  ln -sf "$INSTALL_DIR/keanu" /usr/local/bin/keanu
  pass "Linked keanu → /usr/local/bin/keanu"
elif command -v sudo >/dev/null 2>&1 && sudo ln -sf "$INSTALL_DIR/keanu" /usr/local/bin/keanu 2>/dev/null; then
  pass "Linked keanu → /usr/local/bin/keanu"
else
  add_to_path
fi

# ── verify ──────────────────────────────────────────────────
step "Verifying"

if command -v keanu >/dev/null 2>&1; then
  pass "keanu is on PATH"
  keanu status 2>/dev/null || true
else
  warn "keanu installed but not on PATH yet — restart your terminal or run:"
  info "  export PATH=\"$INSTALL_DIR:\$PATH\""
fi

# ── done ────────────────────────────────────────────────────
printf "\n${GREEN}${BOLD}Keanu installed.${RESET}\n"
printf "\n"
printf "  ${BOLD}Get started:${RESET}\n"
printf "    keanu start        boot the gateway\n"
printf "    keanu status       check what's running\n"
printf "    keanu deploy       typecheck → test → lint → hot-reload\n"
printf "    keanu help         all commands\n"
printf "\n"
