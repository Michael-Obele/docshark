// src/http.ts — HTTP server (MCP + REST API + SSE + static dashboard)
import { serve } from 'srvx';
import { HttpTransport } from '@tmcp/transport-http';
import { SseTransport } from '@tmcp/transport-sse';
import { server, eventBus, db, searchEngine, jobManager, libraryService } from './server.js';
import { createApiRouter } from './api/router.js';
import { VERSION } from './version.js';

export async function startHttpServer(port: number) {
    const httpTransport = new HttpTransport(server, { path: '/mcp' });
    const sseTransport = new SseTransport(server, { path: '/sse' });
    const apiRouter = createApiRouter({ db, searchEngine, jobManager, libraryService, eventBus });

    const httpServer = serve({
        port,
        async fetch(request: Request) {
            const url = new URL(request.url);

            // 1. MCP Streamable HTTP transport
            if (url.pathname.startsWith('/mcp')) {
                const response = await httpTransport.respond(request);
                if (response) return response;
            }

            // 2. MCP SSE transport
            if (url.pathname.startsWith('/sse')) {
                const response = await sseTransport.respond(request);
                if (response) return response;
            }

            // 3. SSE endpoint for real-time crawl events
            if (url.pathname === '/api/crawl-events') {
                return handleCrawlSSE(request);
            }

            // 4. REST API for dashboard
            if (url.pathname.startsWith('/api/')) {
                return apiRouter.handle(request);
            }

            // 5. Root — server info
            return new Response(
                JSON.stringify({
                    name: 'DocShark',
                    version: VERSION,
                    description: '🦈 Documentation MCP Server',
                    endpoints: {
                        mcp: '/mcp',
                        sse: '/sse',
                        api: '/api',
                        crawlEvents: '/api/crawl-events',
                    },
                }),
                { headers: { 'Content-Type': 'application/json' } },
            );
        },
    });

    console.log(`\n🦈 DocShark running on http://localhost:${port}`);
    console.log(`   MCP (HTTP):  http://localhost:${port}/mcp`);
    console.log(`   MCP (SSE):   http://localhost:${port}/sse`);
    console.log(`   REST API:    http://localhost:${port}/api`);
    console.log(`   Health:      http://localhost:${port}/api/health\n`);

    return httpServer;
}

/** SSE handler for real-time crawl progress */
function handleCrawlSSE(request: Request): Response {
    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();

            const onProgress = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            eventBus.on('crawl:progress', onProgress);
            eventBus.on('crawl:complete', onProgress);
            eventBus.on('crawl:error', onProgress);

            request.signal.addEventListener('abort', () => {
                eventBus.off('crawl:progress', onProgress);
                eventBus.off('crawl:complete', onProgress);
                eventBus.off('crawl:error', onProgress);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
