# ChronoShield SDK for TypeScript/JavaScript

Official TypeScript/JavaScript SDK for the [ChronoShield API](https://chronoshieldapi.com) — DST-aware datetime validation, resolution, and conversion.

## Installation

```bash
npm install chronoshield
```

## Quick Start

```typescript
import { ChronoShieldClient } from "chronoshield";

const client = new ChronoShieldClient({
  apiKey: "cg_live_your_api_key",
});

// Validate a datetime in a specific timezone
const result = await client.validate({
  local_datetime: "2026-03-08T02:30:00",
  time_zone: "America/New_York",
});

console.log(result.status); // "invalid" (falls in DST gap)
console.log(result.reason_code); // "DST_GAP"
console.log(result.suggested_fixes); // suggested corrections
```

## API Methods

### `validate(request)`

Check whether a local datetime is valid, invalid (DST gap), or ambiguous (DST overlap) in a given timezone.

```typescript
const result = await client.validate({
  local_datetime: "2026-11-01T01:30:00",
  time_zone: "America/New_York",
});
// result.status === "ambiguous"
// result.possible_instants includes both EDT and EST interpretations
```

### `resolve(request)`

Resolve a local datetime to a single UTC instant, with configurable policies for ambiguous and invalid times.

```typescript
const result = await client.resolve({
  local_datetime: "2026-11-01T01:30:00",
  time_zone: "America/New_York",
  resolution_policy: {
    ambiguous: "earlier", // or "later", "reject"
    invalid: "next_valid_time", // or "previous_valid_time", "reject"
  },
});
// result.instant_utc === "2026-11-01T05:30:00.000Z"
// result.offset === "-04:00"
```

### `convert(request)`

Convert a UTC instant to a local datetime in a target timezone.

```typescript
const result = await client.convert({
  instant_utc: "2026-07-15T18:00:00Z",
  target_time_zone: "Asia/Tokyo",
});
// result.local_datetime === "2026-07-16T03:00:00"
// result.offset === "+09:00"
```

### `batch(items)`

Process up to 100 validate/resolve/convert operations in a single request.

```typescript
const result = await client.batch([
  { operation: "validate", local_datetime: "2026-03-08T02:30:00", time_zone: "America/New_York" },
  { operation: "convert", instant_utc: "2026-07-15T18:00:00Z", target_time_zone: "Europe/London" },
]);
// result.total === 2
// result.results[0].success, result.results[0].data, etc.
```

### `getVersion()` *(new in v1.1.0)*

Returns which IANA tzdata release is currently powering the API. Useful for verifying that your results are computed against the tzdb release you expect — particularly when reproducing historical results or debugging timezone-rule edge cases.

```typescript
const v = await client.getVersion();
// {
//   tzdb_version: "2026b",
//   tzdb_source: "moment-timezone",
//   tzdb_source_version: "0.6.2",
//   api_version: "1.3.0"
// }
```

This endpoint is public — no API key required (though the SDK will send yours if configured).

## Rate Limit Awareness

After every authenticated call, the client updates `lastRateLimit` from the `X-RateLimit-*` response headers. Useful for proactive backoff before you actually hit a 429:

```typescript
await client.validate({ local_datetime: "...", time_zone: "..." });

if (client.lastRateLimit) {
  console.log(`${client.lastRateLimit.remaining} of ${client.lastRateLimit.limit} requests remaining`);
  console.log(`Resets at ${client.lastRateLimit.resetAt.toISOString()}`);

  if (client.lastRateLimit.remaining < 100) {
    // back off, queue, or pause your worker
  }
}
```

## Configuration

```typescript
const client = new ChronoShieldClient({
  apiKey: "cg_live_your_api_key",
  baseUrl: "https://chronoshieldapi.com", // optional, this is the default
});
```

## Error Handling

The SDK throws a typed `ChronoShieldError` for any non-2xx response. The error carries the structured fields the API returns (`code`, `message`, optional `details`) plus the HTTP status — so you can branch on machine-readable values without parsing strings:

```typescript
import { ChronoShieldClient, ChronoShieldError } from "chronoshield";

try {
  await client.validate({ local_datetime: "bad", time_zone: "Invalid/Zone" });
} catch (err) {
  if (err instanceof ChronoShieldError) {
    console.error(`status: ${err.status}`);     // 400
    console.error(`code:   ${err.code}`);       // "VALIDATION_FAILED"
    console.error(`detail: ${err.message}`);    // "Invalid IANA timezone: ..."

    if (err.code === "RATE_LIMIT_EXCEEDED") {
      // back off and retry
    }
  } else {
    throw err; // unexpected (network, etc.)
  }
}
```

Common error codes:
- `VALIDATION_FAILED` — request body didn't match schema
- `INVALID_TIMEZONE` — `time_zone` isn't a valid IANA identifier
- `UNAUTHORIZED` — API key missing or invalid
- `RATE_LIMIT_EXCEEDED` — out of quota for this period

## Notable behavior: BC permanent DST

As of tzdata 2026b (which the API is currently serving), British Columbia's permanent-DST law is reflected in the data: **`America/Vancouver` and `Canada/Pacific` queries dated after 2026-11-01 return offset `-07:00` permanently** rather than alternating with `-08:00` in winter.

This matches IANA's current data and is the intended behavior. To verify which tzdata release your queries are computed against at any time, call `getVersion()`.

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
