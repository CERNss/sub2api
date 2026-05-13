## ADDED Requirements

### Requirement: Admin settings SHALL persist an OIDC-specific local email verification flag
The system SHALL store an admin setting named `oidc_connect_require_local_email_verification` and SHALL default it to `true`. This flag SHALL control whether pending OIDC account creation still requires a local verification code when the upstream provider has already verified a trusted email.

#### Scenario: Default settings keep the flag enabled
- **WHEN** system settings are initialized without an explicit stored value for `oidc_connect_require_local_email_verification`
- **THEN** the effective value SHALL be `true`

#### Scenario: Saved settings preserve an explicit disabled value
- **WHEN** an admin saves `oidc_connect_require_local_email_verification = false`
- **THEN** later reads of system settings SHALL return `false`
- **AND** the backend SHALL use that persisted value when evaluating pending OIDC verification policy

### Requirement: Admin settings APIs SHALL expose the OIDC local verification flag
The authenticated admin settings APIs and their DTOs SHALL include `oidc_connect_require_local_email_verification` in both read and write payloads so the frontend admin console can round-trip the setting without coercing it back to `true`.

#### Scenario: Get settings includes the flag
- **WHEN** an admin requests system settings
- **THEN** the response payload SHALL include `oidc_connect_require_local_email_verification`

#### Scenario: Save settings echoes the flag correctly
- **WHEN** an admin updates system settings with `oidc_connect_require_local_email_verification = false`
- **THEN** the save request handling SHALL persist that value
- **AND** the returned settings payload SHALL continue to report it as `false`

### Requirement: The admin OIDC settings UI SHALL expose the local verification flag
The admin frontend SHALL show `oidc_connect_require_local_email_verification` as an OIDC-specific toggle and SHALL preserve the backend value when loading and saving the settings form.

#### Scenario: Settings page reflects backend value
- **WHEN** the admin settings page loads an OIDC configuration where `oidc_connect_require_local_email_verification` is `false`
- **THEN** the OIDC local email verification toggle SHALL render in the disabled state

#### Scenario: Settings page includes the flag on save
- **WHEN** the admin settings form is submitted after loading a value of `false`
- **THEN** the frontend save payload SHALL include `oidc_connect_require_local_email_verification = false`
- **AND** it SHALL not coerce the flag back to `true` during save
