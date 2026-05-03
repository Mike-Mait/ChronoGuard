import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChronoShieldClient } from "../client.js";

/**
 * resolve_datetime — call this once the agent has decided how to handle
 * edge cases (or after the user has disambiguated). Returns a single UTC
 * instant. The two policy fields are flat at the tool level (not nested
 * under `resolution_policy`) because flat parameters generally serialize
 * more reliably across LLM tool-call formats. We map them to the API's
 * nested shape inside the handler.
 */
export function registerResolveTool(
  server: McpServer,
  client: ChronoShieldClient
) {
  server.tool(
    "resolve_datetime",
    "Resolve a local datetime to a definitive UTC instant using an explicit policy for ambiguous (DST overlap) and invalid (DST gap) inputs. Call this when an agent has confirmed how to handle edge cases and needs the exact UTC timestamp to store, schedule, or transmit. For unknown user input, call validate_local_datetime first and ask the user to disambiguate before resolving.",
    {
      local_datetime: z
        .string()
        .describe(
          "Local datetime in ISO 8601 format without a timezone offset. Example: 2026-11-01T01:30:00."
        ),
      time_zone: z
        .string()
        .describe("IANA timezone identifier such as America/New_York."),
      ambiguous_policy: z
        .enum(["earlier", "later", "reject"])
        .optional()
        .describe(
          "How to resolve a DST overlap (time occurs twice). 'earlier' picks the first occurrence (before fall-back), 'later' picks the second, 'reject' returns an error so the agent can ask the user. Default: earlier."
        ),
      invalid_policy: z
        .enum(["next_valid_time", "previous_valid_time", "reject"])
        .optional()
        .describe(
          "How to resolve a DST gap (time does not exist). 'next_valid_time' jumps to the first valid time after the gap, 'previous_valid_time' jumps back, 'reject' returns an error. Default: next_valid_time."
        ),
    },
    async ({ local_datetime, time_zone, ambiguous_policy, invalid_policy }) => {
      const resolution_policy =
        ambiguous_policy || invalid_policy
          ? {
              ...(ambiguous_policy && { ambiguous: ambiguous_policy }),
              ...(invalid_policy && { invalid: invalid_policy }),
            }
          : undefined;

      const result = await client.resolve({
        local_datetime,
        time_zone,
        resolution_policy,
      });

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
