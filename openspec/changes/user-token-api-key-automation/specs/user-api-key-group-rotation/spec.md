## ADDED Requirements

### Requirement: Users SHALL be able to rotate only the group binding of their own API key
The API SHALL expose `PUT /api/v1/keys/:id/group` accepting a `group_id`, which re-binds the key to the requested group after validating that the caller owns the key, the `group_id` is non-negative, and the group is available to the caller.

#### Scenario: Successful rotation changes nothing but the group
- **WHEN** a key owner submits a valid, available `group_id`
- **THEN** the key's bound group SHALL change
- **AND** the key value, quota, quota_used, expiration, IP ACL, status, and rate limit SHALL remain unchanged

#### Scenario: Non-owner is rejected
- **WHEN** a user submits a rotation for a key they do not own
- **THEN** the request SHALL be rejected and the key SHALL be unchanged

#### Scenario: Invalid or unavailable group is rejected
- **WHEN** the submitted `group_id` is negative, or names a group not available to the caller
- **THEN** the request SHALL be rejected and the key SHALL be unchanged

### Requirement: Group rotation SHALL be covered by the API contract test
The contract test suite SHALL include rows for `PUT /api/v1/keys/:id/group` and `GET /api/v1/groups/available`. Token login aliases are exempt from the contract harness (its `authService` is nil) and SHALL instead be locked by the route-registration test.

#### Scenario: Contract rows exist
- **WHEN** the API contract test enumerates user-side key endpoints
- **THEN** key group rotation and available-group listing SHALL be present
