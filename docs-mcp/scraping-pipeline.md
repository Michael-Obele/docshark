---
title: "DocShark — Scraping Pipeline"
status: draft
---

# Scraping & Content Processing Pipeline

← Back to [Plan Index](./index.md)

---

## Pipeline Overview

```
URL → Discover → Fetch → Extract → Convert → Chunk → Index
```

| Phase       | What                  | Tool                                | Output       |
| ----------- | --------------------- | ----------------------------------- | ------------ |
| 1. Discover | Find all page URLs    | sitemap.xml / link crawl            | URL list     |
| 2. Fetch    | HTTP GET with caching | `fetch` / Playwright                | Raw HTML     |
| 3. Extract  | Strip nav/footer/ads  | `@mozilla/readability` + `linkedom` | Clean HTML   |
| 4. Convert  | HTML → Markdown       | `turndown`                          | Markdown     |
| 5. Chunk    | Split by headings     | Custom semantic splitter            | Chunk[]      |
| 6. Index    | Store + FTS5          | `better-sqlite3`                    | Search-ready |

## 1. Discovery

**Strategy A — Sitemap.xml (preferred):** Parse `/sitemap.xml` for page URLs.
**Strategy B — Link Crawl (fallback):** BFS from root URL, follow internal `<a>` tags.
**Strategy C — robots.txt:** Check `robots-parser` to respect disallowed paths.

## 2. Fetching

- Default: native `fetch` with proper `User-Agent` header
- Incremental: Send `If-None-Match` / `If-Modified-Since` to skip unchanged pages (HTTP 304)
- Rate limiting: configurable delay (default 500ms)
- Retry: exponential backoff on failure (3 attempts)
- Timeout: 30 seconds per request
- Optional: `playwright` for JS-rendered sites (dynamic import, not bundled)

## 3. Content Extraction

Use `@mozilla/readability` with `linkedom` (lighter than jsdom):
- Strips navigation, sidebars, footers, ads
- Extracts article title and main content
- Returns clean HTML of the main content area

## 4. HTML → Markdown

`turndown` configured for doc-friendly output:
- `headingStyle: 'atx'` (# headings)
- `codeBlockStyle: 'fenced'` (``` blocks with language tags)
- Custom rule: preserve `language-*` class on code blocks
- Custom rule: strip images (noisy for search context)
- Custom rule: preserve tables

## 5. Chunking

**Strategy: Recursive heading-based splitting**

1. Split on `# h1` → major sections
2. Within h1, split on `## h2` → subsections
3. Within h2, split on `### h3` → fine-grained
4. If section exceeds max tokens → split on paragraphs
5. **Never split mid-code-block** (atomic units)
6. Preserve heading hierarchy as context breadcrumb: `"Getting Started > Installation"`
7. Target: 500–1,500 tokens/chunk
8. Min: 50 tokens (skip tiny fragments)

## 6. Indexing

- Insert chunks into SQLite `chunks` table
- FTS5 sync via DB triggers (see [database-schema.md](./database-schema.md))
- Update library stats (page_count, chunk_count)
- Optional: generate embeddings via OpenAI/Ollama

## Dependencies

| Package                | Purpose                 | Weight |
| ---------------------- | ----------------------- | ------ |
| `cheerio`              | HTML parsing            | ~200KB |
| `@mozilla/readability` | Content extraction      | ~40KB  |
| `linkedom`             | DOM env for Readability | ~100KB |
| `turndown`             | HTML→Markdown           | ~30KB  |
| `robots-parser`        | robots.txt              | ~5KB   |
| `playwright`           | JS sites (optional)     | ~50MB  |

**Total core: ~375KB** JS + native SQLite addon. No LangChain.

← Back to [Plan Index](./index.md)
