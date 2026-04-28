// ─────────────────────────────────────────────────────────────────────────────
// tz-update — safely bump moment-timezone to the latest release
//
// Usage: npm run tz:update
//
// Pipeline:
//   1. Record the current bundled tzdata version
//   2. Run `npm update moment-timezone`
//   3. Record the new bundled version
//   4. Run the parity + fuzz harness — if it fails, the update is unsafe
//      and you should investigate before committing
//   5. Print a clear before/after summary with next steps
//
// On test failure, this script does NOT auto-revert. The package.json /
// package-lock.json changes are left in place so you can investigate the
// divergence — `git checkout` to revert manually if needed.
// ─────────────────────────────────────────────────────────────────────────────

import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function getBundledVersion() {
  // Use a fresh require — the version may have changed between calls.
  delete require.cache[require.resolve("moment-timezone")];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moment = require("moment-timezone");
  return moment.tz.dataVersion;
}

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

async function main() {
  const before = getBundledVersion();
  console.log(`\nBundled tzdata before update: ${before}`);

  console.log("\n─── Step 1: npm update moment-timezone ───");
  try {
    run("npm update moment-timezone");
  } catch {
    console.error("\n✗ npm update failed. Aborting.");
    process.exit(1);
  }

  const after = getBundledVersion();
  console.log(`\nBundled tzdata after update:  ${after}`);

  if (before === after) {
    console.log("\n  No version change — already on latest available.");
    process.exit(0);
  }

  console.log(`\n  Bumped: ${before} → ${after}`);

  console.log("\n─── Step 2: Run parity harness ───");
  try {
    run("npx vitest run tests/bundled-zone-parity.test.ts tests/bundled-zone-fuzz.test.ts");
  } catch {
    console.error(
      "\n✗ Parity harness FAILED after tzdata bump.\n" +
        "  This usually means moment-timezone's data now diverges from\n" +
        "  Luxon's Intl-backed data in a way the test envelope didn't\n" +
        "  expect. Investigate the divergence:\n\n" +
        "    1. Read the failure output above to identify (zone, date) pairs\n" +
        "    2. If it's a real legislative DST change (like the BC permanent-DST\n" +
        "       case), add it to KNOWN_DIVERGENCES in tests/bundled-zone-fuzz.test.ts\n" +
        "    3. Re-run: npm run tz:update\n" +
        "    4. If divergence is unexpected, revert with:\n" +
        "       git checkout package.json package-lock.json && npm install\n",
    );
    process.exit(1);
  }

  console.log("\n─── Step 3: Run full test suite ───");
  try {
    run("npm test");
  } catch {
    console.error("\n✗ Full test suite failed. See output above.");
    process.exit(1);
  }

  console.log("\n─── Done ───");
  console.log(`✓ Successfully updated tzdata: ${before} → ${after}`);
  console.log(`\nTo ship this change:`);
  console.log(`  git add package.json package-lock.json`);
  console.log(`  git commit -m "Bump tzdata: ${before} → ${after}"`);
  const branch = (() => {
    try {
      return runCapture("git rev-parse --abbrev-ref HEAD");
    } catch {
      return "<your branch>";
    }
  })();
  console.log(`  git push origin ${branch}`);
}

main().catch((err) => {
  console.error("✗ Unexpected error:", err);
  process.exit(1);
});
