# SpringInfo Release Checklist

## Code and security

- [x] Manifest is valid (MV3)
- [x] No runtime code errors in extension files
- [x] No company-specific identifiers in source/docs
- [x] No hardcoded private/local network URLs
- [x] No eval/dynamic remote script execution patterns
- [x] External links use safe rel attributes (`noreferrer noopener`)
- [x] Diagnostics payload is redacted (origin+path only)

## Permissions

- [x] Extension API permissions are minimal (`storage` only)
- [x] Host permissions are scoped to actuator/info paths
- [x] Content script runs only on `/registry` style paths

## Assets

- [x] Required extension icons exist (16, 32, 48, 128)
- [x] Action icon mappings are set in manifest

## Store readiness

- [x] Privacy policy prepared (`PRIVACY_POLICY.md`)
- [x] Listing/reviewer notes prepared (`WEBSTORE_SUBMISSION_NOTES.md`)
- [x] Public-facing README prepared (`README.md`)

## Manual pre-submit smoke test

- [ ] Reload extension in `chrome://extensions`
- [ ] Verify info fetch on at least one HTTPS registry page
- [ ] Verify fallback mode behavior (`none`, `https-upgrade`, `skip-insecure`)
- [ ] Verify auto-close delay behavior and copy/select interaction in info panel
- [ ] Verify Reset View and persisted visibility toggles
- [ ] Verify optional diagnostics `Copy Debug`

## Packaging

- [ ] Build final zip archive for upload
