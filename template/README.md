# Client Templates Examples

These example files match the frontend `client_templates` shape added in this fork.

Frontend lookup order:

1. `publicSettings.client_templates`
2. `window.__APP_CONFIG__.client_templates`
3. Static file `/client-templates.json`
4. Built-in defaults

Supported placeholder styles:

- `${name}`
- `{{ name }}`

Common placeholders:

- `apiKey`
- `baseUrl`
- `baseRoot`
- `apiBase`
- `geminiBase`
- `antigravityBase`
- `antigravityGeminiBase`
- `configDir`
- `endpoint`
- `app`
- `platform`
- `clientType`
- `providerName`

Notes:

- `codex.files` is used for the normal Codex tab.
- `codex.websocket_files` is used for the `Codex CLI WS` tab.
- `opencode.files` fully replaces the built-in OpenCode config output when present.
- `ccs_import.params.usageScript` is auto-base64 encoded by the frontend before opening the deeplink.

Suggested usage:

- If upstream/official backend later supports `client_templates`, copy the JSON object under that field.
- If you want a pure frontend deployment, place a file at `/client-templates.json`.
- For this repo's embedded frontend, you can override that file by mounting `data/public/client-templates.json`.
- The runtime file can be either `{ "client_templates": { ... } }` or just the inner `{ ... }` object.

Files in this directory:

- `client-templates.json`: mount-ready default file for direct folder mounting
- `client-templates.bundle.example.json`: combined example for all three template areas
- `client-templates.codex.example.json`: Codex / Codex WS only
- `client-templates.opencode.example.json`: OpenCode only
- `client-templates.ccs-import.example.json`: CCS deeplink only
