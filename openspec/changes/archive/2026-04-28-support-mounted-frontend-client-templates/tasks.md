## 1. Template Source Discovery

- [x] 1.1 Add frontend typings for `client_templates` and the supporting template config shape.
- [x] 1.2 Implement template normalization and static runtime loading from `/client-templates.json`.
- [x] 1.3 Cache the loaded static template payload for the current page lifecycle while keeping the fetch path `no-store`.
- [x] 1.4 Resolve the effective template source from injected/server sources first, then the static runtime file, then built-in defaults.

## 2. Key Usage Rendering

- [x] 2.1 Render Codex and Codex WS file output from configured template files when present.
- [x] 2.2 Render OpenCode file output from configured template files when present and preserve built-in generation otherwise.
- [x] 2.3 Build CCS import deeplinks from merged defaults and template params, including base64 encoding for `usageScript`.
- [x] 2.4 Keep built-in client config generation available for every surface that lacks a matching custom template.

## 3. Distribution And Verification

- [x] 3.1 Add a mount-ready `frontend/public/client-templates.json` runtime entrypoint and example files under `template/`.
- [x] 3.2 Document lookup order, placeholders, and deployment guidance for whole-directory mounts.
- [x] 3.3 Cover template normalization, deeplink rendering, and Use Key template preference with frontend tests.
