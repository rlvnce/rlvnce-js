# @rlvnce/client

[![CI](https://github.com/rlvnce/rlvnce-js/actions/workflows/ci.yml/badge.svg)](https://github.com/rlvnce/rlvnce-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@rlvnce/client)](https://www.npmjs.com/package/@rlvnce/client)

TypeScript client for the RLVNCE public API. Zero runtime dependencies — uses Node.js built-in `fetch`.

## Installation

```bash
npm install @rlvnce/client
```

Requires Node.js >= 18.

## Quick Start

```typescript
import { RlvnceClient } from "@rlvnce/client";

const client = new RlvnceClient({ apiKey: "rlv_..." });

// Search a corpus
const results = await client.search("corpus-id", "machine learning", { limit: 10 });
console.log(results.results);

// List your corpora
const corpora = await client.listCorpora();
```

## Search

### Basic search

```typescript
const results = await client.search("corpus-id", "kubernetes deployment");
for (const hit of results.results) {
  console.log(`${hit.title} (${hit.score})`);
  console.log(`  ${hit.url}`);
  console.log(`  ${hit.snippet}`);
}
```

### Filters

Narrow results by URL prefix, content type, language, source, or date ranges:

```typescript
const results = await client.search("corpus-id", "authentication", {
  limit: 20,
  filters: {
    url_prefix: "https://docs.example.com/api/",  // domain/path filtering
    content_type: "text/html",                      // MIME type (prefix match: "text/" matches text/html, text/plain)
    lang: "en",                                     // language code
    source_id: "source-uuid",                       // restrict to one source
    changed_after: "2026-01-01T00:00:00Z",          // only recently changed docs
    created_after: "2025-06-01T00:00:00Z",          // first indexed after
    updated_before: "2026-03-01T00:00:00Z",         // last updated before
  },
});
```

### Attribute filters

Filter on document attributes using typed operators. Two kinds of attributes are available:

**System fields** (available on all corpora):

| Field | Type | Operators | Description |
|---|---|---|---|
| `_url` | string | `prefix` | Full URL including scheme. Use for domain/path filtering. |
| `_source` | string | `eq` | Source UUID. Filters to documents from a specific corpus source. |
| `_content_type` | string | `eq`, `prefix` | MIME type (e.g. `text/html`, `application/pdf`). |
| `_created_at` | datetime | `gt`, `gte`, `lt`, `lte`, `range` | When the document was first indexed. |
| `_updated_at` | datetime | `gt`, `gte`, `lt`, `lte`, `range` | When the document was last updated. |

**Corpus-defined attributes** (set via connector or attribute schema):

Connectors can define custom attributes on documents (e.g. `category`, `priority`, `tags`). These are typed fields with the following types and operators:

| Type | Operators |
|---|---|
| `string` | `eq`, `neq`, `in` |
| `integer`, `float` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `range` |
| `boolean` | `eq`, `neq` |
| `string_array` | `eq` (any element matches), `in` |

```typescript
const results = await client.search("corpus-id", "deploy", {
  attribute_filters: [
    // System field: only docs from a specific source
    { field: "_source", op: "eq", value: "01936f7b-..." },
    // System field: only PDFs
    { field: "_content_type", op: "eq", value: "application/pdf" },
    // System field: updated in the last month
    { field: "_updated_at", op: "gte", value: "2026-03-01T00:00:00Z" },
    // Corpus-defined: category equals "guide"
    { field: "category", op: "eq", value: "guide" },
    // Corpus-defined: priority above 3
    { field: "priority", op: "gte", value: 3 },
  ],
});
```

### Attribute boosts

Boost relevance scores for documents matching attribute criteria without excluding non-matching documents:

```typescript
const results = await client.search("corpus-id", "getting started", {
  attribute_boosts: [
    // Boost docs from the official docs domain
    { field: "_url", multiplier: 2.0, value: "https://docs.example.com/" },
    // Boost guides over reference docs
    { field: "category", multiplier: 1.5, value: "guide" },
    // Boost all high-priority docs regardless of value
    { field: "priority", multiplier: 1.3 },
  ],
});
```

### Combining filters and boosts

```typescript
const results = await client.search("corpus-id", "error handling", {
  limit: 10,
  offset: 0,
  filters: {
    url_prefix: "https://docs.example.com/",
    lang: "en",
    changed_after: "2026-01-01T00:00:00Z",
  },
  attribute_filters: [
    { field: "category", op: "in", value: "guide,tutorial" },
  ],
  attribute_boosts: [
    { field: "priority", multiplier: 2.0, value: 1 },
  ],
});
```

## Configuration

```typescript
const client = new RlvnceClient({
  apiKey: "rlv_...",                          // required
  baseUrl: "https://api.rlvnce.com",         // optional (default)
  timeout: 30_000,                            // optional, ms (default: 30000)
  maxRetries: 2,                              // optional (default: 2, set 0 to disable)
  retryDelay: 500,                            // optional, ms (default: 500, doubles each attempt)
  fetch: customFetch,                         // optional, custom fetch impl
  onRequest: ({ method, url, attempt }) => {  // optional, logging/telemetry hook
    console.log(`${method} ${url} (attempt ${attempt})`);
  },
  onResponse: ({ status, durationMs }) => {   // optional, logging/telemetry hook
    console.log(`${status} in ${durationMs}ms`);
  },
});
```

Retries use exponential backoff with jitter. Retryable status codes: 429, 500, 502, 503, 504. Network errors and timeouts are also retried. The `Retry-After` header on 429 responses is respected.

## API Reference

All methods accept an optional `signal?: AbortSignal` for cancellation (via `RequestOptions`).

### Search & Documents

#### `search(corpusId, query, options?)`

Full-text search over a corpus. See [Search](#search) section above for detailed filter/boost examples.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus to search |
| `query` | `string` | Search query (1-1000 characters) |
| `options.limit` | `number` | Max results to return (1-100, default 10) |
| `options.offset` | `number` | Results to skip for pagination |
| `options.filters` | `SearchFilters` | Content filters (see below) |
| `options.attribute_filters` | `AttributeFilter[]` | Attribute-based filters (see [Attribute filters](#attribute-filters)) |
| `options.attribute_boosts` | `AttributeBoost[]` | Attribute-based score boosts (see [Attribute boosts](#attribute-boosts)) |

**SearchFilters:**

| Field | Type | Description |
|---|---|---|
| `url_prefix` | `string` | Filter to URLs starting with this prefix (include scheme) |
| `source_id` | `string` | Filter to documents from a specific source (UUID) |
| `content_type` | `string` | Filter by MIME type (prefix match: `"text/"` matches `text/html`) |
| `lang` | `string` | Filter by language code (e.g. `"en"`) |
| `changed_after` | `string` | ISO 8601 — documents changed after this time |
| `published_after` | `string` | ISO 8601 — documents published after this time |
| `created_after` | `string` | ISO 8601 — documents first crawled after this time |
| `created_before` | `string` | ISO 8601 — documents first crawled before this time |
| `updated_after` | `string` | ISO 8601 — documents last updated after this time |
| `updated_before` | `string` | ISO 8601 — documents last updated before this time |

**Returns:** `SearchResponse` — `{ results: SearchResult[], total?, query_ms? }`

#### `getDocument(corpusId, documentId)`

Fetch a document's full content and metadata.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `documentId` | `string` | Document ID (from search results as `doc_id`) |

**Returns:** `Document` — `{ url, title?, body?, headings?, language?, content_type?, created_at?, updated_at? }`

#### `listDocuments(corpusId, options?)`

Paginated document metadata list (no body content). Use `listAllDocuments()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `options.source_id` | `string` | Filter by source UUID (mutually exclusive with `url_prefix`) |
| `options.content_type` | `string` | Filter by MIME type |
| `options.url_prefix` | `string` | Filter by URL prefix (mutually exclusive with `source_id`) |
| `options.indexed_after` | `string` | ISO 8601 — first indexed after |
| `options.indexed_before` | `string` | ISO 8601 — first indexed before |
| `options.limit` | `number` | Max documents per page (1-200, default 50) |
| `options.cursor` | `string` | Pagination cursor from previous response |

#### `sampleDocuments(corpusId, options?)`

Fetch N random documents for extraction quality spot-checks.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `options.n` | `number` | Number of documents to sample (1-20, default 5) |

#### `listChanges(corpusId, options?)`

Change feed since a timestamp with cursor pagination. Use `listAllChanges()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `options.since` | `string` | ISO 8601 — changes after this time |
| `options.limit` | `number` | Max changes to return (1-100, default 20) |
| `options.cursor` | `string` | Pagination cursor from previous response |
| `options.types` | `string` | Comma-separated change types: `"created"`, `"updated"`, `"deleted"` |

---

### Corpora

#### `listCorpora(options?)`

List available corpora. Use `listAllCorpora()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.limit` | `number` | Max corpora to return (1-100, default 20) |
| `options.offset` | `number` | Number to skip |
| `options.status` | `string` | Filter: `"active"`, `"building"`, or `"error"` |

#### `getCorpus(corpusId)`

Full corpus detail including sources and policy (fetched in parallel).

**Returns:** `CorpusDetail` — corpus fields + `policy?` + `sources?`

#### `createCorpus(params)` (composite)

Create a corpus with optional sources and policies in a single call. Orchestrates up to 3 API calls (create → add sources → set policy). Throws `RlvnceCompositeError` on partial failure.

| Parameter | Type | Description |
|---|---|---|
| `params.name` | `string` | Corpus name (1-200 chars) |
| `params.description` | `string?` | Optional description (max 2000 chars) |
| `params.sources` | `SourceInput[]?` | Source URLs to add after creation |
| `params.crawl_policy` | `CrawlPolicy?` | Crawl policy settings |
| `params.search_policy` | `SearchPolicy?` | Search ranking policy |
| `params.connector_app_id` | `string?` | Connector app UUID (default: web connector) |
| `params.ranker_app_id` | `string?` | Ranker app UUID (default: standard ranker) |
| `params.connector_config` | `Record?` | Opaque connector-specific config |

**Returns:** `CreateCorpusResult` — `{ corpus, sources?, policy? }`

#### `updateCorpus(corpusId, params)` (composite)

Update metadata and/or policies. Policy fields are merged with existing values — only fields you specify change. Throws `RlvnceCompositeError` on partial failure.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `params.name` | `string?` | New name |
| `params.description` | `string?` | New description |
| `params.crawl_policy` | `CrawlPolicy?` | Crawl policy fields to update (merged) |
| `params.search_policy` | `SearchPolicy?` | Search policy fields to update (merged) |

**Returns:** `UpdateCorpusResult` — `{ corpus?, policy? }`

#### `deleteCorpus(corpusId, corpusName)`

Delete a corpus. Both ID and name are required — the name is verified against the actual corpus before deletion to prevent accidental deletion.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `corpusName` | `string` | Corpus name (must match — safety check) |

#### `cloneCorpus(sourceCorpusId, params)` (composite)

Create a new corpus pre-populated with sources (and optionally policy) from an existing corpus. Throws `RlvnceCompositeError` on partial failure.

| Parameter | Type | Description |
|---|---|---|
| `sourceCorpusId` | `string` | UUID of the corpus to clone from |
| `params.name` | `string` | Name for the new corpus (1-200 chars) |
| `params.description` | `string?` | Optional description |
| `params.source_filter` | `object?` | Filter which sources to copy |
| `params.source_filter.source_ids` | `string[]?` | Only copy these source IDs |
| `params.source_filter.source_urls` | `string[]?` | Only copy sources matching these URLs |
| `params.copy_policy` | `boolean?` | Copy crawl and search policy (default: `true`) |

**Returns:** `CloneCorpusResult` — `{ source_corpus, corpus, sources, policy? }`

#### `getCorpusMetrics(corpusId)`

Computed corpus health snapshot.

**Returns:** `CorpusMetrics` — `{ document_count?, storage_bytes?, source_count?, freshness_lag_hours?, crawl_success_rate? }`

---

### Sources

#### `addSources(corpusId, sources)`

Add source URLs to a corpus. Each source is added individually — partial failures return per-source errors.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `sources` | `SourceInput[]` | Array of `{ url, source_config? }` |

**Returns:** `Array<{ url, source?, error? }>` — per-source results

#### `removeSource(corpusId, sourceId)`

Remove a source and its indexed documents from a corpus.

#### `listSources(corpusId)`

List all sources for a corpus.

**Returns:** `SourcesListResponse` — `{ sources: Source[] }`

#### `getSourceStats(corpusId, sourceId)`

Detailed per-source crawl stats.

**Returns:** `SourceStats` — `{ id, url, document_count?, error_count?, last_crawled_at?, last_error_type?, consecutive_failures? }`

#### `listSourceUrls(corpusId, sourceId, options?)`

List indexed URLs for a source. Use `listAllSourceUrls()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.limit` | `number` | Max URLs per page (1-200, default 50) |
| `options.cursor` | `string` | Pagination cursor |

#### `updateSource(corpusId, sourceId, sourceConfig)`

Update a source's config. Fields are merged with existing config — unmentioned fields are preserved.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `sourceId` | `string` | UUID of the source |
| `sourceConfig` | `Record<string, unknown>` | Config fields to set/update (e.g. `allowed_domains`, `exclude_url_patterns`) |

---

### Crawls

#### `triggerCrawl(corpusId, options?)`

Start a crawl for a corpus. Returns 409 if a crawl is already running.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `options.force` | `boolean?` | Force recrawl ignoring freshness checks |
| `options.source_id` | `string?` | Crawl only this source (UUID, mutually exclusive with `source_url`) |
| `options.source_url` | `string?` | Crawl source matching this URL (resolved to source_id internally) |

**Returns:** `CrawlJob` — `{ id, status }`

#### `cancelCrawl(corpusId, jobId)`

Cancel a running crawl job.

#### `getCrawlStatus(corpusId, jobId)`

Get crawl job progress.

**Returns:** `CrawlJob` — `{ id, status, pages_discovered?, pages_crawled?, pages_failed?, pages_unchanged? }`

#### `listCrawls(corpusId, options?)`

Crawl history. Use `listAllCrawls()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.limit` | `number` | Max jobs to return (1-100, default 20) |
| `options.offset` | `number` | Number to skip |

#### `listCrawlResults(corpusId, jobId, options?)`

Per-URL crawl results. Use `listAllCrawlResults()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.status` | `string?` | Filter: comma-separated (`"completed,failed,unchanged,pending,enqueued"`) |
| `options.limit` | `number` | Max results (1-100, default 50) |
| `options.cursor` | `string` | Pagination cursor |

#### `listCrawlErrors(corpusId, jobId, options?)`

Failed URLs from a crawl job. Use `listAllCrawlErrors()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.limit` | `number` | Max errors (1-500, default 100) |
| `options.cursor` | `string` | Pagination cursor |

**Returns items:** `CrawlError` — `{ url, error_type?, http_status?, message? }`

#### `getCrawlSchedule(corpusId)`

Get crawl schedule configuration.

**Returns:** `CrawlSchedule` — `{ schedule_type?, auto_crawl?, last_crawl_at?, next_crawl_at?, overdue? }`

---

### Policies

#### `updateSearchPolicy(corpusId, policy)` (composite)

Update search ranking policy. Fields are merged with existing policy — only fields you specify change.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `policy.title_weight` | `number?` | BM25F weight for title field |
| `policy.headings_weight` | `number?` | BM25F weight for headings |
| `policy.body_weight` | `number?` | BM25F weight for body |
| `policy.url_weight` | `number?` | BM25F weight for URL |
| `policy.meta_description_weight` | `number?` | BM25F weight for meta description |
| `policy.recency_boost` | `number?` | Boost factor for recently updated documents |
| `policy.recency_decay_rate` | `number?` | Decay rate for recency boost (higher = faster decay) |
| `policy.domain_boosts` | `Record<string, number>?` | Per-domain score multipliers (e.g. `{ "docs.example.com": 1.5 }`) |
| `policy.path_boosts` | `Record<string, number>?` | Per-path-prefix score multipliers (e.g. `{ "/api/": 2.0 }`) |

---

### Subscriptions

#### `createSubscription(corpusId, params)`

Create a webhook subscription for change events. Returns `signing_secret` only on creation.

| Parameter | Type | Description |
|---|---|---|
| `corpusId` | `string` | UUID of the corpus |
| `params.event_types` | `Array` | Event types: `"created"`, `"updated"`, `"deleted"` |
| `params.webhook_url` | `string` | HTTPS URL for webhook delivery |
| `params.batch_size` | `number?` | Events per batch (1-100, default 10) |
| `params.batch_interval_seconds` | `number?` | Seconds between batches (10-3600, default 60) |

**Returns:** `Subscription` — includes `signing_secret` (only returned on creation)

#### `listSubscriptions(corpusId, options?)`

List webhooks for a corpus.

| Parameter | Type | Description |
|---|---|---|
| `options.status` | `string?` | Filter: `"active"`, `"paused"`, or `"disabled"` |

---

### Catalog

#### `listCatalog(options?)`

Browse the published corpus catalog. Use `listAllCatalog()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.category` | `string?` | Filter by category (exact match) |
| `options.search` | `string?` | Search by title or description |
| `options.limit` | `number` | Max entries (1-100, default 20) |
| `options.offset` | `number` | Number to skip |

#### `subscribeCorpus(corpusId)`

Subscribe to a published corpus for read-only search and change feed access.

#### `unsubscribeCorpus(corpusId)`

Remove a corpus subscription.

---

### Apps

#### `listApps(options?)`

List available connector and ranker apps. Use `listAllApps()` for auto-pagination.

| Parameter | Type | Description |
|---|---|---|
| `options.type` | `string?` | Filter: `"connector"` or `"ranker"` |
| `options.search` | `string?` | Search by app name |
| `options.limit` | `number` | Max apps (1-100, default 20) |
| `options.offset` | `number` | Number to skip |

#### `getApp(appId)`

Get a specific app's details including versions and schemas.

---

### Usage

#### `getUsage(options?)`

Current metered usage counters.

| Parameter | Type | Description |
|---|---|---|
| `options.period` | `string?` | Billing period in `YYYY-MM` format (e.g. `"2026-03"`) |

**Returns:** `Usage` — `{ queries?, crawl_pages?, crawl_bytes?, document_fetches?, storage_bytes? }`

#### `getLimits()`

Plan limits and remaining quota.

**Returns:** `Limits` — `{ tier?, max_corpora?, included_searches? }`

---

### Crawl Policy

Used in `createCorpus` and `updateCorpus`:

| Field | Type | Description |
|---|---|---|
| `schedule` | `string?` | `"manual"`, `"hourly"`, `"daily"`, or `"weekly"` |
| `max_documents` | `number?` | Max total documents to crawl per run |
| `max_bytes_per_day` | `number?` | Max bytes to download per day |
| `connector_config` | `Record?` | Connector-specific: `depth_limit`, `rate_limit_per_domain`, `concurrency`, `strip_tracking_params`, `follow_canonical`, `respect_robots_txt`, `ssl_verify`, `custom_user_agent` |

## Pagination

Every paginated endpoint has two variants:

```typescript
// Single page — you manage pagination
const page = await client.listCorpora({ limit: 20, offset: 0 });

// Auto-iterate all pages — async generator
for await (const corpus of client.listAllCorpora({ limit: 50 })) {
  console.log(corpus.name);
}
```

Offset-based endpoints (corpora, crawls, catalog, apps) use `limit`/`offset`. Cursor-based endpoints (documents, changes, crawl results/errors, source URLs) use `limit`/`cursor`.

## Error Handling

```typescript
import { RlvnceApiError, RlvnceCompositeError } from "@rlvnce/client";

try {
  await client.search("bad-id", "query");
} catch (e) {
  if (e instanceof RlvnceApiError) {
    console.log(e.status);    // 404
    console.log(e.code);      // "NOT_FOUND"
    console.log(e.message);   // "Corpus not found"
    console.log(e.retryable); // false
  }
}
```

### Composite operations

`createCorpus`, `updateCorpus`, `cloneCorpus` orchestrate multiple API calls. If an early step succeeds but a later step fails, they throw `RlvnceCompositeError` with partial results:

```typescript
try {
  await client.createCorpus({
    name: "My Corpus",
    sources: [{ url: "https://bad-url" }],
  });
} catch (e) {
  if (e instanceof RlvnceCompositeError) {
    console.log(e.partialResult); // { corpus: { id: "..." }, sources: [...] }
    console.log(e.errors);        // [{ step: "add source ...", error: ... }]
  }
}
```

## Development

```bash
cd clients/rlvnce-js
pnpm install
pnpm run lint       # tsc --noEmit
pnpm test           # vitest
pnpm run build      # tsup → dist/ (ESM + CJS + .d.ts)
```
