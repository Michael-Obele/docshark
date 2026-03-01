// src/api/router.ts — REST API for the dashboard
import type { Database } from '../storage/db.js';
import type { SearchEngine } from '../storage/search.js';
import type { JobManager } from '../jobs/manager.js';
import type { LibraryService } from '../services/library.js';
import { VERSION } from '../version.js';
import type { EventBus } from '../jobs/events.js';

interface ApiDeps {
    db: Database;
    searchEngine: SearchEngine;
    jobManager: JobManager;
    libraryService: LibraryService;
    eventBus: EventBus;
}

export function createApiRouter(deps: ApiDeps) {
    return {
        async handle(request: Request): Promise<Response> {
            const url = new URL(request.url);
            const path = url.pathname.replace(/^\/api/, '');
            const method = request.method;

            try {
                // GET /api/libraries
                if (method === 'GET' && path === '/libraries') {
                    const status = url.searchParams.get('status') || 'all';
                    const libs = deps.db.listLibraries(status);
                    return json(libs);
                }

                // POST /api/libraries
                if (method === 'POST' && path === '/libraries') {
                    const body = await request.json();
                    const lib = await deps.libraryService.add(body);
                    return json(lib, 201);
                }

                // DELETE /api/libraries/:id
                const deleteMatch = path.match(/^\/libraries\/(.+)$/);
                if (method === 'DELETE' && deleteMatch) {
                    deps.db.removeLibrary(deleteMatch[1]);
                    return json({ ok: true });
                }

                // POST /api/libraries/:id/refresh
                const refreshMatch = path.match(/^\/libraries\/(.+)\/refresh$/);
                if (method === 'POST' && refreshMatch) {
                    const job = deps.jobManager.startCrawl(refreshMatch[1]);
                    return json({ jobId: job.id });
                }

                // GET /api/search?q=...&library=...&limit=...
                if (method === 'GET' && path === '/search') {
                    const q = url.searchParams.get('q') || '';
                    const library = url.searchParams.get('library') || undefined;
                    const limit = parseInt(url.searchParams.get('limit') || '5');
                    const results = deps.searchEngine.search(q, { library, limit });
                    return json(results);
                }

                // GET /api/crawls
                if (method === 'GET' && path === '/crawls') {
                    const libraryId = url.searchParams.get('library_id') || undefined;
                    const jobs = deps.jobManager.listJobs(libraryId);
                    return json(jobs);
                }

                // GET /api/stats
                if (method === 'GET' && path === '/stats') {
                    const libs = deps.db.listLibraries();
                    return json({
                        libraries: libs.length,
                        pages: libs.reduce((s, l) => s + l.page_count, 0),
                        chunks: libs.reduce((s, l) => s + l.chunk_count, 0),
                    });
                }

                // GET /api/health
                if (method === 'GET' && path === '/health') {
                    return json({ status: 'ok', version: VERSION });
                }

                return new Response('Not Found', { status: 404 });
            } catch (err: any) {
                console.error('[DocShark API]', err);
                return json({ error: err.message }, 500);
            }
        },
    };
}

function json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
