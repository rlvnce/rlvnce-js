// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface RlvnceClientOptions {
  /** API key (starts with "rlv_"). */
  apiKey: string;
  /** Base URL of the RLVNCE API. Defaults to "https://api.rlvnce.com". */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
  /** Custom fetch implementation. Defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
  /** Maximum number of retries on retryable errors (429, 500, 502, 503, 504, network). Defaults to 2. Set to 0 to disable. */
  maxRetries?: number;
  /** Initial retry delay in milliseconds. Doubles on each attempt. Defaults to 500. */
  retryDelay?: number;
  /** Called before each HTTP request. Use for logging or telemetry. */
  onRequest?: (request: RequestInfo) => void;
  /** Called after each HTTP response (including errors). Use for logging or telemetry. */
  onResponse?: (response: ResponseInfo) => void;
}

/** Info passed to the onRequest hook. */
export interface RequestInfo {
  method: string;
  url: string;
  attempt: number;
}

/** Info passed to the onResponse hook. */
export interface ResponseInfo {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  attempt: number;
  retryable: boolean;
}

/** Options that can be passed to individual method calls. */
export interface RequestOptions {
  /** AbortSignal for user-initiated cancellation. */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface PaginatedOffset<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedCursor<T> {
  items: T[];
  cursor: string | null;
}

// ---------------------------------------------------------------------------
// Corpora
// ---------------------------------------------------------------------------

export interface Corpus {
  id: string;
  name: string;
  description?: string;
  status?: string;
  document_count?: number;
  connector_app_id?: string;
  ranker_app_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListCorporaOptions extends RequestOptions {
  limit?: number;
  offset?: number;
  status?: "active" | "building" | "error";
}

export interface CreateCorpusParams extends RequestOptions {
  name: string;
  description?: string;
  sources?: SourceInput[];
  crawl_policy?: CrawlPolicy;
  search_policy?: SearchPolicy;
  connector_app_id?: string;
  ranker_app_id?: string;
  connector_config?: Record<string, unknown>;
}

export interface CreateCorpusResult {
  corpus: Corpus;
  sources?: Array<{ url: string; source?: unknown; error?: string }>;
  policy?: Policy;
}

export interface UpdateCorpusParams extends RequestOptions {
  name?: string;
  description?: string;
  crawl_policy?: CrawlPolicy;
  search_policy?: SearchPolicy;
}

export interface UpdateCorpusResult {
  corpus?: Corpus;
  policy?: Policy;
}

export interface DeleteCorpusResult {
  deleted: true;
  corpus_id: string;
  corpus_name: string;
}

export interface CloneCorpusParams extends RequestOptions {
  name: string;
  description?: string;
  source_filter?: {
    source_ids?: string[];
    source_urls?: string[];
  };
  copy_policy?: boolean;
}

export interface CloneCorpusResult {
  source_corpus: { id: string; name?: string };
  corpus: Corpus;
  sources: Array<{ url: string; source?: unknown; error?: string }>;
  policy?: Policy;
}

export interface CorpusDetail extends Corpus {
  policy?: Policy | null;
  sources?: SourcesListResponse | null;
}

export interface CorpusMetrics {
  document_count?: number;
  storage_bytes?: number;
  source_count?: number;
  freshness_lag_hours?: number;
  crawl_success_rate?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export interface CrawlPolicy {
  schedule?: "manual" | "hourly" | "daily" | "weekly";
  max_documents?: number;
  max_bytes_per_day?: number;
  connector_config?: Record<string, unknown>;
}

export interface SearchPolicy {
  title_weight?: number;
  headings_weight?: number;
  body_weight?: number;
  url_weight?: number;
  meta_description_weight?: number;
  recency_boost?: number;
  recency_decay_rate?: number;
  domain_boosts?: Record<string, number>;
  path_boosts?: Record<string, number>;
}

export interface Policy {
  crawl?: CrawlPolicy;
  search?: SearchPolicy;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface SourceInput {
  url: string;
  source_config?: Record<string, unknown>;
}

export interface Source {
  id: string;
  url: string;
  source_config?: Record<string, unknown> | null;
  status?: string;
  document_count?: number;
  error_count?: number;
  last_crawled_at?: string;
  [key: string]: unknown;
}

export interface SourcesListResponse {
  sources: Source[];
  [key: string]: unknown;
}

export interface SourceStats {
  id: string;
  url: string;
  document_count?: number;
  error_count?: number;
  last_crawled_at?: string;
  last_error_type?: string;
  consecutive_failures?: number;
  [key: string]: unknown;
}

export interface ListSourceUrlsOptions extends RequestOptions {
  limit?: number;
  cursor?: string;
}

export interface SourceUrl {
  url: string;
  document_id?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions extends RequestOptions {
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  attribute_filters?: AttributeFilter[];
  attribute_boosts?: AttributeBoost[];
}

export interface SearchFilters {
  url_prefix?: string;
  source_id?: string;
  content_type?: string;
  lang?: string;
  changed_after?: string;
  published_after?: string;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
}

export interface AttributeFilter {
  field: string;
  op: string;
  value: string | number | boolean;
}

export interface AttributeBoost {
  field: string;
  multiplier: number;
  value?: string | number | boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total?: number;
  query_ms?: number;
  [key: string]: unknown;
}

export interface SearchResult {
  document_id?: string;
  doc_id?: string;
  url: string;
  title?: string;
  snippet?: string;
  score: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface Document {
  id?: string;
  doc_id?: string;
  url: string;
  title?: string;
  body?: string;
  headings?: string[];
  language?: string;
  content_type?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface DocumentSummary {
  document_id: string;
  [key: string]: unknown;
}

export interface ListDocumentsOptions extends RequestOptions {
  limit?: number;
  cursor?: string;
}

export interface ListDocumentVersionsOptions extends RequestOptions {
  limit?: number;
  cursor?: string;
}

export interface SampleDocumentsOptions extends RequestOptions {
  n?: number;
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

export interface ListChangesOptions extends RequestOptions {
  since?: string;
  limit?: number;
  cursor?: string;
  types?: string;
}

export interface Change {
  document_id?: string;
  url?: string;
  type?: string;
  timestamp?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Crawls
// ---------------------------------------------------------------------------

export interface TriggerCrawlOptions extends RequestOptions {
  force?: boolean;
  source_id?: string;
  source_url?: string;
}

export interface CrawlJob {
  id: string;
  status: string;
  trigger_type?: string;
  pages_discovered?: number;
  pages_crawled?: number;
  pages_failed?: number;
  pages_unchanged?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListCrawlsOptions extends RequestOptions {
  limit?: number;
  offset?: number;
}

export interface ListCrawlResultsOptions extends RequestOptions {
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface CrawlResult {
  url: string;
  status?: string;
  depth?: number;
  [key: string]: unknown;
}

export interface ListCrawlErrorsOptions extends RequestOptions {
  limit?: number;
  cursor?: string;
}

export interface CrawlError {
  url: string;
  error_type?: string;
  http_status?: number;
  message?: string;
  [key: string]: unknown;
}

export interface CrawlSchedule {
  schedule_type?: string;
  auto_crawl?: boolean;
  last_crawl_at?: string;
  next_crawl_at?: string;
  overdue?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface CreateSubscriptionParams extends RequestOptions {
  event_types: Array<"created" | "updated" | "deleted">;
  webhook_url: string;
  batch_size?: number;
  batch_interval_seconds?: number;
}

export interface Subscription {
  id: string;
  event_types: string[];
  webhook_url: string;
  batch_size?: number;
  batch_interval_seconds?: number;
  status?: string;
  signing_secret?: string;
  [key: string]: unknown;
}

export interface ListSubscriptionsOptions extends RequestOptions {
  status?: "active" | "paused" | "disabled";
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface ListCatalogOptions extends RequestOptions {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogEntry {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------

export interface ListAppsOptions extends RequestOptions {
  type?: "connector" | "ranker";
  search?: string;
  limit?: number;
  offset?: number;
}

export interface App {
  id: string;
  name: string;
  type?: string;
  description?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface GetUsageOptions extends RequestOptions {
  period?: string;
}

export interface Usage {
  queries?: number;
  crawl_pages?: number;
  crawl_bytes?: number;
  document_fetches?: number;
  storage_bytes?: number;
  [key: string]: unknown;
}

export interface Limits {
  tier?: string;
  max_corpora?: number;
  included_searches?: number;
  [key: string]: unknown;
}
