# admin-user-api-key-creation Specification

## Purpose
Define how admin-authenticated external systems create normal AI-usable API keys for a specific Sub2API user.

## ADDED Requirements

### Requirement: Admin integrations SHALL create API keys for a target user
The system SHALL expose an admin-authenticated endpoint that creates a normal user API key for the target user identified by the admin user-resource URL.

#### Scenario: Admin API Key creates a minimal user API key
- **GIVEN** the configured Admin API Key is `admin-live`
- **AND** user `123` exists
- **WHEN** an external system sends `POST /api/v1/admin/users/123/api-keys`
- **AND** the request includes header `x-api-key: admin-live`
- **AND** the request body includes `name`
- **THEN** the system SHALL create an active API key owned by user `123`
- **AND** the response SHALL include the full usable key at `data.api_key.key`
- **AND** the response SHALL include `data.api_key.user_id` equal to `123`

#### Scenario: Invalid Admin API Key is rejected
- **GIVEN** the configured Admin API Key is `admin-live`
- **WHEN** an external system sends `POST /api/v1/admin/users/123/api-keys`
- **AND** the request includes an invalid `x-api-key`
- **THEN** the system SHALL reject the request
- **AND** no user API key SHALL be created

#### Scenario: Target user is selected from the URL
- **WHEN** an external system sends `POST /api/v1/admin/users/123/api-keys`
- **THEN** the system SHALL treat `123` as the target user ID
- **AND** the request body SHALL NOT need a separate `user_id` field

### Requirement: Admin-created keys SHALL support the same creation fields as the user key flow
The admin endpoint SHALL accept the same key creation controls used by the user create-key flow where applicable.

#### Scenario: Full create-key modal fields are supplied
- **GIVEN** user `123` exists
- **WHEN** an admin-authenticated request creates a key with `name`, `group_id`, `custom_key`, `ip_whitelist`, `ip_blacklist`, `quota`, `rate_limit_5h`, `rate_limit_1d`, `rate_limit_7d`, and `expires_in_days`
- **THEN** the system SHALL persist those values on the created API key
- **AND** the key SHALL be usable through the normal AI API key authentication path

#### Scenario: Optional controls are omitted
- **WHEN** an admin-authenticated request creates a key with only `name`
- **THEN** the system SHALL generate a key value automatically
- **AND** it SHALL create the key without IP restrictions
- **AND** it SHALL treat quota and rolling rate limits as unlimited
- **AND** it SHALL leave the key without expiration

#### Scenario: Existing API key validation is enforced
- **WHEN** an admin-authenticated request includes a custom key or IP restriction
- **THEN** the system SHALL enforce the existing custom key format, uniqueness, and IP/CIDR validation rules
- **AND** invalid input SHALL prevent API key creation

### Requirement: Admin key creation SHALL respect group access rules
The admin endpoint SHALL preserve the existing group binding semantics while allowing provisioning-friendly standard exclusive group access.

#### Scenario: Exclusive standard group access is auto-granted
- **GIVEN** user `123` does not have access to exclusive standard group `20`
- **WHEN** an admin-authenticated request creates a key for user `123` with `group_id` equal to `20`
- **THEN** the system SHALL add group `20` to the user's allowed groups
- **AND** it SHALL create the API key bound to group `20`
- **AND** the response SHALL include `auto_granted_group_access` as `true`

#### Scenario: Subscription group requires active subscription
- **GIVEN** user `123` has no active subscription for subscription group `30`
- **WHEN** an admin-authenticated request creates a key for user `123` with `group_id` equal to `30`
- **THEN** the system SHALL reject the request with a subscription-required business error
- **AND** it SHALL NOT create the API key
- **AND** it SHALL NOT grant group access as a side effect

#### Scenario: Inactive group is rejected
- **GIVEN** group `40` is inactive
- **WHEN** an admin-authenticated request creates a key with `group_id` equal to `40`
- **THEN** the system SHALL reject the request
- **AND** it SHALL NOT create the API key

### Requirement: Admin key creation SHALL be retry-safe
The admin endpoint SHALL participate in the existing admin idempotency mechanism.

#### Scenario: Retried request uses the same idempotency key
- **GIVEN** an admin-authenticated request creates a user API key with `Idempotency-Key: create-api-key-user-123-order-1`
- **WHEN** the external system retries the same request with the same idempotency key and payload
- **THEN** the system SHALL return the same logical result
- **AND** it SHALL NOT create duplicate API keys for the same operation
