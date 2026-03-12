// src/types.ts — Shared type definitions for DocShark

export interface Library {
    id: string;
    name: string;
    display_name: string;
    url: string;
    version: string | null;
    description: string | null;
    status: 'pending' | 'crawling' | 'indexed' | 'error';
    page_count: number;
    chunk_count: number;
    crawl_config: string | null;
    last_crawled_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Page {
    id: string;
    library_id: string;
    url: string;
    path: string;
    title: string | null;
    content_markdown: string | null;
    content_hash: string | null;
    headings: string | null;
    http_status: number | null;
    last_modified: string | null;
    etag: string | null;
    created_at: string;
    updated_at: string;
}

export interface ChunkRecord {
    id: string;
    page_id: string;
    library_id: string;
    content: string;
    heading_context: string;
    chunk_index: number;
    token_count: number;
    has_code_block: number;
    created_at: string;
}

export interface CrawlJob {
    id: string;
    library_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    pages_discovered: number;
    pages_crawled: number;
    pages_failed: number;
    chunks_created: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

export interface FetchResult {
    html: string;
    renderer: 'fetch' | 'puppeteer';
    status: number;
    etag?: string | null;
    lastModified?: string | null;
    unchanged?: boolean;
    contentType?: string;
}

export interface CrawlConfig {
    renderer?: 'auto' | 'fetch' | 'puppeteer';
    maxDepth?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
    rateLimit?: number;
    waitForSelector?: string;
    waitTimeout?: number;
}
