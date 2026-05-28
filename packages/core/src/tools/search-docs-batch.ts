import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { SearchEngine } from '../storage/search.js';
import { formatBatchSearchResults } from '../search/format-results.js';

export function createSearchDocsBatchTool(searchEngine: SearchEngine) {
    return {
        definition: {
            name: 'search_docs_batch' as const,
            description:
                'Run multiple documentation searches in one call. ' +
                'Useful when you need several focused lookups against one library or across a small set of libraries.',
            schema: v.object({
                requests: v.pipe(
                    v.array(
                        v.object({
                            query: v.pipe(
                                v.string(),
                                v.description('The search query. Use natural language or specific terms.'),
                            ),
                            library: v.optional(
                                v.pipe(v.string(), v.description('Optional library filter for this query.')),
                            ),
                            limit: v.optional(
                                v.pipe(
                                    v.number(),
                                    v.integer(),
                                    v.minValue(1),
                                    v.maxValue(20),
                                    v.description('Max results to return for this query. Default: 5.'),
                                ),
                                5,
                            ),
                        }),
                    ),
                    v.minLength(1),
                    v.maxLength(10),
                ),
            }),
        },
        handler: async ({ requests }: { requests: Array<{ query: string; library?: string; limit?: number }> }) => {
            const results = searchEngine.searchMany(requests);
            return tool.text(formatBatchSearchResults(results));
        },
    };
}