# Fallow Configuration Optimization

## Overview

DocShark now uses optimized Fallow configurations at two levels:

- **Root level** (`.fallowrc.json`) — workspace-wide analysis covering both `core` and `site` packages
- **Core level** (`packages/core/.fallowrc.json`) — focused MCP server library analysis

## Configuration Strategy

### Entry Points

**Root config:**

```json
"entry": [
  "packages/core/src/cli.ts",        // CLI entry
  "packages/core/src/server.ts",     // MCP server entry
  "packages/core/src/index.ts",      // Library exports
  "apps/site/src/routes/**/*.svelte", // Site routes
  "apps/site/src/lib/index.ts"       // Site library exports
]
```

**Core config:**

```json
"entry": [
  "src/cli.ts",     // CLI application
  "src/server.ts",  // MCP JSON-RPC server
  "src/index.ts"    // Public library API
]
```

### Ignore Patterns (False Positive Reduction)

**Excluded from analysis:**

- Build artifacts: `dist/**`, `build/**`, `.svelte-kit/**`
- Type definitions: `**/*.d.ts`
- Test files: `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`
- Generated/cache: `coverage/**`, `.fallow/**`, `.github/**`
- Documentation: `docs-mcp/**`
- Dependencies folder: `**/node_modules/**`

**Result:** Eliminates false positives from generated code, build outputs, and type stubs.

### Dynamic Loading

```json
"dynamicallyLoaded": [
  "packages/core/src/tools/**/*.ts"
]
```

Marks tool modules as entry points (they're loaded at runtime via `import()`), preventing false "unused file" reports.

### Code Duplication Tuning

```json
"duplicates": {
  "mode": "mild",          // Syntax-normalized comparison (not exact)
  "minTokens": 50,         // Min 50 tokens to be flagged
  "minLines": 5,           // Min 5 lines
  "minOccurrences": 3,     // Report only if 3+ duplicates (focus on real issues)
  "ignore": [
    "packages/core/src/processor/**",
    "packages/core/src/scraper/**",
    "apps/site/src/components/**"
  ]
}
```

**Rationale:** Processor/scraper modules legitimately have similar patterns. Component libraries have similar markup. `minOccurrences: 3` focuses on widespread copy-paste worth refactoring, not isolated pairs.

### Code Complexity Thresholds

```json
"health": {
  "maxCyclomatic": 15,         // Cyclomatic complexity limit
  "maxCognitive": 12,          // Cognitive complexity limit
  "maxCrap": 25,               // CRAP score (complexity × coverage)
  "ignore": [
    "packages/core/src/processor/extractor.ts",  // Complex HTML/Markdown processing
    "packages/core/src/search/**"                // Search algorithms
  ]
}
```

**Rationale:** Extractor (Readability + DOM rescue) and search (FTS5 query planning) are inherently complex. Thresholds allow other modules to maintain reasonable complexity.

### Rule Severity Levels

| Rule                      | Severity  | Rationale                                               |
| ------------------------- | --------- | ------------------------------------------------------- |
| `unused-files`            | **error** | Files should be reachable from entry points             |
| `unused-exports`          | **warn**  | Some exports may be external API or future-proofing     |
| `unused-types`            | **warn**  | Types may be for consumers of the library               |
| `unused-dependencies`     | **error** | High confidence (packages in package.json not used)     |
| `unused-dev-dependencies` | **warn**  | May be used in scripts/tests indirectly                 |
| `unresolved-imports`      | **error** | Broken imports (fail CI)                                |
| `unlisted-dependencies`   | **error** | Missing from package.json (broken)                      |
| `circular-dependencies`   | **error** | Architectural issue blocking refactoring                |
| `duplicate-exports`       | **warn**  | Usually accidental re-exports, low priority             |
| `boundary-violations`     | **warn**  | Informational, not blocking (no boundaries defined yet) |
| `test-only-dependencies`  | **warn**  | May be intentional in monorepos                         |
| `stale-suppressions`      | **warn**  | Old comments/JSDoc tags (clean up but non-blocking)     |
| `private-type-leaks`      | **off**   | Not needed for MCP server (no published .d.ts)          |
| `coverage-gaps`           | **off**   | Requires runtime coverage data                          |

## Usage

### Check for dead code issues

```bash
# Root workspace analysis
cd /home/node/Documents/GitHub/docshark
fallow dead-code --format json --quiet

# Core package only
cd packages/core
fallow dead-code --format json --quiet
```

### Check code duplication

```bash
fallow dupes --format json --quiet --mode mild
```

### Check complexity hotspots

```bash
fallow health --format json --quiet --complexity
```

### Fix unused exports/dependencies (preview)

```bash
fallow fix --dry-run --format json --quiet
```

### Fix with confirmation

```bash
fallow fix --yes --format json --quiet
```

## Current Findings (Baseline)

**Root workspace (108 issues):**

- 20 unused files
- 76 unused exports
- 9 unused types
- 1 unused dev dependency
- 1 duplicate export
- 1 circular dependency

**Core package (3 issues):**

- 3 unused class members in `jobs/manager.ts` and `scraper/rate-limiter.ts`

## Best Practices

1. **Config vs. Inline Suppression**
   - Use config-level `ignorePatterns` for broad patterns (tests, build artifacts)
   - Use `ignoreExports` for library patterns (public APIs you control)
   - Use inline `fallow-ignore` comments sparingly for individual false positives

2. **Library Public API**
   - Mark external API with JSDoc tags (`@public`, `@beta`, `@internal`) instead of suppression
   - Prevents false "unused export" reports for intentional library APIs

3. **CI Integration**

   ```bash
   # Fail on new issues in PRs without changing global config
   fallow dead-code --fail-on-issues --changed-since main
   ```

4. **Incremental Adoption**
   - Start with core package (lower issue count, easier to fix)
   - Graduate rules `error` → `error` as codebase cleans up
   - Use `--fail-on-regression` to prevent regressions

## References

- [Fallow Documentation](https://docs.fallow.tools)
- [Configuration Reference](https://docs.fallow.tools/configuration/overview)
- [Adoption Guide](https://docs.fallow.tools/adoption)
