#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <goreleaser-bin> [goreleaser-args...]" >&2
  exit 2
fi

goreleaser_bin="$1"
shift

max_attempts="${GORELEASER_RELEASE_ATTEMPTS:-3}"
retry_delay_seconds="${GORELEASER_RELEASE_RETRY_DELAY_SECONDS:-45}"
cmd=("${goreleaser_bin}" release --clean --skip=validate "$@")

attempt=1
while [ "${attempt}" -le "${max_attempts}" ]; do
  echo "GoReleaser release attempt ${attempt}/${max_attempts}"
  if "${cmd[@]}"; then
    exit 0
  else
    status=$?
  fi

  if [ "${attempt}" -eq "${max_attempts}" ]; then
    echo "GoReleaser release failed after ${max_attempts} attempts" >&2
    exit "${status}"
  fi

  echo "GoReleaser release failed with status ${status}; retrying in ${retry_delay_seconds}s"
  sleep "${retry_delay_seconds}"
  attempt=$((attempt + 1))
  retry_delay_seconds=$((retry_delay_seconds * 2))
done
