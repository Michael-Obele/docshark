// src/tools/remove-library.ts — Remove a library and all its data
import * as v from 'valibot';
import { tool } from 'tmcp/utils';
import type { Database } from '../storage/db.js';

export function createRemoveLibraryTool(db: Database) {
    return {
        definition: {
            name: 'remove_library' as const,
            description:
                'Remove a documentation library and all its indexed content. ' +
                'This permanently deletes the library, its pages, and search index. ' +
                'Use list_libraries first to confirm the library name.',
            schema: v.object({
                library: v.pipe(
                    v.string(),
                    v.description('The library name to remove (e.g., "svelte-5").'),
                ),
            }),
        },
        handler: async ({ library }: { library: string }) => {
            const lib = db.getLibraryByName(library);
            if (!lib) {
                return tool.text(`Library "${library}" not found.`);
            }

            db.removeLibrary(lib.id);
            return tool.text(
                `🗑️ Library "${lib.display_name}" removed.\n` +
                `Deleted ${lib.page_count} pages and ${lib.chunk_count} search chunks.`,
            );
        },
    };
}
