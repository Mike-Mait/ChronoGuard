# Changelog

All notable changes to the ChronoShield TypeScript/JavaScript SDK are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.1.1] — 2026-04-28

### Fixed
- `homepage` field in package.json now points to `https://chronoshieldapi.com` (the product landing page) instead of `/docs`. Aligns with convention across major SDKs (Stripe, AWS, Google Cloud) where the npm "Homepage" link points users to the main product site rather than reference docs.
- `repository.url` field normalized to `git+https://...` form to silence the auto-correction warning npm previously emitted on publish.

No code changes — package contents are byte-identical to 1.1.0.

## [1.1.0] — 2026-04-28

### Added
- `getVersion()` method for the new `GET /v1/datetime/version` endpoint. Returns the IANA tzdata release currently powering the API (`tzdb_version`, `tzdb_source`, `tzdb_source_version`, `api_version`).
- `VersionResponse` interface for the version endpoint response shape.
- `ChronoShieldError` class — typed errors with structured `status`, `code`, `message`, `details`, and full `body` fields. Supersedes the previous generic `Error` throws so callers can branch on `code` without parsing strings.
- `client.lastRateLimit` field — populated from `X-RateLimit-*` response headers after each call. Useful for proactive backoff before hitting 429s.

### Changed
- Errors are now thrown as `ChronoShieldError` instances instead of plain `Error`. The error message is preserved, and the SDK still throws on any non-2xx response — but `instanceof ChronoShieldError` is the recommended check going forward.

### Notes
- API behavior change to be aware of: As of tzdata 2026b (which the API is currently serving), British Columbia's permanent-DST law is reflected in the data. `America/Vancouver` and `Canada/Pacific` queries dated after 2026-11-01 return offset `-07:00` permanently rather than alternating with `-08:00` in winter. This matches IANA's current data and is intentional. Use `getVersion()` to verify which tzdata release is live.

## [1.0.0] — 2026-04-07

### Added
- Initial release.
- `validate()`, `resolve()`, `convert()`, `batch()` methods for the four ChronoShield API endpoints.
- TypeScript types for all request and response shapes.
- Zero runtime dependencies.
