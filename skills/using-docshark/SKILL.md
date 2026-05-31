---
name: using-docshark
description: Use when installing, running, and troubleshooting DocShark as an MCP server, or when configuring clients to connect through STDIO or HTTP MCP endpoints.
---

# Operating DocShark

## Overview

This skill covers accurate runtime setup and troubleshooting for the current DocShark codebase.

## Start Modes

### STDIO mode (for MCP clients)

```bash
docshark --stdio
```

or

```bash
npx docshark --stdio
```

Use this when a client launches DocShark as a subprocess MCP server.

### HTTP mode

```bash
docshark
```

Default HTTP port is `6380` unless `--port` is provided.

When running in HTTP mode, key endpoints are:

- `/mcp`
- `/sse`
- `/api`
- `/api/health`

## Data Directory

- Default data directory: `~/.docshark`
- Override with:
  - CLI: `--data-dir <path>`
  - Env: `DOCSHARK_DATA_DIR`

## Reliable CLI Operations

- `docshark add <url>`
- `docshark list`
- `docshark search <query>`
- `docshark refresh <name>`
- `docshark rename <current-name> <new-name>`
- `docshark remove <name>`
- `docshark get [url] --library <name> --path <path>`

## Troubleshooting

- No search results:
  1. Run `docshark list` to verify library exists.
  2. Run `docshark refresh <library>` for stale index.
  3. Re-run search with a more explicit natural-language query.
- Client cannot connect in STDIO mode:
  1. Verify client command uses `docshark --stdio` (or `npx docshark --stdio`).
  2. Check that `docshark` is on PATH if not using `npx`.
- HTTP mode not reachable:
  1. Verify process is running.
  2. Check `/api/health`.
  3. Confirm selected `--port` is not occupied.
