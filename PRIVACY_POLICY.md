# SpringInfo Privacy Policy

Last updated: 2026-06-29

SpringInfo is a Chrome extension that enhances Eureka `/registry` pages by showing inline actuator information and Swagger links.

## Data collection and use

- SpringInfo does not collect, sell, or transfer personal data to third parties.
- SpringInfo does not use analytics, ad tracking, or remote executable code.
- SpringInfo stores only extension settings in Chrome storage, such as:
  - request timeout
  - info popup auto-close delay
  - fallback mode
  - table visibility preferences
  - diagnostics toggle preference

## Host and network access

- SpringInfo reads links that already exist on Eureka registry pages.
- It requests actuator/info endpoints needed to display inline results to the user.
- Network access is used only for extension functionality.

## Diagnostics mode

- Diagnostics mode is optional and off by default.
- When enabled, a user can click `Copy Debug` to copy a troubleshooting payload.
- Debug payloads are redacted and include only origin+path URLs (no query parameters).
- Debug content remains local unless a user chooses to share it.

## Security practices

- External links open with `rel="noreferrer noopener"`.
- The extension does not use `eval`, dynamic script injection, or remote hosted executable scripts.

## User controls

- Users can modify or reset extension behavior through the options page.

## Contact

For support, use the support URL listed on the Chrome Web Store item page.
