// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/datetime/version
//
// Public, unauthenticated endpoint exposing which IANA tzdata version is
// currently powering the API. Surfaced so customers can:
//
//   1. Verify which tzdb release their query results are computed against
//   2. Cross-check whether their integration is hitting an updated server
//      after a tzdb bump (cache invalidation, etc.)
//   3. Reproduce a result historically by knowing the data version
//
// This endpoint reads from BundledIANAZone.tzdbVersion (which proxies
// moment-timezone's data file). After the tzdb-decouple cutover, this
// value updates with `npm update moment-timezone` — independent of the
// Node.js runtime version.
// ─────────────────────────────────────────────────────────────────────────────

import { FastifyInstance } from "fastify";
import { BundledIANAZone } from "../utils/bundledZone";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const momentPkg = require("moment-timezone/package.json");

export async function versionRoute(app: FastifyInstance) {
  app.get(
    "/v1/datetime/version",
    {
      schema: {
        description:
          "Returns the IANA tzdata version currently powering the API, plus the underlying npm package version that ships it. Useful for verifying which tzdb release your query results are computed against.",
        tags: ["datetime"],
        response: {
          200: {
            type: "object",
            properties: {
              tzdb_version: {
                type: "string",
                description:
                  "IANA tzdata release version (e.g., '2026b'). Updated quarterly.",
              },
              tzdb_source: {
                type: "string",
                description:
                  "The npm package providing the bundled tzdata. Currently 'moment-timezone'.",
              },
              tzdb_source_version: {
                type: "string",
                description:
                  "Version of the npm package providing the tzdata (e.g., '0.6.2').",
              },
              api_version: {
                type: "string",
                description: "ChronoShield API version.",
              },
            },
          },
        },
      },
    },
    async () => ({
      tzdb_version: BundledIANAZone.tzdbVersion,
      tzdb_source: "moment-timezone",
      tzdb_source_version: momentPkg.version as string,
      api_version: "1.3.0",
    }),
  );
}
