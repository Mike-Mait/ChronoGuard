// ─────────────────────────────────────────────────────────────────────────────
// BundledIANAZone — Luxon Zone backed by an in-process tzdata bundle
//
// WHY THIS EXISTS:
// Luxon's stock IANAZone consults `Intl.DateTimeFormat`, which reads tzdata
// from the host environment's ICU build. On Node, that means tzdata is
// pinned to whatever Node version you ship — to update tzdata, you must
// upgrade Node. That coupling is unacceptable for a product whose value
// proposition is "we have current IANA tzdata."
//
// This adapter swaps out the data source: instead of asking Node's ICU,
// we ask `moment-timezone`'s bundled tzdata (currently 2026b). Updating
// tzdata becomes `npm update moment-timezone` — independent of Node version.
//
// IMPORTANT: We treat moment-timezone PURELY as a tzdata source. We do not
// import or use moment's DateTime API anywhere. The only entry point we
// touch is `moment.tz.zone(name)`, which returns a lightweight zone-data
// object with `utcOffset(ts)` and `abbr(ts)` lookups. Everything else
// continues to use Luxon.
//
// CONVENTION GOTCHA:
// - Luxon's `Zone#offset(ts)` returns minutes EAST of UTC (NY winter = -300)
// - moment-timezone's `utcOffset(ts)` returns minutes WEST of UTC (NY winter = +300)
// We negate at the boundary. Verified against Kathmandu (+5:45), Lord Howe
// (30-min DST shift), and standard US/EU zones during testing.
// ─────────────────────────────────────────────────────────────────────────────

import { Zone, type ZoneOffsetFormat, type ZoneOffsetOptions } from "luxon";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moment = require("moment-timezone");

// moment-timezone's internal MomentZone shape — not exported in their public
// types, so we describe just the surface we use.
interface MomentZone {
  name: string;
  /** Offset in minutes WEST of UTC at the given epoch ms. Negate for Luxon. */
  utcOffset(ts: number): number;
  /** Time zone abbreviation (e.g. "EST", "EDT", "+0545") at the given epoch ms. */
  abbr(ts: number): string;
}

// Cache mirrors Luxon's IANAZone caching behavior — each zone is a singleton.
const zoneCache = new Map<string, BundledIANAZone>();

export class BundledIANAZone extends Zone {
  private readonly zoneName: string;
  private readonly momentZone: MomentZone | null;

  constructor(name: string) {
    super();
    this.zoneName = name;
    this.momentZone = moment.tz.zone(name) as MomentZone | null;
  }

  /**
   * Cached factory. Use this in preference to `new BundledIANAZone(name)`
   * to match Luxon's IANAZone.create() semantics.
   */
  static create(name: string): BundledIANAZone {
    let zone = zoneCache.get(name);
    if (zone === undefined) {
      zone = new BundledIANAZone(name);
      zoneCache.set(name, zone);
    }
    return zone;
  }

  /**
   * Drop the singleton cache. Test-only — has no purpose at runtime since
   * zone data is immutable for the lifetime of the process.
   */
  static resetCache(): void {
    zoneCache.clear();
  }

  /**
   * Returns true iff `name` identifies a real IANA zone known to the
   * bundled tzdata. Replaces `IANAZone.isValidZone(name)`.
   */
  static isValidZone(name: string): boolean {
    if (!name || typeof name !== "string") return false;
    return moment.tz.zone(name) !== null;
  }

  /**
   * Version of the bundled IANA tzdata (e.g. "2026b"). Surfaced via
   * `/v1/datetime/version` so customers can verify what they're hitting.
   */
  static get tzdbVersion(): string {
    return (moment.tz.dataVersion as string | undefined) ?? "unknown";
  }

  // ─── Zone interface implementation ────────────────────────────────────────

  get type(): string {
    return "iana";
  }

  get name(): string {
    return this.zoneName;
  }

  get isUniversal(): boolean {
    // IANA zones have offsets that vary over time (DST, historical changes).
    return false;
  }

  get isValid(): boolean {
    return this.momentZone !== null;
  }

  /**
   * Offset in minutes EAST of UTC at the given epoch ms.
   * Returns NaN for invalid zones, matching Luxon's IANAZone contract.
   *
   * NOTE: We round to integer minutes. moment-timezone's data preserves
   * sub-minute precision for pre-standardization LMT (Local Mean Time)
   * offsets — e.g., America/Cancun before 1922 was -05:47:04, which moment
   * stores as 347.0666... minutes. Luxon's Intl-backed IANAZone rounds these
   * to whole minutes, so we match that to remain a drop-in. No modern zone
   * uses sub-minute offsets, so this affects only pre-~1930 timestamps,
   * which are not reachable by realistic API traffic.
   */
  offset(ts: number): number {
    if (this.momentZone === null) return NaN;
    // moment returns WEST-positive; Luxon expects EAST-positive. Negate, then round.
    return Math.round(-this.momentZone.utcOffset(ts));
  }

  /**
   * Short name like "EST" / "EDT". moment-timezone's `abbr()` only returns
   * the abbreviation form; `format` and `locale` are accepted for Luxon
   * interface compatibility but ignored. (Luxon's IANAZone resolves these
   * via Intl, which is exactly the coupling we're removing.)
   */
  offsetName(ts: number, _opts?: ZoneOffsetOptions): string {
    if (this.momentZone === null) return "";
    return this.momentZone.abbr(ts);
  }

  /**
   * Format the offset as a string in the requested style:
   *   "narrow"  → "+5" or "+5:45" (drops minutes when zero)
   *   "short"   → "+05:00" / "+05:45"  (default)
   *   "techie"  → "+0500"  / "+0545"
   */
  formatOffset(ts: number, format: ZoneOffsetFormat): string {
    return formatOffsetMinutes(this.offset(ts), format);
  }

  equals(other: Zone): boolean {
    // Two BundledIANAZones are equal iff they wrap the same IANA name.
    // We deliberately also accept Luxon's stock IANAZone for the same name —
    // useful during the cutover period when both might be in flight.
    return (
      (other as Zone).type === "iana" && (other as Zone).name === this.zoneName
    );
  }
}

// ─── Helpers (self-contained — do not depend on Luxon internals) ─────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatOffsetMinutes(
  offsetMinutes: number,
  format: ZoneOffsetFormat,
): string {
  if (Number.isNaN(offsetMinutes)) return "";
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  switch (format) {
    case "narrow":
      return m === 0 ? `${sign}${h}` : `${sign}${h}:${pad2(m)}`;
    case "techie":
      return `${sign}${pad2(h)}${pad2(m)}`;
    case "short":
    default:
      return `${sign}${pad2(h)}:${pad2(m)}`;
  }
}
