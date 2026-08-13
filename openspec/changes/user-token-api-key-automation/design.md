## Context

Integrators kept asking for a way to provision API keys for themselves without admin involvement: log in as the user, get a JWT, create/rotate keys bound to whatever groups that user can already use. The admin-side path (`add-admin-user-api-key-creation`) covers payment-triggered provisioning; this change covers user-side self-service. It shipped as code + FORK.md entry only; this directory backfills the OpenSpec record.

## Goals / Non-Goals

**Goals:**
- Automation-friendly token endpoints that are pure aliases of the canonical auth flow — zero behavioral drift from the SPA login.
- A group-rotation endpoint narrow enough to hand to a sidecar: it can re-bind a key's group and nothing else.
- Route-level regression coverage that survives upstream auth refactors.

**Non-Goals:**
- No new authentication mechanism, scopes, or token format — a token alias returns exactly what `/auth/login` returns.
- No bypass of Turnstile, TOTP 2FA, backend-mode, or user-status checks.
- No user-side mutation of key value, quota, expiration, IP ACL, status, or rate limits.

## Decisions

### 1. Aliases over new handlers

`/auth/token*` routes point at the same handler functions as the canonical endpoints, so every guard and future upstream fix applies automatically. The cost is that the alias names are only as stable as upstream's handler signatures — acceptable, and locked by a route-registration test.

### 2. Group rotation as its own endpoint instead of widening the generic key update

A dedicated `PUT /keys/:id/group` keeps the automation permission story auditable: the sidecar can be reasoned about as "can only re-point the key's group". Validation lives in `apiKeyService.UpdateGroup` (owner, non-negative id, group availability) so the handler stays thin.

### 3. Contract-test coverage split

The API contract harness constructs the server with a nil `authService`, so the login-path aliases cannot execute there. Rather than weakening the harness, the aliases are pinned by `auth_token_alias_routes_test.go` at route-registration level (same handler identity), and the contract test covers only the group-rotation and available-groups rows.
