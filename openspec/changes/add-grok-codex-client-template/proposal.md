# Grok Codex client template

## Why

The Use-Key modal's Codex tab for OpenAI groups is template-driven (`client_templates.codex` with built-in fallback), but the Grok groups' Codex tab always rendered a hardcoded config pinned to grok-4.5 — mounted `client-templates.json` files could not influence it at all. With grok-4.6 (and its `xhigh` reasoning tier passed through since v0.0.27), operators need the Grok Codex output to be operator-configurable the same way the OpenAI one is. The CCS deeplink import for Grok groups was similarly pinned to grok-4.5.

## What Changes

- New `client_templates.grok_codex.files` section: when present, the Grok platform's Codex tab renders it (same `renderConfiguredFiles` path and placeholders as OpenAI's `codex.files`); without it, the built-in Grok Codex config remains the fallback.
- `normalizeClientTemplatesConfig` recognizes `grok_codex` as a known section, so a template file defining only `grok_codex` is accepted.
- `GROK_CC_SWITCH_MODEL` (CCS deeplink import for Grok groups) bumped `grok-4.5` → `grok-4.6`.
- Bundled `template/client-templates.json` gains a mount-ready `grok_codex` section (grok-4.6 + `xhigh`, `${apiBase}` / `${apiKey}` placeholders) and drops the hardcoded `"model": "gpt-5.5"` from `ccs_import.params` (it leaked into every platform's import); `template/README.md` documents both.
- Shell-aware placeholders (review #6 follow-up, 2026-08-16): `buildShellTemplateContext(shell)` adds `${shellLabel}` / `${envSetPrefix}` / `${envQuote}` / `${pathSep}` resolved against the active shell tab, wired at the single `renderConfiguredFiles` substitution site; the bundled grok_codex env file composes them so Windows/PowerShell/CMD tabs render paste-able commands instead of a POSIX `export`. Old frontends render unknown placeholders literally — ship template and frontend updates together (new frontend + old template is unaffected).

## Capabilities

### New Capabilities
- `grok-codex-client-template`: template-first rendering for the Grok Codex tab with built-in fallback.

### Modified Capabilities
- None.

## Impact

- `frontend/src/components/keys/UseKeyModal.vue`, `frontend/src/utils/clientTemplates.ts`, `frontend/src/utils/ccswitchImport.ts`, `frontend/src/types/index.ts` + their tests
- `template/client-templates.json`, `template/README.md`
- Deployed template files may add a `grok_codex` section (harmless for older frontends, which ignore it)

## Fork Touchpoints

### New Files
- _None._

### Upstream Patch Files
- `frontend/src/components/keys/UseKeyModal.vue`: Grok platform Codex tab consults `clientTemplates.grok_codex.files` before the built-in generator (also shared, see below).
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts`: template-priority regression test (also shared, see below).
- `frontend/src/types/index.ts`: `ClientTemplatesConfig` gains `grok_codex` (also shared, see below).
- `frontend/src/utils/ccswitchImport.ts`: `GROK_CC_SWITCH_MODEL` bumped to `grok-4.6`.
- `frontend/src/utils/__tests__/ccswitchImport.spec.ts`: pinned-model assertion updated.

### Shared Touchpoints
- `frontend/src/components/keys/UseKeyModal.vue`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — keep both the codex/opencode template hooks and the grok_codex hook; `renderConfiguredFiles` passes `shell: activeTab.value` into placeholder substitution (sole wiring point for shell-aware placeholders).
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates`; includes the Windows-tab shell-aware rendering regression.
- `frontend/src/types/index.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` (and `add-external-custom-menu-token-open`) — preserve `PublicSettings`, `CustomMenuItem`, and `grok_codex` extensions together.
- `frontend/src/utils/clientTemplates.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — normalize whitelist gains `grok_codex`; adds `buildShellTemplateContext(shell)` (`${shellLabel}` / `${envSetPrefix}` / `${envQuote}` / `${pathSep}`), and `BuildTemplateContextOptions` gains an optional `shell` spread into the context.
- `frontend/src/utils/__tests__/clientTemplates.spec.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates`; covers all four shell mappings (including the UI-unreachable `cmd`) and unknown-shell fallback.
- `template/client-templates.json`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — bundled default gains `grok_codex`, `ccs_import` loses hardcoded model; the grok_codex env file uses `${envSetPrefix}`/`${envQuote}`/`${shellLabel}` and paths use `${pathSep}` so every shell tab renders a paste-able command.
- `template/README.md`: also owned by `2026-04-28-support-mounted-frontend-client-templates`; documents the shell-aware placeholders.
- `template/client-templates.bundle.example.json`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — `${pathSep}` sync only.
- `template/client-templates.codex.example.json`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — `${pathSep}` sync only.

### Non-OpenSpec Overlap
- _None._
