# CLI Update And Release Branch Cleanup Design

## Scope

- Add a Bun-first `docshark update` command.
- Notify interactive CLI users when their bundled version is behind the latest npm release.
- Skip update notices for MCP `stdio` mode so protocol output stays clean.
- Delete repository-owned `release-please--...` branches after the pull request is closed or merged.

## Approach

DocShark is treated as a Bun-first CLI. The update command checks the npm registry for the latest published package version and, when Bun is available, runs `bun add -g docshark@latest`. If Bun cannot be resolved, the CLI prints the fallback command instead of attempting npm or Node-specific flows.

Version notifications are best-effort and cached under the user cache directory to avoid repeated network requests. Notices are shown only on interactive CLI commands and are skipped for `start --stdio`, `update`, CI, and explicit opt-out via `DOCSHARK_DISABLE_UPDATE_CHECK`.

Release Please branch cleanup is handled by a dedicated GitHub Actions workflow on `pull_request.closed`. It only targets branches owned by the repository and only when the branch name starts with `release-please--`.

## Validation

- Run `bun run check`.
- Exercise `bun run src/cli.ts --help`.
- Exercise `bun run src/cli.ts update` in a controlled environment when Bun is available.
- Let GitHub Actions validate workflow syntax on the next pull request.
