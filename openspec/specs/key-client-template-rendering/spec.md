# key-client-template-rendering Specification

## Purpose
TBD - created by archiving change support-mounted-frontend-client-templates. Update Purpose after archive.
## Requirements
### Requirement: Use Key flows SHALL render configured client template files when present
The Use Key flow SHALL treat configured template files as targeted overrides for supported client surfaces. When a matching template section is present, it SHALL render those files with placeholder substitution instead of the built-in generated output for that surface.

#### Scenario: Codex templates override built-in OpenAI config files
- **WHEN** the platform is OpenAI, the active client tab is `codex`, and `client_templates.codex.files` is present
- **THEN** the Use Key modal SHALL render the configured file list instead of the built-in Codex files
- **AND** each rendered file SHALL substitute placeholders such as `apiKey`, `baseUrl`, `configDir`, and `endpoint`

#### Scenario: Codex WS templates override only the websocket tab
- **WHEN** the platform is OpenAI, the active client tab is `codex-ws`, and `client_templates.codex.websocket_files` is present
- **THEN** the Use Key modal SHALL render the configured websocket file list for that tab
- **AND** the normal Codex tab SHALL continue to use `codex.files` or built-in defaults independently

#### Scenario: OpenCode templates replace built-in OpenCode output
- **WHEN** `client_templates.opencode.files` is present for the active platform
- **THEN** the Use Key modal SHALL render those OpenCode files as the visible output
- **AND** it SHALL use a rendered endpoint appropriate for the current platform context

### Requirement: Placeholder rendering SHALL support the shared template context
Configured client template files SHALL render from a shared placeholder engine that supports both `${name}` and `{{ name }}` syntax and leaves unknown placeholders unchanged.

#### Scenario: Supported placeholders are substituted
- **WHEN** a configured template file contains known placeholders such as `${baseUrl}` and `{{ apiKey }}`
- **THEN** the rendered file SHALL substitute those values from the current template context

#### Scenario: Unknown placeholders are preserved
- **WHEN** a configured template file contains a placeholder key that does not exist in the current template context
- **THEN** the frontend SHALL leave that placeholder text unchanged in the rendered output

### Requirement: CCS import SHALL build deeplinks from merged defaults and template params
The CCS import flow SHALL support a configurable deeplink base and param overrides from `client_templates.ccs_import`. It SHALL merge template params onto the default deeplink params and SHALL base64-encode `usageScript` before constructing the final deeplink URL.

#### Scenario: CCS import template overrides endpoint and usage script
- **WHEN** `client_templates.ccs_import.params` provides an `endpoint` and `usageScript`
- **THEN** the generated deeplink SHALL use the rendered template endpoint value
- **AND** it SHALL encode the rendered usage script before placing it in the final query string

#### Scenario: Missing CCS template preserves built-in deeplink generation
- **WHEN** no `client_templates.ccs_import` section is configured
- **THEN** the frontend SHALL generate the CCS import deeplink from built-in defaults
- **AND** CCS import SHALL remain usable without custom templates

### Requirement: Missing template sections SHALL preserve built-in generated configs
Client template support SHALL be additive. If a specific client surface has no configured template files, the frontend SHALL keep using the built-in generated output for that surface.

#### Scenario: Built-in OpenCode config remains when no OpenCode templates exist
- **WHEN** the active client tab is `opencode` and no `client_templates.opencode.files` section is configured
- **THEN** the Use Key modal SHALL show the built-in generated OpenCode config for the current platform

#### Scenario: Built-in Codex files remain when no Codex templates exist
- **WHEN** the active client tab is `codex` or `codex-ws` and the matching Codex template section is absent
- **THEN** the Use Key modal SHALL show the built-in generated files for that tab
