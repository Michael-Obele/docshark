<script lang="ts">
  import { toggleMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button/index.js";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
</script>

<Button
  variant="ghost"
  size="icon"
  class="relative rounded-full border border-border/80 bg-card/60 shadow-sm backdrop-blur"
  onclick={toggleMode}
  aria-label="Toggle theme"
>
  <Sun
    class="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
  />
  <Moon
    class="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
  />
  <span class="sr-only">Toggle theme</span>
</Button>
