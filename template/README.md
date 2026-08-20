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

Shell-aware placeholders:

A template's `files` list is rendered once, for whichever shell tab the user has
selected, so a hardcoded `export FOO="bar"` would hand Windows users a command
they cannot paste. These placeholders resolve against the active shell tab
(`macOS / Linux`, `Windows` / `PowerShell`, `Windows CMD`):

| Placeholder | macOS / Linux | PowerShell / Windows | Windows CMD |
| --- | --- | --- | --- |
| `shellLabel` | `Terminal` | `PowerShell` | `Command Prompt` |
| `envSetPrefix` | `export ` (trailing space) | `$env:` | `set ` (trailing space) |
| `envQuote` | `"` | `"` | (empty) |
| `pathSep` | `/` | `\` | `\` |

Write an environment-variable block once and it stays pasteable everywhere:

```json
{ "path": "${shellLabel}", "content": "${envSetPrefix}SUB2API_KEY=${envQuote}${apiKey}${envQuote}" }
```

- macOS / Linux → `export SUB2API_KEY="sk-..."`
- PowerShell / Windows → `$env:SUB2API_KEY="sk-..."`
- Windows CMD → `set SUB2API_KEY=sk-...`

Use `${configDir}${pathSep}config.toml` (not a literal `/`) for config file paths
so the Windows tab shows `%userprofile%\.codex\config.toml`.

Notes:

- `codex.files` is used for the normal Codex tab (OpenAI groups).
- `codex.websocket_files` is used for the `Codex CLI WS` tab.
- `grok_codex.files` is used for the Codex tab of Grok groups; without it the
  frontend falls back to the built-in Grok Codex config.
- `opencode.files` fully replaces the built-in OpenCode config output when present.
- `openai_opencode.files` / `grok_opencode.files` / `zhipu_opencode.files` are
  per-platform OpenCode overrides. **Only these three platforms look for a
  platform section**; every other platform (gemini, anthropic, antigravity,
  kimi, deepseek, composite, …) reads the shared `opencode` section directly and
  ignores the per-platform ones. So the lookup order is:
  - openai / grok / zhipu: platform section → shared `opencode` → built-in fallback;
  - all other platforms: shared `opencode` → built-in fallback.

  Keep each platform's pinned model in its own section (one model per platform);
  the shared `opencode` section should stay model-free so it never leaks a model
  into another platform's tab.
- `ccs_import.params.usageScript` is auto-base64 encoded by the frontend before opening the deeplink.
- Avoid hardcoding `model` in `ccs_import.params`: the value overrides the
  per-platform default the frontend computes, so a fixed model leaks into every
  platform's import.

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
