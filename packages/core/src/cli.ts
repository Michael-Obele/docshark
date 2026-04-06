#!/usr/bin/env bun
// src/cli.ts — DocShark CLI entry point
import { cac } from "cac";
import { startHttpServer } from "./http.js";
import { StdioTransport } from "@tmcp/transport-stdio";
import { server, db, searchEngine, libraryService } from "./server.js";
import { maybeNotifyAboutUpdate, runUpdateCommand } from "./cli-update.js";
import { formatSearchResults } from "./search/format-results.js";
import { VERSION } from "./version.js";

const useColor = process.stdout.isTTY;

const color = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

const cli = cac("docshark");

cli
  .command("", "Start the MCP server")
  .alias("start")
  .alias("s")
  .option("-p, --port <port>", "HTTP server port", { default: "6380" })
  .option("-S, --stdio", "Run in STDIO mode (for Claude Desktop, Cursor, etc.)")
  .option("-D, --data-dir <path>", "Data directory")
  .action(async (opts) => {
    await maybeNotifyForCommand("start", opts.stdio === true);

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

type HelpCommand = {
  name: string;
  aliases: string[];
  args: string;
  description: string;
};

const helpCommands: HelpCommand[] = [
  {
    name: "start",
    aliases: ["s", "-s"],
    args: "",
    description: "Start server",
  },
  {
    name: "add",
    aliases: ["a", "-a"],
    args: "<url>",
    description: "Add & crawl library",
  },
  {
    name: "search",
    aliases: ["f", "-f"],
    args: "<query>",
    description: "Search docs",
  },
  {
    name: "list",
    aliases: ["l", "-l"],
    args: "",
    description: "List libraries",
  },
  {
    name: "refresh",
    aliases: ["r", "-r"],
    args: "<name>",
    description: "Refresh library",
  },
  {
    name: "remove",
    aliases: ["rm", "-rm"],
    args: "<name>",
    description: "Remove library",
  },
  {
    name: "get",
    aliases: ["g", "-g"],
    args: "[url]",
    description: "Get page markdown",
  },
  {
    name: "update",
    aliases: ["u", "-u"],
    args: "",
    description: "Update DocShark",
  },
  {
    name: "info",
    aliases: ["i", "-i"],
    args: "<name>",
    description: "Library info + pages",
  },
];

cli
  .command("add <url>", "Add a documentation library and start crawling")
  .alias("a")
  .option(
    "-n, --name <name>",
    "Library name (auto-generated from URL if omitted)",
  )
  .option("-d, --depth <n>", "Max crawl depth", { default: "3" })
  .option("-V, --lib-version <version>", "Library version")
  .action(async (url, opts) => {
    await maybeNotifyForCommand("add");

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

cli.command("help [command]", "Show help for a command").action((command) => {
  if (command) {
    printCommandHelp(command);
    return;
  }

  printRootHelp();
});

cli
  .command(
    "rename <current-name> <new-name>",
    "Rename an existing documentation library",
  )
  .alias("mv")
  .action(async (currentName, newName) => {
    await maybeNotifyForCommand("rename");

    db.init();
    try {
      const library = libraryService.rename({ currentName, newName });
      console.log(
        `\n✅ Renamed library to "${library.display_name}" (${library.name}).\n`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`\n❌ ${message}\n`);
      process.exit(1);
    }
  });

cli
  .command("search <query>", "Search indexed documentation")
  .alias("f")
  .option("-l, --library <name>", "Filter by library")
  .option("-m, --limit <n>", "Max results", { default: "5" })
  .action(async (query, opts) => {
    await maybeNotifyForCommand("search");

    db.init();
    const results = searchEngine.search(query, {
      library: opts.library,
      limit: parseInt(opts.limit),
    });

    if (results.length === 0) {
      console.log(`\nNo results found for "${query}".\n`);
      return;
    }

    console.log(`\n${formatSearchResults(query, results)}\n`);
  });

cli
  .command("list", "List indexed libraries")
  .alias("l")
  .option(
    "-s, --status <status>",
    "Filter by status (indexed, crawling, error, all)",
    { default: "all" },
  )
  .action(async (opts) => {
    await maybeNotifyForCommand("list");

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

cli
  .command("refresh <name>", "Refresh an existing documentation library")
  .alias("r")
  .action(async (name) => {
    await maybeNotifyForCommand("refresh");

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

cli
  .command("remove <name>", "Remove a documentation library and its index")
  .alias("rm")
  .action(async (name) => {
    await maybeNotifyForCommand("remove");

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

cli
  .command(
    "get [url]",
    "Get the full markdown content of a specific indexed page",
  )
  .alias("g")
  .option("-l, --library <name>", "Library name to search within")
  .option("-p, --path <path>", "Relative path within the library")
  .action(async (url, opts) => {
    await maybeNotifyForCommand("get");

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

cli
  .command("update", "Update the global Bun installation of DocShark")
  .alias("u")
  .option(
    "-c, --check",
    "Only check whether a newer DocShark version is available",
  )
  .option(
    "-q, --quiet",
    "Suppress DocShark status output and rely on exit codes",
  )
  .action(async (opts) => {
    await maybeNotifyForCommand("update");

    await runUpdateCommand({
      checkOnly: opts.check,
      quiet: opts.quiet,
    });
  });

// Intercept manual short flags (e.g., -l instead of l) so they act as command aliases
const args = process.argv.slice(2);
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
const normalizedArgs = [...args];
if (normalizedArgs[0] && cmdAliases[normalizedArgs[0]]) {
  normalizedArgs[0] = cmdAliases[normalizedArgs[0]];
}

const helpRequest = getHelpRequest(normalizedArgs);
if (helpRequest === "root") {
  printRootHelp();
  process.exit(0);
}

if (helpRequest && helpRequest !== "root") {
  printCommandHelp(helpRequest);
  process.exit(0);
}

if (normalizedArgs.includes("-v") || normalizedArgs.includes("--version")) {
  printVersion();
  process.exit(0);
}

const parseArgv = [process.argv[0], process.argv[1], ...normalizedArgs];

cli
  .command("info <name>", "Get information about a library and list its pages")
  .alias("i")
  .action(async (name) => {
    await maybeNotifyForCommand("info");

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

try {
  cli.parse(parseArgv, { run: false });
  await cli.runMatchedCommand();
} catch (error) {
  handleCliError(error);
}

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

async function maybeNotifyForCommand(
  commandName: string,
  stdioMode = false,
): Promise<void> {
  await maybeNotifyAboutUpdate({ commandName, stdioMode });
}

function getHelpRequest(args: string[]): string | "root" | null {
  if (args.length === 0) {
    return null;
  }

  if (args[0] === "-h" || args[0] === "--help") {
    return "root";
  }

  if (args[0] === "help") {
    return args[1] ? normalizeCommandName(args[1]) : "root";
  }

  if (args[1] === "help") {
    return normalizeCommandName(args[0]);
  }

  if (args.includes("-h") || args.includes("--help")) {
    return normalizeCommandName(args[0]);
  }

  return null;
}

function normalizeCommandName(name: string): string {
  return cmdAliases[name] ?? name;
}

function printVersion(): void {
  console.log(`${paint("DocShark", color.cyan)} ${VERSION}`);
}

function printRootHelp(): void {
  printHeader();
  console.log(`${paint("USAGE", color.gray)}`);
  console.log(`  docshark [options] [command]\n`);

  console.log(`${paint("OPTIONS", color.gray)}`);
  console.log(
    `  ${paint("-v, --version", color.cyan).padEnd(18)} Show version`,
  );
  console.log(
    `  ${paint("-h, --help", color.cyan).padEnd(18)} Show this help\n`,
  );

  console.log(`${paint("COMMANDS", color.gray)}`);
  const rows = helpCommands.map((command) => ({
    primary: [
      command.name,
      ...command.aliases.filter((alias) => !alias.startsWith("-")),
    ].join(", "),
    shortAliases: command.aliases.filter((alias) => alias.startsWith("-")),
    args: command.args,
    description: command.description,
  }));

  const primaryWidth = Math.max(...rows.map((row) => row.primary.length));
  const argsWidth = Math.max(...rows.map((row) => row.args.length));

  for (const row of rows) {
    const aliasSuffix =
      row.shortAliases.length > 0
        ? `  [aliases: ${row.shortAliases.join(", ")}]`
        : "";
    const label =
      `${row.primary.padEnd(primaryWidth)}${row.args ? ` ${row.args.padEnd(argsWidth)}` : `${"".padEnd(argsWidth + 1)}`}${aliasSuffix}`.trimEnd();
    console.log(`  ${paint(label.padEnd(36), color.cyan)} ${row.description}`);
  }

  console.log(
    `\n${paint("Run `docshark help <command>` for more information.", color.dim)}`,
  );
}

function printCommandHelp(commandName: string): void {
  const command = helpCommands.find(
    (item) => item.name === normalizeCommandName(commandName),
  );

  printHeader();

  if (!command) {
    console.log(`${paint(`Unknown command: ${commandName}`, color.cyan)}\n`);
    printRootHelp();
    return;
  }

  console.log(`${paint("USAGE", color.gray)}`);
  console.log(
    `  docshark ${command.name} ${command.args ? paint(command.args, color.yellow) : ""}`.trimEnd(),
  );
  console.log(``);

  console.log(`${paint("ALIASES", color.gray)}`);
  console.log(`  ${command.aliases.join(", ")}\n`);

  console.log(`${paint("SUMMARY", color.gray)}`);
  console.log(`  ${command.description}\n`);

  console.log(
    `${paint("Run `docshark help` to see all commands.", color.dim)}`,
  );
}

function printHeader(): void {
  console.log();
  console.log(
    `${paint("🦈 DocShark", color.cyan)}  ${paint("Documentation MCP Server", color.bold)}`,
  );
  console.log(
    `   ${paint("Scrape • Index • Search any docs site", color.dim)}\n`,
  );
}

function paint(text: string, code: string): string {
  if (!useColor) {
    return text;
  }

  return `${code}${text}${color.reset}`;
}

function handleCliError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : "Unknown command error";
  const prettyMessage = message.startsWith("Unused args:")
    ? "Too many arguments passed. Run `docshark help <command>` for usage."
    : message;

  console.error(`\n❌ ${prettyMessage}\n`);
  process.exit(1);
}
