// src/storage/db.ts — SQLite + FTS5 storage layer (bun:sqlite)
import { Database as BunDatabase } from "bun:sqlite";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";
import type { Library, Page, ChunkRecord, CrawlJob } from "../types.js";

export class Database {
  private db!: BunDatabase;

  init() {
    const dir =
      process.env.DOCSHARK_DATA_DIR || resolve(homedir(), ".docshark");
    mkdirSync(dir, { recursive: true });
    this.db = new BunDatabase(resolve(dir, "docshark.db"));
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  /** Expose raw DB for search engine direct queries */
  raw(): BunDatabase {
    return this.db;
  }

  private migrate() {
    this.db.run(`
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
      )
    `);

    this.db.run(`
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
      )
    `);

    this.db.run(`
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
      )
    `);

    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        heading_context,
        content=chunks,
        content_rowid=rowid,
        tokenize='porter unicode61 remove_diacritics 2'
      )
    `);

    // FTS5 sync triggers
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content, heading_context)
        VALUES (NEW.rowid, NEW.content, NEW.heading_context);
      END
    `);

    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content, heading_context)
        VALUES ('delete', OLD.rowid, OLD.content, OLD.heading_context);
      END
    `);

    this.db.run(`
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
      )
    `);
  }

  // ──────────────────────────────────────
  // Library CRUD
  // ──────────────────────────────────────

  addLibrary(lib: {
    id: string;
    name: string;
    displayName: string;
    url: string;
    version?: string;
    crawlConfig?: object;
  }) {
    return this.db
      .prepare(
        `INSERT INTO libraries (id, name, display_name, url, version, crawl_config)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        lib.id,
        lib.name,
        lib.displayName,
        lib.url,
        lib.version ?? null,
        lib.crawlConfig ? JSON.stringify(lib.crawlConfig) : null,
      );
  }

  listLibraries(status?: string): Library[] {
    if (status && status !== "all") {
      return this.db
        .prepare("SELECT * FROM libraries WHERE status = ?")
        .all(status) as Library[];
    }
    return this.db
      .prepare("SELECT * FROM libraries ORDER BY name")
      .all() as Library[];
  }

  getLibraryByName(name: string): Library | undefined {
    return this.db
      .prepare("SELECT * FROM libraries WHERE name = ?")
      .get(name) as Library | undefined;
  }

  getLibraryById(id: string): Library | undefined {
    return this.db.prepare("SELECT * FROM libraries WHERE id = ?").get(id) as
      | Library
      | undefined;
  }

  removeLibrary(id: string) {
    return this.db.prepare("DELETE FROM libraries WHERE id = ?").run(id);
  }

  renameLibrary(id: string, name: string, displayName: string) {
    return this.db
      .prepare(
        `UPDATE libraries
         SET name = ?, display_name = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(name, displayName, id);
  }

  updateLibraryStatus(id: string, status: string) {
    return this.db
      .prepare(
        'UPDATE libraries SET status = ?, updated_at = datetime("now") WHERE id = ?',
      )
      .run(status, id);
  }

  updateLibraryStats(id: string, pageCount: number, chunkCount: number) {
    return this.db
      .prepare(
        `UPDATE libraries 
         SET page_count = ?, chunk_count = ?, last_crawled_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(pageCount, chunkCount, id);
  }

  // ──────────────────────────────────────
  // Page CRUD
  // ──────────────────────────────────────

  upsertPage(page: {
    id: string;
    libraryId: string;
    url: string;
    path: string;
    title: string;
    contentMarkdown: string;
    contentHash: string;
    headings: object[];
  }): string {
    this.db
      .prepare(
        `INSERT INTO pages (id, library_id, url, path, title, content_markdown, content_hash, headings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(library_id, url) DO UPDATE SET
           title = excluded.title,
           content_markdown = excluded.content_markdown,
           content_hash = excluded.content_hash,
           headings = excluded.headings,
           updated_at = datetime('now')`,
      )
      .run(
        page.id,
        page.libraryId,
        page.url,
        page.path,
        page.title,
        page.contentMarkdown,
        page.contentHash,
        JSON.stringify(page.headings),
      );

    const row = this.db
      .prepare("SELECT id FROM pages WHERE library_id = ? AND url = ?")
      .get(page.libraryId, page.url) as { id: string };
    return row.id;
  }

  getPage(opts: {
    url?: string;
    library?: string;
    path?: string;
  }): Page | undefined {
    if (opts.url) {
      return this.db
        .prepare("SELECT * FROM pages WHERE url = ?")
        .get(opts.url) as Page | undefined;
    }
    if (opts.library && opts.path) {
      return this.db
        .prepare(
          `SELECT p.* FROM pages p
           JOIN libraries l ON p.library_id = l.id
           WHERE l.name = ? AND p.path = ?`,
        )
        .get(opts.library, opts.path) as Page | undefined;
    }
    return undefined;
  }

  getPagesByLibrary(libraryId: string): Page[] {
    return this.db
      .prepare("SELECT * FROM pages WHERE library_id = ? ORDER BY path")
      .all(libraryId) as Page[];
  }

  // ──────────────────────────────────────
  // Chunk CRUD
  // ──────────────────────────────────────

  insertChunks(
    chunks: Array<{
      id: string;
      pageId: string;
      libraryId: string;
      content: string;
      headingContext: string;
      chunkIndex: number;
      tokenCount: number;
      hasCodeBlock: boolean;
    }>,
  ) {
    const insert = this.db.prepare(
      `INSERT INTO chunks (id, page_id, library_id, content, heading_context, chunk_index, token_count, has_code_block)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const tx = this.db.transaction(() => {
      for (const c of chunks) {
        insert.run(
          c.id,
          c.pageId,
          c.libraryId,
          c.content,
          c.headingContext,
          c.chunkIndex,
          c.tokenCount,
          c.hasCodeBlock ? 1 : 0,
        );
      }
    });

    tx();
  }

  deleteChunksByPage(pageId: string) {
    this.db.prepare("DELETE FROM chunks WHERE page_id = ?").run(pageId);
  }

  // ──────────────────────────────────────
  // Crawl Jobs
  // ──────────────────────────────────────

  createJob(job: { id: string; libraryId: string }): CrawlJob {
    this.db
      .prepare("INSERT INTO crawl_jobs (id, library_id) VALUES (?, ?)")
      .run(job.id, job.libraryId);
    return this.db
      .prepare("SELECT * FROM crawl_jobs WHERE id = ?")
      .get(job.id) as CrawlJob;
  }

  getJob(id: string): CrawlJob | undefined {
    return this.db.prepare("SELECT * FROM crawl_jobs WHERE id = ?").get(id) as
      | CrawlJob
      | undefined;
  }

  updateJob(
    id: string,
    updates: Partial<
      Pick<
        CrawlJob,
        | "status"
        | "pages_discovered"
        | "pages_crawled"
        | "pages_failed"
        | "chunks_created"
        | "error_message"
        | "started_at"
        | "completed_at"
      >
    >,
  ) {
    const sets: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }

    if (sets.length === 0) return;

    values.push(id);
    this.db
      .prepare(`UPDATE crawl_jobs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  listJobs(libraryId?: string): CrawlJob[] {
    if (libraryId) {
      return this.db
        .prepare(
          "SELECT * FROM crawl_jobs WHERE library_id = ? ORDER BY created_at DESC",
        )
        .all(libraryId) as CrawlJob[];
    }
    return this.db
      .prepare("SELECT * FROM crawl_jobs ORDER BY created_at DESC")
      .all() as CrawlJob[];
  }
}
