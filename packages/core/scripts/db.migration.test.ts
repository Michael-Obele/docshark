/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { Database as BunDatabase } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { JobManager } from "../src/jobs/manager.js";
import { LibraryService } from "../src/services/library.js";
import { Database } from "../src/storage/db.js";
import { SearchEngine } from "../src/storage/search.js";

const tempDirs: string[] = [];
const openHandles: BunDatabase[] = [];

function createTempDatabase(): Database {
  const dataDir = mkdtempSync(join(tmpdir(), "docshark-db-"));
  tempDirs.push(dataDir);
  process.env.DOCSHARK_DATA_DIR = dataDir;

  const db = new Database();
  db.init();
  openHandles.push(db.raw());
  return db;
}

afterEach(() => {
  for (const handle of openHandles.splice(0)) {
    handle.close();
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }

  delete process.env.DOCSHARK_DATA_DIR;
});

describe("Database legacy migrations", () => {
  test("adds crawl_jobs.session_id for existing databases", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "docshark-db-migration-"));
    tempDirs.push(dataDir);

    const sqlite = new BunDatabase(join(dataDir, "docshark.db"));
    sqlite.run("PRAGMA foreign_keys = ON");
    sqlite.run(`
      CREATE TABLE libraries (
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
    sqlite.run(`
      CREATE TABLE crawl_jobs (
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
    sqlite.close();

    process.env.DOCSHARK_DATA_DIR = dataDir;

    const db = new Database();
    db.init();

    const columns = db
      .raw()
      .prepare("PRAGMA table_info(crawl_jobs)")
      .all() as Array<{ name: string }>;

    expect(columns.some((column) => column.name === "session_id")).toBe(true);

    db.addLibrary({
      id: "lib-1",
      name: "drizzle",
      displayName: "Drizzle",
      url: "https://orm.drizzle.team/",
    });

    const job = db.createJob({
      id: "job-1",
      libraryId: "lib-1",
      sessionId: "session-123",
    });

    expect(job.session_id).toBe("session-123");
  });

  test("persists libraries, pages, chunks, and crawl jobs", () => {
    const db = createTempDatabase();

    db.addLibrary({
      id: "lib-1",
      name: "svelte-docs",
      displayName: "Svelte Docs",
      url: "https://svelte.dev/docs/",
      crawlConfig: { maxDepth: 2 },
    });

    const pageId = db.upsertPage({
      id: "page-1",
      libraryId: "lib-1",
      url: "https://svelte.dev/docs/getting-started",
      path: "/getting-started",
      title: "Getting Started",
      contentMarkdown: "# Getting Started\n\nInstall Svelte and build apps.",
      contentHash: "hash-1",
      headings: [{ level: 1, text: "Getting Started" }],
    });

    db.insertChunks([
      {
        id: "chunk-1",
        pageId,
        libraryId: "lib-1",
        content: "Install Svelte and build apps with runes.",
        headingContext: "Getting Started",
        chunkIndex: 0,
        tokenCount: 12,
        hasCodeBlock: false,
      },
    ]);

    const job = db.createJob({ id: "job-1", libraryId: "lib-1" });
    db.updateJob(job.id, {
      status: "completed",
      pages_discovered: 1,
      pages_crawled: 1,
      chunks_created: 1,
      completed_at: "2026-05-23T00:00:00Z",
    });

    expect(db.getLibraryByName("svelte-docs")?.display_name).toBe(
      "Svelte Docs",
    );
    expect(
      db.getPage({ library: "svelte-docs", path: "/getting-started" })?.id,
    ).toBe(pageId);
    expect(db.listJobs("lib-1")[0]?.status).toBe("completed");

    db.removeLibrary("lib-1");

    expect(db.getLibraryById("lib-1")).toBeNull();
    expect(
      db.getPage({ url: "https://svelte.dev/docs/getting-started" }),
    ).toBeNull();
    expect(db.listJobs("lib-1")).toHaveLength(0);
  });
});

describe("LibraryService", () => {
  test("adds and renames libraries while starting a crawl job", async () => {
    const db = createTempDatabase();
    const started: string[] = [];
    const jobManager = {
      startCrawl(libraryId: string) {
        started.push(libraryId);
        return { id: "job-42" };
      },
    } as unknown as JobManager;

    const service = new LibraryService(db, jobManager);
    const library = await service.add({
      url: "https://orm.drizzle.team/docs/#intro",
      maxDepth: 4,
    });

    expect(library.name).toBe("orm-docs");
    expect(library.display_name).toBe("Orm Docs");
    expect(started).toEqual([library.id]);

    const renamed = service.rename({
      currentName: "orm-docs",
      newName: "drizzle-docs",
    });

    expect(renamed.name).toBe("drizzle-docs");
    expect(renamed.display_name).toBe("Drizzle Docs");
  });
});

describe("SearchEngine", () => {
  test("ranks API and getting-started pages for their matching intents", () => {
    const db = createTempDatabase();
    const search = new SearchEngine(db);

    db.addLibrary({
      id: "lib-1",
      name: "docshark",
      displayName: "DocShark",
      url: "https://docs.python.org/3/",
    });

    const gettingStartedPageId = db.upsertPage({
      id: "page-1",
      libraryId: "lib-1",
      url: "https://docs.python.org/3/tutorial/",
      path: "/docs/getting-started",
      title: "Getting Started",
      contentMarkdown:
        "# Getting Started\n\nInstall DocShark and crawl your first library.",
      contentHash: "hash-getting-started",
      headings: [{ level: 1, text: "Getting Started" }],
    });

    const apiPageId = db.upsertPage({
      id: "page-2",
      libraryId: "lib-1",
      url: "https://docs.python.org/3/library/",
      path: "/docs/api/search",
      title: "Search API",
      contentMarkdown:
        "# Search API\n\nUse search_docs to query indexed content.\n\n```ts\nawait client.search_docs()\n```",
      contentHash: "hash-search-api",
      headings: [{ level: 1, text: "Search API" }],
    });

    db.insertChunks([
      {
        id: "chunk-1",
        pageId: gettingStartedPageId,
        libraryId: "lib-1",
        content: "Install DocShark and add your first documentation library.",
        headingContext: "Getting Started",
        chunkIndex: 0,
        tokenCount: 80,
        hasCodeBlock: false,
      },
      {
        id: "chunk-2",
        pageId: apiPageId,
        libraryId: "lib-1",
        content:
          "The search_docs API returns ranked search results with code examples.",
        headingContext: "Search API",
        chunkIndex: 0,
        tokenCount: 100,
        hasCodeBlock: true,
      },
    ]);

    const apiResults = search.search("search api", {
      library: "docshark",
      limit: 2,
    });
    const gettingStartedResults = search.search("getting started", {
      library: "docshark",
      limit: 2,
    });

    expect(apiResults[0]?.page_path).toBe("/docs/api/search");
    expect(apiResults[0]?.reasons.length).toBeGreaterThan(0);
    expect(gettingStartedResults[0]?.page_path).toBe("/docs/getting-started");
  });
});
