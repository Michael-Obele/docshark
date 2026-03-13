<script lang="ts">
  let { class: className = "" }: { class?: string } = $props();
</script>

<span
  class="inline-flex items-center gap-3 font-bold tracking-tight {className}"
>
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="size-8 rounded-full bg-primary/10 p-1.5"
    aria-hidden="true"
  >
    <!-- Shark fin silhouette -->
    <path
      d="M6 24C6 24 10 8 18 6C22 5 26 8 27 12C28 16 26 22 22 24H6Z"
      class="fill-primary"
    />
    <!-- Eye dot -->
    <circle cx="20" cy="13" r="1.5" class="fill-primary-foreground" />
    <!-- Wave line -->
    <path
      d="M4 26C8 24 12 28 16 26C20 24 24 28 28 26"
      class="stroke-primary/60"
      stroke-width="1.5"
      fill="none"
      stroke-linecap="round"
    />
  </svg>
  <span class="flex flex-col leading-none">
    <span class="text-[1.05rem] font-semibold tracking-tight">DocShark</span>
    <span class="text-[0.62rem] font-medium uppercase tracking-[0.28em] text-muted-foreground">
      research docs
    </span>
  </span>
</span>
