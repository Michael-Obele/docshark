# Site Redesign Design

## Goal

Redesign the DocShark marketing site and documentation experience around a research-notebook aesthetic. The site should feel authored, layered, and reading-first rather than like a generic component-library docs site.

## Direction

The visual direction is a balanced research notebook:

- editorial typography for titles and section markers
- technical cyan and teal accents retained from the current identity
- warmer paper-like neutrals in light mode and ink-like dark surfaces in dark mode
- restrained motion and subtle texture
- stronger vertical rhythm and more generous spacing

## Product Decisions

### Keep mdsvex

The docs system should continue to use mdsvex. The redesign will convert the existing content files from `.md` to `.svx` so the content can use embedded Svelte components, richer frontmatter, and more expressive layouts.

### Selective app-shell upgrades

The docs experience will keep its current route structure but upgrade the shell with selected app-shell ideas:

- stronger left navigation using the existing shadcn-svelte sidebar primitives
- a richer document header and metadata block
- optional right-rail support for page metadata and table of contents on larger screens
- improved mobile docs navigation

## Visual System

### Typography

- Replace the current default-heavy stack with a more distinctive pairing.
- Use an editorial serif or display face for document titles and section intros.
- Use a clean sans-serif for body copy and UI text.
- Increase heading contrast, lead paragraph size, and prose spacing.

### Color

- Keep cyan and teal as the technical accent colors.
- Introduce warmer neutrals for light mode and deeper blue-black surfaces for dark mode.
- Use accent colors more like annotations than generic product-primary buttons.

### Texture and motion

- Add subtle background atmosphere and section dividers.
- Use restrained transitions for navigation, hover, and anchor interactions.
- Avoid dashboard-like animation density.

## Docs Shell

### Left rail

- Use grouped navigation with stronger active states.
- Make the navigation feel like a reading index rather than a plain button list.

### Main document

- Add a title block with description and metadata.
- Improve prose layout, spacing, code block presentation, and table styling.
- Support embedded notebook-style callouts and reference cards.

### Right rail

- On desktop, show page context such as reading notes, quick links, or a table of contents.
- Hide or collapse this rail on smaller screens.

## mdsvex Component Model

The redesign should add a small vocabulary of reusable components that can be embedded inside `.svx` documents:

- `Callout` for notes, warnings, and implementation details
- `CardGrid` for grouped concepts or feature overviews
- `SectionIntro` for stronger chapter-like transitions
- `DocMeta` or similar title/metadata wrapper
- `Accordion` for optional deep dives
- `Breadcrumb` in the page shell rather than inside the content body

These components should reuse existing shadcn-svelte primitives where practical.

## Content Migration

- Convert all files in `apps/site/src/content/docs` from `.md` to `.svx`.
- Update route imports accordingly.
- Preserve existing content while introducing richer structure where it improves clarity.
- Add stronger frontmatter support such as section label, optional status, and reading time if helpful.

## Homepage

The homepage should visually align with the docs system:

- annotated hero rather than a generic product splash
- stronger section hierarchy
- richer spacing and card treatment
- notebook-inspired supporting details that connect to the documentation experience

## Implementation Order

1. Update theme tokens and global visual system.
2. Redesign shared layout elements such as header and footer.
3. Upgrade the docs shell and navigation.
4. Add reusable mdsvex-friendly content components.
5. Convert docs content from `.md` to `.svx`.
6. Refresh the homepage to match the new system.
7. Validate Svelte files with the Svelte autofixer and run `bun check`.
