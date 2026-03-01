// src/jobs/worker.ts — Crawl execution pipeline
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type { Database } from '../storage/db.js';
import type { EventBus } from './events.js';
import { discoverPages } from '../scraper/discoverer.js';
import { fetchPage } from '../scraper/fetcher.js';
import { extractAndConvert } from '../processor/extractor.js';
import { chunkMarkdown } from '../processor/chunker.js';
import { RateLimiter } from '../scraper/rate-limiter.js';
import type { CrawlConfig } from '../types.js';

export class CrawlWorker {
    constructor(
        private db: Database,
        private eventBus: EventBus,
    ) { }

    async crawl(libraryId: string, jobId: string) {
        const lib = this.db.getLibraryById(libraryId);
        if (!lib) throw new Error(`Library ${libraryId} not found`);

        const config: CrawlConfig = lib.crawl_config ? JSON.parse(lib.crawl_config) : {};
        this.db.updateLibraryStatus(libraryId, 'crawling');
        this.db.updateJob(jobId, { status: 'running', started_at: new Date().toISOString() });

        const rateLimiter = new RateLimiter(config.rateLimit ?? 500);

        try {
            // Phase 1: Discover pages
            const urls = await discoverPages(lib.url, config);
            this.db.updateJob(jobId, { pages_discovered: urls.length });
            this.eventBus.emit('crawl:progress', {
                jobId,
                libraryId,
                phase: 'discovering',
                pagesDiscovered: urls.length,
            });

            console.log(`[DocShark] Discovered ${urls.length} pages for "${lib.display_name}"`);

            let crawled = 0;
            let failed = 0;
            let totalChunks = 0;

            // Phase 2-6: Fetch → Extract → Convert → Chunk → Index
            for (const url of urls) {
                try {
                    await rateLimiter.wait();

                    const result = await fetchPage(url, config.renderer);

                    // Extract content + convert to markdown
                    const { markdown, title, headings } = extractAndConvert(result.html, url);

                    if (!markdown || markdown.length < 50) {
                        crawled++;
                        continue; // Skip essentially empty pages
                    }

                    const contentHash = createHash('sha256').update(markdown).digest('hex');

                    // Store page
                    const pageId = nanoid();
                    const path = new URL(url).pathname;
                    this.db.upsertPage({
                        id: pageId,
                        libraryId,
                        url,
                        path,
                        title,
                        contentMarkdown: markdown,
                        contentHash,
                        headings,
                    });

                    // Delete old chunks for this page (for re-crawls)
                    this.db.deleteChunksByPage(pageId);

                    // Chunk and index
                    const chunks = chunkMarkdown(markdown, headings);
                    if (chunks.length > 0) {
                        const chunkRecords = chunks.map((c, i) => ({
                            id: nanoid(),
                            pageId,
                            libraryId,
                            content: c.content,
                            headingContext: c.headingContext,
                            chunkIndex: i,
                            tokenCount: c.tokenCount,
                            hasCodeBlock: c.hasCodeBlock,
                        }));

                        this.db.insertChunks(chunkRecords);
                        totalChunks += chunkRecords.length;
                    }

                    crawled++;

                    // Emit progress
                    this.eventBus.emit('crawl:progress', {
                        jobId,
                        libraryId,
                        phase: 'crawling',
                        pagesCrawled: crawled,
                        pagesDiscovered: urls.length,
                        currentUrl: url,
                    });

                    // Log progress every 10 pages
                    if (crawled % 10 === 0) {
                        console.log(
                            `[DocShark] Progress: ${crawled}/${urls.length} pages (${totalChunks} chunks)`,
                        );
                    }
                } catch (err) {
                    failed++;
                    console.error(`[DocShark] Failed to crawl ${url}:`, (err as Error).message);
                }
            }

            // Update final stats
            this.db.updateLibraryStats(libraryId, crawled, totalChunks);
            this.db.updateLibraryStatus(libraryId, 'indexed');
            this.db.updateJob(jobId, {
                status: 'completed',
                pages_crawled: crawled,
                pages_failed: failed,
                chunks_created: totalChunks,
                completed_at: new Date().toISOString(),
            });

            this.eventBus.emit('crawl:complete', { jobId, libraryId, crawled, failed, totalChunks });
            console.log(
                `[DocShark] ✅ Crawl complete: ${crawled} pages, ${totalChunks} chunks, ${failed} failed`,
            );
        } catch (err: any) {
            this.db.updateLibraryStatus(libraryId, 'error');
            this.db.updateJob(jobId, { status: 'failed', error_message: err.message });
            this.eventBus.emit('crawl:error', { jobId, libraryId, error: err.message });
            console.error(`[DocShark] ❌ Crawl failed for "${lib.display_name}":`, err.message);
        }
    }
}
