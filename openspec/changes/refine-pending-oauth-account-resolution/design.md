## Context

`v0.1.115` introduced a unified pending-auth flow for third-party first login, but the frontend could no longer rely on a simple one-step mapping from backend `step` to UI state. The backend may emit a generic choice state while also sending enough structured hints to show that only account creation is possible. At the same time, some providers, especially OIDC, can surface placeholder or synthetic emails that are technically valid for identity binding but poor defaults for a local signup form.

The `v0.0.5` branch behavior corrected those callback regressions without changing the underlying backend contract. This spec backfills that decision so the branch behavior becomes explicit.

## Goals / Non-Goals

**Goals:**
- Define how callback views resolve pending OAuth account actions from backend response state plus bindability hints.
- Define how callback views choose a stable, user-meaningful email for pending create-account and bind-login forms.
- Preserve provider-specific nuances while enforcing a common user-facing outcome for OIDC, LinuxDo, and WeChat.

**Non-Goals:**
- Redesign the backend pending-auth intent model.
- Change invitation, TOTP, or account-binding semantics outside the chooser-bypass regression.
- Introduce a shared frontend utility if the existing provider views still need provider-specific branching.
- Define local email verification policy for trusted OIDC emails; that is handled by a separate change.

## Decisions

### 1. Resolve chooser state from structured bindability hints, not from `step` alone

The callback views treat `choice` and `choose_account_action_required` as intermediate states. If the same payload also says `existing_account_bindable = false` and `create_account_allowed != false`, the UI resolves directly to `create_account`.

Why:
- The backend payload already contains the information needed to avoid an unnecessary chooser.
- This keeps the fix frontend-local and compatible with the deployed pending-auth response shape.

Alternative considered:
- Require the backend to emit a distinct `create_account_required` state for every such case. Rejected for this change because the existing response already carries the needed hint fields and the regression was UI-visible first.

### 2. Prefer provider-compatible email hints over generic or synthetic fallback emails

Each callback view uses a deterministic email preference chain and gives high priority to `compat_email`, `pending_email`, and `existing_account_email` before falling back to less trustworthy or less user-friendly fields.

Why:
- OIDC can surface synthetic emails that are valid for identity bookkeeping but confusing in a signup form.
- A deterministic order prevents subtle regressions when backend payloads grow new optional fields.

Alternative considered:
- Always prefill from `email`. Rejected because `email` can represent a provider fallback, not the best local signup address.

### 3. Keep provider-local implementations while mirroring the same user-facing rule

OIDC, LinuxDo, and WeChat all implement the same chooser-bypass intent, but each callback view keeps its own resolver and fallback order.

Why:
- WeChat has distinct state aliases and a resume-email fallback.
- The current code already has provider-local view logic, and the regression fix remained small and readable in place.

Alternative considered:
- Centralize all pending OAuth interpretation in a shared utility. Rejected for the backfill because the existing provider differences are meaningful and the change was already landed without a shared abstraction.

## Risks / Trade-offs

- [Backend/frontend contract drift] -> Mitigation: codify the bindability-hint interpretation and email precedence as explicit requirements and keep tests on each callback view.
- [Provider-specific fallback order diverges over time] -> Mitigation: keep provider-specific scenarios in the specs so future edits can be compared against intentional differences.
- [UI skips the chooser in cases backend authors expected to be ambiguous] -> Mitigation: only bypass chooser when `existing_account_bindable` is explicitly `false` and account creation is explicitly allowed.

## Migration Plan

This change is frontend-only and already reflected by the `v0.0.5` branch behavior.

1. Keep the callback view tests aligned with the documented chooser-bypass and email-prefill rules.
2. If a future backend cleanup emits a less ambiguous step, keep these requirements until all callback views are updated consistently.
3. Roll back by restoring raw `step`-only interpretation if the backend contract must be treated as authoritative again, but doing so will reintroduce the documented regressions unless the backend shape changes first.

## Open Questions

- Should the backend eventually stop emitting chooser-like states when no bindable account exists, so the frontend no longer needs the bindability-hint shortcut?
- Would a shared pending OAuth resolver become worthwhile once more providers adopt the same pending-auth contract?
