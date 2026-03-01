---
title: "DocShark — Dashboard Specification"
status: draft
---

# Dashboard Specification

The DocShark dashboard is a SvelteKit app compiled to static HTML and embedded in the npm package. It serves alongside the MCP server on the same port.

← Back to [Plan Index](./index.md)

---

## Tech Stack

| Component  | Choice                                  | Rationale                                 |
| ---------- | --------------------------------------- | ----------------------------------------- |
| Framework  | SvelteKit                               | User preference, excellent static adapter |
| Styling    | Tailwind CSS v4                         | Rapid prototyping, consistent design      |
| Components | Shadcn Svelte                           | Accessible primitives, no custom builds   |
| Icons      | Lucide Svelte                           | Consistent icon set                       |
| Charts     | LayerChart (optional)                   | Svelte-native charting                    |
| SSE        | `sveltekit-sse` or native `EventSource` | Real-time crawl progress                  |
| Build      | `@sveltejs/adapter-static`              | Compiles to plain HTML/JS/CSS             |

## Pages & Routes

### 1. Dashboard Home (`/`)

The landing page. At-a-glance overview of the system.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  🦈 DocShark                    [Search]     [Settings ⚙]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 4        │ │ 241      │ │ 1,847    │ │ 12.4 MB  │      │
│  │ Libraries│ │ Pages    │ │ Chunks   │ │ Storage  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│  Quick Actions                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ + Add Library     │  │ 🔍 Search Docs   │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                            │
│  Recent Activity                                           │
│  ├─ ✅ svelte-5: 47 pages indexed (2 min ago)              │
│  ├─ ✅ tailwind-v4: 89 pages indexed (1 hour ago)          │
│  ├─ 🔄 better-auth: Crawling... 18/34 pages               │
│  └─ ❌ prisma: Failed — timeout on /api-reference          │
│                                                            │
│  Active Crawls                                             │
│  ┌────────────────────────────────────────────────┐        │
│  │ better-auth  ████████████░░░░░░░░  53%  18/34 │        │
│  └────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────┘
```

**Components:** `Card`, `Badge`, `Progress`, `Button`

---

### 2. Libraries (`/libraries`)

Full CRUD for documentation sources.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Libraries                           [+ Add Library]       │
├────────────────────────────────────────────────────────────┤
│  [Filter: All ▼]  [Search libraries...]                    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Name          URL                    Pages  Status   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 🟢 svelte-5   svelte.dev/docs        47    indexed  │→│
│  │ 🟢 sveltekit  svelte.dev/docs/kit    63    indexed  │→│  
│  │ 🟢 tailwind   tailwindcss.com/docs   89    indexed  │→│
│  │ 🔵 better-auth better-auth.com/docs  18    crawling │→│
│  │ 🔴 prisma     prisma.io/docs         0     error    │→│
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  Bulk Actions: [Refresh All] [Export Config]               │
└────────────────────────────────────────────────────────────┘
```

**Row Actions (on hover/click):** Refresh, View Pages, Edit Config, Delete

**Components:** `Table`, `Badge`, `Button`, `DropdownMenu`, `Input`

---

### 3. Add Library (`/libraries/add`)

Form + template browser for adding new doc sources.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Add Library                                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ Manual ──────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │  URL:        [https://svelte.dev/docs              ]  │ │
│  │  Name:       [svelte-5                             ]  │ │
│  │  Version:    [5.0        ] (optional)                 │ │
│  │  Max Depth:  [3  ▼]                                   │ │
│  │                                                        │ │
│  │  Advanced ▼                                            │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ Include patterns: [/docs/*                     ] │ │ │
│  │  │ Exclude patterns: [/blog/*, /changelog/*       ] │ │ │
│  │  │ Renderer:         [fetch (default) ▼           ] │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  [Start Crawling]                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                            │
│  ─── OR ───                                                │
│                                                            │
│  ┌─ Templates ───────────────────────────────────────────┐ │
│  │  Popular documentation sources (one-click add):       │ │
│  │                                                        │ │
│  │  Frameworks                                            │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │  │Svelte│ │React │ │Vue   │ │Next  │ │Nuxt  │       │ │
│  │  │  5   │ │ 19   │ │ 3    │ │ 15   │ │ 4    │       │ │
│  │  │ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │       │ │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │ │
│  │                                                        │ │
│  │  Tooling                                               │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │  │Tailw.│ │Prisma│ │Drizzl│ │Vite  │ │Tauri │       │ │
│  │  │ v4   │ │      │ │      │ │  6   │ │ 2    │       │ │
│  │  │ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │ │ [+]  │       │ │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │ │
│  │                                                        │ │
│  │  Auth & Data                                           │ │
│  │  ┌──────┐ ┌──────┐ ┌──────┐                           │ │
│  │  │Better│ │Supabase│ │MDN  │                           │ │
│  │  │ Auth │ │      │ │ Docs │                           │ │
│  │  │ [+]  │ │ [+]  │ │ [+]  │                           │ │
│  │  └──────┘ └──────┘ └──────┘                           │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

### 4. Library Detail (`/libraries/:id`)

Detailed view of a single library's pages and crawl history.

**Sections:**
- **Header:** Library name, URL, version, last crawled, status badge
- **Stats row:** Pages, chunks, storage size, avg chunks/page
- **Pages table:** title, path, chunk count, last updated — with search/filter
- **Crawl History:** timeline of past crawls with status, duration, pages crawled
- **Actions:** Refresh, Edit Config, Delete

---

### 5. Search Playground (`/search`)

Interactive search testing UI.

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Search Playground                                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────┐ [Search] │
│  │ svelte transitions fade                      │          │
│  └──────────────────────────────────────────────┘          │
│  Filter: [All Libraries ▼]    Results: 5 ▼                 │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📄 Transitions — svelte-5                    Score: 12│  │
│  │ Section: Built-in transitions > fade                  │  │
│  │                                                        │  │
│  │ Svelte provides several built-in transition           │  │
│  │ functions: `fade`, `fly`, `slide`, `blur`...          │  │
│  │                                                        │  │
│  │ ```svelte                                              │  │
│  │ <div transition:fade>fades in and out</div>            │  │
│  │ ```                                                    │  │
│  │                                                        │  │
│  │ Source: svelte.dev/docs/svelte/transition              │  │
│  │ [Copy as Context] [View Full Page →]                   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 📄 Custom transitions — svelte-5            Score: 8 │  │
│  │ Section: Transitions > Custom transitions             │  │
│  │ ...                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**"Copy as Context" button:** Formats the result as clean markdown context for pasting into an AI chat.

---

### 6. Crawl Monitor (`/crawls`)

Real-time crawl progress via Server-Sent Events (SSE).

**Active Crawls (SSE-driven, no polling):**
```
┌──────────────────────────────────────────────────────────┐
│ 🔄 better-auth                                           │
│ ████████████████████░░░░░░░░░░  53%   18/34 pages       │
│ Currently: /docs/plugins/two-factor                      │
│ Speed: ~2.1 pages/sec   ETA: ~8 seconds                 │
│ [Cancel]                                                  │
├──────────────────────────────────────────────────────────┤
│ 🔄 prisma                                                │
│ ██████░░░░░░░░░░░░░░░░░░░░░░░░  15%   12/82 pages      │
│ Currently: /docs/getting-started/setup                   │
│ Speed: ~1.4 pages/sec   ETA: ~50 seconds                │
│ [Cancel]                                                  │
└──────────────────────────────────────────────────────────┘
```

**SSE Implementation (SvelteKit):**
```typescript
// src/routes/api/crawl-events/+server.ts
export const GET: RequestHandler = async ({ request }) => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      eventBus.on('crawl:progress', (data) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      });

      request.signal.addEventListener('abort', () => {
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
```

---

### 7. Settings (`/settings`)

Configuration management.

**Sections:**
- **Server:** Port, data directory path, auto-start crawls
- **Search:** Default result limit, enable/disable vector search
- **Embeddings:** Provider selector (None / OpenAI / Ollama), API key input, model selector
- **Config:** Export all settings + libraries as JSON, Import from JSON file
- **Danger Zone:** Clear all data, reset to defaults

---

## Navigation

```
┌────────────────────────────────────┐
│  🦈 DocShark                       │
│                                    │
│  📊 Dashboard         /            │
│  📚 Libraries         /libraries   │
│  🔍 Search            /search      │
│  ⚡ Crawls            /crawls      │
│  ⚙️  Settings          /settings    │
│                                    │
│  ─────────────────                 │
│  MCP: ● Connected (STDIO)         │
│  Port: 6380                        │
│  v1.0.0                            │
└────────────────────────────────────┘
```

**Responsive:** Sidebar on desktop, bottom tabs on mobile.

## UX Flow: Adding a Library

```
1. User clicks "+ Add Library" (from Home or Libraries page)
2. → /libraries/add page loads
3. User enters URL: https://svelte.dev/docs
4. System auto-fetches <title> → suggests name "svelte-5"
5. User adjusts name/depth/filters if needed
6. User clicks "Start Crawling"
7. → Redirect to /crawls
8. Real-time progress bar updates via SSE:
   "Discovering pages... Found 47"
   "Crawling: 12/47 pages..."
   "Processing: converting to markdown..."
   "Indexing: creating search chunks..."
   "✅ Complete! 47 pages, 312 chunks indexed."
9. Library appears in /libraries with "indexed" badge
10. User can immediately search via /search or MCP tools
```

## UX Flow: Searching Documentation

```
1. User navigates to /search (or uses quick search in header)
2. Types query: "svelte component lifecycle"
3. Results appear in real-time (debounced, 300ms)
4. Each result shows:
   - Page title + library name
   - Heading breadcrumb (section context)
   - Relevant chunk with highlighted matches
   - Code blocks if present
   - Relevance score
5. User clicks "Copy as Context" → formatted markdown copied
6. User clicks "View Full Page →" → /libraries/:id/pages/:pageId
```

← Back to [Plan Index](./index.md)
