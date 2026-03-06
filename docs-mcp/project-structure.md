---
title: "DocShark — Project Structure & Distribution"
status: draft
---

# Project Structure & Distribution

How DocShark is organized, built, and distributed via npm.

← Back to [Plan Index](./index.md)

---

## Architecture Options

DocShark is currently distributed as a standalone package (Option 1), but is designed to transition into a monorepo (Option 2) as the dashboard and core library grow more complex.

---

## Option 1: Current Flat Structure (Standalone Package)

This is the current state of the repository as of [![GitHub Release](https://img.shields.io/github/v/release/Michael-Obele/docshark?color=success)](https://github.com/Michael-Obele/docshark/releases)

### Layout

```
docshark/
├── src/
│   ├── index.ts               ← Library entry point
│   ├── cli.ts                 ← CLI entry (#!/usr/bin/env node)
│   ├── server.ts             ← TMCP McpServer setup
│   ├── http.ts               ← HTTP server (srvx or Bun.serve)
│   ├── tools/                ← MCP tool definitions
│   │   ├── search-docs.ts
│   │   ├── list-libraries.ts
│   │   ├── get-doc-page.ts
│   │   ├── add-library.ts
│   │   ├── refresh-library.ts
│   │   └── remove-library.ts
│   ├── scraper/              ← Website scraping
│   │   ├── discoverer.ts     ← sitemap + link crawl
│   │   ├── fetcher.ts        ← HTTP fetch + caching
│   │   ├── rate-limiter.ts
│   │   └── robots.ts
│   ├── processor/            ← Content processing
│   │   ├── extractor.ts      ← @mozilla/readability
│   │   ├── chunker.ts        ← heading-based splitter
│   ├── storage/              ← SQLite layer
│   │   ├── db.ts             ← init, migrations
│   │   └── search.ts         ← FTS5 queries
│   ├── jobs/                 ← Async crawl management
│   │   ├── manager.ts        ← queue + scheduling
│   │   ├── worker.ts         ← crawl execution
│   │   └── events.ts         ← EventBus (SSE)
│   ├── api/                  ← REST for dashboard
│   │   └── router.ts
│   ├── version.ts            ← Version info
│   └── types.ts              ← Shared types
├── dist/                     ← Build output (npm component)
│   ├── index.js              ← Bundled library
│   ├── cli.js                ← Bundled CLI binary
│   └── **/*.d.ts             ← TypeScript declarations
├── package.json
└── tsconfig.json
```

---

## Option 2: Future Monorepo Architecture

This plan represents the intended growth path to cleanly separate the core logic from the management dashboard.

### Monorepo Layout

```
docshark/
├── packages/
│   ├── core/                          ← core library & tools
│   │   ├── src/
│   │   ├── dist/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/                     ← SvelteKit management app
│       ├── src/
│       ├── svelte.config.js
│       ├── package.json
│       └── tailwind.config.js
│
├── package.json                       ← monorepo root
├── bun.lockb
├── README.md
├── LICENSE
├── Dockerfile
└── docker-compose.yml
```

### Future Build Pipeline

```
1. bun run build:dashboard    → SvelteKit static build
2. Copy build/ → core/dist/dashboard/
3. bun run build              → Bundles core TS
4. npm publish                → Publishes @docshark/core
```

---

## CLI Entry Point

The CLI entry is `src/cli.ts` which is bundled into `dist/cli.js` for npm distribution. It includes a `#!/usr/bin/env node` shebang.

```typescript
#!/usr/bin/env node
// src/cli.ts — DocShark CLI entry point
import { Command } from "commander";
import { startHttpServer } from "./http.js";
import { VERSION } from "./version.js";

const program = new Command()
  .name("docshark")
  .description(
    "🦈 Documentation MCP Server — scrape, index, and search any doc website",
  )
  .version(VERSION);

program
  .command("start", { isDefault: true })
  .description("Start the MCP server")
  .option("-p, --port <port>", "HTTP server port", "6380")
  .option("--stdio", "Run in STDIO mode (for Claude Desktop, Cursor, etc.)")
  .option("--data-dir <path>", "Data directory", "")
  .action(async (opts) => {
    // ... action logic
  });

program.parse();
```

## package.json (Standalone)

```json
{
  "name": "docshark",
  "version": "0.1.5",
  "description": "🦈 Documentation MCP Server — scrape, index, and search any doc website",
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "docshark": "./dist/cli.js"
  },
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  "scripts": {
    "build": "rm -rf dist && bun build ./src/cli.ts ./src/index.ts --outdir ./dist --target node --external '*' && tsc --emitDeclarationOnly",
    "prepublishOnly": "bun run build"
  }
}
```

## MCP Client Configuration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "docshark": {
      "command": "npx",
      "args": ["-y", "docshark", "--stdio"]
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "docshark": {
      "command": "npx",
      "args": ["-y", "docshark", "--stdio"]
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "docshark": {
      "serverUrl": "http://localhost:6380/mcp"
    }
  }
}
```

## Build Pipeline

```
1. bun run build:dashboard    → SvelteKit static build
2. Copy build/ → core/dist/dashboard/
3. bun run build              → tsup bundles core TS
4. npm publish                → publishes core/ package
```

## Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY packages/core/dist ./dist
COPY packages/core/package.json .
RUN bun install --production
EXPOSE 6380
CMD ["bun", "dist/cli.js", "start", "--port", "6380"]
```

← Back to [Plan Index](./index.md)
