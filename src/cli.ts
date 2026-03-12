#!/usr/bin/env bun
// src/cli.ts — DocShark CLI entry point
import { Command } from "commander";
import { startHttpServer } from "./http.js";
import { StdioTransport } from "@tmcp/transport-stdio";
import { server, db, searchEngine, libraryService } from "./server.js";
import { maybeNotifyAboutUpdate, runUpdateCommand } from "./cli-update.js";
import { VERSION } from "./version.js";

const program = new Command()
  .name("docshark")
  .description(
    "🦈 Documentation MCP Server — scrape, index, and search any doc website",
  )
  .version(VERSION, "-v, --version", "output the current version");

program
  .command("start", { isDefault: true })
  .alias("s")
  .description("Start the MCP server (aliases: s, -s)")
  .option("-p, --port <port>", "HTTP server port", "6380")
  .option("-S, --stdio", "Run in STDIO mode (for Claude Desktop, Cursor, etc.)")
  .option("-D, --data-dir <path>", "Data directory", "")
  .action(async (opts) => {
    if (opts.dataDir) {
      process.env.DOCSHARK_DATA_DIR = opts.dataDir;
    }
    db.init();

    if (opts.stdio) {
      // STDIO mode — direct pipe, no HTTP
      const stdio = new StdioTransport(server);
      stdio.listen();
    } else {
      await startHttpServer(parseInt(opts.port));
    }
  });

program
  .command("add <url>")
  .alias("a")
  .description(
    "Add a documentation library and start crawling (aliases: a, -a)",
  )
  .option(
    "-n, --name <name>",
    "Library name (auto-generated from URL if omitted)",
  )
  .option("-d, --depth <n>", "Max crawl depth", "3")
  .option("-V, --lib-version <version>", "Library version")
  .action(async (url, opts) => {
    db.init();
    try {
      const lib = await libraryService.add({
        url,
        name: opts.name,
        version: opts.libVersion,
        maxDepth: parseInt(opts.depth),
      });
      console.log(`\n✅ Added "${lib.display_name}" — crawling ${lib.url}...`);
      console.log(`   Job ID: ${lib.jobId}`);
      console.log(`   Use "docshark list" to check progress.\n`);

      // Wait for the crawl to finish
      await waitForCrawl(lib.jobId);
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
      process.exit(1);
    }
  });

program
  .command("search <query>")
  .alias("f")
  .description("Search indexed documentation (aliases: f, -f)")
  .option("-l, --library <name>", "Filter by library")
  .option("-m, --limit <n>", "Max results", "5")
  .action(async (query, opts) => {
    db.init();
    const results = searchEngine.search(query, {
      library: opts.library,
      limit: parseInt(opts.limit),
    });

    if (results.length === 0) {
      console.log(`\nNo results found for "${query}".\n`);
      return;
    }

    for (const r of results) {
      console.log(`\n--- ${r.page_title} (${r.library_display_name}) ---`);
      console.log(`Section: ${r.heading_context}`);
      console.log(r.content.slice(0, 300));
      console.log(`Source: ${r.page_url}\n`);
    }
  });

program
  .command("list")
  .alias("l")
  .description("List indexed libraries (aliases: l, -l)")
  .option(
    "-s, --status <status>",
    "Filter by status (indexed, crawling, error, all)",
    "all",
  )
  .action((opts) => {
    db.init();
    const libs = db.listLibraries(opts.status);

    if (libs.length === 0) {
      console.log(
        '\nNo libraries indexed. Use "docshark add <url>" to add one.\n',
      );
      return;
    }

    console.table(
      libs.map((l) => ({
        Name: l.name,
        URL: l.url,
        Pages: l.page_count,
        Chunks: l.chunk_count,
        Status: l.status,
        "Last Crawled": l.last_crawled_at || "never",
      })),
    );
  });

program
  .command("refresh <name>")
  .alias("r")
  .description("Refresh an existing documentation library (aliases: r, -r)")
  .action(async (name) => {
    db.init();
    try {
      const lib = db.getLibraryByName(name);
      if (!lib) throw new Error(`Library "${name}" not found.`);
      const { jobManager } = await import("./server.js");
      const job = jobManager.startCrawl(lib.id, { incremental: true });

      console.log(
        `\n🔄 Refreshing "${lib.display_name}" — crawling ${lib.url}...`,
      );
      console.log(`   Job ID: ${job.id}`);
      await waitForCrawl(job.id);
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
      process.exit(1);
    }
  });

program
  .command("remove <name>")
  .alias("rm")
  .description(
    "Remove a documentation library and its index (aliases: rm, -rm)",
  )
  .action((name) => {
    db.init();
    try {
      const lib = db.getLibraryByName(name);
      if (!lib) throw new Error(`Library "${name}" not found.`);
      db.removeLibrary(lib.id);
      console.log(
        `\n🗑️ Removed library "${lib.display_name}". Deleted ${lib.page_count} pages.\n`,
      );
    } catch (err: any) {
      console.error(`\n❌ ${err.message}\n`);
      process.exit(1);
    }
  });

program
  .command("get [url]")
  .alias("g")
  .description(
    "Get the full markdown content of a specific indexed page (aliases: g, -g)",
  )
  .option("-l, --library <name>", "Library name to search within")
  .option("-p, --path <path>", "Relative path within the library")
  .action((url, opts) => {
    if (!url && (!opts.library || !opts.path)) {
      console.error(
        `\n❌ Please provide either a URL, or both --library and --path\n`,
      );
      process.exit(1);
    }
    db.init();
    const page = db.getPage({ url, library: opts.library, path: opts.path });
    if (!page) {
      console.error(`\n❌ Page not found in index.\n`);
      process.exit(1);
    }
    console.log(`\n--- ${page.title} ---`);
    console.log(`Source: ${page.url}\n\n`);
    console.log(page.content_markdown);
    console.log("\n");
  });

program
  .command("update")
  .alias("u")
  .description(
    "Update the global Bun installation of DocShark (aliases: u, -u)",
  )
  .option(
    "-c, --check",
    "Only check whether a newer DocShark version is available",
  )
  .option(
    "-q, --quiet",
    "Suppress DocShark status output and rely on exit codes",
  )
  .action(async (opts) => {
    await runUpdateCommand({
      checkOnly: opts.check,
      quiet: opts.quiet,
    });
  });

// Intercept manual short flags (e.g., -l instead of l) so they act as command aliases
const args = process.argv;
const cmdAliases: Record<string, string> = {
  "-s": "start",
  "-a": "add",
  "-f": "search",
  "-l": "list",
  "-r": "refresh",
  "-rm": "remove",
  "-g": "get",
  "-i": "info",
  "-u": "update",
};
if (args[2] && cmdAliases[args[2]]) {
  args[2] = cmdAliases[args[2]];
}

program
  .command("info <name>")
  .alias("i")
  .description(
    "Get information about a library and list its pages (aliases: i, -i)",
  )
  .action((name) => {
    db.init();
    const lib = db.getLibraryByName(name);
    if (!lib) {
      console.error(`\n❌ Library not found: ${name}\n`);
      process.exit(1);
    }
    console.log(`\n--- Library: ${lib.display_name} (${lib.name}) ---`);
    console.log(`URL: ${lib.url}`);
    console.log(`Status: ${lib.status}`);
    console.log(`Pages: ${lib.page_count}`);
    console.log(`Chunks: ${lib.chunk_count}`);
    console.log(`Last Crawled: ${lib.last_crawled_at || "never"}`);

    const pages = db.getPagesByLibrary(lib.id);
    if (pages.length > 0) {
      console.log(`\n--- Pages (${pages.length}) ---`);
      console.table(
        pages.map((p) => ({
          Title: p.title || "Untitled",
          Path: p.path,
          URL: p.url,
        })),
      );
    } else {
      console.log(`\nNo pages found for this library.\n`);
    }
  });

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const commandName = actionCommand.name();
  const options =
    typeof actionCommand.opts === "function"
      ? actionCommand.opts<{ stdio?: boolean }>()
      : {};

  await maybeNotifyAboutUpdate({
    commandName,
    stdioMode: commandName === "start" && options.stdio === true,
  });
});

await program.parseAsync(args);

/** Helper to wait for a crawl job to finish (CLI blocking mode) */
async function waitForCrawl(jobId: string): Promise<void> {
  const { jobManager } = await import("./server.js");

  return new Promise((resolve) => {
    const check = () => {
      const job = jobManager.getJob(jobId);
      if (!job || job.status === "completed" || job.status === "failed") {
        if (job?.status === "completed") {
          console.log(
            `\n🦈 Crawl complete: ${job.pages_crawled} pages, ${job.chunks_created} chunks indexed.`,
          );
          if (job.pages_failed > 0) {
            console.log(`   ⚠️  ${job.pages_failed} pages failed.`);
          }
        } else if (job?.status === "failed") {
          console.error(`\n❌ Crawl failed: ${job.error_message}`);
        }
        resolve();
        return;
      }
      setTimeout(check, 1000);
    };
    check();
  });
}
