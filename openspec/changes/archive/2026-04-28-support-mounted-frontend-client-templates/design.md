## Context

The `v0.0.2` release added frontend-only client templates so operators could customize generated client config without waiting for backend schema support. The feature had to work in several deployment modes at once:

- backend-provided public settings
- runtime-injected frontend config
- pure static frontend deployments using a mounted file
- existing built-in config generation when no custom template exists

The design therefore needed a stable runtime entrypoint, a small template language, and a safe fallback model that would never break the existing key-usage experience just because a mounted file was absent or malformed.

## Goals / Non-Goals

**Goals:**
- Allow Codex, Codex WS, OpenCode, and CCS import output to be customized from frontend-managed template files.
- Support whole-directory mounting with a stable `/client-templates.json` runtime entrypoint.
- Preserve built-in generated configs whenever no matching template exists or a template source fails to load.
- Reuse one placeholder-rendering model across all supported client template surfaces.

**Non-Goals:**
- Build an admin UI for editing client templates.
- Require backend support before templates can be used.
- Fetch templates from arbitrary external URLs.
- Remove or deprecate built-in generated client configs.

## Decisions

### 1. Use a stable static entrypoint at `/client-templates.json`

The frontend loads an optional runtime file from `/client-templates.json` using `cache: 'no-store'`. The file may be either the inner client-template object or a wrapper object with a `client_templates` field.

Why:
- A stable path makes directory mounts simple and predictable.
- Supporting both wrapped and bare payloads reduces friction between backend-fed JSON and pure frontend files.

Alternative considered:
- Multiple per-client files or a more dynamic lookup path. Rejected because it complicates deployment and makes pure static mounting harder to document.

### 2. Prefer injected/server sources over the static file, then fall back to built-ins

The effective template source is resolved in this order: fetched public settings, cached public settings, `window.__APP_CONFIG__`, static `/client-templates.json`, then built-in generated defaults.

Why:
- Backend or runtime-injected configuration should win when present.
- The static file remains a useful override for pure frontend deployments.
- Built-in defaults guarantee that key usage flows still work when no custom template exists.

Alternative considered:
- Let the static file override everything. Rejected because server/runtime configuration is usually the authoritative deployment setting when available.

### 3. Use a minimal placeholder engine shared across all template consumers

Templates support both `${name}` and `{{ name }}` placeholder syntax and render through a shared context containing API keys, base URLs, platform metadata, config directories, and per-flow values such as endpoint or app name.

Why:
- A tiny placeholder surface is enough for these config artifacts.
- Supporting two common placeholder styles lowers migration friction from existing snippets.

Alternative considered:
- Embedding a full templating engine. Rejected because it would be heavier than needed and would expand the trust surface for mounted files.

### 4. Treat configured template files as targeted overrides, not mandatory replacements

Use Key flows only replace built-in output for the specific client surface that has configured template files. Missing template sections keep the built-in generated configs.

Why:
- Operators can override only the clients they care about.
- Partial template sets are easier to maintain than all-or-nothing bundles.

Alternative considered:
- Requiring a full template bundle before enabling the feature. Rejected because it makes incremental rollout harder.

### 5. Generate CCS import deeplinks by merging defaults with template params

CCS import templates can override the deeplink base and individual params. The frontend merges template params onto defaults and base64-encodes `usageScript` before opening the deeplink.

Why:
- Default metadata such as provider name, endpoint, and API key should keep working even when only a few deeplink fields need customization.
- Base64 encoding keeps script content transport-safe inside the deeplink.

Alternative considered:
- Requiring templates to fully specify every deeplink parameter. Rejected because it would duplicate too much boilerplate.

### 6. Ship mount-ready assets and Compose hints with the repo

The repo includes `template/client-templates.json`, per-surface example files, a README describing lookup order and placeholders, and Docker Compose comments showing how to mount the whole template directory into `/app/data/public`.

Why:
- The feature is only truly usable if operators can discover the expected file shape and mount point quickly.
- Whole-directory mounts are simpler than one-file-per-client setups.

## Risks / Trade-offs

- [Malformed mounted template file disables customization unexpectedly] -> Mitigation: normalize strictly, warn, and fall back to built-in defaults instead of failing the page.
- [Precedence across multiple sources becomes hard to reason about] -> Mitigation: document the resolution order explicitly and keep it stable.
- [Placeholder surface grows inconsistently across client types] -> Mitigation: centralize rendering and context construction in shared utilities.
- [Static file caching could serve stale templates] -> Mitigation: fetch with `cache: 'no-store'` and memoize only within the current page lifecycle.

## Migration Plan

This feature was implemented and released in `v0.0.2`.

1. Keep built-in defaults as the safety net while operators adopt mounted or injected templates.
2. Prefer the mount-ready `template/client-templates.json` entrypoint for pure frontend deployments.
3. If backend support for richer `client_templates` evolves later, keep the same normalized frontend shape so deployments do not need to rewrite their template files.

## Open Questions

- Should future releases add more client surfaces beyond Codex, OpenCode, and CCS import to the same template contract?
- If backend settings eventually become the dominant source for templates, should the static mounted file remain a fallback or become explicitly deprecated?
