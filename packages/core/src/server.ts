// src/server.ts — TMCP McpServer setup + tool registration
import { McpServer } from "tmcp";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import * as v from "valibot";
import { tool } from "tmcp/utils";
import { Database } from "./storage/db.js";
import { SearchEngine } from "./storage/search.js";
import {
  formatBatchSearchResults,
  formatSearchResults,
} from "./search/format-results.js";
import { LibraryService } from "./services/library.js";
import { JobManager } from "./jobs/manager.js";
import { VERSION } from "./version.js";
import { EventBus } from "./jobs/events.js";

// Initialize core services
export const db = new Database();
export const eventBus = new EventBus();
export const searchEngine = new SearchEngine(db);
export const jobManager = new JobManager(db, eventBus);
export const libraryService = new LibraryService(db, jobManager);

// Create TMCP server
export const server = new McpServer(
  {
    name: "docshark",
    version: VERSION,
    description:
      "🦈 Documentation MCP Server — scrape, index, and search any doc website",
  },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: {
      tools: { listChanged: true },
      resources: {},
    },
  },
);

// ──────────────────────────────────────
// Tool 1: search_docs — Primary search tool
// ──────────────────────────────────────
server.tool(
  {
    name: "search_docs",
    description:
      "Search indexed docs by keyword or library. Returns ranked sections with URLs.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    schema: v.object({
      query: v.pipe(
        v.string(),
        v.description("Search query. Use natural language."),
      ),
      library: v.optional(
        v.pipe(v.string(), v.description("Filter to a specific library.")),
      ),
      limit: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
        5,
      ),
    }),
  },
  async ({ query, library, limit }) => {
    try {
      const results = searchEngine.search(query, { library, limit });
      if (results.length === 0)
        return tool.text(`No results found for "${query}".`);

      return tool.text(formatSearchResults(query, results));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      return tool.text(`❌ Error: ${message}`);
    }
  },
);

server.tool(
  {
    name: "search_docs_batch",
    description:
      "Run multiple documentation searches in one call. Use this for repeated or decomposed lookups.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    schema: v.object({
      requests: v.pipe(
        v.array(
          v.object({
            query: v.pipe(
              v.string(),
              v.description("Search query. Use natural language."),
            ),
            library: v.optional(
              v.pipe(
                v.string(),
                v.description("Filter to a specific library."),
              ),
            ),
            limit: v.optional(
              v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)),
              5,
            ),
          }),
        ),
        v.minLength(1),
        v.maxLength(10),
      ),
    }),
  },
  async ({ requests }) => {
    try {
      const results = searchEngine.searchMany(requests);
      return tool.text(formatBatchSearchResults(results));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed";
      return tool.text(`❌ Error: ${message}`);
    }
  },
);

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }

  return value;
}

function formatLibraryInfo(libraryId: string): string {
  const lib = db.getLibraryById(libraryId);
  if (!lib) {
    return `Library not found.`;
  }

  const pages = db.getPagesByLibrary(lib.id);

  let output = `## Library: ${lib.display_name} (${lib.name})\n`;
  output += `- **URL:** ${lib.url}\n`;
  output += `- **Status:** ${lib.status}\n`;
  output += `- **Pages:** ${lib.page_count}\n`;
  output += `- **Chunks:** ${lib.chunk_count}\n`;
  output += `- **Last Crawled:** ${lib.last_crawled_at || "never"}\n\n`;

  if (pages.length > 0) {
    output += `### Pages (${pages.length})\n\n`;
    output += "| Title | Path | URL |\n";
    output += "| ----- | ---- | --- |\n";
    for (const p of pages) {
      const title = p.title?.replace(/\|/g, "-") || "Untitled";
      output += `| ${title} | \`${p.path}\` | ${p.url} |\n`;
    }
  } else {
    output += `*No pages indexed yet for this library.*\n`;
  }

  return output;
}

// ──────────────────────────────────────
// Tool 2: list_libraries — Discovery tool with pagination
// ──────────────────────────────────────
server.tool(
  {
    name: "list_libraries",
    description: "List indexed documentation libraries. Paginated results.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    schema: v.object({
      status: v.optional(
        v.pipe(
          v.picklist(["indexed", "crawling", "error", "all"]),
          v.description('Filter by status. Default: "all".'),
        ),
        "all",
      ),
      page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
      limit: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)),
        20,
      ),
    }),
  },
  async ({ status, page = 1, limit = 20 }) => {
    try {
      const libraries = db.listLibraries(status);
      if (libraries.length === 0) {
        return tool.text(
          "No libraries indexed yet. Use manage_library with action=add to add a documentation website.",
        );
      }

      // Paginate results
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginated = libraries.slice(start, end);
      const hasMore = end < libraries.length;

      // Minified response (no pretty-printing)
      let output = `## Libraries (${start + 1}-${Math.min(end, libraries.length)} of ${libraries.length})\n\n`;
      output += "| Library | URL | Pages | Chunks | Status |\n";
      output += "| ------- | --- | ----- | ------ | ------ |\n";
      for (const lib of paginated) {
        output += `|${lib.name}|${lib.url}|${lib.page_count}|${lib.chunk_count}|${lib.status}|\n`;
      }

      if (hasMore) {
        output += `\n**More available.** Use page=${page + 1} to fetch next page.`;
      }

      return tool.text(output);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to list libraries";
      return tool.text(`❌ Error: ${message}`);
    }
  },
);

// ──────────────────────────────────────
// Tool 3: get_doc_page — Full page read
// ──────────────────────────────────────
server.tool(
  {
    name: "get_doc_page",
    description: "Retrieve complete documentation page as markdown.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    schema: v.object({
      url: v.optional(
        v.pipe(
          v.string(),
          v.description("The full URL of the documentation page."),
        ),
      ),
      library: v.optional(
        v.pipe(v.string(), v.description("Library name to search within.")),
      ),
      path: v.optional(
        v.pipe(v.string(), v.description("Relative path within the library.")),
      ),
    }),
  },
  async ({ url, library, path }) => {
    try {
      const page = db.getPage({ url, library, path });
      if (!page)
        return tool.text(
          "Page not found. Use search_docs to find the correct page.",
        );
      return tool.text(
        `# ${page.title}\n**Source:** ${page.url}\n\n${page.content_markdown}`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch page";
      return tool.text(`❌ Error: ${message}`);
    }
  },
);

// ──────────────────────────────────────
// Tool 4: manage_library — Create, rename, refresh, remove, inspect
// ──────────────────────────────────────
server.tool(
  {
    name: "manage_library",
    description:
      "Manage library lifecycle: add/rename/refresh/remove/info. Destructive actions require confirmation.",
    annotations: {
      destructiveHint: true,
    },
    schema: v.object({
      action: v.pipe(
        v.picklist(["add", "rename", "refresh", "remove", "info"]),
        v.description("The management action to perform."),
      ),
      url: v.optional(
        v.pipe(
          v.string(),
          v.url(),
          v.description("Base URL of the documentation website."),
        ),
      ),
      name: v.optional(
        v.pipe(
          v.string(),
          v.description("Short identifier (auto-generated if omitted)."),
        ),
      ),
      version: v.optional(v.pipe(v.string(), v.description("Version string."))),
      max_depth: v.optional(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
        3,
      ),
      current_name: v.optional(
        v.pipe(
          v.string(),
          v.description("The current library name (for rename)."),
        ),
      ),
      new_name: v.optional(
        v.pipe(v.string(), v.description("The new library name (for rename).")),
      ),
      library: v.optional(
        v.pipe(v.string(), v.description("The library name to manage.")),
      ),
    }),
  },
  async (input) => {
    try {
      switch (input.action) {
        case "add": {
          const url = requireValue(
            input.url,
            "The URL is required for action=add.",
          );
          const library = await libraryService.add({
            url,
            name: input.name,
            version: input.version,
            maxDepth: input.max_depth,
          });

          return tool.text(
            `✅ Library "${library.display_name}" added.\n` +
              `Crawl job ${library.jobId} started. Use list_libraries to check progress.`,
          );
        }
        case "rename": {
          const currentName = requireValue(
            input.current_name,
            "current_name is required for action=rename.",
          );
          const newName = requireValue(
            input.new_name,
            "new_name is required for action=rename.",
          );
          const library = libraryService.rename({ currentName, newName });
          return tool.text(
            `✅ Library renamed to "${library.display_name}" (${library.name}).\n` +
              `Pages and crawl history remain attached to the same library.`,
          );
        }
        case "refresh": {
          const libraryName = requireValue(
            input.library,
            "library is required for action=refresh.",
          );
          const lib = db.getLibraryByName(libraryName);
          if (!lib)
            return tool.text(
              `❌ Library "${libraryName}" not found. Use list_libraries to see available.`,
            );

          const job = jobManager.startCrawl(lib.id, { incremental: true });
          return tool.text(
            `🔄 Refresh started for "${lib.display_name}".\nJob ${job.id}: checking for updated pages...`,
          );
        }
        case "remove": {
          const libraryName = requireValue(
            input.library,
            "library is required for action=remove.",
          );
          const lib = db.getLibraryByName(libraryName);
          if (!lib) return tool.text(`❌ Library "${libraryName}" not found.`);

          db.removeLibrary(lib.id);
          return tool.text(
            `🗑️ Library "${lib.display_name}" removed.\nDeleted ${lib.page_count} pages and ${lib.chunk_count} chunks.`,
          );
        }
        case "info": {
          const libraryName = requireValue(
            input.library,
            "library is required for action=info.",
          );
          const lib = db.getLibraryByName(libraryName);
          if (!lib)
            return tool.text(
              `❌ Library "${libraryName}" not found. Use list_libraries to see available libraries.`,
            );

          return tool.text(formatLibraryInfo(lib.id));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return tool.text(`❌ Error: ${message}`);
    }

    return tool.text(`❌ Error: Unsupported action.`);
  },
);
