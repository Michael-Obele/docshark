import { describe, expect, test } from "bun:test";
import type { Database } from "../src/storage/db.js";
import type { SearchEngine } from "../src/storage/search.js";
import type { JobManager } from "../src/jobs/manager.js";
import type { LibraryService } from "../src/services/library.js";
import { createApiRouter } from "../src/api/router.js";
import { EventBus } from "../src/jobs/events.js";
import { createAddLibraryTool } from "../src/tools/add-library.js";
import { createGetDocPageTool } from "../src/tools/get-doc-page.js";
import { createListLibrariesTool } from "../src/tools/list-libraries.js";
import { createRefreshLibraryTool } from "../src/tools/refresh-library.js";
import { createRemoveLibraryTool } from "../src/tools/remove-library.js";
import { createSearchDocsTool } from "../src/tools/search-docs.js";
import { VERSION } from "../src/version.js";

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
  test("serves health, stats, search, add, and refresh endpoints", async () => {
    const deps: Parameters<typeof createApiRouter>[0] = {
      db: {
        listLibraries(status?: string) {
          const libraries = [
            {
              id: "lib-1",
              name: "docshark",
              display_name: "DocShark",
              url: "https://docs.python.org/3/",
              version: null,
              description: null,
              status: status === "indexed" ? "indexed" : "indexed",
              page_count: 5,
              chunk_count: 12,
              crawl_config: null,
              last_crawled_at: null,
              created_at: "2026-05-23T00:00:00Z",
              updated_at: "2026-05-23T00:00:00Z",
            },
          ];
          return libraries;
        },
        removeLibrary() {},
      } as unknown as Database,
      searchEngine: {
        search(query: string) {
          return [
            {
              content: `result for ${query}`,
              heading_context: "Intro",
              page_url: "https://docs.python.org/3/tutorial/",
              page_path: "/docs/intro",
              page_title: "Intro",
              library_name: "docshark",
              library_display_name: "DocShark",
              lexical_score: -1,
              has_code_block: false,
              token_count: 50,
              chunk_index: 0,
              rerank_score: 0.88,
              reasons: ["exact title match"],
              path_type: "overview",
              version_tag: null,
            },
          ];
        },
      } as unknown as SearchEngine,
      jobManager: {
        startCrawl(libraryId: string) {
          return { id: `job-for-${libraryId}` };
        },
        listJobs() {
          return [];
        },
      } as unknown as JobManager,
      libraryService: {
        async add(body: { url: string }) {
          return {
            id: "lib-1",
            name: "docshark",
            display_name: "DocShark",
            url: body.url,
            version: null,
            description: null,
            status: "pending",
            page_count: 0,
            chunk_count: 0,
            crawl_config: null,
            last_crawled_at: null,
            created_at: "2026-05-23T00:00:00Z",
            updated_at: "2026-05-23T00:00:00Z",
            jobId: "job-1",
          };
        },
      } as unknown as LibraryService,
      eventBus: new EventBus(),
    };

    const router = createApiRouter(deps);
    const health = await router.handle(
      new Request("https://docs.python.org/api/health"),
    );
    const stats = await router.handle(
      new Request("https://docs.python.org/api/stats"),
    );
    const search = await router.handle(
      new Request("https://docs.python.org/api/search?q=docshark&limit=1"),
    );
    const add = await router.handle(
      new Request("https://docs.python.org/api/libraries", {
        method: "POST",
        body: JSON.stringify({ url: "https://docs.python.org/3/" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const refresh = await router.handle(
      new Request("https://docs.python.org/api/libraries/lib-1/refresh", {
        method: "POST",
      }),
    );

    expect(await health.json()).toEqual({ status: "ok", version: VERSION });
    expect(await stats.json()).toEqual({ libraries: 1, pages: 5, chunks: 12 });
    expect((await search.json())[0].page_title).toBe("Intro");
    expect(add.status).toBe(201);
    expect((await add.json()).jobId).toBe("job-1");
    expect(await refresh.json()).toEqual({ jobId: "job-for-lib-1" });
  });
});

describe("MCP tools", () => {
  test("returns helpful text for library management and search tools", async () => {
    const libraries = [
      {
        id: "lib-1",
        name: "docshark",
        display_name: "DocShark",
        url: "https://docs.python.org/3/",
        version: null,
        description: null,
        status: "indexed",
        page_count: 5,
        chunk_count: 12,
        crawl_config: null,
        last_crawled_at: null,
        created_at: "2026-05-23T00:00:00Z",
        updated_at: "2026-05-23T00:00:00Z",
      },
    ];

    const addTool = createAddLibraryTool({
      async add() {
        return { ...libraries[0], jobId: "job-1" };
      },
    } as unknown as LibraryService);
    const listTool = createListLibrariesTool({
      listLibraries() {
        return libraries;
      },
    } as unknown as Database);
    const searchTool = createSearchDocsTool({
      search() {
        return [
          {
            content: "Find docs quickly.",
            heading_context: "Overview",
            page_url: "https://docs.python.org/3/tutorial/",
            page_path: "/docs/overview",
            page_title: "Overview",
            library_name: "docshark",
            library_display_name: "DocShark",
            lexical_score: -1,
            has_code_block: false,
            token_count: 50,
            chunk_index: 0,
            rerank_score: 0.9,
            reasons: ["exact phrase match"],
            path_type: "overview",
            version_tag: null,
          },
        ];
      },
    } as unknown as SearchEngine);
    const pageTool = createGetDocPageTool({
      getPage() {
        return {
          id: "page-1",
          library_id: "lib-1",
          url: "https://docs.python.org/3/tutorial/",
          path: "/docs/overview",
          title: "Overview",
          content_markdown: "# Overview\n\nDocShark docs.",
          content_hash: null,
          headings: null,
          http_status: 200,
          last_modified: null,
          etag: null,
          created_at: "2026-05-23T00:00:00Z",
          updated_at: "2026-05-23T00:00:00Z",
        };
      },
    } as unknown as Database);
    const refreshTool = createRefreshLibraryTool(
      {
        startCrawl() {
          return { id: "job-99" };
        },
      } as unknown as JobManager,
      {
        getLibraryByName() {
          return libraries[0];
        },
      } as unknown as Database,
    );
    const removeTool = createRemoveLibraryTool({
      getLibraryByName() {
        return libraries[0];
      },
      removeLibrary() {},
    } as unknown as Database);

    const addResult = await addTool.handler({
      url: "https://docs.python.org/3/",
    });
    const listResult = await listTool.handler({ status: "all" });
    const searchResult = await searchTool.handler({
      query: "overview",
      limit: 1,
    });
    const pageResult = await pageTool.handler({
      url: "https://docs.python.org/3/tutorial/",
    });
    const refreshResult = await refreshTool.handler({ library: "docshark" });
    const removeResult = await removeTool.handler({ library: "docshark" });

    expect(addResult.content[0]?.text).toContain('Library "DocShark" added');
    expect(listResult.content[0]?.text).toContain("Indexed Libraries");
    expect(searchResult.content[0]?.text).toContain(
      '## Results for "overview"',
    );
    expect(pageResult.content[0]?.text).toContain("# Overview");
    expect(refreshResult.content[0]?.text).toContain(
      'Refresh started for "DocShark"',
    );
    expect(removeResult.content[0]?.text).toContain(
      'Library "DocShark" removed',
    );
  });
});
