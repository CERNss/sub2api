## 1. Custom Menu Model

- [x] 1.1 Add optional `open_mode` typing for custom menu items.
- [x] 1.2 Validate `open_mode` server-side and default missing values to iframe.

## 2. Admin Settings UI

- [x] 2.1 Add an open-mode selector to custom menu item editing.
- [x] 2.2 Normalize legacy menu items to iframe mode on load.

## 3. Sidebar Launch Behavior

- [x] 3.1 Keep iframe items routing to `/custom/:id`.
- [x] 3.2 Open external items in a new tab with the current `token` query parameter.
- [x] 3.3 Leave the existing iframe embedded URL builder untouched.

## 4. Verification

- [x] 4.1 Add frontend unit coverage for the external URL builder.
- [x] 4.2 Add settings coverage for legacy iframe defaulting.
- [x] 4.3 Run targeted frontend tests and type/build checks.
