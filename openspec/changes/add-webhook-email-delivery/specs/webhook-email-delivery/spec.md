## ADDED Requirements

### Requirement: Email delivery SHALL support a webhook backend
The system SHALL allow administrators to select a webhook backend for messages sent through the shared email delivery path.

#### Scenario: Webhook backend selected
- **WHEN** the email delivery channel is configured as `webhook`
- **THEN** every normal shared email delivery request SHALL be sent to the configured webhook endpoint instead of SMTP
- **AND** the delivery request SHALL include the original recipient, subject, and HTML body.

#### Scenario: SMTP backend remains default
- **WHEN** no email delivery channel has been configured
- **THEN** the system SHALL use the existing SMTP backend behavior.

#### Scenario: Empty settings preserve SMTP behavior
- **WHEN** delivery settings are absent from storage
- **THEN** the effective email delivery channel SHALL be `smtp`
- **AND** sending email SHALL follow the same SMTP configuration and delivery behavior as before this change.

### Requirement: Webhook delivery SHALL proxy every shared email message
The webhook backend SHALL cover all messages that currently pass through the shared email service send path.

#### Scenario: Authentication message uses webhook
- **WHEN** a registration verification code, pending OAuth verification code, email-binding verification code, TOTP verification code, or password reset message is sent through the shared email service
- **THEN** the message SHALL be delivered through the configured webhook backend when webhook delivery is selected.

#### Scenario: Notification message uses webhook
- **WHEN** a notification email verification message, balance-low alert, account quota alert, Ops alert, or Ops scheduled report is sent through the shared email service
- **THEN** the message SHALL be delivered through the configured webhook backend when webhook delivery is selected.

### Requirement: Webhook configuration SHALL be validated and protected
The system SHALL validate webhook delivery settings before using them and SHALL avoid exposing stored secrets in settings responses.

#### Scenario: Webhook URL missing
- **WHEN** webhook delivery is selected and no webhook URL is configured
- **THEN** shared email delivery SHALL fail with a configuration error.

#### Scenario: Unsupported webhook URL scheme
- **WHEN** webhook delivery is selected with a URL that is not HTTP or HTTPS
- **THEN** the system SHALL reject the setting update before saving it.

#### Scenario: Non-local webhook URL uses HTTP in production
- **WHEN** webhook delivery is selected in production with an `http://` URL whose host is not localhost, 127.0.0.1, or ::1
- **THEN** the system SHALL reject the setting update before saving it.

#### Scenario: Local HTTP webhook is used for testing
- **WHEN** webhook delivery is selected with an `http://localhost`, `http://127.0.0.1`, or `http://[::1]` URL
- **THEN** the system SHALL allow the URL for local testing.

#### Scenario: Stored webhook secret exists
- **WHEN** an administrator retrieves settings after saving a webhook secret
- **THEN** the response SHALL expose a `webhook_secret_configured` boolean consistent with the existing SMTP password configured pattern
- **AND** it SHALL NOT return the secret value.

### Requirement: Webhook requests SHALL use a stable payload contract
The system SHALL send webhook requests using a documented JSON payload and configurable authentication behavior.

#### Scenario: Delivering via generic webhook payload
- **WHEN** a shared email message is delivered through webhook with payload format configured as `generic`
- **THEN** the system SHALL send an HTTP POST request with `Content-Type: application/json`
- **AND** the JSON payload SHALL include an event type, recipient, subject, HTML body, and timestamp.

#### Scenario: Delivering via Feishu-compatible payload
- **WHEN** a shared email message is delivered through webhook with payload format configured as `feishu`
- **THEN** the system SHALL send an HTTP POST request with `Content-Type: application/json`
- **AND** the JSON payload SHALL include Feishu-compatible `msg_type` and `content` fields
- **AND** the message content SHALL include the original subject and body information in a form readable inside Feishu.

#### Scenario: No authentication selected
- **WHEN** webhook authentication mode is configured as `none`
- **THEN** the system SHALL send the webhook request without an authentication header.

#### Scenario: Bearer authentication selected
- **WHEN** webhook authentication mode is configured as `bearer` and a webhook secret is configured
- **THEN** the system SHALL include the secret in an `Authorization: Bearer <secret>` header
- **AND** logs and settings responses SHALL NOT expose the secret.

#### Scenario: Custom header authentication selected
- **WHEN** webhook authentication mode is configured as `header` with a header name and secret
- **THEN** the system SHALL include the secret in the configured header
- **AND** it SHALL reject unsafe header names before attempting delivery.

#### Scenario: Signature authentication selected
- **WHEN** webhook authentication mode is configured as `signature` and a webhook secret is configured
- **THEN** the system SHALL include timestamp and signature headers derived from the request body and secret
- **AND** the signature contract SHALL be stable and documented for webhook receivers.

#### Scenario: Feishu signature authentication selected
- **WHEN** webhook authentication mode is configured as `feishu_signature` and a webhook secret is configured
- **THEN** the system SHALL include Feishu-compatible `timestamp` and `sign` fields in the JSON request body
- **AND** it SHALL NOT add the generic signature headers for that request.

### Requirement: Webhook delivery SHALL NOT fall back to SMTP
The system SHALL treat webhook delivery as the authoritative delivery backend when webhook mode is selected.

#### Scenario: Webhook delivery fails
- **WHEN** webhook delivery is selected and the webhook endpoint fails, times out, or returns a non-2xx status
- **THEN** the system SHALL return a webhook delivery error
- **AND** it SHALL NOT attempt SMTP delivery for that message.

### Requirement: Webhook delivery SHALL report success only for successful HTTP responses
The system SHALL treat only successful webhook HTTP responses as successful message delivery.

#### Scenario: Webhook returns success
- **WHEN** the webhook endpoint returns a 2xx HTTP status
- **THEN** shared email delivery SHALL be treated as successful.

#### Scenario: Feishu webhook returns application success
- **WHEN** the webhook payload format is `feishu` and the endpoint returns a 2xx HTTP status with a JSON `code` field equal to 0
- **THEN** shared email delivery SHALL be treated as successful.

#### Scenario: Feishu webhook returns application failure
- **WHEN** the webhook payload format is `feishu` and the endpoint returns a JSON `code` field that is not 0
- **THEN** shared email delivery SHALL fail with an error that identifies Feishu webhook delivery failure without logging sensitive message content.

#### Scenario: Webhook returns failure
- **WHEN** the webhook endpoint returns a non-2xx HTTP status
- **THEN** shared email delivery SHALL fail with an error that identifies webhook delivery failure without logging sensitive message content.

#### Scenario: Webhook times out
- **WHEN** the webhook endpoint does not respond before the configured timeout
- **THEN** shared email delivery SHALL fail with a timeout error.

### Requirement: SMTP-specific test flows SHALL remain SMTP-specific
The system SHALL keep SMTP connection and explicit test-email APIs tied to SMTP configuration rather than silently routing them through webhook.

#### Scenario: Testing SMTP connection
- **WHEN** an administrator tests SMTP connection settings
- **THEN** the system SHALL validate SMTP connectivity using SMTP regardless of the selected delivery channel.

#### Scenario: Sending explicit SMTP test email
- **WHEN** an administrator sends a test email with explicit SMTP settings
- **THEN** the system SHALL use the provided SMTP settings rather than the webhook delivery channel.

### Requirement: Delivery backend configuration SHALL be independent from email verification
The system SHALL allow administrators to configure and test delivery backends without requiring user email verification to be enabled.

#### Scenario: Email verification is disabled
- **WHEN** email verification is disabled in security or registration settings
- **THEN** the admin settings page SHALL still allow SMTP and webhook delivery configuration.

#### Scenario: SMTP test while email verification is disabled
- **WHEN** email verification is disabled and an administrator tests SMTP settings
- **THEN** the system SHALL perform the SMTP test using SMTP configuration.

#### Scenario: Webhook test while email verification is disabled
- **WHEN** email verification is disabled and an administrator tests webhook delivery
- **THEN** the system SHALL perform the webhook test using webhook configuration.

#### Scenario: Business feature checks remain separate
- **WHEN** a business feature requires email verification, such as registration verification code policy
- **THEN** that feature SHALL continue to enforce its own business enablement rules independently from delivery backend configuration.

### Requirement: Administrators SHALL be able to test webhook delivery
The system SHALL provide an administrative test action that verifies webhook delivery independently from SMTP tests.

#### Scenario: Sending webhook test message
- **WHEN** an administrator sends a webhook test message with a configured webhook endpoint
- **THEN** the system SHALL POST a representative message to the webhook endpoint
- **AND** it SHALL report success only when the webhook endpoint returns a 2xx HTTP status.

#### Scenario: Webhook test uses settings handler
- **WHEN** an administrator tests webhook delivery from the settings page
- **THEN** the system SHALL handle the request through the admin settings handler family alongside the existing SMTP test actions.
