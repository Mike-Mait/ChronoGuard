# ChronoShield MCP Server

**Preflight datetime validation for AI agents — as native MCP tools.**

This is the [Model Context Protocol](https://modelcontextprotocol.io) server for [ChronoShield API](https://chronoshieldapi.com). Install it once and Claude Desktop, Cursor, Windsurf, or any other MCP-compatible client can call ChronoShield's datetime tools natively — no integration code, no custom function definitions.

Use it before agents:

- create calendar events from natural-language input
- schedule reminders, alarms, or notifications
- book appointments, tables, or pickups
- set up cron jobs or recurring schedules
- calculate billing or subscription cycles in local civil time
- convert user-entered local time to UTC
- trigger any time-based workflow automation

If a user-entered local time falls in a DST gap (doesn't exist), occurs twice (DST overlap), or uses an invalid IANA timezone, the agent gets a structured error code instead of silently storing the wrong moment.

---

## Install

```bash
npm install -g @chronoshield/mcp
```

Or run on demand without a global install:

```bash
npx -y @chronoshield/mcp
```

You'll need a free ChronoShield API key — get one at [chronoshieldapi.com](https://chronoshieldapi.com).

---

## Claude Desktop

Open **Settings → Developer → Edit Config** (or edit `claude_desktop_config.json` directly):

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add:

```json
{
  "mcpServers": {
    "chronoshield": {
      "command": "npx",
      "args": ["-y", "@chronoshield/mcp"],
      "env": {
        "CHRONOSHIELD_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. The four ChronoShield tools should appear in the tool picker. Try:

> *"Schedule a reminder for 2:30 AM on March 8, 2026 in New York."*

Claude should call `validate_local_datetime`, see `DST_GAP`, and ask you whether to use 3:00 AM instead.

---

## Cursor / Windsurf / other MCP clients

Same shape as Claude Desktop. Drop the snippet above into your client's MCP config file. See `examples/` for ready-to-paste configs.

---

## Tools

| Tool | Purpose |
|---|---|
| `validate_local_datetime` | Preflight check — does this local time exist, is it ambiguous, or is the timezone invalid? |
| `resolve_datetime` | Resolve a local datetime to a UTC instant using an explicit DST policy |
| `convert_datetime` | Convert a UTC instant to local time in a target IANA timezone |
| `batch_datetime_operations` | Run up to 100 of the above operations in one request |

Full schemas: [`/agent-tools.json`](https://chronoshieldapi.com/agent-tools.json)
Full agent guide: [chronoshieldapi.com/docs/ai-agents](https://chronoshieldapi.com/docs/ai-agents)

---

## Recommended agent behavior

After calling `validate_local_datetime`:

| Result | Agent should |
|---|---|
| `status: "valid"` | Proceed |
| `reason_code: "DST_GAP"` | **Don't schedule silently.** Ask the user for an alternate time, or apply an explicit policy via `resolve_datetime` (`invalid_policy`) |
| `reason_code: "DST_OVERLAP"` | Ask which occurrence the user means, or resolve via `resolve_datetime` (`ambiguous_policy`) |
| `reason_code: "INVALID_TIMEZONE"` | Ask the user for a valid IANA timezone (e.g., `America/New_York`, not `EST`) |

---

## Configuration

| Env var | Required | Default | Description |
|---|---|---|---|
| `CHRONOSHIELD_API_KEY` | Yes | — | Your ChronoShield API key. Get one at [chronoshieldapi.com](https://chronoshieldapi.com). |
| `CHRONOSHIELD_BASE_URL` | No | `https://chronoshieldapi.com` | Override for self-hosted deployments. |

---

## Security

- The API key is read **only** from environment variables. It is never written to logs, stdout, or error messages.
- Errors surfaced to the MCP client include HTTP status codes and ChronoShield error messages, but never request headers or the API key.
- All traffic to chronoshieldapi.com is over HTTPS.

If you discover a security issue, please email [security@chronoshieldapi.com](mailto:security@chronoshieldapi.com) rather than opening a public issue.

---

## Development

```bash
git clone https://github.com/Mike-Mait/ChronoShield-API.git
cd ChronoShield-API/mcp
npm install
npm run build
CHRONOSHIELD_API_KEY=your_key node dist/index.js
```

The server speaks JSON-RPC over stdio. To smoke-test it manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | CHRONOSHIELD_API_KEY=your_key node dist/index.js
```

---

## Links

- [ChronoShield API](https://chronoshieldapi.com)
- [AI agent docs](https://chronoshieldapi.com/docs/ai-agents)
- [REST API docs](https://chronoshieldapi.com/docs)
- [GitHub](https://github.com/Mike-Mait/ChronoShield-API)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

## License

ISC
