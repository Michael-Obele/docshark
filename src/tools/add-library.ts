// src/tools/add-library.ts — Add new documentation source
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { LibraryService } from '../services/library.js';

export function createAddLibraryTool(libraryService: LibraryService) {
    return {
        definition: {
            name: 'add_library' as const,
            description:
                'Add a new documentation library to be crawled and indexed for searching. ' +
                'Provide the documentation website URL and an optional name. ' +
                'The library will be crawled in the background. ' +
                'Use list_libraries to check crawl progress.',
            schema: v.object({
                url: v.pipe(
                    v.string(),
                    v.url(),
                    v.description('The base URL of the documentation website to crawl.'),
                ),
                name: v.optional(
                    v.pipe(
                        v.string(),
                        v.description('A short identifier for the library (e.g., "svelte-5"). Auto-generated from URL if omitted.'),
                    ),
                ),
                version: v.optional(
                    v.pipe(v.string(), v.description('Version string (e.g., "5.0.0", "v4").')),
                ),
                max_depth: v.optional(
                    v.pipe(
                        v.number(),
                        v.integer(),
                        v.minValue(1),
                        v.maxValue(10),
                        v.description('Maximum link depth to crawl. Default: 3.'),
                    ),
                    3,
                ),
            }),
        },
        handler: async ({
            url,
            name,
            version,
            max_depth,
        }: {
            url: string;
            name?: string;
            version?: string;
            max_depth?: number;
        }) => {
            try {
                const library = await libraryService.add({
                    url,
                    name,
                    version,
                    maxDepth: max_depth,
                });

                return tool.text(
                    `✅ Library "${library.display_name}" added.\n` +
                    `Crawl job ${library.jobId} started. Use list_libraries to check progress.`,
                );
            } catch (err: any) {
                return tool.text(`❌ Failed to add library: ${err.message}`);
            }
        },
    };
}
