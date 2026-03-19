# DocShark Site

This package contains the public DocShark website: a SvelteKit + mdsvex frontend for the project docs, onboarding flow, and product overview.

The site is part of the DocShark monorepo and is built to present the core project in a clear, search-friendly format. It is not the MCP server itself. The actual engine, CLI, and MCP tools live under `packages/core`.

## What this site includes

- A marketing-style homepage with project positioning and quick entry points
- A documentation section driven by mdsvex content files
- Responsive navigation, theme switching, and shared UI components
- Netlify deployment via the SvelteKit adapter

## Documentation structure

Docs content lives in `src/content/docs` and is wired into the navigation from `src/lib/content/docs.ts`.

Current docs pages:

- `Introduction`
- `Getting Started`
- `MCP Tools`
- `Scraping Pipeline`
- `Database Schema`
- `Project Structure`

The rendered routes are grouped under `/docs`, with the landing page at `/`.

## Development

Install dependencies from the repository root, then run the site with the workspace scripts:

```bash
pnpm install
pnpm dev:site
```

If you prefer working inside this package directly, the local scripts are:

```bash
npm run dev
npm run build
npm run preview
npm run check
```

## Build

Create a production build with:

```bash
pnpm build:site
```

or from inside `apps/site`:

```bash
npm run build
```

The production output is configured for Netlify and written to `build`.

## Content editing

- Update page copy in `src/content/docs/*.svx`
- Update doc metadata and sidebar order in `src/lib/content/docs.ts`
- Update the homepage in `src/routes/+page.svelte`
- Update shared layout, fonts, and metadata in `src/routes/+layout.svelte`

## Deployment

The site uses `@sveltejs/adapter-netlify` and is configured through `netlify.toml`.

When deploying from the monorepo, make sure the site build command is `pnpm build:site` and the publish directory is `apps/site/build`.

## Related project areas

- Core engine and MCP server: `packages/core`
- Project-wide scripts: root `package.json`
- Full project documentation: `docs-mcp`
