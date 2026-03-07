# 🦈 DocShark

[![Built with Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Ready-0D1117.svg?style=flat&logo=github&logoColor=white)](https://modelcontextprotocol.io/)
[![GitHub Release](https://img.shields.io/github/v/release/Michael-Obele/docshark?color=success)](https://github.com/Michael-Obele/docshark/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DocShark** is a powerful MCP (Model Context Protocol) server designed to scrape, index, and search any documentation website. It creates a local, highly-searchable knowledge base from public documentation pages using FTS5 (Full-Text Search) and BM25 ranking, allowing AI assistants to query the latest docs effortlessly.

---

## 🚀 Features

- **Automated Crawling**: Discovers pages via `sitemap.xml` with fallback to BFS link crawling.
- **Smart Extraction**: Uses Readability and Turndown to extract main content and convert it to clean Markdown, filtering out navbars and sidebars.
- **Semantic Chunking**: Splits content based on headings, preserving contextual headers for better AI understanding.
- **High-Performance Search**: Built-in SQLite + FTS5 indexing with BM25 ranking for accurate and lightning-fast search results.
- **JS-Rendered Site Support**: Tiered fetching strategy automatically detects React/Vue SPAs (empty shells) and upgrades to `puppeteer-core` if you have it installed (zero-config, auto-fallback).
- **Polite Crawling**: Respects `robots.txt` and implements rate limiting to prevent overloading documentation servers.
- **Standard MCP Tooling**: Connect perfectly with Desktop Claude, VS Code, Cursor, and any other MCP-compatible clients via standard `stdio` or `http`/`sse` transports.

## 📦 What We Have Done (Phase 1)

**Phase 1: Core Engine** is fully implemented and tested.

- ✅ Custom SQLite Database with FTS5 virtual tables and auto-sync triggers.
- ✅ Web scraping engine supporting standard `fetch()` and `puppeteer-core`.
- ✅ Markdown processor utilizing Readability + Turndown.
- ✅ Heading-based semantic chunker (500-1200 tokens per chunk).
- ✅ Asynchronous job manager and queue system.
- ✅ Complete HTTP API (REST endpoints + SSE event streams).
- ✅ Seamless integration of 6 MCP tools: `add_library`, `search_docs`, `list_libraries`, `get_doc_page`, `refresh_library`, and `remove_library`.
- ✅ Robust CLI interface (`start`, `add`, `search`, `list`).

## 🏗️ What We Are Doing

We are actively polishing the integration between the core engine and external MCP clients (like VS Code Agents and Claude Desktop).

## 🔮 What We Plan To Do (Phase 2 & Beyond)

- **Web Dashboard**: An intuitive SvelteKit dashboard to manage your synced libraries, view crawl progress in real-time (via SSE), and test searches manually.
- **Incremental Crawling**: Smarter `refresh` jobs that compare `ETag` and `Last-Modified` headers to only re-scrape updated pages.
- **Vector Search (RAG)**: Integration of lightweight vector embeddings for semantic similarity search alongside the existing FTS5 keyword search.
- **Advanced Scraping Setup**: Support for custom CSS selectors to define exactly where content lives in non-standard documentation websites.

---

## 🛠️ Usage

### Quick Start (from npm)

You can run DocShark directly without installing it globally using `bunx`:

```bash
# Add a documentation library to the index
bunx docshark add https://valibot.dev/guides/ --depth 2

# Search your indexed docs
bunx docshark search "schema validation"
```

### Installation

To install DocShark globally as a CLI tool:

```bash
# Using npm
npm install -g docshark

# Using Bun
bun add -g docshark
```

After installation, you can use the `docshark` command:

```bash
docshark list
```

## 🔌 MCP Integration

### VS Code (GitHub Copilot / MCP Extension)

Add DocShark to your `.vscode/settings.json` or global MCP configuration:

```json
{
  "mcpServers": {
    "docshark": {
      "command": "bunx",
      "args": ["-y", "docshark", "start", "--stdio"]
    }
  }
}
```

### Cursor

1. Open **Cursor Settings** > **Models** > **MCP**.
2. Click **+ Add New MCP Server**.
3. Name: `docshark`
4. Type: `command`
5. Command: `bunx -y docshark start --stdio`

### Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docshark": {
      "command": "bunx",
      "args": ["-y", "docshark", "start", "--stdio"]
    }
  }
}
```

---

## 🛠️ Development

### Local Setup

Ensure you have [Bun](https://bun.sh/) installed.

```bash
# Clone the repository
git clone https://github.com/Michael-Obele/docshark.git
cd docshark

# Install dependencies
bun install

# (Optional) Enable auto-detection & scraping of Javascript React/Vue single-page apps
bun add puppeteer-core

# Start the DocShark MCP server in HTTP mode for local testing
bun run src/cli.ts start --port 6380
```

### Local CLI Debugging

```bash
# Run CLI directly while developing
bun run src/cli.ts list
```

## 🔄 Versioning & Changelog

This project uses [Google's Release Please](https://github.com/googleapis/release-please) to automate versioning and changelog generation.

- **Semantic Versioning**: Our versions automatically bump (e.g. `0.0.1` -> `0.0.2` or `0.1.0`) based on standard Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- **Automated**: A PR is automatically created on `master` when standard commits are merged, generating a standard `CHANGELOG.md`.

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).

---

_Built to empower AI agents with the latest knowledge._
