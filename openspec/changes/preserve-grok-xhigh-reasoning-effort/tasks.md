## 1. Gateway normalization

- [x] 1.1 Make `normalizeGrokReasoningEffortValue` model-aware and return `xhigh` for high-tier aliases on models that support the tier.
- [x] 1.2 Add the `grokSupportsXHighReasoningEffort` whitelist (`grok-4.6`, `grok-4.6-latest`) and pass `upstreamModel` at all 3 call sites.

## 2. Regression coverage

- [x] 2.1 Responses path: `xhigh` nested / snake / camel aliases stay `xhigh` for grok-4.6 (`TestPatchGrokResponsesBodyKeepsXHighForGrok46`).
- [x] 2.2 Chat path: `xhigh` stays `xhigh` for grok-4.6 / grok-4.6-latest and still flattens to `high` for grok-4.5 (`TestNormalizeGrokChatReasoningEffortKeepsXHighForGrok46`).
- [x] 2.3 Confirm upstream tests pinning grok-4.5 / grok-4.3 flattening pass unmodified (`go test ./internal/service/`).

## 3. Fork bookkeeping

- [x] 3.1 Register the change in `openspec/FORK.md` (active entry + 快速概览 row).
- [x] 3.2 Snapshot the patch into `docs/fork-snapshots/preserve-grok-xhigh-reasoning-effort/`.
