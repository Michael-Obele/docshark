// src/tools/get-doc-page.ts — Full page retrieval
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { Database } from '../storage/db.js';

export function createGetDocPageTool(db: Database) {
    return {
        definition: {
            name: 'get_doc_page' as const,
            description:
                'Retrieve the complete content of a specific documentation page as markdown. ' +
                'Use this when search results reference a page and you need the full context, ' +
                'or when you know the exact page URL. Returns the entire page content.',
            schema: v.object({
                url: v.optional(
                    v.pipe(v.string(), v.description('The full URL of the documentation page.')),
                ),
                library: v.optional(
                    v.pipe(v.string(), v.description('Library name to search within.')),
                ),
                path: v.optional(
                    v.pipe(
                        v.string(),
                        v.description('Relative path within the library (e.g., "/getting-started").'),
                    ),
                ),
            }),
        },
        handler: async ({ url, library, path }: { url?: string; library?: string; path?: string }) => {
            const page = db.getPage({ url, library, path });

            if (!page) {
                return tool.text('Page not found. Use search_docs to find the correct page.');
            }

            return tool.text(
                `# ${page.title}\n**Source:** ${page.url}\n\n${page.content_markdown}`,
            );
        },
    };
}
