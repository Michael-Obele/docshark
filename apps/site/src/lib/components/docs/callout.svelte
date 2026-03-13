<script lang="ts">
  import { Badge } from "$lib/components/ui/badge/index.js";

  type Tone = "note" | "tip" | "warning";

  let {
    title,
    tone = "note",
    label = "Notebook",
    children,
  }: {
    title: string;
    tone?: Tone;
    label?: string;
    children?: import("svelte").Snippet;
  } = $props();

  const toneClasses: Record<Tone, string> = {
    note: "border-primary/35 bg-primary/8 text-foreground",
    tip: "border-emerald-500/35 bg-emerald-500/10 text-foreground",
    warning: "border-amber-500/45 bg-amber-500/10 text-foreground",
  };
</script>

<section class={`my-8 rounded-2xl border p-5 ${toneClasses[tone]}`}>
  <div class="mb-3 flex items-center gap-2">
    <Badge
      variant="secondary"
      class="rounded-full px-2.5 py-0.5 text-[0.62rem] tracking-[0.14em] uppercase"
    >
      {label}
    </Badge>
    <h3 class="m-0 text-lg font-semibold leading-tight">{title}</h3>
  </div>
  <div class="text-sm leading-7 text-muted-foreground">
    {@render children?.()}
  </div>
</section>
