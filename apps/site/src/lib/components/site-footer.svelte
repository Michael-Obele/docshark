<script lang="ts">
  import Github from "@lucide/svelte/icons/github";
</script>

<footer class="border-t border-border/50 bg-muted/30">
  <div
    class="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8"
  >
    <div class="space-y-3">
      <lord-icon
        src="https://cdn.lordicon.com/gxajzyky.json"
        trigger="hover"
        class="size-16"
        title="DocShark"
      >
      </lord-icon>
      <p class="max-w-xl text-sm leading-6 text-muted-foreground">
        A local-first research notebook for software documentation. Crawl,
        index, and serve real docs to coding agents without adding a cloud layer
        to the workflow.
      </p>
    </div>
    <div class="flex flex-col gap-3 text-sm text-muted-foreground lg:items-end">
      <a
        href="https://github.com/Michael-Obele/docshark"
        class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
      >
        <Github class="size-4" />
        GitHub repository
      </a>
      <p class="max-w-sm leading-6 lg:text-right">
        Built for grounded documentation workflows and long-form technical
        reading.
      </p>
      <span>&copy; {new Date().getFullYear()} DocShark</span>
    </div>
  </div>
</footer>
