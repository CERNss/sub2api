## Context

Outbound messages are concentrated behind `EmailService.SendEmail(ctx, to, subject, body)`. Registration verification codes, OAuth pending verification, email binding, password reset, notification email verification, balance-low alerts, account quota alerts, Ops alerts, and scheduled Ops reports all use this shared path directly or indirectly.

The admin settings page currently exposes SMTP configuration and explicit SMTP tests. SMTP remains useful, but operators also need to delegate message delivery to a webhook service that can handle email, chat, incident systems, or custom routing outside this application.

The current admin UI hides SMTP configuration and SMTP test controls when `email_verify_enabled` is off, even though backend SMTP test handlers do not require that flag. This conflates a delivery backend with a registration/security business switch.

## Goals / Non-Goals

**Goals:**

- Add a webhook delivery backend that can replace SMTP for every normal shared email message.
- Support both generic webhook receivers and Feishu/Lark custom bot webhooks.
- Keep the existing SMTP delivery behavior as the default and minimize changes to the SMTP path.
- Make webhook code removable so deleting the new webhook file and the small `SendEmail` branch restores the previous behavior.
- Do not fall back from webhook to SMTP when webhook delivery is selected.
- Preserve SMTP test APIs as SMTP-specific diagnostics.
- Provide an admin-visible configuration and webhook test action.
- Allow delivery backend configuration and tests regardless of whether email verification is enabled.
- Protect webhook secrets and avoid logging verification codes or reset links.

**Non-Goals:**

- Do not design per-event custom webhook schemas for each notification category in this change.
- Do not remove SMTP support.
- Do not change verification-code, password-reset, quota-alert, balance-alert, or Ops-alert business rules.
- Do not change whether registration, password reset, TOTP, or other business features require email verification.
- Do not add retry queues or durable notification delivery guarantees beyond the existing best-effort behavior.

## Decisions

### 1. Add webhook delivery at `EmailService.SendEmail`

`SendEmail` is the correct integration point because it is the shared outbound message path. The implementation should be a narrow dispatch wrapper:

```text
SendEmail:
  channel = read setting, default "smtp"
  if channel == "webhook":
    return s.sendViaWebhook(ctx, to, subject, body)
  config, err := s.GetSMTPConfig(ctx)
  if err != nil:
    return err
  return s.SendEmailWithConfig(config, to, subject, body)
```

The SMTP branch keeps the current `GetSMTPConfig -> SendEmailWithConfig` flow, function signatures, and error behavior. `SendEmailWithConfig` remains SMTP-only because it is used by explicit test/config flows that pass an SMTP config directly.

Alternatives considered:

- Update each alert or auth flow independently. Rejected because it would miss future callers and create two notification systems.
- Add a new notification service now. Rejected for this change because existing call sites already have the needed message shape and the user request is specifically to proxy existing email capability.

### 2. Keep webhook implementation in a new file

Place webhook-specific code in `backend/internal/service/email_webhook.go`. That file owns webhook config loading, payload construction, HTTP POST, auth/signature handling, Feishu formatting, response interpretation, and webhook-specific logging. `email_service.go` should only gain the minimal channel dispatch needed to call `sendViaWebhook`.

This keeps rollback and review straightforward: the existing SMTP implementation remains visually isolated, and deleting the webhook file plus the dispatch branch returns the service to the previous shape.

### 3. Use a simple stable webhook payload first

The default webhook payload format, `generic`, will represent the email-shaped message:

```json
{
  "event": "email.message",
  "to": "user@example.com",
  "subject": "Subject",
  "html": "<p>Body</p>",
  "timestamp": "2026-05-06T12:00:00Z"
}
```

This keeps webhook receivers compatible with every existing email message without forcing immediate event-specific schemas. Future changes can add optional metadata such as `category`, `message_id`, or `text` while preserving the base contract.

Alternatives considered:

- Emit event-specific payloads immediately. Rejected because many current email send calls only pass recipient, subject, and HTML body; event typing would require broader call-site changes.
- Send raw HTML only. Rejected because webhook receivers need structured recipient and subject fields.

### 4. Add a Feishu/Lark-compatible payload format

Feishu custom bot webhooks expect `msg_type` and `content` rather than the generic email-shaped payload. Add a `webhook_payload_format` setting:

- `generic`: send the Sub2API email-shaped payload.
- `feishu`: send a Feishu-compatible custom bot payload.

The initial Feishu formatter should use a readable text or post message that includes the subject and a safe text rendering of the body. The source email-shaped values remain the internal input; only the outbound webhook body changes. This keeps the rest of the email service API stable.

For signed Feishu custom bots, add `feishu_signature` as an auth mode. Unlike generic signature mode, Feishu-compatible signing places `timestamp` and `sign` in the JSON request body.

Alternatives considered:

- Make all webhook payloads Feishu-shaped. Rejected because generic webhook receivers should not have to understand Feishu-specific fields.
- Use a free-form JSON template in the first version. Rejected because it increases admin complexity and makes verification harder; a dedicated Feishu formatter covers the immediate integration need.

### 5. Store channel selection and webhook settings in existing settings storage

Add setting keys for delivery channel, payload format, webhook URL, authentication mode, authentication header name, webhook secret, and timeout seconds. Use explicit defaults so missing settings produce SMTP behavior:

- `email_delivery_channel`: `smtp`
- `webhook_payload_format`: `generic`
- `webhook_auth_mode`: `none` unless the admin selects another mode
- `webhook_timeout_seconds`: `10`

Admin settings responses expose `webhook_secret_configured` without returning the secret value, matching the existing `smtp_password_configured` pattern.

Use consistent key prefixes:

- `email_delivery_*` for delivery-level settings.
- `webhook_*` for webhook-specific settings.

Alternatives considered:

- Environment-only configuration. Rejected because SMTP is already admin-configurable through persisted settings.
- Separate webhook table. Rejected because there is only one global delivery backend in this change.
- Empty string fallback without explicit defaults. Rejected because empty settings should resolve to an obvious `smtp` default and be testable.

### 6. Treat webhook success as HTTP 2xx, with Feishu application-code handling

Webhook delivery succeeds only on 2xx status. Non-2xx responses, invalid URLs, missing URL, and timeouts return errors from `SendEmail`. Existing higher-level callers that already log or ignore per-recipient errors can keep their behavior.

For Feishu payload format, a 2xx response with JSON `code != 0` is an application-level failure and should be returned as a webhook delivery error.

Alternatives considered:

- Treat 3xx as success. Rejected because webhook clients should not follow arbitrary redirects for sensitive message bodies unless explicitly implemented and constrained.
- Fire-and-forget webhook dispatch. Rejected because verification and reset flows need to know whether delivery failed.

### 7. Do not fall back to SMTP from webhook mode

When `email_delivery_channel=webhook`, webhook delivery is authoritative. Any webhook failure returns an error to the caller. This matches the requested behavior that webhook proxies the email system, and it avoids hiding webhook outages behind SMTP delivery.

Alternatives considered:

- Add optional SMTP fallback. Rejected for this change because the desired behavior is explicit webhook replacement, and fallback makes incident behavior harder to reason about.

### 8. Enforce HTTPS for non-local webhook URLs

Webhook URLs must use HTTP or HTTPS. Production/non-local webhook URLs must use HTTPS. HTTP is allowed only for local testing hosts: `localhost`, `127.0.0.1`, and `::1`.

Alternatives considered:

- Allow all HTTP URLs. Rejected because webhook bodies may contain verification codes and password reset links.
- Require HTTPS for every environment. Rejected because local webhook testing should remain easy.

### 9. Support multiple authentication modes

Webhook authentication is represented by an explicit mode:

- `none`: send no authentication header.
- `bearer`: send `Authorization: Bearer <secret>`.
- `header`: send the secret in an administrator-selected safe header name.
- `signature`: send timestamp and HMAC signature headers based on the request body and secret.
- `feishu_signature`: send Feishu-compatible body-level `timestamp` and `sign` fields.

`bearer` can be the default when a secret is configured, while `none` remains useful for local testing. Header names are validated to prevent invalid or unsafe HTTP headers.

The generic `signature` receiver contract is:

- `X-Sub2API-Timestamp`: Unix timestamp in seconds.
- `X-Sub2API-Signature`: `sha256=<hex hmac>`.
- HMAC input: `<timestamp>.<raw JSON request body>`.
- HMAC algorithm: HMAC-SHA256 using `webhook_secret` as the key.

Alternatives considered:

- Support only Bearer token. Rejected because deployments may need to integrate with existing notification gateways that require custom headers, signed requests, or Feishu custom bot signing.
- Make signature the only secure mode. Rejected because many simple webhook receivers are easier to operate with Bearer tokens.

### 10. Keep SMTP diagnostics separate from webhook diagnostics

`TestSMTPConnection` and `SendTestEmail` continue to exercise SMTP. A new setting-handler action, adjacent to the existing SMTP test actions, will exercise webhook delivery with a representative payload.

Alternatives considered:

- Make "send test email" follow the selected delivery channel. Rejected because administrators need a precise SMTP diagnostic when they are editing SMTP fields, and the existing endpoint accepts explicit SMTP values.

### 11. Keep admin UI quiet for SMTP users

Place the delivery channel selector at the top of the email settings tab. Show webhook URL, payload format, authentication mode, secret, header name, timeout, and webhook test controls only when the selected channel is `webhook`. SMTP operators should see the same SMTP fields and tests they already use, with minimal visual noise from webhook-only settings.

The email settings tab must not hide SMTP or webhook delivery configuration merely because `email_verify_enabled` is false. Email verification controls remain in the security/registration area as a business policy. Delivery backend configuration remains in the email tab as infrastructure.

### 12. Separate delivery backend controls from business feature toggles

Email verification, password reset, registration verification, and TOTP verification rules are business-level enablement checks. SMTP/webhook delivery configuration is infrastructure. This change decouples admin configuration and delivery tests from `email_verify_enabled`, but it does not change existing business checks that decide whether a feature may request a message.

### 13. Append audit fields and isolate webhook logs

If settings audit/change tracking uses a key list, append the new keys to that list. If it uses hardcoded comparisons, append webhook comparisons without reordering existing SMTP or notification comparisons.

Webhook logs should use a distinct logger name or logging namespace such as `service.email_webhook`. This keeps SMTP troubleshooting filters separate and centralizes webhook redaction rules.

## Risks / Trade-offs

- [Webhook receiver sees sensitive content] -> Mitigation: document that webhook URL and secret grant access to verification codes and password reset links; redact secrets and message bodies from logs.
- [Webhook outage breaks signup/password reset] -> Mitigation: keep SMTP as default until operators explicitly opt in to webhook, provide a webhook test action, and surface delivery errors clearly.
- [Admin misconfigures webhook URL] -> Mitigation: validate HTTP/HTTPS scheme and provide a webhook test action.
- [Insecure HTTP endpoint receives sensitive content] -> Mitigation: require HTTPS for non-local webhook URLs and allow HTTP only for local testing hosts.
- [Authentication mode mismatch] -> Mitigation: expose mode selection in admin settings and test the exact configured mode.
- [Feishu receiver rejects generic payloads] -> Mitigation: provide an explicit Feishu payload format and Feishu signing mode.
- [Default SMTP path changes accidentally] -> Mitigation: implement webhook in a new file, keep the SMTP branch as the existing `GetSMTPConfig -> SendEmailWithConfig` sequence, and add an empty-settings regression test.
- [Operators cannot configure delivery while email verification is off] -> Mitigation: remove the UI coupling and add tests for SMTP and webhook configuration/test visibility with `email_verify_enabled=false`.
- [Existing email tests assume SMTP is always required] -> Mitigation: add tests for both SMTP and webhook channel selection.

## Migration Plan

1. Add settings with explicit defaults that preserve current SMTP behavior.
2. Add backend webhook dispatch in `SendEmail` and put webhook implementation in `email_webhook.go`.
3. Add admin API fields and UI controls.
4. Deploy with `email_delivery_channel=smtp` by default.
5. Operators opt in by configuring webhook URL/secret and switching the delivery channel to `webhook`.

Rollback: set the delivery channel back to `smtp` or clear webhook settings. Existing SMTP settings remain intact.

## Open Questions

- Should future payloads include an optional `category` field for auth, balance, quota, and ops messages?
