---
applyTo: "**/*.{ts,svelte,js}"
---

# Docshark Site — Copilot Instructions

Copilot quick reference for the Docshark documentation site (SvelteKit + Tailwind CSS v4).

## Tech Stack & Architecture

| Tool                | Version          | Purpose                                                                      |
| ------------------- | ---------------- | ---------------------------------------------------------------------------- |
| **Runtime**         | Bun              | Preferred package manager and task runner (`bun`, `bunx`)                    |
| **Svelte**          | 5.51+            | Framework (runes only: `$state`, `$props`, `$derived`, `$effect`)            |
| **SvelteKit**       | 2.50+            | Meta-framework, file-based routing, adapters                                 |
| **TypeScript**      | 5.9+             | Strict type checking required                                                |
| **Tailwind CSS**    | 4.1+             | Vite-integrated. Prefer semantic classes & tokens. **NEVER use gradients**.  |
| **Components**      | Bits UI / shadcn | Headless primitives (Bits UI) and shadcn-style UI components                 |
| **Icons**           | @lucide/svelte   | Use `@lucide/svelte` ONLY (not `lucide-svelte`). Import icons as components. |
| **MDSvex**          | 0.12+            | Markdown preprocessor for `.svx` files                                       |
| **Netlify Adapter** | 6.0+             | SSR + serverless deployment                                                  |

## Essential Commands

```bash
bun run dev              # Start dev server
bun run build            # Production build → build/ directory
bun run check            # Type check + svelte-check
bun run check:watch      # Watch mode type checking
bun run preview          # Test production build locally
```

## Coding Conventions

### Quality Gate

- **Formatting**: Format ONLY edited files using `bunx prettier --write <file_path>`. Verify with `--check`. Avoid full-project formatting.
- **Proactive Checking**: Run `bun run check` immediately after substantive edits to catch regressions or type errors.
- **Error Handling**: Only warnings can be ignored; errors must be fixed immediately. Use `<svelte:boundary>` for async operations to handle loading and error states gracefully.

### Package Management

- **Installation**: Always install packages via CLI using `bun add <package>` or `bunx <package>` for one-time use. Never edit `package.json` directly.
- **Research**: Thoroughly research packages before installation to ensure Svelte 5 compatibility, bundle size, maintenance status, and alignment with project standards.

### Svelte 5 Runes (MANDATORY) ✓

- `$state(value)`: Declare reactive state. Use `$state.raw` for large objects/arrays that don't need deep reactivity.
- `$props()`: Receive component props. Destructure for clarity: `let { prop1, prop2 } = $props();`.
- `$derived(expression)`: Declare derived state. Use `$derived.by(() => ...)` for complex logic.
- `$effect(() => ...)`: Handle side effects (DOM, timers, etc.). Avoid for state synchronization.
- `$bindable()`: Mark a prop as bindable for two-way communication.
- `$inspect(value)`: Debug reactive state in development.
- **Events**: Use modern event attributes (e.g., `onclick`, `onsubmit`, `onchange`) directly on elements.

### Deprecated Svelte Patterns to Avoid ❌

Never use these Svelte 4 and earlier patterns:

- **State Management**: Never use `let` declarations at the top level for reactivity. Use `$state()` instead.
- **Reactive Statements**: Avoid `$:` for derived state or side effects. Use `$derived()` and `$effect()` instead.
- **Props**: Never use `export let` for component props. Use `$props()` destructuring instead.
- **Event Handlers**: Avoid `on:click={handler}` directives. Use `onclick={handler}` attributes instead.
- **Component Events**: Never use `createEventDispatcher`. Pass callback props instead.
- **Component Instantiation**: Avoid `new Component()`. Use `mount(Component, ...)` instead.
- **Lifecycle Hooks**: Avoid `beforeUpdate`/`afterUpdate`. Use `$effect.pre`/`$effect` instead.
- **Slots**: Avoid `<slot />`. Use `{@render children()}` with snippets instead.
- **Dynamic Components**: Avoid `<svelte:component this={Comp}>`. Use `<Comp />` directly.
- **Legacy Props**: Avoid `$$props` and `$$restProps`. Use destructuring in `$props()` instead.
- **Stores**: Prefer runes over Svelte stores for component-level state.
- **App State API**: Use `$app/state` (e.g., `import { page } from '$app/state'`) instead of `$app/stores` for accessing `page`, `navigating`, `updated`.

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/           # Shadcn-style UI components (Bits UI primitives)
│   │   │   ├── badge/
│   │   │   ├── button/
│   │   │   ├── card/
│   │   │   ├── input/
│   │   │   ├── sidebar/
│   │   │   └── ... (all export via index.ts barrel exports)
│   │   ├── docs/         # Documentation-specific components
│   │   └── blocks/       # Shared layout blocks
│   ├── content/
│   │   ├── docs.ts       # Docs registry + navigation metadata
│   │   ├── types.ts      # Content type definitions
│   │   └── index.ts      # Export all content metadata
│   └── hooks/
│       └── is-mobile.svelte.ts
├── routes/               # SvelteKit file-based routing (use .server.ts ONLY for load functions)
│   ├── +layout.svelte    # Root layout with header, footer
│   ├── +page.svelte      # Home page
│   └── docs/             # Docs routes
│       ├── +layout.svelte
│       ├── +page.svelte
│       └── [slug]/+page.svelte
├── content/
│   └── docs/             # Markdown doc files (.svx)
│       ├── index.svx
│       ├── getting-started.svx
│       └── ...
└── app.html              # HTML shell
```

## Styling & UI Design

- **Gradients**: NEVER use gradients; prefer solid colors, clean layouts, and professional minimalist aesthetics.
- **Tailwind v4**: Use semantic tokens from the CSS configuration. Avoid hardcoded HSL/Hex strings in components.
- **Responsive**: Use standard Tailwind responsive prefixes (e.g., `lg:flex-row`).
- **Utility**: Use a `cn` utility (clsx + tailwind-merge) for conditional class merging.

### Component Patterns

```html
<script lang="ts">
  interface Props {
    title: string;
    variant?: "primary" | "secondary";
  }

  let { title, variant = "primary" } = $props<Props>();
  let isOpen = $state(false);
  let doubled = $derived(total > 0 ? total : 0);

  $effect(() => {
    console.log(`Component mounted with title: ${title}`);
  });
</script>

<button class="..." onclick="{()" ="">
  isOpen = !isOpen} class:active={isOpen} > {title}
</button>
```

### UI Components (Bits UI + Tailwind)

1. **All components** go in `src/lib/components/ui/{component-name}/`
2. **Barrel exports** via `index.ts`:
   ```ts
   export { default as Button } from "./button.svelte";
   export { default as Card } from "./card.svelte";
   ```
3. **Compound components**: Use context (or `$props()` composition)
4. **Styling**: Tailwind only (no inline styles)
5. **Always use TypeScript**: `<script lang='ts'>` required in all components

## Content & Docs

### Adding Documentation

1. Create `.svx` file in `src/content/docs/` with MDSvex frontmatter
2. Register in `src/lib/content/docs.ts`:
   ```ts
   "my-feature": {
     slug: "my-feature",
     title: "My Feature",
     description: "...",
     order: 5,
     route: "/docs/my-feature",
   }
   ```
3. Create route at `src/routes/docs/my-feature/+page.svelte`:
   ```html
   <script>
     import Content from "../../../content/docs/my-feature.svx";
   </script>
   <content />
   ```

### MDSvex Components

- Use `<Callout>`, `<HighlightGrid>` and other custom components
- Located in `src/lib/components/docs/`

## Dark Mode

- **Library**: `mode-watcher` (automatic system detection)
- **Toggle**: `<ThemeToggle />` in `src/lib/components/theme-toggle.svelte`
- **CSS Variables**: Tailwind dark mode (no custom auth)

## Fonts & Typography

- **Headings**: Newsreader (variable, serif) — `@fontsource-variable/newsreader`
- **Body**: IBM Plex Sans (weights: 400, 500, 600) — `@fontsource/ibm-plex-sans`
- **Typography Plugin**: `@tailwindcss/typography` for markdown styling

## Deployment & Build

- **Adapter**: SvelteKit Netlify Adapter (auto SSR)
- **Build Output**: `build/` directory
- **Deploy Config**: `netlify.toml` (build command: `bun run build`)
- **Environment**: Auto-detects production via Node.js adapter

## When Adding Components

1. **Load the Svelte skill** → Use `#mcp_svelte_get-documentation` for API reference
2. **Load the Tailwind skill** → Use `#mcp_css_get_browser_compatibility` for CSS support
3. **Use Svelte autofixer** → `#mcp_svelte_svelte-autofixer` to validate code
4. **Reference Bits UI** → Headless primitives for accessibility + behavior
5. **Export via barrel** → Always add `export` to `index.ts`

## Common Pitfalls

⚠️ **No Svelte 4 syntax** — Will break the build. Runes are mandatory.  
⚠️ **No component state in routes** — Put complex state in a `.svelte.ts` service.  
⚠️ **No direct fetch in components** — Use loaders or SvelteKit page data instead.  
⚠️ **Type Props interface** — Prevents silent bugs and improves autocomplete.  
⚠️ **Dark mode in Tailwind config** — Already configured; use `dark:` prefix.  
⚠️ **No gradients** — Use solid colors and clean layouts instead.

## Common Workflows

- **Development**: `bun run dev` to start the dev server locally
- **Type Checking**: `bun run check` to verify all TypeScript and Svelte types
- **Building**: `bun run build` to create a production build
- **Preview**: `bun run preview` to test the production build locally

## AI Agent Integration

- **Memory MCP**: Persist useful context by writing to and reading from the Memory MCP during work to maintain consistency across sessions.
- **Svelte Docs**: Use `mcp_svelte_get-documentation` for the latest Svelte 5/Kit logic.
- **Code Validation**: Use `mcp_svelte_svelte-autofixer` to validate components before finalizing.
- **Tailwind Support**: Use `mcp_css_get_browser_compatibility` for browser support queries.

## Related Skills & Tools

- **Svelte Documentation**: `mcp_svelte_get-documentation` for API reference and patterns
- **Svelte Code Validation**: `mcp_svelte_svelte-autofixer` to fix and validate components
- **Tailwind CSS Support**: `mcp_css_get_browser_compatibility` for CSS feature support
- **Bits UI Components**: Search Bits UI documentation (via component docs)
- **Documentation Management**: Use documentation tools to maintain the MDSvex content library

---

**Last Updated**: March 2026  
**Maintained By**: Docshark Team
