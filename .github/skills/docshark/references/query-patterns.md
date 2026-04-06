# Query Patterns For DocShark

Use these patterns when `search_docs` needs a better query.

## Prefer These Shapes

- `How does <library> handle <feature>?`
- `<library> <concept> examples and caveats`
- `<library> <error message> cause and fix`
- `<library> <API name> options and return value`
- `<library> <workflow> step by step`

## Good Query Rewrites

| Weak query | Better query |
| ---------- | ------------ |
| `svelte runes props` | `How do Svelte 5 runes handle component props?` |
| `better auth session` | `Better Auth session management and server-side session retrieval` |
| `tailwind grid cols` | `Tailwind CSS grid column utilities and responsive usage` |
| `zod union error` | `Zod union validation errors and how to inspect them` |

## When To Narrow With `library`

- After `list_libraries` shows the exact indexed name.
- After an unfiltered search returns mixed libraries.
- When the user asks for one library explicitly and you know the stored name.

## When To Read A Full Page

Use `get_doc_page` after `search_docs` when the snippet references:

- setup instructions
- multi-step examples
- option tables
- warnings or migration notes
- edge cases that depend on surrounding context