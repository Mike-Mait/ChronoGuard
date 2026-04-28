// ─────────────────────────────────────────────────────────────────────────────
// tz-check — compare bundled tzdata version against IANA's latest release
//
// Usage: npm run tz:check
//
// Exits 0 if up-to-date, 1 if behind, 2 on network/error. Designed to be
// runnable both interactively and as a CI status check.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const IANA_VERSION_URL = "https://data.iana.org/time-zones/tzdb/version";
const FETCH_TIMEOUT_MS = 10_000;

async function main() {
  // Bundled version (what the API is currently serving)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moment = require("moment-timezone");
  const bundled = moment.tz.dataVersion;

  // Latest IANA release — fetch with a hard timeout so a hung CI step
  // can't block the workflow forever.
  let latest;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(IANA_VERSION_URL, { signal: controller.signal });
    if (!res.ok) {
      console.error(`✗ Failed to fetch IANA version: HTTP ${res.status}`);
      process.exitCode = 2;
    return;
    }
    latest = (await res.text()).trim();
  } catch (err) {
    console.error(`✗ Failed to fetch IANA version:`, err.message);
    process.exitCode = 2;
    return;
  } finally {
    clearTimeout(timeout);
  }

  console.log(`Bundled tzdata (moment-timezone): ${bundled}`);
  console.log(`Latest IANA release:              ${latest}`);

  if (bundled === latest) {
    console.log(`\n✓ Up to date.`);
    return; // exitCode defaults to 0
  }

  console.log(`\n⚠ Update available. To upgrade:`);
  console.log(`    npm run tz:update`);
  console.log(`\n  This runs 'npm update moment-timezone' then the parity harness.`);
  console.log(`  If parity passes, commit the package-lock.json change.`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err);
  process.exitCode = 2;
});
