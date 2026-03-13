<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import ThemeToggle from "$lib/components/theme-toggle.svelte";
  import Menu from "@lucide/svelte/icons/menu";
  import Github from "@lucide/svelte/icons/github";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Terminal from "@lucide/svelte/icons/terminal";

  const nav = [
    { href: "/docs", label: "Docs", icon: BookOpen },
    { href: "/docs/tools-spec", label: "MCP Tools", icon: Terminal },
  ] as const;

  let mobileOpen = $state(false);
  let pathname = $derived(page.url.pathname);

  function isActive(href: string) {
    if (href === "/docs")
      return pathname === "/docs" || pathname.startsWith("/docs/");
    return pathname.startsWith(href);
  }
</script>

<header
  class="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl"
>
  <div
    class="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
  >
    <a
      href="/"
      class="group flex items-center gap-3 transition-opacity hover:opacity-80"
    >
      <lord-icon
        src="https://cdn.lordicon.com/gxajzyky.json"
        trigger="hover"
        class="size-12"
        title="DocShark"
      >
      </lord-icon>
      <span
        class="hidden text-[0.72rem] font-medium uppercase tracking-[0.26em] text-muted-foreground/80 lg:inline-flex"
      >
        annotated documentation engine
      </span>
    </a>

    <nav
      class="hidden items-center gap-1 rounded-full border border-border/70 bg-card/65 p-1 shadow-sm md:flex"
    >
      {#each nav as item}
        <Button
          variant={isActive(item.href) ? "secondary" : "ghost"}
          size="sm"
          href={item.href}
          class="gap-1.5 rounded-full px-4 text-sm"
        >
          <item.icon class="size-4" />
          {item.label}
        </Button>
      {/each}
    </nav>

    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        href="https://github.com/Michael-Obele/docshark"
        aria-label="GitHub"
        class="hidden rounded-full border border-border/70 bg-card/60 shadow-sm backdrop-blur sm:inline-flex"
      >
        <Github class="size-5" />
      </Button>
      <ThemeToggle />

      <!-- Mobile menu -->
      <div class="md:hidden">
        <Sheet.Root bind:open={mobileOpen}>
          <Sheet.Trigger>
            {#snippet child({ props })}
              <Button
                variant="ghost"
                size="icon"
                class="rounded-full border border-border/70 bg-card/60 shadow-sm backdrop-blur"
                {...props}
                aria-label="Open menu"
              >
                <Menu class="size-5" />
              </Button>
            {/snippet}
          </Sheet.Trigger>
          <Sheet.Content side="right">
            <Sheet.Header>
              <Sheet.Title>
                <lord-icon
                  src="https://cdn.lordicon.com/gxajzyky.json"
                  trigger="hover"
                  class="size-10"
                  title="DocShark"
                >
                </lord-icon>
              </Sheet.Title>
              <Sheet.Description class="sr-only"
                >Navigation menu</Sheet.Description
              >
            </Sheet.Header>
            <nav class="flex flex-col gap-2 pt-6">
              {#each nav as item}
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  href={item.href}
                  class="justify-start gap-2 rounded-full"
                  onclick={() => (mobileOpen = false)}
                >
                  <item.icon class="size-4" />
                  {item.label}
                </Button>
              {/each}
              <Button
                variant="ghost"
                href="https://github.com/Michael-Obele/docshark"
                class="justify-start gap-2 rounded-full"
                onclick={() => (mobileOpen = false)}
              >
                <Github class="size-4" />
                GitHub
              </Button>
            </nav>
          </Sheet.Content>
        </Sheet.Root>
      </div>
    </div>
  </div>
</header>
