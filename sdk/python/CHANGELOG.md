# Changelog

All notable changes to the ChronoShield Python SDK are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-04-28

### Added
- `get_version()` method for the new `GET /v1/datetime/version` endpoint. Returns the IANA tzdata release currently powering the API (`tzdb_version`, `tzdb_source`, `tzdb_source_version`, `api_version`).
- `VersionResponse` dataclass for the version endpoint response shape.
- `ChronoShieldError` exception class — typed errors with structured `status`, `code`, `message`, `details`, and full `body` attributes. Supersedes the previous `RuntimeError` raises so callers can branch on `code` without parsing strings.
- `RateLimitInfo` dataclass and `client.last_rate_limit` attribute — populated from `X-RateLimit-*` response headers after each call. Useful for proactive backoff before hitting 429s.

### Changed
- Errors are now raised as `ChronoShieldError` instances instead of `RuntimeError`. The error message is preserved, and the SDK still raises on any non-2xx response — but `except ChronoShieldError` is the recommended check going forward.

### Notes
- API behavior change to be aware of: As of tzdata 2026b (which the API is currently serving), British Columbia's permanent-DST law is reflected in the data. `America/Vancouver` and `Canada/Pacific` queries dated after 2026-11-01 return offset `-07:00` permanently rather than alternating with `-08:00` in winter. This matches IANA's current data and is intentional. Use `get_version()` to verify which tzdata release is live.

## [1.0.0] — 2026-04-07

### Added
- Initial release.
- `validate()`, `resolve()`, `convert()`, `batch()` methods for the four ChronoShield API endpoints.
- Dataclass response types.
- Zero external dependencies — uses only Python standard library.
