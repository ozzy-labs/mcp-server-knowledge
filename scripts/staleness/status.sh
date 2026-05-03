#!/usr/bin/env bash
# Staleness status report for the manual /update workflow.
#
# Reads scripts/staleness/sources.yaml and each article's `reviewed:`
# frontmatter, then prints a per-group summary plus a suggestion of which
# `/update --staleness-group <name>` to run next.
#
# Thresholds (days since last `reviewed`):
#   daily   > 1
#   weekly  > 7
#   monthly > 30

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/../.." && pwd)
SOURCES="${SCRIPT_DIR}/sources.yaml"
KNOWLEDGE_DIR="${REPO_ROOT}/knowledge"

for cmd in yq jq date; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    printf 'ERROR: %s is required\n' "${cmd}" >&2
    exit 1
  }
done

today_epoch=$(date +%s)

declare -A THRESHOLD=([daily]=1 [weekly]=7 [monthly]=30)

TMP_SUMMARY=$(mktemp)
trap 'rm -f "${TMP_SUMMARY}"' EXIT

print_group() {
  local group=$1
  local threshold=${THRESHOLD[${group}]}
  local label
  label=$(printf '%s' "${group}" | tr '[:lower:]' '[:upper:]')

  local entries
  entries=$(yq -o json "${SOURCES}" |
    jq -r --arg g "${group}" '
      to_entries
      | map(select(.key != "defaults"))
      | map(select(.value.group == $g))
      | sort_by(.key)
      | .[]
      | "\(.key)\t\(.value.skip // false)"
    ')

  local count=0
  local stale=0
  local oldest=-1

  printf '\n%s (threshold > %d days)\n' "${label}" "${threshold}"

  while IFS=$'\t' read -r path skip; do
    [[ -z "${path}" ]] && continue
    count=$((count + 1))

    if [[ "${skip}" == "true" ]]; then
      printf '  %-44s  [skip]\n' "${path}"
      continue
    fi

    local file="${KNOWLEDGE_DIR}/${path}.md"
    if [[ ! -f "${file}" ]]; then
      printf '  %-44s  [MISSING %s]\n' "${path}" "${file#"${REPO_ROOT}"/}"
      stale=$((stale + 1))
      continue
    fi

    local reviewed
    reviewed=$(awk '
      /^---/ { fm = !fm; next }
      fm && /^reviewed:/ { sub(/^reviewed:[[:space:]]*/, ""); gsub(/"/, ""); print; exit }
    ' "${file}")

    if [[ -z "${reviewed}" ]]; then
      printf '  %-44s  [no reviewed field]\n' "${path}"
      stale=$((stale + 1))
      continue
    fi

    local epoch
    if ! epoch=$(date -d "${reviewed}" +%s 2>/dev/null); then
      printf '  %-44s  reviewed=%s [parse error]\n' "${path}" "${reviewed}"
      stale=$((stale + 1))
      continue
    fi

    local days=$(((today_epoch - epoch) / 86400))
    local marker="OK"
    if ((days > threshold)); then
      marker="OVERDUE"
      stale=$((stale + 1))
    fi
    if ((days > oldest)); then
      oldest=${days}
    fi

    printf '  %-44s  reviewed %s (%3d days ago)  %s\n' \
      "${path}" "${reviewed}" "${days}" "${marker}"
  done <<<"${entries}"

  printf '  -- %d articles, %d overdue, oldest %d days\n' \
    "${count}" "${stale}" "${oldest}"

  printf '%s\t%d\t%d\n' "${group}" "${stale}" "${oldest}" >>"${TMP_SUMMARY}"
}

print_group daily
print_group weekly
print_group monthly

printf '\nSuggested next:\n'
overdue=$(awk -F'\t' '$2 > 0 { print }' "${TMP_SUMMARY}" | sort -t$'\t' -k2 -r -n)
if [[ -z "${overdue}" ]]; then
  printf '  no overdue articles. all groups within threshold.\n'
else
  while IFS=$'\t' read -r group stale oldest; do
    printf '  /update --staleness-group %-7s  (%d overdue, oldest %d days)\n' \
      "${group}" "${stale}" "${oldest}"
  done <<<"${overdue}"
fi
