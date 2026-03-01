#!/usr/bin/env node
// src/cli.ts — DocShark CLI entry point
import { Command } from 'commander';
import { startHttpServer } from './http.js';
import { StdioTransport } from '@tmcp/transport-stdio';
import { server, db, searchEngine, libraryService } from './server.js';
import { VERSION } from './version.js';

const program = new Command()
    .name('docshark')
    .description('🦈 Documentation MCP Server — scrape, index, and search any doc website')
    .version(VERSION);

program
    .command('start', { isDefault: true })
    .description('Start the MCP server')
    .option('-p, --port <port>', 'HTTP server port', '6380')
    .option('--stdio', 'Run in STDIO mode (for Claude Desktop, Cursor, etc.)')
    .option('--data-dir <path>', 'Data directory', '')
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
    .command('add <url>')
    .description('Add a documentation library and start crawling')
    .option('-n, --name <name>', 'Library name (auto-generated from URL if omitted)')
    .option('-d, --depth <n>', 'Max crawl depth', '3')
    .option('-v, --lib-version <version>', 'Library version')
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
    .command('search <query>')
    .description('Search indexed documentation')
    .option('-l, --library <name>', 'Filter by library')
    .option('--limit <n>', 'Max results', '5')
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
    .command('list')
    .description('List indexed libraries')
    .action(() => {
        db.init();
        const libs = db.listLibraries();

        if (libs.length === 0) {
            console.log('\nNo libraries indexed. Use "docshark add <url>" to add one.\n');
            return;
        }

        console.table(
            libs.map((l) => ({
                Name: l.name,
                URL: l.url,
                Pages: l.page_count,
                Chunks: l.chunk_count,
                Status: l.status,
                'Last Crawled': l.last_crawled_at || 'never',
            })),
        );
    });

program.parse();

/** Helper to wait for a crawl job to finish (CLI blocking mode) */
async function waitForCrawl(jobId: string): Promise<void> {
    const { jobManager } = await import('./server.js');

    return new Promise((resolve) => {
        const check = () => {
            const job = jobManager.getJob(jobId);
            if (!job || job.status === 'completed' || job.status === 'failed') {
                if (job?.status === 'completed') {
                    console.log(
                        `\n🦈 Crawl complete: ${job.pages_crawled} pages, ${job.chunks_created} chunks indexed.`,
                    );
                    if (job.pages_failed > 0) {
                        console.log(`   ⚠️  ${job.pages_failed} pages failed.`);
                    }
                } else if (job?.status === 'failed') {
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
