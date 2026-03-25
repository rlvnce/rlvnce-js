import type { HttpTransport } from "../client.js";
import type { ListCatalogOptions } from "../types.js";

export async function listCatalog(
  http: HttpTransport,
  options?: ListCatalogOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.category) params.category = options.category;
  if (options?.search) params.search = options.search;
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.offset !== undefined) params.offset = String(options.offset);
  return http.get<Record<string, unknown>>("/v1/catalog", params);
}

export async function subscribeCorpus(
  http: HttpTransport,
  corpusId: string,
): Promise<Record<string, unknown>> {
  return http.post<Record<string, unknown>>(`/v1/corpora/${corpusId}/subscribe`);
}

export async function unsubscribeCorpus(
  http: HttpTransport,
  corpusId: string,
): Promise<void> {
  await http.delete(`/v1/corpora/${corpusId}/subscribe`);
}
