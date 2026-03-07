# 🦈 DocShark MCP Setup Guide

DocShark is now available on npm and can be used as an MCP server across various AI clients.

## Quick Installation

```bash
# Global install (optional)
npm install -g docshark
# or run on the fly
bunx docshark [command]
```

## IDE & Desktop Integrations

### 1. Claude Desktop (Standard configuration)
Edit your `claude_desktop_config.json`:
- **macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docshark": {
      "command": "bunx",
      "args": ["-y", "docshark", "start", "--stdio"]
    }
  }
}
```

### 2. Cursor (Internal MCP client)
- Go to `Settings > Models > MCP`.
- Add a command-based server:
  - Name: `docshark`
  - Command: `bunx -y docshark start --stdio`

### 3. VS Code (Copilot / Desktop Extension)
Open your workspace settings (or `.vscode/settings.json`):

```json
{
  "mcpServers": {
    "docshark": {
      "command": "bunx",
      "args": ["-y", "docshark", "start", "--stdio"]
    }
  }
}
```

---

## Workspace Tools (The "DocShark" Stack)

| Tool Name | Action | Parameters |
|-----------|--------|------------|
| `add_library` | Index a doc | `url`, `name`, `maxDepth` |
| `search_docs` | Query docs | `query`, `libraryName`, `limit` |
| `list_libraries` | See synced dbs | - |
| `get_doc_page` | Read file | `library`, `path` |
| `refresh_library`| Update index | `name` |
| `remove_library` | Delete index | `name` |

## Local Development Workflow
If you're testing changes locally (instead of using the npm package):

```bash
# In the docshark repo:
bun run src/cli.ts add https://svelte.dev/docs/svelte/overview
bun run src/cli.ts search "runes"
```
