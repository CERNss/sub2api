# Sub2API

<div align="center">

[![Go](https://img.shields.io/badge/Go-1.25.7-00ADD8.svg)](https://golang.org/)
[![Vue](https://img.shields.io/badge/Vue-3.4+-4FC08D.svg)](https://vuejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

**AI API Gateway Platform for Subscription Quota Distribution**

English | [中文](README_CN.md)

</div>

> Sub2API officially uses only the domains `sub2api.org` and `pincc.ai`. Other websites using the Sub2API name may be third-party deployments or services and are not affiliated with this project.

## Overview

Sub2API distributes and manages API quotas from AI product subscriptions. Users call upstream AI services through platform-issued API keys, while Sub2API handles authentication, billing, scheduling, concurrency control, rate limits, and request forwarding.

## Core Features

- **Multi-account management** - Supports upstream OAuth accounts and API-key accounts.
- **API key distribution** - Issues and manages user-facing API keys.
- **Precise billing** - Tracks usage and cost at token level.
- **Smart scheduling** - Selects upstream accounts with sticky-session support.
- **Concurrency and rate limits** - Controls request pressure at user and account levels.
- **Built-in payments** - Supports EasyPay, Alipay, WeChat Pay, and Stripe. See [Payment Configuration](docs/PAYMENT.md).
- **Admin dashboard** - Provides web-based operations, monitoring, settings, and external iframe integrations.

## Newly Added

### Admin API User Key Provisioning

External provisioning or payment systems can now create a normal AI-usable API key for a specific user through the Admin API Key flow:

```bash
POST /api/v1/admin/users/:id/api-keys
```

The target user is selected by the `:id` path parameter. The request supports the same create-key controls as the user modal, including group binding, optional custom key, IP restrictions, quota, rolling rate limits, and expiration. The full created key is returned at `data.api_key.key`.

### External Custom Menu Launch

Custom admin menu entries can now choose between the existing iframe mode and an external launch mode. External entries open the configured absolute URL in a new tab and append the current Sub2API JWT as a `token` query parameter, so sidecar admin tools can bootstrap their own session.

### OIDC Local Email Verification Control

Admins can keep the secure default that requires local email-code verification for pending OIDC account creation, or disable that duplicate step when the upstream OIDC provider already supplied a verified, non-synthetic trusted `compat_email`.

The backend returns `local_email_verification_required` with pending OIDC completion responses, and the frontend hides verification controls only while the form email still matches the trusted OIDC email. If the user edits the email, local verification is restored.

### Pending OAuth Account Flow Refinements

OIDC, LinuxDo, and WeChat callback pages now resolve pending account actions from both state and bindability hints. When no existing account can be bound and account creation is allowed, brand-new users go directly to account creation instead of seeing an unnecessary bind/create chooser.

### Better OAuth Email Prefill

Pending OAuth create-account and bind-login forms now prefer the most useful human email, including `pending_email`, `existing_account_email`, and `compat_email`, before falling back to provider-specific values. Synthetic provider fallback emails are avoided when better data exists.

## OpenSpec References

The README summary is based on these OpenSpec changes:

- [Admin API user key provisioning](openspec/changes/add-admin-user-api-key-creation/proposal.md)
- [External custom menu launch](openspec/changes/add-external-custom-menu-token-open/proposal.md)
- [OIDC local email verification control](openspec/changes/control-oidc-local-email-verification/proposal.md)
- [Pending OAuth account resolution refinements](openspec/changes/refine-pending-oauth-account-resolution/proposal.md)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Go 1.25.7, Gin, Ent |
| Frontend | Vue 3.4+, Vite 5+, TailwindCSS |
| Database | PostgreSQL 15+ |
| Cache/Queue | Redis 7+ |

## License

This project is licensed under the terms in [LICENSE](LICENSE).
