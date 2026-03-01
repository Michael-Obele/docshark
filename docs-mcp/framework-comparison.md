---
title: "Framework Comparison: TMCP vs Mastra for MCP Development"
status: draft
---

# Framework Comparison: TMCP vs Mastra

Deep analysis of frameworks for building the Docs MCP server. Research conducted using Exa search, Mastra docs, TMCP docs, and the arabold/docs-mcp-server architecture as reference.

← Back to [Plan Index](./index.md)

---

## Contenders

### 1. TMCP — [tmcp.io](https://tmcp.io)

**What it is:** A modern, composable TypeScript SDK purpose-built for creating MCP servers.

**Creator:** Paolo Ricciuti (Senior Software Engineer @ Mainmatter, core Svelte ecosystem contributor)

**Philosophy:** Web-standard `Request/Response` pattern, composable packages, pick-your-own-validator.

**Key Code Example:**
```typescript
import { McpServer } from 'tmcp';
import { tool } from 'tmcp/utils';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { StdioTransport } from '@tmcp/transport-stdio';
import * as v from 'valibot';

const server = new McpServer(
  { name: 'docs-mcp', version: '1.0.0' },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: { tools: {} },
  },
);

server.tool(
  {
    name: 'search_docs',
    description: 'Search indexed documentation',
    schema: v.object({
      query: v.string(),
      limit: v.optional(v.number(), 10),
    }),
  },
  async ({ query, limit }) => {
    const results = await searchIndex(query, limit);
    return tool.text(JSON.stringify(results));
  },
);

const stdio = new StdioTransport(server);
stdio.listen();
```

**Dashboard Integration Pattern:**
```typescript
import { HttpTransport } from '@tmcp/http-transport';

const transport = new HttpTransport(server, { path: '/mcp' });

Bun.serve({
  async fetch(request) {
    // MCP requests go to TMCP, everything else to dashboard
    return (await transport.respond(request)) ?? serveDashboard(request);
  },
});
```

### 2. Mastra — [mastra.ai](https://mastra.ai)

**What it is:** A full AI application framework for TypeScript — agents, workflows, memory, RAG, evaluations, and more. MCP server is one small feature.

**Key Code Example:**
```typescript
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const searchTool = createTool({
  id: 'search_docs',
  description: 'Search indexed documentation',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional().default(10),
  }),
  execute: async (input) => {
    const results = await searchIndex(input.query, input.limit);
    return JSON.stringify(results);
  },
});

const server = new MCPServer({
  id: 'docs-mcp',
  name: 'Docs MCP',
  version: '1.0.0',
  tools: { searchTool },
});

await server.startStdio();
```

### 3. Other Contenders (Eliminated)

| Framework                          | Stars | Why Eliminated                                                                   |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------- |
| **FastMCP** (`punkpeye/fastmcp`)   | 681   | Good but less composable than TMCP, Zod-locked                                   |
| **mcp-framework** (`QuantGeekDev`) | 612   | Directory-based discovery model — overkill for our use case                      |
| **Official MCP SDK**               | —     | Functional but verbose, Node-specific `Request/Response`, hard Zod v3 dependency |
| **Fiberplane MCP**                 | 12    | Too early, 19 commits                                                            |

---

## Head-to-Head Comparison

### API Surface

| Aspect            | TMCP                                                | Mastra                                                                  |
| ----------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Core import       | `McpServer` from `tmcp`                             | `MCPServer` from `@mastra/mcp` + `createTool` from `@mastra/core/tools` |
| Tool definition   | `server.tool({ name, schema }, handler)`            | `createTool({ id, inputSchema, execute })` then pass to constructor     |
| Schema library    | Any Standard Schema (Valibot, Zod, Arktype, Effect) | Zod only                                                                |
| Transport setup   | Separate package per transport                      | Built-in methods (`.startStdio()`, `.startSSE()`, `.startHTTP()`)       |
| Resource handling | Via capabilities + handlers                         | Via `resources` config object                                           |
| Prompt handling   | Via capabilities                                    | Via `prompts` config object                                             |
| Context typing    | `server.withContext<{ db: Db }>()`                  | Via `context.mcp.extra`                                                 |
| Pagination        | Built-in `pagination` option                        | Not documented                                                          |

### Ecosystem Fit

| Factor                     | TMCP                        | Mastra         |
| -------------------------- | --------------------------- | -------------- |
| Package manager preference | Bun ✓ (first-class)         | npm/pnpm focus |
| Frontend preference        | Svelte (Svecosystem origin) | React/Next.js  |
| Validation preference      | Valibot ✓                   | Zod only       |
| Runtime preference         | Bun, Deno, Node, Workers    | Node primarily |

### Dependencies

**TMCP (our project would need):**
```
tmcp                     ← core (~small)
@tmcp/adapter-valibot    ← schema adapter
@tmcp/transport-stdio    ← for local MCP
@tmcp/transport-http     ← for dashboard + remote MCP
valibot                  ← validation
```
Total: 5 packages, minimal dependency tree.

**Mastra (our project would need):**
```
@mastra/core             ← full AI framework core
@mastra/mcp              ← MCP server class
zod                      ← validation
```
Total: 3 packages, but `@mastra/core` alone pulls in a massive dependency tree (AI SDK, model routing, workflow engine, etc.) — none of which we use.

### Documentation

**TMCP Documentation Status (as of March 2026):**
- ✅ Introduction (what & why)
- ✅ Getting Started (CLI + manual install)
- ✅ McpServer class (initialization, adapters, instructions, pagination, context)
- ✅ Tool definition
- ❓ Resources, Prompts, Sessions — pages exist but depth unknown
- ❓ Advanced patterns, error handling — unclear
- ✅ [YouTube deep-dive](https://www.youtube.com/watch?v=zV0pcllxevk) (26 min)

**Mastra Documentation Status:**
- ✅ Comprehensive — 300+ reference pages
- ✅ MCPServer class fully documented (tools, agents, resources, prompts, elicitation)
- ✅ Multiple transport examples (STDIO, SSE, HTTP, Hono, serverless)
- ✅ Auth context, session management, serverless mode
- ✅ Interactive course, examples, templates

**Verdict:** Mastra wins documentation by a landslide, but TMCP's narrow focus means there's less to document. A developer reading TMCP's types can be productive quickly.

---

## Decision Matrix (Scored 1-5)

| Criterion                               | Weight | TMCP       | Mastra     |
| --------------------------------------- | ------ | ---------- | ---------- |
| Purpose alignment (MCP server building) | 5      | 5 = **25** | 2 = **10** |
| Bundle size / dependency weight         | 4      | 5 = **20** | 1 = **4**  |
| Schema validation flexibility           | 3      | 5 = **15** | 2 = **6**  |
| Runtime support (Bun/Node/Deno)         | 3      | 5 = **15** | 2 = **6**  |
| Dashboard integration pattern           | 4      | 5 = **20** | 2 = **8**  |
| Svelte/Bun/Valibot ecosystem fit        | 4      | 5 = **20** | 1 = **4**  |
| Documentation quality                   | 3      | 2 = **6**  | 5 = **15** |
| Community / maturity                    | 2      | 2 = **4**  | 4 = **8**  |
| Learning curve                          | 2      | 4 = **8**  | 3 = **6**  |
|                                         |        | **133**    | **67**     |

**Winner: TMCP (133 vs 67)**

---

## Risk Assessment

### TMCP Risks
1. **Doc gaps** — Mitigated by TypeScript types, YouTube talk, and small API surface
2. **Young project** — Mitigated by being based on web standards; worst case, migrate to official SDK (thin wrapper, low cost)
3. **Single maintainer risk** — Paolo Ricciuti is prolific (Svelte ecosystem, Mainmatter) but it's still a risk

### Mastra Risks
1. **Massive unused dependency** — Security surface, bundle bloat, version churn
2. **Framework lock-in** — Mastra's patterns don't transfer outside the Mastra ecosystem
3. **Overkill** — Importing an AI agent framework to build a docs scraper is architectural mismatch

---

## Final Recommendation

**Use TMCP.** It's purpose-built, lightweight, composable, and aligns perfectly with our tech stack preferences (Bun, Valibot, Svelte ecosystem). The documentation gap is a known trade-off, but the small API surface, excellent TypeScript types, and working CLI scaffold make it manageable.

Mastra is a great framework — for building AI agent applications. It's not the right tool for a documentation scraping MCP server.

← Back to [Plan Index](./index.md)
