// src/stale.ts — Staleness detection for indexed libraries
import type { Database } from "./storage/db.js";
import type { Library } from "./types.js";

/**
 * Default freshness window: 14 days (2 weeks).
 * Override with the DOCSHARK_STALE_DAYS env var (clamped to 1–365).
 */
export const DEFAULT_STALE_DAYS = 14;

/** A library whose last crawl is outside the freshness window. */
export type StaleLibrary = Library & {
  /** Whole days since the last crawl (null = never crawled). */
  days_since_crawl: number | null;
};

/** Resolve the staleness threshold in days: explicit value > env > default, clamped to 1–365. */
export function getStaleDays(explicit?: number): number {
  const candidate =
    explicit ?? Number.parseInt(process.env.DOCSHARK_STALE_DAYS ?? "", 10);
  if (!Number.isFinite(candidate)) return DEFAULT_STALE_DAYS;
  return Math.min(365, Math.max(1, Math.trunc(candidate)));
}

/** Whole days elapsed since a SQLite `datetime('now')` timestamp ("YYYY-MM-DD HH:MM:SS", UTC). */
export function daysSinceCrawl(lastCrawledAt: string | null): number | null {
  if (!lastCrawledAt) return null;
  const crawledAt = Date.parse(`${lastCrawledAt.replace(" ", "T")}Z`);
  if (Number.isNaN(crawledAt)) return null;
  return Math.max(0, Math.floor((Date.now() - crawledAt) / 86_400_000));
}

/** Whether a single library is outside the freshness window (only `indexed` libraries can be stale). */
export function isStaleLibrary(lib: Library, days?: number): boolean {
  if (lib.status !== "indexed") return false;
  const age = daysSinceCrawl(lib.last_crawled_at);
  return age === null || age >= getStaleDays(days);
}

/** All indexed libraries whose last crawl is older than the freshness window. */
export function findStaleLibraries(
  db: Database,
  days?: number,
): StaleLibrary[] {
  return db.listStaleLibraries(getStaleDays(days)).map((lib) => ({
    ...lib,
    days_since_crawl: daysSinceCrawl(lib.last_crawled_at),
  }));
}

/** One-line description of a stale library, e.g. `svelte-5 (16d ago) — last crawled 2026-09-01 10:00:00`. Age comes first so narrow-terminal truncation drops only the date. */
export function formatStaleLibrary(lib: StaleLibrary): string {
  const age =
    lib.days_since_crawl === null
      ? "never crawled"
      : `${lib.days_since_crawl}d ago`;
  return `${lib.name} (${age}) — last crawled ${lib.last_crawled_at || "never"}`;
}
