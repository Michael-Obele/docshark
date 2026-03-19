import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(scriptDir, "../../package.json");
const versionFilePath = resolve(scriptDir, "../version.ts");
const releaseVersion = process.env.DOCSHARK_VERSION?.trim();

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  version?: unknown;
};

const targetVersion =
  releaseVersion && releaseVersion.length > 0
    ? releaseVersion
    : packageJson.version;

if (typeof targetVersion !== "string") {
  throw new Error("packages/core/package.json is missing a valid version.");
}

const nextVersionFile = [
  "// This file is automatically updated by the version sync script.",
  `export const VERSION = '${targetVersion}';`,
  "",
].join("\n");

const currentVersionFile = readFileSync(versionFilePath, "utf8");

if (currentVersionFile !== nextVersionFile) {
  writeFileSync(versionFilePath, nextVersionFile, "utf8");
  console.log(`Updated src/version.ts to ${targetVersion}`);
} else {
  console.log(`src/version.ts already matches ${targetVersion}`);
}

if (releaseVersion && packageJson.version !== targetVersion) {
  const nextPackageJson = {
    ...packageJson,
    version: targetVersion,
  };

  writeFileSync(
    packageJsonPath,
    `${JSON.stringify(nextPackageJson, null, 2)}\n`,
    "utf8",
  );
  console.log(`Updated package.json to ${targetVersion}`);
}
