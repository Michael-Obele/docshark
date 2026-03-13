import type { DocMeta, NavItem } from "./types";
import BookOpen from "@lucide/svelte/icons/book-open";
import Database from "@lucide/svelte/icons/database";
import Layers from "@lucide/svelte/icons/layers";
import Wrench from "@lucide/svelte/icons/wrench";
import FolderTree from "@lucide/svelte/icons/folder-tree";
import Rocket from "@lucide/svelte/icons/rocket";

/**
 * Content metadata registry
 * Extracted from frontmatter in src/content/docs/*.svx
 * Single source of truth for documentation structure and navigation
 */
export const docs: Record<string, DocMeta> = {
  index: {
    slug: "index",
    title: "Introduction",
    description:
      "DocShark is a fast, local-first MCP server that scrapes, indexes, and serves documentation from any website.",
    order: 1,
    route: "/docs",
    section: "Overview",
    readingTime: "4 min read",
    highlights: [
      "Single MCP server for many documentation sources",
      "Local-first indexing with SQLite FTS5",
      "Designed for rendered docs, not just repositories",
    ],
  },
  "getting-started": {
    slug: "getting-started",
    title: "Getting Started",
    description:
      "Install and configure DocShark as an MCP server for your AI coding assistant.",
    order: 2,
    route: "/docs/getting-started",
    section: "Setup",
    readingTime: "5 min read",
    highlights: [
      "Works with Claude Desktop, Cursor, and VS Code",
      "Can be installed globally or run ad hoc with bunx or npx",
      "Command-based MCP setup stays lightweight",
    ],
  },
  "tools-spec": {
    slug: "tools-spec",
    title: "MCP Tools",
    description:
      "Complete specification of all available MCP tools and their parameters.",
    order: 3,
    route: "/docs/tools-spec",
    section: "Reference",
    readingTime: "6 min read",
    highlights: [
      "Six-tool MCP workflow tuned for agent use",
      "Read-heavy operations are explicit and retry-safe",
      "Search-first flow keeps tool selection simple",
    ],
  },
  "scraping-pipeline": {
    slug: "scraping-pipeline",
    title: "Scraping Pipeline",
    description:
      "Understanding the document scraping, processing, and indexing pipeline.",
    order: 4,
    route: "/docs/scraping-pipeline",
    section: "Architecture",
    readingTime: "6 min read",
    highlights: [
      "Cascading discovery strategy from sitemap to BFS crawl",
      "Readable extraction pipeline preserves code and structure",
      "Heading-aware chunking feeds precise search results",
    ],
  },
  "database-schema": {
    slug: "database-schema",
    title: "Database Schema",
    description:
      "SQLite database design with FTS5 full-text search for documentation indexing.",
    order: 5,
    route: "/docs/database-schema",
    section: "Architecture",
    readingTime: "5 min read",
    highlights: [
      "SQLite with bundled FTS5 and no external services",
      "Chunk index stays synchronized via triggers",
      "Schemas are optimized for crawl updates and retrieval",
    ],
  },
  "project-structure": {
    slug: "project-structure",
    title: "Project Structure",
    description: "Directory layout and organization of the DocShark codebase.",
    order: 6,
    route: "/docs/project-structure",
    section: "Architecture",
    readingTime: "4 min read",
    highlights: [
      "Separate entry points for CLI, MCP, and HTTP",
      "Worker pipeline is isolated from storage and transport layers",
      "Tools, services, and storage remain intentionally narrow",
    ],
  },
};

/**
 * Navigation items sorted by order
 * Use this in layout components for menu generation
 */
export const docsNavigation: NavItem[] = [
  {
    label: docs.index.title,
    href: docs.index.route,
    icon: BookOpen,
  },
  {
    label: docs["getting-started"].title,
    href: docs["getting-started"].route,
    icon: Rocket,
  },
  {
    label: docs["tools-spec"].title,
    href: docs["tools-spec"].route,
    icon: Wrench,
  },
  {
    label: docs["scraping-pipeline"].title,
    href: docs["scraping-pipeline"].route,
    icon: Layers,
  },
  {
    label: docs["database-schema"].title,
    href: docs["database-schema"].route,
    icon: Database,
  },
  {
    label: docs["project-structure"].title,
    href: docs["project-structure"].route,
    icon: FolderTree,
  },
];

/**
 * Get documentation metadata by slug
 * Useful for page metadata (title, description) generation
 */
export function getDocMeta(slug: string): DocMeta | undefined {
  return docs[slug];
}

/**
 * Get previously/next document in navigation order
 */
export function getAdjacentDocs(slug: string): {
  prev: DocMeta | null;
  next: DocMeta | null;
} {
  const sorted = Object.values(docs).sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((doc) => doc.slug === slug);

  return {
    prev: currentIndex > 0 ? sorted[currentIndex - 1] : null,
    next: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null,
  };
}
