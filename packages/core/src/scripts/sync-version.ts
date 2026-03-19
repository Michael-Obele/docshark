import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(scriptDir, "../../package.json");
const versionFilePath = resolve(scriptDir, "../version.ts");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  version?: unknown;
};

if (typeof packageJson.version !== "string") {
  throw new Error("packages/core/package.json is missing a valid version.");
}

const nextVersionFile = [
  "// This file is automatically updated by the version sync script.",
  `export const VERSION = '${packageJson.version}';`,
  "",
].join("\n");

const currentVersionFile = readFileSync(versionFilePath, "utf8");

if (currentVersionFile !== nextVersionFile) {
  writeFileSync(versionFilePath, nextVersionFile, "utf8");
  console.log(`Updated src/version.ts to ${packageJson.version}`);
} else {
  console.log(`src/version.ts already matches ${packageJson.version}`);
}
