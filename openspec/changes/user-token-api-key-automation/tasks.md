## 1. Token login aliases

- [x] 1.1 Register `POST /api/v1/auth/token`, `/auth/token/2fa`, `/auth/token/refresh` as aliases of the canonical login/2FA/refresh handlers.
- [x] 1.2 Lock the alias registrations and handler identity in `routes/auth_token_alias_routes_test.go`.

## 2. Key group rotation

- [x] 2.1 Add `apiKeyService.UpdateGroup` with owner / non-negative id / available-group validation, leaving other key fields untouched.
- [x] 2.2 Expose `PUT /api/v1/keys/:id/group` via `APIKeyHandler.UpdateGroup` and register the route.
- [x] 2.3 Cover rotation in `api_key_service_group_test.go` and the API contract test (`PUT /keys/:id/group`, `GET /groups/available`).

## 3. Frontend + docs

- [x] 3.1 Add `exchangeToken` / `exchangeToken2FA` / `refreshTokenViaTokenEndpoint` and `updateGroup` API helpers.
- [x] 3.2 Document the automation flow in README.

## 4. Fork bookkeeping (2026-08-13 backfill)

- [x] 4.1 Backfill this OpenSpec change directory so fork_overlay snapshot/verify guard the patch set.
- [x] 4.2 Update FORK.md #5 (spec path + 关联 commits) and add reverse shared-touchpoint declarations to `add-admin-user-api-key-creation`.
- [x] 4.3 Snapshot to `docs/fork-snapshots/user-token-api-key-automation/` (manifest + patch).
