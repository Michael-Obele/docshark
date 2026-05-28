import type { SearchIntent, SearchPlan } from "./types.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "with",
]);

const PHRASE_HINTS = [
  "getting started",
  "quickstart",
  "overview",
  "reference",
  "api",
  "troubleshooting",
];

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@/._\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeToken(value: string): string {
  return value.replace(/^[^a-z0-9@/._-]+|[^a-z0-9@/._-]+$/gi, "").toLowerCase();
}

export class QueryPlanner {
  build(query: string, library?: string): SearchPlan {
    const normalizedQuery = normalizeSearchText(query);
    const rawTokens = normalizedQuery
      .split(/\s+/)
      .map((token) => sanitizeToken(token))
      .filter(Boolean);

    const filteredKeywords = Array.from(
      new Set(
        rawTokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
      ),
    );
    const keywords =
      filteredKeywords.length > 0
        ? filteredKeywords
        : Array.from(new Set(rawTokens));

    return {
      original_query: query,
      normalized_query: normalizedQuery,
      intent: this.detectIntent(normalizedQuery),
      keywords,
      phrases: PHRASE_HINTS.filter((phrase) =>
        normalizedQuery.includes(phrase),
      ),
      decomposed_queries: this.buildDecomposedQueries(normalizedQuery, keywords),
      requested_library: library,
      requested_version: this.extractVersion(normalizedQuery),
    };
  }

  private buildDecomposedQueries(
    normalizedQuery: string,
    keywords: string[],
  ): string[] {
    if (!this.shouldDecompose(normalizedQuery, keywords)) {
      return [];
    }

    const segmentedQueries = this.segmentBySeparators(normalizedQuery);
    if (segmentedQueries.length > 1) {
      return segmentedQueries;
    }

    return this.chunkKeywords(keywords);
  }

  private shouldDecompose(normalizedQuery: string, keywords: string[]): boolean {
    if (keywords.length < 4) {
      return false;
    }

    if (/[;,]/.test(normalizedQuery) || /\b(and|or|then|plus|with)\b/.test(normalizedQuery)) {
      return true;
    }

    return keywords.length >= 7;
  }

  private segmentBySeparators(normalizedQuery: string): string[] {
    const segments = normalizedQuery
      .split(/(?:,|;|\band\b|\bor\b|\bthen\b|\bplus\b)/g)
      .map((segment) => normalizeSearchText(segment))
      .filter((segment) => segment.split(/\s+/).length >= 2);

    return Array.from(new Set(segments)).slice(0, 4);
  }

  private chunkKeywords(keywords: string[]): string[] {
    const targetBranches = Math.min(4, Math.ceil(keywords.length / 2));
    const chunkSize = Math.min(3, Math.max(2, Math.ceil(keywords.length / targetBranches)));
    const chunks: string[] = [];

    for (let index = 0; index < keywords.length; index += chunkSize) {
      const group = keywords.slice(index, index + chunkSize);
      if (group.length === 1 && chunks.length > 0) {
        chunks[chunks.length - 1] += ` ${group[0]}`;
        continue;
      }

      chunks.push(group.join(" "));
    }

    return Array.from(new Set(chunks)).slice(0, 4);
  }

  private detectIntent(query: string): SearchIntent {
    if (
      query.includes("getting started") ||
      query.includes("quickstart") ||
      query.startsWith("install ") ||
      query.startsWith("setup ")
    ) {
      return "getting_started";
    }

    if (
      query.includes("overview") ||
      query.startsWith("what is ") ||
      query.startsWith("about ")
    ) {
      return "overview";
    }

    if (
      /[a-z]+\.[a-z]+/.test(query) ||
      /[A-Z][a-zA-Z]+\(/.test(query) ||
      query.includes(" api") ||
      query.endsWith(" api") ||
      query.includes("reference") ||
      query.includes("@")
    ) {
      return "api_lookup";
    }

    if (/error|fail|issue|problem|broken|debug|fix|troubleshoot/.test(query)) {
      return "troubleshooting";
    }

    return "general";
  }

  private extractVersion(query: string): string | undefined {
    const match = query.match(/\bv(?:ersion)?\s*(\d+)\b/);
    return match?.[1];
  }
}
