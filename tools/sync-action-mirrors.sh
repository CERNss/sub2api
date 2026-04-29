#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow_dir="${repo_root}/.github/workflows"
mirror_root="${repo_root}/.github/action-mirrors"
bundle_root="${repo_root}/.github/action-bundles"
manifest_path="${mirror_root}/manifest.tsv"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/action-mirror.XXXXXX")"

mkdir -p "${mirror_root}" "${bundle_root}"

action_refs=()
while IFS= read -r action_ref; do
  action_refs+=("${action_ref}")
done < <(
  rg -NoP 'uses:\s*\K\S+' "${workflow_dir}"/*.yml "${workflow_dir}"/*.yaml 2>/dev/null \
    | cut -d: -f2 \
    | sort -u
)

downloaded=0
reused=0

printf 'source\tref\tcommit\tpath\n' > "${manifest_path}"

for action_ref in "${action_refs[@]}"; do
  if [[ "${action_ref}" == ./* ]] || [[ "${action_ref}" == docker://* ]]; then
    continue
  fi

  if [[ "${action_ref}" != *@* ]] || [[ "${action_ref}" != */* ]]; then
    continue
  fi

  source_repo="${action_ref%@*}"
  ref_name="${action_ref#*@}"
  owner_name="${source_repo%%/*}"
  repo_name="${source_repo#*/}"
  mirror_dir="${mirror_root}/${owner_name}/${repo_name}/${ref_name}"
  metadata_path="${mirror_dir}/.mirror-meta"

  if [[ -f "${mirror_dir}/action.yml" || -f "${mirror_dir}/action.yaml" ]]; then
    printf 'reuse  %s\n' "${action_ref}"
    reused=$((reused + 1))
    commit_sha=""
    if [[ -f "${metadata_path}" ]]; then
      commit_sha="$(awk -F= '$1=="commit"{print $2}' "${metadata_path}")"
    fi
    printf '%s\t%s\t%s\t%s\n' "${source_repo}" "${ref_name}" "${commit_sha}" "${mirror_dir#${repo_root}/}" >> "${manifest_path}"
    continue
  fi

  archive_url="https://codeload.github.com/${source_repo}/tar.gz/${ref_name}"
  archive_path="${tmp_root}/${owner_name}-${repo_name}-${ref_name}.tar.gz"
  commit_sha="$(git ls-remote "https://github.com/${source_repo}.git" "refs/tags/${ref_name}" "refs/heads/${ref_name}" "${ref_name}" | awk 'NR==1{print $1}')"

  printf 'fetch  %s\n' "${action_ref}"
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

bundle_path="${bundle_root}/github-actions-mirror.tar.gz"
tar -czf "${bundle_path}" -C "${repo_root}/.github" action-mirrors

printf '\nsummary: reused=%s downloaded=%s bundle=%s manifest=%s\n' \
  "${reused}" \
  "${downloaded}" \
  "${bundle_path}" \
  "${manifest_path}"
