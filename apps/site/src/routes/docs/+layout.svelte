<script lang="ts">
  import { page } from "$app/state";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import DocsSidebar from "$lib/components/docs/docs-sidebar.svelte";
  import { docs, getAdjacentDocs } from "$lib/content";

  let { children } = $props();
  let pathname = $derived(page.url.pathname);
  const currentDoc = $derived(
    Object.values(docs).find((doc) => doc.route === pathname) ?? docs.index,
  );
  const adjacentDocs = $derived(getAdjacentDocs(currentDoc.slug));
</script>

<Sidebar.Provider
  style="--sidebar-width: 18rem; --sidebar-width-mobile: 18rem;"
>
  <DocsSidebar />

  <Sidebar.Inset class="bg-transparent">
    <div class="mx-auto w-full max-w-400 px-3 pb-10 pt-4 sm:px-6 lg:px-8">
      <div class="mb-6 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p class="section-kicker mb-2">Documentation notebook</p>
          <p class="text-sm text-muted-foreground">
            Field guide for DocShark internals
          </p>
        </div>
        <Sidebar.Trigger
          class="rounded-full border border-border/70 bg-card/70 shadow-sm"
        />
      </div>

      <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <article
          class="paper-panel min-w-0 rounded-[2rem] px-5 py-8 sm:px-8 lg:px-10 xl:px-12"
        >
          <div
            class="mb-8 flex flex-wrap items-center gap-3 border-b border-border/70 pb-6 text-sm text-muted-foreground"
          >
            <a href="/" class="transition-colors hover:text-foreground">Home</a>
            <span>/</span>
            <a href="/docs" class="transition-colors hover:text-foreground"
              >Docs</a
            >
            <span>/</span>
            <span class="text-foreground">{currentDoc.title}</span>
          </div>

          <div class="docs-prose max-w-none">
            {@render children()}
          </div>

          <div
            class="mt-12 grid gap-4 border-t border-border/70 pt-8 md:grid-cols-2"
          >
            {#if adjacentDocs.prev}
              <a
                href={adjacentDocs.prev.route}
                class="soft-panel rounded-[1.4rem] p-4 transition-transform hover:-translate-y-0.5"
              >
                <p class="section-kicker mb-2">Previous note</p>
                <p class="font-medium text-foreground">
                  {adjacentDocs.prev.title}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  {adjacentDocs.prev.description}
                </p>
              </a>
            {:else}
              <div></div>
            {/if}

            {#if adjacentDocs.next}
              <a
                href={adjacentDocs.next.route}
                class="soft-panel rounded-[1.4rem] p-4 text-left transition-transform hover:-translate-y-0.5 md:text-right"
              >
                <p class="section-kicker mb-2">Next note</p>
                <p class="font-medium text-foreground">
                  {adjacentDocs.next.title}
                </p>
                <p class="mt-2 text-sm text-muted-foreground">
                  {adjacentDocs.next.description}
                </p>
              </a>
            {/if}
          </div>
        </article>

        <aside class="hidden xl:flex xl:flex-col xl:gap-4">
          <div class="soft-panel rounded-[1.5rem] p-5">
            <p class="section-kicker mb-3">Reading note</p>
            <h2 class="text-xl font-semibold tracking-tight text-foreground">
              {currentDoc.title}
            </h2>
            <p class="mt-3 text-sm leading-6 text-muted-foreground">
              {currentDoc.description}
            </p>
            {#if currentDoc.readingTime}
              <p
                class="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                {currentDoc.section} · {currentDoc.readingTime}
              </p>
            {/if}
          </div>

          {#if currentDoc.highlights?.length}
            <div class="soft-panel rounded-[1.5rem] p-5">
              <p class="section-kicker mb-3">Highlights</p>
              <ul class="space-y-3 text-sm leading-6 text-muted-foreground">
                {#each currentDoc.highlights as highlight}
                  <li class="border-l border-border/80 pl-3">{highlight}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </aside>
      </div>
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
