## Context

Upstream's `normalizeGrokReasoningEffortValue` (introduced 2026-08-08, `165b07290`) flattens `xhigh` / `extrahigh` / `max` / `ultra` to `high` on every Grok model. That was correct until grok-4.6 (released 2026-08-12) introduced a real `xhigh` tier. Upstream's 4.6 enablement (`a04ce4901`) added the model to `grokSupportsReasoningEffort` so the effort field survives, but the alias mapping still caps it at `high`, silently degrading requests.

## Goals / Non-Goals

**Goals:**
- Deliver `xhigh` verbatim to grok-4.6 family upstream requests, on both the Responses and Chat Completions egress paths.
- Keep behavior for every other Grok model byte-identical to upstream, so existing upstream tests pass unmodified.
- Keep the diff small and rebase-friendly; retire it when upstream fixes Wei-Shaw/sub2api#5575.

**Non-Goals:**
- No new admin/group configuration surface; the group-level reasoning-effort policy is untouched.
- No change to OpenAI/GPT effort normalization (already passes `xhigh` through).
- No remapping of `max` / `ultra` to anything other than the best tier the target model supports.

## Decisions

### 1. Model-aware whitelist instead of blanket passthrough

xAI docs state unsupported models treat `xhigh` as `high` server-side, which would allow a blanket passthrough. We still gate on a `grok-4.6` / `grok-4.6-latest` whitelist because (a) the docs only name grok-4.5's behavior, not older validation-strict models like grok-3-mini, and (b) it matches the codebase idiom (`grokSupportsReasoningEffort` is also an explicit whitelist). Cost: one more list to extend when grok-4.7 lands — acceptable since upstream will likely have fixed this by then.

### 2. Thread the model through the existing function rather than post-processing

`normalizeGrokReasoningEffortValue` gains an `upstreamModel` parameter (all 3 call sites already have it in scope) instead of adding a second fixup pass after normalization. One decision point, no ordering hazards between two rewrites of the same field.

### 3. Fork-owned test functions, upstream tables untouched

Upstream's alias-table test pins `xhigh→high` on grok-4.5 and `ultra→high` on grok-4.3 — both still true. New coverage lives in separate `*KeepsXHighForGrok46` functions so a future rebase never conflicts inside upstream's test tables.
