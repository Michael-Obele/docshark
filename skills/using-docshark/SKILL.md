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
- `docshark stale [--days <n>]` (alias: `outdated`) — list libraries older than the freshness window
- `docshark rename <current-name> <new-name>`
- `docshark remove <name>`
- `docshark get [url] --library <name> --path <path>`

## Stale-Docs Auto-Prompt

- A library is **stale** after **14 days** without a crawl. Tune with
  `DOCSHARK_STALE_DAYS=<n>`, `docshark stale --days <n>`, or the `--days` flag
  (clamped to 1–365).
- `docshark list` and `docshark stale` on an interactive TTY print every stale
  library with its last crawl date and age, then ask
  `Refresh N stale libraries now? [y/N]`. Answering `y` re-crawls all listed
  libraries sequentially.
- Non-interactive runs (pipes, CI) never prompt: they print the stale list on
  stderr with a hint instead.
- `docshark search` prints a one-line stale reminder (interactive only).
- Skips: `docshark list --no-stale-check`, or `DOCSHARK_DISABLE_STALE_CHECK=1`.
- AI parity: the same signal is exposed over MCP via the Age/⚠️ columns of
  `list_libraries` and `manage_library action=stale`, so an assistant can tell
  the user which docs are outdated and refresh them after agreement.

## Icon Styles

- `DOCSHARK_ICONS=emoji|nerd|plain|none` (default `emoji`) controls CLI icon rendering.
- `nerd` = crisp monochrome glyphs from Nerd Fonts (Material Design Icons set);
  requires a Nerd Font-patched terminal font — otherwise glyphs show as boxes.
- `plain` = common-monospace Unicode (`✓ ✗ ⚠ ↻ …`); `none` = text only (good for logs).
- Unknown values fall back to `emoji`. MCP tool output is always emoji, since AI
  chat clients render those reliably — the env var only affects terminal output.

## Troubleshooting

- Docs seem outdated / answers look wrong:
  1. Run `docshark stale` (or answer the prompt that `docshark list` shows).
  2. Refresh the listed libraries: `docshark refresh <name>`.
  3. Re-run the search.
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
