# Per-platform OpenCode client templates

## Why

The Use-Key modal's OpenCode tab is template-driven through a single shared
`client_templates.opencode` section. One section has to serve every platform, so
an operator who pins a model in it leaks that model into every other platform's
tab — a Grok group's `opencode.json` would advertise an OpenAI model, and vice
versa. The Codex tab already solved this with a per-platform section
(`grok_codex`, see `add-grok-codex-client-template`); OpenCode had no equivalent.

Separately, the built-in OpenCode fallback had no GLM branch at all: a Zhipu
group fell through to the generic OpenAI-compatible shape and advertised the
OpenAI catalog, none of which its gateway group can route. The Zhipu CCS
deeplink import had the same gap.

## What Changes

- New per-platform OpenCode sections `client_templates.openai_opencode`,
  `grok_opencode` and `zhipu_opencode`. For those three platforms the lookup
  order becomes: platform section → shared `opencode` → built-in generator.
  **Only those three platforms consult a platform section**; every other
  platform keeps reading the shared `opencode` section directly, so adding
  `openai_opencode` to a deployment cannot change what a kimi/deepseek/composite
  group renders.
- `normalizeClientTemplatesConfig` recognizes the three new sections, so a
  template file defining only one of them is accepted.
- Built-in OpenCode generator gains a `zhipu` branch
  (`@ai-sdk/openai-compatible`, "GLM via Sub2API", glm-4.6 / glm-4.7 catalog),
  and the Grok catalog gains grok-4.6.
- The built-in generator pins one top-level `model` per platform
  (`openai/gpt-5.5`, `grok/grok-4.6`, `zhipu/glm-4.6`) so each platform's
  `opencode.json` is self-contained. Platforms that merely reuse the
  OpenAI-compatible *shape* pass `pinDefaultModel: false` and get no pin — their
  groups serve different model names entirely.
- New Zhipu branch in the CCS deeplink import (`app: 'claude'`,
  `ZHIPU_CC_SWITCH_MODEL = 'glm-4.6'`).
- `zhipuModels` in `useModelWhitelist` gains `glm-4.7`, so the model this change
  recommends in the catalog and bundled template is actually whitelistable.
- Bundled `template/client-templates.json` ships mount-ready
  `openai_opencode` / `grok_opencode` / `zhipu_opencode` sections;
  `template/README.md` documents the lookup order and its three-platform scope.

## Capabilities

### New Capabilities
- `platform-opencode-client-templates`: per-platform OpenCode template
  resolution with shared-section and built-in fallbacks, plus the GLM built-in
  branch and Zhipu CCS import default.

### Modified Capabilities
- None.

## Impact

- `frontend/src/components/keys/UseKeyModal.vue`, `frontend/src/utils/clientTemplates.ts`, `frontend/src/utils/ccswitchImport.ts`, `frontend/src/types/index.ts`, `frontend/src/composables/useModelWhitelist.ts` + their tests
- `template/client-templates.json`, `template/README.md`
- Deployed template files may add the three new sections; older frontends ignore
  unknown sections, so template updates are safe to roll out first.

## Fork Touchpoints

### New Files
- _None._ Every change is a patch into an existing upstream or fork-owned file.

### Upstream Patch Files
- `frontend/src/utils/ccswitchImport.ts`: `ZHIPU_CC_SWITCH_MODEL` plus the `zhipu` branch of `resolveCcSwitchImportConfig`.
- `frontend/src/utils/__tests__/ccswitchImport.spec.ts`: Zhipu import assertions.
- `frontend/src/composables/useModelWhitelist.ts`: `zhipuModels` gains `glm-4.7` so the recommended GLM model is whitelistable.

### Shared Touchpoints
- `frontend/src/components/keys/UseKeyModal.vue`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — the OpenCode branch now resolves a per-platform section before the shared one for openai/grok/zhipu only, `default` must stay on the shared section, and `generateOpenCodeConfig` gained the `zhipu` branch plus the `pinDefaultModel` option.
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — keeps the per-platform priority tests and the regression test that `default`-branch platforms never see `openai/gpt-5.5`.
- `frontend/src/types/index.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — `ClientTemplatesConfig` gains the three per-platform OpenCode sections alongside the existing extensions.
- `frontend/src/utils/clientTemplates.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — the known-section whitelist gains the three new sections.
- `frontend/src/utils/__tests__/clientTemplates.spec.ts`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — normalization coverage for payloads defining only a per-platform OpenCode section.
- `template/client-templates.json`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — bundled default gains the three sections.
- `template/README.md`: also owned by `2026-04-28-support-mounted-frontend-client-templates` — documents the lookup order and that only openai/grok/zhipu consult a platform section.

### Non-OpenSpec Overlap
- _None._
