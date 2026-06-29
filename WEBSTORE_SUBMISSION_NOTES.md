# Chrome Web Store Submission Notes

Use this text for the store listing and review notes.

## Short description

Show Spring actuator info and Swagger links inline on Eureka registry pages.

## Detailed description

SpringInfo enhances Eureka `/registry` pages by adding an inline `swagger` link and an `info` dropdown next to each service status link. It fetches actuator info endpoints dynamically from links already present on the page and displays results directly in the table.

Features include compact inline rendering, configurable auto-close behavior, persistent table visibility toggles, fallback handling for mixed-content environments, and optional diagnostics for troubleshooting.

## Permission justification

- `storage` permission is used to persist user settings (timeout, close delay, fallback mode, view toggles, diagnostics toggle).
- Host permissions are required to request Spring actuator/info endpoints referenced by Eureka status links across multiple deployment environments.

## Data handling statement

- No personal data is collected, sold, or transferred.
- No analytics or advertising SDKs are used.
- Optional diagnostics are user-triggered and copied to clipboard only when requested.
- Diagnostics are redacted to origin+path URLs (query parameters excluded).

## Reviewer notes

- Extension activates on Eureka `/registry` pages.
- It augments existing table rows; it does not inject remote scripts.
- Core behavior depends on endpoint links already present in Eureka status cells.

## Recommended privacy declaration answers

- Single purpose: Yes (Eureka registry productivity).
- Data sale: No.
- Data transfer to third parties: No.
- Authentication data collection by extension backend: No.
- Personal communications collection: No.
- Health, financial, precise location, browsing history collection: No.
