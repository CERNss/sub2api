## Why

The pending OIDC signup flow currently performs a second local email-code verification even when the upstream OIDC provider already verified the same trusted email. We need a precise, OIDC-only control for that duplicate-verification step, plus a documented session contract that lets the frontend hide or restore verification UI correctly without weakening other third-party login flows.

## What Changes

- Add an OIDC-specific admin setting, `oidc_connect_require_local_email_verification`, with a secure default of `true`.
- Document the server-side rule that decides whether a pending OIDC account-creation session still requires a local email verification code.
- Document the pending-session completion field `local_email_verification_required` and how the OIDC callback view and create-account form consume it.
- Document that trusted-email bypass is only allowed when the upstream OIDC email is verified, the trusted email comes from `compat_email`, the trusted email is not synthetic, and the user keeps that same email in the form.
- Document the admin API, admin UI, and regression tests that expose and preserve the new setting.

## Capabilities

### New Capabilities
- `oidc-local-email-verification-policy`: The end-to-end rule that decides when OIDC create-account still needs a local email verification code.
- `oidc-admin-verification-settings`: The admin-facing configuration and persistence contract for the new OIDC local verification setting.

### Modified Capabilities
- None.

## Impact

- Backend pending-auth handler logic and OIDC callback completion responses
- `RegisterOAuthEmailAccount` service behavior for OIDC create-account
- Admin settings DTOs, service settings view, and setting persistence
- OIDC callback UI, pending account create form, and auth API typings
- Backend and frontend tests covering trusted-email bypass and admin persistence

## Fork Touchpoints

### New Files
- _None._

### Upstream Patch Files
- `backend/internal/handler/auth_oidc_oauth.go`: OIDC callback returns `local_email_verification_required`.
- `backend/internal/handler/auth_oidc_oauth_test.go`: callback behavior tests.
- `backend/internal/handler/auth_oauth_pending_flow.go`: pending session carries verification state to the frontend.
- `backend/internal/handler/auth_oauth_pending_flow_test.go`: pending session tests.
- `backend/internal/service/auth_oauth_email_flow.go`: `RegisterOAuthEmailAccount` trusts upstream-verified emails per documented rule.
- `backend/internal/service/auth_oauth_email_flow_test.go`: trusted-bypass coverage.
- `backend/internal/service/settings_view.go`: public settings view exposes the new toggle.
- `backend/internal/service/domain_constants.go`: introduces the `oidc_connect_require_local_email_verification` setting key constant.
- `backend/internal/handler/admin/setting_handler.go`: passes the new admin field through.
- `backend/internal/handler/dto/settings.go`: DTO field.
- `backend/internal/service/setting_service.go`: persistence of the new toggle.
- `frontend/src/api/admin/settings.ts`: typings for the admin API field.
- `frontend/src/views/admin/SettingsView.vue`: admin UI exposes the new OIDC toggle.
- `frontend/src/components/auth/PendingOAuthCreateAccountForm.vue`: hides local verification input when flag says so.
- `frontend/src/components/auth/__tests__/PendingOAuthCreateAccountForm.spec.ts`: form tests.
- `frontend/src/views/auth/OidcCallbackView.vue`: consumes the verification flag.
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts`: callback view tests.
- `frontend/src/api/auth.ts`: pending OAuth session typing carries the new field.
- `frontend/src/i18n/locales/en.ts`: copy strings.
- `frontend/src/i18n/locales/zh.ts`: copy strings.

### Shared Touchpoints
- `backend/internal/handler/admin/setting_handler.go`: also owned by `add-external-custom-menu-token-open`.
- `backend/internal/handler/dto/settings.go`: also owned by `add-external-custom-menu-token-open`.
- `backend/internal/service/setting_service.go`: also owned by `add-external-custom-menu-token-open`.
- `frontend/src/views/admin/SettingsView.vue`: also owned by `add-external-custom-menu-token-open` — preserve both settings panels.
- `frontend/src/views/auth/OidcCallbackView.vue`: also owned by `refine-pending-oauth-account-resolution` — preserve both chooser bypass and verification flag handling.
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts`: also owned by `refine-pending-oauth-account-resolution`.
- `frontend/src/api/auth.ts`: also owned by `refine-pending-oauth-account-resolution` — preserve both `PendingOAuthResponse` field sets.

### Non-OpenSpec Overlap
- _None._
