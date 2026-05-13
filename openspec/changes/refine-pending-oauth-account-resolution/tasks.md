## 1. Pending Account Action Resolution

- [x] 1.1 Update the OIDC callback view to reinterpret chooser-like pending states as direct account creation when no existing account can be bound and account creation is allowed.
- [x] 1.2 Apply the same chooser-bypass rule to the LinuxDo and WeChat callback views while preserving provider-specific state aliases.
- [x] 1.3 Keep bind-login, invitation, and TOTP branches reachable after the new pending-action resolution logic runs.

## 2. Pending Email Prefill

- [x] 2.1 Prefer `pending_email`, `existing_account_email`, and `compat_email` ahead of generic fallback email fields when prefilling callback forms.
- [x] 2.2 Avoid surfacing synthetic or less useful provider fallback emails in the OIDC create-account path when a better compatible email exists.
- [x] 2.3 Preserve WeChat's provider-specific resume-email fallback when the pending payload still lacks an explicit usable email.

## 3. Regression Coverage

- [x] 3.1 Extend the callback view tests for OIDC, LinuxDo, and WeChat to cover chooser bypass when no bindable account exists.
- [x] 3.2 Extend the same tests to cover email fallback ordering so `compat_email` is preferred over synthetic or generic provider email fields.
