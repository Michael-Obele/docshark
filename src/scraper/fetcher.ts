// src/scraper/fetcher.ts — HTTP page fetcher with auto-detection for JS-rendered sites
import type { FetchResult } from '../types.js';
import { extractAndConvert } from '../processor/extractor.js';

const USER_AGENT = 'DocShark/1.0';
const MIN_CONTENT_LENGTH = 500;
const MAX_RETRIES = 3;

/**
 * Fetch a page and return its HTML.
 * Supports auto-detection of JS-rendered sites (falls back to puppeteer-core if installed).
 */
export async function fetchPage(
    url: string,
    renderer: 'auto' | 'fetch' | 'puppeteer' = 'auto',
): Promise<FetchResult> {
    // Force puppeteer if configured
    if (renderer === 'puppeteer') {
        return fetchWithPuppeteer(url);
    }

    // Tier 1: Standard fetch
    const result = await fetchWithRetry(url);

    if (renderer === 'fetch') {
        return result;
    }

    // Auto mode: check if content is too short (possibly JS-rendered)
    const { markdown } = extractAndConvert(result.html, url);

    if (markdown.length >= MIN_CONTENT_LENGTH) {
        return result;
    }

    // Tier 2: Content too short + has <script> tags → likely JS-rendered
    const looksJsRendered = result.html.includes('<script') && markdown.length < MIN_CONTENT_LENGTH;

    if (looksJsRendered) {
        console.warn(
            `[DocShark] ${url} appears JS-rendered (${markdown.length} chars). Trying puppeteer...`,
        );

        if (await canUsePuppeteer()) {
            return fetchWithPuppeteer(url);
        }

        console.warn(
            `[DocShark] puppeteer-core not installed. Run: bun add puppeteer-core\n` +
            `Or set renderer: "fetch" in the library config to suppress this warning.`,
        );
    }

    return result;
}

/** Fetch with exponential backoff retry */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<FetchResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                signal: AbortSignal.timeout(30_000),
                redirect: 'follow',
            });

            const html = await response.text();

            return {
                html,
                renderer: 'fetch',
                status: response.status,
                etag: response.headers.get('etag'),
                lastModified: response.headers.get('last-modified'),
            };
        } catch (err) {
            if (attempt === retries) throw err;
            // Exponential backoff: 1s, 2s, 4s
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
    }

    throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/** Check if puppeteer-core is available (dynamic import) */
async function canUsePuppeteer(): Promise<boolean> {
    try {
        // @ts-ignore — puppeteer-core is an optional dependency
        await import(/* webpackIgnore: true */ 'puppeteer-core');
        return true;
    } catch {
        return false;
    }
}

/** Fetch with puppeteer-core using system Chrome */
async function fetchWithPuppeteer(url: string): Promise<FetchResult> {
    // @ts-ignore — puppeteer-core is an optional dependency
    const puppeteer = await import('puppeteer-core');
    const { existsSync } = await import('fs');

    const executablePath = findChrome(existsSync);
    if (!executablePath) {
        throw new Error(
            'Chrome not found. Set CHROME_PATH env var or install Chrome.\n' +
            'Alternatively: npx puppeteer browsers install chrome',
        );
    }

    const browser = await puppeteer.default.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();

    try {
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

        return { html, renderer: 'puppeteer', status: 200 };
    } finally {
        await page.close();
        await browser.close();
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
