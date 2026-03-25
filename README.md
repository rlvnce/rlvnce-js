# @rlvnce/client

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

## Methods

### Search & Documents

| Method | Description |
|---|---|
| `search(corpusId, query, options?)` | Full-text search with filters and boosts |
| `getDocument(corpusId, documentId)` | Fetch document content and metadata |
| `listDocuments(corpusId, options?)` | Paginated document list (single page) |
| `listAllDocuments(corpusId, options?)` | Auto-paginate all documents (async generator) |
| `sampleDocuments(corpusId, options?)` | Random document sample for quality checks |
| `listChanges(corpusId, options?)` | Change feed since a timestamp (single page) |
| `listAllChanges(corpusId, options?)` | Auto-paginate all changes (async generator) |

### Corpora

| Method | Description |
|---|---|
| `listCorpora(options?)` | List corpora (single page) |
| `listAllCorpora(options?)` | Auto-paginate all corpora (async generator) |
| `getCorpus(corpusId)` | Full detail: corpus + policy + sources |
| `createCorpus(params)` | Create corpus with sources and policies (composite) |
| `updateCorpus(corpusId, params)` | Update metadata and/or policies (merge semantics) |
| `deleteCorpus(corpusId, corpusName)` | Delete with name verification safety check |
| `cloneCorpus(sourceCorpusId, params)` | Clone with optional source filtering |
| `getCorpusMetrics(corpusId)` | Health snapshot: coverage, freshness, success rate |

### Sources

| Method | Description |
|---|---|
| `addSources(corpusId, sources)` | Add source URLs to a corpus |
| `removeSource(corpusId, sourceId)` | Remove a source |
| `listSources(corpusId)` | List all sources |
| `getSourceStats(corpusId, sourceId)` | Per-source crawl stats |
| `listSourceUrls(corpusId, sourceId, options?)` | Indexed URLs for a source (single page) |
| `listAllSourceUrls(corpusId, sourceId, options?)` | Auto-paginate source URLs |
| `updateSource(corpusId, sourceId, config)` | Update source config (merge semantics) |

### Crawls

| Method | Description |
|---|---|
| `triggerCrawl(corpusId, options?)` | Start a crawl (supports source_url resolution) |
| `cancelCrawl(corpusId, jobId)` | Cancel a running crawl |
| `getCrawlStatus(corpusId, jobId)` | Job progress counters |
| `listCrawls(corpusId, options?)` | Crawl history (single page) |
| `listAllCrawls(corpusId, options?)` | Auto-paginate crawl history |
| `listCrawlResults(corpusId, jobId, options?)` | Per-URL results (single page) |
| `listAllCrawlResults(corpusId, jobId, options?)` | Auto-paginate crawl results |
| `listCrawlErrors(corpusId, jobId, options?)` | Failed URLs (single page) |
| `listAllCrawlErrors(corpusId, jobId, options?)` | Auto-paginate crawl errors |
| `getCrawlSchedule(corpusId)` | Schedule config and next crawl time |

### Policies

| Method | Description |
|---|---|
| `updateSearchPolicy(corpusId, policy)` | Update search ranking weights (merge semantics) |

### Subscriptions

| Method | Description |
|---|---|
| `createSubscription(corpusId, params)` | Create webhook for change events |
| `listSubscriptions(corpusId, options?)` | List active webhooks |

### Catalog

| Method | Description |
|---|---|
| `listCatalog(options?)` | Browse published corpus catalog (single page) |
| `listAllCatalog(options?)` | Auto-paginate catalog |
| `subscribeCorpus(corpusId)` | Subscribe to a published corpus |
| `unsubscribeCorpus(corpusId)` | Unsubscribe from a published corpus |

### Apps

| Method | Description |
|---|---|
| `listApps(options?)` | List connector/ranker apps (single page) |
| `listAllApps(options?)` | Auto-paginate apps |
| `getApp(appId)` | Get app details |

### Usage

| Method | Description |
|---|---|
| `getUsage(options?)` | Metered usage counters |
| `getLimits()` | Plan limits and remaining quota |

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
npm install
npm run lint       # tsc --noEmit
npm test           # vitest
npm run build      # tsup → dist/ (ESM + CJS + .d.ts)
```
