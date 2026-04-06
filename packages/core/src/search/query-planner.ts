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

    return {
      original_query: query,
      normalized_query: normalizedQuery,
      intent: this.detectIntent(normalizedQuery),
      keywords:
        filteredKeywords.length > 0
          ? filteredKeywords
          : Array.from(new Set(rawTokens)),
      phrases: PHRASE_HINTS.filter((phrase) =>
        normalizedQuery.includes(phrase),
      ),
      requested_library: library,
      requested_version: this.extractVersion(normalizedQuery),
    };
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
