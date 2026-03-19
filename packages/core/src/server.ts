// src/server.ts — TMCP McpServer setup + tool registration
import { McpServer } from "tmcp";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import * as v from "valibot";
import { tool } from "tmcp/utils";
import { Database } from "./storage/db.js";
import { SearchEngine } from "./storage/search.js";
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
      "Search through indexed documentation libraries for relevant information. " +
      "Returns ranked documentation sections with code examples and source URLs. " +
      "Use this when you need to find information about a library, framework, API, " +
      "or any technical concept.",
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
    const results = searchEngine.search(query, { library, limit });
    if (results.length === 0)
      return tool.text(`No results found for "${query}".`);

    const formatted = results
      .map((r, i) => {
        let block = `### ${i + 1}. ${r.page_title} — ${r.library_display_name}\n`;
        block += `**Source:** ${r.page_url}\n`;
        block += `**Section:** ${r.heading_context}\n\n`;
        block += r.content;
        return block;
      })
      .join("\n\n---\n\n");

    return tool.text(`## Results for "${query}"\n\n${formatted}`);
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
// Tool 2: list_libraries — Discovery tool
// ──────────────────────────────────────
server.tool(
  {
    name: "list_libraries",
    description:
      "List all documentation libraries currently indexed and available for searching. " +
      "Use this to discover what docs are available before running search_docs.",
    schema: v.object({
      status: v.optional(
        v.pipe(
          v.picklist(["indexed", "crawling", "error", "all"]),
          v.description('Filter by status. Default: "all".'),
        ),
        "all",
      ),
    }),
  },
  async ({ status }) => {
    const libraries = db.listLibraries(status);
    if (libraries.length === 0) {
      return tool.text(
        "No libraries indexed yet. Use manage_library with action=add to add a documentation website.",
      );
    }

    let output = `## Indexed Libraries (${libraries.length} total)\n\n`;
    output += "| Library | URL | Pages | Chunks | Status |\n";
    output += "| ------- | --- | ----- | ------ | ------ |\n";
    for (const lib of libraries) {
      output += `| ${lib.name} | ${lib.url} | ${lib.page_count} | ${lib.chunk_count} | ${lib.status} |\n`;
    }
    return tool.text(output);
  },
);

// ──────────────────────────────────────
// Tool 3: get_doc_page — Full page read
// ──────────────────────────────────────
server.tool(
  {
    name: "get_doc_page",
    description:
      "Retrieve the complete content of a specific documentation page as markdown. " +
      "Use when search results reference a page and you need full context.",
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
    const page = db.getPage({ url, library, path });
    if (!page)
      return tool.text(
        "Page not found. Use search_docs to find the correct page.",
      );
    return tool.text(
      `# ${page.title}\n**Source:** ${page.url}\n\n${page.content_markdown}`,
    );
  },
);

// ──────────────────────────────────────
// Tool 4: manage_library — Create, rename, refresh, remove, inspect
// ──────────────────────────────────────
server.tool(
  {
    name: "manage_library",
    description:
      "Manage a documentation library lifecycle. Use action=add to crawl a new source, action=rename to change the library name, action=refresh to re-crawl, action=remove to delete it, or action=info to inspect its pages and stats.",
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
              `Library "${libraryName}" not found. Use list_libraries to see available.`,
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
          if (!lib) return tool.text(`Library "${libraryName}" not found.`);

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
              `Library "${libraryName}" not found. Use list_libraries to see available libraries.`,
            );

          return tool.text(formatLibraryInfo(lib.id));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return tool.text(`❌ Failed: ${message}`);
    }

    return tool.text(`❌ Failed: Unsupported action.`);
  },
);
