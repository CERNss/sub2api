## ADDED Requirements

### Requirement: Pending callback views SHALL resolve account action from bindability hints
The OIDC, LinuxDo, and WeChat callback views SHALL interpret pending OAuth responses by combining the backend state field with the explicit bindability hints returned in the payload. A chooser-like state SHALL be resolved directly to account creation when the payload explicitly says there is no bindable existing account and local account creation remains allowed.

#### Scenario: OIDC callback bypasses chooser for a brand-new account
- **WHEN** the OIDC pending completion payload uses a chooser-like state such as `choice` or `choose_account_action_required`, `existing_account_bindable` is `false`, and `create_account_allowed` is not `false`
- **THEN** the callback view SHALL enter the create-account flow immediately
- **AND** the callback view SHALL NOT render a bind-versus-create chooser first

#### Scenario: LinuxDo callback preserves chooser when an existing account can still be bound
- **WHEN** the LinuxDo pending completion payload uses a chooser-like state and `existing_account_bindable` is `true`
- **THEN** the callback view SHALL render the account-action chooser
- **AND** it SHALL allow the user to continue into bind-login or create-account from that chooser

#### Scenario: WeChat callback preserves explicit bind-login outcomes
- **WHEN** the WeChat pending completion payload resolves to `existing_account`, `existing_account_required`, `existing_account_binding_required`, `adopt_existing_user_by_email`, `bind_login_required`, or `bind_login`
- **THEN** the callback view SHALL enter bind-login directly
- **AND** it SHALL prefill the bind-login email from the resolved pending account email

### Requirement: Pending callback views SHALL preserve provider-specific state aliases while sharing the same outcome rule
Each callback view SHALL continue to support the provider-specific set of pending OAuth state aliases it already receives, but the user-facing account-action outcome SHALL follow the same chooser-bypass rule whenever the bindability hints make the decision unambiguous.

#### Scenario: WeChat accepts both generic and legacy chooser aliases
- **WHEN** a WeChat pending completion payload reports `choice`, `choose_account_action_required`, `choose_account_action`, `choose_account`, or `choose`
- **THEN** the callback view SHALL treat those values as chooser-like states
- **AND** it SHALL still collapse that state into direct account creation when `existing_account_bindable` is `false` and `create_account_allowed` is not `false`

#### Scenario: OIDC and LinuxDo accept explicit create-account states
- **WHEN** an OIDC or LinuxDo pending completion payload reports `email_required`, `create_account_required`, or `create_account`
- **THEN** the callback view SHALL enter create-account directly
- **AND** it SHALL NOT require chooser bypass logic to reach that state
