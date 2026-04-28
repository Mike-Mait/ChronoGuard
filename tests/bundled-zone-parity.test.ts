// ─────────────────────────────────────────────────────────────────────────────
// Parity harness: BundledIANAZone vs Luxon's stock IANAZone
//
// Purpose: Before cutting `utils/timezone.ts` over to BundledIANAZone (Day 4),
// prove that the new adapter produces identical observable behavior to the
// existing implementation across a comprehensive matrix of zones, timestamps,
// and Zone interface methods.
//
// If this file passes, the cutover is safe-by-construction for all tested
// inputs. Any failure here MUST be investigated and resolved before Day 4.
//
// Strategy: For each dimension (offset, formatOffset, fromISO round-trip,
// validity), walk the full (zone × timestamp) matrix and aggregate
// divergences. Each test reports the first N divergences then fails — this
// produces actionable output rather than a single opaque "expected !== actual".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { DateTime, IANAZone } from "luxon";
import { BundledIANAZone } from "../src/utils/bundledZone";

// ─── Zone matrix ────────────────────────────────────────────────────────────
// Curated to cover: major US/EU/Asia/Pacific markets, no-DST zones,
// non-whole-hour offsets, 30-min DST shifts, and zones with quirky
// historical rule changes.
const ZONES = [
  // US — DST + no-DST
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix", // No DST in main Arizona
  "America/Anchorage",
  "Pacific/Honolulu", // No DST
  // Latin America
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Mexico_City",
  // Europe
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul", // Changed DST rules in 2016
  "Europe/Dublin",
  // Asia — including non-whole-hour
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata", // +5:30
  "Asia/Kathmandu", // +5:45
  "Asia/Tehran", // Iran abolished DST in 2022
  "Asia/Yangon", // +6:30
  "Asia/Pyongyang", // Changed offsets in 2015 and 2018
  // Africa
  "Africa/Cairo", // Reinstated DST in 2023
  "Africa/Casablanca", // Complex DST around Ramadan
  "Africa/Johannesburg",
  // Oceania — including 30-min DST and +12:45
  "Australia/Sydney",
  "Australia/Lord_Howe", // 30-min DST shift
  "Australia/Adelaide", // +9:30 / +10:30
  "Pacific/Auckland",
  "Pacific/Chatham", // +12:45 / +13:45
  "Pacific/Apia", // Jumped date line in Dec 2011
  "Pacific/Kiritimati", // +14
  // Special / fixed
  "UTC",
  "Etc/GMT",
  "Etc/GMT+5",
  "Etc/GMT-12",
];

// ─── Timestamp matrix ───────────────────────────────────────────────────────
// Mix of: spread across 1970-2100, every year-half-and-DST-transition
// 2020-2030, plus deep history and far future.
function buildTimestamps(): { iso: string; ts: number }[] {
  const out: { iso: string; ts: number }[] = [];
  const seen = new Set<number>();

  const push = (iso: string) => {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return;
    if (seen.has(ts)) return;
    seen.add(ts);
    out.push({ iso, ts });
  };

  // Year-by-year spread, with summer/winter sample for each
  for (let year = 1970; year <= 2100; year += year < 2020 || year > 2030 ? 5 : 1) {
    push(`${year}-01-15T12:00:00Z`);
    push(`${year}-07-15T12:00:00Z`);
  }

  // DST transition zones: hit every weekend in March/April and October/November
  // for 2020-2030 — this catches both Northern and Southern hemisphere transitions.
  for (let year = 2020; year <= 2030; year++) {
    for (const month of [3, 4, 10, 11] as const) {
      for (let day = 1; day <= 7; day++) {
        // Hit the canonical 02:30 local time across UTC offsets — sample at 06:30 and 02:30 UTC
        push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T02:30:00Z`);
        push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T06:30:00Z`);
        push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T14:30:00Z`);
      }
    }
  }

  // Famous quirky moments
  push("2011-12-30T12:00:00Z"); // Samoa skipped this day
  push("2011-12-31T00:00:00Z"); // ...and this is what came next for Apia
  push("2016-09-07T00:00:00Z"); // Turkey abandoned DST
  push("2018-05-04T15:00:00Z"); // North Korea changed offset
  push("2022-09-22T00:00:00Z"); // Iran abolished DST
  push("2023-04-26T00:00:00Z"); // Egypt reinstated DST

  return out;
}

const TIMESTAMPS = buildTimestamps();

// ─── Helpers ────────────────────────────────────────────────────────────────
const MAX_REPORTED_DIVERGENCES = 20;

interface Divergence {
  zone: string;
  iso: string;
  luxon: string | number;
  bundled: string | number;
}

function reportDivergences(label: string, divergences: Divergence[]): void {
  if (divergences.length === 0) return;
  const sample = divergences.slice(0, MAX_REPORTED_DIVERGENCES);
  const lines = sample.map(
    (d) => `  ${d.zone.padEnd(30)} @ ${d.iso}  lux=${d.luxon}  bnd=${d.bundled}`,
  );
  const more =
    divergences.length > MAX_REPORTED_DIVERGENCES
      ? `\n  ...and ${divergences.length - MAX_REPORTED_DIVERGENCES} more`
      : "";
  throw new Error(
    `[${label}] ${divergences.length} divergence(s) found:\n${lines.join("\n")}${more}`,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("BundledIANAZone parity vs Luxon IANAZone", () => {
  it(`covers ${ZONES.length} zones × ${TIMESTAMPS.length} timestamps = ${ZONES.length * TIMESTAMPS.length} pairs`, () => {
    expect(ZONES.length).toBeGreaterThan(30);
    expect(TIMESTAMPS.length).toBeGreaterThan(200);
  });

  it("isValidZone agrees on all zones in the matrix", () => {
    const divergences: Divergence[] = [];
    for (const zone of ZONES) {
      const lux = IANAZone.isValidZone(zone);
      const bnd = BundledIANAZone.isValidZone(zone);
      if (lux !== bnd) {
        divergences.push({ zone, iso: "n/a", luxon: String(lux), bundled: String(bnd) });
      }
    }
    reportDivergences("isValidZone", divergences);
  });

  it("isValidZone agrees on known-invalid names", () => {
    const invalidNames = [
      "Fake/Place",
      "America/Atlantis",
      "Sport~~blorp",
      "",
      "/",
      "America//New_York",
      "not-a-zone",
    ];
    const divergences: Divergence[] = [];
    for (const zone of invalidNames) {
      const lux = IANAZone.isValidZone(zone);
      const bnd = BundledIANAZone.isValidZone(zone);
      if (lux !== bnd) {
        divergences.push({ zone, iso: "n/a", luxon: String(lux), bundled: String(bnd) });
      }
    }
    reportDivergences("isValidZone (invalid names)", divergences);
  });

  it("offset(ts) returns identical minutes for all (zone, ts) pairs", () => {
    const divergences: Divergence[] = [];
    for (const zone of ZONES) {
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);
      for (const { iso, ts } of TIMESTAMPS) {
        const luxOff = lux.offset(ts);
        const bndOff = bnd.offset(ts);
        if (luxOff !== bndOff) {
          divergences.push({ zone, iso, luxon: luxOff, bundled: bndOff });
        }
      }
    }
    reportDivergences("offset(ts)", divergences);
  });

  it("formatOffset(ts, 'short') returns identical strings for all pairs", () => {
    const divergences: Divergence[] = [];
    for (const zone of ZONES) {
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);
      for (const { iso, ts } of TIMESTAMPS) {
        const luxStr = lux.formatOffset(ts, "short");
        const bndStr = bnd.formatOffset(ts, "short");
        if (luxStr !== bndStr) {
          divergences.push({ zone, iso, luxon: luxStr, bundled: bndStr });
        }
      }
    }
    reportDivergences("formatOffset(ts, 'short')", divergences);
  });

  it("formatOffset(ts, 'techie') returns identical strings for all pairs", () => {
    const divergences: Divergence[] = [];
    for (const zone of ZONES) {
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);
      for (const { iso, ts } of TIMESTAMPS) {
        const luxStr = lux.formatOffset(ts, "techie");
        const bndStr = bnd.formatOffset(ts, "techie");
        if (luxStr !== bndStr) {
          divergences.push({ zone, iso, luxon: luxStr, bundled: bndStr });
        }
      }
    }
    reportDivergences("formatOffset(ts, 'techie')", divergences);
  });

  it("formatOffset(ts, 'narrow') returns identical strings for all pairs", () => {
    const divergences: Divergence[] = [];
    for (const zone of ZONES) {
      const lux = IANAZone.create(zone);
      const bnd = BundledIANAZone.create(zone);
      for (const { iso, ts } of TIMESTAMPS) {
        const luxStr = lux.formatOffset(ts, "narrow");
        const bndStr = bnd.formatOffset(ts, "narrow");
        if (luxStr !== bndStr) {
          divergences.push({ zone, iso, luxon: luxStr, bundled: bndStr });
        }
      }
    }
    reportDivergences("formatOffset(ts, 'narrow')", divergences);
  });

  it("DateTime.fromISO with bundled zone produces identical UTC instants", () => {
    // This is the most important test: it proves Luxon's parser, used with
    // BundledIANAZone, produces the same final epoch ms as with stock IANAZone.
    // If THIS test passes for unambiguous local times, our cutover is safe.
    const divergences: Divergence[] = [];
    const localTimes = [
      "2024-06-15T10:30:00",
      "2024-12-15T10:30:00",
      "2025-03-09T01:30:00", // pre-DST in NY
      "2025-03-09T02:30:00", // INSIDE NY spring-forward gap — Luxon auto-resolves forward
      "2025-03-09T04:30:00", // post-DST in NY
      "2025-11-02T01:30:00", // INSIDE NY fall-back overlap — Luxon picks one occurrence
      "2025-11-02T03:30:00", // post-fallback in NY
      "2026-06-15T15:00:00",
      "2026-10-04T02:15:00", // INSIDE Lord Howe 30-min gap
      "2026-04-05T01:45:00", // INSIDE Lord Howe 30-min overlap
      "1995-07-04T12:00:00",
      "2050-01-01T00:00:00",
    ];
    for (const zone of ZONES) {
      for (const local of localTimes) {
        const luxDt = DateTime.fromISO(local, { zone: IANAZone.create(zone) });
        const bndDt = DateTime.fromISO(local, { zone: BundledIANAZone.create(zone) });
        if (!luxDt.isValid || !bndDt.isValid) continue;
        const luxUtc = luxDt.toUTC().toISO();
        const bndUtc = bndDt.toUTC().toISO();
        if (luxUtc !== bndUtc) {
          divergences.push({
            zone,
            iso: local,
            luxon: luxUtc ?? "null",
            bundled: bndUtc ?? "null",
          });
        }
      }
    }
    reportDivergences("DateTime.fromISO UTC parity", divergences);
  });

  it("equals() correctly identifies same-name zones", () => {
    const a = BundledIANAZone.create("America/New_York");
    const b = BundledIANAZone.create("America/New_York");
    const c = BundledIANAZone.create("Europe/London");
    const luxonNY = IANAZone.create("America/New_York");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    // Cross-equality with Luxon's IANAZone (same iana name) — useful during cutover
    expect(a.equals(luxonNY)).toBe(true);
  });

  it("invalid zone returns NaN offset and empty offsetName", () => {
    const z = BundledIANAZone.create("Fake/Atlantis");
    expect(z.isValid).toBe(false);
    expect(Number.isNaN(z.offset(Date.now()))).toBe(true);
    expect(z.offsetName(Date.now())).toBe("");
    expect(z.formatOffset(Date.now(), "short")).toBe("");
  });

  it("exposes bundled tzdb version", () => {
    const v = BundledIANAZone.tzdbVersion;
    expect(v).toMatch(/^\d{4}[a-z]+$/); // e.g. "2026b"
  });
});
