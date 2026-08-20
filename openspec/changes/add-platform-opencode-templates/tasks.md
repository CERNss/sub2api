## 1. Per-platform template sections

- [x] 1.1 Add `openai_opencode` / `grok_opencode` / `zhipu_opencode` to `ClientTemplatesConfig` and to the `normalizeClientTemplatesConfig` known-section whitelist.
- [x] 1.2 OpenCode tab: resolve the platform section before the shared `opencode` section for openai / grok / zhipu.
- [x] 1.3 Keep `default` (kimi, deepseek, composite, …) on the shared `opencode` section only — a `case 'openai'` / `default` fallthrough would hand them the OpenAI section.

## 2. Built-in generator

- [x] 2.1 Add the `zhipu` branch (`@ai-sdk/openai-compatible`, "GLM via Sub2API", glm-4.6 / glm-4.7 catalog).
- [x] 2.2 Add grok-4.6 to the Grok catalog.
- [x] 2.3 Pin one top-level `model` per platform, and add `pinDefaultModel: false` for callers that only reuse the OpenAI-compatible shape.
- [x] 2.4 Add `glm-4.7` to `useModelWhitelist`'s `zhipuModels` so the recommended catalog model is whitelistable.

## 3. CCS deeplink import

- [x] 3.1 Add the `zhipu` branch (`app: 'claude'`, `ZHIPU_CC_SWITCH_MODEL = 'glm-4.6'`).

## 4. Bundled template + docs

- [x] 4.1 Ship mount-ready `openai_opencode` / `grok_opencode` / `zhipu_opencode` sections in `template/client-templates.json`.
- [x] 4.2 Document the lookup order in `template/README.md`, scoped to the three platforms that actually consult a platform section.

## 5. Regression coverage

- [x] 5.1 Per-platform section wins over the shared section — one test each for openai, grok, zhipu.
- [x] 5.2 Zhipu falls back to the shared section when `zhipu_opencode` is absent.
- [x] 5.3 `default`-branch platform (kimi) ignores `openai_opencode` and gets no `openai/gpt-5.5` pin in the built-in fallback. Verified negatively: re-merging `case 'openai'` with `default` fails this test.
- [x] 5.4 Built-in GLM fallback carries no OpenAI catalog models.
- [x] 5.5 `clientTemplates`: payloads defining only a per-platform OpenCode section normalize successfully.
- [x] 5.6 Full frontend suite (239 files / 1701 tests), `vue-tsc --noEmit` and `eslint` clean.
