---
name: using-docshark
description: Use when installing, running, and troubleshooting DocShark as an MCP server, including client setup for STDIO mode and endpoint checks for HTTP mode.
---

# Operating DocShark

## Start Modes

### STDIO mode (MCP clients)

```bash
docshark --stdio
```

or

```bash
npx docshark --stdio
```

Use STDIO when a client launches DocShark as a subprocess MCP server.

### HTTP mode

```bash
docshark
```

Default HTTP port is `6380` (override with `--port`).

HTTP endpoints:

- `/mcp`
- `/sse`
- `/api`
- `/api/health`

## Data Directory

- Default data directory: `~/.docshark`
- Override with:
  - CLI: `--data-dir <path>`
  - Env: `DOCSHARK_DATA_DIR`

## Core CLI Operations

- `docshark add <url>`
- `docshark list`
- `docshark search <query>`
- `docshark refresh <name>`
- `docshark rename <current-name> <new-name>`
- `docshark remove <name>`
- `docshark get [url] --library <name> --path <path>`

## Troubleshooting

- No search results:
  1. Verify with `docshark list`.
  2. Refresh with `docshark refresh <library>`.
  3. Re-run with a clearer natural-language query.
- Client cannot connect in STDIO mode:
  1. Verify startup command is `docshark --stdio` or `npx docshark --stdio`.
  2. Ensure `docshark` is on PATH if not using `npx`.
- HTTP mode not reachable:
  1. Confirm process is running.
  2. Check `/api/health`.
  3. Confirm chosen `--port` is available.
