#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow_dir="${repo_root}/.github/workflows"
mirror_root="${repo_root}/.github/action-mirrors"
bundle_root="${repo_root}/.github/action-bundles"
bundle_name="github-actions-mirror.tar.gz"
bundle_path="${bundle_root}/${bundle_name}"
manifest_path="${mirror_root}/manifest.tsv"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/action-mirror.XXXXXX")"
mode="${1:-sync}"

mkdir -p "${mirror_root}" "${bundle_root}"

cleanup() {
  rm -rf "${tmp_root}"
}
trap cleanup EXIT

usage() {
  cat <<'EOF'
Usage:
  bash tools/sync-action-mirrors.sh [sync|download|upload]

Modes:
  sync      Reuse local mirrors, restore from bundle/Nexus when missing,
            fetch remaining actions from GitHub, repack the bundle, and
            upload it back to Nexus when NEXUS_URL and NEXUS_MIRROR_REPOSITORY are set.
  download  Download the mirror bundle from Nexus and extract it.
  upload    Pack the current mirror directory and upload the bundle to Nexus.

Environment:
  NEXUS_URL                Nexus base URL, e.g. https://nexus.example.com
  NEXUS_MIRROR_REPOSITORY  Nexus raw repository name for the action mirror bundle.
  NEXUS_USERNAME           Optional username for Nexus basic auth.
  NEXUS_PASSWORD           Optional password for Nexus basic auth.
EOF
}

trim_single_line() {
  printf '%s' "$1" | tr -d '\r\n'
}

log() {
  printf '%s\n' "$1"
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

NEXUS_URL_CLEAN="$(trim_single_line "${NEXUS_URL:-}")"
NEXUS_MIRROR_REPOSITORY_CLEAN="$(trim_single_line "${NEXUS_MIRROR_REPOSITORY:-}")"
NEXUS_USERNAME_CLEAN="$(trim_single_line "${NEXUS_USERNAME:-}")"
NEXUS_PASSWORD_CLEAN="$(trim_single_line "${NEXUS_PASSWORD:-}")"

nexus_auth_args=()
if [[ -n "${NEXUS_USERNAME_CLEAN}" || -n "${NEXUS_PASSWORD_CLEAN}" ]]; then
  if [[ -z "${NEXUS_USERNAME_CLEAN}" || -z "${NEXUS_PASSWORD_CLEAN}" ]]; then
    fail "Both NEXUS_USERNAME and NEXUS_PASSWORD must be set together."
  fi
  nexus_auth_args=(-u "${NEXUS_USERNAME_CLEAN}:${NEXUS_PASSWORD_CLEAN}")
fi

run_curl() {
  if [[ ${#nexus_auth_args[@]} -gt 0 ]]; then
    curl -fS --retry 3 --retry-all-errors "${nexus_auth_args[@]}" "$@"
    return
  fi

  curl -fS --retry 3 --retry-all-errors "$@"
}

require_nexus_url() {
  if [[ -z "$(resolved_nexus_url)" ]]; then
    fail "NEXUS_URL and NEXUS_MIRROR_REPOSITORY are required for '${mode}' mode."
  fi
}

resolved_nexus_url() {
  if [[ -n "${NEXUS_URL_CLEAN}" && -n "${NEXUS_MIRROR_REPOSITORY_CLEAN}" ]]; then
    printf '%s/repository/%s/%s\n' "${NEXUS_URL_CLEAN%/}" "${NEXUS_MIRROR_REPOSITORY_CLEAN}" "${bundle_name}"
    return
  fi

  printf '\n'
}

has_local_mirror_content() {
  find "${mirror_root}" -mindepth 3 -maxdepth 3 -type d | head -n 1 | grep -q .
}

restore_bundle() {
  local source_bundle="$1"

  rm -rf "${mirror_root}"
  mkdir -p "${repo_root}/.github"
  tar -xzf "${source_bundle}" -C "${repo_root}/.github"
}

download_bundle_from_nexus() {
  require_nexus_url

  local tmp_bundle="${tmp_root}/${bundle_name}"
  local nexus_bundle_url
  nexus_bundle_url="$(resolved_nexus_url)"
  log "download ${nexus_bundle_url}"
  if ! run_curl \
    -o "${tmp_bundle}" \
    "${nexus_bundle_url}"; then
    rm -f "${tmp_bundle}"
    return 1
  fi

  mv "${tmp_bundle}" "${bundle_path}"
  restore_bundle "${bundle_path}"
  return 0
}

restore_local_bundle_if_present() {
  if [[ ! -f "${bundle_path}" ]]; then
    return 1
  fi

  log "restore local bundle ${bundle_path}"
  restore_bundle "${bundle_path}"
  return 0
}

package_bundle() {
  [[ -d "${mirror_root}" ]] || fail "Mirror directory does not exist: ${mirror_root}"
  tar -czf "${bundle_path}" -C "${repo_root}/.github" action-mirrors
}

upload_bundle_to_nexus() {
  require_nexus_url
  package_bundle

  local nexus_bundle_url
  nexus_bundle_url="$(resolved_nexus_url)"
  log "upload   ${nexus_bundle_url}"
  run_curl \
    --upload-file "${bundle_path}" \
    "${nexus_bundle_url}"
}

bootstrap_from_local_or_nexus() {
  if has_local_mirror_content; then
    return 0
  fi

  if restore_local_bundle_if_present; then
    return 0
  fi

  if [[ -n "$(resolved_nexus_url)" ]] && download_bundle_from_nexus; then
    return 0
  fi

  return 1
}

scan_action_refs() {
  action_refs=()
  while IFS= read -r action_ref; do
    action_refs+=("${action_ref}")
  done < <(
    rg -NoP 'uses:\s*\K\S+' "${workflow_dir}"/*.yml "${workflow_dir}"/*.yaml 2>/dev/null \
      | cut -d: -f2 \
      | sort -u
  )
}

sync_from_github() {
  local downloaded=0
  local reused=0

  scan_action_refs
  printf 'source\tref\tcommit\tpath\n' > "${manifest_path}"

  for action_ref in "${action_refs[@]}"; do
    if [[ "${action_ref}" == ./* ]] || [[ "${action_ref}" == docker://* ]]; then
      continue
    fi

    if [[ "${action_ref}" != *@* ]] || [[ "${action_ref}" != */* ]]; then
      continue
    fi

    local source_repo="${action_ref%@*}"
    local ref_name="${action_ref#*@}"
    local owner_name="${source_repo%%/*}"
    local repo_name="${source_repo#*/}"
    local mirror_dir="${mirror_root}/${owner_name}/${repo_name}/${ref_name}"
    local metadata_path="${mirror_dir}/.mirror-meta"
    local commit_sha=""

    if [[ -f "${mirror_dir}/action.yml" || -f "${mirror_dir}/action.yaml" ]]; then
      log "reuse    ${action_ref}"
      reused=$((reused + 1))
      if [[ -f "${metadata_path}" ]]; then
        commit_sha="$(awk -F= '$1=="commit"{print $2}' "${metadata_path}")"
      fi
      printf '%s\t%s\t%s\t%s\n' "${source_repo}" "${ref_name}" "${commit_sha}" "${mirror_dir#${repo_root}/}" >> "${manifest_path}"
      continue
    fi

    local archive_url="https://codeload.github.com/${source_repo}/tar.gz/${ref_name}"
    local archive_path="${tmp_root}/${owner_name}-${repo_name}-${ref_name}.tar.gz"
    commit_sha="$(git ls-remote "https://github.com/${source_repo}.git" "refs/tags/${ref_name}" "refs/heads/${ref_name}" "${ref_name}" | awk 'NR==1{print $1}')"

    log "fetch    ${action_ref}"
    mkdir -p "${mirror_dir}"
    curl -fsSL -o "${archive_path}" "${archive_url}"
    tar -xzf "${archive_path}" -C "${mirror_dir}" --strip-components=1
    {
      printf 'source=%s\n' "${source_repo}"
      printf 'ref=%s\n' "${ref_name}"
      printf 'commit=%s\n' "${commit_sha}"
    } > "${metadata_path}"

    downloaded=$((downloaded + 1))
    printf '%s\t%s\t%s\t%s\n' "${source_repo}" "${ref_name}" "${commit_sha}" "${mirror_dir#${repo_root}/}" >> "${manifest_path}"
  done

  package_bundle
  printf '\nsummary: reused=%s downloaded=%s bundle=%s manifest=%s\n' \
    "${reused}" \
    "${downloaded}" \
    "${bundle_path}" \
    "${manifest_path}"
}

case "${mode}" in
  sync)
    bootstrap_from_local_or_nexus || true
    sync_from_github
    if [[ -n "$(resolved_nexus_url)" ]]; then
      upload_bundle_to_nexus
    fi
    ;;
  download)
    download_bundle_from_nexus
    printf 'restored bundle to %s\n' "${mirror_root}"
    ;;
  upload)
    upload_bundle_to_nexus
    printf 'uploaded bundle %s\n' "${bundle_path}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
