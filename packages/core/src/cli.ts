#!/usr/bin/env bun
// src/cli.ts — DocShark CLI entry point
import { cac } from "cac";
import { createInterface } from "node:readline/promises";
import * as v from "valibot";
import { startHttpServer } from "./http.js";
import { StdioTransport } from "@tmcp/transport-stdio";
import { server, db, searchEngine, libraryService } from "./server.js";
import { maybeNotifyAboutUpdate, runUpdateCommand } from "./cli-update.js";
import {
  formatBatchSearchResults,
  formatSearchResults,
} from "./search/format-results.js";
import {
  daysSinceCrawl,
  findStaleLibraries,
  formatStaleLibrary,
  getStaleDays,
  isStaleLibrary,
} from "./stale.js";
import {
  DEFAULT_ICON_STYLE,
  ICON_STYLE_VALUES,
  getIconStyle,
  icon,
  iconConfigPath,
  readIconStyleFromConfig,
  writeIconStyle,
} from "./icons.js";
import {
  displayWidth,
  fitMarkdown,
  renderTable,
  terminalWidth,
  truncate,
  wrap,
} from "./ui.js";
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

// Global flag: --icons <style> applies to this run only (applied in applyIconsFlag).
cli.option(
  "-I, --icons <style>",
  "Icon style for this run (emoji | nerd | plain | none)",
);

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
    name: "stale",
    aliases: ["outdated", "st", "-st", "-o"],
    args: "[--days <n>]",
    description: "Find stale libraries",
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
  {
    name: "icons",
    aliases: ["icon", "ic", "-ic"],
    args: "[style]",
    description: "Show/set icon style",
  },
  {
    name: "search-batch",
    aliases: ["batch", "sb", "-sb"],
    args: "[...queries]",
    description: "Search multiple queries",
  },
  {
    name: "rename",
    aliases: ["mv", "-mv"],
    args: "<current-name> <new-name>",
    description: "Rename library",
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
      console.log(
        `\n${wrap(
          `${icon("check")}Added "${lib.display_name}" — crawling ${lib.url}...`,
          terminalWidth(),
          "  ",
        )}`,
      );
      console.log(`   Job ID: ${lib.jobId}`);
      console.log(`   Use "docshark list" to check progress.\n`);

      // Wait for the crawl to finish
      await waitForCrawl(lib.jobId);
    } catch (err: any) {
      console.error(`\n${icon("cross")}${err.message}\n`);
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
        `\n${icon("check")}Renamed library to "${library.display_name}" (${library.name}).\n`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`\n${icon("cross")}${message}\n`);
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
      printStaleHint();
      return;
    }

    console.log(`\n${fitIfTty(formatSearchResults(query, results))}\n`);
    printStaleHint();
  });

cli
  .command("search-batch [...queries]", "Search multiple documentation queries")
  .alias("batch")
  .alias("sb")
  .option("-l, --library <name>", "Filter all queries by library")
  .option("-m, --limit <n>", "Max results per query", { default: "5" })
  .action(async (queries, opts) => {
    await maybeNotifyForCommand("search-batch");

    if (!Array.isArray(queries) || queries.length === 0) {
      console.error(`\n${icon("cross")}Please provide at least one query.\n`);
      process.exit(1);
    }

    db.init();
    const results = searchEngine.searchMany(
      queries.map((query) => ({
        query,
        library: opts.library,
        limit: parseInt(opts.limit),
      })),
    );

    console.log(`\n${fitIfTty(formatBatchSearchResults(results))}\n`);
  });

cli
  .command("list", "List indexed libraries")
  .alias("l")
  .option(
    "-s, --status <status>",
    "Filter by status (indexed, crawling, error, all)",
    { default: "all" },
  )
  .option(
    "--no-stale-check",
    "Skip the prompt to refresh libraries older than the freshness window",
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

    console.log(
      renderTable(
        [
          { header: "Name" },
          { header: "URL" },
          { header: "Pages", flex: false },
          { header: "Chunks", flex: false },
          { header: "Status", flex: false },
          { header: "Last Crawled", flex: false },
        ],
        libs.map((l) => [
          l.name,
          l.url,
          String(l.page_count),
          String(l.chunk_count),
          l.status,
          l.last_crawled_at || "never",
        ]),
      ),
    );

    await maybePromptStaleRefresh({
      disabled: opts.staleCheck === false,
    });
  });

cli
  .command(
    "stale",
    "List libraries not crawled recently (default: 14+ days) and offer to refresh them",
  )
  .alias("outdated")
  .alias("st")
  .option("-d, --days <n>", "Freshness window in days")
  .action(async (opts) => {
    await maybeNotifyForCommand("stale");

    db.init();

    if (isStaleCheckDisabled()) {
      console.log("\nStale check disabled via DOCSHARK_DISABLE_STALE_CHECK.\n");
      return;
    }

    const days = getStaleDays(
      opts.days !== undefined ? Number.parseInt(opts.days, 10) : undefined,
    );
    const count = await maybePromptStaleRefresh({ days });

    if (count === 0) {
      console.log(
        `\n${icon("check")}All libraries were crawled within the last ${days} days.\n`,
      );
    }
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
        `\n${wrap(
          `${icon("refresh")}Refreshing "${lib.display_name}" — crawling ${lib.url}...`,
          terminalWidth(),
          "  ",
        )}`,
      );
      console.log(`   Job ID: ${job.id}`);
      await waitForCrawl(job.id);
    } catch (err: any) {
      console.error(`\n${icon("cross")}${err.message}\n`);
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
        `\n${wrap(
          `${icon("trash")}Removed library "${lib.display_name}". Deleted ${lib.page_count} pages.`,
          terminalWidth(),
          "  ",
        )}\n`,
      );
    } catch (err: any) {
      console.error(`\n${icon("cross")}${err.message}\n`);
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
        `\n${icon("cross")}Please provide either a URL, or both --library and --path\n`,
      );
      process.exit(1);
    }
    db.init();
    const page = db.getPage({ url, library: opts.library, path: opts.path });
    if (!page) {
      console.error(`\n${icon("cross")}Page not found in index.\n`);
      process.exit(1);
    }
    console.log(wrap(`\n--- ${page.title} ---`, terminalWidth(), "  "));
    console.log(`${wrap(`Source: ${page.url}`, terminalWidth(), "  ")}\n`);
    console.log(fitIfTty(page.content_markdown ?? ""));
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

cli
  .command(
    "icons [style]",
    "Show or set the CLI icon style (emoji | nerd | plain | none)",
  )
  .alias("icon")
  .alias("ic")
  .action(async (style?: string) => {
    await maybeNotifyForCommand("icons");

    db.init();
    if (style === undefined) {
      const source = process.env.DOCSHARK_ICONS
        ? "DOCSHARK_ICONS env"
        : readIconStyleFromConfig() !== null
          ? `config ${iconConfigPath()}`
          : "built-in default";
      console.log(`\nIcon style: ${getIconStyle()} (${source})`);
      console.log(`Valid styles: ${ICON_STYLE_VALUES.join(" | ")}`);
      console.log(
        `Precedence: --icons > DOCSHARK_ICONS > config file > ${DEFAULT_ICON_STYLE}\n`,
      );
      return;
    }

    const parsed = v.safeParse(
      v.picklist([...ICON_STYLE_VALUES]),
      style.toLowerCase(),
    );
    if (!parsed.success) {
      console.error(
        `\n❌ Invalid icon style "${style}". Valid: ${ICON_STYLE_VALUES.join(" | ")}\n`,
      );
      process.exit(1);
    }

    writeIconStyle(parsed.output);
    console.log(
      `\n${icon("check")}Icon style set to "${parsed.output}" — saved to ${iconConfigPath()}`,
    );
    console.log(
      `   DOCSHARK_ICONS env and the --icons flag still override it.\n`,
    );
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
  "-st": "stale",
  "-o": "stale",
  "-ic": "icons",
  "-sb": "search-batch",
  "-mv": "rename",
  st: "stale",
  outdated: "stale",
  ic: "icons",
  icon: "icons",
  sb: "search-batch",
  batch: "search-batch",
  mv: "rename",
};
const normalizedArgs = [...args];
if (normalizedArgs[0] && cmdAliases[normalizedArgs[0]]) {
  normalizedArgs[0] = cmdAliases[normalizedArgs[0]];
}

// Apply --icons/-I before anything prints (help, version, commands).
applyIconsFlag(args);

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
      console.error(`\n${icon("cross")}Library not found: ${name}\n`);
      process.exit(1);
    }
    console.log(
      wrap(
        `\n--- Library: ${lib.display_name} (${lib.name}) ---`,
        terminalWidth(),
        "  ",
      ),
    );
    console.log(wrap(`URL: ${lib.url}`, terminalWidth(), "  "));
    console.log(`Status: ${lib.status}`);
    console.log(`Pages: ${lib.page_count}`);
    console.log(`Chunks: ${lib.chunk_count}`);
    console.log(`Last Crawled: ${lib.last_crawled_at || "never"}`);
    if (isStaleLibrary(lib)) {
      const age = daysSinceCrawl(lib.last_crawled_at);
      const warnPrefix = icon("warn");
      console.log(
        `${warnPrefix}${wrap(
          `Stale: not crawled in ${getStaleDays()}+ days${age !== null ? ` (${age}d ago)` : ""} — run "docshark refresh ${lib.name}".`,
          terminalWidth() - displayWidth(warnPrefix),
          " ".repeat(displayWidth(warnPrefix)),
        )}`,
      );
    }

    const pages = db.getPagesByLibrary(lib.id);
    if (pages.length > 0) {
      console.log(`\n--- Pages (${pages.length}) ---`);
      console.log(
        renderTable(
          [{ header: "Title" }, { header: "Path" }, { header: "URL" }],
          pages.map((p) => [p.title || "Untitled", p.path, p.url]),
        ),
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
            `\n${wrap(
              `${icon("shark")}Crawl complete: ${job.pages_crawled} pages, ${job.chunks_created} chunks indexed.`,
              terminalWidth(),
              "  ",
            )}`,
          );
          if (job.pages_failed > 0) {
            console.log(`   ${icon("warn")}${job.pages_failed} pages failed.`);
          }
        } else if (job?.status === "failed") {
          console.error(`\n${icon("cross")}Crawl failed: ${job.error_message}`);
        }
        resolve();
        return;
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

/** Whether the staleness feature is turned off via DOCSHARK_DISABLE_STALE_CHECK. */
function isStaleCheckDisabled(): boolean {
  const raw = process.env.DOCSHARK_DISABLE_STALE_CHECK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Apply a per-run `--icons <style>` / `-I <style>` flag (highest precedence). */
function applyIconsFlag(argv: string[]): void {
  const index = argv.findIndex((arg) => arg === "--icons" || arg === "-I");
  const inline = argv.find((arg) => arg.startsWith("--icons="));
  const raw =
    index !== -1
      ? argv[index + 1]
      : inline !== undefined
        ? inline.slice("--icons=".length)
        : undefined;
  if (raw === undefined) return;
  const parsed = v.safeParse(
    v.picklist([...ICON_STYLE_VALUES]),
    raw.toLowerCase(),
  );
  if (!parsed.success) {
    console.error(
      `\n❌ Invalid --icons value "${raw}". Valid: ${ICON_STYLE_VALUES.join(" | ")}\n`,
    );
    process.exit(1);
  }
  process.env.DOCSHARK_ICONS = parsed.output;
}

/** Fit markdown-ish output to the terminal width; pipes get the raw text. */
function fitIfTty(text: string): string {
  return process.stdout.isTTY ? fitMarkdown(text, terminalWidth()) : text;
}

/** Prompt for a single y/n answer (interactive terminals only). */
async function question(promptText: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question(promptText)).trim().toLowerCase();
  } finally {
    rl.close();
  }
}

/**
 * Detect libraries older than the freshness window (default 14 days), list
 * them on stderr, and — on interactive terminals — offer to refresh them all
 * at once. Never prompts when piped, in CI, or when disabled.
 *
 * @returns the number of stale libraries found.
 */
async function maybePromptStaleRefresh(opts: {
  days?: number;
  disabled?: boolean;
}): Promise<number> {
  if (opts.disabled || isStaleCheckDisabled()) {
    return 0;
  }

  const days = getStaleDays(opts.days);
  const stale = findStaleLibraries(db, days);
  if (stale.length === 0) {
    return 0;
  }

  const plural = stale.length === 1 ? "library has" : "libraries have";
  const warnPrefix = icon("warn");
  console.error(
    `\n${wrap(
      `${warnPrefix}${stale.length} ${plural} not been crawled in ${days}+ days:`,
      terminalWidth(),
      "  ",
    )}`,
  );
  for (const lib of stale) {
    console.error(truncate(`   • ${formatStaleLibrary(lib)}`, terminalWidth()));
  }

  const interactive =
    process.stdout.isTTY && process.stdin.isTTY && !process.env.CI;

  if (!interactive) {
    console.error(
      `\n${wrap(
        `   Run "docshark stale" in a terminal to be prompted, or refresh now with "docshark refresh <name>".`,
        terminalWidth(),
        "   ",
      )}\n`,
    );
    return stale.length;
  }

  const answer = await question(
    `   Refresh ${stale.length} stale ${stale.length === 1 ? "library" : "libraries"} now? [y/N] `,
  );
  if (answer !== "y" && answer !== "yes") {
    console.error(
      `${wrap(
        `   Skipped. Refresh later with "docshark refresh <name>".`,
        terminalWidth(),
        "   ",
      )}\n`,
    );
    return stale.length;
  }

  const { jobManager } = await import("./server.js");
  let refreshed = 0;
  for (const [index, lib] of stale.entries()) {
    if (jobManager.isRunning(lib.id)) {
      console.error(
        `\n${icon("skip")}${lib.display_name} is already being crawled — skipping.`,
      );
      continue;
    }
    const job = jobManager.startCrawl(lib.id, { incremental: true });
    refreshed += 1;
    console.error(
      `\n${icon("refresh")}Refreshing ${lib.display_name} (${index + 1}/${stale.length}) — job ${job.id}`,
    );
    await waitForCrawl(job.id);
  }

  console.error(
    `\n${icon("check")}Refreshed ${refreshed} ${refreshed === 1 ? "library" : "libraries"}.\n`,
  );
  return stale.length;
}

/** One-line reminder on interactive runs that some libraries are outside the freshness window. */
function printStaleHint(): void {
  if (!process.stdout.isTTY || isStaleCheckDisabled()) {
    return;
  }
  const stale = findStaleLibraries(db);
  if (stale.length === 0) {
    return;
  }
  const names = stale.map((lib) => lib.name).join(", ");
  const message = `${icon("warn")}${stale.length} ${stale.length === 1 ? "library is" : "libraries are"} older than ${getStaleDays()} days: ${names} — run "docshark stale" to review and refresh.`;
  console.error(
    paint(`${wrap(message, terminalWidth(), "  ")}\n`, color.yellow),
  );
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
  const optionFlagWidth = Math.min(
    22,
    Math.max(12, Math.floor(terminalWidth() * 0.5)),
  );
  for (const [flag, description] of [
    ["-v, --version", "Show version"],
    ["-h, --help", "Show this help"],
    ["-I, --icons <style>", "Icon style for this run"],
  ] as const) {
    console.log(
      `  ${paint(truncate(flag, optionFlagWidth).padEnd(optionFlagWidth), color.cyan)} ${truncate(description, Math.max(1, terminalWidth() - optionFlagWidth - 4))}`,
    );
  }
  console.log();

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

  const labelWidth = Math.max(
    ...rows.map(
      (row) => row.primary.length + (row.args ? 1 + row.args.length : 0),
    ),
  );
  const width = terminalWidth();

  for (const row of rows) {
    // Args hug the command name ("search, f <query>"); the gutter goes before
    // the description, never between a command and its own arguments.
    const minimalLabel = `${row.primary}${row.args ? ` ${row.args}` : ""}`;
    const paddedLabel = minimalLabel.padEnd(labelWidth);
    const aliasText =
      row.shortAliases.length > 0
        ? `[aliases: ${row.shortAliases.join(", ")}]`
        : "";
    const desc = row.description;

    const tryOneLine = (label: string): boolean => {
      const lw = displayWidth(label);
      const aw = aliasText ? displayWidth(`  ${aliasText}`) : 0;
      return 2 + lw + 2 + displayWidth(desc) + aw <= width;
    };
    const tryLabelDesc = (label: string): boolean =>
      2 + displayWidth(label) + 2 + displayWidth(desc) <= width;

    // 1) Padded label + desc + alias on one line (aligned, ideal)
    if (tryOneLine(paddedLabel)) {
      const aliasPart = aliasText ? `  ${aliasText}` : "";
      console.log(
        `  ${paint(paddedLabel, color.cyan)}  ${desc}${aliasPart ? paint(aliasPart, color.dim) : ""}`,
      );
      continue;
    }
    // 2) Minimal label + desc + alias on one line (saves padding space)
    if (tryOneLine(minimalLabel)) {
      const aliasPart = aliasText ? `  ${aliasText}` : "";
      console.log(
        `  ${paint(minimalLabel, color.cyan)}  ${desc}${aliasPart ? paint(aliasPart, color.dim) : ""}`,
      );
      continue;
    }
    // 3) Label + desc on one line, alias on next (never truncate alias)
    if (tryLabelDesc(paddedLabel)) {
      console.log(`  ${paint(paddedLabel, color.cyan)}  ${desc}`);
      if (aliasText) {
        console.log(
          `  ${" ".repeat(displayWidth(paddedLabel))}  ${paint(aliasText, color.dim)}`,
        );
      }
      continue;
    }
    if (tryLabelDesc(minimalLabel)) {
      console.log(`  ${paint(minimalLabel, color.cyan)}  ${desc}`);
      if (aliasText) {
        console.log(
          `  ${" ".repeat(displayWidth(minimalLabel))}  ${paint(aliasText, color.dim)}`,
        );
      }
      continue;
    }
    // 4) Very narrow — stack vertically, wrap desc, alias never truncated
    const labelForStack =
      displayWidth(minimalLabel) + 2 <= width
        ? minimalLabel
        : truncate(minimalLabel, Math.max(1, width - 2));
    console.log(`  ${paint(labelForStack, color.cyan)}`);
    const indent = "    ";
    const avail = Math.max(1, width - displayWidth(indent));
    const wrapped = wrap(desc, avail);
    for (const line of wrapped.split("\n")) {
      console.log(`${indent}${line}`);
    }
    if (aliasText) {
      const aliasAvail = Math.max(1, width - displayWidth(indent));
      const aliasLine =
        displayWidth(aliasText) <= aliasAvail
          ? aliasText
          : truncate(aliasText, aliasAvail);
      console.log(`${indent}${paint(aliasLine, color.dim)}`);
    }
  }

  console.log(
    `\n${paint(wrap("Run `docshark help <command>` for more information.", terminalWidth()), color.dim)}`,
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
    `${paint(wrap("Run `docshark help` to see all commands.", terminalWidth()), color.dim)}`,
  );
}

function printHeader(): void {
  console.log();
  const width = terminalWidth();
  const brand = `${icon("shark")}DocShark`;
  const subtitle = "Documentation MCP Server";
  if (displayWidth(brand) + 2 + displayWidth(subtitle) <= width) {
    console.log(`${paint(brand, color.cyan)}  ${paint(subtitle, color.bold)}`);
  } else {
    console.log(paint(truncate(brand, width), color.cyan));
    console.log(paint(truncate(subtitle, width), color.bold));
  }
  console.log(
    `${paint(wrap("   Scrape • Index • Search any docs site", width, "   "), color.dim)}\n`,
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

  console.error(`\n${icon("cross")}${prettyMessage}\n`);
  process.exit(1);
}
