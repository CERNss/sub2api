## 1. Backend Verification Policy

- [x] 1.1 Add the `oidc_connect_require_local_email_verification` setting constant, parsed settings field, default initialization value, and setting-service getter.
- [x] 1.2 Compute pending-session local verification requirements from provider type, trusted `compat_email`, upstream `email_verified`, synthetic-email filtering, and the submitted email.
- [x] 1.3 Extend pending OIDC completion responses to include `local_email_verification_required`.
- [x] 1.4 Gate `RegisterOAuthEmailAccount` email-code verification on the server-side OIDC policy instead of always verifying locally.

## 2. Frontend OIDC Flow

- [x] 2.1 Thread `local_email_verification_required` and the trusted OIDC email through the OIDC callback flow into the shared pending create-account form.
- [x] 2.2 Hide the verification-code input, send-code action, status hint, and Turnstile challenge when trusted OIDC signup no longer requires local verification.
- [x] 2.3 Restore those verification controls immediately if the user edits the email away from the trusted OIDC email.

## 3. Admin Exposure And Coverage

- [x] 3.1 Expose the new setting through backend admin DTOs and settings handlers.
- [x] 3.2 Expose the same setting through frontend admin typings, the OIDC settings form, and localized UI copy.
- [x] 3.3 Add backend and frontend regression tests for trusted-email bypass and for admin persistence of the new setting.
