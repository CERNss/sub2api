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
