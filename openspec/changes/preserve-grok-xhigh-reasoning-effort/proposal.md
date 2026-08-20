# Preserve Grok xhigh reasoning effort

## Why

xAI shipped a new `xhigh` reasoning-effort tier with grok-4.6 (2026-08-12). Upstream sub2api's Grok gateway still flattens every high-tier alias (`xhigh` / `extrahigh` / `max` / `ultra`) to `high` — a defensive mapping written on 2026-08-08 when `high` was the ceiling across all Grok models. Upstream's grok-4.6 enablement commit (`a04ce4901`, in `v0.1.176`) only stopped the effort field from being stripped; it never revisited the alias mapping, so a client requesting `xhigh` on grok-4.6 is silently downgraded to `high` (observed end-to-end: response reports `reasoning.effort = "high"`). Upstream issue Wei-Shaw/sub2api#5575 tracks this but no fix has landed as of `v0.1.176` + 5 commits.

## What Changes

- `normalizeGrokReasoningEffortValue` becomes model-aware: on models that support the `xhigh` tier, the `xhigh` / `extrahigh` / `max` / `ultra` aliases normalize to `xhigh` instead of `high`.
- A new `grokSupportsXHighReasoningEffort` whitelist gates the passthrough to `grok-4.6` / `grok-4.6-latest`; older models (grok-4.5 and below, grok-3-mini, grok-4.20 family) keep the historical flattening to `high` to avoid upstream 400s.
- Both normalize paths are covered: Responses (`reasoning.effort` / `reasoning_effort` / `reasoningEffort`) and Chat Completions (`reasoning_effort`), which also covers the Chat→Responses bridge since it funnels through `patchGrokResponsesBody`.

## Capabilities

### New Capabilities
- `grok-xhigh-reasoning-effort-passthrough`: which Grok models receive `xhigh` verbatim and which keep the legacy flattening.

### Modified Capabilities
- None.

## Impact

- `backend/internal/service/openai_gateway_grok.go` — normalize function + whitelist
- `backend/internal/service/openai_gateway_grok_test.go` — regression coverage
- Drop this patch once upstream fixes the mapping (watch Wei-Shaw/sub2api#5575); then move this change to ⬆️ upstreamed in `openspec/FORK.md`.
- 2026-08-20 (rebase onto `75f88be5f`, v0.1.179): upstream `892787723 fix(grok): preserve xhigh effort for grok-4.6` landed an equivalent implementation and was taken wholesale. Only the `max`/`ultra` alias handling still differs — upstream keeps flattening those to `high` even on grok-4.6, the fork keeps treating every top-tier alias alike. Drop the change entirely once upstream folds `max`/`ultra` back in.

## Fork Touchpoints

### New Files
- _None._

### Upstream Patch Files
- `backend/internal/service/openai_gateway_grok.go`: upstream `892787723` (v0.1.179) absorbed the model-aware `normalizeGrokReasoningEffortValue` signature, its 3 call sites and the `grokSupportsXHighReasoningEffort` whitelist; the remaining fork delta is the alias switch keeping `case "xhigh", "extrahigh", "max", "ultra":` as one branch, where upstream split `max`/`ultra` off and flattens them to `high` unconditionally.
- `backend/internal/service/openai_gateway_grok_test.go`: fork-owned tests `TestPatchGrokResponsesBodyKeepsXHighForGrok46` (its `max camel` case pins the remaining delta) and `TestNormalizeGrokChatReasoningEffortKeepsXHighForGrok46` (upstream test tables untouched — they pin grok-4.5 flattening and grok-4.6 `xhigh` passthrough, both unchanged).

### Shared Touchpoints
- _None._

### Non-OpenSpec Overlap
- `backend/internal/service/openai_gateway_grok.go`: also carries the non-OpenSpec "OpenAI ops 观测" patch (`safeUpstreamURL` argument at transport-error call sites) — keep both patches when resolving rebase conflicts on this file.
