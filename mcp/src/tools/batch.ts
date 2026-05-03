import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChronoShieldClient, BatchItem } from "../client.js";

/**
 * batch_datetime_operations — runs up to 100 operations per request.
 *
 * The schema uses a discriminated union via z.discriminatedUnion so the LLM
 * sees clearly which fields belong to each operation. This matters more
 * for batch than for individual tools because the model has to construct
 * the array correctly without further prompting.
 */
export function registerBatchTool(
  server: McpServer,
  client: ChronoShieldClient
) {
  const validateItem = z.object({
    operation: z.literal("validate"),
    local_datetime: z.string().describe("ISO 8601 local datetime, e.g. 2026-03-08T02:30:00"),
    time_zone: z.string().describe("IANA timezone identifier"),
  });

  const resolveItem = z.object({
    operation: z.literal("resolve"),
    local_datetime: z.string().describe("ISO 8601 local datetime"),
    time_zone: z.string().describe("IANA timezone identifier"),
    resolution_policy: z
      .object({
        ambiguous: z.enum(["earlier", "later", "reject"]).optional(),
        invalid: z
          .enum(["next_valid_time", "previous_valid_time", "reject"])
          .optional(),
      })
      .optional()
      .describe("Optional DST policy for ambiguous and invalid inputs."),
  });

  const convertItem = z.object({
    operation: z.literal("convert"),
    instant_utc: z.string().describe("ISO 8601 UTC datetime ending with Z"),
    target_time_zone: z.string().describe("IANA timezone identifier"),
  });

  const itemSchema = z.discriminatedUnion("operation", [
    validateItem,
    resolveItem,
    convertItem,
  ]);

  server.tool(
    "batch_datetime_operations",
    "Run up to 100 validate, resolve, and convert operations in a single request. Use this BEFORE an agent saves a generated schedule, imports a calendar, books a series of appointments, or processes a list of user-supplied datetimes — calling the API once per item is wasteful and slow. Each item gets its own success/error result; partial failures don't fail the whole batch.",
    {
      items: z
        .array(itemSchema)
        .min(1)
        .max(100)
        .describe(
          "Array of operations (1–100). Each item must include 'operation' (validate/resolve/convert) and the relevant fields for that operation."
        ),
    },
    async ({ items }) => {
      const result = await client.batch({ items: items as BatchItem[] });
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
