/**
 * ChronoShield SDK — Basic Usage Examples
 *
 * Run with: npx tsx examples/basic-usage.ts
 * (Set CHRONOSHIELD_API_KEY in your environment first)
 */

import { ChronoShieldClient } from "../src/index";

const client = new ChronoShieldClient({
  apiKey: process.env.CHRONOSHIELD_API_KEY || "YOUR_API_KEY",
});

async function main() {
  // 1. Validate a normal datetime (should be "valid")
  console.log("--- Validate: Normal datetime ---");
  const valid = await client.validate({
    local_datetime: "2026-07-15T14:30:00",
    time_zone: "America/New_York",
  });
  console.log(valid);

  // 2. Detect a DST gap (spring forward — 2:30 AM doesn't exist)
  console.log("\n--- Validate: DST gap ---");
  const gap = await client.validate({
    local_datetime: "2026-03-08T02:30:00",
    time_zone: "America/New_York",
  });
  console.log(gap);
  console.log("Suggested fixes:", gap.suggested_fixes);

  // 3. Detect a DST overlap (fall back — 1:30 AM is ambiguous)
  console.log("\n--- Validate: DST overlap ---");
  const overlap = await client.validate({
    local_datetime: "2026-11-01T01:30:00",
    time_zone: "America/New_York",
  });
  console.log(overlap);
  console.log("Possible instants:", overlap.possible_instants);

  // 4. Resolve an ambiguous time (pick the earlier offset)
  console.log("\n--- Resolve: Ambiguous datetime ---");
  const resolved = await client.resolve({
    local_datetime: "2026-11-01T01:30:00",
    time_zone: "America/New_York",
    resolution_policy: { ambiguous: "earlier" },
  });
  console.log(resolved);

  // 5. Convert a UTC instant to a local timezone
  console.log("\n--- Convert: UTC to Asia/Tokyo ---");
  const converted = await client.convert({
    instant_utc: "2026-07-15T18:00:00Z",
    target_time_zone: "Asia/Tokyo",
  });
  console.log(converted);

  // 6. Batch multiple operations in one request
  console.log("\n--- Batch: 3 mixed operations ---");
  const batch = await client.batch([
    { operation: "validate", local_datetime: "2026-03-08T02:30:00", time_zone: "America/New_York" },
    { operation: "convert", instant_utc: "2026-12-25T00:00:00Z", target_time_zone: "Europe/London" },
    { operation: "resolve", local_datetime: "2026-11-01T01:30:00", time_zone: "America/New_York", resolution_policy: { ambiguous: "later" } },
  ]);
  console.log(`Total: ${batch.total}, Succeeded: ${batch.succeeded}, Failed: ${batch.failed}`);
  for (const r of batch.results) {
    console.log(`  [${r.index}] ${r.operation}: ${r.success ? "OK" : "FAIL"}`, r.data || r.error);
  }
}

main().catch(console.error);
