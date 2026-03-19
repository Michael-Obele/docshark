---
title: "DocShark — Tasks & Milestones"
status: draft
---

# Tasks & Milestones

← Back to [Plan Index](./index.md)

---

## Phase 1: Core Engine (Week 1-2)

### 1.1 Project Setup

- [ ] Scaffold TMCP project: `bun create tmcp docshark`
- [ ] Configure monorepo workspace (`packages/core`, `packages/dashboard`)
- [ ] Install deps: `tmcp`, `@tmcp/adapter-valibot`, `@tmcp/transport-stdio`, `valibot`
- [ ] Configure TypeScript strict mode, ESLint, Prettier
- [ ] Set up `tsup` for core package builds
- [ ] Create CLI entry with `cac`: `docshark start|add|search|list|export|import`
- [ ] Verify `npx docshark --help` works

### 1.2 Storage Layer

- [ ] Set up `better-sqlite3` with auto-init
- [ ] Create migration system (SQL files, run on first start)
- [ ] Create tables: `libraries`, `pages`, `chunks`, `crawl_jobs`, `source_templates`
- [ ] Create FTS5 virtual table with sync triggers
- [ ] Implement CRUD: `libraries.ts`, `pages.ts`, `chunks.ts`
- [ ] Implement `search.ts` with FTS5 + bm25() ranking
- [ ] Seed `source_templates` with 10+ popular doc sources
- [ ] Default data dir: `~/.docshark/docshark.db`

### 1.3 Scraping Engine

- [ ] Page discovery: sitemap.xml parser → link crawl fallback
- [ ] robots.txt parser with `robots-parser`
- [ ] HTTP fetcher with User-Agent, timeout, retry
- [ ] Incremental support: `Last-Modified` / `ETag` headers
- [ ] `RateLimiter` class (configurable delay)
- [ ] URL filtering: include/exclude pattern matching

### 1.4 Content Processing

- [ ] Content extraction: `@mozilla/readability` + `linkedom`
- [ ] HTML→Markdown: `turndown` with custom rules (code blocks, tables)
- [ ] Heading-based chunker: recursive split on h1→h2→h3→paragraphs
- [ ] Heading context breadcrumbs: `"Getting Started > Installation"`
- [ ] Token estimation: `Math.ceil(text.length / 4)`
- [ ] Code block preservation (never split mid-code)

### 1.5 Job Manager

- [ ] `JobManager` class: queue, start, cancel, status
- [ ] `CrawlWorker`: orchestrate discover→fetch→process→index pipeline
- [ ] `EventBus`: publish/subscribe for progress events
- [ ] Job state persistence in `crawl_jobs` table
- [ ] Async execution (non-blocking — dashboard stays responsive)

### 1.6 MCP Tools

- [ ] `search_docs` — FTS5 search with formatted markdown output
- [ ] `list_libraries` — formatted table of indexed libraries
- [ ] `get_doc_page` — full page content retrieval
- [ ] `add_library` — register + start crawl
- [ ] `refresh_library` — incremental re-crawl
- [ ] `remove_library` — cascade delete
- [ ] Test all tools with MCP Inspector

### 1.7 Integration Testing

- [ ] Test STDIO transport with Claude Desktop
- [ ] Test STDIO with Cursor
- [ ] Index Svelte 5 docs → verify search quality
- [ ] Index Tailwind CSS docs → verify code block extraction
- [ ] End-to-end: add → crawl → search → get page

---

## Phase 2: Dashboard (Week 3)

### 2.1 SvelteKit Setup

- [ ] Create SvelteKit app in `packages/dashboard`
- [ ] Install: Tailwind CSS v4, Shadcn Svelte, Lucide Svelte
- [ ] Configure `@sveltejs/adapter-static`
- [ ] Design layout shell: sidebar nav, header, content area
- [ ] Dark mode support

### 2.2 REST API

- [ ] `GET /api/libraries` — list all
- [ ] `POST /api/libraries` — add new
- [ ] `GET /api/libraries/:id` — detail
- [ ] `PUT /api/libraries/:id` — update config
- [ ] `DELETE /api/libraries/:id` — remove
- [ ] `POST /api/libraries/:id/refresh` — trigger re-crawl
- [ ] `GET /api/search?q=...&library=...&limit=...` — search
- [ ] `GET /api/crawls` — list jobs
- [ ] `DELETE /api/crawls/:id` — cancel job
- [ ] `GET /api/crawl-events` — SSE stream
- [ ] `GET /api/stats` — overview stats
- [ ] `GET /api/templates` — source templates
- [ ] `GET /api/settings` — current config
- [ ] `PUT /api/settings` — update config
- [ ] `POST /api/export` — export config JSON
- [ ] `POST /api/import` — import config JSON

### 2.3 Dashboard Pages

- [ ] **Home** (`/`): stats cards, quick actions, recent activity, active crawls
- [ ] **Libraries** (`/libraries`): table with CRUD, filters, bulk actions
- [ ] **Add Library** (`/libraries/add`): form + template browser
- [ ] **Library Detail** (`/libraries/:id`): pages list, crawl history
- [ ] **Search Playground** (`/search`): live search with results preview
- [ ] **Crawl Monitor** (`/crawls`): SSE-driven real-time progress bars
- [ ] **Settings** (`/settings`): config, embedding setup, export/import

### 2.4 SSE Integration

- [ ] `EventSource` connection to `/api/crawl-events`
- [ ] Real-time progress bars with percentage, speed, ETA
- [ ] Auto-reconnect on connection drop
- [ ] Toast notifications on crawl complete/fail

### 2.5 Build & Embed

- [ ] SvelteKit static build → `packages/dashboard/build/`
- [ ] Copy to `packages/core/dist/dashboard/`
- [ ] Core HTTP server serves dashboard files on `/*`
- [ ] Verify: `npx docshark` opens dashboard in browser

---

## Phase 3: Polish & Distribution (Week 4)

### 3.1 Source Templates

- [ ] Define JSON schema for templates
- [ ] Add templates: Svelte 5, SvelteKit, React, Vue, Next.js, Nuxt
- [ ] Add templates: Tailwind CSS, Prisma, Drizzle, Better Auth
- [ ] Add templates: Node.js, TypeScript, MDN Web Docs
- [ ] Dashboard template browser UI
- [ ] one-click "Add" from template

### 3.2 Config System

- [ ] `docshark.config.json` format definition
- [ ] `docshark export` → JSON file with all settings + library configs
- [ ] `docshark import <file>` → register libraries from config
- [ ] Auto-detect `docshark.config.json` in project root
- [ ] `DOCSHARK_DATA_DIR` env var support

### 3.3 npm Distribution

- [ ] Build pipeline: dashboard → core → package
- [ ] `package.json` `bin`, `files`, `keywords`
- [ ] `npx docshark` works cold (no pre-install)
- [ ] README with: features, install, config examples, screenshots
- [ ] CHANGELOG.md
- [ ] LICENSE (MIT)
- [ ] Publish to npm

### 3.4 Docker

- [ ] Dockerfile (Bun runtime)
- [ ] docker-compose.yml with volume mounts
- [ ] Publish to GitHub Container Registry
- [ ] Docker README section

---

## Phase 4: Advanced Features (Week 5+)

### 4.1 Enhanced Search

- [ ] Optional vector embeddings: OpenAI, Ollama, local models
- [ ] Hybrid search: FTS5 + vector similarity with Reciprocal Rank Fusion
- [ ] Code block prioritization in search results
- [ ] Recency weighting: newer docs rank higher

### 4.2 Smart Crawling

- [ ] Diff-aware re-crawl (HTTP 304, content hash comparison)
- [ ] Concurrent crawling with configurable concurrency
- [ ] Playwright adapter (dynamic import, opt-in per library)
- [ ] Auto-detect project deps from `package.json` → suggest templates

### 4.3 Developer Experience

- [ ] `docshark search "query"` CLI with colored terminal output
- [ ] MCP Resources: `doc://library/path` URI scheme
- [ ] Verbose logging mode: `--verbose` flag
- [ ] Health check endpoint: `GET /api/health`

---

## Stretch Goals

- [ ] Browser extension: "Add this page to DocShark"
- [ ] VS Code extension: sidebar with inline search
- [ ] Webhook on crawl complete (Slack, Discord)
- [ ] Multi-language docs support (i18n URLs)
- [ ] GraphRAG for cross-doc relationship queries

← Back to [Plan Index](./index.md)
