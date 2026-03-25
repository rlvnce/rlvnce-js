import type { HttpTransport } from "../client.js";
import type {
  TriggerCrawlOptions,
  CrawlJob,
  ListCrawlsOptions,
  ListCrawlResultsOptions,
  ListCrawlErrorsOptions,
  CrawlSchedule,
  SourcesListResponse,
} from "../types.js";

export async function triggerCrawl(
  http: HttpTransport,
  corpusId: string,
  options?: TriggerCrawlOptions,
): Promise<CrawlJob> {
  let resolvedSourceId = options?.source_id;

  // Resolve source_url to source_id if provided
  if (options?.source_url && !resolvedSourceId) {
    const sourcesResp = await http.get<SourcesListResponse>(`/v1/corpora/${corpusId}/sources`);
    const sources = sourcesResp.sources ?? [];
    const match = sources.find((s) => s.url === options.source_url);
    if (!match) {
      throw new Error(`No source found with URL "${options.source_url}" in corpus ${corpusId}`);
    }
    resolvedSourceId = match.id;
  }

  const body: Record<string, unknown> = {};
  if (options?.force) body.force = true;
  if (resolvedSourceId) body.source_id = resolvedSourceId;

  return http.post<CrawlJob>(
    `/v1/corpora/${corpusId}/crawls`,
    Object.keys(body).length > 0 ? body : undefined,
  );
}

export async function cancelCrawl(
  http: HttpTransport,
  corpusId: string,
  jobId: string,
): Promise<Record<string, unknown>> {
  return http.post<Record<string, unknown>>(`/v1/corpora/${corpusId}/crawls/${jobId}/cancel`);
}

export async function getCrawlStatus(
  http: HttpTransport,
  corpusId: string,
  jobId: string,
): Promise<CrawlJob> {
  return http.get<CrawlJob>(`/v1/corpora/${corpusId}/crawls/${jobId}`);
}

export async function listCrawls(
  http: HttpTransport,
  corpusId: string,
  options?: ListCrawlsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.offset !== undefined) params.offset = String(options.offset);
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/crawls`, params);
}

export async function listCrawlResults(
  http: HttpTransport,
  corpusId: string,
  jobId: string,
  options?: ListCrawlResultsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.status) params.status = options.status;
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.cursor) params.cursor = options.cursor;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/crawls/${jobId}/tasks`, params);
}

export async function listCrawlErrors(
  http: HttpTransport,
  corpusId: string,
  jobId: string,
  options?: ListCrawlErrorsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.cursor) params.cursor = options.cursor;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/crawls/${jobId}/errors`, params);
}

export async function getCrawlSchedule(
  http: HttpTransport,
  corpusId: string,
): Promise<CrawlSchedule> {
  return http.get<CrawlSchedule>(`/v1/corpora/${corpusId}/crawls/schedule`);
}
