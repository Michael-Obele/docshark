<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { docsNavigation } from "$lib/content";

  let pathname = $derived(page.url.pathname);

  function isActive(href: string) {
    if (href === "/docs") return pathname === "/docs";
    return pathname === href;
  }
</script>

<Sidebar.Root
  variant="floating"
  collapsible="offcanvas"
  class="top-20 h-[calc(100svh-5.5rem)]"
>
  <Sidebar.Header class="px-3 pt-3">
    <a
      href="/docs"
      title="Go to Docs"
      class="soft-panel flex items-center justify-between rounded-[1.3rem] px-3 py-3 transition-transform hover:-translate-y-0.5"
    >
      <lord-icon
        src="https://cdn.lordicon.com/gxajzyky.json"
        trigger="hover"
        colors="primary:#4d8ddb,secondary:#f2f2f1"
        class="size-8"
        title="DocShark"
      >
      </lord-icon>
    </a>
    <div class="px-1 pt-3">
      <p class="section-kicker mb-2">DocShark notebook</p>
      <p class="text-sm leading-6 text-muted-foreground">
        Architecture notes, operational reference, and implementation guide.
      </p>
    </div>
  </Sidebar.Header>

  <Sidebar.Content class="px-2 pb-3">
    <Sidebar.Group>
      <Sidebar.GroupLabel class="section-kicker px-3"
        >Core pages</Sidebar.GroupLabel
      >
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each docsNavigation as item}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton isActive={isActive(item.href)}>
                {#snippet child({ props })}
                  <a href={item.href} {...props}>
                    <item.icon class="size-4" />
                    <span>{item.label}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>

  <Sidebar.Footer class="px-3 pb-3">
    <div
      class="soft-panel rounded-[1.3rem] px-4 py-4 text-sm leading-6 text-muted-foreground"
    >
      Prefer command-based MCP setup, local indexing, and search-first agent
      workflows.
    </div>
  </Sidebar.Footer>
</Sidebar.Root>
