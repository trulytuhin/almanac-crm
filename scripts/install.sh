#!/usr/bin/env bash
# Almanac one-line installer for macOS and Linux:
#
#   curl -fsSL https://almanac.bar/install.sh | bash
#
# Downloads Almanac into ./almanac-crm (or $ALMANAC_DIR), installs its
# dependencies and runs the setup wizard (scripts/setup.mjs). Re-running
# it updates an existing copy and keeps your settings.
set -euo pipefail

REPO="${ALMANAC_REPO:-https://github.com/trulytuhin/almanac-crm.git}"
DIR="${ALMANAC_DIR:-almanac-crm}"

bold=$'\033[1m'; green=$'\033[32m'; red=$'\033[31m'; reset=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$green$bold" "$1" "$reset"; }
fail() { printf '\n%s✗ %s%s\n\n' "$red" "$1" "$reset" >&2; exit 1; }

printf '\n%sAlmanac installer%s\n' "$bold" "$reset"

step "Checking what's installed"
command -v git >/dev/null || fail "git is missing. Install it from https://git-scm.com/downloads and run this again."
command -v node >/dev/null || fail "Node.js is missing. Install version 20 or newer from https://nodejs.org and run this again."
node_major=$(node -p 'process.versions.node.split(".")[0]')
[ "$node_major" -ge 20 ] || fail "Node.js $(node -v) is too old. Install version 20 or newer from https://nodejs.org."
echo "  git $(git --version | awk '{print $3}'), node $(node -v)"

if [ -d "$DIR/.git" ]; then
  step "Updating $DIR"
  git -C "$DIR" pull --ff-only
else
  [ -e "$DIR" ] && fail "$DIR already exists and isn't an Almanac checkout. Set ALMANAC_DIR to another folder."
  step "Downloading Almanac into $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR"

step "Installing dependencies (a minute or two)"
npm ci --no-audit --no-fund --loglevel=error

# The wizard asks questions, so give it the keyboard even though this
# script itself arrived through a pipe.
if { true </dev/tty; } 2>/dev/null; then
  node scripts/setup.mjs "$@" < /dev/tty
else
  node scripts/setup.mjs "$@"
fi
