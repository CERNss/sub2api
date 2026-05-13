# custom-menu-external-open Specification

## Purpose
Define how custom sidebar menu entries can launch standalone external services while preserving the existing iframe custom page behavior.

## ADDED Requirements

### Requirement: Custom menu items SHALL support external launch mode
The system SHALL let administrators choose whether a custom menu item opens as the existing iframe page or as an external link.

#### Scenario: Legacy custom menu items keep iframe behavior
- **GIVEN** a saved custom menu item has no `open_mode`
- **WHEN** admin settings load or save the item
- **THEN** the system SHALL treat it as `iframe`
- **AND** clicking the sidebar entry SHALL navigate to `/custom/:id`

#### Scenario: External custom menu opens with token
- **GIVEN** an authenticated user can see a custom menu item with `open_mode=external`
- **WHEN** the user clicks the sidebar entry
- **THEN** the frontend SHALL open the item URL in a new tab
- **AND** the opened URL SHALL include the current Sub2API JWT as a `token` query parameter
- **AND** the frontend SHALL NOT route to `/custom/:id` for that click

#### Scenario: Existing iframe URL builder is preserved
- **GIVEN** a custom menu item uses `open_mode=iframe`
- **WHEN** the custom page view renders the iframe
- **THEN** the frontend SHALL keep using the existing embedded URL behavior
- **AND** it SHALL continue to include the existing iframe parameters such as user, token, theme, locale, and source context
