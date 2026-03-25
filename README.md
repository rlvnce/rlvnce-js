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

## Configuration

```typescript
const client = new RlvnceClient({
  apiKey: "rlv_...",                          // required
  baseUrl: "https://api.rlvnce.com",         // optional (default)
  timeout: 30_000,                            // optional, ms (default: 30000)
  fetch: customFetch,                         // optional, custom fetch impl
});
```

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
