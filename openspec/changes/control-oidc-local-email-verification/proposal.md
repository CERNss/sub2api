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
