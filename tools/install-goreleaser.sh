#!/usr/bin/env bash

set -euo pipefail

trim_single_line() {
  printf '%s' "$1" | tr -d '\r\n'
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

run_curl() {
  if [[ ${#auth_args[@]} -gt 0 ]]; then
    curl -fSL --retry 5 --retry-delay 5 --retry-all-errors --connect-timeout 20 "${auth_args[@]}" "$@"
    return
  fi

  curl -fSL --retry 5 --retry-delay 5 --retry-all-errors --connect-timeout 20 "$@"
}

version="$(trim_single_line "${GORELEASER_VERSION:-v2.15.4}")"
if [[ -z "${version}" ]]; then
  fail "GORELEASER_VERSION must not be empty."
fi
if [[ "${version}" != v* ]]; then
  version="v${version}"
fi

base_url_override="$(trim_single_line "${GORELEASER_BASE_URL:-}")"
download_username="$(trim_single_line "${GORELEASER_USERNAME:-}")"
download_password="$(trim_single_line "${GORELEASER_PASSWORD:-}")"

if [[ -n "${base_url_override}" && -z "${download_username}" && -z "${download_password}" ]]; then
  download_username="$(trim_single_line "${NEXUS_USERNAME:-}")"
  download_password="$(trim_single_line "${NEXUS_PASSWORD:-}")"
fi

auth_args=()
if [[ -n "${download_username}" || -n "${download_password}" ]]; then
  if [[ -z "${download_username}" || -z "${download_password}" ]]; then
    fail "GORELEASER username/password must be configured together."
  fi
  auth_args=(-u "${download_username}:${download_password}")
fi

platform="$(uname -s)"
machine="$(uname -m)"
archive_name=""
cache_suffix=""

case "${platform}" in
  Darwin)
    archive_name="goreleaser_Darwin_all.tar.gz"
    cache_suffix="Darwin-all"
    ;;
  Linux)
    case "${machine}" in
      x86_64|amd64)
        machine="x86_64"
        ;;
      aarch64|arm64)
        machine="arm64"
        ;;
      i386|i686)
        machine="i386"
        ;;
    esac
    archive_name="goreleaser_Linux_${machine}.tar.gz"
    cache_suffix="Linux-${machine}"
    ;;
  *)
    fail "Unsupported platform for goreleaser install: ${platform}/${machine}"
    ;;
esac

base_url="${base_url_override}"
if [[ -z "${base_url}" ]]; then
  base_url="https://github.com/goreleaser/goreleaser/releases/download/${version}"
else
  base_url="${base_url%/}"
fi

install_root="${RUNNER_TEMP:-/tmp}/goreleaser-${version}-${cache_suffix}"
bin_path="${install_root}/goreleaser"

if [[ -x "${bin_path}" ]]; then
  printf '%s\n' "${bin_path}"
  exit 0
fi

tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/goreleaser.XXXXXX")"
trap 'rm -rf "${tmp_root}"' EXIT

archive_path="${tmp_root}/${archive_name}"
checksums_path="${tmp_root}/checksums.txt"

run_curl -o "${archive_path}" "${base_url}/${archive_name}"
if run_curl -o "${checksums_path}" "${base_url}/checksums.txt"; then
  expected_checksum="$(awk -v name="${archive_name}" '$2 == name || $2 == ("*" name) { print $1; exit }' "${checksums_path}")"
  if [[ -n "${expected_checksum}" ]]; then
    actual_checksum="$(shasum -a 256 "${archive_path}" | awk '{print $1}')"
    expected_checksum="$(printf '%s' "${expected_checksum}" | tr '[:upper:]' '[:lower:]')"
    actual_checksum="$(printf '%s' "${actual_checksum}" | tr '[:upper:]' '[:lower:]')"
    if [[ "${expected_checksum}" != "${actual_checksum}" ]]; then
      fail "Checksum mismatch for ${archive_name}: expected ${expected_checksum}, got ${actual_checksum}"
    fi
  fi
fi

rm -rf "${install_root}"
mkdir -p "${install_root}"
tar -xzf "${archive_path}" -C "${install_root}"
chmod +x "${install_root}/goreleaser" 2>/dev/null || true

if [[ ! -x "${bin_path}" ]]; then
  fail "goreleaser binary not found after extracting ${archive_name}"
fi

printf '%s\n' "${bin_path}"
