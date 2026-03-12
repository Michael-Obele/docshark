// src/tools/refresh-library.ts — Re-crawl existing library
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { JobManager } from '../jobs/manager.js';
import type { Database } from '../storage/db.js';

export function createRefreshLibraryTool(jobManager: JobManager, db: Database) {
    return {
        definition: {
            name: 'refresh_library' as const,
            description:
                'Re-crawl and re-index an existing documentation library to get the latest content. ' +
                'Use this when documentation may have been updated since it was last indexed. ' +
                'Only re-fetches pages that have changed (via HTTP ETags/Last-Modified).',
            schema: v.object({
                library: v.pipe(
                    v.string(),
                    v.description('The library name to refresh (e.g., "svelte-5").'),
                ),
            }),
        },
        handler: async ({ library }: { library: string }) => {
            const lib = db.getLibraryByName(library);
            if (!lib) {
                return tool.text(
                    `Library "${library}" not found. Use list_libraries to see available libraries.`,
                );
            }

            const job = jobManager.startCrawl(lib.id, { incremental: true });
            return tool.text(
                `🔄 Refresh started for "${lib.display_name}".\n` +
                `Job ${job.id}: checking for updated pages...`,
            );
        },
    };
}
