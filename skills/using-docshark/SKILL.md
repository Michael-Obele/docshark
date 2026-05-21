---
name: using-docshark
description: "Set up, configure, and integrate DocShark MCP server into your development workflow. Use this skill when users want to install DocShark, configure documentation sources, set up the dashboard, integrate with MCP clients (Claude Desktop, VS Code), manage libraries, or troubleshoot crawling and search issues."
allowed-tools: "RunCommand, Read, Write, SearchReplace"
---

# Using DocShark

## Overview

DocShark is a fast, local-first MCP (Model Context Protocol) server that scrapes and indexes documentation websites. This skill helps you set up DocShark, connect it to your AI tools, and manage your documentation sources.

## When To Use This Skill

- Installing and running DocShark locally via `npx docshark`
- Adding documentation sources and libraries to index
- Configuring DocShark with your MCP client (Claude Desktop, VS Code, Cursor)
- Using the SvelteKit dashboard to manage crawls and search
- Troubleshooting crawling issues (rate limiting, JS-rendered sites, robots.txt)
- Optimizing search results and FTS5 indexing
- Automating documentation refresh and incremental crawling

## Quick Start

### Installation

```bash
npx docshark
```

This starts the MCP server on `http://localhost:6380`.

### Core Workflow

1. **List available libraries**
   - Check what documentation is already indexed
   - Get library metadata (URL, page count, last updated)

2. **Add a new library**
   - Provide a library name and documentation URL
   - DocShark discovers pages via `sitemap.xml` or BFS crawling
   - Automatic extraction, chunking, and FTS5 indexing

3. **Search indexed docs**
   - Natural-language queries against all indexed libraries
   - BM25 ranking with snippet context

4. **Manage libraries**
   - Refresh stale docs
   - Rename libraries
   - Remove unused sources

## Configuration

### Environment Variables

```bash
# Crawler behavior
DOCSHARK_RATE_LIMIT=1000        # ms between requests
DOCSHARK_MAX_DEPTH=3             # max crawl depth
DOCSHARK_TIMEOUT=30000           # fetch timeout in ms
DOCSHARK_PUPPETEER_POOL_SIZE=2   # concurrent browser instances

# Server
DOCSHARK_PORT=6380               # server port
DOCSHARK_DATA_DIR=~/.docshark    # database and cache location
```

### Adding Documentation Sources

Optimal documentation URLs to index:

- **Documentation sites**: `/docs`, `/guide`, `/docs/getting-started`
- **API references**: `/api`, `/reference`, `/docs/api`
- **Framework docs**: Svelte, React, Vue, SvelteKit, Next.js official docs
- **Library docs**: Tailwind, shadcn-ui, Zod, Drizzle, TypeORM

Avoid:

- Blog/blog posts (noise, unstructured)
- GitHub source code (use repository search instead)
- Release notes without stable documentation

## Integration with MCP Clients

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docshark": {
      "command": "npx",
      "args": ["docshark", "--stdio"]
    }
  }
}
```

Restart Claude Desktop and use the Tools menu to access DocShark.

### VS Code with Copilot

Add to `.vscode/settings.json`:

```json
{
  "copilot.mcp.server": "docshark",
  "copilot.mcp.args": ["--stdio"]
}
```

### Cursor

Similar to Claude Desktop. Add to `~/Library/Application Support/Cursor/cursor_desktop_config.json` (macOS) or equivalent config location.

## Common Tasks

### Search Documentation Naturally

Query in developer language, not keywords:

✅ **Good**: "How do I redirect after a SvelteKit form action?"
❌ **Bad**: "sveltekit form action redirect"

### Handle JS-Rendered Sites

If a site is a React/Vue SPA:

- DocShark automatically detects empty HTML shells
- Falls back to `puppeteer-core` for rendering
- Requires optional installation: `npm install puppeteer-core`
- Zero config — automatic detection

### Optimize for Large Sites

For documentation with 1000+ pages:

```bash
# Adjust rate limit to be more polite
DOCSHARK_RATE_LIMIT=2000

# Set crawl depth (prevents endless crawling)
DOCSHARK_MAX_DEPTH=4

# Use parallel puppeteer instances
DOCSHARK_PUPPETEER_POOL_SIZE=3
```

### Incremental Crawling (Planned)

Coming in Phase 2: Smart refresh using ETag and Last-Modified headers to only re-crawl changed pages.

## Troubleshooting

### Crawler stuck or slow

- Check `robots.txt` compliance (DocShark respects robots.txt)
- Increase `DOCSHARK_RATE_LIMIT` to be less aggressive
- Monitor dashboard for blocked requests

### Search returns no results

1. Verify library is indexed: `npx docshark list`
2. Check crawl completion: view dashboard at `http://localhost:6380`
3. Refresh library: `npx docshark refresh <library-name>`
4. Confirm content exists on the source site

### JavaScript content not rendering

- Ensure `puppeteer-core` is installed (optional dependency)
- Check browser logs in dashboard
- Verify site doesn't require authentication

### Memory usage high

- Reduce `DOCSHARK_PUPPETEER_POOL_SIZE` to 1
- Reduce `DOCSHARK_MAX_DEPTH`
- Remove large libraries you don't actively use

## Architecture Highlights

- **SQLite + FTS5**: Local, zero-dependency full-text search
- **Semantic Chunking**: Content split by headings (500-1200 tokens per chunk)
- **BM25 Ranking**: Relevance-based search results
- **Polite Crawling**: Respects rate limits and robots.txt
- **JS Support**: Automatic Puppeteer fallback for React/Vue sites
- **No Cloud**: All processing happens locally; no data sent externally

## Next Steps

1. Run `npx docshark` to start the server
2. Visit `http://localhost:6380/dashboard` (coming in Phase 2)
3. Add your first library via CLI or MCP tools
4. Start searching your indexed docs!

## References

- [DocShark GitHub](https://github.com/Michael-Obele/docshark)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Readability.js](https://github.com/mozilla/readability)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
