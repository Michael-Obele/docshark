---
title: "DocShark — Project Structure & Distribution"
status: draft
---

# Project Structure & Distribution

How DocShark is organized as a monorepo, built, and distributed via npm.

← Back to [Plan Index](./index.md)

---

## Monorepo Layout

```
docshark/
├── packages/
│   ├── core/                          ← npm-published package
│   │   ├── src/
│   │   │   ├── cli.ts                 ← CLI entry (#!/usr/bin/env node)
│   │   │   ├── server.ts             ← TMCP McpServer setup
│   │   │   ├── http.ts               ← HTTP server (srvx or Bun.serve)
│   │   │   ├── tools/                ← MCP tool definitions
│   │   │   │   ├── search-docs.ts
│   │   │   │   ├── list-libraries.ts
│   │   │   │   ├── get-doc-page.ts
│   │   │   │   ├── add-library.ts
│   │   │   │   ├── refresh-library.ts
│   │   │   │   └── remove-library.ts
│   │   │   ├── scraper/              ← Website scraping
│   │   │   │   ├── discoverer.ts     ← sitemap + link crawl
│   │   │   │   ├── fetcher.ts        ← HTTP fetch + caching
│   │   │   │   ├── rate-limiter.ts
│   │   │   │   └── robots.ts
│   │   │   ├── processor/            ← Content processing
│   │   │   │   ├── extractor.ts      ← @mozilla/readability
│   │   │   │   ├── converter.ts      ← turndown (HTML→MD)
│   │   │   │   └── chunker.ts        ← heading-based splitter
│   │   │   ├── storage/              ← SQLite layer
│   │   │   │   ├── db.ts             ← init, migrations
│   │   │   │   ├── libraries.ts      ← CRUD
│   │   │   │   ├── pages.ts
│   │   │   │   ├── chunks.ts
│   │   │   │   └── search.ts         ← FTS5 queries
│   │   │   ├── jobs/                 ← Async crawl management
│   │   │   │   ├── manager.ts        ← queue + scheduling
│   │   │   │   ├── worker.ts         ← crawl execution
│   │   │   │   └── events.ts         ← EventBus (SSE)
│   │   │   ├── api/                  ← REST for dashboard
│   │   │   │   ├── router.ts
│   │   │   │   └── routes/
│   │   │   │       ├── libraries.ts
│   │   │   │       ├── search.ts
│   │   │   │       ├── crawls.ts
│   │   │   │       └── settings.ts
│   │   │   └── templates/            ← Pre-configured sources
│   │   │       └── sources.json
│   │   ├── dist/                     ← Build output
│   │   │   ├── cli.js
│   │   │   └── dashboard/            ← Static SvelteKit build
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/                     ← SvelteKit app
│       ├── src/
│       │   ├── lib/
│       │   │   ├── components/        ← Shared UI components
│       │   │   ├── stores/            ← Svelte stores
│       │   │   └── api.ts             ← REST client
│       │   ├── routes/
│       │   │   ├── +layout.svelte     ← Shell with sidebar
│       │   │   ├── +page.svelte       ← Home dashboard
│       │   │   ├── libraries/
│       │   │   │   ├── +page.svelte   ← Library list
│       │   │   │   ├── add/+page.svelte
│       │   │   │   └── [id]/+page.svelte
│       │   │   ├── search/+page.svelte
│       │   │   ├── crawls/+page.svelte
│       │   │   └── settings/+page.svelte
│       │   └── app.html
│       ├── svelte.config.js           ← static adapter
│       ├── package.json
│       └── tailwind.config.js
│
├── package.json                       ← workspace root
├── bun.lockb
├── README.md
├── LICENSE
├── Dockerfile
└── docker-compose.yml
```

## CLI Entry Point

```typescript
#!/usr/bin/env node
// packages/core/src/cli.ts

import { Command } from 'commander';

const program = new Command()
  .name('docshark')
  .description('🦈 Documentation MCP Server with Dashboard')
  .version('1.0.0');

program
  .command('start', { isDefault: true })
  .description('Start the MCP server and dashboard')
  .option('-p, --port <port>', 'Dashboard port', '6380')
  .option('--stdio', 'Run in STDIO mode (for Claude Desktop)')
  .option('--data-dir <path>', 'Data directory', '~/.docshark')
  .action(startServer);

program
  .command('add <url>')
  .description('Add a documentation library')
  .option('-n, --name <name>', 'Library name')
  .option('-d, --depth <depth>', 'Max crawl depth', '3')
  .action(addLibrary);

program
  .command('search <query>')
  .description('Search indexed documentation')
  .option('-l, --library <name>', 'Filter by library')
  .option('--limit <n>', 'Max results', '5')
  .action(searchDocs);

program
  .command('list')
  .description('List indexed libraries')
  .action(listLibraries);

program
  .command('export')
  .description('Export configuration')
  .option('-o, --output <file>', 'Output file', 'docshark-config.json')
  .action(exportConfig);

program
  .command('import <file>')
  .description('Import configuration')
  .action(importConfig);

program.parse();
```

## package.json (core)

```json
{
  "name": "docshark",
  "version": "1.0.0",
  "description": "🦈 Documentation MCP Server with Dashboard",
  "type": "module",
  "bin": {
    "docshark": "./dist/cli.js"
  },
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "tsup src/cli.ts --format esm --dts",
    "build:dashboard": "cd ../dashboard && bun run build && cp -r build/ ../core/dist/dashboard/",
    "build:all": "bun run build:dashboard && bun run build",
    "dev": "tsup src/cli.ts --format esm --watch"
  },
  "keywords": ["mcp", "documentation", "search", "ai", "dashboard"],
  "dependencies": {
    "tmcp": "latest",
    "@tmcp/adapter-valibot": "latest",
    "@tmcp/transport-stdio": "latest",
    "valibot": "latest",
    "better-sqlite3": "latest",
    "cheerio": "latest",
    "@mozilla/readability": "latest",
    "linkedom": "latest",
    "turndown": "latest",
    "commander": "latest",
    "nanoid": "latest",
    "robots-parser": "latest",
    "srvx": "latest"
  },
  "optionalDependencies": {
    "playwright": "latest"
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
