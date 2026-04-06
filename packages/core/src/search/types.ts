export type SearchIntent =
  | "general"
  | "overview"
  | "getting_started"
  | "api_lookup"
  | "troubleshooting";

export interface SearchOptions {
  library?: string;
  limit?: number;
}

export interface SearchPlan {
  original_query: string;
  normalized_query: string;
  intent: SearchIntent;
  keywords: string[];
  phrases: string[];
  requested_version?: string;
  requested_library?: string;
}

export interface SearchCandidate {
  content: string;
  heading_context: string;
  page_url: string;
  page_path: string;
  page_title: string;
  library_name: string;
  library_display_name: string;
  lexical_score: number;
  has_code_block: boolean;
  token_count: number;
  chunk_index: number;
}

export interface SearchResult extends SearchCandidate {
  rerank_score: number;
  reasons: string[];
  path_type: string;
  version_tag: string | null;
}
