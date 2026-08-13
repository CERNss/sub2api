## ADDED Requirements

### Requirement: Grok gateway SHALL pass xhigh reasoning effort through to models that support the tier
When the upstream model supports xAI's `xhigh` reasoning tier (grok-4.6 family), the Grok gateway SHALL normalize the high-tier aliases `xhigh`, `extrahigh`, `max`, and `ultra` to `xhigh` and forward that value to the upstream request, instead of flattening them to `high`.

#### Scenario: Responses request with xhigh on grok-4.6
- **WHEN** a Responses-path request targeting `grok-4.6` carries `reasoning.effort = "xhigh"`, `reasoning_effort = "xhigh"`, or `reasoningEffort = "max"`
- **THEN** the egress body SHALL carry the normalized value `xhigh` in the corresponding snake-case field
- **AND** the camelCase `reasoningEffort` field SHALL NOT survive to egress

#### Scenario: Chat Completions request with xhigh on grok-4.6
- **WHEN** a Chat Completions request targeting `grok-4.6` or `grok-4.6-latest` carries `reasoning_effort = "xhigh"`
- **THEN** the egress body SHALL carry `reasoning_effort = "xhigh"`

### Requirement: Grok gateway SHALL keep flattening high-tier aliases for models without the xhigh tier
For Grok models that do not support the `xhigh` tier, the gateway SHALL keep the pre-existing behavior: `xhigh`, `extrahigh`, `max`, and `ultra` normalize to `high`, and models that reject reasoning effort entirely still have the field removed.

#### Scenario: xhigh on grok-4.5 flattens to high
- **WHEN** a request targeting `grok-4.5` carries `reasoning_effort = "xhigh"`
- **THEN** the egress body SHALL carry `reasoning_effort = "high"`

#### Scenario: ultra on grok-4.3 flattens to high
- **WHEN** a Chat Completions request targeting `grok-4.3` carries `reasoningEffort = "ultra"`
- **THEN** the egress body SHALL carry `reasoning_effort = "high"`
