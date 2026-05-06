## Why

All outbound user and operator messages currently depend on SMTP email delivery. SMTP alone is too narrow for deployments that already centralize notifications through an external webhook service, and operators need a single webhook configuration that can proxy every message the email service can send.

## What Changes

- Add a configurable email delivery channel that selects either the existing SMTP backend or a new webhook backend.
- Add webhook delivery settings for URL, payload format, authentication mode, optional secret, and timeout.
- Support a generic webhook payload by default and a Feishu/Lark-compatible payload format for custom bot webhooks.
- Route all normal `EmailService.SendEmail` messages through the selected backend so verification codes, password reset links, notification email verification, balance alerts, quota alerts, Ops alerts, and Ops scheduled reports can all be delivered by webhook.
- Keep explicit SMTP test/config APIs SMTP-specific so operators can still validate SMTP credentials when SMTP is selected.
- Add admin settings UI and API fields for managing and testing webhook delivery without exposing stored secrets.

## Capabilities

### New Capabilities

- `webhook-email-delivery`: Covers webhook-backed delivery for all messages that currently use the shared email send path.

### Modified Capabilities

- None.

## Impact

- Backend settings constants, setting parsing/persistence, admin settings DTOs, and audit-change reporting.
- `EmailService` delivery path and tests around SMTP/webhook selection, webhook request validation, and failures.
- Admin settings API and frontend settings form, including localized labels for webhook delivery controls, payload format selection, and test actions.
- Security posture for message delivery secrets and sensitive message payloads, because webhook receivers can see verification codes and password reset links.
