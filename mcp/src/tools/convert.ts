import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChronoShieldClient } from "../client.js";

/**
 * convert_datetime — UTC → local. The "do NOT" sentence in the description
 * is deliberate: prior tool descriptions for similar utilities have caused
 * models to use them on user input (which is the wrong direction), leading
 * to silent misinterpretation. Surfacing the antipattern in the description
 * itself is the cheapest fix.
 */
export function registerConvertTool(
  server: McpServer,
  client: ChronoShieldClient
) {
  server.tool(
    "convert_datetime",
    "Convert a UTC instant to a local datetime in a target IANA timezone. Use this when displaying a stored UTC timestamp to a user in their region or formatting a time for a destination timezone. This is unambiguous — a UTC instant maps to exactly one local time. Do NOT use this to interpret user-entered local time; use validate_local_datetime or resolve_datetime for that.",
    {
      instant_utc: z
        .string()
        .describe(
          "ISO 8601 UTC datetime ending with Z. Example: 2026-06-15T15:00:00Z."
        ),
      target_time_zone: z
        .string()
        .describe(
          "IANA timezone identifier to convert into, such as Europe/London."
        ),
    },
    async ({ instant_utc, target_time_zone }) => {
      const result = await client.convert({ instant_utc, target_time_zone });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
