import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageJsonPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../package.json",
);

export const VERSION = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  .version as string;
