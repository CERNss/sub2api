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

## Fork Touchpoints

### New Files
- `frontend/src/utils/external-menu-url.ts`: builds the absolute URL with the JWT token query param.
- `frontend/src/utils/__tests__/external-menu-url.spec.ts`: unit tests for URL building edge cases.

### Upstream Patch Files
- `backend/internal/handler/admin/setting_handler.go`: passes the new `open_mode` field through to persistence.
- `backend/internal/handler/dto/settings.go`: DTO validation extended for `open_mode`.
- `backend/internal/service/setting_service.go`: persists and validates the external menu mode.
- `frontend/src/components/layout/AppSidebar.vue`: dispatches by mode (`iframe` → existing route, `external` → `window.open`).
- `frontend/src/components/layout/__tests__/AppSidebar.spec.ts`: behavior coverage.
- `frontend/src/views/user/CustomPageView.vue`: keeps iframe-mode fallback intact.
- `frontend/src/types/index.ts`: extends `CustomMenuItem` type with `open_mode`.
- `frontend/src/views/admin/SettingsView.vue`: admin UI gains mode selector.
- `frontend/src/views/admin/__tests__/SettingsView.spec.ts`: UI test coverage.

### Shared Touchpoints
- `backend/internal/handler/admin/setting_handler.go`: also owned by `control-oidc-local-email-verification` — both changes add admin settings; preserve both DTO field passthroughs.
- `backend/internal/handler/dto/settings.go`: also owned by `control-oidc-local-email-verification`.
- `backend/internal/service/setting_service.go`: also owned by `control-oidc-local-email-verification`.
- `frontend/src/views/admin/SettingsView.vue`: also owned by `control-oidc-local-email-verification` — preserve both settings panels.
- `frontend/src/types/index.ts`: also owned by archived `2026-04-28-support-mounted-frontend-client-templates` — preserve both `CustomMenuItem` and `PublicSettings` extensions.
- `README.md`: also owned by `add-admin-user-api-key-creation` — both append feature blurb paragraphs.
- `README_CN.md`: also owned by `add-admin-user-api-key-creation` — same reason as above.

### Non-OpenSpec Overlap
- _None._
