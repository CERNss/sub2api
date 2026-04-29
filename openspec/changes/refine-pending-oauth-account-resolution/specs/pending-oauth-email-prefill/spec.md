## ADDED Requirements

### Requirement: Pending callback forms SHALL prefer the most specific resolved email hint
The callback views SHALL prefill pending create-account and bind-login forms from the most specific email hint available in the pending OAuth payload. They SHALL prefer explicit pending-session or compatibility emails over generic provider fallback fields.

#### Scenario: OIDC prefers a compatible email over a provider fallback email
- **WHEN** an OIDC pending completion payload contains both `compat_email` and a less useful generic `email` value
- **THEN** the callback view SHALL prefill the create-account form from `compat_email`
- **AND** it SHALL only fall back to the generic `email` value after `pending_email`, `existing_account_email`, `compat_email`, and `resolved_email` are absent

#### Scenario: LinuxDo prefers a compatible email before generic fallback
- **WHEN** a LinuxDo pending completion payload contains `pending_email`, `existing_account_email`, `compat_email`, `email`, `resolved_email`, and `suggested_email`
- **THEN** the callback view SHALL use the first populated value in that precedence chain
- **AND** it SHALL not skip `compat_email` in favor of a later generic field

#### Scenario: WeChat falls back to resume email only after payload email hints are exhausted
- **WHEN** a WeChat pending completion payload lacks `pending_email`, `existing_account_email`, `compat_email`, `resolved_email`, and `email`
- **THEN** the callback view SHALL fall back to the locally resumed email when one exists
- **AND** it SHALL use that value for pending create-account or bind-login prefilling

### Requirement: Pending callback forms SHALL reuse the resolved pending email consistently within an action branch
Once a callback view resolves the pending account email for the active branch, it SHALL reuse that same resolved value when prefilling the visible form inputs for that branch.

#### Scenario: Chooser branch seeds both create-account and bind-login paths
- **WHEN** a callback view resolves a chooser branch with a non-empty pending account email
- **THEN** it SHALL store that resolved email as the pending account email shown to the user
- **AND** it SHALL prefill bind-login with the same resolved email when the user switches into bind-login

#### Scenario: Direct create-account branch seeds the create-account form
- **WHEN** a callback view resolves directly to account creation
- **THEN** it SHALL pass the resolved pending account email into the create-account form as the initial email
- **AND** the user SHALL see that email before entering any new value manually
