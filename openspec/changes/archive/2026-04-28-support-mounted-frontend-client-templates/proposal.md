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

## Fork Touchpoints

### New Files
- `frontend/public/client-templates.json`: runtime default fallback served from the frontend root.
- `frontend/src/utils/clientTemplates.ts`: loader, normalizer, and fallback resolver.
- `frontend/src/utils/__tests__/clientTemplates.spec.ts`: unit tests.
- `template/README.md`: deployment/mount documentation.
- `template/client-templates.json`: bundle entry example.
- `template/client-templates.bundle.example.json`: full multi-client bundle example.
- `template/client-templates.ccs-import.example.json`: CCS import example.
- `template/client-templates.codex.example.json`: Codex / Codex WS example.
- `template/client-templates.opencode.example.json`: OpenCode example.

### Upstream Patch Files
- `frontend/src/components/keys/UseKeyModal.vue`: renders Codex/OpenCode output via templates with built-in fallback.
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts`: template rendering tests.
- `frontend/src/views/user/KeysView.vue`: CCS import flow consumes templates.
- `frontend/src/types/index.ts`: `PublicSettings` gains template config fields.
- `deploy/docker-compose.yml`: example comments demonstrate `/client-templates.json` mount.
- `deploy/docker-compose.local.yml`: same mount example for local compose.
- `deploy/DOCKER.md`: docs section explaining the mount-loaded template flow.

### Shared Touchpoints
- `frontend/src/types/index.ts`: also owned by `add-external-custom-menu-token-open` — preserve both `PublicSettings` and `CustomMenuItem` extensions.

### Non-OpenSpec Overlap
> One path per bullet: `tools/fork_overlay.py` parses these lines and silently
> drops any bullet that packs several paths into one (`verify` now WARNs on it).
- `deploy/docker-compose.yml`: also touched by the general infra fork (Docker packaging customizations). Coordinate with the FORK.md "未纳入 OpenSpec" section when rebasing.
- `deploy/docker-compose.local.yml`: same infra-fork overlap as the main compose file.
- `deploy/DOCKER.md`: same infra-fork overlap; the mount docs sit next to the fork's packaging notes.
