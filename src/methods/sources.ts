import type { HttpTransport } from "../client.js";
import type {
  SourceInput,
  Source,
  SourcesListResponse,
  SourceStats,
  ListSourceUrlsOptions,
  RequestOptions,
} from "../types.js";

export async function addSources(
  http: HttpTransport,
  corpusId: string,
  sources: SourceInput[],
  options?: RequestOptions,
): Promise<Array<{ url: string; source?: unknown; error?: string }>> {
  const results: Array<{ url: string; source?: unknown; error?: string }> = [];
  for (const source of sources) {
    const payload = source.source_config
      ? { ...source, source_config: { url: source.url, ...source.source_config } }
      : source;
    try {
      const created = await http.post(`/v1/corpora/${corpusId}/sources`, payload, options);
      results.push({ url: source.url, source: created });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ url: source.url, error: msg });
    }
  }
  return results;
}

export async function removeSource(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  options?: RequestOptions,
): Promise<void> {
  await http.delete(`/v1/corpora/${corpusId}/sources/${sourceId}`, options);
}

export async function listSources(
  http: HttpTransport,
  corpusId: string,
  options?: RequestOptions,
): Promise<SourcesListResponse> {
  return http.get<SourcesListResponse>(`/v1/corpora/${corpusId}/sources`, undefined, options);
}

export async function getSourceStats(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  options?: RequestOptions,
): Promise<SourceStats> {
  return http.get<SourceStats>(`/v1/corpora/${corpusId}/sources/${sourceId}`, undefined, options);
}

export async function listSourceUrls(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  options?: ListSourceUrlsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.cursor) params.cursor = options.cursor;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/sources/${sourceId}/urls`, params, options);
}

export async function resetSource(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  options?: RequestOptions,
): Promise<SourceStats> {
  return http.post<SourceStats>(`/v1/corpora/${corpusId}/sources/${sourceId}/reset`, undefined, options);
}

export async function updateSource(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  sourceConfig: Record<string, unknown>,
  options?: RequestOptions,
): Promise<Source> {
  const current = await http.get<{ source_config?: Record<string, unknown> }>(
    `/v1/corpora/${corpusId}/sources/${sourceId}`, undefined, options,
  );
  const merged = { ...(current.source_config ?? {}), ...sourceConfig };
  return http.patch<Source>(`/v1/corpora/${corpusId}/sources/${sourceId}`, {
    source_config: merged,
  }, options);
}
