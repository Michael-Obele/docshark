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
  - `list_libraries`
  - `search_docs`
  - `search_docs_batch`
  - `get_doc_page`
- Lifecycle:
  - `manage_library` with `action` in `add | rename | refresh | remove | info`

Do not call deprecated/nonexistent tool names such as `add_library`, `refresh_library`, or `remove_library`.

## manage_library Required Inputs

- `add`: `url` (optional `name`, `version`, `max_depth`)
- `refresh`: `library`
- `remove`: `library`
- `info`: `library`
- `rename`: `current_name`, `new_name`

## Query Style

- Use natural language: `SvelteKit form actions redirect after submit`
- Avoid keyword fragments: `sveltekit form redirect`

## Output Rules

- Ground answers in tool output.
- If nothing is found, say so and refine query/filter.
- If a library is missing, use `manage_library` with `action: "add"`.
