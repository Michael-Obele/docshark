<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import Zap from "@lucide/svelte/icons/zap";
  import Database from "@lucide/svelte/icons/database";
  import Globe from "@lucide/svelte/icons/globe";
  import Search from "@lucide/svelte/icons/search";
  import Terminal from "@lucide/svelte/icons/terminal";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import BookOpen from "@lucide/svelte/icons/book-open";

  const features = [
    {
      icon: Globe,
      title: "Any Documentation Site",
      description:
        "Scrape and index docs from any website. Not limited to GitHub repos — works with rendered documentation sites.",
    },
    {
      icon: Database,
      title: "SQLite + FTS5 Search",
      description:
        "Blazing-fast full-text search powered by SQLite FTS5. Zero external dependencies, works entirely offline.",
    },
    {
      icon: Zap,
      title: "Local-First & Fast",
      description:
        "Everything runs locally on your machine. No cloud, no API keys, no rate limits. Just fast documentation access.",
    },
    {
      icon: Search,
      title: "Smart Chunking",
      description:
        "Intelligent content chunking preserves heading hierarchy and context for precise, relevant search results.",
    },
    {
      icon: Terminal,
      title: "MCP + CLI",
      description:
        "Full Model Context Protocol server for AI assistants, plus a Bun-first CLI for managing your documentation library.",
    },
    {
      icon: BookOpen,
      title: "Docs-First Setup",
      description:
        "Straightforward docs for Bun, bunx, Claude Desktop, Cursor, and VS Code keep setup predictable.",
    },
  ] as const;
</script>

<svelte:head>
  <title>DocShark — Fast, Local Documentation MCP Server</title>
</svelte:head>

<!-- Hero -->
<section class="relative overflow-hidden">
  <!-- Gradient background -->
  <div class="pointer-events-none absolute inset-0 -z-10">
    <div
      class="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent"
    ></div>
    <div
      class="absolute top-0 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
    ></div>
  </div>

  <div class="mx-auto max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20">
    <div class="flex flex-col items-center text-center">
      <Badge variant="secondary" class="mb-6 gap-1.5 px-3 py-1">
        <Zap class="size-3.5" />
        Open Source MCP Server
      </Badge>

      <h1
        class="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"
      >
        Documentation for AI,
        <span
          class="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent"
        >
          served locally
        </span>
      </h1>

      <p class="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
        DocShark scrapes, indexes, and serves documentation from any website
        through the Model Context Protocol. One package, unlimited doc sources,
        zero cloud dependency.
      </p>

      <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" href="/docs/getting-started" class="gap-2">
          Get Started
          <ArrowRight class="size-4" />
        </Button>
        <Button
          variant="outline"
          size="lg"
          href="https://github.com/Michael-Obele/docshark"
          class="gap-2"
        >
          <Terminal class="size-4" />
          View on GitHub
        </Button>
      </div>

      <!-- Quick install -->
      <div class="mt-10 w-full max-w-lg">
        <div
          class="rounded-lg border border-border/60 bg-card p-4 font-mono text-sm shadow-sm"
        >
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="select-none text-primary">$</span>
            <span class="text-foreground"
              >bunx docshark add https://svelte.dev/docs</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<Separator class="mx-auto max-w-6xl" />

<!-- Features -->
<section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
  <div class="mb-12 text-center">
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">Why DocShark?</h2>
    <p class="mt-4 text-lg text-muted-foreground">
      A single MCP server that replaces dozens of per-library documentation
      tools.
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each features as feature (feature.title)}
      <Card.Root
        class="border-border/50 bg-card/50 transition-colors hover:border-primary/30 hover:bg-card"
      >
        <Card.Header>
          <div
            class="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10"
          >
            <feature.icon class="size-5 text-primary" />
          </div>
          <Card.Title class="text-lg">{feature.title}</Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">{feature.description}</p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
</section>

<Separator class="mx-auto max-w-6xl" />

<!-- How it works -->
<section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
  <div class="mb-12 text-center">
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
    <p class="mt-4 text-lg text-muted-foreground">
      Three steps to supercharge your AI with documentation
    </p>
  </div>

  <div class="grid gap-8 sm:grid-cols-3">
    <div class="flex flex-col items-center text-center">
      <div
        class="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary"
      >
        1
      </div>
      <h3 class="mb-2 text-lg font-semibold">Add a library</h3>
      <p class="text-sm text-muted-foreground">
        Point DocShark at any docs URL. It crawls and indexes every page
        automatically.
      </p>
      <div
        class="mt-4 w-full rounded-lg border border-border/60 bg-card p-3 text-left font-mono text-xs"
      >
        <span class="text-primary">$</span> bunx docshark add https://docs.example.com
      </div>
    </div>

    <div class="flex flex-col items-center text-center">
      <div
        class="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary"
      >
        2
      </div>
      <h3 class="mb-2 text-lg font-semibold">Search instantly</h3>
      <p class="text-sm text-muted-foreground">
        Full-text search powered by SQLite FTS5 returns relevant chunks in
        milliseconds.
      </p>
      <div
        class="mt-4 w-full rounded-lg border border-border/60 bg-card p-3 text-left font-mono text-xs"
      >
        <span class="text-primary">$</span> bunx docshark search "query syntax"
      </div>
    </div>

    <div class="flex flex-col items-center text-center">
      <div
        class="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary"
      >
        3
      </div>
      <h3 class="mb-2 text-lg font-semibold">Connect to AI</h3>
      <p class="text-sm text-muted-foreground">
        Configure your AI assistant to use DocShark as an MCP server for
        grounded documentation.
      </p>
      <div
        class="mt-4 w-full rounded-lg border border-border/60 bg-card p-3 text-left font-mono text-xs"
      >
        <span class="text-muted-foreground">// mcp config</span><br />
        "command": "bunx docshark start --stdio"
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="border-t border-border/50 bg-muted/30">
  <div
    class="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24"
  >
    <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
      Ready to dive in?
    </h2>
    <p class="mt-4 text-lg text-muted-foreground">
      Get started with DocShark in under a minute. No API keys, no cloud
      accounts.
    </p>
    <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button size="lg" href="/docs/getting-started" class="gap-2">
        Read the Docs
        <ArrowRight class="size-4" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        href="/docs/getting-started"
        class="gap-2"
      >
        <Terminal class="size-4" />
        Bun install
      </Button>
    </div>
  </div>
</section>
