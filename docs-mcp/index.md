---
title: "DocShark — Website Documentation MCP with Dashboard"
status: draft
owner: "@Michael-Obele"
tags: [mcp, documentation, tmcp, typescript, svelte, developer-tools, npm]
estimated_time: "4-6 weeks"
prototype: false
---

# DocShark — Website Documentation MCP with Dashboard

An npm-installable MCP server that scrapes, indexes, and serves documentation **from websites** — not from GitHub repos like Context7. Ships with a built-in SvelteKit dashboard for managing doc sources, monitoring crawls, and testing searches. Run `npx docshark` and you're live.

Inspired by [arabold/docs-mcp-server](https://github.com/arabold/docs-mcp-server) (Grounded Docs), but lighter, more modern, and tailored for offline-first, local use.

## Problem / Opportunity

AI coding assistants hallucinate documentation. Existing solutions all have gaps:

| Solution                    | What it does                                   | Gap                                                           |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| **Context7**                | Pulls docs from GitHub repos                   | Gets source code, not rendered docs sites. Closed-source.     |
| **docs-mcp-server**         | Scrapes websites, indexes locally              | Heavy deps (Playwright, LangChain, Node 22+). HTMX dashboard. |
| **Our single-library MCPs** | Serve one library each (Drizzle, Mastra, etc.) | One MCP per library doesn't scale.                            |

We need a **single, general-purpose MCP** that fetches docs from any website, stores them locally with zero-config search, and includes a management dashboard — all in one npm package.

## Name: DocShark 🦈

| Candidate    | `npx` Command  | Vibe                                         | Verdict                |
| ------------ | -------------- | -------------------------------------------- | ---------------------- |
| **docshark** | `npx docshark` | Aggressive, thorough crawling. Strong brand. | ✅ **Top pick**        |
| docfetch     | `npx docfetch` | Direct, obvious                              | Good backup            |
| webdocs      | `npx webdocs`  | Clean, descriptive                           | Too generic            |
| docsink      | `npx docsink`  | Docs "sink" into your index                  | "Sink" sounds negative |

**DocShark** — A shark that hunts through documentation. Memorable, brandable, unique on npm.

## Framework Decision: TMCP ✅

Full analysis in [framework-comparison.md](./framework-comparison.md). Summary: TMCP is purpose-built for MCP servers, tiny, composable, supports Valibot + Bun + Svelte ecosystem. Mastra is overkill (full AI framework). Score: **133 vs 67**.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  CLI Entry Point                                          │
│  npx docshark [--port 6380] [--stdio] [add|search|list]  │
├───────────────────────────────────────────────────────────┤
│  HTTP Server (srvx or Bun.serve)                          │
│  ├── /mcp/*        → TMCP HttpTransport (MCP protocol)   │
│  ├── /api/*        → REST API (dashboard backend)        │
│  └── /*            → Static SvelteKit dashboard          │
├───────────────────────────────────────────────────────────┤
│  MCP Server (TMCP)                                       │
│  ├── 6 Tools (see tools-spec.md)                         │
│  ├── Resources (doc:// URI scheme)                       │
│  └── Transports: STDIO + HTTP                            │
├───────────────────────────────────────────────────────────┤
│  Core Engine                                              │
│  ├── Scraper Pipeline                                     │
│  │   ├── Discovery: sitemap.xml → robots.txt → link crawl│
│  │   ├── Fetcher: fetch+cheerio (default) | Playwright   │
│  │   ├── Extractor: @mozilla/readability                 │
│  │   ├── Converter: turndown (HTML→Markdown)             │
│  │   └── Chunker: heading-based semantic splitting       │
│  ├── Job Manager (async crawl queue + EventBus)           │
│  ├── Storage (SQLite + better-sqlite3)                    │
│  │   ├── libraries, pages, chunks tables                 │
│  │   ├── FTS5 virtual table (full-text search)           │
│  │   └── crawl_jobs (progress tracking)                  │
│  └── Search Engine                                        │
│      ├── FTS5 + bm25() ranking (default, zero-config)    │
│      └── Optional: vector embeddings (OpenAI/Ollama)     │
├───────────────────────────────────────────────────────────┤
│  Dashboard (SvelteKit → static adapter → embedded)        │
│  ├── Home: stats + quick actions                         │
│  ├── Libraries: CRUD + crawl configs                     │
│  ├── Search Playground: live search testing              │
│  ├── Crawl Monitor: real-time SSE progress               │
│  └── Settings: config export/import, embedding toggle    │
└───────────────────────────────────────────────────────────┘
```

## Key Differentiators vs docs-mcp-server

| Feature                   | docs-mcp-server         | DocShark                                       |
| ------------------------- | ----------------------- | ---------------------------------------------- |
| **Browser Dependency**    | Playwright required     | `fetch + cheerio` default, Playwright optional |
| **Embedding Requirement** | Recommended (LangChain) | None — FTS5 works completely offline           |
| **Dashboard**             | HTMX + AlpineJS + JSX   | SvelteKit + Shadcn Svelte (pre-compiled)       |
| **Runtime**               | Node 22+ only           | Bun + Node + Deno                              |
| **MCP Framework**         | Official MCP SDK        | TMCP (composable, type-safe)                   |
| **Schema Validation**     | Zod                     | Valibot (Standard Schema)                      |
| **Pre-built Templates**   | None                    | One-click popular library templates            |
| **Config Sharing**        | Manual                  | Export/import JSON configs                     |
| **Dependencies**          | ~50+ packages           | Minimal, composable                            |
| **CLI**                   | `npx` only              | Full CLI: add, search, list, export, import    |

## Tech Stack

| Layer           | Technology                                                      |
| --------------- | --------------------------------------------------------------- |
| MCP Framework   | `tmcp` + `@tmcp/adapter-valibot` + `@tmcp/transport-stdio/http` |
| Validation      | `valibot`                                                       |
| HTTP Server     | `srvx` (TMCP recommended) or `Bun.serve`                        |
| Scraping        | `cheerio` + native `fetch`, optional `playwright`               |
| Content Extract | `@mozilla/readability` + `linkedom`                             |
| HTML→Markdown   | `turndown`                                                      |
| Database        | `better-sqlite3` + FTS5                                         |
| Dashboard       | SvelteKit + Tailwind CSS + Shadcn Svelte (static adapter)       |
| CLI             | `cac` or `Clerc`                                                |
| IDs             | `nanoid`                                                        |
| Embeddings      | Optional: `openai` / `ollama` / `@ai-sdk/openai`                |

## Success Criteria

- [ ] `npx docshark` starts MCP server + dashboard on `localhost:6380`
- [ ] Can add any doc website and have it indexed within minutes
- [ ] `search_docs` returns relevant, ranked chunks with heading context
- [ ] Works offline — zero API keys required for core functionality
- [ ] Dashboard shows real-time crawl progress via SSE
- [ ] STDIO transport works with Claude Desktop, Cursor, Windsurf
- [ ] HTTP transport works for remote/shared instances
- [ ] < 15 production dependencies total
- [ ] Full CLI: `docshark add`, `docshark search`, `docshark list`
- [ ] Pre-configured templates for 10+ popular libraries

## Phases

### Phase 1: Core Engine (Week 1-2)

Scaffold, storage, scraping, processing, MCP tools. Details in [todos.md](./todos.md).

### Phase 2: Dashboard (Week 3)

SvelteKit dashboard with source management, search playground, crawl monitor. Details in [dashboard-spec.md](./dashboard-spec.md).

### Phase 3: Polish & Distribution (Week 4)

CLI, npm publish, Docker, templates, config sharing. Details in [todos.md](./todos.md).

### Phase 4: Advanced Features (Week 5+)

Vector embeddings, Playwright adapter, auto-detect deps, diff-aware crawling.

## Related Documents

| Document                                            | Description                                          |
| --------------------------------------------------- | ---------------------------------------------------- |
| [Framework Comparison](./framework-comparison.md)   | TMCP vs Mastra deep analysis                         |
| [MCP Tools Spec](./tools-spec.md)                   | Detailed tool definitions with schemas               |
| [Dashboard Spec](./dashboard-spec.md)               | Dashboard pages, UX flows, components                |
| [Database Schema](./database-schema.md)             | SQLite tables, FTS5, queries                         |
| [Scraping Pipeline](./scraping-pipeline.md)         | Content processing architecture                      |
| [JS Rendering Strategy](./js-rendering-strategy.md) | Tiered puppeteer-core approach for JS sites          |
| [Implementation Guide](./implementation-guide.md)   | **Complete code reference** — every module connected |
| [Project Structure](./project-structure.md)         | Monorepo layout, npm distribution                    |
| [Research Notes](./notes.md)                        | Inspiration & ecosystem research                     |
| [Tasks & Milestones](./todos.md)                    | Phased task breakdown                                |

Back to repository root: [../..](../../)

## Project Documentation

- **[Implementation Guide](./implementation-guide.md)** — Architectural plan and implementation details.
- **[Installation & Setup](./mcp-setup.md)** — How to use DocShark in your favorite AI client.
- **[Publishing Guide](./PUBLISHING.md)** — How to bundle and publish the npm package.
- **[Project Structure](./project-structure.md)** — Core folder layout and distribution options.
- **[Database Schema](./database-schema.md)** — SQLite tables and search indexing logic.
- **[Scraping Pipeline](./scraping-pipeline.md)** — The multi-tier discovery and extraction flow.
- **[Tools Specification](./tools-spec.md)** — Detailed definitions of the 6 MCP tools.
