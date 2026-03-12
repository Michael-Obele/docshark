import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { VERSION } from "./version.js";

const PACKAGE_NAME = "docshark";
const REGISTRY_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const UPDATE_CHECK_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 2500;

type UpdateCheckCache = {
  latestVersion: string;
  checkedAt: number;
};

type RunUpdateOptions = {
  checkOnly?: boolean;
  quiet?: boolean;
};

export async function maybeNotifyAboutUpdate(options: {
  commandName: string;
  stdioMode: boolean;
}): Promise<void> {
  if (shouldSkipUpdateNotice(options)) {
    return;
  }

  const latestVersion = await getLatestVersion();
  if (!latestVersion || compareVersions(latestVersion, VERSION) <= 0) {
    return;
  }

  console.error(
    `\nA newer DocShark version is available: ${VERSION} -> ${latestVersion}.`,
  );
  console.error(
    `Run \"docshark update\" or \"bun add -g ${PACKAGE_NAME}@latest\".\n`,
  );
}

export async function runUpdateCommand(
  options: RunUpdateOptions = {},
): Promise<void> {
  const latestVersion = await getLatestVersion({ forceRefresh: true });
  if (!latestVersion) {
    printFallbackUpdateCommand(
      "Could not check the npm registry for the latest DocShark release.",
      options.quiet,
    );
    process.exit(1);
    return;
  }

  const hasUpdate = compareVersions(latestVersion, VERSION) > 0;

  if (options.checkOnly) {
    if (!options.quiet) {
      if (hasUpdate) {
        console.log(`\nUpdate available: ${VERSION} -> ${latestVersion}.\n`);
      } else {
        console.log(`\nDocShark is already up to date (${VERSION}).\n`);
      }
    }

    process.exit(hasUpdate ? 10 : 0);
    return;
  }

  if (!hasUpdate) {
    if (!options.quiet) {
      console.log(`\nDocShark is already up to date (${VERSION}).\n`);
    }
    return;
  }

  const bunPath = resolveBunExecutable();
  if (!bunPath) {
    printFallbackUpdateCommand(
      `A newer version is available (${VERSION} -> ${latestVersion}), but Bun was not detected on PATH.`,
      options.quiet,
    );
    process.exit(1);
    return;
  }

  if (!options.quiet) {
    console.log(
      `\nUpdating DocShark ${VERSION} -> ${latestVersion} with Bun...\n`,
    );
  }

  const exitCode = await spawnProcess(bunPath, [
    "add",
    "-g",
    `${PACKAGE_NAME}@latest`,
  ]);

  if (exitCode !== 0) {
    printFallbackUpdateCommand(
      `The Bun update command exited with code ${exitCode}.`,
      options.quiet,
    );
    process.exit(exitCode ?? 1);
  }

  if (!options.quiet) {
    console.log(`\nDocShark was updated to ${latestVersion}.\n`);
  }
}

function shouldSkipUpdateNotice(options: {
  commandName: string;
  stdioMode: boolean;
}): boolean {
  if (options.stdioMode || options.commandName === "update") {
    return true;
  }

  if (!process.stdout.isTTY || !process.stderr.isTTY || process.env.CI) {
    return true;
  }

  const rawFlag =
    process.env.DOCSHARK_DISABLE_UPDATE_CHECK?.trim().toLowerCase();
  return rawFlag === "1" || rawFlag === "true" || rawFlag === "yes";
}

async function getLatestVersion(options?: {
  forceRefresh?: boolean;
}): Promise<string | null> {
  if (!options?.forceRefresh) {
    const cached = await readCachedUpdateCheck();
    if (cached && Date.now() - cached.checkedAt < UPDATE_CHECK_TTL_MS) {
      return cached.latestVersion;
    }
  }

  const latestVersion = await fetchLatestVersion();
  if (!latestVersion) {
    const cached = await readCachedUpdateCheck();
    return cached?.latestVersion ?? null;
  }

  await writeCachedUpdateCheck({
    latestVersion,
    checkedAt: Date.now(),
  });
  return latestVersion;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(REGISTRY_LATEST_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { version?: unknown };
    return typeof payload.version === "string" ? payload.version : null;
  } catch {
    return null;
  }
}

async function readCachedUpdateCheck(): Promise<UpdateCheckCache | null> {
  try {
    const contents = await readFile(getUpdateCachePath(), "utf8");
    const parsed = JSON.parse(contents) as Partial<UpdateCheckCache>;
    if (
      typeof parsed.latestVersion !== "string" ||
      typeof parsed.checkedAt !== "number"
    ) {
      return null;
    }

    return {
      latestVersion: parsed.latestVersion,
      checkedAt: parsed.checkedAt,
    };
  } catch {
    return null;
  }
}

async function writeCachedUpdateCheck(cache: UpdateCheckCache): Promise<void> {
  try {
    const cachePath = getUpdateCachePath();
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(cache), "utf8");
  } catch {
    // Best-effort cache only.
  }
}

function getUpdateCachePath(): string {
  const baseCacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(baseCacheDir, PACKAGE_NAME, "update-check.json");
}

function resolveBunExecutable(): string | null {
  if (typeof Bun !== "undefined") {
    const bunOnPath = Bun.which("bun");
    if (bunOnPath) {
      return bunOnPath;
    }
  }

  return basename(process.execPath).startsWith("bun") ? process.execPath : null;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = parseNumericVersionPart(leftParts[index]);
    const rightValue = parseNumericVersionPart(rightParts[index]);
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function parseNumericVersionPart(part?: string): number {
  if (!part) {
    return 0;
  }

  const match = part.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function spawnProcess(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code));
  });
}

function printFallbackUpdateCommand(reason: string, quiet = false): void {
  if (quiet) {
    return;
  }

  console.error(`\n${reason}`);
  console.error(
    `Run \"bun add -g ${PACKAGE_NAME}@latest\" to update DocShark.\n`,
  );
}
