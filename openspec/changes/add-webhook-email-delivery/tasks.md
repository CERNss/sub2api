## 1. Settings Model

- [x] 1.1 Add `email_delivery_*` and `webhook_*` setting constants with explicit SMTP-preserving defaults, including `email_delivery_channel=smtp` and `webhook_timeout_seconds=10`.
- [x] 1.2 Extend setting parsing, persistence, admin response DTOs, and update requests while masking stored webhook secrets with a `webhook_secret_configured` boolean that follows the SMTP password pattern.
- [x] 1.3 Include webhook setting changes in admin settings audit/change tracking by appending new fields without reordering existing comparisons.

## 2. Webhook Delivery Backend

- [x] 2.1 Create `backend/internal/service/email_webhook.go` for webhook config loading, validation, payload formatting, HTTP POST, auth/signature handling, Feishu support, response handling, and `service.email_webhook` logging.
- [x] 2.2 Add HTTPS enforcement for non-local webhook URLs, with HTTP allowed for localhost, 127.0.0.1, and ::1 testing.
- [x] 2.3 Implement HTTP POST webhook delivery with generic JSON payload, content type, auth mode handling, timeout, and sensitive-log redaction.
- [x] 2.4 Implement Feishu-compatible payload formatting and Feishu body-level signature authentication.
- [x] 2.5 Add only a narrow `EmailService.SendEmail` dispatch branch so the SMTP path remains the existing `GetSMTPConfig -> SendEmailWithConfig` sequence; keep `SendEmailWithConfig` SMTP-only.
- [x] 2.6 Ensure webhook failures do not fall back to SMTP when webhook delivery is selected.

## 3. Admin API and UI

- [x] 3.1 Add an admin settings-handler webhook delivery test action alongside the existing SMTP test actions.
- [x] 3.2 Extend the admin settings API client types for webhook delivery settings.
- [x] 3.3 Add delivery channel selection at the top of the admin settings email tab and show webhook-only fields only when channel is `webhook`.
- [x] 3.4 Decouple the email settings tab from `email_verify_enabled` so SMTP and webhook configuration and test controls remain available when email verification is disabled.
- [x] 3.5 Add localized UI strings for webhook delivery controls, hints, and test results, and revise any disabled-email-tab copy that implies SMTP requires email verification.

## 4. Tests

- [x] 4.1 Add backend unit tests for empty-settings SMTP behavior, webhook channel selection, missing URL, invalid scheme, non-local HTTP rejection, localhost HTTP allowance, non-2xx response, timeout, generic auth modes, Feishu payload/signing, no SMTP fallback, and secret masking.
- [x] 4.2 Add backend tests proving shared auth and notification sends, including `EmailQueueService` async sends, can succeed without SMTP when webhook is configured.
- [x] 4.3 Add handler/API tests for saving webhook settings and sending a webhook test message.
- [x] 4.4 Add frontend tests for rendering, editing, saving, and testing webhook delivery settings.
- [x] 4.5 Add frontend tests that SMTP and webhook delivery settings remain visible/testable when `email_verify_enabled=false`.

## 5. Verification

- [x] 5.1 Run relevant Go tests for email service, setting service/handler, auth email flows, balance notifications, and Ops email flows.
- [x] 5.2 Run relevant frontend tests for admin settings.
- [x] 5.3 Run `openspec validate add-webhook-email-delivery --json`.
