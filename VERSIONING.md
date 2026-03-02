# Versioning & Commits Guide

We strictly use **Conventional Commits** to trigger our automated GitHub Release Action (Google Release Please). 

Because DocShark is currently in the **`0.x.x` (pre-major) phase**, the version bump logic is scaled down to allow for steady, slower iteration without immediately jumping to version `1.0.0` or `2.0.0`.

Here is the exact quick-reference logic on what commit prefix triggers what version bump.

---

## 🟢 Patch Bumps (e.g., `0.1.0` ➡️ `0.1.1`)

Use standard prefixes for daily updates, new features, and bug fixes. Because of our `pre-major` configuration, both `fix` and `feat` will increment the last digit (`0.0.1`).

* `fix: prevent crash on broken links`
* `feat: add support for local file scraping`
* `perf: improve SQLite concurrent reads`

> **Note:** If you merge a branch with 5 `feat:` commits and 3 `fix:` commits, it will still only bump by `0.0.1` overall when grouped into one release.

---

## 🟡 Minor Bumps (e.g., `0.1.0` ➡️ `0.2.0`)

When we make massive rewrites or **breaking changes** to the backend API, we want to increment the middle digit (`0.1.0`). To do this, you must explicitly flag the commit as a **Breaking Change**.

You do this by adding an exclamation mark `!` immediately **before** the colon, or by adding `BREAKING CHANGE:` to the commit footer.

* `feat!: complete rewrite of the database schema`
* `refactor!: switched CLI arguments format`

---

## ⚪ Ignored Commits (No version bump)

These prefixes will be included in the Git history but will **NOT** trigger a new version release or show up in the automated changelog's "Features"/"Fixes" list.

* `docs: update readme with usage instructions`
* `chore: update dependencies`
* `test: add unit tests for search api`
* `style: run prettier formatter across files`
* `ci: update workflow branch from main to master`

*Remember:* If you merge a pull request containing only `docs:` or `chore:` commits, no new version or changelog entry will be generated.
