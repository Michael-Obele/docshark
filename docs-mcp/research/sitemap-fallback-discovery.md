# Research: Sitemap Fallback URL Discovery

## Problem Statement

Many modern documentation sites — particularly those built with SPA frameworks (SvelteKit, Next.js, Nuxt, etc.) — do **not** serve a `sitemap.xml`. DocShark's original discoverer relied on a two-strategy cascade:

1. **Sitemap:** Parse `sitemap.xml` → get all page URLs
2. **BFS Crawl:** If no sitemap, fetch the base URL and BFS-crawl all `<a>` links

The BFS crawl strategy fails catastrophically on SPA-based documentation sites because:

- The **root URL** (`/`) often returns a marketing landing page rendered entirely via JavaScript
- A raw `fetch()` returns an HTML shell with `<script>` tags and **zero navigation `<a>` links**
- Without any seed links, the BFS queue is empty from the start — zero pages discovered

### Example: shadcn-svelte.com

```
$ curl -s https://shadcn-svelte.com/ | grep -c '<a '
1   # Only 1 <a> tag (the logo), all nav is JS-rendered!

$ curl -s https://shadcn-svelte.com/docs/installation | grep -c '<a '
180+  # Doc pages are SSR'd with full sidebar navigation!
```

The root page has virtually no links, but the docs subpages have rich sidebar navigation with 60+ component links. The crawler just couldn't reach them.

---

## Research: Discovery Strategies

### Strategy A: Sitemap.xml (Existing)

**How it works:** Fetch `/sitemap.xml`, parse `<urlset>/<url>/<loc>` tags.

**Pros:** Most reliable when available — authoritative, exhaustive URL list.  
**Cons:** Many doc sites don't have one (shadcn-svelte, Bits UI, Melt UI, etc.).

**Verdict:** Keep as primary strategy. ✅

### Strategy B: llms.txt (NEW)

**How it works:** The [llms.txt standard](https://llmstxt.org) is a growing convention where sites serve a plain-text manifest at `/llms.txt` or `/llms-full.txt` containing markdown-style links:

```markdown
# shadcn-svelte
- [Button](https://shadcn-svelte.com/docs/components/button.md)
- [Card](https://shadcn-svelte.com/docs/components/card.md)
```

**Implementation details:**
- Try `/llms-full.txt` first (more complete), then fall back to `/llms.txt`
- Extract links using regex: `/\[([^\]]*)\]\(([^)]+)\)/g`
- Strip `.md` extension from paths (llms.txt often uses `.md` but the actual pages don't)
- Filter to same-origin only

**Pros:**
- AI-friendly standard — specifically designed for this use case
- Growing adoption (shadcn-svelte, Vercel, MDN, many framework docs)
- Lightweight: single HTTP request, no crawling needed

**Cons:**
- Not universally adopted yet
- May lag behind actual site structure

**Test result:** shadcn-svelte.com → **79 URLs from llms.txt** ✅

**Verdict:** Add as second strategy after sitemap. ✅

### Strategy C: Navigation-Aware HTML Extraction (NEW)

**How it works:** Instead of BFS-crawling all links on a page, target navigation-specific HTML elements:

```css
/* Selectors that match doc site navigation */
nav a[href]
[role="navigation"] a[href]
aside a[href]
.sidebar a[href]
[class*="sidebar"] a[href]
[class*="nav"] a[href]
[class*="menu"] a[href]
[class*="toc"] a[href]
[data-sidebar] a[href]
```

**Multi-step approach:**
1. Fetch root URL, extract links from nav/sidebar elements
2. If root yields < 3 links (SPA landing page), probe well-known doc entry points:
   - `/docs`, `/docs/`, `/guide`, `/docs/installation`, `/docs/getting-started`, etc.
3. If static fetch still yields nothing, use `puppeteer-core` to render the SPA
4. Once found, optionally BFS-enrich the discovered URLs to find nested sub-pages

**Key insight:** Even when root pages are JS-rendered SPAs, the actual documentation pages are usually SSR'd (for SEO). So probing `/docs/installation` returns a fully-rendered HTML page with a complete sidebar containing all doc links.

**Pros:**
- Works on sites without sitemap or llms.txt
- Leverages the fact that doc sites always have sidebar navigation
- Smart fallback chain: static → probing → puppeteer

**Cons:**
- Heuristic-based (nav selectors might not match unusual layouts)
- Requires probing multiple URLs (small latency cost)

**Verdict:** Add as third strategy. ✅

### Strategy D: Enhanced BFS Crawl (Improved)

**How it works:** Same as the original BFS crawl, but enhanced:
- When base URL is root (`/`), also seed the BFS queue with common doc entry points
- This ensures the crawler has at least some starting points even if the root page has no links

**Verdict:** Keep as final fallback with improvements. ✅

---

## Implementation: Final Strategy Cascade

```
discoverPages(baseUrl)
├── Strategy A: sitemap.xml → if URLs found, return
├── Strategy B: llms.txt → if URLs found, return
├── Strategy C: Nav-aware extraction → if URLs found, enrich with BFS, return
└── Strategy D: Full BFS crawl (with seeded entry points)
```

Each strategy is attempted in order; the first one to yield ≥1 URL wins.

---

## Test Results

### shadcn-svelte.com (no sitemap)

| Metric | Before (BFS only) | After (llms.txt) |
|---|---|---|
| Strategy Used | BFS (failed) | llms.txt |
| Pages Discovered | 0 | 79 |
| Pages Crawled | 0 | 79 |
| Chunks Indexed | 0 | 331 |
| Failed Pages | N/A | 0 |
| Crawl Time | instant (nothing to crawl) | ~3 min |

**All 79 pages successfully indexed:**
- 59 component pages (Accordion through Typography)
- 8 setup/config pages (Installation, CLI, Theming, etc.)
- 4 installation guides (SvelteKit, Vite, Astro, Manual)
- 2 migration guides (Svelte 5, Tailwind v4)
- 2 dark mode guides
- 5 registry pages
- About + Changelog

### Search verification:
```bash
$ docshark search "button component" --library shadcn-svelte-com
--- Button (Shadcn Svelte Com) ---
Displays a button or a component that looks like a button...
```

### svelte.dev (no sitemap)

| Metric | Result |
|---|---|
| Strategy Used | `Strategy B` (llms.txt) |
| Pages Discovered | 240+ |
| Result | Successfully discovered full docs using `/llms-full.txt` |

### sv-animations.vercel.app (no sitemap, no llms.txt)

| Metric | Result |
|---|---|
| Strategy Used | `Strategy C` (Nav-aware extraction) |
| Pages Discovered | 56 |
| Details | Base URL `/` returned few links. Puppeteer fallback found 2 initial links. BFS enrichment loaded `/magic/docs/components/...` pages containing full SSR'd navigation sidebars, discovering the entire documentation site successfully! |

---

## Files Changed

| File | Change |
|---|---|
| `src/scraper/discoverer.ts` | Complete rewrite with 4-strategy cascade |

No changes needed to:
- `src/types.ts` (CrawlConfig already sufficient)
- `src/jobs/worker.ts` (pipeline unchanged)
- `src/cli.ts` (CLI unchanged)
- `src/server.ts` (MCP tools unchanged)

---

## Future Enhancements

1. **Common framework detection:** Identify the doc framework (Docusaurus, VitePress, Nextra, etc.) and use framework-specific discovery heuristics
2. **`llms-full.txt` preference:** Currently we try `llms-full.txt` first; could also merge both for maximum coverage
3. **Headless-first option:** Add a `discoveryRenderer: 'puppeteer'` config option to force headless browser for discovery (not just content fetching)
4. **Caching llms.txt:** Store the raw llms.txt content so we can diff it on refresh to detect new/removed pages
