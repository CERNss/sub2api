## Why

Before `v0.0.2`, frontend-generated client config was effectively hardcoded in the UI, so operators who wanted different Codex, OpenCode, or CCS import output had to fork the frontend or wait for backend support. The mounted-template feature solved that by letting a pure frontend deployment ship template files and have key usage flows consume them immediately.

## What Changes

- Define a frontend client-template loading contract that accepts runtime templates from public settings, app config, or a mounted static `/client-templates.json` file.
- Define a normalization and fallback model so invalid or missing template payloads safely fall back to built-in client config generation.
- Define template rendering for Codex, Codex WS, OpenCode, and CCS import flows, including placeholder substitution and deeplink parameter generation.
- Capture the mount-ready assets and deployment guidance added in `template/` and Docker Compose comments so whole-directory mounts remain a supported deployment pattern.

## Capabilities

### New Capabilities
- `frontend-client-template-loading`: How the frontend discovers, normalizes, caches, and falls back among client template sources.
- `key-client-template-rendering`: How key usage flows render Codex, OpenCode, and CCS import output from configured templates while preserving built-in defaults when templates are absent.

### Modified Capabilities
- None.

## Impact

- Frontend utility layer in `frontend/src/utils/clientTemplates.ts`
- Public settings typing in `frontend/src/types/index.ts`
- Key usage UI in `frontend/src/components/keys/UseKeyModal.vue`
- User key page wiring and CCS import flow in `frontend/src/views/user/KeysView.vue`
- Static runtime entrypoint `frontend/public/client-templates.json`
- Deployment examples and documentation in `template/` and `deploy/docker-compose*.yml`
