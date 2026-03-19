import type { RequestEvent } from "@sveltejs/kit";

const publicPages = [
  {
    title: "Home",
    href: "/",
    description: "Overview, install path, and quick CLI entry points.",
  },
  {
    title: "Docs",
    href: "/docs",
    description: "Documentation hub and navigation entry point.",
  },
  {
    title: "Getting Started",
    href: "/docs/getting-started",
    description: "Bun install, bunx usage, and MCP client configuration.",
  },
  {
    title: "MCP Tools",
    href: "/docs/tools-spec",
    description:
      "Tool reference for add, search, list, get, refresh, and remove.",
  },
  {
    title: "Scraping Pipeline",
    href: "/docs/scraping-pipeline",
    description:
      "Discovery, fetching, extraction, chunking, and indexing flow.",
  },
  {
    title: "Database Schema",
    href: "/docs/database-schema",
    description: "SQLite and FTS5 schema design.",
  },
  {
    title: "Project Structure",
    href: "/docs/project-structure",
    description: "Package layout and architecture map.",
  },
] as const;

export function GET({ url }: RequestEvent) {
  const origin = url.origin;
  const lines = [
    "# DocShark",
    "",
    "> DocShark is a local-first documentation MCP server for Bun-based workflows. It scrapes documentation sites, stores them in SQLite + FTS5, and serves fast search results to AI assistants.",
    "",
    "## Core Docs",
    ...publicPages.map(
      (page) => `- [${page.title}](${origin}${page.href}): ${page.description}`,
    ),
    "",
    "## CLI",
    `- [Getting Started](${origin}/docs/getting-started): Bun and bunx install instructions plus example commands.`,
    "",
    "## MCP",
    `- [MCP Tools](${origin}/docs/tools-spec): Complete tool reference and usage patterns.`,
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
