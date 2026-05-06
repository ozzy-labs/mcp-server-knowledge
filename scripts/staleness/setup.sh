#!/usr/bin/env bash
# Routines Environment setup for the staleness verification routines.
#
# Installs gh CLI (the only required tool not pre-installed in Claude Code on
# the web sessions). yq / pnpm / jq / ripgrep are part of the base image:
#   https://code.claude.com/docs/en/claude-code-on-the-web#installed-tools
#
# gh authenticates automatically via the GH_TOKEN env variable set on the
# environment, so no `gh auth login` step is needed.
#
# Setup scripts run as root, so sudo is unnecessary.
#
# IMPORTANT: This script runs *before* the repo is cloned (see
# knowledge/ai/agents/claude-code-routines.md). Repo-dependent steps such as
# `pnpm install --frozen-lockfile` MUST live in the routine's `instructions`
# field instead — they will fail here with `ERR_PNPM_NO_PKG_MANIFEST`.

set -euo pipefail

log() {
  printf '[staleness/setup] %s\n' "$*"
}

if ! command -v gh >/dev/null 2>&1; then
  log "installing gh CLI"
  # Pre-installed PPAs (deadsnakes / ondrej php) return 403 behind the cloud
  # proxy. Tolerate the InRelease failure; only the Ubuntu archive is needed
  # for the gh package, which lives in noble/universe.
  apt-get update -y || true
  apt-get install -y gh
else
  log "gh already installed: $(gh --version | head -n1)"
fi

log "gh:   $(gh --version | head -n1)"
log "yq:   $(yq --version)"
log "pnpm: $(pnpm --version)"
log "setup complete"
