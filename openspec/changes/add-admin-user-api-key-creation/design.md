## Context

Sub2API already has a user-facing key creation flow that validates custom keys, IP restrictions, quota, rolling rate limits, expiration, and group binding. Admin integrations already authenticate with the configured Admin API Key through `x-api-key` for payment-related operations.

This change adds a narrow admin surface for external systems that know the target user ID and need to provision a key for that user. The created key must be usable by the normal AI gateway paths, so it should be stored as an ordinary user API key instead of introducing a separate credential type.

The existing upstream admin key update route is intentionally narrow: it only changes group binding and can reset rolling rate-limit usage. Its request DTO does not include `user_id`, `quota`, or `reset_quota`, the admin service interface has no owner-transfer operation, and the repository `Update` method deliberately leaves `user_id` unchanged. The user-facing key update path also verifies ownership, so an admin sidecar cannot repair a mis-owned key by calling `/keys` with an Admin API Key.

## Goals / Non-Goals

**Goals:**

- Let an external admin integration create a normal API key for a specific user.
- Let an external admin integration transfer an existing normal API key to the correct user.
- Keep request fields aligned with the existing create-key modal and user API key create request.
- Reuse existing API key validation and persistence behavior.
- Persist owner, group, quota, quota usage, and status transfer fields atomically.
- Keep subscription group access stricter than standard exclusive group access.
- Support retry-safe external calls through idempotency.
- Invalidate gateway auth cache after admin key creation, group update, quota reset, or owner transfer operations.

**Non-Goals:**

- Add a frontend admin modal for this operation.
- Create a new API key type or alternate gateway authentication path.
- Bypass custom-key, IP, quota, rate-limit, or group validation.
- Allow subscription group creation without an active subscription.
- Overload `PUT /api/v1/admin/api-keys/:id` with owner-transfer semantics.

## Decisions

### 1. Target user comes from the admin user-resource URL

The endpoint uses `POST /api/v1/admin/users/:id/api-keys`, where `:id` is the target user ID. This matches existing admin user resource routes and keeps the body focused on key creation fields.

### 2. Existing key owner transfer uses a dedicated action endpoint

The transfer endpoint uses `POST /api/v1/admin/api-keys/:id/transfer`. The API key being moved is selected by `:id`; the target owner is selected by body field `target_user_id`. Optional body fields are:

- `target_group_id`: `null` or omitted means keep the current group, `0` unbinds the group, and a positive ID binds the target group.
- `quota`: omitted means preserve the current quota, `0` means unlimited, and a positive value sets the new quota.
- `reset_quota`: when `true`, resets `quota_used` to `0` and reactivates keys that are only disabled by quota exhaustion.

This keeps the existing `PUT /api/v1/admin/api-keys/:id` route scoped to group binding and rate-limit reset, and prevents sidecars from depending on ignored fields in that legacy DTO.

### 3. Reuse APIKeyService creation logic

The admin service loads the target user, performs admin-specific group access preparation, then calls shared API key creation logic. This avoids duplicating custom key validation, uniqueness checks, generated-key behavior, IP rule validation, expiration, and rate-limit field handling.

### 4. Reuse group access semantics for transfer

Transfer validates the target user before mutating the key. If the resulting group is a subscription group, the target user must have an active subscription for that group. If the resulting group is an exclusive standard group, the service may auto-grant that group to the target user's allowed groups, matching admin create behavior. Inactive groups are rejected.

### 5. Add a repository method for transfer-visible fields

The normal API key repository `Update` method should continue preserving `user_id`; existing tests assert that behavior. Transfer therefore needs an explicit repository operation, or an explicit service-owned transaction using the Ent client, that can update `user_id`, `group_id`, `quota`, `quota_used`, and `status` together for a non-deleted key. This avoids weakening the safety properties of normal user-facing updates.

### 6. Transfer is transaction-protected

When transfer includes an exclusive standard group auto-grant, the user allowed-group update and API key update run in the same transaction. The same transaction also persists quota and status changes, so a sidecar never observes an owner change without the intended quota reset or group binding.

### 7. Cache invalidation follows commit

After successful transfer commit, the service invalidates authentication cache by the API key value. This is required because cached gateway auth entries include `user_id`, group, quota, quota usage, and status fields. Rate-limit cache invalidation is only required when rate-limit windows are reset; transfer itself does not reset rolling rate-limit usage unless a later requirement adds that body field.

### 8. Auto-grant only exclusive standard groups

When an admin integration binds an exclusive standard group and the user lacks access, the service grants that group before creating the key. For subscription groups, the service requires an active subscription and returns a business error when none exists.

### 9. Use admin idempotency

The handler wraps creation and transfer in the existing admin idempotent JSON helper. External systems should provide a stable `Idempotency-Key` per business operation so retries do not create duplicate keys or repeat a transfer with a drifted payload.

## Risks / Trade-offs

- Custom key material is returned in the response body just like the user create-key flow. Callers must store it immediately and avoid logging it.
- In tests that construct the admin service without an Ent client, exclusive group auto-grant cannot be transaction-protected. Production construction provides the Ent client and wraps group grant plus key creation in one transaction.
- Auto-granting standard exclusive group access is convenient for provisioning, but operators should still treat group IDs as privileged configuration.
- Owner transfer can affect historical attribution in views that join usage logs through the current API key owner. The implementation should not rewrite usage logs as part of this change.
- Clearing `quota_used` is intentionally explicit through `reset_quota`; transfer without that flag preserves usage to avoid accidental free resets.

## Migration Plan

No database migration is required. Deploy the backend routes, service wiring, repository transfer update, tests, and docs together. Rollback is to remove or stop calling the new admin endpoints; existing user-created keys and group rules are unchanged. Keys already transferred before rollback remain assigned to their persisted owner.
