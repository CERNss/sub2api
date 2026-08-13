# User token API key automation

## Why

External user-side sidecars and self-service provisioning systems need to log in as a normal user, exchange credentials for a JWT, and then — strictly within that user's own permission envelope — create API keys, list available groups, and rotate which group an existing key is bound to. Upstream only exposes the SPA-oriented login endpoints and no narrow group-rotation path, so integrators would otherwise need admin credentials or brittle UI automation.

> Retroactive registration: the feature landed earlier (`233474014` feat(auth), `427fa09c4` test(routes)) and was tracked only as a FORK.md entry. This change directory backfills the OpenSpec record so `tools/fork_overlay.py` snapshot/verify actually guard it during upstream rebases — a whole-change blind spot found on 2026-08-13.

## What Changes

- Register `POST /api/v1/auth/token`, `POST /api/v1/auth/token/2fa`, and `POST /api/v1/auth/token/refresh` as automation-friendly aliases that reuse the canonical login, TOTP 2FA, and refresh handlers unchanged — Turnstile, TOTP, backend-mode, and user-status checks all still apply.
- Add `PUT /api/v1/keys/:id/group` for user-side key group rotation: validates key ownership, non-negative `group_id`, and that the group is available to the user; changes only the binding, never the key value, quota, expiration, IP ACL, status, or rate limit.
- Frontend API helpers: `exchangeToken`, `exchangeToken2FA`, `refreshTokenViaTokenEndpoint` (`auth.ts`) and `updateGroup` (`keys.ts`).
- README documents the automation flow, available endpoints, key creation, and group rotation.

## Capabilities

### New Capabilities
- `user-token-api-key-automation`: token login aliases reusing canonical auth handlers with all guards intact.
- `user-api-key-group-rotation`: narrow group-only rotation of a user's own API key.

### Modified Capabilities
- None.

## Impact

- Backend routes (`auth.go`, `user.go`), API key handler/service, API contract tests
- Frontend `auth.ts` / `keys.ts` helpers
- README automation section

## Fork Touchpoints

### New Files
- `backend/internal/service/api_key_service_group_test.go`: user key group rotation service tests.
- `backend/internal/server/routes/auth_token_alias_routes_test.go`: locks the three token login aliases at route-registration level and asserts they reuse the canonical endpoints' handlers.

### Upstream Patch Files
- `backend/internal/server/routes/auth.go`: registers `POST /api/v1/auth/token`, `/auth/token/2fa`, `/auth/token/refresh` as login/token aliases.
- `backend/internal/server/routes/user.go`: registers `PUT /api/v1/keys/:id/group`.
- `backend/internal/handler/api_key_handler.go`: `UpdateGroup` handler + `group_id` request DTO.
- `backend/internal/service/api_key_service.go`: `UpdateGroup` validates key owner, non-negative group_id, user-available groups, and keeps every other key field unchanged.
- `backend/internal/server/api_contract_test.go`: contract rows for key group rotation (`PUT /keys/:id/group`) and `GET /groups/available`. ⚠ token aliases are NOT covered here — the harness's `authService` is nil, so the `Login` path cannot run; the aliases are locked by `routes/auth_token_alias_routes_test.go` instead.
- `frontend/src/api/auth.ts`: `exchangeToken`, `exchangeToken2FA`, `refreshTokenViaTokenEndpoint` helpers.
- `frontend/src/api/keys.ts`: `updateGroup` helper.
- `README.md`: user token automation flow, endpoints, key creation and group rotation docs (also shared, see below).

### Shared Touchpoints
- `backend/internal/service/api_key_service.go`: also owned by `add-admin-user-api-key-creation` — keep both the shared admin creation/transfer core and the user-side `UpdateGroup`.
- `backend/internal/server/api_contract_test.go`: also owned by `add-admin-user-api-key-creation` — keep both changes' contract rows.
- `README.md`: also owned by `add-admin-user-api-key-creation` (and `add-external-custom-menu-token-open`) — each change appends its own feature blurb; keep all of them.

### Non-OpenSpec Overlap
- _None._
