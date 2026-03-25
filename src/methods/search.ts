import type { HttpTransport } from "../client.js";
import type {
  SearchOptions,
  SearchResponse,
  Document,
  ListDocumentsOptions,
  SampleDocumentsOptions,
  ListChangesOptions,
  RequestOptions,
} from "../types.js";

export async function search(
  http: HttpTransport,
  corpusId: string,
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> {
  const body: Record<string, unknown> = { query };
  if (options?.limit !== undefined) body.limit = options.limit;
  if (options?.offset !== undefined) body.offset = options.offset;
  if (options?.filters) body.filters = options.filters;
  if (options?.attribute_filters) body.attribute_filters = options.attribute_filters;
  if (options?.attribute_boosts) body.attribute_boosts = options.attribute_boosts;
  return http.post<SearchResponse>(`/v1/corpora/${corpusId}/search`, body, options);
}

export async function getDocument(
  http: HttpTransport,
  corpusId: string,
  documentId: string,
  options?: RequestOptions,
): Promise<Document> {
  return http.get<Document>(`/v1/corpora/${corpusId}/documents/${documentId}`, undefined, options);
}

export async function listDocuments(
  http: HttpTransport,
  corpusId: string,
  options?: ListDocumentsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.source_id) params.source_id = options.source_id;
  if (options?.content_type) params.content_type = options.content_type;
  if (options?.url_prefix) params.url_prefix = options.url_prefix;
  if (options?.indexed_after) params.indexed_after = options.indexed_after;
  if (options?.indexed_before) params.indexed_before = options.indexed_before;
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.cursor) params.cursor = options.cursor;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/documents`, params, options);
}

export async function sampleDocuments(
  http: HttpTransport,
  corpusId: string,
  options?: SampleDocumentsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.n !== undefined) params.n = String(options.n);
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/documents/sample`, params, options);
}

export async function listChanges(
  http: HttpTransport,
  corpusId: string,
  options?: ListChangesOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.since) params.since = options.since;
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.cursor) params.cursor = options.cursor;
  if (options?.types) params.types = options.types;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/changes`, params, options);
}
