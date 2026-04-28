// ─────────────────────────────────────────────────────────────────────────────
// Defensive fuzz harness: BundledIANAZone vs Luxon IANAZone
//
// Complements the curated parity harness (bundled-zone-parity.test.ts) with:
//
//   1. Full-bundle sweep — every zone moment-timezone knows about (~597),
//      not just the 38 I hand-picked. Catches obscure zones I might have
//      omitted (Antarctica/Vostok, Pacific/Bougainville, etc.).
//
//   2. Seeded random fuzz — 10,000 random (zone, ts) pairs across a wide
//      time range. Uses a fixed seed so any failure is reproducible.
//
//   3. Transition-boundary probing — walks the actual transitions array
//      from moment-timezone's data and checks parity at ts-1ms, ts, ts+1ms
//      around every known transition. This is the most adversarial test:
//      it hits the exact instants where DST/historical-rule logic is
//      most likely to diverge.
//
// All three layers should pass cleanly. If any fails, the failure points
// to a real bug in the adapter that the curated harness missed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it } from "vitest";
import { IANAZone } from "luxon";
import { BundledIANAZone } from "../src/utils/bundledZone";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const moment = require("moment-timezone");

// ─── Production parity envelope ─────────────────────────────────────────────
// We assert strict parity between BundledIANAZone and Luxon's IANAZone only
// within the time range that any realistic API query could touch. Outside
// this range, the two implementations are *expected* to disagree because
// they consult independent data sources:
//
//   PRE-1972 ("LMT era"): Before global standardization, many zones used
//   Local Mean Time with sub-minute precision (Moscow 1919: +271:07 vs
//   +271:32; Liberia stayed on -00:44:30 until Jan 1972). moment-timezone
//   and Luxon's Intl-backed IANAZone use independent historical records,
//   disagreeing by fractions of a minute. No realistic customer query
//   touches these — no one schedules events for 1919.
//
//   POST-2040 ("Future projection era"): Beyond ~15 years out, both
//   implementations are *projecting* DST policy that doesn't yet exist
//   in law. moment-timezone uses IANA's current best-guess rules from
//   tzdata 2026b. Luxon (via Node's ICU) uses POSIX rules in the TZif
//   footer. These projections drift apart for zones with active
//   legislative uncertainty (Canada/Pacific in 2050: moment projects
//   PDT, ICU projects PST). Neither is "right" — DST policy that far
//   out is genuinely unknown.
//
// IMPORTANT: post-cutover, the API's source of truth becomes
// moment-timezone, NOT Luxon's Intl. So any disagreement here resolves
// in moment's favor by definition — that's the architectural choice
// already made on Day 0.
const PARITY_RANGE_START = new Date("1972-01-01T00:00:00Z").getTime();
const PARITY_RANGE_END = new Date("2040-01-01T00:00:00Z").getTime();

// ─── Known acceptable divergences ───────────────────────────────────────────
// Specific (zone, time-range) combinations where moment-timezone and Luxon
// legitimately disagree because moment encodes recent legislative DST changes
// faster than Node's bundled ICU. Listed here so the fuzz tests don't fail
// on them, but also so any reviewer can immediately see what behavioral
// changes will happen post-cutover.
//
// EACH entry must include the IANA zone name, the date range affected, and
// a comment explaining what's happening and which source is "more correct."
interface KnownDivergence {
  zone: string;
  /** Inclusive lower bound, epoch ms. */
  from: number;
  /** Inclusive upper bound, epoch ms. */
  to: number;
  reason: string;
}
const KNOWN_DIVERGENCES: KnownDivergence[] = [
  {
    zone: "America/Vancouver",
    from: new Date("2026-11-01T00:00:00Z").getTime(),
    to: PARITY_RANGE_END,
    reason:
      "BC permanent-DST legislation: moment-timezone 2026b projects Vancouver " +
      "stays on PDT (-07:00) permanently after 2026-11-01. Luxon's Intl " +
      "continues alternating PST/PDT. Switching to BundledIANAZone adopts " +
      "moment's projection — the API will return -07:00 for Vancouver " +
      "queries after Nov 1 2026. This matches IANA's current data and is " +
      "the intended behavior post-cutover.",
  },
  {
    zone: "Canada/Pacific",
    from: new Date("2026-11-01T00:00:00Z").getTime(),
    to: PARITY_RANGE_END,
    reason: "Alias for America/Vancouver — see above.",
  },
];

function isKnownDivergence(zone: string, ts: number): boolean {
  for (const k of KNOWN_DIVERGENCES) {
    if (k.zone === zone && ts >= k.from && ts <= k.to) return true;
  }
  return false;
}

// ─── Reproducible PRNG (Mulberry32) ─────────────────────────────────────────
// Fixed seed so a failure here can be re-investigated by anyone with the
// same seed. Change only if you intentionally want to re-roll.
const SEED = 0xdeadbeef;
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const MAX_REPORTED = 25;

interface Divergence {
  zone: string;
  ts: number;
  iso: string;
  field: string;
  luxon: string | number;
  bundled: string | number;
}

function fmtIso(ts: number): string {
  try {
    return new Date(ts).toISOString();
  } catch {
    return `(invalid epoch ${ts})`;
  }
}

function reportDivergences(label: string, divergences: Divergence[], totalChecks: number): void {
  if (divergences.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`  [${label}] ✓ ${totalChecks} checks, 0 divergences`);
    return;
  }
  const sample = divergences.slice(0, MAX_REPORTED);
  const lines = sample.map(
    (d) =>
      `  ${d.zone.padEnd(34)} ${d.field.padEnd(15)} @ ${d.iso}  lux=${d.luxon}  bnd=${d.bundled}`,
  );
  const more =
    divergences.length > MAX_REPORTED
      ? `\n  ...and ${divergences.length - MAX_REPORTED} more`
      : "";
  throw new Error(
    `[${label}] ${divergences.length}/${totalChecks} divergence(s):\n${lines.join("\n")}${more}`,
  );
}

// ─── Test 1: Every zone in the bundle ───────────────────────────────────────

describe("BundledIANAZone fuzz — full-bundle sweep", () => {
  it("offset parity holds for every zone moment-timezone knows about", () => {
    const allZones: string[] = moment.tz.names();
    // Sample timestamps: spread across DST-active period + edge eras
    // All within parity envelope (1972-2040) — see PARITY_RANGE comment.
    const sampleTimestamps = [
      new Date("1985-06-15T12:00:00Z").getTime(),
      new Date("2000-12-25T00:00:00Z").getTime(),
      new Date("2026-03-08T07:30:00Z").getTime(), // NY spring-forward window
      new Date("2026-07-15T12:00:00Z").getTime(),
      new Date("2026-11-01T06:30:00Z").getTime(), // NY fall-back window
      new Date("2035-01-01T00:00:00Z").getTime(), // 9 years out — still in envelope
    ];
    const divergences: Divergence[] = [];
    let totalChecks = 0;
    let skippedZones = 0;

    for (const zone of allZones) {
      // Skip zones Luxon's IANAZone considers invalid — these are typically
      // aliases or zones that ICU doesn't ship. Not our problem to align.
      if (!IANAZone.isValidZone(zone)) {
        skippedZones++;
        continue;
      }
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);
      for (const ts of sampleTimestamps) {
        totalChecks++;
        if (isKnownDivergence(zone, ts)) continue;
        const luxOff = lux.offset(ts);
        const bndOff = bnd.offset(ts);
        if (luxOff !== bndOff) {
          divergences.push({
            zone,
            ts,
            iso: fmtIso(ts),
            field: "offset",
            luxon: luxOff,
            bundled: bndOff,
          });
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `  full-bundle sweep: ${allZones.length} bundled zones, ${skippedZones} skipped (Luxon-invalid), ${totalChecks} pairs checked`,
    );
    reportDivergences("full-bundle offset", divergences, totalChecks);
  });
});

// ─── Test 2: Seeded random fuzz ─────────────────────────────────────────────

describe("BundledIANAZone fuzz — seeded random pairs", () => {
  it("offset and formatOffset parity holds for 10,000 random (zone, ts) pairs", () => {
    const rng = mulberry32(SEED);
    const allZones: string[] = moment.tz
      .names()
      .filter((z: string) => IANAZone.isValidZone(z));
    const ITERATIONS = 10_000;
    // Confine random sampling to the production parity envelope (1972-2040).
    // See PARITY_RANGE comment for why outside-envelope divergences are
    // expected, real, and not bugs in our adapter.
    const TS_MIN = PARITY_RANGE_START;
    const TS_MAX = PARITY_RANGE_END;
    const TS_RANGE = TS_MAX - TS_MIN;

    const divergences: Divergence[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const zone = allZones[Math.floor(rng() * allZones.length)];
      const ts = Math.floor(TS_MIN + rng() * TS_RANGE);
      if (isKnownDivergence(zone, ts)) continue;
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);

      const luxOff = lux.offset(ts);
      const bndOff = bnd.offset(ts);
      if (luxOff !== bndOff) {
        divergences.push({
          zone,
          ts,
          iso: fmtIso(ts),
          field: "offset",
          luxon: luxOff,
          bundled: bndOff,
        });
      }
      const luxFmt = lux.formatOffset(ts, "short");
      const bndFmt = bnd.formatOffset(ts, "short");
      if (luxFmt !== bndFmt) {
        divergences.push({
          zone,
          ts,
          iso: fmtIso(ts),
          field: "formatOffset",
          luxon: luxFmt,
          bundled: bndFmt,
        });
      }
    }
    reportDivergences(`random (seed=0x${SEED.toString(16)})`, divergences, ITERATIONS * 2);
  });
});

// ─── Test 3: Transition-boundary probing ────────────────────────────────────

describe("BundledIANAZone fuzz — transition boundary probing", () => {
  it("offset matches on both sides of every known transition for major DST zones", () => {
    // Walk moment-timezone's actual `untils` array for each zone — this is
    // the ground-truth list of every transition the bundle knows about.
    // For each transition `t`, check that BOTH implementations agree on
    // the offset at t-1ms (just before transition) and t (at/after transition).
    const probedZones = [
      "America/New_York",
      "America/Los_Angeles",
      "America/Chicago",
      "America/Denver",
      "America/Anchorage",
      "America/Sao_Paulo",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Moscow",
      "Europe/Istanbul",
      "Australia/Sydney",
      "Australia/Lord_Howe",
      "Pacific/Auckland",
      "Pacific/Chatham",
      "Pacific/Apia",
      "Africa/Casablanca",
      "Africa/Cairo",
      "Asia/Tehran",
      "Asia/Pyongyang",
    ];

    const divergences: Divergence[] = [];
    let totalChecks = 0;

    for (const zone of probedZones) {
      const momentZone = moment.tz.zone(zone);
      if (!momentZone) continue;
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);

      // momentZone.untils is sorted ascending. Last element may be Infinity.
      const untils: number[] = momentZone.untils;
      for (const t of untils) {
        if (!Number.isFinite(t)) continue;
        // Confine to production parity envelope. See PARITY_RANGE comment.
        if (t < PARITY_RANGE_START) continue;
        if (t > PARITY_RANGE_END) continue;

        // Probe at t-1 (just before), t (at boundary), t+1 (just after)
        for (const probe of [t - 1, t, t + 1]) {
          totalChecks++;
          if (isKnownDivergence(zone, probe)) continue;
          const luxOff = lux.offset(probe);
          const bndOff = bnd.offset(probe);
          if (luxOff !== bndOff) {
            divergences.push({
              zone,
              ts: probe,
              iso: fmtIso(probe),
              field: "offset",
              luxon: luxOff,
              bundled: bndOff,
            });
          }
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`  transition probing: ${totalChecks} boundary checks across ${probedZones.length} zones`);
    reportDivergences("transition boundaries", divergences, totalChecks);
  });
});
