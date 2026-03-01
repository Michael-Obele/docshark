// src/scraper/discoverer.ts — Page URL discovery via sitemap + link crawl
import * as cheerio from 'cheerio';
import { getRobotsParser, isAllowed } from './robots.js';
import { RateLimiter } from './rate-limiter.js';
import type { CrawlConfig } from '../types.js';

const USER_AGENT = 'DocShark/1.0';

/**
 * Discover all documentation page URLs from a base URL.
 * Strategy: sitemap.xml → link crawl fallback
 */
export async function discoverPages(
    baseUrl: string,
    config: CrawlConfig = {},
): Promise<string[]> {
    const maxDepth = config.maxDepth ?? 3;
    const robots = await getRobotsParser(baseUrl);

    // Strategy A: Try sitemap first
    const sitemapUrls = await discoverFromSitemap(baseUrl, robots);
    if (sitemapUrls.length > 0) {
        console.log(`[DocShark] Found ${sitemapUrls.length} URLs from sitemap`);
        return filterUrls(sitemapUrls, baseUrl, config, robots);
    }

    // Strategy B: BFS link crawl
    console.log(`[DocShark] No sitemap found, crawling links (depth=${maxDepth})`);
    const crawledUrls = await discoverByLinkCrawl(baseUrl, maxDepth, config, robots);
    return crawledUrls;
}

/** Parse sitemap.xml for page URLs */
async function discoverFromSitemap(
    baseUrl: string,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): Promise<string[]> {
    // Check for sitemap in robots.txt
    const sitemapUrl = robots?.getSitemaps()?.[0] || new URL('/sitemap.xml', baseUrl).href;

    try {
        const response = await fetch(sitemapUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) return [];

        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        const urls: string[] = [];

        // Handle sitemap index (sitemapindex > sitemap > loc)
        const sitemapLocs = $('sitemapindex > sitemap > loc');
        if (sitemapLocs.length > 0) {
            for (const el of sitemapLocs.toArray()) {
                const childSitemapUrl = $(el).text().trim();
                if (childSitemapUrl) {
                    const childUrls = await fetchSitemapUrls(childSitemapUrl);
                    urls.push(...childUrls);
                }
            }
        } else {
            // Regular sitemap (urlset > url > loc)
            $('urlset > url > loc').each((_, el) => {
                const loc = $(el).text().trim();
                if (loc) urls.push(loc);
            });
        }

        return urls;
    } catch {
        return [];
    }
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
    try {
        const response = await fetch(sitemapUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) return [];

        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const urls: string[] = [];

        $('urlset > url > loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) urls.push(loc);
        });

        return urls;
    } catch {
        return [];
    }
}

/** BFS link crawl from the base URL */
async function discoverByLinkCrawl(
    baseUrl: string,
    maxDepth: number,
    config: CrawlConfig,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): Promise<string[]> {
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];
    const rateLimiter = new RateLimiter(config.rateLimit ?? 500);
    const baseOrigin = new URL(baseUrl).origin;
    const basePath = new URL(baseUrl).pathname;

    while (queue.length > 0) {
        const item = queue.shift()!;

        if (visited.has(item.url) || item.depth > maxDepth) continue;
        if (!isAllowed(robots, item.url)) continue;

        visited.add(item.url);

        try {
            await rateLimiter.wait();

            const response = await fetch(item.url, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) continue;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) continue;

            const html = await response.text();
            const $ = cheerio.load(html);

            $('a[href]').each((_, el) => {
                try {
                    const href = $(el).attr('href');
                    if (!href) return;

                    const resolved = new URL(href, item.url);

                    // Strip hash and query
                    resolved.hash = '';
                    resolved.search = '';
                    const resolvedUrl = resolved.href;

                    // Only follow same-origin links under the base path
                    if (
                        resolved.origin === baseOrigin &&
                        resolved.pathname.startsWith(basePath) &&
                        !visited.has(resolvedUrl) &&
                        !isNonDocUrl(resolvedUrl)
                    ) {
                        queue.push({ url: resolvedUrl, depth: item.depth + 1 });
                    }
                } catch {
                    // Invalid URL, skip
                }
            });
        } catch {
            // Fetch failed, skip
        }
    }

    return filterUrls([...visited], baseUrl, config, robots);
}

/** Filter URLs based on config patterns */
function filterUrls(
    urls: string[],
    baseUrl: string,
    config: CrawlConfig,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): string[] {
    const baseOrigin = new URL(baseUrl).origin;
    const basePath = new URL(baseUrl).pathname;

    return urls.filter((url) => {
        try {
            const parsed = new URL(url);

            // Must be same origin and under base path
            if (parsed.origin !== baseOrigin) return false;
            if (!parsed.pathname.startsWith(basePath)) return false;

            // Check robots.txt
            if (!isAllowed(robots, url)) return false;

            // Skip non-doc URLs
            if (isNonDocUrl(url)) return false;

            // Include/exclude patterns
            if (config.includePatterns?.length) {
                const matches = config.includePatterns.some((p) => url.includes(p));
                if (!matches) return false;
            }
            if (config.excludePatterns?.length) {
                const excluded = config.excludePatterns.some((p) => url.includes(p));
                if (excluded) return false;
            }

            return true;
        } catch {
            return false;
        }
    });
}

/** Heuristic: skip non-documentation URLs */
function isNonDocUrl(url: string): boolean {
    const skip = [
        '/api/',
        '/login',
        '/signup',
        '/auth/',
        '.pdf',
        '.zip',
        '.tar',
        '.gz',
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.ico',
        '.css',
        '.js',
        '.woff',
        '.woff2',
        '.ttf',
        '.eot',
        '/feed',
        '/rss',
        '/atom',
    ];
    const lower = url.toLowerCase();
    return skip.some((s) => lower.includes(s));
}
