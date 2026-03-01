---
title: "DocShark — JS-Rendered Sites Strategy"
status: draft
---

# JS-Rendered Sites Strategy

How DocShark handles JavaScript-heavy documentation sites without forcing Playwright on everyone.

← Back to [Plan Index](./index.md)

---

## The Problem

Many modern doc sites are JS-rendered SPAs. Our default `fetch + cheerio` won't execute JavaScript, so these sites return empty/skeleton HTML. Examples: some React docs, Swagger UI, lazy-loaded API references.

**BUT**: the MAJORITY of doc sites in 2026 are SSR or static-built:
- **Docusaurus** → SSR hydration (content in initial HTML) ✅
- **VitePress** → SSR ✅
- **Mintlify** → SSR ✅
- **GitBook** → SSR ✅
- **SvelteKit docs** → SSR ✅
- **Tailwind docs** → Static build ✅
- **MDN** → Static ✅

So we DON'T need a browser for 80%+ of cases. But we DO need a smart fallback.

## The Verdict: Tiered Approach

**Keep `fetch` as default. Add `puppeteer-core` as smart, optional Tier 2.**

```
Tier 1 (default)     fetch → cheerio/readability → markdown
  ├── 80%+ of doc sites work here
  ├── Zero footprint, instant start
  └── No browser binary needed

Tier 2 (auto/opt-in)  puppeteer-core → system Chrome → same pipeline
  ├── For JS-rendered sites
  ├── Uses system Chrome (no download)
  └── Dynamic import (not bundled)

Tier 3 (manual)       User forces renderer: "puppeteer" in config
  └── For known JS-heavy sites
```

### Why puppeteer-core over playwright-core

| Factor               | puppeteer-core                     | playwright-core        |
| -------------------- | ---------------------------------- | ---------------------- |
| **JS package size**  | ~0.5–2 MB                          | ~1–2 MB                |
| **Protocol**         | CDP (lighter, faster)              | CDP + custom (heavier) |
| **Browser needed**   | Chromium only (fine for scraping)  | Multi-browser          |
| **Stealth plugins**  | Excellent ecosystem                | Fewer options          |
| **Startup speed**    | Faster                             | Slightly slower        |
| **For our use case** | ✅ Perfect (Chromium-only scraping) | Overkill               |

### Why NOT make puppeteer-core the default

1. **Size**: Even `puppeteer-core` needs Chrome (~170–280MB binary)
2. **Speed**: HTTP fetch is 10–100x faster than browser rendering
3. **Memory**: No browser process = ~200MB less RAM
4. **Simplicity**: `npx docshark` works instantly, no browser setup
5. **CI/Docker**: Slimmer images without Chromium

## Auto-Detection Flow

```typescript
// src/scraper/fetcher.ts

import type { FetchResult } from '../types.js';

const MIN_CONTENT_LENGTH = 500; // chars

export async function fetchPage(
  url: string,
  renderer: 'auto' | 'fetch' | 'puppeteer' = 'auto'
): Promise<FetchResult> {
  // Force puppeteer if configured
  if (renderer === 'puppeteer') {
    return fetchWithPuppeteer(url);
  }

  // Tier 1: Try fetch + readability
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DocShark/1.0' },
    signal: AbortSignal.timeout(30_000),
  });

  const html = await response.text();
  const markdown = extractAndConvert(html, url);

  if (renderer === 'fetch' || markdown.length >= MIN_CONTENT_LENGTH) {
    return {
      html,
      markdown,
      renderer: 'fetch',
      status: response.status,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  }

  // Tier 2: Content too short + has <script> tags → likely JS-rendered
  const looksJsRendered = html.includes('<script') && markdown.length < MIN_CONTENT_LENGTH;

  if (looksJsRendered) {
    console.warn(`[DocShark] ${url} appears JS-rendered (${markdown.length} chars). Trying puppeteer...`);

    if (await canUsePuppeteer()) {
      return fetchWithPuppeteer(url);
    }

    // Can't use puppeteer — warn user
    console.warn(
      `[DocShark] puppeteer-core not installed. Run: bun add puppeteer-core\n` +
      `Or set renderer: "fetch" in the library config to suppress this warning.`
    );
  }

  // Return what we have (may be partial)
  return { html, markdown, renderer: 'fetch', status: response.status };
}
```

## Puppeteer-Core Integration

```typescript
// src/scraper/puppeteer-adapter.ts

import type { FetchResult } from '../types.js';

let browser: any = null;

/** Check if puppeteer-core is available (dynamic import) */
export async function canUsePuppeteer(): Promise<boolean> {
  try {
    await import('puppeteer-core');
    return true;
  } catch {
    return false;
  }
}

/** Find Chrome executable on the system */
function findChrome(): string | undefined {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    // Windows (WSL compatible)
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];

  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return undefined;
}

export async function fetchWithPuppeteer(url: string): Promise<FetchResult> {
  const puppeteer = await import('puppeteer-core');
  const executablePath = findChrome();

  if (!executablePath) {
    throw new Error(
      'Chrome not found. Set CHROME_PATH env var or install Chrome.\n' +
      'Alternatively, install chromium: npx puppeteer browsers install chrome'
    );
  }

  if (!browser) {
    browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
      ],
    });
  }

  const page = await browser.newPage();

  try {
    // Block unnecessary resources for speed
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
    const markdown = extractAndConvert(html, url);

    return { html, markdown, renderer: 'puppeteer', status: 200 };
  } finally {
    await page.close();
  }
}

/** Close the browser when done (call on shutdown) */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

## Resource Blocking Strategy

When using puppeteer-core for doc scraping, block everything except HTML and JS:

```typescript
const BLOCKED_TYPES = new Set([
  'image',      // Don't need images for text extraction
  'stylesheet', // Don't need CSS
  'font',       // Don't need fonts
  'media',      // Don't need video/audio
]);

const BLOCKED_DOMAINS = new Set([
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'doubleclick.net',
  'hotjar.com',
  'intercom.io',
]);
```

This makes puppeteer-core ~3-5x faster for scraping since it skips all visual resources.

## Per-Library Configuration

Users can override the renderer per library:

```json
{
  "name": "swagger-petstore",
  "url": "https://petstore.swagger.io",
  "crawlConfig": {
    "renderer": "puppeteer",
    "waitForSelector": "#swagger-ui .swagger-ui",
    "waitTimeout": 10000
  }
}
```

The `waitForSelector` tells puppeteer to wait until a specific element appears — critical for SPAs.

## Decision Matrix: When to Use What

| Site Type       | Example                  | Renderer            | Why                             |
| --------------- | ------------------------ | ------------------- | ------------------------------- |
| Static HTML     | MDN, Python docs         | fetch               | Content in initial HTML         |
| SSR Framework   | Docusaurus, VitePress    | fetch               | SSR renders content server-side |
| SSR + Hydration | SvelteKit, Next.js       | fetch               | Content in initial HTML         |
| Client-side SPA | Some React apps          | puppeteer           | Content loaded by JS            |
| Swagger/OpenAPI | Swagger UI, Redoc        | puppeteer           | Heavy JS rendering              |
| Behind auth     | Private docs             | puppeteer + cookies | Need browser session            |
| Lazy-loaded     | Infinite scroll API refs | puppeteer + scroll  | Need to trigger loading         |

## Package Impact

```
Without puppeteer-core:
  docshark package: ~2MB
  Runtime: ~50MB (Node/Bun + SQLite)

With puppeteer-core (optional):
  +0.5MB JS package
  +170–280MB Chrome binary (one-time, uses system Chrome if available)
```

The key insight: **puppeteer-core is an `optionalDependency`**. It's never downloaded unless the user explicitly installs it. DocShark works perfectly without it for most doc sites.

← Back to [Plan Index](./index.md) | See also: [Scraping Pipeline](./scraping-pipeline.md)
