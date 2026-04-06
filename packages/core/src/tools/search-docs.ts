// src/tools/search-docs.ts — Primary search tool (80% of usage)
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { SearchEngine } from '../storage/search.js';
import { formatSearchResults } from '../search/format-results.js';

export function createSearchDocsTool(searchEngine: SearchEngine) {
    return {
        definition: {
            name: 'search_docs' as const,
            description:
                'Search through indexed documentation libraries for relevant information. ' +
                'Returns ranked documentation sections with code examples and source URLs. ' +
                'Use this when you need to find information about a library, framework, API, ' +
                'or any technical concept. You can optionally filter by a specific library name.',
            schema: v.object({
                query: v.pipe(v.string(), v.description('The search query. Use natural language or specific terms.')),
                library: v.optional(
                    v.pipe(v.string(), v.description('Filter results to a specific library name.')),
                ),
                limit: v.optional(
                    v.pipe(
                        v.number(),
                        v.integer(),
                        v.minValue(1),
                        v.maxValue(20),
                        v.description('Max results to return. Default: 5.'),
                    ),
                    5,
                ),
            }),
        },
        handler: async ({ query, library, limit }: { query: string; library?: string; limit?: number }) => {
            const results = searchEngine.search(query, { library, limit });

            if (results.length === 0) {
                return tool.text(`No results found for "${query}".`);
            }

            return tool.text(formatSearchResults(query, results));
        },
    };
}
