## Context

Sub2API already has a user-facing key creation flow that validates custom keys, IP restrictions, quota, rolling rate limits, expiration, and group binding. Admin integrations already authenticate with the configured Admin API Key through `x-api-key` for payment-related operations.

This change adds a narrow admin surface for external systems that know the target user ID and need to provision a key for that user. The created key must be usable by the normal AI gateway paths, so it should be stored as an ordinary user API key instead of introducing a separate credential type.

## Goals / Non-Goals

**Goals:**

- Let an external admin integration create a normal API key for a specific user.
- Keep request fields aligned with the existing create-key modal and user API key create request.
- Reuse existing API key validation and persistence behavior.
- Keep subscription group access stricter than standard exclusive group access.
- Support retry-safe external calls through idempotency.

**Non-Goals:**

- Add a frontend admin modal for this operation.
- Create a new API key type or alternate gateway authentication path.
- Bypass custom-key, IP, quota, rate-limit, or group validation.
- Allow subscription group creation without an active subscription.

## Decisions

### 1. Target user comes from the admin user-resource URL

The endpoint uses `POST /api/v1/admin/users/:id/api-keys`, where `:id` is the target user ID. This matches existing admin user resource routes and keeps the body focused on key creation fields.

### 2. Reuse APIKeyService creation logic

The admin service loads the target user, performs admin-specific group access preparation, then calls shared API key creation logic. This avoids duplicating custom key validation, uniqueness checks, generated-key behavior, IP rule validation, expiration, and rate-limit field handling.

### 3. Auto-grant only exclusive standard groups

When an admin integration binds an exclusive standard group and the user lacks access, the service grants that group before creating the key. For subscription groups, the service requires an active subscription and returns a business error when none exists.

### 4. Use admin idempotency

The handler wraps creation in the existing admin idempotent JSON helper. External systems should provide a stable `Idempotency-Key` per business operation so retries do not create duplicate keys.

## Risks / Trade-offs

- Custom key material is returned in the response body just like the user create-key flow. Callers must store it immediately and avoid logging it.
- In tests that construct the admin service without an Ent client, exclusive group auto-grant cannot be transaction-protected. Production construction provides the Ent client and wraps group grant plus key creation in one transaction.
- Auto-granting standard exclusive group access is convenient for provisioning, but operators should still treat group IDs as privileged configuration.

## Migration Plan

No database migration is required. Deploy the backend route, service wiring, tests, and docs together. Rollback is to remove or stop calling the new admin endpoint; existing user-created keys and group rules are unchanged.
