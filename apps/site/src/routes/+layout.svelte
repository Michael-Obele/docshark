<script lang="ts">
  import "./layout.css";
  import "@fontsource/ibm-plex-sans/400.css";
  import "@fontsource/ibm-plex-sans/500.css";
  import "@fontsource/ibm-plex-sans/600.css";
  import "@fontsource-variable/newsreader";
  import favicon from "$lib/assets/favicon.svg";
  import { browser } from "$app/environment";
  import { ModeWatcher } from "mode-watcher";
  import SiteHeader from "$lib/components/site-header.svelte";
  import SiteFooter from "$lib/components/site-footer.svelte";

  let { children } = $props();
</script>

{#if browser}
  <ModeWatcher defaultMode="dark" />
{/if}

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>DocShark — Documentation MCP Server</title>
  <meta
    name="description"
    content="Fast, local-first Model Context Protocol server that scrapes, indexes, and serves documentation from any website."
  />
</svelte:head>

<div class="site-grid flex min-h-svh flex-col">
  <SiteHeader />
  <main class="relative flex-1">
    {@render children()}
  </main>
  <SiteFooter />
</div>
