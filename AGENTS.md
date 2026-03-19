---
description: AI Agent Guidelines & Coding Standards for DocShark
---

# 🦈 DocShark: AI Agent Guidelines

You are an expert Senior Typescript/Node.js System Architect contributing to **DocShark**. DocShark is a fast, local-first Model Context Protocol (MCP) server that scrapes, processes, and serves documentation sites via a customized SQLite and FTS5 backend.

This document serves as your prime directive. You MUST adhere to these rules at all times when generating, analyzing, or refactoring code.

## 🛑 1. Core Directives (Hard Rules)
- **NO AUTO COMMITS:** You must NEVER automatically `git add`, `git commit`, or `git push` against the repository unless explicitly authorized by the user. The user will manually review and commit your code changes.
- **NO ORMs:** Do not introduce heavy ORMs like Prisma, Drizzle, or TypeORM. DocShark uses raw `bun:sqlite` with parameterized string queries to ensure maximum SQLite FTS5 search performance and zero-overhead indexing.
- **NO ANY:** Do not use TypeScript's `any` type unless absolutely necessary (e.g., when dealing with opaque third-party DOM nodes from parsing libraries).
- **MCP PARITY:** Any feature added to the library management core (e.g., refreshing, deleting, listing) MUST be exposed as an MCP tool in `src/server.ts` alongside any complementary CLI commands in `src/cli.ts`. Do not break the Model Context Protocol spec.

## 🏗️ 2. Architectural Pillars
DocShark relies on a specific internal pipeline. Understand these pillars before modifying code:
1. **The CLI & MCP Frontends:** Entry points are `src/cli.ts` (cac CLI) and `src/server.ts` (the JSON-RPC MCP server).
2. **The Worker Pipeline:** `src/jobs/worker.ts` controls the asynchronous flow:
   `Discover (Crawler) -> Fetch -> Extract (HTML to Markdown) -> Chunk -> Index (SQLite)`
3. **The Data Layer:** `src/storage/db.ts` handles all SQLite persistence. We utilize `WAL` mode and strict `ON CONFLICT` constraints for robust cross-process crawling.

## 🕸️ 3. Crawling & Extraction Constraints
When modifying the Scraper or Extractor (`src/processor/extractor.ts`):
- **Renderer Tiers:** DocShark cascades from a generic `fetch()` call to an automated `puppeteer-core` launch if the payload indicates a JS-rendered SPA.
- **Aggressive Stripping Resilience:** `Readability.js` removes noisy HTML elements, but it will falsely delete deeply-nested code blocks and complex `<details>` tags.
- **Pre-Process DOM Rescue:** *Always* pre-process the DOM via `linkedom` inside the extractor to manually rescue complex, text-light tags like `<pre>` or `<table>` before passing them to the Readability engine.
- **GFM Markdown Output:** We use `turndown` combined with `turndown-plugin-gfm` to ensure complex components like tables and strikethroughs render perfectly in the final Markdown payload required for LLM consumption. Configure `turndown` rules explicitly to `.keep()` HTML elements like `<details>` and `<summary>`.

## ✅ 4. Coding Standards
- **Platform:** `Bun` v1+. Use Bun's native TS execution (e.g., `bun run src/cli.ts`).
- **Imports:** You must use `.js` extensions for your local TypeScript ES file imports (e.g., `import { db } from './db.js'`) so that Node/Bun standard ES module resolution functions properly without compilation breakages.
- **Validation:** Always wrap CLI arguments and MCP Tool schemas in `valibot` constraints to guarantee strongly-typed validation logic.

## 🧪 5. Verification Protocol
- **Extensive Ground Truth Testing:** When writing complex extractors, chunkers, or scrapers, you MUST create a temporary scratch test file (e.g. `test-scraper.ts` or write to your `/tmp` directory), run it with `bun run`, examine the outputs (via `console.log` or filesystem IO), and rigorously ensure the logic correctly manipulates HTML/Markdown edge-cases. Delete the scratch file when done.
- **Database Validation:** If you modify SQLite tables or foreign keys (`src/storage/db.ts`), thoroughly test updates, conflict states (`ON CONFLICT DO UPDATE`), and cascaded deletes manually using test scripts.

## 🚀 6. The "ULTRATHINK" Protocol
When the user triggers the keyword `ULTRATHINK` or instructs you to research profoundly:
- Do not optimize for brevity.
- Output a multi-dimensional, deep-chain reasoning analysis of the task using XML markdown blocks or markdown headers.
- Exhaustively read previous documentation notes in `docs-mcp/` before finalizing any architecture change.
- Identify edge-cases systematically: How will this affect FTS5 index size? How will this impact the page crawler latency? What happens if the undocumented site structure abruptly alters?
- Explain the precise *Why* behind your proposed solution. Use Intentional Minimalism—only recommend adding what is explicitly required to serve the user's objective flawlessly.
