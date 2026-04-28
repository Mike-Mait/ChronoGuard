# ChronoShield SDK for Python

Official Python SDK for the [ChronoShield API](https://chronoshieldapi.com) — DST-aware datetime validation, resolution, and conversion.

## Installation

```bash
pip install chronoshield
```

## Quick Start

```python
from chronoshield import ChronoShieldClient

client = ChronoShieldClient(api_key="cg_live_your_api_key")

# Validate a datetime in a specific timezone
result = client.validate("2026-03-08T02:30:00", "America/New_York")

print(result.status)          # "invalid" (falls in DST gap)
print(result.reason_code)     # "DST_GAP"
print(result.suggested_fixes) # suggested corrections
```

## API Methods

### `validate(local_datetime, time_zone)`

Check whether a local datetime is valid, invalid (DST gap), or ambiguous (DST overlap) in a given timezone.

```python
result = client.validate("2026-11-01T01:30:00", "America/New_York")
# result.status == "ambiguous"
# result.possible_instants includes both EDT and EST interpretations
```

Returns a `ValidateResponse` dataclass with fields: `status`, `reason_code`, `message`, `suggested_fixes`, `possible_instants`.

### `resolve(local_datetime, time_zone, ambiguous, invalid)`

Resolve a local datetime to a single UTC instant, with configurable policies for ambiguous and invalid times.

```python
result = client.resolve(
    "2026-11-01T01:30:00",
    "America/New_York",
    ambiguous="earlier",           # or "later", "reject"
    invalid="next_valid_time",     # or "previous_valid_time", "reject"
)
# result.instant_utc == "2026-11-01T05:30:00.000Z"
# result.offset == "-04:00"
```

Returns a `ResolveResponse` dataclass with fields: `instant_utc`, `offset`.

### `convert(instant_utc, target_time_zone)`

Convert a UTC instant to a local datetime in a target timezone.

```python
result = client.convert("2026-07-15T18:00:00Z", "Asia/Tokyo")
# result.local_datetime == "2026-07-16T03:00:00"
# result.offset == "+09:00"
```

Returns a `ConvertResponse` dataclass with fields: `local_datetime`, `offset`, `time_zone`.

### `batch(items)`

Process up to 100 validate/resolve/convert operations in a single request.

```python
result = client.batch([
    {"operation": "validate", "local_datetime": "2026-03-08T02:30:00", "time_zone": "America/New_York"},
    {"operation": "convert", "instant_utc": "2026-07-15T18:00:00Z", "target_time_zone": "Europe/London"},
])
# result["total"] == 2
# result["results"][0]["success"], result["results"][0]["data"], etc.
```

Returns a dict with keys: `results`, `total`, `succeeded`, `failed`.

### `get_version()` *(new in v1.1.0)*

Returns which IANA tzdata release is currently powering the API. Useful for verifying that your results are computed against the tzdb release you expect — particularly when reproducing historical results or debugging timezone-rule edge cases.

```python
v = client.get_version()
# VersionResponse(
#   tzdb_version='2026b',
#   tzdb_source='moment-timezone',
#   tzdb_source_version='0.6.2',
#   api_version='1.3.0'
# )
```

This endpoint is public — no API key required (though the SDK will send yours if configured).

## Rate Limit Awareness

After every authenticated call, the client updates `last_rate_limit` from the `X-RateLimit-*` response headers. Useful for proactive backoff before you actually hit a 429:

```python
client.validate("2026-07-15T14:30:00", "America/New_York")

if client.last_rate_limit:
    rl = client.last_rate_limit
    print(f"{rl.remaining} of {rl.limit} requests remaining")
    print(f"Resets at {rl.reset_at.isoformat()}")

    if rl.remaining < 100:
        # back off, queue, or pause your worker
        ...
```

## Configuration

```python
client = ChronoShieldClient(
    api_key="cg_live_your_api_key",
    base_url="https://chronoshieldapi.com",  # optional, this is the default
)
```

## Error Handling

The SDK raises a typed `ChronoShieldError` for any non-2xx response. The exception carries the structured fields the API returns (`code`, `message`, optional `details`) plus the HTTP status — so you can branch on machine-readable values without parsing strings:

```python
from chronoshield import ChronoShieldClient, ChronoShieldError

try:
    client.validate("bad", "Invalid/Zone")
except ChronoShieldError as e:
    print(f"status: {e.status}")     # 400
    print(f"code:   {e.code}")       # "VALIDATION_FAILED"
    print(f"detail: {e.message}")    # "Invalid IANA timezone: ..."

    if e.code == "RATE_LIMIT_EXCEEDED":
        # back off and retry
        ...
```

Common error codes:
- `VALIDATION_FAILED` — request body didn't match schema
- `INVALID_TIMEZONE` — `time_zone` isn't a valid IANA identifier
- `UNAUTHORIZED` — API key missing or invalid
- `RATE_LIMIT_EXCEEDED` — out of quota for this period

## Notable behavior: BC permanent DST

As of tzdata 2026b (which the API is currently serving), British Columbia's permanent-DST law is reflected in the data: **`America/Vancouver` and `Canada/Pacific` queries dated after 2026-11-01 return offset `-07:00` permanently** rather than alternating with `-08:00` in winter.

This matches IANA's current data and is the intended behavior. To verify which tzdata release your queries are computed against at any time, call `get_version()`.

## Zero Dependencies

This SDK uses only the Python standard library (`urllib`, `json`, `dataclasses`, `datetime`) — no external packages required.

## Get an API Key

1. Visit [chronoshieldapi.com](https://chronoshieldapi.com) and click **"Get Free API Key"**
2. Enter your email — a key is generated instantly
3. Free tier includes 1,000 requests/month

## Links

- [API Documentation](https://chronoshieldapi.com/docs)
- [GitHub Repository](https://github.com/Mike-Mait/ChronoShield-API)
- [Status Page](https://chronoshield-api.betteruptime.com)
- [Changelog](./CHANGELOG.md)

## License

ISC
