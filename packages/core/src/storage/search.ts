// src/storage/search.ts — FTS5 + BM25 search engine (bun:sqlite)
import type { Database } from './db.js';

export interface SearchResult {
    content: string;
    heading_context: string;
    page_url: string;
    page_title: string;
    library_name: string;
    library_display_name: string;
    relevance_score: number;
    has_code_block: boolean;
    token_count: number;
}

export class SearchEngine {
    constructor(private db: Database) { }

    search(query: string, opts: { library?: string; limit?: number } = {}): SearchResult[] {
        const limit = opts.limit ?? 5;
        const ftsQuery = this.sanitizeQuery(query);

        if (!ftsQuery) return [];

        try {
            const stmt = this.db.raw().prepare(`
        SELECT
          c.content,
          c.heading_context,
          c.has_code_block,
          c.token_count,
          p.url   AS page_url,
          p.title AS page_title,
          l.name  AS library_name,
          l.display_name AS library_display_name,
          bm25(chunks_fts, 1.0, 0.5) AS relevance_score
        FROM chunks_fts
        JOIN chunks c ON chunks_fts.rowid = c.rowid
        JOIN pages p  ON c.page_id = p.id
        JOIN libraries l ON c.library_id = l.id
        WHERE chunks_fts MATCH ?
          AND (? IS NULL OR l.name = ?)
        ORDER BY relevance_score
        LIMIT ?
      `);

            return stmt.all(ftsQuery, opts.library ?? null, opts.library ?? null, limit) as SearchResult[];
        } catch (err) {
            // FTS5 query might fail with bad syntax — return empty
            console.warn(`[DocShark] Search failed:`, (err as Error).message);
            return [];
        }
    }

    private sanitizeQuery(query: string): string {
        // Remove FTS5 special operators for safety, wrap terms in quotes
        return query
            .replace(/['"]/g, '')
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => `"${term}"`)
            .join(' OR ');
    }
}
