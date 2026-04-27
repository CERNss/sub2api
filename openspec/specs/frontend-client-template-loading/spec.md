# frontend-client-template-loading Specification

## Purpose
TBD - created by archiving change support-mounted-frontend-client-templates. Update Purpose after archive.
## Requirements
### Requirement: The frontend SHALL resolve client templates from a stable runtime source order
The frontend SHALL support client templates from multiple runtime sources and SHALL resolve them in a stable precedence order. It SHALL prefer public-settings templates, then cached public-settings templates, then `window.__APP_CONFIG__.client_templates`, then a static `/client-templates.json` file, and SHALL fall back to built-in client generation when no template source yields a usable configuration.

#### Scenario: Public settings win over mounted static templates
- **WHEN** public settings include a non-empty `client_templates` object and the static `/client-templates.json` file also exists
- **THEN** the frontend SHALL use the public-settings templates as the effective client template source
- **AND** the mounted static file SHALL NOT override them

#### Scenario: Static runtime file supports pure frontend deployments
- **WHEN** no public-settings or runtime-injected client templates are present but `/client-templates.json` returns a valid payload
- **THEN** the frontend SHALL use that static payload as the effective client template source
- **AND** key usage flows SHALL render from it without requiring backend changes

#### Scenario: Missing static file preserves built-in behavior
- **WHEN** `/client-templates.json` responds with `404`
- **THEN** the frontend SHALL treat the static template source as absent
- **AND** it SHALL continue using built-in generated client configs

### Requirement: The frontend SHALL normalize template payloads and ignore invalid ones safely
The frontend SHALL accept either a bare client-template object or an object with a nested `client_templates` field. It SHALL only accept payloads that expose at least one known template section such as `codex`, `opencode`, or `ccs_import`, and SHALL ignore invalid payloads without breaking key usage flows.

#### Scenario: Nested runtime payload is normalized
- **WHEN** `/client-templates.json` or another runtime source returns `{ "client_templates": { "codex": ... } }`
- **THEN** the frontend SHALL normalize the effective template payload to the inner object

#### Scenario: Invalid payload falls back safely
- **WHEN** a runtime template source returns an object that lacks all known client-template sections
- **THEN** the frontend SHALL ignore that payload as unusable
- **AND** it SHALL keep built-in client config generation available

### Requirement: The repo SHALL ship mount-ready client template assets and guidance
The repository SHALL include a mount-ready static template entrypoint and deployment guidance for whole-directory mounts so operators can enable frontend client templates without editing source code.

#### Scenario: Repo includes a mount-ready template entrypoint
- **WHEN** an operator inspects the repository template assets
- **THEN** the repo SHALL provide `template/client-templates.json` as a mount-ready runtime file
- **AND** the frontend public assets SHALL include `frontend/public/client-templates.json` as the default runtime entrypoint

#### Scenario: Repo documents directory mounting
- **WHEN** an operator reads the template documentation or Docker Compose examples
- **THEN** the repo SHALL describe the expected `/client-templates.json` lookup path
- **AND** it SHALL show how to mount the whole template directory into the frontend runtime public directory

