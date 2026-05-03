#!/usr/bin/env bash
# Routines Environment setup for the staleness verification routines.
#
# Installs the minimum tooling required by the daily/weekly/monthly
# routines defined under .claude/routines/:
#
#   - gh CLI         : GitHub release / issue / PR access
#   - yq (Go build)  : YAML parsing of scripts/staleness/sources.yaml
#   - pnpm           : runs the validate / lint scripts
#
# Logs each step and exits non-zero on the first failure so the routine
# environment surfaces a clean error.

set -euo pipefail

log() {
  printf '[staleness/setup] %s\n' "$*"
}

fail() {
  printf '[staleness/setup] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 not found after install"
}

YQ_VERSION="${YQ_VERSION:-v4.53.2}"

# ---------------------------------------------------------------------------
# 1. GitHub CLI (apt)
# ---------------------------------------------------------------------------
if command -v gh >/dev/null 2>&1; then
  log "gh already installed: $(gh --version | head -n1)"
else
  log "installing gh CLI via apt"
  type -p curl >/dev/null || sudo apt-get install -y curl
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg |
    sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod a+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y gh
fi

if [[ -n "${GH_TOKEN:-}" ]]; then
  log "authenticating gh with GH_TOKEN"
  echo "${GH_TOKEN}" | gh auth login --with-token
else
  log "GH_TOKEN not set; skipping gh auth login (rely on env var at runtime)"
fi

# ---------------------------------------------------------------------------
# 2. yq (Go binary)
# ---------------------------------------------------------------------------
if command -v yq >/dev/null 2>&1; then
  log "yq already installed: $(yq --version)"
else
  log "installing yq ${YQ_VERSION}"
  arch=$(dpkg --print-architecture)
  case "${arch}" in
  amd64) yq_arch="amd64" ;;
  arm64) yq_arch="arm64" ;;
  *) fail "unsupported arch: ${arch}" ;;
  esac
  url="https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_${yq_arch}"
  sudo wget -qO /usr/local/bin/yq "${url}"
  sudo chmod +x /usr/local/bin/yq
fi

# ---------------------------------------------------------------------------
# 3. pnpm install (frozen lockfile)
# ---------------------------------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  log "installing pnpm via corepack"
  corepack enable
  corepack prepare pnpm@latest --activate
fi

log "running pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 4. verification
# ---------------------------------------------------------------------------
require_cmd gh
require_cmd yq
require_cmd pnpm

log "gh:    $(gh --version | head -n1)"
log "yq:    $(yq --version)"
log "pnpm:  $(pnpm --version)"
log "setup complete"
