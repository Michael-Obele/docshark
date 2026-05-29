/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { Database as BunDatabase } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "../src/storage/db.js";
import type { SearchEngine } from "../src/storage/search.js";
import type { JobManager } from "../src/jobs/manager.js";
import { LibraryService } from "../src/services/library.js";
import { createApiRouter } from "../src/api/router.js";
import { EventBus } from "../src/jobs/events.js";
import { createAddLibraryTool } from "../src/tools/add-library.js";
import { createGetDocPageTool } from "../src/tools/get-doc-page.js";
import { createRefreshLibraryTool } from "../src/tools/refresh-library.js";
import { createRemoveLibraryTool } from "../src/tools/remove-library.js";
import { createSearchDocsTool } from "../src/tools/search-docs.js";
import { SearchEngine as SearchEngineImpl } from "../src/storage/search.js";
import { VERSION } from "../src/version.js";

const tempDirs: string[] = [];
const openHandles: BunDatabase[] = [];

function createTempDatabase(): Database {
  const dataDir = mkdtempSync(join(tmpdir(), "docshark-api-"));
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

describe("EventBus", () => {
  test("registers, emits, and removes listeners", () => {
    const bus = new EventBus();
    let received = 0;
    const listener = (data: unknown) => {
      received += (data as { value: number }).value;
    };

    bus.on("crawl:progress", listener);
    bus.emit("crawl:progress", { value: 2 });
    bus.off("crawl:progress", listener);
    bus.emit("crawl:progress", { value: 2 });

    expect(received).toBe(2);
  });
});

describe("createApiRouter", () => {
  test("uses real storage for add, stats, search, and delete routes", async () => {
    const db = createTempDatabase();
    const started: string[] = [];
    const jobManager = {
      startCrawl(libraryId: string) {
        started.push(libraryId);
        return { id: `job-for-${libraryId}` };
      },
      listJobs() {
        return [];
      },
    } as unknown as JobManager;
    const libraryService = new LibraryService(db, jobManager);
    const searchEngine = new SearchEngineImpl(db);
    const router = createApiRouter({
      db,
      searchEngine,
      jobManager,
      libraryService,
      eventBus: new EventBus(),
    });

    const add = await router.handle(
      new Request("https://docs.python.org/api/libraries", {
        method: "POST",
        body: JSON.stringify({ url: "https://docs.python.org/3/tutorial/" }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(add.status).toBe(201);
    const added = (await add.json()) as {
      id: string;
      name: string;
      display_name: string;
      jobId: string;
    };
    expect(started).toEqual([added.id]);
    expect(added.jobId).toBe(`job-for-${added.id}`);

    const pageId = db.upsertPage({
      id: "page-1",
      libraryId: added.id,
      url: "https://docs.python.org/3/tutorial/install",
      path: "/docs/getting-started",
      title: "Getting Started",
      contentMarkdown:
        "# Getting Started\n\nInstall DocShark and crawl your first library.",
      contentHash: "hash-1",
      headings: [{ level: 1, text: "Getting Started" }],
    });
    db.insertChunks([
      {
        id: "chunk-1",
        pageId,
        libraryId: added.id,
        content: "Install DocShark and crawl your first library.",
        headingContext: "Getting Started",
        chunkIndex: 0,
        tokenCount: 80,
        hasCodeBlock: false,
      },
    ]);
    db.updateLibraryStats(added.id, 1, 1);

    const health = await router.handle(
      new Request("https://docs.python.org/api/health"),
    );
    const stats = await router.handle(
      new Request("https://docs.python.org/api/stats"),
    );
    const search = await router.handle(
      new Request(
        `https://docs.python.org/api/search?q=${encodeURIComponent("install first library")}&library=${added.name}&limit=1`,
      ),
    );
    const remove = await router.handle(
      new Request(`https://docs.python.org/api/libraries/${added.id}`, {
        method: "DELETE",
      }),
    );

    expect(await health.json()).toEqual({ status: "ok", version: VERSION });
    expect(await stats.json()).toEqual({ libraries: 1, pages: 1, chunks: 1 });
    expect((await search.json())[0].page_title).toBe("Getting Started");
    expect(await remove.json()).toEqual({ ok: true });
    expect(db.getLibraryById(added.id)).toBeNull();
  });

  test("returns 500 when library creation fails through the real service", async () => {
    const db = createTempDatabase();
    const jobManager = {
      startCrawl(libraryId: string) {
        return { id: `job-for-${libraryId}` };
      },
      listJobs() {
        return [];
      },
    } as unknown as JobManager;
    const router = createApiRouter({
      db,
      searchEngine: new SearchEngineImpl(db),
      jobManager,
      libraryService: new LibraryService(db, jobManager),
      eventBus: new EventBus(),
    });
    const request = new Request("https://docs.python.org/api/libraries", {
      method: "POST",
      body: JSON.stringify({ url: "https://docs.python.org/3/tutorial/" }),
      headers: { "content-type": "application/json" },
    });

    const originalConsoleError = console.error;
    const loggedErrors: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      loggedErrors.push(args);
    };

    const first = await router.handle(request.clone());
    const second = await router.handle(request.clone());

    console.error = originalConsoleError;

    expect(first.status).toBe(201);
    expect(second.status).toBe(500);
    expect(await second.json()).toEqual({
      error:
        'Library "docs-3-tutorial" already exists. Use manage_library with action=refresh to re-crawl.',
    });
    expect(loggedErrors[0]?.[0]).toBe("[DocShark API]");
    expect(db.listLibraries()).toHaveLength(1);
  });
});

describe("MCP tools", () => {
  test("returns miss-path responses and skips side effects when tool preconditions fail", async () => {
    let started = 0;
    let removed = 0;
    const addTool = createAddLibraryTool({
      async add() {
        throw new Error("duplicate library");
      },
    } as unknown as LibraryService);
    const searchTool = createSearchDocsTool({
      search() {
        return [];
      },
    } as unknown as SearchEngine);
    const pageTool = createGetDocPageTool({
      getPage() {
        return null;
      },
    } as unknown as Database);
    const refreshTool = createRefreshLibraryTool(
      {
        startCrawl() {
          started += 1;
          return { id: "job-99" };
        },
      } as unknown as JobManager,
      {
        getLibraryByName() {
          return null;
        },
      } as unknown as Database,
    );
    const removeTool = createRemoveLibraryTool({
      getLibraryByName() {
        return null;
      },
      removeLibrary() {
        removed += 1;
      },
    } as unknown as Database);

    const addResult = await addTool.handler({
      url: "https://docs.python.org/3/",
    });
    const searchResult = await searchTool.handler({
      query: "missing topic",
      limit: 1,
    });
    const pageResult = await pageTool.handler({
      url: "https://docs.python.org/3/tutorial/",
    });
    const refreshResult = await refreshTool.handler({ library: "missing-lib" });
    const removeResult = await removeTool.handler({ library: "missing-lib" });

    expect(addResult.content[0]?.text).toContain(
      "Failed to add library: duplicate library",
    );
    expect(searchResult.content[0]?.text).toBe(
      'No results found for "missing topic".',
    );
    expect(pageResult.content[0]?.text).toBe(
      "Page not found. Use search_docs to find the correct page.",
    );
    expect(refreshResult.content[0]?.text).toContain(
      'Library "missing-lib" not found',
    );
    expect(removeResult.content[0]?.text).toBe(
      'Library "missing-lib" not found.',
    );
    expect(started).toBe(0);
    expect(removed).toBe(0);
  });
});
