## Why

External payment and provisioning systems need to create AI-usable API keys for a specific Sub2API user after an admin-approved workflow. Before this change, those integrations could adjust balances through Admin API Key authentication, but could not create a user API key without acting as the user.

External sidecars also need to repair or migrate keys that were originally created under the wrong owner. The current upstream admin key update path only updates group binding and rate-limit windows; extra `user_id`, `quota`, or `reset_quota` fields sent by a sidecar are ignored, and the user-facing `/keys` path rejects attempts to update keys owned by another user. This leaves no reliable Admin API surface for moving an existing API key to the correct user or clearing key quota usage after transfer.

## What Changes

- Add an admin-authenticated API for creating a target user's API key.
- Require the target user to be identified by the admin user-resource URL.
- Accept the same creation fields used by the user key flow: name, group binding, optional custom key, IP restrictions, quota, rolling rate limits, and expiration.
- Reuse existing API key validation and creation behavior for key format, uniqueness, IP validation, quota, rate-limit defaults, and generated keys.
- Preserve group access rules while allowing admin creation to auto-grant missing access for exclusive standard groups.
- Require active subscription access when creating a key for a subscription group.
- Keep the endpoint idempotent through the existing admin idempotency mechanism.
- Add an explicit admin-authenticated transfer endpoint for existing API keys.
- Require transfer requests to identify the target owner as `target_user_id` and optionally update `target_group_id`, `quota`, and `reset_quota`.
- Persist transfer updates to `api_keys.user_id`, `group_id`, `quota`, `quota_used`, and `status` in one transaction with target user/group validation.
- Invalidate API key auth cache after successful transfer so subsequent gateway authentication observes the new owner and quota state.

## Capabilities

### New Capabilities
- `admin-user-api-key-creation`: External systems can create AI-usable API keys for target users through Admin API Key authentication.
- `admin-user-api-key-transfer`: External systems can transfer an existing AI-usable API key to a target user through Admin API Key authentication.

### Modified Capabilities
- None.

## Impact

- Backend admin routes and handlers
- Admin service API and construction wiring
- API key repository update methods for owner/quota/status transfer fields
- API key service internals to allow shared creation logic for an already-loaded user
- Admin/payment integration documentation
- Handler, service, route, and mock-data HTTP contract tests

## Fork Touchpoints

### New Files
- _None._ All changes are patches into existing upstream files.

### Upstream Patch Files
- `backend/cmd/server/wire_gen.go`: wire-regenerated to inject the new handler.
- `backend/internal/handler/admin/apikey_handler.go`: adds `AdminAPIKeyHandler.CreateForUser`, `AdminAPIKeyHandler.Transfer`, `AdminCreateUserAPIKeyRequest`, and `AdminTransferAPIKeyRequest` DTOs.
- `backend/internal/handler/admin/admin_basic_handlers_test.go`: route coverage for the new create and transfer endpoints.
- `backend/internal/handler/admin/admin_service_stub_test.go`: stub interface extended with `CreateUserAPIKey` and `TransferAPIKey`.
- `backend/internal/repository/api_key_repo.go`: adds a transfer-safe update path that can persist owner, group, quota, quota usage, and status together; `Create` resolves its client via `clientFromContext` so the admin exclusive-group auto-grant and the key insert commit (or roll back) in the same transaction.
- `backend/internal/repository/api_key_repo_integration_test.go`: verifies normal `Update` still preserves owner while the new transfer path can change owner and quota fields.
- `backend/internal/server/routes/admin.go`: registers `POST /api/v1/admin/users/:id/api-keys` (`users.POST("/:id/api-keys", h.Admin.APIKey.CreateForUser)`) and `POST /api/v1/admin/api-keys/:id/transfer`.
- `backend/internal/server/api_contract_test.go`: contract rows for the new admin endpoints.
- `backend/internal/service/admin_service.go`: declares `CreateUserAPIKey`/`TransferAPIKey` on the `AdminService` interface, the input/result types, and the `apiKeyService` dependency wiring.
- `backend/internal/service/admin_user.go`: implements `adminServiceImpl.CreateUserAPIKey` and `TransferAPIKey` (upstream split user-facing impls out of `admin_service.go`); both create and transfer reject a negative `quota` (which would otherwise be silently treated as unlimited by `IsQuotaExhausted`).
- `backend/internal/service/admin_service_apikey_test.go`: service unit tests for creation, group update, transfer validation, quota reset, and cache invalidation.
- `backend/internal/service/api_key_service.go`: exposes shared creation core so admin path can reuse it without acting as the user, and extends repository contracts for transfer.
- `backend/internal/server/middleware/api_key_auth_test.go`: repo stub implements `TransferUpdate` (interface-extension fallout).
- `backend/internal/server/middleware/api_key_auth_google_test.go`: same.
- `backend/internal/service/api_key_service_cache_test.go`: same.
- `backend/internal/service/api_key_service_delete_test.go`: same.
- `backend/internal/service/api_key_service_quota_test.go`: same.
- `docs/ADMIN_PAYMENT_INTEGRATION_API.md`: endpoint documentation for payment integrators and sidecars.
- `README.md`: fork-additions blurb for admin key provisioning and transfer (also shared, see below).
- `README_CN.md`: Chinese counterpart of the fork-additions blurb (also shared, see below); listed here so `fork_overlay.py verify` diff-checks its content — this patch was silently lost once because shared-only entries are not content-checked.

### Shared Touchpoints
- `README.md`: also owned by `add-external-custom-menu-token-open` — both changes append a feature blurb section, do not delete the other change's paragraph during rebase.
- `README_CN.md`: also owned by `add-external-custom-menu-token-open` — same reason as above.

### Non-OpenSpec Overlap
- _None._ This change does not touch infra/CI/docker fork areas.
