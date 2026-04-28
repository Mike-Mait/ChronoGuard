"""
ChronoShield SDK — Basic Usage Examples

Run with: python examples/basic_usage.py
(Set CHRONOSHIELD_API_KEY in your environment first)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from chronoshield import ChronoShieldClient, ChronoShieldError

client = ChronoShieldClient(
    api_key=os.environ.get("CHRONOSHIELD_API_KEY", "YOUR_API_KEY")
)


def main():
    # 0. Check which IANA tzdata release the API is currently serving
    print("--- Version: which tzdata is the API on? ---")
    version = client.get_version()
    print(version)
    # VersionResponse(tzdb_version='2026b', tzdb_source='moment-timezone', ...)

    # 1. Validate a normal datetime (should be "valid")
    print("\n--- Validate: Normal datetime ---")
    valid = client.validate("2026-07-15T14:30:00", "America/New_York")
    print(f"Status: {valid.status}")

    # 2. Detect a DST gap (spring forward — 2:30 AM doesn't exist)
    print("\n--- Validate: DST gap ---")
    gap = client.validate("2026-03-08T02:30:00", "America/New_York")
    print(f"Status: {gap.status}")
    print(f"Reason: {gap.reason_code}")
    print(f"Suggested fixes: {gap.suggested_fixes}")

    # 3. Detect a DST overlap (fall back — 1:30 AM is ambiguous)
    print("\n--- Validate: DST overlap ---")
    overlap = client.validate("2026-11-01T01:30:00", "America/New_York")
    print(f"Status: {overlap.status}")
    print(f"Reason: {overlap.reason_code}")
    print(f"Possible instants: {overlap.possible_instants}")

    # 4. Resolve an ambiguous time (pick the earlier offset)
    print("\n--- Resolve: Ambiguous datetime ---")
    resolved = client.resolve(
        "2026-11-01T01:30:00",
        "America/New_York",
        ambiguous="earlier",
    )
    print(f"UTC: {resolved.instant_utc}")
    print(f"Offset: {resolved.offset}")

    # 5. Convert a UTC instant to a local timezone
    print("\n--- Convert: UTC to Asia/Tokyo ---")
    converted = client.convert("2026-07-15T18:00:00Z", "Asia/Tokyo")
    print(f"Local: {converted.local_datetime}")
    print(f"Offset: {converted.offset}")
    print(f"Timezone: {converted.time_zone}")

    # 6. Batch multiple operations in one request
    print("\n--- Batch: 3 mixed operations ---")
    batch = client.batch([
        {"operation": "validate", "local_datetime": "2026-03-08T02:30:00", "time_zone": "America/New_York"},
        {"operation": "convert", "instant_utc": "2026-12-25T00:00:00Z", "target_time_zone": "Europe/London"},
        {"operation": "resolve", "local_datetime": "2026-11-01T01:30:00", "time_zone": "America/New_York", "resolution_policy": {"ambiguous": "later"}},
    ])
    print(f"Total: {batch['total']}, Succeeded: {batch['succeeded']}, Failed: {batch['failed']}")
    for r in batch["results"]:
        status = "OK" if r["success"] else "FAIL"
        print(f"  [{r['index']}] {r['operation']}: {status} — {r.get('data') or r.get('error')}")

    # 7. Check rate limit state from the most recent call
    if client.last_rate_limit:
        rl = client.last_rate_limit
        print("\n--- Rate limit state ---")
        print(
            f"{rl.remaining} of {rl.limit} requests remaining "
            f"(resets {rl.reset_at.isoformat()})"
        )

    # 8. Demonstrate structured error handling
    print("\n--- Error handling: invalid timezone ---")
    try:
        client.convert("2026-07-15T18:00:00Z", "Fake/Atlantis")
    except ChronoShieldError as e:
        print(f"Caught ChronoShieldError → status={e.status} code={e.code}: {e.message}")


if __name__ == "__main__":
    main()
