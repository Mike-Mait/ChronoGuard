import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChronoShieldClient } from "../client.js";

/**
 * validate_local_datetime — the primary preflight tool.
 *
 * Description copy is the single most important piece of text in this whole
 * package: it's what the LLM reads to decide *when* to call the tool. We
 * lead with "BEFORE an agent..." and enumerate trigger actions so the model
 * pattern-matches on intent rather than on the literal word "datetime".
 *
 * Mirrors the canonical schema at /agent-tools.json. Keep them in sync.
 */
export function registerValidateTool(
  server: McpServer,
  client: ChronoShieldClient
) {
  server.tool(
    "validate_local_datetime",
    "Preflight check for a user-entered local datetime. Call this BEFORE an agent schedules a meeting, books an appointment, sets a reminder, creates a cron job, calculates a billing date, converts local time to UTC, or otherwise acts on a local datetime. Returns whether the time is valid, falls in a DST gap (does not exist), or falls in a DST overlap (occurs twice). If the result is not 'valid', do not act silently — ask the user to disambiguate or apply an explicit policy via resolve_datetime.",
    {
      local_datetime: z
        .string()
        .describe(
          "Local datetime in ISO 8601 format without a timezone offset. Example: 2026-03-08T02:30:00. Interpreted in the supplied IANA timezone."
        ),
      time_zone: z
        .string()
        .describe(
          "IANA timezone identifier such as America/New_York, Europe/London, Asia/Tokyo, or Australia/Lord_Howe. Do not pass abbreviations like 'EST' or fixed offsets like 'UTC-5'."
        ),
    },
    async ({ local_datetime, time_zone }) => {
      const result = await client.validate({ local_datetime, time_zone });
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
