## ADDED Requirements

### Requirement: The OpenCode tab SHALL prefer a per-platform template section over the shared one
For the OpenAI, Grok and Zhipu platforms, the Use-Key modal's OpenCode tab SHALL
resolve `client_templates.openai_opencode`, `client_templates.grok_opencode` and
`client_templates.zhipu_opencode` respectively before falling back to the shared
`client_templates.opencode` section, and to the built-in generator when neither
is configured. Rendering SHALL use the same placeholder contract as the shared
section.

#### Scenario: Platform section wins over the shared section
- **WHEN** an OpenAI, Grok or Zhipu key's OpenCode tab renders and both the matching per-platform section and the shared `opencode` section are present
- **THEN** the rendered output SHALL come from the per-platform section with placeholders substituted
- **AND** the shared section's content SHALL NOT appear

#### Scenario: Shared section is used when the platform section is absent
- **WHEN** a Zhipu key's OpenCode tab renders, `zhipu_opencode` is absent, and the shared `opencode` section is present
- **THEN** the tab SHALL render the shared section

#### Scenario: Built-in fallback when no section is resolvable
- **WHEN** neither the per-platform nor the shared section is resolvable
- **THEN** the tab SHALL render the built-in OpenCode config for that platform

### Requirement: Platforms without a dedicated section SHALL NOT consult per-platform sections
Only OpenAI, Grok and Zhipu SHALL consult a per-platform OpenCode section. Every
other platform — including Gemini, Anthropic, Antigravity and the
OpenAI-compatible platforms that share the generic code path (Kimi, DeepSeek,
composite groups) — SHALL read the shared `opencode` section directly, and its
built-in fallback SHALL NOT pin a model belonging to another platform.

#### Scenario: A configured openai_opencode section does not reach other platforms
- **WHEN** a Kimi key's OpenCode tab renders and both `openai_opencode` and the shared `opencode` section are configured
- **THEN** the tab SHALL render the shared `opencode` section
- **AND** the `openai_opencode` content SHALL NOT appear

#### Scenario: Generic built-in fallback carries no cross-platform model pin
- **WHEN** a Kimi key's OpenCode tab renders with no template sections configured
- **THEN** the built-in output SHALL keep the OpenAI-compatible provider shape
- **AND** it SHALL NOT contain a top-level `model` pinned to an OpenAI model

### Requirement: The built-in OpenCode generator SHALL emit a GLM configuration for Zhipu keys
The built-in OpenCode fallback for Zhipu platform keys SHALL declare an
OpenAI-compatible GLM provider with its own model catalog instead of reusing the
OpenAI catalog, which the Zhipu gateway group cannot route.

#### Scenario: Zhipu built-in output is GLM-only
- **WHEN** a Zhipu key's OpenCode tab renders with no template sections configured
- **THEN** the provider SHALL use `@ai-sdk/openai-compatible` and be named for GLM
- **AND** its catalog SHALL contain the GLM models and no OpenAI models
- **AND** the top-level `model` SHALL pin a GLM model

### Requirement: Template payloads defining only a per-platform OpenCode section SHALL be accepted
`normalizeClientTemplatesConfig` SHALL treat `openai_opencode`, `grok_opencode`
and `zhipu_opencode` as known sections, so a template file containing only one of
them normalizes instead of being discarded as unusable.

#### Scenario: Per-platform-only static file
- **WHEN** a static template payload contains only `client_templates.zhipu_opencode`
- **THEN** the normalized config SHALL expose that section to consumers

### Requirement: Zhipu CCS deeplink import SHALL default to a pinned GLM model
The CCS deeplink import for Zhipu groups SHALL use the Claude-type app with
`glm-4.6` as its default model pin, so the imported provider does not depend on
upstream model mapping.

#### Scenario: Zhipu key CCS import
- **WHEN** a Zhipu key is imported via the CCS deeplink without a template override
- **THEN** the deeplink SHALL use the `claude` app type
- **AND** its `model` parameter SHALL be `glm-4.6`
