# SpringInfo

SpringInfo is a Chrome extension that augments Eureka `/registry` pages with per-instance info and quick Swagger navigation.

## Features

- Adds a green `swagger` link inline in the Status cell.
- Adds an `info` dropdown showing full JSON from instance info endpoints.
- Auto-closes each open info dropdown after cursor/focus leaves that specific dropdown (delay configurable in Options).
- Works across environments using dynamic URL derivation from existing Eureka links.
- Shows a summary bar with row, instance, OK, issue, and skipped counters.
- Adds persistent toggles:
   - Hide/Show AMIs
   - Hide/Show Zones
   - Hide/Show Other Tables
   - Reset View (restores all to visible)
- Optional diagnostics mode adds a `Copy Debug` button with a JSON snapshot for troubleshooting.

## Endpoint strategy

- Reads links from the Eureka Status cell.
- Derives the instance token from the link label and sends it as `?instance=<token>`.
- Uses configurable fallback behavior for mixed-content environments:
   - `none`
   - `https-upgrade`
   - `skip-insecure`

## Install locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project folder.
5. Reload the extension after updates.
6. Refresh your Eureka registry page.

## Options

Open extension Options from `chrome://extensions` and configure:

- Request timeout (ms)
- Info auto-close delay (ms, minimum 250)
- Fallback mode
- Default view state:
   - Hide AMIs by default
   - Hide Zones by default
   - Hide other tables by default
- Diagnostics:
   - Enable diagnostics to show `Copy Debug` in the summary bar
   - Use it to capture redacted page URL (origin+path only), active settings, summary counts, and recent error samples

## Security and production checklist

- External links open with `target="_blank"` and `rel="noreferrer noopener"`.
- No dynamic script execution or eval.
- Timeouts are enforced on remote fetches.
- Network errors are handled and surfaced in-row.
- Host permissions are narrowed to actuator/info paths:
   - `http://*/*actuator/*`
   - `https://*/*actuator/*`
   - `http://*/*info*`
   - `https://*/*info*`

Before publishing:

1. Validate against representative HTTP and HTTPS Eureka environments.
2. Verify mixed-content behavior for each fallback mode.
3. Confirm required host permissions are minimal for your organization.
4. Review extension behavior on pages with large registry tables.
5. If requests fail due to unusual endpoint paths in your environment, expand host patterns only as needed.

## Publication assets

- Privacy policy: `PRIVACY_POLICY.md`
- Store listing and reviewer notes template: `WEBSTORE_SUBMISSION_NOTES.md`
