---
title: "DocShark — Research Notes & Inspiration"
status: draft
---

# Research Notes & Inspiration

Sources: arabold/docs-mcp-server, Context7, TMCP docs, MCP best practices articles, Exa ecosystem scan.

← Back to [Plan Index](./index.md)

---

## docs-mcp-server (Grounded Docs) — Key Learnings

**Repo:** [github.com/arabold/docs-mcp-server](https://github.com/arabold/docs-mcp-server) — 955 stars, 768 commits, 64 releases.

### Architecture We're Adopting

- **Shared Tools Layer:** CLI, MCP, and Web UI all delegate to the same tool implementations. Avoids code duplication.
- **EventBus:** Central pub/sub decouples producers from consumers. Dashboard shows progress without polling.
- **Pipeline system:** Jobs go `QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED` with persistent state. Enables recovery and real-time monitoring.
- **Two-phase chunking:** Semantic splitting (preserves doc structure) + size optimization.

### What We're Improving

| Their Approach                  | Our Improvement                                |
| ------------------------------- | ---------------------------------------------- |
| Playwright required             | `fetch + cheerio` default, Playwright optional |
| LangChain.js for embeddings     | Direct API calls or none (FTS5 offline)        |
| HTMX + AlpineJS + JSX dashboard | SvelteKit + Shadcn Svelte                      |
| No templates                    | Pre-configured source templates                |
| Manual config                   | Export/import JSON configs                     |

---

## MCP Tool Design — Best Practices from Research

### From Philipp Schmid (Hugging Face)
> "MCP servers are not thin wrappers around your existing API. A good REST API is **not** a good MCP server."

- Tools are a UI for agents, not developers
- LLMs decide which tool to call based on the **description**
- Return pre-processed, concise results — formatted for LLM consumption
- Don't dump raw JSON or HTML

### From "Six-Tool Pattern" (MCP Bundles)
- **Context rot:** Too many tools = LLM wastes tokens evaluating options
- **6 tools** is the sweet spot: 2 READ + 1 LIST + 3 WRITE
- Each tool should have a clear, non-overlapping purpose

### From Grizzly Peak Software
- Tool names: `snake_case`, action-oriented verbs
- Every tool has 4 components: name, description, schema, handler
- Long-running operations: return job ID, check status separately
- Error handling: always return useful messages, never raw stack traces

### From Snyk (Liran Tal)
- Stick to `snake_case` tool naming convention
- Avoid generic names like `query` or `run` — be specific
- Input validation is critical — Valibot/Zod catches bad input before execution

---

## What Context7 Does (And Doesn't)

Context7 fetches from **GitHub repos** not doc sites. This means:
- Gets raw source files, not rendered documentation
- Misses API references compiled from JSDoc/TSDoc
- Can't handle Docusaurus, VitePress, GitBook, Mintlify sites
- **Our advantage:** We scrape the rendered website — what developers actually read.

---

## MCP Ecosystem Scan (via Exa)

| Framework     | Stars | Approach                      | Eliminated Because          |
| ------------- | ----- | ----------------------------- | --------------------------- |
| **TMCP**      | New   | Composable SDK, web standards | ✅ **Selected**              |
| FastMCP       | 681   | Batteries-included            | Zod-locked, less composable |
| mcp-framework | 612   | Directory-based discovery     | Overkill                    |
| Official SDK  | —     | Low-level                     | Verbose, Node-specific      |
| Fiberplane    | 12    | Lightweight                   | Too early                   |

### npm Package Naming Research

Existing MCP doc packages on npm:
- `mcp-docs-service` — Documentation management (not web scraping)
- `@profullstack/mcp-server` — Generic MCP framework
- `mcp-toolkit` — MCP client utilities
- **No `docshark`** — name is available ✅

### SvelteKit Dashboard Patterns

- `sveltekit-sse` (446 stars) — Best SSE library for SvelteKit. Use for real-time crawl progress.
- Static adapter works perfectly for embedding in npm packages.
- The "Package Next.js as CLI" pattern by anubra266 applies to SvelteKit identically — build static, copy to `dist/dashboard/`, serve with HTTP server.

---

## Feature Roadmap

### MVP (v1.0)
- [x] 6 MCP tools: search, list, get, add, refresh, remove
- [x] Website scraping: fetch + cheerio
- [x] Content pipeline: readability → turndown → chunker
- [x] SQLite + FTS5 search
- [x] SvelteKit dashboard
- [x] CLI: start, add, search, list
- [x] STDIO + HTTP transports
- [x] Pre-configured templates (10+ libraries)
- [x] Config export/import

### v1.1 — Enhanced Search
- [ ] Optional vector embeddings (OpenAI, Ollama)
- [ ] Hybrid search: FTS5 + vector with RRF
- [ ] Code block prioritization in results
- [ ] Section-aware result context

### v1.2 — Smart Crawling
- [ ] Diff-aware updates (ETag/Last-Modified)
- [ ] Sitemap.xml + robots.txt parsing
- [ ] Concurrent crawling (configurable)
- [ ] Playwright adapter for JS-rendered sites
- [ ] Auto-detect project deps from package.json

### v2.0 — Collaboration
- [ ] Team config sharing
- [ ] Cloud-hosted option
- [ ] Webhook notifications
- [ ] Browser extension: "Index this page"
- [ ] VS Code sidebar extension

---

## Reference Links

- [TMCP Docs](https://tmcp.io/docs) | [GitHub](https://github.com/paoloricciuti/tmcp) | [YouTube Talk](https://www.youtube.com/watch?v=zV0pcllxevk)
- [Mastra Docs](https://mastra.ai/docs) | [MCPServer Reference](https://mastra.ai/reference/tools/mcp-server)
- [docs-mcp-server](https://github.com/arabold/docs-mcp-server) | [Architecture](https://github.com/arabold/docs-mcp-server/blob/main/ARCHITECTURE.md)
- [MCP Best Practices — Philipp Schmid](https://www.philschmid.de/mcp-best-practices)
- [Six-Tool Pattern — MCP Bundles](https://www.mcpbundles.com/blog/mcp-tool-design-pattern)
- [MCP Tool Patterns — Grizzly Peak](https://www.grizzlypeaksoftware.com/library/mcp-tool-creation-patterns-and-best-practices-sgph5f29)
- [Standard Schema](https://github.com/standard-schema/standard-schema)
- [SQLite FTS5 Docs](https://sqlite.org/fts5.html)
- [sveltekit-sse](https://github.com/razshare/sveltekit-sse) (446 stars)

← Back to [Plan Index](./index.md)
