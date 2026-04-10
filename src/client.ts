import { RlvnceApiError } from "./error.js";
import { paginateOffset, paginateCursor } from "./pagination.js";
import type {
  RlvnceClientOptions, RequestOptions, RequestInfo, ResponseInfo,
  // Corpora
  Corpus, CorpusDetail, CorpusMetrics, ListCorporaOptions,
  CreateCorpusParams, CreateCorpusResult,
  UpdateCorpusParams, UpdateCorpusResult,
  DeleteCorpusResult, CloneCorpusParams, CloneCorpusResult,
  // Search & Documents
  SearchOptions, SearchResponse, Document, DocumentSummary,
  ListDocumentsOptions, SampleDocumentsOptions,
  ListChangesOptions, Change,
  // Sources
  SourceInput, Source, SourcesListResponse, SourceStats,
  ListSourceUrlsOptions, SourceUrl,
  // Crawls
  TriggerCrawlOptions, CrawlJob, ListCrawlsOptions,
  ListCrawlResultsOptions, CrawlResult,
  ListCrawlErrorsOptions, CrawlError, CrawlSchedule,
  // Policies
  SearchPolicy, Policy,
  // Subscriptions
  CreateSubscriptionParams, Subscription, ListSubscriptionsOptions,
  // Catalog
  ListCatalogOptions, CatalogEntry,
  // Apps
  ListAppsOptions, App,
  // Usage
  GetUsageOptions, Usage, Limits,
} from "./types.js";

// Method implementations
import * as searchMethods from "./methods/search.js";
import * as corporaMethods from "./methods/corpora.js";
import * as sourcesMethods from "./methods/sources.js";
import * as crawlsMethods from "./methods/crawls.js";
import * as policiesMethods from "./methods/policies.js";
import * as subscriptionsMethods from "./methods/subscriptions.js";
import * as catalogMethods from "./methods/catalog.js";
import * as appsMethods from "./methods/apps.js";
import * as usageMethods from "./methods/usage.js";

// ---------------------------------------------------------------------------
// Internal HTTP transport — not exported
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

interface ErrorBody {
  code?: string;
  http_status?: number;
  message?: string;
  error?: string;
  details?: unknown;
  trace_id?: string;
  retryable?: boolean;
}

/** @internal */
export class HttpTransport {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly _fetch: typeof globalThis.fetch;
  private readonly onRequest?: (info: RequestInfo) => void;
  private readonly onResponse?: (info: ResponseInfo) => void;

  constructor(options: RlvnceClientOptions) {
    this.baseUrl = (options.baseUrl ?? "https://api.rlvnce.com").replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelay = options.retryDelay ?? 500;
    this._fetch = options.fetch ?? globalThis.fetch;
    this.onRequest = options.onRequest;
    this.onResponse = options.onResponse;
  }

  async get<T>(path: string, params?: Record<string, string | undefined>, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.requestWithRetry<T>(url, { method: "GET" }, options?.signal);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path);
    return this.requestWithRetry<T>(url, {
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    }, options?.signal);
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path);
    return this.requestWithRetry<T>(url, {
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    }, options?.signal);
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(path);
    return this.requestWithRetry<T>(url, {
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
    }, options?.signal);
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    const url = this.buildUrl(path);
    await this.requestWithRetry<undefined>(url, { method: "DELETE" }, options?.signal);
  }

  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async requestWithRetry<T>(url: string, init: RequestInit, userSignal?: AbortSignal): Promise<T> {
    const method = init.method ?? "GET";
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Wait before retry (not on first attempt)
      if (attempt > 0) {
        const delay = this.computeRetryDelay(attempt, lastError);
        await this.sleep(delay, userSignal);
      }

      try {
        return await this.request<T>(url, init, method, attempt, userSignal);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry if user cancelled
        if (userSignal?.aborted) throw lastError;

        // Don't retry non-retryable errors
        if (!this.isRetryable(lastError)) throw lastError;

        // Last attempt — don't retry, throw
        if (attempt === this.maxRetries) throw lastError;
      }
    }

    // Unreachable, but TypeScript needs it
    throw lastError;
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    method: string,
    attempt: number,
    userSignal?: AbortSignal,
  ): Promise<T> {
    // Combine user signal with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    const abortOnUserCancel = () => controller.abort();
    userSignal?.addEventListener("abort", abortOnUserCancel, { once: true });

    this.onRequest?.({ method, url, attempt });
    const start = Date.now();

    try {
      const res = await this._fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "@rlvnce/client/0.1.0",
        },
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        let errBody: ErrorBody | undefined;
        let rawText: string | undefined;
        try {
          rawText = await res.text();
          errBody = JSON.parse(rawText) as ErrorBody;
        } catch {
          // response wasn't JSON
        }
        const message = errBody?.message ?? errBody?.error ?? rawText ?? `HTTP ${res.status}`;
        const retryable = errBody?.retryable ?? RETRYABLE_STATUS_CODES.has(res.status);

        this.onResponse?.({ method, url, status: res.status, durationMs, attempt, retryable });

        throw new RlvnceApiError(
          res.status,
          errBody?.code ?? "UNKNOWN",
          message,
          retryable,
          errBody?.details,
          errBody?.trace_id,
        );
      }

      this.onResponse?.({ method, url, status: res.status, durationMs, attempt, retryable: false });

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      // If it's already an RlvnceApiError, re-throw as-is (hooks already called)
      if (err instanceof RlvnceApiError) throw err;

      // Network/timeout errors — fire hook with status 0
      const durationMs = Date.now() - start;
      this.onResponse?.({ method, url, status: 0, durationMs, attempt, retryable: true });
      throw err;
    } finally {
      clearTimeout(timeout);
      userSignal?.removeEventListener("abort", abortOnUserCancel);
    }
  }

  private isRetryable(err: Error): boolean {
    if (err instanceof RlvnceApiError) {
      return err.retryable || RETRYABLE_STATUS_CODES.has(err.status);
    }
    // Network errors and timeouts are retryable
    return true;
  }

  private computeRetryDelay(attempt: number, lastError?: Error): number {
    // Respect Retry-After header for 429s
    if (lastError instanceof RlvnceApiError && lastError.status === 429) {
      // The Retry-After value may be in the error details or message;
      // for now use the exponential backoff as baseline
    }
    // Exponential backoff with jitter
    const base = this.retryDelay * Math.pow(2, attempt - 1);
    const jitter = base * 0.2 * Math.random();
    return base + jitter;
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason ?? new Error("Aborted"));
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Aborted"));
      }, { once: true });
    });
  }
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

export class RlvnceClient {
  /** @internal */
  readonly http: HttpTransport;

  constructor(options: RlvnceClientOptions) {
    this.http = new HttpTransport(options);
  }

  // ---- Search & Cache ----

  /** Full-text search over a corpus. */
  async search(corpusId: string, query: string, options?: SearchOptions): Promise<SearchResponse> {
    return searchMethods.search(this.http, corpusId, query, options);
  }

  /** View the cached version of a page by document ID. */
  async viewCache(corpusId: string, documentId: string, options?: RequestOptions): Promise<Document> {
    return searchMethods.viewCache(this.http, corpusId, documentId, options);
  }

  /**
   * @deprecated Use `viewCache()` instead.
   */
  async getDocument(corpusId: string, documentId: string, options?: RequestOptions): Promise<Document> {
    return searchMethods.viewCache(this.http, corpusId, documentId, options);
  }

  /** List documents in a corpus with optional filtering (single page). */
  async listDocuments(corpusId: string, options?: ListDocumentsOptions): Promise<Record<string, unknown>> {
    return searchMethods.listDocuments(this.http, corpusId, options);
  }

  /** Auto-paginate all documents in a corpus. */
  async *listAllDocuments(corpusId: string, options?: Omit<ListDocumentsOptions, "cursor">): AsyncGenerator<DocumentSummary> {
    yield* paginateCursor<DocumentSummary>(
      (opts) => searchMethods.listDocuments(this.http, corpusId, opts),
      options,
    );
  }

  /** Fetch N random documents for quality spot-checks. */
  async sampleDocuments(corpusId: string, options?: SampleDocumentsOptions): Promise<Record<string, unknown>> {
    return searchMethods.sampleDocuments(this.http, corpusId, options);
  }

  /** List document changes since a timestamp (single page). */
  async listChanges(corpusId: string, options?: ListChangesOptions): Promise<Record<string, unknown>> {
    return searchMethods.listChanges(this.http, corpusId, options);
  }

  /** Auto-paginate all changes. */
  async *listAllChanges(corpusId: string, options?: Omit<ListChangesOptions, "cursor">): AsyncGenerator<Change> {
    yield* paginateCursor<Change>(
      (opts) => searchMethods.listChanges(this.http, corpusId, opts),
      options,
    );
  }

  // ---- Corpora ----

  /** List available corpora (single page). */
  async listCorpora(options?: ListCorporaOptions): Promise<Record<string, unknown>> {
    return corporaMethods.listCorpora(this.http, options);
  }

  /** Auto-paginate all corpora. */
  async *listAllCorpora(options?: Omit<ListCorporaOptions, "offset">): AsyncGenerator<Corpus> {
    yield* paginateOffset<Corpus>(
      (opts) => corporaMethods.listCorpora(this.http, opts),
      options,
    );
  }

  /** Get full corpus detail including sources and policy. */
  async getCorpus(corpusId: string): Promise<CorpusDetail> {
    return corporaMethods.getCorpus(this.http, corpusId);
  }

  /** Create a corpus with optional sources and policies in a single call. */
  async createCorpus(params: CreateCorpusParams): Promise<CreateCorpusResult> {
    return corporaMethods.createCorpus(this.http, params);
  }

  /** Update corpus metadata and/or policies (merge semantics). */
  async updateCorpus(corpusId: string, params: UpdateCorpusParams): Promise<UpdateCorpusResult> {
    return corporaMethods.updateCorpus(this.http, corpusId, params);
  }

  /** Delete a corpus (name must match for safety). */
  async deleteCorpus(corpusId: string, corpusName: string): Promise<DeleteCorpusResult> {
    return corporaMethods.deleteCorpus(this.http, corpusId, corpusName);
  }

  /** Clone a corpus with optional source filtering. */
  async cloneCorpus(sourceCorpusId: string, params: CloneCorpusParams): Promise<CloneCorpusResult> {
    return corporaMethods.cloneCorpus(this.http, sourceCorpusId, params);
  }

  /** Get computed corpus health metrics. */
  async getCorpusMetrics(corpusId: string): Promise<CorpusMetrics> {
    return corporaMethods.getCorpusMetrics(this.http, corpusId);
  }

  // ---- Sources ----

  /** Add source URLs to a corpus. */
  async addSources(corpusId: string, sources: SourceInput[]): Promise<Array<{ url: string; source?: unknown; error?: string }>> {
    return sourcesMethods.addSources(this.http, corpusId, sources);
  }

  /** Remove a source from a corpus. */
  async removeSource(corpusId: string, sourceId: string): Promise<void> {
    return sourcesMethods.removeSource(this.http, corpusId, sourceId);
  }

  /** List all sources for a corpus. */
  async listSources(corpusId: string): Promise<SourcesListResponse> {
    return sourcesMethods.listSources(this.http, corpusId);
  }

  /** Get detailed per-source crawl stats. */
  async getSourceStats(corpusId: string, sourceId: string): Promise<SourceStats> {
    return sourcesMethods.getSourceStats(this.http, corpusId, sourceId);
  }

  /** List indexed URLs for a source (single page). */
  async listSourceUrls(corpusId: string, sourceId: string, options?: ListSourceUrlsOptions): Promise<Record<string, unknown>> {
    return sourcesMethods.listSourceUrls(this.http, corpusId, sourceId, options);
  }

  /** Auto-paginate all source URLs. */
  async *listAllSourceUrls(corpusId: string, sourceId: string, options?: Omit<ListSourceUrlsOptions, "cursor">): AsyncGenerator<SourceUrl> {
    yield* paginateCursor<SourceUrl>(
      (opts) => sourcesMethods.listSourceUrls(this.http, corpusId, sourceId, opts),
      options,
    );
  }

  /** Update a source's config (merge semantics). */
  async updateSource(corpusId: string, sourceId: string, sourceConfig: Record<string, unknown>): Promise<Source> {
    return sourcesMethods.updateSource(this.http, corpusId, sourceId, sourceConfig);
  }

  // ---- Crawls ----

  /** Trigger a crawl for a corpus. */
  async triggerCrawl(corpusId: string, options?: TriggerCrawlOptions): Promise<CrawlJob> {
    return crawlsMethods.triggerCrawl(this.http, corpusId, options);
  }

  /** Cancel a running crawl job. */
  async cancelCrawl(corpusId: string, jobId: string): Promise<Record<string, unknown>> {
    return crawlsMethods.cancelCrawl(this.http, corpusId, jobId);
  }

  /** Get crawl job status and progress counters. */
  async getCrawlStatus(corpusId: string, jobId: string): Promise<CrawlJob> {
    return crawlsMethods.getCrawlStatus(this.http, corpusId, jobId);
  }

  /** List crawl history for a corpus (single page). */
  async listCrawls(corpusId: string, options?: ListCrawlsOptions): Promise<Record<string, unknown>> {
    return crawlsMethods.listCrawls(this.http, corpusId, options);
  }

  /** Auto-paginate all crawl jobs. */
  async *listAllCrawls(corpusId: string, options?: Omit<ListCrawlsOptions, "offset">): AsyncGenerator<CrawlJob> {
    yield* paginateOffset<CrawlJob>(
      (opts) => crawlsMethods.listCrawls(this.http, corpusId, opts),
      options,
    );
  }

  /** List per-URL crawl results (single page). */
  async listCrawlResults(corpusId: string, jobId: string, options?: ListCrawlResultsOptions): Promise<Record<string, unknown>> {
    return crawlsMethods.listCrawlResults(this.http, corpusId, jobId, options);
  }

  /** Auto-paginate all crawl results. */
  async *listAllCrawlResults(corpusId: string, jobId: string, options?: Omit<ListCrawlResultsOptions, "cursor">): AsyncGenerator<CrawlResult> {
    yield* paginateCursor<CrawlResult>(
      (opts) => crawlsMethods.listCrawlResults(this.http, corpusId, jobId, opts),
      options,
    );
  }

  /** List crawl errors (single page). */
  async listCrawlErrors(corpusId: string, jobId: string, options?: ListCrawlErrorsOptions): Promise<Record<string, unknown>> {
    return crawlsMethods.listCrawlErrors(this.http, corpusId, jobId, options);
  }

  /** Auto-paginate all crawl errors. */
  async *listAllCrawlErrors(corpusId: string, jobId: string, options?: Omit<ListCrawlErrorsOptions, "cursor">): AsyncGenerator<CrawlError> {
    yield* paginateCursor<CrawlError>(
      (opts) => crawlsMethods.listCrawlErrors(this.http, corpusId, jobId, opts),
      options,
    );
  }

  /** Get crawl schedule configuration. */
  async getCrawlSchedule(corpusId: string): Promise<CrawlSchedule> {
    return crawlsMethods.getCrawlSchedule(this.http, corpusId);
  }

  // ---- Policies ----

  /** Update search policy fields (merge semantics). */
  async updateSearchPolicy(corpusId: string, policy: SearchPolicy): Promise<Policy> {
    return policiesMethods.updateSearchPolicy(this.http, corpusId, policy);
  }

  // ---- Subscriptions ----

  /** Create a webhook subscription for change events. */
  async createSubscription(corpusId: string, params: CreateSubscriptionParams): Promise<Subscription> {
    return subscriptionsMethods.createSubscription(this.http, corpusId, params);
  }

  /** List active webhooks for a corpus. */
  async listSubscriptions(corpusId: string, options?: ListSubscriptionsOptions): Promise<Record<string, unknown>> {
    return subscriptionsMethods.listSubscriptions(this.http, corpusId, options);
  }

  // ---- Catalog ----

  /** Browse the published corpus catalog. */
  async listCatalog(options?: ListCatalogOptions): Promise<Record<string, unknown>> {
    return catalogMethods.listCatalog(this.http, options);
  }

  /** Auto-paginate all catalog entries. */
  async *listAllCatalog(options?: Omit<ListCatalogOptions, "offset">): AsyncGenerator<CatalogEntry> {
    yield* paginateOffset<CatalogEntry>(
      (opts) => catalogMethods.listCatalog(this.http, opts),
      options,
    );
  }

  /** Subscribe to a published corpus. */
  async subscribeCorpus(corpusId: string): Promise<Record<string, unknown>> {
    return catalogMethods.subscribeCorpus(this.http, corpusId);
  }

  /** Unsubscribe from a published corpus. */
  async unsubscribeCorpus(corpusId: string): Promise<void> {
    return catalogMethods.unsubscribeCorpus(this.http, corpusId);
  }

  // ---- Apps ----

  /** List available connector/ranker apps. */
  async listApps(options?: ListAppsOptions): Promise<Record<string, unknown>> {
    return appsMethods.listApps(this.http, options);
  }

  /** Auto-paginate all apps. */
  async *listAllApps(options?: Omit<ListAppsOptions, "offset">): AsyncGenerator<App> {
    yield* paginateOffset<App>(
      (opts) => appsMethods.listApps(this.http, opts),
      options,
    );
  }

  /** Get a specific app's details. */
  async getApp(appId: string): Promise<App> {
    return appsMethods.getApp(this.http, appId);
  }

  // ---- Usage ----

  /** Get current metered usage counters. */
  async getUsage(options?: GetUsageOptions): Promise<Usage> {
    return usageMethods.getUsage(this.http, options);
  }

  /** Get plan limits and remaining quota. */
  async getLimits(): Promise<Limits> {
    return usageMethods.getLimits(this.http);
  }
}
