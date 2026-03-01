---
title: "DocShark — MCP Tools Specification"
status: draft
---

# MCP Tools Specification

Detailed definitions for all 6 MCP tools that DocShark exposes. Following the [Six-Tool Pattern](https://www.mcpbundles.com/blog/mcp-tool-design-pattern) and [MCP best practices](https://www.philschmid.de/mcp-best-practices).

← Back to [Plan Index](./index.md)

---

## Design Principles

1. **Tools are a UI for agents** — not a REST API wrapper. Design for how an LLM thinks.
2. **Descriptions are everything** — the LLM reads the description to decide when to use a tool.
3. **Return pre-processed, concise results** — don't dump raw data. Format for LLM consumption.
4. **6 tools max** — avoids context rot. Each tool has a clear, non-overlapping purpose.
5. **snake_case naming** — MCP convention.
6. **Idempotent reads** — search and list operations are safe to retry.

## Tool Workflow

```
Agent needs info about a library
         │
         ▼
  ┌──────────────┐
  │ list_libraries│ ← "What docs are indexed?"
  └──────┬───────┘
         │ Library exists?
         ├── Yes ──────────────────────────┐
         │                                 ▼
         │                        ┌───────────────┐
         │                        │  search_docs   │ ← Primary tool (80% of usage)
         │                        └───────┬───────┘
         │                                │ Need full page?
         │                                ▼
         │                        ┌───────────────┐
         │                        │  get_doc_page  │ ← Deep read
         │                        └───────────────┘
         │
         └── No ───────────────────────────┐
                                           ▼
                                  ┌───────────────┐
                                  │  add_library   │ ← Triggers crawl
                                  └───────────────┘
                                           │
                                  ┌───────────────┐
                                  │refresh_library │ ← If docs outdated
                                  └───────────────┘
                                           │
                                  ┌───────────────┐
                                  │remove_library  │ ← Cleanup
                                  └───────────────┘
```

---

## Tool 1: `search_docs`

**Purpose:** The primary tool. Full-text search across all indexed documentation.

**When agents use it:** Whenever they need to find information about a library, API, framework feature, or code pattern.

```typescript
server.tool(
  {
    name: 'search_docs',
    description:
      'Search through indexed documentation libraries for relevant information. ' +
      'Returns ranked documentation sections with code examples and source URLs. ' +
      'Use this when you need to find information about a library, framework, API, ' +
      'or any technical concept. You can optionally filter by a specific library name.',
    schema: v.object({
      query: v.pipe(
        v.string(),
        v.description('The search query. Use natural language or specific terms.')
      ),
      library: v.optional(
        v.pipe(v.string(), v.description('Filter results to a specific library name.')),
      ),
      limit: v.optional(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1),
          v.maxValue(20),
          v.description('Max results to return. Default: 5.')
        ),
        5,
      ),
    }),
  },
  async ({ query, library, limit }) => {
    const results = await searchEngine.search(query, { library, limit });
    return tool.text(formatSearchResults(results));
  },
);
```

**Output format:**
```
## Results for "svelte transitions"

### 1. Transitions — Svelte 5 Documentation
**Source:** https://svelte.dev/docs/svelte/transition
**Section:** Built-in transitions > fade

Svelte provides several built-in transition functions:
- `fade` — fades the element in and out
- `fly` — flies the element in from a specified position
- `slide` — slides the element in and out

```svelte
<script>
  import { fade } from 'svelte/transition';
</script>

{#if visible}
  <div transition:fade>fades in and out</div>
{/if}
```

---

### 2. Custom transitions — Svelte 5 Documentation
**Source:** https://svelte.dev/docs/svelte/transition#Custom-transitions
**Section:** Transitions > Custom transitions

You can create custom transitions by defining a function...
```

---

## Tool 2: `list_libraries`

**Purpose:** Discovery tool. Shows what documentation is currently indexed and available.

```typescript
server.tool(
  {
    name: 'list_libraries',
    description:
      'List all documentation libraries currently indexed and available for searching. ' +
      'Use this to discover what documentation is available before running search_docs. ' +
      'Returns library names, URLs, page counts, and indexing status.',
    schema: v.object({
      status: v.optional(
        v.pipe(
          v.picklist(['indexed', 'crawling', 'error', 'all']),
          v.description('Filter by indexing status. Default: "all".')
        ),
        'all',
      ),
    }),
  },
  async ({ status }) => {
    const libraries = await storage.listLibraries(status);
    return tool.text(formatLibraryList(libraries));
  },
);
```

**Output format:**
```
## Indexed Libraries (4 total)

| Library     | URL                              | Pages | Chunks | Last Updated     | Status  |
| ----------- | -------------------------------- | ----- | ------ | ---------------- | ------- |
| svelte-5    | https://svelte.dev/docs          | 47    | 312    | 2026-02-28 14:30 | indexed |
| sveltekit   | https://svelte.dev/docs/kit      | 63    | 498    | 2026-02-28 14:35 | indexed |
| tailwind-v4 | https://tailwindcss.com/docs     | 89    | 654    | 2026-02-27 09:12 | indexed |
| better-auth | https://www.better-auth.com/docs | 34    | 201    | 2026-02-25 16:44 | indexed |
```

---

## Tool 3: `get_doc_page`

**Purpose:** Deep read. Retrieve the full markdown content of a specific documentation page when search snippets aren't enough.

```typescript
server.tool(
  {
    name: 'get_doc_page',
    description:
      'Retrieve the complete content of a specific documentation page as markdown. ' +
      'Use this when search results reference a page and you need the full context, ' +
      'or when you know the exact page URL. Returns the entire page content.',
    schema: v.object({
      url: v.optional(
        v.pipe(v.string(), v.url(), v.description('The full URL of the documentation page.')),
      ),
      library: v.optional(
        v.pipe(v.string(), v.description('Library name to search within.')),
      ),
      path: v.optional(
        v.pipe(
          v.string(),
          v.description('Relative path within the library (e.g., "/getting-started").')
        ),
      ),
    }),
  },
  async ({ url, library, path }) => {
    const page = await storage.getPage({ url, library, path });
    if (!page) return tool.text('Page not found.');
    return tool.text(
      `# ${page.title}\n**Source:** ${page.url}\n\n${page.content_markdown}`
    );
  },
);
```

---

## Tool 4: `add_library`

**Purpose:** Add a new documentation website to be crawled and indexed.

```typescript
server.tool(
  {
    name: 'add_library',
    description:
      'Add a new documentation library to be crawled and indexed for searching. ' +
      'Provide the documentation website URL and an optional name. ' +
      'The library will be crawled in the background. ' +
      'Use list_libraries to check crawl progress.',
    schema: v.object({
      url: v.pipe(
        v.string(),
        v.url(),
        v.description('The base URL of the documentation website to crawl.')
      ),
      name: v.optional(
        v.pipe(
          v.string(),
          v.description(
            'A short identifier for the library (e.g., "svelte-5"). Auto-generated from URL if omitted.'
          )
        ),
      ),
      version: v.optional(
        v.pipe(v.string(), v.description('Version string (e.g., "5.0.0", "v4").')),
      ),
      max_depth: v.optional(
        v.pipe(
          v.number(),
          v.integer(),
          v.minValue(1),
          v.maxValue(10),
          v.description('Maximum link depth to crawl. Default: 3.')
        ),
        3,
      ),
    }),
  },
  async ({ url, name, version, max_depth }) => {
    const library = await libraryService.addLibrary({ url, name, version, maxDepth: max_depth });
    const job = await jobManager.startCrawl(library.id);
    return tool.text(
      `✅ Library "${library.display_name}" added.\n` +
      `Crawl job ${job.id} started. Use list_libraries to check progress.`
    );
  },
);
```

---

## Tool 5: `refresh_library`

**Purpose:** Re-crawl an existing library to get the latest documentation.

```typescript
server.tool(
  {
    name: 'refresh_library',
    description:
      'Re-crawl and re-index an existing documentation library to get the latest content. ' +
      'Use this when documentation may have been updated since it was last indexed. ' +
      'Only re-fetches pages that have changed (via HTTP ETags/Last-Modified).',
    schema: v.object({
      library: v.pipe(
        v.string(),
        v.description('The library name to refresh (e.g., "svelte-5").')
      ),
    }),
  },
  async ({ library }) => {
    const lib = await storage.getLibraryByName(library);
    if (!lib) return tool.text(`Library "${library}" not found. Use list_libraries to see available.`);
    const job = await jobManager.startCrawl(lib.id, { incremental: true });
    return tool.text(
      `🔄 Refresh started for "${lib.display_name}".\n` +
      `Job ${job.id}: checking for updated pages...`
    );
  },
);
```

---

## Tool 6: `remove_library`

**Purpose:** Remove a documentation library and all its indexed content.

```typescript
server.tool(
  {
    name: 'remove_library',
    description:
      'Remove a documentation library and all its indexed content. ' +
      'This permanently deletes the library, its pages, and search index. ' +
      'Use list_libraries first to confirm the library name.',
    schema: v.object({
      library: v.pipe(
        v.string(),
        v.description('The library name to remove (e.g., "svelte-5").')
      ),
    }),
  },
  async ({ library }) => {
    const lib = await storage.getLibraryByName(library);
    if (!lib) return tool.text(`Library "${library}" not found.`);
    await storage.removeLibrary(lib.id);
    return tool.text(
      `🗑️ Library "${lib.display_name}" removed.\n` +
      `Deleted ${lib.page_count} pages and ${lib.chunk_count} search chunks.`
    );
  },
);
```

---

## MCP Resources (Bonus)

In addition to tools, DocShark exposes indexed documentation as MCP **Resources** using the `doc://` URI scheme. This allows MCP clients to directly read documentation content.

```
doc://svelte-5                       → Library overview
doc://svelte-5/getting-started       → Specific page
doc://svelte-5/transitions/fade      → Specific section
```

## Tool Naming Best Practices Applied

| Practice                 | How DocShark follows it                     |
| ------------------------ | ------------------------------------------- |
| Use `snake_case`         | ✅ `search_docs`, `list_libraries`, etc.     |
| Action-oriented verbs    | ✅ search, list, get, add, refresh, remove   |
| Descriptive descriptions | ✅ Each tool explains when AND how to use it |
| Concise output           | ✅ Pre-formatted markdown, not raw JSON      |
| Non-overlapping          | ✅ Each tool has one clear purpose           |
| ≤ 6 tools                | ✅ Exactly 6                                 |

← Back to [Plan Index](./index.md)
