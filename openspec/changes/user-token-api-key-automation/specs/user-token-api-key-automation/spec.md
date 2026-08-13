## ADDED Requirements

### Requirement: Token login aliases SHALL reuse the canonical auth handlers unchanged
The API SHALL expose `POST /api/v1/auth/token`, `POST /api/v1/auth/token/2fa`, and `POST /api/v1/auth/token/refresh` as automation-friendly aliases that are registered against the same handler functions as the canonical login, TOTP 2FA, and token refresh endpoints.

#### Scenario: Token exchange behaves exactly like login
- **WHEN** a client posts valid credentials to `/api/v1/auth/token`
- **THEN** the response SHALL be identical to the canonical login endpoint's response for the same input, including the issued JWT

#### Scenario: Guards are not bypassed
- **WHEN** Turnstile verification, TOTP 2FA, backend-mode restrictions, or user-status checks would reject a canonical login
- **THEN** the same request via `/api/v1/auth/token` (or `/auth/token/2fa`, `/auth/token/refresh`) SHALL be rejected identically

#### Scenario: Alias registration is pinned at route level
- **WHEN** the route table is built
- **THEN** each alias SHALL resolve to the same handler as its canonical endpoint, as asserted by `routes/auth_token_alias_routes_test.go`

### Requirement: Automation capability SHALL stay within the logged-in user's permission envelope
API keys created or modified through a token-alias session SHALL be constrained by the same user-level checks as an interactive session; no admin-only capability is reachable.

#### Scenario: Key creation respects user permissions
- **WHEN** a JWT obtained via `/api/v1/auth/token` is used to create an API key
- **THEN** the key SHALL only bind to groups available to that user, with the user's own quota and status rules applied
