---
title: "DocShark — Implementation Guide"
status: draft
---

# Implementation Guide

Complete code reference for building DocShark. Every module, every connection, every flow — buildable from this document.

← Back to [Plan Index](./index.md)

---

## How Everything Connects

```
┌──────────────────────────────────────────────────────────────────┐
│ CLI (src/cli.ts)   →   cac parses args                         │
│   ├── "start"      →   startServer()                            │
│   │                      ├── new McpServer() (TMCP)              │
│   │                      ├── register all 6 tools                │
│   │                      ├── new HttpTransport() on /mcp/*       │
│   │                      ├── mount REST API on /api/*            │
│   │                      ├── serve static dashboard on /*        │
│   │                      └── OR: new StdioTransport() (--stdio)  │
│   ├── "add <url>"  →   LibraryService.add() → JobManager.start()│
│   ├── "search"     →   SearchEngine.search()                    │
│   └── "list"       →   Storage.listLibraries()                  │
├──────────────────────────────────────────────────────────────────┤
│ MCP Tools (src/tools/*.ts)                                      │
│   Each tool imports a service and calls it:                      │
│   search_docs     → SearchEngine.search()                       │
│   list_libraries  → Storage.listLibraries()                     │
│   get_doc_page    → Storage.getPage()                           │
│   add_library     → LibraryService.add() → JobManager.start()   │
│   refresh_library → JobManager.start(incremental)               │
│   remove_library  → Storage.removeLibrary()                     │
├──────────────────────────────────────────────────────────────────┤
│ Services Layer                                                   │
│   LibraryService  → Storage (CRUD) + JobManager (crawl)         │
│   SearchEngine    → Storage.searchFTS5()                        │
│   JobManager      → CrawlWorker + EventBus                     │
│   CrawlWorker     → Discoverer → Fetcher → Processor → Storage │
│   EventBus        → SSE → Dashboard                             │
├──────────────────────────────────────────────────────────────────┤
│ Storage (src/storage/*.ts)                                       │
│   Database.init() → better-sqlite3 → creates tables + FTS5      │
│   Libraries CRUD, Pages CRUD, Chunks CRUD + FTS5                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Server Entry Point

The TMCP server + HTTP server setup. This is `src/server.ts`.

```typescript
// src/server.ts
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { tool } from 'tmcp/utils';
import { Database } from './storage/db.js';
import { SearchEngine } from './storage/search.js';
import { LibraryService } from './services/library.js';
import { JobManager } from './jobs/manager.js';
import { EventBus } from './jobs/events.js';

// Initialize core services
const db = new Database();
const eventBus = new EventBus();
const searchEngine = new SearchEngine(db);
const jobManager = new JobManager(db, eventBus);
const libraryService = new LibraryService(db, jobManager);

// Create TMCP server
export const server = new McpServer(
  {
    name: 'docshark',
    version: '1.0.0',
  },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Register all tools (imported from separate files)
import { createSearchDocsTool } from './tools/search-docs.js';
import { createListLibrariesTool } from './tools/list-libraries.js';
import { createGetDocPageTool } from './tools/get-doc-page.js';
import { createAddLibraryTool } from './tools/add-library.js';
import { createRefreshLibraryTool } from './tools/refresh-library.js';
import { createRemoveLibraryTool } from './tools/remove-library.js';

server.tools([
  createSearchDocsTool(searchEngine),
  createListLibrariesTool(db),
  createGetDocPageTool(db),
  createAddLibraryTool(libraryService),
  createRefreshLibraryTool(jobManager, db),
  createRemoveLibraryTool(db),
]);

// Export for use by CLI and HTTP server
export { db, eventBus, searchEngine, jobManager, libraryService };
```

---

## 2. HTTP Server (Dashboard + MCP + API)

```typescript
// src/http.ts
import { HttpTransport } from '@tmcp/transport-http';
import { server, eventBus, db, searchEngine, jobManager, libraryService } from './server.js';
import { createApiRouter } from './api/router.js';
import { resolve } from 'path';
import { existsSync } from 'fs';

export async function startHttpServer(port: number) {
  const transport = new HttpTransport(server, { path: '/mcp' });
  const apiRouter = createApiRouter({ db, searchEngine, jobManager, libraryService, eventBus });

  // Resolve dashboard static files (embedded in dist/)
  const dashboardDir = resolve(import.meta.dirname, 'dashboard');
  const hasDashboard = existsSync(dashboardDir);

  const httpServer = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);

      // 1. MCP transport (TMCP handles this)
      if (url.pathname.startsWith('/mcp')) {
        return (await transport.handleRequest(request)) ?? new Response('Not found', { status: 404 });
      }

      // 2. REST API for dashboard
      if (url.pathname.startsWith('/api/')) {
        return apiRouter.handle(request);
      }

      // 3. SSE endpoint for real-time crawl events
      if (url.pathname === '/api/crawl-events') {
        return handleSSE(request, eventBus);
      }

      // 4. Serve static dashboard files
      if (hasDashboard) {
        return serveStatic(dashboardDir, url.pathname);
      }

      return new Response('DocShark is running. Dashboard not found.', { status: 200 });
    },
  });

  console.log(`🦈 DocShark running on http://localhost:${port}`);
  console.log(`   Dashboard: http://localhost:${port}`);
  console.log(`   MCP:       http://localhost:${port}/mcp`);
  console.log(`   API:       http://localhost:${port}/api`);

  return httpServer;
}

// SSE handler for real-time crawl progress
function handleSSE(request: Request, eventBus: EventBus) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const onProgress = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      eventBus.on('crawl:progress', onProgress);
      eventBus.on('crawl:complete', onProgress);
      eventBus.on('crawl:error', onProgress);

      request.signal.addEventListener('abort', () => {
        eventBus.off('crawl:progress', onProgress);
        eventBus.off('crawl:complete', onProgress);
        eventBus.off('crawl:error', onProgress);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 3. CLI Entry Point

```typescript
// src/cli.ts
#!/usr/bin/env node
import { cac } from 'cac';
import { startHttpServer } from './http.js';
import { StdioTransport } from '@tmcp/transport-stdio';
import { server, db, searchEngine, libraryService } from './server.js';

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
  .action(async (opts) => {
    process.env.DOCSHARK_DATA_DIR = opts.dataDir;
    db.init();

    if (opts.stdio) {
      // STDIO mode — no dashboard, direct pipe
      const stdio = new StdioTransport(server);
      stdio.listen();
    } else {
      await startHttpServer(parseInt(opts.port));
    }
  });

program
  .command('add <url>')
  .option('-n, --name <name>', 'Library name')
  .option('-d, --depth <n>', 'Max crawl depth', '3')
  .action(async (url, opts) => {
    db.init();
    const lib = await libraryService.add({ url, name: opts.name, maxDepth: parseInt(opts.depth) });
    console.log(`✅ Added "${lib.display_name}" — crawling ${lib.url}...`);
  });

program
  .command('search <query>')
  .option('-l, --library <name>', 'Filter by library')
  .option('--limit <n>', 'Max results', '5')
  .action(async (query, opts) => {
    db.init();
    const results = searchEngine.search(query, { library: opts.library, limit: parseInt(opts.limit) });
    for (const r of results) {
      console.log(`\n--- ${r.page_title} (${r.library_name}) ---`);
      console.log(`Section: ${r.heading_context}`);
      console.log(r.content.slice(0, 300));
      console.log(`Source: ${r.page_url}\n`);
    }
  });

program
  .command('list')
  .action(() => {
    db.init();
    const libs = db.listLibraries();
    console.table(libs.map((l) => ({
      Name: l.name, URL: l.url, Pages: l.page_count, Status: l.status, 
    })));
  });

program.parse();
```

---

## 4. Storage Layer (SQLite + FTS5)

```typescript
// src/storage/db.ts
import BetterSqlite3 from 'better-sqlite3';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { homedir } from 'os';

export class Database {
  private db!: BetterSqlite3.Database;

  init() {
    const dir = process.env.DOCSHARK_DATA_DIR || resolve(homedir(), '.docshark');
    mkdirSync(dir, { recursive: true });
    this.db = new BetterSqlite3(resolve(dir, 'docshark.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS libraries (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        url          TEXT NOT NULL,
        version      TEXT,
        description  TEXT,
        status       TEXT NOT NULL DEFAULT 'pending',
        page_count   INTEGER NOT NULL DEFAULT 0,
        chunk_count  INTEGER NOT NULL DEFAULT 0,
        crawl_config TEXT,
        last_crawled_at TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pages (
        id              TEXT PRIMARY KEY,
        library_id      TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        url             TEXT NOT NULL,
        path            TEXT NOT NULL,
        title           TEXT,
        content_markdown TEXT,
        content_hash    TEXT,
        headings        TEXT,
        http_status     INTEGER,
        last_modified   TEXT,
        etag            TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(library_id, url)
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id              TEXT PRIMARY KEY,
        page_id         TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        library_id      TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        content         TEXT NOT NULL,
        heading_context TEXT,
        chunk_index     INTEGER NOT NULL,
        token_count     INTEGER,
        has_code_block  INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        heading_context,
        content=chunks,
        content_rowid=rowid,
        tokenize='porter unicode61 remove_diacritics 2'
      );

      -- FTS5 sync triggers
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content, heading_context)
        VALUES (NEW.rowid, NEW.content, NEW.heading_context);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content, heading_context)
        VALUES ('delete', OLD.rowid, OLD.content, OLD.heading_context);
      END;

      CREATE TABLE IF NOT EXISTS crawl_jobs (
        id               TEXT PRIMARY KEY,
        library_id       TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        status           TEXT NOT NULL DEFAULT 'queued',
        pages_discovered INTEGER NOT NULL DEFAULT 0,
        pages_crawled    INTEGER NOT NULL DEFAULT 0,
        pages_failed     INTEGER NOT NULL DEFAULT 0,
        chunks_created   INTEGER NOT NULL DEFAULT 0,
        error_message    TEXT,
        started_at       TEXT,
        completed_at     TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // === Library CRUD ===

  addLibrary(lib: {
    id: string; name: string; displayName: string;
    url: string; version?: string; crawlConfig?: object;
  }) {
    return this.db.prepare(`
      INSERT INTO libraries (id, name, display_name, url, version, crawl_config)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(lib.id, lib.name, lib.displayName, lib.url, lib.version, 
      lib.crawlConfig ? JSON.stringify(lib.crawlConfig) : null);
  }

  listLibraries(status?: string) {
    if (status && status !== 'all') {
      return this.db.prepare('SELECT * FROM libraries WHERE status = ?').all(status);
    }
    return this.db.prepare('SELECT * FROM libraries ORDER BY name').all();
  }

  getLibraryByName(name: string) {
    return this.db.prepare('SELECT * FROM libraries WHERE name = ?').get(name);
  }

  removeLibrary(id: string) {
    return this.db.prepare('DELETE FROM libraries WHERE id = ?').run(id);
  }

  updateLibraryStatus(id: string, status: string) {
    return this.db.prepare(
      'UPDATE libraries SET status = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(status, id);
  }

  // === Page CRUD ===

  upsertPage(page: {
    id: string; libraryId: string; url: string; path: string;
    title: string; contentMarkdown: string; contentHash: string;
    headings: object[];
  }) {
    return this.db.prepare(`
      INSERT INTO pages (id, library_id, url, path, title, content_markdown, content_hash, headings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(library_id, url) DO UPDATE SET
        title = excluded.title,
        content_markdown = excluded.content_markdown,
        content_hash = excluded.content_hash,
        headings = excluded.headings,
        updated_at = datetime('now')
    `).run(page.id, page.libraryId, page.url, page.path,
      page.title, page.contentMarkdown, page.contentHash,
      JSON.stringify(page.headings));
  }

  getPage(opts: { url?: string; library?: string; path?: string }) {
    if (opts.url) {
      return this.db.prepare('SELECT * FROM pages WHERE url = ?').get(opts.url);
    }
    if (opts.library && opts.path) {
      return this.db.prepare(`
        SELECT p.* FROM pages p
        JOIN libraries l ON p.library_id = l.id
        WHERE l.name = ? AND p.path = ?
      `).get(opts.library, opts.path);
    }
    return null;
  }

  // === Chunk CRUD ===

  insertChunks(chunks: Array<{
    id: string; pageId: string; libraryId: string;
    content: string; headingContext: string;
    chunkIndex: number; tokenCount: number; hasCodeBlock: boolean;
  }>) {
    const insert = this.db.prepare(`
      INSERT INTO chunks (id, page_id, library_id, content, heading_context, chunk_index, token_count, has_code_block)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const c of chunks) {
        insert.run(c.id, c.pageId, c.libraryId, c.content,
          c.headingContext, c.chunkIndex, c.tokenCount, c.hasCodeBlock ? 1 : 0);
      }
    });

    tx();
  }

  deleteChunksByPage(pageId: string) {
    this.db.prepare('DELETE FROM chunks WHERE page_id = ?').run(pageId);
  }
}
```

---

## 5. Search Engine (FTS5 + BM25)

```typescript
// src/storage/search.ts
import type { Database } from './db.js';

export interface SearchResult {
  content: string;
  heading_context: string;
  page_url: string;
  page_title: string;
  library_name: string;
  library_display_name: string;
  relevance_score: number;
  has_code_block: boolean;
  token_count: number;
}

export class SearchEngine {
  constructor(private db: Database) {}

  search(
    query: string,
    opts: { library?: string; limit?: number } = {}
  ): SearchResult[] {
    const limit = opts.limit ?? 5;

    // Sanitize query for FTS5 (escape special chars)
    const ftsQuery = this.sanitizeQuery(query);

    const stmt = this.db.raw().prepare(`
      SELECT
        c.content,
        c.heading_context,
        c.has_code_block,
        c.token_count,
        p.url   AS page_url,
        p.title AS page_title,
        l.name  AS library_name,
        l.display_name AS library_display_name,
        bm25(chunks_fts, 1.0, 0.5) AS relevance_score
      FROM chunks_fts
      JOIN chunks c ON chunks_fts.rowid = c.rowid
      JOIN pages p  ON c.page_id = p.id
      JOIN libraries l ON c.library_id = l.id
      WHERE chunks_fts MATCH ?
        AND (? IS NULL OR l.name = ?)
      ORDER BY relevance_score
      LIMIT ?
    `);

    return stmt.all(ftsQuery, opts.library ?? null, opts.library ?? null, limit) as SearchResult[];
  }

  private sanitizeQuery(query: string): string {
    // Remove FTS5 special operators for safety, wrap terms
    return query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => `"${term}"`)
      .join(' OR ');
  }
}
```

---

## 6. Tool Definition Pattern (TMCP + Valibot)

Every tool follows this pattern: `defineTool` → export → register in server.

```typescript
// src/tools/search-docs.ts
import { defineTool } from 'tmcp/tool';
import { tool } from 'tmcp/utils';
import * as v from 'valibot';
import type { SearchEngine } from '../storage/search.js';

export function createSearchDocsTool(searchEngine: SearchEngine) {
  return defineTool(
    {
      name: 'search_docs',
      description:
        'Search through indexed documentation libraries. ' +
        'Returns relevant documentation sections with code examples and source URLs. ' +
        'Use this when you need to find information about a library, framework, or API.',
      schema: v.object({
        query: v.pipe(v.string(), v.description('Search query. Use natural language.')),
        library: v.optional(v.pipe(v.string(), v.description('Filter to a specific library.'))),
        limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)), 5),
      }),
    },
    async ({ query, library, limit }) => {
      const results = searchEngine.search(query, { library, limit });

      if (results.length === 0) {
        return tool.text(`No results found for "${query}".`);
      }

      const formatted = results
        .map((r, i) => {
          let block = `### ${i + 1}. ${r.page_title} — ${r.library_display_name}\n`;
          block += `**Source:** ${r.page_url}\n`;
          block += `**Section:** ${r.heading_context}\n\n`;
          block += r.content;
          return block;
        })
        .join('\n\n---\n\n');

      return tool.text(`## Results for "${query}"\n\n${formatted}`);
    },
  );
}
```

---

## 7. Crawl Worker Pipeline

```typescript
// src/jobs/worker.ts
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type { Database } from '../storage/db.js';
import type { EventBus } from './events.js';
import { discoverPages } from '../scraper/discoverer.js';
import { fetchPage } from '../scraper/fetcher.js';
import { extractAndConvert } from '../processor/extractor.js';
import { chunkMarkdown } from '../processor/chunker.js';

export class CrawlWorker {
  constructor(private db: Database, private eventBus: EventBus) {}

  async crawl(libraryId: string, jobId: string) {
    const lib = this.db.getLibraryById(libraryId);
    if (!lib) throw new Error(`Library ${libraryId} not found`);

    const config = lib.crawl_config ? JSON.parse(lib.crawl_config) : {};
    this.db.updateLibraryStatus(libraryId, 'crawling');

    try {
      // Phase 1: Discover pages
      const urls = await discoverPages(lib.url, config);
      this.db.updateJob(jobId, { pages_discovered: urls.length, status: 'running' });
      this.eventBus.emit('crawl:progress', {
        jobId, libraryId, phase: 'discovering', pagesDiscovered: urls.length,
      });

      let crawled = 0;
      let failed = 0;
      let totalChunks = 0;

      // Phase 2-6: Fetch → Extract → Convert → Chunk → Index
      for (const url of urls) {
        try {
          const result = await fetchPage(url, config.renderer);

          if (result.unchanged) {
            crawled++;
            continue; // Skip unchanged pages
          }

          // Extract content + convert to markdown
          const { markdown, title, headings } = extractAndConvert(result.html, url);
          const contentHash = createHash('sha256').update(markdown).digest('hex');

          // Store page
          const pageId = nanoid();
          const path = new URL(url).pathname;
          this.db.upsertPage({
            id: pageId, libraryId, url, path, title,
            contentMarkdown: markdown, contentHash, headings,
          });

          // Delete old chunks for this page
          this.db.deleteChunksByPage(pageId);

          // Chunk and index
          const chunks = chunkMarkdown(markdown, headings);
          const chunkRecords = chunks.map((c, i) => ({
            id: nanoid(),
            pageId, libraryId,
            content: c.content,
            headingContext: c.headingContext,
            chunkIndex: i,
            tokenCount: c.tokenCount,
            hasCodeBlock: c.hasCodeBlock,
          }));

          this.db.insertChunks(chunkRecords);
          totalChunks += chunkRecords.length;
          crawled++;

          // Emit progress
          this.eventBus.emit('crawl:progress', {
            jobId, libraryId,
            phase: 'crawling',
            pagesCrawled: crawled,
            pagesDiscovered: urls.length,
            currentUrl: url,
          });
        } catch (err) {
          failed++;
          console.error(`[DocShark] Failed to crawl ${url}:`, err);
        }
      }

      // Update final stats
      this.db.updateLibraryStats(libraryId, crawled, totalChunks);
      this.db.updateLibraryStatus(libraryId, 'indexed');
      this.db.updateJob(jobId, {
        status: 'completed', pages_crawled: crawled,
        pages_failed: failed, chunks_created: totalChunks,
        completed_at: new Date().toISOString(),
      });

      this.eventBus.emit('crawl:complete', { jobId, libraryId, crawled, failed, totalChunks });
    } catch (err: any) {
      this.db.updateLibraryStatus(libraryId, 'error');
      this.db.updateJob(jobId, { status: 'failed', error_message: err.message });
      this.eventBus.emit('crawl:error', { jobId, libraryId, error: err.message });
    }
  }
}
```

---

## 8. Content Processor

```typescript
// src/processor/extractor.ts
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Preserve language attribute on code blocks
turndown.addRule('fencedCodeBlock', {
  filter: (node: any) => node.nodeName === 'PRE' && node.querySelector('code'),
  replacement: (_content: string, node: any) => {
    const code = node.querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
    const text = code?.textContent || '';
    return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;
  },
});

// Strip images (noisy for search)
turndown.addRule('removeImages', {
  filter: 'img',
  replacement: () => '',
});

export function extractAndConvert(html: string, url: string) {
  const { document } = parseHTML(html);
  const reader = new Readability(document, { charThreshold: 100, keepClasses: true });
  const article = reader.parse();

  const title = article?.title || document.querySelector('title')?.textContent || '';
  const contentHtml = article?.content || '';
  const markdown = turndown.turndown(contentHtml).trim();

  // Extract heading hierarchy
  const headings: Array<{ level: number; text: string }> = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2].trim() });
  }

  return { markdown, title, headings };
}
```

---

## 9. Chunker

```typescript
// src/processor/chunker.ts

export interface Chunk {
  content: string;
  headingContext: string;
  tokenCount: number;
  hasCodeBlock: boolean;
}

const MAX_TOKENS = 1200;
const MIN_TOKENS = 50;

export function chunkMarkdown(
  markdown: string,
  headings: Array<{ level: number; text: string }>
): Chunk[] {
  const sections = splitByHeadings(markdown);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const tokens = estimateTokens(section.content);

    if (tokens < MIN_TOKENS) continue; // Skip tiny fragments

    if (tokens <= MAX_TOKENS) {
      chunks.push({
        content: section.content,
        headingContext: section.headingPath,
        tokenCount: tokens,
        hasCodeBlock: section.content.includes('```'),
      });
    } else {
      // Split large sections by paragraphs
      const paras = splitByParagraphs(section.content);
      let buffer = '';
      for (const para of paras) {
        if (estimateTokens(buffer + para) > MAX_TOKENS && buffer) {
          chunks.push({
            content: buffer.trim(),
            headingContext: section.headingPath,
            tokenCount: estimateTokens(buffer),
            hasCodeBlock: buffer.includes('```'),
          });
          buffer = '';
        }
        buffer += para + '\n\n';
      }
      if (buffer.trim() && estimateTokens(buffer) >= MIN_TOKENS) {
        chunks.push({
          content: buffer.trim(),
          headingContext: section.headingPath,
          tokenCount: estimateTokens(buffer),
          hasCodeBlock: buffer.includes('```'),
        });
      }
    }
  }

  return chunks;
}

function splitByHeadings(md: string) {
  const lines = md.split('\n');
  const sections: Array<{ content: string; headingPath: string }> = [];
  const headingStack: string[] = [];
  let currentContent = '';

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentContent.trim()) {
        sections.push({ content: currentContent.trim(), headingPath: headingStack.join(' > ') });
      }
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      // Maintain heading stack for breadcrumb
      while (headingStack.length >= level) headingStack.pop();
      headingStack.push(text);
      currentContent = line + '\n';
    } else {
      currentContent += line + '\n';
    }
  }

  if (currentContent.trim()) {
    sections.push({ content: currentContent.trim(), headingPath: headingStack.join(' > ') });
  }

  return sections;
}

function splitByParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).filter(Boolean);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

---

## 10. EventBus

```typescript
// src/jobs/events.ts

type Listener = (data: any) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}
```

---

## 11. REST API Router

```typescript
// src/api/router.ts

export function createApiRouter(deps: {
  db: Database; searchEngine: SearchEngine;
  jobManager: JobManager; libraryService: LibraryService;
  eventBus: EventBus;
}) {
  return {
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api/, '');
      const method = request.method;

      // GET /api/libraries
      if (method === 'GET' && path === '/libraries') {
        const libs = deps.db.listLibraries();
        return json(libs);
      }

      // POST /api/libraries
      if (method === 'POST' && path === '/libraries') {
        const body = await request.json();
        const lib = await deps.libraryService.add(body);
        return json(lib, 201);
      }

      // DELETE /api/libraries/:id
      const deleteMatch = path.match(/^\/libraries\/(.+)$/);
      if (method === 'DELETE' && deleteMatch) {
        deps.db.removeLibrary(deleteMatch[1]);
        return json({ ok: true });
      }

      // GET /api/search?q=...&library=...&limit=...
      if (method === 'GET' && path === '/search') {
        const q = url.searchParams.get('q') || '';
        const library = url.searchParams.get('library') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '5');
        const results = deps.searchEngine.search(q, { library, limit });
        return json(results);
      }

      // GET /api/stats
      if (method === 'GET' && path === '/stats') {
        const libs = deps.db.listLibraries();
        return json({
          libraries: libs.length,
          pages: libs.reduce((s, l: any) => s + l.page_count, 0),
          chunks: libs.reduce((s, l: any) => s + l.chunk_count, 0),
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

---

## Key Discovery: h2m-parser

During research, I found [`h2m-parser`](https://github.com/gustavovalverde/h2m-parser) — a library that combines Readability + Markdown conversion in one step, **4x faster** than Turndown, with built-in chunking and content hashing:

| Feature      | Our stack (readability + turndown) | h2m-parser  |
| ------------ | ---------------------------------- | ----------- |
| Speed        | ~7ms/doc                           | ~1.8ms/doc  |
| Readability  | Separate `@mozilla/readability`    | Built-in    |
| Chunking     | Custom splitter                    | Built-in    |
| Hashing      | Custom SHA-256                     | Built-in    |
| Front matter | No                                 | Yes (YAML)  |
| TypeScript   | Manual types                       | First-class |

**Consider replacing** our readability + turndown chain with h2m-parser in implementation. Both approaches work — h2m-parser is faster but newer.

---

## Full Dependency Chain

```
docshark
├── tmcp                        # MCP server framework
├── @tmcp/adapter-valibot       # Valibot → JSON Schema
├── @tmcp/transport-stdio       # STDIO transport
├── @tmcp/transport-http        # HTTP transport
├── valibot                     # Schema validation
├── better-sqlite3              # SQLite with FTS5
├── @mozilla/readability        # Content extraction
├── linkedom                    # DOM for Readability
├── turndown                    # HTML → Markdown
├── cheerio                     # HTML parsing
├── cac                         # CLI framework
├── nanoid                      # ID generation
├── robots-parser               # robots.txt
└── (optional) puppeteer-core   # JS-rendered sites
```

See [JS Rendering Strategy](./js-rendering-strategy.md) for the puppeteer-core integration.

← Back to [Plan Index](./index.md)
