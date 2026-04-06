import type { SearchResult } from './types.js';

function formatReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return '';
  }

  return `**Why this ranked highly:** ${reasons.join(', ')}\n\n`;
}

export function formatSearchResults(query: string, results: SearchResult[]): string {
  const formatted = results
    .map((result, index) => {
      let block = `### ${index + 1}. ${result.page_title} — ${result.library_display_name}\n`;
      block += `**Source:** ${result.page_url}\n`;
      if (result.heading_context.trim().length > 0) {
        block += `**Section:** ${result.heading_context}\n`;
      }
      block += `${formatReasons(result.reasons)}${result.content}`;
      return block;
    })
    .join('\n\n---\n\n');

  return `## Results for "${query}"\n\n${formatted}`;
}