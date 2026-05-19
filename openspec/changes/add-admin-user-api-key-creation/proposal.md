## Why

External payment and provisioning systems need to create AI-usable API keys for a specific Sub2API user after an admin-approved workflow. Before this change, those integrations could adjust balances through Admin API Key authentication, but could not create a user API key without acting as the user.

## What Changes

- Add an admin-authenticated API for creating a target user's API key.
- Require the target user to be identified by the admin user-resource URL.
- Accept the same creation fields used by the user key flow: name, group binding, optional custom key, IP restrictions, quota, rolling rate limits, and expiration.
- Reuse existing API key validation and creation behavior for key format, uniqueness, IP validation, quota, rate-limit defaults, and generated keys.
- Preserve group access rules while allowing admin creation to auto-grant missing access for exclusive standard groups.
- Require active subscription access when creating a key for a subscription group.
- Keep the endpoint idempotent through the existing admin idempotency mechanism.

## Capabilities

### New Capabilities
- `admin-user-api-key-creation`: External systems can create AI-usable API keys for target users through Admin API Key authentication.

### Modified Capabilities
- None.

## Impact

- Backend admin routes and handlers
- Admin service API and construction wiring
- API key service internals to allow shared creation logic for an already-loaded user
- Admin/payment integration documentation
- Handler, service, route, and mock-data HTTP contract tests

## Fork Touchpoints

### New Files
- _None._ All changes are patches into existing upstream files.

### Upstream Patch Files
- `backend/cmd/server/wire_gen.go`: wire-regenerated to inject the new handler.
- `backend/internal/handler/admin/apikey_handler.go`: adds `AdminAPIKeyHandler.CreateForUser` and `AdminCreateUserAPIKeyRequest` DTO.
- `backend/internal/handler/admin/admin_basic_handlers_test.go`: route coverage for the new endpoint.
- `backend/internal/handler/admin/admin_service_stub_test.go`: stub interface extended with `CreateUserAPIKey`.
- `backend/internal/server/routes/admin.go`: registers `POST /api/v1/admin/users/:id/api-keys` (`users.POST("/:id/api-keys", h.Admin.APIKey.CreateForUser)`).
- `backend/internal/server/api_contract_test.go`: contract rows for the new admin endpoint.
- `backend/internal/service/admin_service.go`: adds `adminServiceImpl.CreateUserAPIKey`, `CreateUserAPIKeyInput`, `CreateUserAPIKeyResult`.
- `backend/internal/service/admin_service_apikey_test.go`: service unit tests.
- `backend/internal/service/api_key_service.go`: exposes shared creation core so admin path can reuse it without acting as the user.
- `docs/ADMIN_PAYMENT_INTEGRATION_API.md`: endpoint documentation for payment integrators.

### Shared Touchpoints
- `README.md`: also owned by `add-external-custom-menu-token-open` — both changes append a feature blurb section, do not delete the other change's paragraph during rebase.
- `README_CN.md`: also owned by `add-external-custom-menu-token-open` — same reason as above.

### Non-OpenSpec Overlap
- _None._ This change does not touch infra/CI/docker fork areas.
