## ADDED Requirements

### Requirement: The backend SHALL decide whether pending OIDC account creation still requires local email verification
The backend SHALL evaluate pending OIDC account creation with an OIDC-specific policy. Local email verification SHALL remain required unless all of the following are true: the provider type is OIDC, the admin setting `oidc_connect_require_local_email_verification` is `false`, the upstream OIDC claims mark the email as verified, a non-synthetic trusted `compat_email` exists, and the submitted local email matches that trusted email.

#### Scenario: Default policy keeps local verification enabled
- **WHEN** the setting `oidc_connect_require_local_email_verification` is absent or `true`
- **THEN** pending OIDC account creation SHALL require a local email verification code
- **AND** the backend SHALL NOT suppress local verification only because upstream claims contain an email

#### Scenario: Unverified upstream email still requires local verification
- **WHEN** the setting `oidc_connect_require_local_email_verification` is `false` but the upstream OIDC claims do not mark the email as verified
- **THEN** pending OIDC account creation SHALL still require a local email verification code

#### Scenario: Synthetic trusted email still requires local verification
- **WHEN** the setting is `false` but the trusted email candidate is empty or belongs to the synthetic OIDC email domain
- **THEN** pending OIDC account creation SHALL still require a local email verification code

#### Scenario: Changing the email restores local verification
- **WHEN** the setting is `false`, upstream OIDC claims include a verified non-synthetic `compat_email`, and the user submits a different email address
- **THEN** pending OIDC account creation SHALL require a local email verification code for the new email

### Requirement: Pending OIDC completion responses SHALL expose the local verification requirement to the client
When the backend returns a pending OIDC completion response for create-account or chooser flows, it SHALL include the session-specific field `local_email_verification_required` so the client can render the correct verification UI for the current trusted email state.

#### Scenario: Trusted verified compat email disables local verification in the pending response
- **WHEN** an OIDC pending session has a verified non-synthetic `compat_email` and the setting `oidc_connect_require_local_email_verification` is `false`
- **THEN** the backend SHALL return `local_email_verification_required = false` in the pending completion response before the user edits the email

#### Scenario: Other providers keep local verification required
- **WHEN** a pending account-creation session belongs to a provider other than OIDC
- **THEN** the backend SHALL treat local email verification as required
- **AND** the OIDC-specific bypass policy SHALL NOT apply

### Requirement: OIDC account creation SHALL enforce the server-side verification policy during registration
The create-account endpoint SHALL use the evaluated OIDC local-verification policy when creating a local account from a pending OIDC session. It SHALL skip local code verification only when the policy explicitly says local verification is not required.

#### Scenario: Trusted verified OIDC email can create an account without a local code
- **WHEN** a pending OIDC session has a verified non-synthetic trusted `compat_email`, the setting is `false`, and the submitted email matches that trusted email
- **THEN** the create-account endpoint SHALL allow account creation without a submitted local verification code
- **AND** it SHALL still apply the rest of the local registration checks such as registration enablement, invitation rules, email policy, and duplicate-email checks

#### Scenario: Mismatched trusted email still demands local code at account creation
- **WHEN** the submitted email no longer matches the trusted verified `compat_email`
- **THEN** the create-account endpoint SHALL require local email verification before creating the local account

### Requirement: The OIDC create-account UI SHALL track the server-side local verification decision
The OIDC callback flow and shared pending create-account form SHALL treat `local_email_verification_required` as the source of truth for verification UI. They SHALL hide local verification controls only while the current form email still matches the trusted OIDC email for which the server waived local verification.

#### Scenario: Trusted OIDC email hides verification controls
- **WHEN** the pending OIDC completion payload reports `local_email_verification_required = false` and the initial form email equals the trusted OIDC email
- **THEN** the create-account form SHALL hide the verification-code input
- **AND** it SHALL hide the send-code action, verification hint, and Turnstile challenge

#### Scenario: Editing the email restores verification controls
- **WHEN** the create-account form started with verification hidden but the user edits the email to a different value
- **THEN** the form SHALL show the verification-code input again
- **AND** it SHALL restore the send-code action and Turnstile gating needed to verify the new email
