---
name: docshark
description: Use when answering framework, library, SDK, or API documentation questions with DocShark MCP tools, especially for indexed-doc search, full-page retrieval, and library lifecycle tasks.
---

# DocShark MCP Usage

Use DocShark in this exact order:

1. `list_libraries` if coverage is unknown.
2. `search_docs` for primary lookup (natural language queries).
3. `get_doc_page` only when snippet context is not enough.
4. `manage_library` for lifecycle operations.

## Current Tool Contract

- Read/search:
  - `list_libraries` (includes Last Crawled/Age; ⚠️ marks stale libraries)
  - `search_docs`
  - `search_docs_batch`
  - `get_doc_page`
- Lifecycle:
  - `manage_library` with `action` in `add | rename | refresh | remove | info | stale`

Do not call deprecated/nonexistent tool names such as `add_library`, `refresh_library`, or `remove_library`.

## manage_library Required Inputs

- `add`: `url` (optional `name`, `version`, `max_depth`)
- `refresh`: `library`
- `remove`: `library`
- `info`: `library`
- `rename`: `current_name`, `new_name`
- `stale`: none (optional `days` — freshness window in days, default 14)

## Stale Docs (Freshness)

A library is **stale** when it has not been crawled in **14+ days** (default;
tune with `DOCSHARK_STALE_DAYS` or the `days` parameter). Stale docs are the
top source of confidently-wrong answers, so freshness must be surfaced, never
assumed.

- Discover staleness: `list_libraries` marks stale rows with `⚠️` and an Age
  column, or run `manage_library` with `action: "stale"` for a dedicated list
  with last-crawl dates and ages.
- When staleness could affect an answer — search results from a stale library,
  or the user asks "is this up to date / current?" — TELL THE USER which
  libraries are stale and how old they are, then OFFER to refresh them.
- NEVER run `action: "refresh"` without the user agreeing first (a refresh is
  a live crawl: network + time). After the user agrees, refresh each stale
  library with one `action: "refresh"` call per library.
- Humans get the same feature in the CLI: `docshark stale`, plus an auto-prompt
  on `docshark list`.

## Query Style

- Use natural language: `SvelteKit form actions redirect after submit`
- Avoid keyword fragments: `sveltekit form redirect`

## Output Rules

- Ground answers in tool output.
- If nothing is found, say so and refine query/filter.
- If a library is missing, use `manage_library` with `action: "add"`.
- If the library you answered from is stale (⚠️ in `list_libraries`), add a
  one-line caveat that the docs may be outdated and offer a refresh.
