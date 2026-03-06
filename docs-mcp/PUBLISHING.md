# 🦈 Publishing DocShark to npm

DocShark is built with Bun and can be published to the npm registry as a standalone CLI tool and library.

## Preparation

1. Ensure the code is ready for release.
2. The version number in `package.json` should be correct (synced by `release-please-config.json`).
3. Build the project to generate the `dist/` folder:
   ```bash
   bun run build
   ```

## Local Verification

Before publishing, check what will be included in the package:

```bash
bun pm pack --dry-run
```

This command generates a summary of all files to be uploaded.

## Publishing Steps

1. **Login to npm**:
   If you aren't already logged in locally:
   ```bash
   npm login
   # or
   bun login
   ```
2. **Publish**:
   ```bash
   npm publish
   # or
   bun publish
   ```

## Consuming DocShark

Once published, users can:

- **Run the CLI directly**:
  ```bash
  npx docshark [command]
  ```
- **Install globally**:
  ```bash
  npm install -g docshark
  ```
- **Import as a library**:
  ```typescript
  import { db, libraryService, searchEngine } from "docshark";
  ```

## Maintenance

- **Update Version**: New releases are typically handled via `release-please`.
- **Files Included**: Only the `dist` folder, documentation, and LICENSE are included in the npm package to keep the install size minimal.
