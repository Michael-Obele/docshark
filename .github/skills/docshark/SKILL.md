---
name: docshark
description: Use when a task needs documentation lookup through a DocShark MCP server, including discovering indexed libraries, searching framework or API docs, reading full documentation pages, or handling missing or stale libraries.
---

# Using DocShark

## Overview

DocShark is most effective when the model treats it as a small documentation workflow rather than a single search box. Start by checking what libraries exist when scope is unclear, search with natural language, and only fetch full pages when snippets are not enough.

## When To Use

- Use when the user asks about framework, library, API, SDK, or tool documentation and DocShark is available.
- Use when the user needs current documentation details grounded in indexed docs instead of model memory.
- Use when the user mentions a specific library and you need to confirm whether it is already indexed.
- Use when a search result snippet is promising but too shallow to answer safely.
- Use when the docs may be missing or stale and you need to add, inspect, or refresh a library.

Do not use this skill for general web search or for repository source-code search when the answer should come from the current workspace instead of documentation.

## Decision Flow

1. If you do not know what libraries are available, call `list_libraries` first.
2. If the right library exists, call `search_docs` with a natural-language query.
3. If the search result identifies the right page but the snippet is incomplete, call `get_doc_page`.
4. If the needed docs are missing, call `manage_library` with `action="add"`.
5. If a library exists but looks outdated or incomplete, use `manage_library` with `action="info"` or `action="refresh"`.

## Core Patterns

### 1. Prefer discovery before assumptions

If the user names a library and you are not sure how it is stored, inspect indexed libraries before guessing the library key. DocShark is precise about library names, and a fast discovery step avoids bad filters and empty searches.

### 2. Search in natural language

Write queries the way a developer would describe what they need.

Good patterns:

- `How do Svelte 5 snippets pass props to child components?`
- `Better Auth email verification flow and callback handling`
- `Tailwind CSS v4 container query utilities`
- `What does this TypeScript error mean in Zod schema parsing?`

Weak patterns:

- `svelte props snippets child`
- `better auth email verify callback`

Natural-language queries help `search_docs` retrieve the right chunks and headings instead of forcing the model to guess keywords.

### 3. Use library filters deliberately

Add the `library` filter only when you already know the correct indexed library name or when the user explicitly wants one library. Leave it unset when you are exploring or comparing libraries.

### 4. Escalate to full-page reads

Use `get_doc_page` when:

- the answer depends on surrounding examples, warnings, or caveats
- the snippet stops before important implementation details
- the user asks for a walkthrough or deeper explanation from one page

Do not fetch full pages for every result. Read the full page only after search narrows the target.

### 5. Handle missing or stale docs explicitly

Use `manage_library` instead of silently falling back to model memory when DocShark lacks coverage.

- `action="add"` when the library is not indexed yet
- `action="info"` when you need page coverage, stats, or stored paths
- `action="refresh"` when docs may be outdated
- `action="rename"` when the stored name is awkward or inconsistent
- `action="remove"` only when cleanup is clearly requested

When adding a library, prefer the base documentation URL rather than a deep page URL unless the site structure demands otherwise.

## Response Style

- Ground claims in what DocShark returned.
- Mention the library you searched when that context matters.
- If search confidence is low, say so and refine the query or inspect the library before answering.
- If no relevant library exists, say that DocShark does not currently have it indexed and then add or suggest adding it.

## Examples

**Example 1:**
User: "How do I use SvelteKit form actions with redirects?"

Preferred behavior:

1. `list_libraries` if SvelteKit coverage is unknown.
2. `search_docs` with a query like `SvelteKit form actions redirect after submit`.
3. `get_doc_page` if the result snippet references the right form-actions page but needs full context.

**Example 2:**
User: "Do we have Better Auth docs indexed? If not, add them."

Preferred behavior:

1. `list_libraries`.
2. If missing, `manage_library` with `action="add"` and the Better Auth docs URL.
3. Explain that indexing has started and that search quality depends on crawl completion.

**Example 3:**
User: "Search the indexed docs for TanStack Query cache invalidation."

Preferred behavior:

1. `search_docs` without a library filter if the indexed library name is unknown.
2. If results span multiple libraries, narrow with the correct library name on the next search.

## Common Mistakes

- Jumping straight to `search_docs` with an invented library filter.
- Using short keyword piles instead of a concrete natural-language query.
- Reading full pages too early and wasting context.
- Answering from model memory after DocShark returns no results instead of checking indexing state.
- Using `manage_library remove` when the user only asked to refresh or inspect coverage.