<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";

  interface Item {
    title: string;
    body: string;
  }

  let {
    items,
  }: {
    items: Item[];
  } = $props();
</script>

<div class="my-8 grid gap-4 sm:grid-cols-2">
  {#each items as item (item.title)}
    <Card.Root class="rounded-2xl border-border/70 bg-card/70">
      <Card.Header class="pb-3">
        <Card.Title class="text-lg">{item.title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-sm leading-7 text-muted-foreground">{item.body}</p>
      </Card.Content>
    </Card.Root>
  {/each}
</div>
