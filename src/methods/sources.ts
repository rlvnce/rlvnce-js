import type { HttpTransport } from "../client.js";
import type {
  SourceInput,
  Source,
  SourcesListResponse,
  SourceStats,
  ListSourceUrlsOptions,
} from "../types.js";

export async function addSources(
  http: HttpTransport,
  corpusId: string,
  sources: SourceInput[],
): Promise<Array<{ url: string; source?: unknown; error?: string }>> {
  const results: Array<{ url: string; source?: unknown; error?: string }> = [];
  for (const source of sources) {
    const payload = source.source_config
      ? { ...source, source_config: { url: source.url, ...source.source_config } }
      : source;
    try {
      const created = await http.post(`/v1/corpora/${corpusId}/sources`, payload);
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
): Promise<void> {
  await http.delete(`/v1/corpora/${corpusId}/sources/${sourceId}`);
}

export async function listSources(
  http: HttpTransport,
  corpusId: string,
): Promise<SourcesListResponse> {
  return http.get<SourcesListResponse>(`/v1/corpora/${corpusId}/sources`);
}

export async function getSourceStats(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
): Promise<SourceStats> {
  return http.get<SourceStats>(`/v1/corpora/${corpusId}/sources/${sourceId}`);
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
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/sources/${sourceId}/urls`, params);
}

export async function updateSource(
  http: HttpTransport,
  corpusId: string,
  sourceId: string,
  sourceConfig: Record<string, unknown>,
): Promise<Source> {
  const current = await http.get<{ source_config?: Record<string, unknown> }>(
    `/v1/corpora/${corpusId}/sources/${sourceId}`,
  );
  const merged = { ...(current.source_config ?? {}), ...sourceConfig };
  return http.patch<Source>(`/v1/corpora/${corpusId}/sources/${sourceId}`, {
    source_config: merged,
  });
}
