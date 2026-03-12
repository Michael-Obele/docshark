---
title: "DocShark Website Repo Strategy Design"
date: 2026-03-12
status: draft
---

# Website Repo Strategy Design

## Decision

DocShark should keep the public website and the core application in the same Git repository, managed as a lightweight pnpm workspace monorepo.

```text
docshark/
├── apps/
│   ├── site/              # public SvelteKit website
│   └── dashboard/         # future local/internal SvelteKit app (reserved)
├── packages/
│   └── core/              # current DocShark CLI/MCP package
├── docs/                  # design docs (repo-wide, stays at root)
├── docs-mcp/              # MCP documentation (stays at root)
├── .github/               # unified CI workflows
├── package.json           # workspace root (private)
├── pnpm-workspace.yaml
├── tsconfig.base.json     # shared TypeScript config
├── pnpm-lock.yaml
└── README.md
```

## Scope

This design covers the public DocShark website only, not the embedded local dashboard.

The target website is hybrid:

- landing page and product messaging
- documentation and setup guides (MCP configuration, CLI usage)
- blog for longer-form posts and product updates
- changelog for release-focused announcements

The frontend stack constraint is fixed:

- SvelteKit for any web surface
- no Astro or alternative site framework

---

## Research: Three Approaches Evaluated

### Approach A: Separate Git Repository

**Pros:**

- Simple initial setup, no workspace tooling needed
- Independent CI/CD pipelines
- Clean separation of concerns

**Cons:**

- Documentation and install guides drift from actual CLI behavior
- Related changes require two pull requests across two repos
- Duplicated CI configuration and tooling maintenance
- Shared concerns (branding, screenshots, generated examples) become harder to coordinate

**Verdict:** Only makes sense if the website has a different team, different governance, or different visibility constraints. That is not the current DocShark shape. Rejected.

### Approach B: Monorepo with Bun Workspaces

Bun has native workspace support since v1.2 via the `"workspaces"` field in `package.json`. This was the preferred option since DocShark is a Bun-first project.

**Pros:**

- Single tool for both package management and runtime
- Zero-config workspace support (no extra yaml file)
- Ultra-fast installs and native TypeScript execution
- Third-party `bun-workspaces` CLI adds enhanced management

**Cons — Critical Open Bugs:**

- **[oven-sh/bun#16977](https://github.com/oven-sh/bun/issues/16977)** — "Workspace inter-dependencies not found during build" — confirmed bug, filed Feb 2025, still open as of March 2026. This means cross-package imports can fail during `bun build`. A dealbreaker for monorepo dependency linking.
- **[oven-sh/bun#16968](https://github.com/oven-sh/bun/issues/16968)** — "Vite/SvelteKit failed to load config from vite.config.ts" after running `bun install` or `bun add` — open since Feb 2025 with 20+ thumbs up, assigned but unfixed. Direct SvelteKit breakage after installs.
- **[oven-sh/bun#25801](https://github.com/oven-sh/bun/issues/25801)** — Workspace packages with symlinks not discovered during `bun install` — open since Jan 2026.
- **Changesets incompatibility** — Changesets does not support Bun workspaces natively. `workspace:*` references are not resolved during publish, requiring manual workarounds ([reference](https://ianm.com/posts/2025-08-18-setting-up-changesets-with-bun-workspaces)).
- **Ecosystem gaps** — Tools like shadcn-ui fail to detect Bun in monorepo contexts ([shadcn-ui/ui#9867](https://github.com/shadcn-ui/ui/issues/9867), March 2026).

**Verdict:** Too risky for production use with SvelteKit. The Vite config loading bug and workspace inter-dependency resolution bug are both blockers. Rejected for now, but worth revisiting if these bugs are fixed in late 2026.

### Approach C: Monorepo with pnpm Workspaces + Bun Runtime (Recommended)

**Pros:**

- **Battle-tested with SvelteKit** — SvelteKit core itself uses pnpm workspaces. This is the gold standard proof of compatibility.
- Mature workspace protocol — `workspace:*` references resolve correctly during publish
- Strict dependency isolation prevents phantom dependencies
- Content-addressable store means disk-efficient installs
- `pnpm --filter` allows targeted commands per package
- Changesets, release-please, Turborepo, and all major CI tools work seamlessly
- Broad documentation and community support

**Cons:**

- Two tools in one repo: pnpm for workspace management, bun for core runtime
- Contributors need to install both pnpm and bun (document clearly in CONTRIBUTING.md)

**Mitigation:** The "two tool" concern is minimal in practice. pnpm handles dependency installation and workspace linking. bun handles runtime execution for `packages/core`. The root `package.json` scripts make this transparent:

```json
{
  "dev:core": "bun run packages/core/src/cli.ts start",
  "dev:site": "pnpm --filter site dev"
}
```

This is a clean separation: pnpm = package management, bun = runtime. Many production projects follow this pattern.

**Verdict:** Recommended. Proven, stable, well-documented.

---

## Why Not A Separate Repo

A separate website repository creates structural friction that outweighs any simplicity gains:

- Product changes and docs/site updates require separate pull requests
- Install guides and examples drift from actual CLI behavior
- Duplicated tooling and CI configuration add maintenance cost
- Shared concerns (content, branding, screenshots, generated examples) are harder to coordinate

A separate repo only makes sense with different teams, governance, or visibility constraints. DocShark does not have those constraints.

## Why A Monorepo

Benefits:

- One issue tracker and one pull request can change code, docs, and site together
- Future dashboard work has a clean place to live (`apps/dashboard`)
- Shared config can be centralized over time
- Deployment remains separate per surface

Costs:

- A one-time repository reshape
- Release and CI configuration must be updated for new package paths
- Contributors need both pnpm and bun installed

Those costs are smaller than the long-term cost of splitting closely related surfaces.

---

## Recommended Setup

### Repository Shape

Lightweight pnpm workspace monorepo.

- `apps/site` — public SvelteKit website
- `packages/core` — current DocShark CLI/MCP package
- `apps/dashboard` — reserved for future local management UI
- `docs/` and `docs-mcp/` — stay at root (they are repo-wide)

Do not add extra packages until there is a clear need.

### Package Manager Strategy

**pnpm** for workspace orchestration. **Bun** for core package runtime.

Why pnpm over bun workspaces:

| Concern                             | pnpm                           | Bun Workspaces              |
| ----------------------------------- | ------------------------------ | --------------------------- |
| SvelteKit compatibility             | Used by SvelteKit core         | Open bugs (#16968, #16977)  |
| Workspace dependency resolution     | Mature, strict                 | Confirmed bugs in builds    |
| Changesets / release-please support | Full                           | Unsupported / workarounds   |
| Ecosystem tooling (shadcn, etc.)    | Fully detected                 | Detection failures          |
| Maturity                            | 10+ years of workspace support | ~2 years, still stabilizing |

This means:

- `pnpm install` at root installs all workspace dependencies
- `pnpm --filter <package>` runs commands in specific packages
- `bun run` continues to execute DocShark core scripts
- `bun:sqlite` and other Bun-specific APIs keep working unchanged

### Frontend Strategy

SvelteKit for the public site with:

- `@sveltejs/adapter-static` for prerendered static output
- `mdsvex` for docs, blog, and changelog content (Markdown + Svelte components)
- TypeScript throughout

The future dashboard can also use SvelteKit, but should remain a separate app since its runtime needs differ from the public static site.

---

## Deployment Model

Source control is unified. Deployments are separate.

- `apps/site` deploys independently as the public website (Vercel, Netlify, or Cloudflare Pages — point build to `apps/site`)
- `packages/core` continues to publish independently to npm via release-please
- `apps/dashboard` can later deploy separately or be embedded depending on product direction

One repository does not imply one deployment artifact.

---

## Configuration Files

### Root `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Root `package.json`

```json
{
  "name": "docshark-workspace",
  "private": true,
  "packageManager": "pnpm@10.x",
  "scripts": {
    "dev:site": "pnpm --filter site dev",
    "build:site": "pnpm --filter site build",
    "preview:site": "pnpm --filter site preview",
    "check:site": "pnpm --filter site check",
    "dev:core": "bun run packages/core/src/cli.ts start",
    "build:core": "cd packages/core && bun run build",
    "check:core": "bunx tsc --noEmit -p packages/core/tsconfig.json",
    "check": "pnpm check:core && pnpm check:site"
  }
}
```

### Root `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### Site App Baseline (`apps/site`)

Standard SvelteKit app configured for static output:

- SvelteKit + TypeScript
- `@sveltejs/adapter-static`
- `mdsvex`
- Tailwind CSS (deferred — decide at implementation time)

---

## Suggested Content Structure For The Site

```text
apps/site/src/
├── content/
│   ├── docs/          # install guides, MCP setup, CLI usage
│   ├── blog/          # longer-form posts and product updates
│   └── changelog/     # release-focused updates
├── lib/
│   ├── components/    # reusable Svelte components
│   └── content/       # content loading utilities
└── routes/
    ├── +layout.ts
    ├── +layout.svelte
    ├── +page.svelte   # landing page
    ├── docs/
    ├── blog/
    └── changelog/
```

Route responsibilities:

- `/` — landing page and product messaging
- `/docs` — install guides, MCP setup, usage documentation
- `/blog` — longer-form posts and product updates
- `/changelog` — release-focused updates and announcements

---

## Migration Plan

### Phase 1: Create The Monorepo Shell

```bash
# 1. Install pnpm if not already available
npm install -g pnpm

# 2. Create workspace directories
mkdir -p apps packages/core

# 3. Move current DocShark source into packages/core
#    Use git mv to preserve history
git mv src packages/core/src
git mv package.json packages/core/package.json
git mv tsconfig.json packages/core/tsconfig.json
git mv release-please-config.json packages/core/release-please-config.json
git mv CHANGELOG.md packages/core/CHANGELOG.md
git mv VERSIONING.md packages/core/VERSIONING.md
git mv turndown-plugin-gfm.d.ts packages/core/  # if applicable

# 4. Keep repo-wide files at root
#    README.md, LICENSE, docs/, docs-mcp/, AGENTS.md, .github/

# 5. Create root workspace files
#    - pnpm-workspace.yaml (see config above)
#    - Root package.json (see config above)
#    - tsconfig.base.json (see config above)

# 6. Install workspace dependencies
pnpm install

# 7. Verify core package still works
bun run packages/core/src/cli.ts --help
```

### Phase 2: Scaffold The Public Site

```bash
# 1. Create SvelteKit app in apps/site
cd apps
pnpm create svelte@latest site
# Choose: Skeleton project, TypeScript, ESLint, Prettier

# 2. Add static adapter and content tooling
cd site
pnpm add -D @sveltejs/adapter-static mdsvex

# 3. Configure adapter-static in svelte.config.js
# 4. Set up mdsvex for .md and .svx files
# 5. Create initial route structure
# 6. Create landing page, docs shell, changelog page
```

### Phase 3: Stabilize Tooling

1. Add root scripts for common development tasks
2. Ensure CI can install workspace dependencies and run checks per package
3. Update release-please config to point at `packages/core`
4. Add separate deploy workflow for `apps/site` (triggered on `apps/site/**` changes)
5. Add `CONTRIBUTING.md` documenting the dual pnpm + bun requirement

### Phase 4: Add Future Dashboard Only When Needed

1. Create `apps/dashboard` as a separate SvelteKit app
2. Decide later whether it deploys independently or is embedded into DocShark runtime
3. Do not force the dashboard architecture into the public website design now

---

## Non-Goals

- Creating a separate Git repository for the site
- Introducing Astro or another second frontend framework
- Adding Turborepo immediately (add only when build times become a real concern)
- Deciding the future embedded dashboard delivery model now
- Migrating away from release-please to changesets

## Deferred Decisions

These can wait until implementation:

- Whether to use Tailwind CSS in `apps/site`
- Whether changelog entries are generated from release metadata or authored manually
- Whether the future dashboard is embedded or independently deployed
- Whether to introduce Turborepo after the monorepo grows
- Whether to revisit Bun workspaces if critical bugs are fixed in late 2026

---

## Risk Register

| Risk                                                | Impact | Mitigation                                                               |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Bun workspace bugs get fixed, making pnpm redundant | Low    | Migration from pnpm to bun workspaces is straightforward if needed later |
| Contributors confused by dual pnpm + bun setup      | Medium | Clear CONTRIBUTING.md, root scripts abstract the difference              |
| release-please config breaks after path changes     | Medium | Test in a branch before merging the restructure                          |
| Site content drifts from CLI behavior               | Low    | Same repo means same PR can update both; CI can cross-check              |

---

## Recommendation Summary

DocShark should use **one Git repository** with a **pnpm workspace monorepo**.

- **pnpm** for workspace orchestration (proven with SvelteKit, mature, strict)
- **Bun** stays as the runtime for `packages/core` (unchanged)
- **Bun workspaces rejected** due to critical open bugs with SvelteKit/Vite compatibility
- **SvelteKit + adapter-static + mdsvex** for the public site in `apps/site`
- **Separate repo rejected** — adds long-term friction for no benefit at DocShark's scale
- Move current package to `packages/core`, keep `docs/` at root, deploy surfaces independently
