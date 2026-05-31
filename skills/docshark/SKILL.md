---
name: docshark
description: Use when answering framework, library, SDK, or API documentation questions with DocShark MCP tools. Use for indexed-doc lookup, full-page retrieval, and library lifecycle operations.
---

# DocShark MCP Usage

## Overview

Use DocShark as a tool-first docs workflow. Keep answers grounded in tool output, not model memory.

## Use These Tools

- `list_libraries` - discover what is indexed.
- `search_docs` - primary natural-language search.
- `search_docs_batch` - multiple related queries in one call.
- `get_doc_page` - fetch full markdown for one page.
- `manage_library` - lifecycle actions: `add`, `rename`, `refresh`, `remove`, `info`.

Important: do not call `add_library`, `refresh_library`, or `remove_library`; those are not current tool names.

## Default Flow

1. Call `list_libraries` if library coverage is unknown.
2. Call `search_docs` with a natural-language query.
3. Call `get_doc_page` only when snippet context is insufficient.
4. If docs are missing or stale, call `manage_library` with the correct `action`.

## manage_library Quick Guide

- Add docs:
  - `action: "add"`
  - required: `url`
  - optional: `name`, `version`, `max_depth`
- Refresh docs:
  - `action: "refresh"`
  - required: `library`
- Remove docs:
  - `action: "remove"`
  - required: `library`
- Inspect one library:
  - `action: "info"`
  - required: `library`
- Rename library:
  - `action: "rename"`
  - required: `current_name`, `new_name`

## Query Patterns

Use natural language, not keyword fragments.

- Good: `SvelteKit form actions redirect after submit`
- Good: `TanStack Query cache invalidation guidance`
- Weak: `sveltekit form redirect`

## Response Rules

- Cite what DocShark returned.
- If no results, say so and refine query or library scope.
- If library is missing, state that and use `manage_library` `action: "add"`.
