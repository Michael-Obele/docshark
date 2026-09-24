/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import type { Database as BunDatabase } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  DEFAULT_STALE_DAYS,
  daysSinceCrawl,
  findStaleLibraries,
  formatStaleLibrary,
  getStaleDays,
  isStaleLibrary,
} from "../src/stale.js";
import { Database } from "../src/storage/db.js";

const tempDirs: string[] = [];
const openHandles: BunDatabase[] = [];

function createTempDatabase(): Database {
  const dataDir = mkdtempSync(join(tmpdir(), "docshark-stale-"));
  tempDirs.push(dataDir);
  process.env.DOCSHARK_DATA_DIR = dataDir;

  const db = new Database();
  db.init();
  openHandles.push(db.raw());
  return db;
}

function seedLibrary(
  db: Database,
  opts: {
    name: string;
    status?: string;
    lastCrawledAt?: string | null;
  },
) {
  db.addLibrary({
    id: opts.name,
    name: opts.name,
    displayName: opts.name.toUpperCase(),
    url: `https://${opts.name}.example.com/docs`,
  });
  db.raw()
    .prepare(
      `UPDATE libraries SET status = ?, last_crawled_at = ? WHERE name = ?`,
    )
    .run(
      opts.status ?? "indexed",
      opts.lastCrawledAt === undefined
        ? new Date().toISOString().replace("T", " ").slice(0, 19)
        : opts.lastCrawledAt,
      opts.name,
    );
}

afterEach(() => {
  for (const handle of openHandles.splice(0)) {
    handle.close();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.DOCSHARK_DATA_DIR;
  delete process.env.DOCSHARK_STALE_DAYS;
});

describe("stale detection", () => {
  test("flags only indexed libraries older than the window", () => {
    const db = createTempDatabase();

    seedLibrary(db, { name: "fresh-lib" }); // crawled now
    seedLibrary(db, {
      name: "old-lib",
      lastCrawledAt: "2026-01-01 00:00:00",
    });
    seedLibrary(db, { name: "never-lib", lastCrawledAt: null });
    seedLibrary(db, {
      name: "crawling-lib",
      status: "crawling",
      lastCrawledAt: "2026-01-01 00:00:00",
    });
    seedLibrary(db, {
      name: "error-lib",
      status: "error",
      lastCrawledAt: "2026-01-01 00:00:00",
    });

    const stale = findStaleLibraries(db);
    const names = stale.map((lib) => lib.name).sort();

    expect(names).toEqual(["never-lib", "old-lib"]);
    const never = stale.find((lib) => lib.name === "never-lib");
    expect(never?.days_since_crawl).toBeNull();
    const old = stale.find((lib) => lib.name === "old-lib");
    expect(old!.days_since_crawl).toBeGreaterThan(14);
  });

  test("respects a custom window", () => {
    const db = createTempDatabase();

    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    seedLibrary(db, { name: "old-lib", lastCrawledAt: tenDaysAgo });
    seedLibrary(db, { name: "never-lib", lastCrawledAt: null });

    const names30 = findStaleLibraries(db, 30).map((lib) => lib.name);
    expect(names30).toEqual(["never-lib"]);

    const names7 = findStaleLibraries(db, 7).map((lib) => lib.name).sort();
    expect(names7).toEqual(["never-lib", "old-lib"]);
  });

  test("getStaleDays resolves explicit > env > default and clamps", () => {
    expect(getStaleDays()).toBe(DEFAULT_STALE_DAYS);
    expect(DEFAULT_STALE_DAYS).toBe(14);

    process.env.DOCSHARK_STALE_DAYS = "7";
    expect(getStaleDays()).toBe(7);
    expect(getStaleDays(30)).toBe(30);

    process.env.DOCSHARK_STALE_DAYS = "not-a-number";
    expect(getStaleDays()).toBe(14);

    expect(getStaleDays(0)).toBe(1);
    expect(getStaleDays(9999)).toBe(365);
  });

  test("daysSinceCrawl parses SQLite datetime strings", () => {
    expect(daysSinceCrawl(null)).toBeNull();
    expect(daysSinceCrawl("not-a-date")).toBeNull();

    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    expect(daysSinceCrawl(twoDaysAgo)).toBe(2);
  });

  test("isStaleLibrary only flags indexed libraries", () => {
    const base = {
      id: "x",
      name: "x",
      display_name: "X",
      url: "https://x.example.com/",
      version: null,
      description: null,
      page_count: 0,
      chunk_count: 0,
      crawl_config: null,
      created_at: "2026-01-01 00:00:00",
      updated_at: "2026-01-01 00:00:00",
    } as const;

    expect(
      isStaleLibrary({
        ...base,
        status: "indexed",
        last_crawled_at: "2026-01-01 00:00:00",
      }),
    ).toBe(true);
    expect(
      isStaleLibrary({
        ...base,
        status: "indexed",
        last_crawled_at: null,
      }),
    ).toBe(true);
    expect(
      isStaleLibrary({
        ...base,
        status: "crawling",
        last_crawled_at: "2026-01-01 00:00:00",
      }),
    ).toBe(false);
    expect(
      isStaleLibrary({
        ...base,
        status: "indexed",
        last_crawled_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      }),
    ).toBe(false);
  });

  test("formatStaleLibrary includes name, date, and age", () => {
    const db = createTempDatabase();
    seedLibrary(db, { name: "old-lib", lastCrawledAt: "2026-01-01 00:00:00" });

    const [lib] = findStaleLibraries(db);
    const line = formatStaleLibrary(lib);
    expect(line).toContain("old-lib");
    expect(line).toContain("2026-01-01 00:00:00");
    expect(line).toMatch(/\(\d+d ago\)/);
  });
});
