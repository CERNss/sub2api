## Why

Operators need to open a standalone sidecar service from the Sub2API sidebar while reusing the current admin login as a short-lived bootstrap credential. The existing custom menu iframe mode should remain intact for authored embedded pages, but full operator tools work better as independent pages.

## What Changes

- Add an `external` custom menu open mode alongside the existing iframe behavior.
- Keep existing custom menu items defaulting to iframe mode.
- When an external menu item is clicked, open the configured absolute URL in a new tab and append the current browser JWT as `token`.
- Leave the existing custom page iframe route and embedded URL parameters unchanged.

## Capabilities

### New Capabilities
- `custom-menu-external-open`: Custom menu items can open external admin tools with a Sub2API token handoff.

### Modified Capabilities
- None.

## Impact

- Frontend custom menu types, settings form, and sidebar click behavior
- Admin settings DTO validation for persisted custom menu items
- Sidecar-style integrations that exchange `?token=` for their own session
