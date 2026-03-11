// src/scraper/discoverer.ts — Page URL discovery via sitemap + llms.txt + nav-aware crawl + BFS fallback
import * as cheerio from 'cheerio';
import { getRobotsParser, isAllowed } from './robots.js';
import { RateLimiter } from './rate-limiter.js';
import type { CrawlConfig } from '../types.js';

const USER_AGENT = 'DocShark/1.0';

/**
 * Well-known entry points that doc sites commonly use.
 * When the root page yields no links (JS-rendered SPA landing pages),
 * we probe these paths to find a server-rendered doc page with navigation.
 */
const COMMON_DOC_ENTRY_PATHS = [
    '/docs',
    '/docs/',
    '/documentation',
    '/guide',
    '/guides',
    '/reference',
    '/api',
    '/getting-started',
    '/docs/getting-started',
    '/docs/introduction',
    '/docs/installation',
    '/docs/overview',
];

/**
 * Discover all documentation page URLs from a base URL.
 *
 * Strategy cascade (stops at first strategy that yields >=1 URLs):
 *   A. sitemap.xml
 *   B. llms.txt (AI-friendly link manifest)
 *   C. Navigation-aware HTML link extraction (nav/sidebar elements)
 *   D. BFS link crawl (follows all same-origin links)
 */
export async function discoverPages(
    baseUrl: string,
    config: CrawlConfig = {},
): Promise<string[]> {
    const maxDepth = config.maxDepth ?? 3;
    const robots = await getRobotsParser(baseUrl);

    // ────────────────────────────────────────────
    // Strategy A: Try sitemap first
    // ────────────────────────────────────────────
    const sitemapUrls = await discoverFromSitemap(baseUrl, robots);
    if (sitemapUrls.length > 0) {
        console.log(`[DocShark] ✅ Found ${sitemapUrls.length} URLs from sitemap`);
        return filterUrls(sitemapUrls, baseUrl, config, robots);
    }

    // ────────────────────────────────────────────
    // Strategy B: Try llms.txt / llms-full.txt
    // ────────────────────────────────────────────
    const llmsUrls = await discoverFromLlmsTxt(baseUrl);
    if (llmsUrls.length > 0) {
        console.log(`[DocShark] ✅ Found ${llmsUrls.length} URLs from llms.txt`);
        return filterUrls(llmsUrls, baseUrl, config, robots);
    }

    // ────────────────────────────────────────────
    // Strategy C: Navigation-aware link extraction
    // ────────────────────────────────────────────
    console.log(`[DocShark] No sitemap or llms.txt. Trying navigation-aware discovery...`);
    const navUrls = await discoverFromNavigation(baseUrl, config, robots);
    if (navUrls.length > 0) {
        console.log(`[DocShark] ✅ Found ${navUrls.length} URLs from page navigation`);

        // Enrich: BFS crawl from discovered nav URLs to find nested pages
        const enrichedUrls = await enrichWithBfsCrawl(
            baseUrl,
            navUrls,
            maxDepth,
            config,
            robots,
        );
        return enrichedUrls;
    }

    // ────────────────────────────────────────────
    // Strategy D: Full BFS link crawl (legacy fallback)
    // ────────────────────────────────────────────
    console.log(`[DocShark] No navigation links found, full BFS crawl (depth=${maxDepth})`);
    const crawledUrls = await discoverByLinkCrawl(baseUrl, maxDepth, config, robots);
    return crawledUrls;
}


// ═══════════════════════════════════════════════
// Strategy A: Sitemap
// ═══════════════════════════════════════════════

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


// ═══════════════════════════════════════════════
// Strategy B: llms.txt
// ═══════════════════════════════════════════════

/**
 * Parse llms.txt / llms-full.txt for documentation URLs.
 * The llms.txt standard uses markdown-style `[title](url)` links.
 * @see https://llmstxt.org
 */
async function discoverFromLlmsTxt(baseUrl: string): Promise<string[]> {
    const candidates = [
        new URL('/llms-full.txt', baseUrl).href,
        new URL('/llms.txt', baseUrl).href,
    ];

    for (const llmsUrl of candidates) {
        try {
            const response = await fetch(llmsUrl, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) continue;

            const text = await response.text();

            // Extract markdown-style links: [text](url)
            const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
            const urls: string[] = [];
            let match;

            while ((match = linkRegex.exec(text)) !== null) {
                const href = match[2].trim();
                try {
                    const resolved = new URL(href, baseUrl);
                    // Only same-origin, strip .md extension if present
                    if (resolved.origin === new URL(baseUrl).origin) {
                        let pathname = resolved.pathname;
                        // Strip .md extension — llms.txt often uses .md paths
                        // but the actual page URL doesn't have .md
                        if (pathname.endsWith('.md')) {
                            pathname = pathname.slice(0, -3);
                        }
                        resolved.pathname = pathname;
                        resolved.hash = '';
                        resolved.search = '';
                        urls.push(resolved.href);
                    }
                } catch {
                    // Invalid URL, skip
                }
            }

            if (urls.length > 0) {
                // Deduplicate
                return [...new Set(urls)];
            }
        } catch {
            // Fetch failed, try next candidate
        }
    }

    return [];
}


// ═══════════════════════════════════════════════
// Strategy C: Navigation-aware link extraction
// ═══════════════════════════════════════════════

/**
 * CSS selectors for navigation/sidebar elements in common doc site frameworks.
 * These target areas where documentation sites list their page links.
 */
const NAV_SELECTORS = [
    'nav a[href]',
    '[role="navigation"] a[href]',
    'aside a[href]',
    '.sidebar a[href]',
    '[class*="sidebar"] a[href]',
    '[class*="nav"] a[href]',
    '[class*="menu"] a[href]',
    '[class*="toc"] a[href]',
    '[data-sidebar] a[href]',
    '[id*="sidebar"] a[href]',
    '[id*="nav"] a[href]',
];

/**
 * Extract links specifically from navigation elements (sidebar, nav, etc.)
 * of a doc page. If the root page yields nothing (SPA), we try common
 * doc entry points that are likely server-rendered.
 */
async function discoverFromNavigation(
    baseUrl: string,
    config: CrawlConfig,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): Promise<string[]> {
    const baseOrigin = new URL(baseUrl).origin;

    // Step 1: Try extracting from the base URL first
    let navLinks = await extractNavLinks(baseUrl, baseOrigin);

    // Step 2: If root page yields very few links (likely JS-rendered landing),
    // probe common doc entry paths
    if (navLinks.length < 3) {
        console.log(
            `[DocShark] Root page has only ${navLinks.length} nav links. Probing doc entry points...`,
        );

        for (const entryPath of COMMON_DOC_ENTRY_PATHS) {
            const entryUrl = new URL(entryPath, baseUrl).href;

            // Skip if robots disallow
            if (!isAllowed(robots, entryUrl)) continue;

            const entryLinks = await extractNavLinks(entryUrl, baseOrigin);
            if (entryLinks.length > navLinks.length) {
                console.log(
                    `[DocShark] Found ${entryLinks.length} nav links at ${entryPath}`,
                );
                navLinks = entryLinks;
            }

            // If we found a rich source, stop probing
            if (navLinks.length >= 10) break;
        }
    }

    // Step 3: If static fetch still yields nothing, try puppeteer on root
    if (navLinks.length < 3) {
        console.log(
            `[DocShark] Static fetch yielded few links. Trying headless browser...`,
        );
        const puppeteerLinks = await extractNavLinksWithPuppeteer(baseUrl, baseOrigin);
        if (puppeteerLinks.length > navLinks.length) {
            navLinks = puppeteerLinks;
        }
    }

    return filterUrls(navLinks, baseUrl, config, robots);
}

/**
 * Fetch a page and extract links from navigation elements.
 * Uses targeted CSS selectors to find sidebar/nav links.
 */
async function extractNavLinks(url: string, baseOrigin: string): Promise<string[]> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15_000),
            redirect: 'follow',
        });

        if (!response.ok) return [];

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return [];

        const html = await response.text();
        return extractLinksFromHtml(html, url, baseOrigin, true);
    } catch {
        return [];
    }
}

/**
 * Extract links from HTML content.
 *
 * @param navOnly - If true, only extract links from nav-like elements.
 *                  If false, extract all `a[href]` links.
 */
function extractLinksFromHtml(
    html: string,
    pageUrl: string,
    baseOrigin: string,
    navOnly: boolean,
): string[] {
    const $ = cheerio.load(html);
    const urls = new Set<string>();

    const selector = navOnly ? NAV_SELECTORS.join(', ') : 'a[href]';

    $(selector).each((_, el) => {
        try {
            const href = $(el).attr('href');
            if (!href) return;

            const resolved = new URL(href, pageUrl);
            resolved.hash = '';
            resolved.search = '';

            if (
                resolved.origin === baseOrigin &&
                !isNonDocUrl(resolved.href)
            ) {
                urls.add(resolved.href);
            }
        } catch {
            // Invalid URL, skip
        }
    });

    return [...urls];
}

/**
 * Use puppeteer-core to render a JS SPA and extract navigation links.
 * Falls back silently if puppeteer is not installed.
 */
async function extractNavLinksWithPuppeteer(
    url: string,
    baseOrigin: string,
): Promise<string[]> {
    try {
        // @ts-ignore — puppeteer-core is an optional dependency
        const puppeteer = await import('puppeteer-core');
        const { existsSync } = await import('fs');

        const executablePath = findChrome(existsSync);
        if (!executablePath) {
            console.warn(
                `[DocShark] Chrome not found for headless navigation discovery. ` +
                `Install Chrome or set CHROME_PATH env var.`,
            );
            return [];
        }

        const browser = await puppeteer.default.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        try {
            const page = await browser.newPage();

            // Block heavy resources for speed
            await page.setRequestInterception(true);
            page.on('request', (req: any) => {
                const type = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
            const html = await page.content();
            await page.close();

            return extractLinksFromHtml(html, url, baseOrigin, true);
        } finally {
            await browser.close();
        }
    } catch (err) {
        console.warn(
            `[DocShark] Puppeteer navigation discovery failed: ${(err as Error).message}`,
        );
        return [];
    }
}

function findChrome(existsSync: (path: string) => boolean): string | undefined {
    const candidates = [
        process.env.CHROME_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];

    for (const path of candidates) {
        if (path && existsSync(path)) return path;
    }
    return undefined;
}


// ═══════════════════════════════════════════════
// Strategy D: BFS Link Crawl
// ═══════════════════════════════════════════════

/**
 * Enrich an initial set of discovered URLs by BFS-crawling each page
 * for additional same-origin links. Useful after nav extraction to
 * find nested pages that aren't in the top-level navigation.
 */
async function enrichWithBfsCrawl(
    baseUrl: string,
    seedUrls: string[],
    maxDepth: number,
    config: CrawlConfig,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): Promise<string[]> {
    const visited = new Set<string>(seedUrls);
    const queue: Array<{ url: string; depth: number }> = seedUrls.map((url) => ({
        url,
        depth: 1, // Seed URLs are depth 1, their children are depth 2+
    }));
    const rateLimiter = new RateLimiter(config.rateLimit ?? 500);
    const baseOrigin = new URL(baseUrl).origin;

    while (queue.length > 0) {
        const item = queue.shift()!;

        // Only follow links from nav-discovered pages to find sub-pages
        // e.g. /docs/data-table might link to /docs/data-table/sorting
        if (item.depth > maxDepth) continue;
        if (!isAllowed(robots, item.url)) continue;

        // We already have this URL in our set; only crawl to find *new* links
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
            // Extract ALL links from the page (not just nav) for BFS enrichment
            const pageLinks = extractLinksFromHtml(html, item.url, baseOrigin, false);

            for (const link of pageLinks) {
                if (!visited.has(link) && !isNonDocUrl(link)) {
                    visited.add(link);
                    queue.push({ url: link, depth: item.depth + 1 });
                }
            }
        } catch {
            // Fetch failed, skip
        }
    }

    return filterUrls([...visited], baseUrl, config, robots);
}

/** BFS link crawl from the base URL */
async function discoverByLinkCrawl(
    baseUrl: string,
    maxDepth: number,
    config: CrawlConfig,
    robots: Awaited<ReturnType<typeof getRobotsParser>>,
): Promise<string[]> {
    const visited = new Set<string>();
    const baseOrigin = new URL(baseUrl).origin;
    const basePath = new URL(baseUrl).pathname;

    // Seed queue: start with base URL + common doc entry points
    const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];

    // Also seed common doc entry points if base is root
    if (basePath === '/' || basePath === '') {
        for (const entryPath of COMMON_DOC_ENTRY_PATHS) {
            const entryUrl = new URL(entryPath, baseUrl).href;
            if (isAllowed(robots, entryUrl)) {
                queue.push({ url: entryUrl, depth: 0 });
            }
        }
    }

    const rateLimiter = new RateLimiter(config.rateLimit ?? 500);

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


// ═══════════════════════════════════════════════
// Shared Utilities
// ═══════════════════════════════════════════════

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

            // Must be same origin
            if (parsed.origin !== baseOrigin) return false;

            // Must be under base path (unless base is root)
            if (basePath !== '/' && !parsed.pathname.startsWith(basePath)) return false;

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
