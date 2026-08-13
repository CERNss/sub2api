## Context

`2026-04-28-support-mounted-frontend-client-templates` (archived #6) made the OpenAI Codex tab and OpenCode output template-driven, but the Grok platform's Codex tab kept calling `generateGrokCodexFiles` unconditionally — a mounted template could not reach it. Meanwhile grok-4.6 shipped and v0.0.27 made `xhigh` reasoning effort pass through the gateway, so the hardcoded grok-4.5 defaults (Codex tab and CCS deeplink) went stale.

## Goals / Non-Goals

**Goals:**
- Give the Grok Codex tab the exact same template-first / built-in-fallback contract as the OpenAI Codex tab.
- Keep a dedicated `grok_codex` section so OpenAI and Grok groups can carry different Codex configs in one template file.
- Bump the only per-platform Grok model pin that templates cannot reach (`GROK_CC_SWITCH_MODEL`).

**Non-Goals:**
- No rework of the built-in `generateGrokCodexFiles` content (still the no-template fallback).
- No per-platform parameterization of `ccs_import.params` (template limitation stands; the bundled file now avoids hardcoding `model` there instead).
- No changes to the Grok CLI / Claude Code tabs of the Use-Key modal.

## Decisions

### 1. Separate `grok_codex` section instead of reusing `codex`

Reusing `codex.files` would force OpenAI and Grok groups to share one Codex config — the deployed reality is different models (`gpt-5.5` vs `grok-4.6`), auth env names, and provider blocks. A sibling section keeps one mounted file valid for both platforms. Old frontends ignore the unknown key, so adding `grok_codex` to a deployed template before rolling the new image is harmless.

### 2. Same placeholder contract as the OpenAI tab

The hook calls the existing `renderConfiguredFiles` with `apiBase` as endpoint and the shell-aware `configDir`, so `${apiKey}` / `${apiBase}` / `${configDir}` behave identically across `codex` and `grok_codex` sections — one set of docs covers both.

### 3. Drop the hardcoded model from the bundled `ccs_import` params

`ccs_import.params` are platform-agnostic and override the frontend's per-platform defaults; a fixed `"model": "gpt-5.5"` leaked into Grok/Anthropic imports. Removing it restores the per-platform defaults (now grok-4.6 for Grok groups).
