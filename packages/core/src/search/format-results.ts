import type { BatchSearchResult, SearchResult } from './types.js';
import { sanitizeDocContent } from './sanitize.js';

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return '';
  }

  return `**Why this ranked highly:** ${reasons.join(', ')}\n\n`;
}

function formatResultBlocks(results: SearchResult[]): string {
  return results
    .map((result, index) => {
      let block = `### ${index + 1}. ${result.page_title} — ${result.library_display_name}\n`;
      block += `**Source:** ${result.page_url}\n`;
      if (result.heading_context.trim().length > 0) {
        block += `**Section:** ${result.heading_context}\n`;
      }
      const sanitizedContent = sanitizeDocContent(result.content);
      block += `${formatReasons(result.reasons)}${sanitizedContent}`;
      return block;
    })
    .join('\n\n---\n\n');
}

export function formatSearchResults(query: string, results: SearchResult[]): string {
  return `## Results for "${query}"\n\n${formatResultBlocks(results)}`;
}

export function formatBatchSearchResults(results: BatchSearchResult[]): string {
  const formatted = results
    .map((result, index) => {
      const librarySuffix = result.library ? ` — ${result.library}` : '';
      if (result.results.length === 0) {
        return `### ${index + 1}. ${result.query}${librarySuffix}\n\nNo results found.`;
      }

      return `### ${index + 1}. ${result.query}${librarySuffix}\n\n${formatResultBlocks(result.results)}`;
    })
    .join('\n\n***\n\n');

  return `## Batch Search Results\n\n${formatted}`;
}