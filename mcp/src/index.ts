#!/usr/bin/env node
/**
 * ChronoShield MCP Server
 *
 * Exposes ChronoShield's datetime tools to MCP-compatible clients
 * (Claude Desktop, Cursor, Windsurf, custom MCP hosts).
 *
 * Transport: stdio. The MCP host launches this process via `npx`, sends
 * JSON-RPC over stdin, reads responses from stdout. Anything written to
 * stdout that is NOT a valid JSON-RPC frame breaks the protocol — that's
 * why every diagnostic in this file goes to stderr (console.error).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ChronoShieldClient } from "./client.js";
import { registerValidateTool } from "./tools/validate.js";
import { registerResolveTool } from "./tools/resolve.js";
import { registerConvertTool } from "./tools/convert.js";
import { registerBatchTool } from "./tools/batch.js";

async function main() {
  const apiKey = process.env.CHRONOSHIELD_API_KEY;
  if (!apiKey) {
    console.error(
      "[chronoshield-mcp] FATAL: CHRONOSHIELD_API_KEY environment variable is required.\n" +
        "Get a free key at https://chronoshieldapi.com and pass it in your MCP client config:\n\n" +
        '  "env": { "CHRONOSHIELD_API_KEY": "your_key_here" }\n'
    );
    process.exit(1);
  }

  const baseUrl =
    process.env.CHRONOSHIELD_BASE_URL ?? "https://chronoshieldapi.com";

  const client = new ChronoShieldClient({ apiKey, baseUrl });

  const server = new McpServer({
    name: "chronoshield",
    version: "1.0.0",
  });

  registerValidateTool(server, client);
  registerResolveTool(server, client);
  registerConvertTool(server, client);
  registerBatchTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr is safe — stdout is reserved for the JSON-RPC stream.
  console.error(
    "[chronoshield-mcp] Connected. Tools registered: validate_local_datetime, resolve_datetime, convert_datetime, batch_datetime_operations."
  );
}

main().catch((err) => {
  console.error("[chronoshield-mcp] Startup failed:", err);
  process.exit(1);
});
