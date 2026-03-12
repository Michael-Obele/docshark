// src/tools/list-libraries.ts — Discovery tool
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { Database } from '../storage/db.js';

export function createListLibrariesTool(db: Database) {
    return {
        definition: {
            name: 'list_libraries' as const,
            description:
                'List all documentation libraries currently indexed and available for searching. ' +
                'Use this to discover what documentation is available before running search_docs. ' +
                'Returns library names, URLs, page counts, and indexing status.',
            schema: v.object({
                status: v.optional(
                    v.pipe(
                        v.picklist(['indexed', 'crawling', 'error', 'all']),
                        v.description('Filter by indexing status. Default: "all".'),
                    ),
                    'all',
                ),
            }),
        },
        handler: async ({ status }: { status?: string }) => {
            const libraries = db.listLibraries(status);

            if (libraries.length === 0) {
                return tool.text(
                    'No libraries indexed yet. Use add_library to add a documentation website.',
                );
            }

            let output = `## Indexed Libraries (${libraries.length} total)\n\n`;
            output += '| Library | URL | Pages | Chunks | Status | Last Updated |\n';
            output += '| ------- | --- | ----- | ------ | ------ | ------------ |\n';

            for (const lib of libraries) {
                output += `| ${lib.name} | ${lib.url} | ${lib.page_count} | ${lib.chunk_count} | ${lib.status} | ${lib.last_crawled_at || 'never'} |\n`;
            }

            return tool.text(output);
        },
    };
}
