## Why

The `v0.0.5` auth callback changes corrected two regressions introduced by the pending-auth refactor: brand-new OAuth users could be forced through an unnecessary account-action chooser, and create-account forms could be prefilled with fallback or synthetic provider emails instead of the most useful human email. We need a durable spec for that branch behavior so later pending-auth work does not regress it again.

## What Changes

- Document the callback-side rule that a pending response with `existing_account_bindable = false` and `create_account_allowed = true` must go straight to account creation instead of showing a chooser.
- Document the normalized state mapping used by the OIDC, LinuxDo, and WeChat callback views when resolving `choice`, `create_account`, and `bind_login` outcomes from pending OAuth responses.
- Document the email-preference order used to prefill pending account forms, including `compat_email` preference and provider-specific fallback behavior.
- Capture the regression coverage added around chooser bypass and prefilled email resolution in the callback view tests.

## Capabilities

### New Capabilities
- `pending-oauth-account-action-selection`: How callback views interpret pending OAuth response state and bindability hints.
- `pending-oauth-email-prefill`: How callback views choose the best email to prefill create-account or bind-login flows.

### Modified Capabilities
- None.

## Impact

- Frontend callback views for OIDC, LinuxDo, and WeChat
- Pending OAuth response typing in `frontend/src/api/auth.ts`
- Callback flow tests in `frontend/src/views/auth/__tests__`
- Future backend changes that rely on callback interpretation of pending OAuth responses

## Fork Touchpoints

### New Files
- _None._

### Upstream Patch Files
- `frontend/src/views/auth/OidcCallbackView.vue`: chooser bypass + email prefill order rules.
- `frontend/src/views/auth/LinuxDoCallbackView.vue`: same rules for LinuxDo callback.
- `frontend/src/views/auth/WechatCallbackView.vue`: same rules for WeChat callback.
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts`: regression coverage.
- `frontend/src/views/auth/__tests__/LinuxDoCallbackView.spec.ts`: regression coverage.
- `frontend/src/views/auth/__tests__/WechatCallbackView.spec.ts`: regression coverage.

> Note: the `PendingOAuthResponse` shape (e.g. `existing_account_bindable`, `create_account_allowed`, `compat_email`) is declared inline as a local `interface` inside each `*CallbackView.vue`, not in `frontend/src/api/auth.ts`. Keep that pattern when reapplying after rebase.

### Shared Touchpoints
- `frontend/src/views/auth/OidcCallbackView.vue`: also owned by `control-oidc-local-email-verification` — preserve both chooser bypass and verification flag handling.
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts`: also owned by `control-oidc-local-email-verification`.

### Non-OpenSpec Overlap
- _None._
