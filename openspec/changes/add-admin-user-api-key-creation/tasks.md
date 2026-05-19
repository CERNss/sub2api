## 1. Admin API Surface

- [x] 1.1 Add `POST /api/v1/admin/users/:id/api-keys` under existing admin authentication.
- [x] 1.2 Parse the target user ID from the URL and accept create-key modal fields in the request body.
- [x] 1.3 Wrap creation in admin idempotent JSON handling.

## 2. Service Behavior

- [x] 2.1 Add an admin service method for creating a target user's API key.
- [x] 2.2 Reuse existing API key creation validation and persistence logic.
- [x] 2.3 Auto-grant missing access for exclusive standard groups.
- [x] 2.4 Require active subscription for subscription group binding.
- [x] 2.5 Preserve inactive group rejection and existing key/IP validation behavior.

## 3. Wiring and Documentation

- [x] 3.1 Wire the API key service into admin service construction.
- [x] 3.2 Register the new admin user API key route.
- [x] 3.3 Document the endpoint, headers, request body, response key path, and curl examples.

## 4. Verification

- [x] 4.1 Add handler coverage for the admin create route.
- [x] 4.2 Add service coverage for exclusive group auto-grant and subscription group rejection.
- [x] 4.3 Add mock-data HTTP coverage using real Admin API Key authentication.
- [x] 4.4 Run targeted backend tests and full backend test suite.
