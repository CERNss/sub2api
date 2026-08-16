## ADDED Requirements

### Requirement: Grok Codex tab SHALL render the grok_codex client template when configured
When the resolved client templates define `grok_codex.files`, the Use-Key modal's Codex tab for Grok-platform keys SHALL render those files through the shared template pipeline, with the same placeholder contract as the OpenAI Codex tab (`${apiKey}`, `${apiBase}`, `${configDir}`, `${baseUrl}`, …) and a shell-aware config directory.

#### Scenario: Template wins over the built-in config
- **WHEN** a Grok key's Codex tab renders and `grok_codex.files` is present
- **THEN** the rendered output SHALL come from the template with placeholders substituted
- **AND** the built-in grok-4.5 config and its `SUB2API_API_KEY` scaffolding SHALL NOT appear

#### Scenario: Built-in fallback without a template
- **WHEN** no `grok_codex` section is resolvable
- **THEN** the tab SHALL render the built-in Grok Codex config unchanged

#### Scenario: Shell-aware placeholders follow the active tab
- **WHEN** a template uses the shell-aware placeholders (`${shellLabel}`, `${envSetPrefix}`, `${envQuote}`, `${pathSep}`) and the user switches to a Windows shell tab
- **THEN** the rendered env command SHALL use that shell's assignment form (e.g. `$env:` for PowerShell instead of POSIX `export`)
- **AND** rendered paths SHALL use that shell's separator
- **AND** the unix tab SHALL keep rendering the POSIX form

### Requirement: Template payloads defining only grok_codex SHALL be accepted
`normalizeClientTemplatesConfig` SHALL treat `grok_codex` as a known section so a template file containing only that section normalizes instead of being discarded.

#### Scenario: grok_codex-only static file
- **WHEN** a static template payload contains only `client_templates.grok_codex`
- **THEN** the normalized config SHALL expose that section to consumers

### Requirement: Grok CCS deeplink import SHALL default to grok-4.6
The CCS deeplink import for Grok groups SHALL use `grok-4.6` as its default model pin.

#### Scenario: Grok key CCS import
- **WHEN** a Grok key is imported via the CCS deeplink without a template override
- **THEN** the deeplink's `model` parameter SHALL be `grok-4.6`
