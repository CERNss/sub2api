## 1. Template hook

- [x] 1.1 Add `grok_codex` to `ClientTemplatesConfig` and the `normalizeClientTemplatesConfig` known-section whitelist.
- [x] 1.2 Grok platform Codex tab: render `clientTemplates.grok_codex.files` via `renderConfiguredFiles` (shell-aware `configDir`), falling back to `generateGrokCodexFiles`.

## 2. Grok model pins

- [x] 2.1 Bump `GROK_CC_SWITCH_MODEL` to `grok-4.6` and update its spec assertion.

## 3. Bundled template + docs

- [x] 3.1 Add a mount-ready `grok_codex` section (grok-4.6, `xhigh`, `${apiBase}`/`${apiKey}`/`${configDir}` placeholders) to `template/client-templates.json`.
- [x] 3.2 Remove the hardcoded `"model": "gpt-5.5"` from the bundled `ccs_import.params`; document both changes in `template/README.md`.

## 4. Regression coverage

- [x] 4.1 UseKeyModal: grok_codex template wins over built-in output; built-in remains without a template (`npx vitest run` — 224 files / 1566 tests pass).
- [x] 4.2 clientTemplates: payloads defining only `grok_codex` normalize successfully.
- [x] 4.3 `vue-tsc --noEmit` clean.
