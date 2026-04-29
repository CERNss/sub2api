## Context

The branch now supports a richer OIDC pending-auth flow than classic email signup. The backend can store upstream claims such as `email_verified` and `compat_email` in the pending session, and the frontend can already drive create-account from a pending completion response. However, the generic third-party signup path still enforced local email verification uniformly, even when OIDC already provided a trustworthy verified email that the user kept unchanged.

This change backfills the implementation that makes duplicate verification optional for trusted OIDC emails while keeping the secure default and leaving LinuxDo and WeChat unchanged.

## Goals / Non-Goals

**Goals:**
- Keep local email verification enabled by default for OIDC.
- Allow admins to disable that extra verification step only for OIDC.
- Make the bypass decision on the server using pending-session claims rather than letting the frontend infer it from global settings.
- Restore the verification UI immediately if the user edits away from the trusted OIDC email.

**Non-Goals:**
- Introduce a global third-party signup switch that affects LinuxDo or WeChat.
- Trust provider fallback emails or synthetic OIDC placeholder emails as verified local signup addresses.
- Expose the new setting via public settings for anonymous callers.
- Remove the pending flow or collapse it back into direct auto-registration for all OIDC signups.

## Decisions

### 1. Scope the bypass to OIDC and default it to secure behavior

The new setting is `oidc_connect_require_local_email_verification`, and its default value is `true`.

Why:
- Only OIDC currently carries an explicit `email_verified` semantic that can support a justified trust decision.
- A `true` default preserves current behavior for all existing deployments until an admin opts out deliberately.

Alternative considered:
- A global third-party or public-signup setting. Rejected because it would weaken providers that do not expose equivalent verified-email guarantees.

### 2. Compute `local_email_verification_required` on the server and carry it in the pending session response

The backend evaluates the pending OIDC session using provider type, setting value, `email_verified`, the trusted `compat_email`, synthetic-email filtering, and the user-submitted email. It then returns `local_email_verification_required` in the completion payload.

Why:
- The bypass rule depends on session-local upstream claims, not only on static settings.
- The frontend should react to an authoritative backend decision instead of duplicating trust logic.

Alternative considered:
- Fetch the admin or public setting in the browser and derive the rule client-side. Rejected because the client does not own all trust inputs and would be easier to desynchronize from backend enforcement.

### 3. Trust only verified, non-synthetic `compat_email` values

The trusted email source is `compat_email`, and the backend refuses to treat synthetic OIDC placeholder emails as trusted local signup addresses.

Why:
- `compat_email` is the current branch's best representation of a locally meaningful upstream email.
- Synthetic emails are useful as internal identifiers but should not suppress local verification.

Alternative considered:
- Trust the generic upstream `email` claim whenever present. Rejected because that field can be synthetic or provider-dependent.

### 4. Hide verification UI only while the form email still matches the trusted OIDC email

The shared pending OAuth create-account form hides the verification-code input, send-code button, success hint, and Turnstile challenge only when the backend says verification is not required and the current form email still equals the trusted OIDC email. Editing the email restores the verification controls.

Why:
- This preserves the security boundary when a user switches to a different email.
- It keeps the UI aligned with the server-side rule instead of turning the bypass into a permanent screen-level state.

Alternative considered:
- Hide verification controls unconditionally whenever the setting is off. Rejected because the bypass must not survive an email change.

## Risks / Trade-offs

- [Admin disables local verification for an OIDC provider that should not be trusted] -> Mitigation: keep the setting admin-only, default it to `true`, and scope it to providers with explicit OIDC verification semantics.
- [Backend and frontend disagree about whether verification is required] -> Mitigation: use the server-produced `local_email_verification_required` field as the frontend's source of truth and keep backend enforcement in `RegisterOAuthEmailAccount`.
- [Synthetic or empty trusted email accidentally disables verification] -> Mitigation: reject synthetic-domain trusted emails and require a concrete `compat_email`.
- [Future providers copy this flow without equivalent trust data] -> Mitigation: keep the policy explicitly OIDC-specific in both naming and requirements.

## Migration Plan

1. Keep the default setting value at `true` during rollout so existing deployments retain current behavior.
2. Allow operators to opt out of duplicate verification only after confirming their OIDC provider's `email_verified` semantics are trustworthy.
3. Roll back by flipping the setting back to `true`; no data migration is required because the bypass is evaluated per pending session.

## Open Questions

- Should a future backend cleanup emit `create_account_required` instead of a chooser-like state when an OIDC session is known to be non-bindable, so the UI needs fewer heuristics?
- If another provider later exposes trustworthy verified-email semantics, should it receive its own provider-specific setting rather than broadening this OIDC setting?
