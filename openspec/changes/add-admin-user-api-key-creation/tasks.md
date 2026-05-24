## 1. Admin API Surface

- [x] 1.1 Add `POST /api/v1/admin/users/:id/api-keys` under existing admin authentication.
- [x] 1.2 Parse the target user ID from the URL and accept create-key modal fields in the request body.
- [x] 1.3 Wrap creation in admin idempotent JSON handling.
- [x] 1.4 Add `POST /api/v1/admin/api-keys/:id/transfer` under existing admin authentication.
- [x] 1.5 Parse the API key ID from the URL and accept `target_user_id`, optional `target_group_id`, optional `quota`, and optional `reset_quota`.
- [x] 1.6 Wrap transfer in admin idempotent JSON handling.

## 2. Service Behavior

- [x] 2.1 Add an admin service method for creating a target user's API key.
- [x] 2.2 Reuse existing API key creation validation and persistence logic.
- [x] 2.3 Auto-grant missing access for exclusive standard groups.
- [x] 2.4 Require active subscription for subscription group binding.
- [x] 2.5 Preserve inactive group rejection and existing key/IP validation behavior.
- [x] 2.6 Add an admin service method for transferring an existing API key to a target user.
- [x] 2.7 Validate the target user exists before mutating the API key.
- [x] 2.8 Apply target group semantics for transfer: omitted keeps the current group, `0` unbinds, positive values bind after validation.
- [x] 2.9 Reuse exclusive standard group auto-grant and subscription group checks against the target user.
- [x] 2.10 Persist transfer owner, group, quota, quota usage, and quota-exhausted status changes atomically.
- [x] 2.11 Invalidate API key auth cache after successful transfer.

## 3. Wiring and Documentation

- [x] 3.1 Wire the API key service into admin service construction.
- [x] 3.2 Register the new admin user API key route.
- [x] 3.3 Document the endpoint, headers, request body, response key path, and curl examples.
- [x] 3.4 Register the admin API key transfer route.
- [x] 3.5 Extend API key repository/service contracts with an explicit transfer update path that can change owner without weakening normal `Update`.
- [x] 3.6 Document transfer request fields, response confirmation fields, idempotency, quota reset behavior, and cache-visible result.

## 4. Verification

- [x] 4.1 Add handler coverage for the admin create route.
- [x] 4.2 Add service coverage for exclusive group auto-grant and subscription group rejection.
- [x] 4.3 Add mock-data HTTP coverage using real Admin API Key authentication.
- [x] 4.4 Run targeted backend tests and full backend test suite.
- [x] 4.5 Add handler coverage for the admin transfer route.
- [x] 4.6 Add service coverage for owner transfer, target user missing, group validation, exclusive group auto-grant, subscription rejection, quota reset, status reactivation, and auth cache invalidation.
- [x] 4.7 Add repository coverage proving normal `Update` preserves `user_id` while the explicit transfer update persists `user_id`, `group_id`, `quota`, `quota_used`, and `status`.
- [x] 4.8 Add mock-data HTTP coverage using real Admin API Key authentication for a transfer that confirms updated `user_id`, `quota`, and `quota_used`.
- [x] 4.9 Re-run targeted backend tests and full backend test suite.
