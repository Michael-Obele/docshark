// src/storage/search.ts — FTS5 + query planning + reranking engine
import type { Database } from "./db.js";
import { QueryPlanner, normalizeSearchText } from "../search/query-planner.js";
import type {
  SearchCandidate,
  SearchOptions,
  SearchPlan,
  SearchResult,
} from "../search/types.js";

export type { SearchOptions, SearchResult } from "../search/types.js";

export class SearchEngine {
  private planner = new QueryPlanner();

  constructor(private db: Database) {}

  search(query: string, opts: SearchOptions = {}): SearchResult[] {
    const limit = opts.limit ?? 5;
    const plan = this.planner.build(query, opts.library);
    const ftsQuery = this.buildFtsQuery(plan);

    if (!ftsQuery) return [];

    try {
      const candidates = this.fetchCandidates(ftsQuery, opts.library, limit);
      if (candidates.length === 0) {
        return [];
      }

      const reranked = this.rerank(plan, candidates);
      return this.collapseDuplicates(plan, reranked).slice(0, limit);
    } catch (err) {
      console.warn(`[DocShark] Search failed:`, (err as Error).message);
      return [];
    }
  }

  private fetchCandidates(
    ftsQuery: string,
    library: string | undefined,
    limit: number,
  ): SearchCandidate[] {
    const candidateLimit = Math.min(Math.max(limit * 12, 25), 80);
    const stmt = this.db.raw().prepare(`
      SELECT
        c.content,
        COALESCE(c.heading_context, '') AS heading_context,
        c.has_code_block,
        COALESCE(c.token_count, 0) AS token_count,
        c.chunk_index,
        p.url AS page_url,
        p.path AS page_path,
        COALESCE(p.title, 'Untitled') AS page_title,
        l.name AS library_name,
        l.display_name AS library_display_name,
        bm25(chunks_fts, 1.0, 0.7) AS lexical_score
      FROM chunks_fts
      JOIN chunks c ON chunks_fts.rowid = c.rowid
      JOIN pages p ON c.page_id = p.id
      JOIN libraries l ON c.library_id = l.id
      WHERE chunks_fts MATCH ?
        AND (? IS NULL OR l.name = ?)
      ORDER BY lexical_score
      LIMIT ?
    `);

    const rows = stmt.all(
      ftsQuery,
      library ?? null,
      library ?? null,
      candidateLimit,
    ) as Array<{
      content: string;
      heading_context: string;
      has_code_block: number;
      token_count: number;
      chunk_index: number;
      page_url: string;
      page_path: string;
      page_title: string;
      library_name: string;
      library_display_name: string;
      lexical_score: number;
    }>;

    return rows.map((row) => ({
      ...row,
      has_code_block: row.has_code_block === 1,
    }));
  }

  private buildFtsQuery(plan: SearchPlan): string {
    const clauses = new Set<string>();
    const exactQuery = this.quoteTerm(plan.normalized_query);

    if (plan.normalized_query.length > 0) {
      clauses.add(exactQuery);
    }

    for (const phrase of plan.phrases) {
      clauses.add(this.quoteTerm(phrase));
    }

    for (const keyword of plan.keywords) {
      clauses.add(this.quoteTerm(keyword));
    }

    if (plan.keywords.length > 1 && plan.keywords.length <= 6) {
      clauses.add(
        `(${plan.keywords.map((keyword) => this.quoteTerm(keyword)).join(" AND ")})`,
      );
    }

    return Array.from(clauses).join(" OR ");
  }

  private quoteTerm(value: string): string {
    return `"${value.replace(/["']/g, "").trim()}"`;
  }

  private rerank(
    plan: SearchPlan,
    candidates: SearchCandidate[],
  ): SearchResult[] {
    const total = Math.max(candidates.length, 1);

    return candidates
      .map((candidate, index) =>
        this.scoreCandidate(plan, candidate, index, total),
      )
      .sort((left, right) => {
        if (right.rerank_score !== left.rerank_score) {
          return right.rerank_score - left.rerank_score;
        }

        return left.lexical_score - right.lexical_score;
      });
  }

  private scoreCandidate(
    plan: SearchPlan,
    candidate: SearchCandidate,
    index: number,
    total: number,
  ): SearchResult {
    const title = normalizeSearchText(candidate.page_title);
    const primaryTitle = normalizeSearchText(
      this.primaryTitle(candidate.page_title),
    );
    const heading = normalizeSearchText(candidate.heading_context);
    const path = normalizeSearchText(candidate.page_path);
    const libraryText = normalizeSearchText(
      `${candidate.library_name} ${candidate.library_display_name}`,
    );
    const contentPreview = normalizeSearchText(candidate.content.slice(0, 800));
    const pathType = this.inferPathType(
      candidate.page_path,
      candidate.page_title,
    );
    const versionTag = this.extractVersionTag(candidate.page_path);
    const reasons: string[] = [];

    let score = 0;

    const lexicalRankScore = 0.35 * (1 - index / total);
    score += lexicalRankScore;

    const titleExact =
      primaryTitle.includes(plan.normalized_query) &&
      plan.normalized_query.length > 0;
    if (titleExact) {
      score += 0.22;
      reasons.push("exact title match");
    }

    const titleOverlap = this.keywordOverlap(
      plan.keywords,
      primaryTitle || title,
    );
    if (titleOverlap > 0) {
      score += 0.14 * titleOverlap;
      if (titleOverlap === 1 && !titleExact) {
        reasons.push("all query keywords appear in title");
      }
    }

    const headingOverlap = this.keywordOverlap(plan.keywords, heading);
    if (headingOverlap > 0) {
      score += 0.1 * headingOverlap;
      if (headingOverlap >= 0.6) {
        reasons.push("heading context aligns with the query");
      }
    }

    const pathOverlap = this.keywordOverlap(plan.keywords, path);
    if (pathOverlap > 0) {
      score += 0.08 * pathOverlap;
    }

    const libraryOverlap = this.keywordOverlap(plan.keywords, libraryText);
    if (libraryOverlap > 0) {
      score += 0.08 * libraryOverlap;
      if (libraryOverlap === 1) {
        reasons.push("library name aligns with the query");
      }
    } else if (plan.keywords.length === 1) {
      score -= 0.03;
    }

    const phraseMatch = this.hasPhraseMatch(
      plan,
      title,
      heading,
      contentPreview,
    );
    if (phraseMatch) {
      score += 0.08;
      reasons.push("exact phrase match");
    }

    const pathPrior = this.pathTypeScore(plan.intent, pathType);
    if (pathPrior > 0) {
      score += pathPrior;
      if (pathPrior >= 0.1) {
        reasons.push(`matched ${pathType.replace(/_/g, "-")} page type`);
      }
    }

    if (candidate.has_code_block) {
      const codeSignal =
        plan.intent === "api_lookup" || plan.intent === "troubleshooting"
          ? 0.07
          : plan.intent === "getting_started"
            ? 0.03
            : 0.015;

      score += codeSignal;
      if (codeSignal >= 0.03) {
        reasons.push("includes code sample");
      }
    }

    if (candidate.token_count >= 60 && candidate.token_count <= 260) {
      score += 0.03;
    }

    if (plan.requested_version) {
      if (versionTag === plan.requested_version) {
        score += 0.12;
        reasons.push(`matches requested version v${versionTag}`);
      }
    } else if (!versionTag) {
      score += 0.08;
      reasons.push("canonical unversioned page");
    } else {
      score += Math.min(parseInt(versionTag, 10), 20) / 300;
    }

    const uniqueReasons = Array.from(new Set(reasons)).slice(0, 4);

    return {
      ...candidate,
      path_type: pathType,
      version_tag: versionTag,
      rerank_score: Number(score.toFixed(6)),
      reasons: uniqueReasons,
    };
  }

  private collapseDuplicates(
    plan: SearchPlan,
    candidates: SearchResult[],
  ): SearchResult[] {
    const bestByPage = new Map<string, SearchResult>();
    for (const candidate of candidates) {
      const existing = bestByPage.get(candidate.page_url);
      if (!existing || candidate.rerank_score > existing.rerank_score) {
        bestByPage.set(candidate.page_url, candidate);
      }
    }

    const bestByCanonicalPage = new Map<string, SearchResult>();
    const pageResults = Array.from(bestByPage.values()).sort(
      (left, right) => right.rerank_score - left.rerank_score,
    );

    for (const candidate of pageResults) {
      const canonicalKey = this.canonicalPageKey(candidate);
      const existing = bestByCanonicalPage.get(canonicalKey);
      if (
        !existing ||
        this.preferenceScore(plan, candidate) >
          this.preferenceScore(plan, existing)
      ) {
        bestByCanonicalPage.set(canonicalKey, candidate);
      }
    }

    return Array.from(bestByCanonicalPage.values()).sort((left, right) => {
      if (right.rerank_score !== left.rerank_score) {
        return right.rerank_score - left.rerank_score;
      }

      return left.lexical_score - right.lexical_score;
    });
  }

  private preferenceScore(plan: SearchPlan, result: SearchResult): number {
    let score = result.rerank_score;

    if (plan.requested_version) {
      if (result.version_tag === plan.requested_version) {
        score += 0.2;
      }
    } else if (!result.version_tag) {
      score += 0.12;
    } else {
      score += parseInt(result.version_tag, 10) / 500;
    }

    if (plan.intent === "overview" || plan.intent === "getting_started") {
      if (
        result.path_type === "getting_started" ||
        result.path_type === "overview"
      ) {
        score += 0.02;
      }
    }

    return score;
  }

  private canonicalPageKey(result: SearchResult): string {
    const canonicalPath =
      result.page_path
        .toLowerCase()
        .replace(/\/v\d+(?=\/|$)/g, "")
        .replace(/\/+/g, "/")
        .replace(/\/$/, "") || "/";
    const canonicalTitle = normalizeSearchText(result.page_title)
      .replace(/\bv\d+\b/g, "")
      .trim();
    return `${result.library_name}:${canonicalPath}:${canonicalTitle}`;
  }

  private inferPathType(pagePath: string, pageTitle: string): string {
    const value = `${pagePath} ${pageTitle}`.toLowerCase();

    if (/getting-started|quickstart|install|installation|setup/.test(value)) {
      return "getting_started";
    }

    if (/overview|introduction|what is|basics/.test(value)) {
      return "overview";
    }

    if (/\/api|\bapi\b|reference|\/apis\//.test(value)) {
      return "api";
    }

    if (/troubleshoot|troubleshooting|errors?|faq|debug/.test(value)) {
      return "troubleshooting";
    }

    return "guide";
  }

  private pathTypeScore(
    intent: SearchPlan["intent"],
    pathType: string,
  ): number {
    switch (intent) {
      case "overview":
        if (pathType === "overview") return 0.16;
        if (pathType === "getting_started") return 0.1;
        if (pathType === "guide") return 0.06;
        return 0;
      case "getting_started":
        if (pathType === "getting_started") return 0.18;
        if (pathType === "guide") return 0.08;
        if (pathType === "overview") return 0.06;
        return 0;
      case "api_lookup":
        if (pathType === "api") return 0.18;
        if (pathType === "guide") return 0.04;
        return 0;
      case "troubleshooting":
        if (pathType === "troubleshooting") return 0.16;
        if (pathType === "guide") return 0.07;
        return 0;
      default:
        if (pathType === "getting_started") return 0.08;
        if (pathType === "overview") return 0.07;
        if (pathType === "api") return 0.05;
        if (pathType === "guide") return 0.03;
        return 0;
    }
  }

  private keywordOverlap(keywords: string[], haystack: string): number {
    if (keywords.length === 0 || haystack.length === 0) {
      return 0;
    }

    const matches = keywords.filter((keyword) =>
      haystack.includes(keyword),
    ).length;
    return matches / keywords.length;
  }

  private hasPhraseMatch(
    plan: SearchPlan,
    title: string,
    heading: string,
    content: string,
  ): boolean {
    if (
      plan.normalized_query.includes(" ") &&
      (title.includes(plan.normalized_query) ||
        heading.includes(plan.normalized_query))
    ) {
      return true;
    }

    return plan.phrases.some(
      (phrase) =>
        title.includes(phrase) ||
        heading.includes(phrase) ||
        content.includes(phrase),
    );
  }

  private primaryTitle(title: string): string {
    return title.split(/\||—|-/)[0]?.trim() ?? title;
  }

  private extractVersionTag(path: string): string | null {
    const match = path.toLowerCase().match(/\/v(\d+)(?=\/|$)/);
    return match?.[1] ?? null;
  }
}
