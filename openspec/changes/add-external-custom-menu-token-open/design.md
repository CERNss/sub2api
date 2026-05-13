## Context

Sub2API already supports custom menu pages that render in an iframe through `/custom/:id`. That path also builds an embedded URL with user, token, theme, locale, and source context. This change intentionally does not alter that authored iframe behavior.

The new requirement is a smaller branch in custom menu behavior: some entries should behave like launchers for a separate service. These entries should use the current JWT only to prove the Sub2API admin identity to the external service, which can then issue its own local session.

## Decisions

### 1. Add `open_mode` to custom menu items

`open_mode` accepts:

- `iframe`: existing behavior, route to `/custom/:id`
- `external`: open the configured URL in a new tab

Missing values are normalized to `iframe` so existing saved settings continue to behave exactly as before.

### 2. Use a separate URL builder for external menu launch

The existing iframe `buildEmbeddedUrl` helper remains unchanged. External menu launch uses a separate helper that only appends `token`, avoiding accidental changes to embedded page contracts.

### 3. Keep validation small

Backend settings validation accepts only `iframe` or `external` and fills missing values with `iframe` before storing. URL validation remains the existing absolute http(s) check for non-markdown entries.

## Risks / Trade-offs

- The JWT is present in the external URL during the initial handoff. The target service should exchange it immediately and remove it from the browser URL.
- External services must validate the JWT against Sub2API and should not reuse it for admin mutations.
- Opening in a new tab depends on browser popup policy for user-initiated clicks, which is the intended interaction here.

## Migration Plan

Existing custom menu JSON without `open_mode` is treated as `iframe`. Operators can opt specific entries into `external` from settings.

Rollback is to change the affected menu item back to `iframe` or remove the item; existing iframe pages are not migrated.
