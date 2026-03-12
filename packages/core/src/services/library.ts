// src/services/library.ts — Library management service
import { nanoid } from 'nanoid';
import type { Database } from '../storage/db.js';
import type { JobManager } from '../jobs/manager.js';
import type { Library } from '../types.js';

export class LibraryService {
    constructor(
        private db: Database,
        private jobManager: JobManager,
    ) { }

    /** Add a new documentation library and start crawling */
    async add(opts: {
        url: string;
        name?: string;
        version?: string;
        maxDepth?: number;
    }): Promise<Library & { jobId: string }> {
        const url = normalizeUrl(opts.url);
        const name = opts.name || generateName(url);
        const displayName = generateDisplayName(name);

        // Check if already exists
        const existing = this.db.getLibraryByName(name);
        if (existing) {
            throw new Error(`Library "${name}" already exists. Use refresh_library to re-crawl.`);
        }

        const id = nanoid();
        const crawlConfig = {
            maxDepth: opts.maxDepth ?? 3,
            renderer: 'auto' as const,
        };

        this.db.addLibrary({
            id,
            name,
            displayName,
            url,
            version: opts.version,
            crawlConfig,
        });

        // Start crawl job
        const job = this.jobManager.startCrawl(id);

        const library = this.db.getLibraryById(id)!;
        return { ...library, jobId: job.id };
    }
}

/** Normalize URL: ensure trailing slash for base docs */
function normalizeUrl(url: string): string {
    const parsed = new URL(url);
    // Remove trailing hash and query for base URL
    parsed.hash = '';
    return parsed.href;
}

/** Generate a slug name from URL */
function generateName(url: string): string {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/$/, '').replace(/^\//, '');

    if (path) {
        // e.g. svelte.dev/docs → "svelte-docs"
        const hostPart = host.split('.')[0];
        const pathPart = path.split('/').slice(0, 2).join('-');
        return `${hostPart}-${pathPart}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    // Just the hostname
    return host.replace(/\./g, '-').toLowerCase();
}

/** Generate a display name from the slug */
function generateDisplayName(name: string): string {
    return name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
