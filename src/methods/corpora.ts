import type { HttpTransport } from "../client.js";
import { RlvnceCompositeError } from "../error.js";
import type {
  Corpus,
  CorpusDetail,
  CorpusMetrics,
  ListCorporaOptions,
  CreateCorpusParams,
  CreateCorpusResult,
  UpdateCorpusParams,
  UpdateCorpusResult,
  DeleteCorpusResult,
  CloneCorpusParams,
  CloneCorpusResult,
  Policy,
  Source,
  SourcesListResponse,
} from "../types.js";

export async function listCorpora(
  http: HttpTransport,
  options?: ListCorporaOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.offset !== undefined) params.offset = String(options.offset);
  if (options?.status) params.status = options.status;
  return http.get<Record<string, unknown>>("/v1/corpora", params);
}

export async function getCorpus(
  http: HttpTransport,
  corpusId: string,
): Promise<CorpusDetail> {
  const [corpus, policy, sources] = await Promise.all([
    http.get<Corpus>(`/v1/corpora/${corpusId}`),
    http.get<Policy>(`/v1/corpora/${corpusId}/policy`).catch(() => null),
    http.get<SourcesListResponse>(`/v1/corpora/${corpusId}/sources`).catch(() => null),
  ]);
  return { ...corpus, policy, sources };
}

export async function createCorpus(
  http: HttpTransport,
  params: CreateCorpusParams,
): Promise<CreateCorpusResult> {
  // Step 1: Create the corpus
  const corpus = await http.post<Corpus>("/v1/corpora", {
    name: params.name,
    connector_app_id: params.connector_app_id ?? "00000000-0000-0000-0000-000000000001",
    ranker_app_id: params.ranker_app_id ?? "00000000-0000-0000-0000-000000000002",
    ...(params.description != null ? { description: params.description } : {}),
    ...(params.connector_config != null ? { connector_config: params.connector_config } : {}),
  });

  const corpusId = corpus.id;
  const result: CreateCorpusResult = { corpus };
  const errors: Array<{ step: string; error: Error }> = [];

  // Step 2: Add sources
  if (params.sources && params.sources.length > 0) {
    const sourceResults: CreateCorpusResult["sources"] = [];
    for (const source of params.sources) {
      const payload = source.source_config
        ? { ...source, source_config: { url: source.url, ...source.source_config } }
        : source;
      try {
        const created = await http.post(`/v1/corpora/${corpusId}/sources`, payload);
        sourceResults.push({ url: source.url, source: created });
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        sourceResults.push({ url: source.url, error: e.message });
        errors.push({ step: `add source ${source.url}`, error: e });
      }
    }
    result.sources = sourceResults;
  }

  // Step 3: Set policy
  if (params.crawl_policy || params.search_policy) {
    try {
      const policyBody: Record<string, unknown> = {};
      if (params.crawl_policy) policyBody.crawl = params.crawl_policy;
      if (params.search_policy) policyBody.search = params.search_policy;
      result.policy = await http.patch<Policy>(`/v1/corpora/${corpusId}/policy`, policyBody);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push({ step: "set policy", error: e });
    }
  }

  if (errors.length > 0) {
    throw new RlvnceCompositeError(
      `Corpus "${params.name}" created (${corpusId}) but ${errors.length} step(s) failed`,
      result as unknown as Record<string, unknown>,
      errors,
    );
  }

  return result;
}

export async function updateCorpus(
  http: HttpTransport,
  corpusId: string,
  params: UpdateCorpusParams,
): Promise<UpdateCorpusResult> {
  const hasMetadata = params.name !== undefined || params.description !== undefined;
  const hasPolicy = params.crawl_policy !== undefined || params.search_policy !== undefined;

  if (!hasMetadata && !hasPolicy) {
    throw new Error("No fields provided to update. Specify at least one of: name, description, crawl_policy, search_policy.");
  }

  const result: UpdateCorpusResult = {};
  const errors: Array<{ step: string; error: Error }> = [];

  if (hasMetadata) {
    try {
      const body: Record<string, unknown> = {};
      if (params.name !== undefined) body.name = params.name;
      if (params.description !== undefined) body.description = params.description;
      result.corpus = await http.patch<Corpus>(`/v1/corpora/${corpusId}`, body);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push({ step: "update metadata", error: e });
    }
  }

  if (hasPolicy) {
    try {
      const current = await http.get<Policy>(`/v1/corpora/${corpusId}/policy`);
      const currentCrawl = (current.crawl ?? {}) as Record<string, unknown>;
      const currentSearch = (current.search ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = {
        crawl: params.crawl_policy ? { ...currentCrawl, ...params.crawl_policy } : currentCrawl,
        search: params.search_policy ? { ...currentSearch, ...params.search_policy } : currentSearch,
      };
      result.policy = await http.patch<Policy>(`/v1/corpora/${corpusId}/policy`, merged);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push({ step: "update policy", error: e });
    }
  }

  if (errors.length > 0) {
    throw new RlvnceCompositeError(
      `Corpus ${corpusId} update partially failed`,
      result as unknown as Record<string, unknown>,
      errors,
    );
  }

  return result;
}

export async function deleteCorpus(
  http: HttpTransport,
  corpusId: string,
  corpusName: string,
): Promise<DeleteCorpusResult> {
  const corpus = await http.get<Corpus>(`/v1/corpora/${corpusId}`);
  if (corpus.name !== corpusName) {
    throw new Error(
      `Corpus name mismatch. Expected "${corpusName}" but corpus ${corpusId} is named "${corpus.name}". This safety check prevents deleting the wrong corpus.`,
    );
  }
  await http.delete(`/v1/corpora/${corpusId}`);
  return { deleted: true, corpus_id: corpusId, corpus_name: corpusName };
}

export async function cloneCorpus(
  http: HttpTransport,
  sourceCorpusId: string,
  params: CloneCorpusParams,
): Promise<CloneCorpusResult> {
  const errors: Array<{ step: string; error: Error }> = [];

  // Step 1: Get source corpus
  const sourceCorpus = await http.get<Corpus>(`/v1/corpora/${sourceCorpusId}`);

  // Step 2: Get sources
  const sourcesResp = await http.get<SourcesListResponse>(`/v1/corpora/${sourceCorpusId}/sources`);
  let allSources = sourcesResp.sources ?? [];

  // Step 3: Apply filter
  if (params.source_filter) {
    const { source_ids, source_urls } = params.source_filter;
    if (source_ids && source_ids.length > 0) {
      const idSet = new Set(source_ids);
      allSources = allSources.filter((s) => idSet.has(s.id));
    }
    if (source_urls && source_urls.length > 0) {
      const urlSet = new Set(source_urls);
      allSources = allSources.filter((s) => urlSet.has(s.url));
    }
  }

  if (allSources.length === 0) {
    throw new Error("No sources match the filter.");
  }

  // Step 4: Create new corpus
  const newCorpus = await http.post<Corpus>("/v1/corpora", {
    name: params.name,
    ...(params.description != null ? { description: params.description } : {}),
  });

  const result: CloneCorpusResult = {
    source_corpus: { id: sourceCorpusId, name: sourceCorpus.name },
    corpus: newCorpus,
    sources: [],
  };

  // Step 5: Add sources
  for (const source of allSources) {
    try {
      const body: Record<string, unknown> = { url: source.url };
      if (source.source_config) body.source_config = source.source_config;
      const created = await http.post(`/v1/corpora/${newCorpus.id}/sources`, body);
      result.sources.push({ url: source.url, source: created });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      result.sources.push({ url: source.url, error: e.message });
      errors.push({ step: `add source ${source.url}`, error: e });
    }
  }

  // Step 6: Copy policy
  if (params.copy_policy !== false) {
    try {
      const policy = await http.get<Policy>(`/v1/corpora/${sourceCorpusId}/policy`);
      const policyBody: Record<string, unknown> = {};
      if (policy.crawl) policyBody.crawl = policy.crawl;
      if (policy.search) policyBody.search = policy.search;
      if (Object.keys(policyBody).length > 0) {
        result.policy = await http.patch<Policy>(`/v1/corpora/${newCorpus.id}/policy`, policyBody);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      errors.push({ step: "copy policy", error: e });
    }
  }

  if (errors.length > 0) {
    throw new RlvnceCompositeError(
      `Clone partially failed: corpus created (${newCorpus.id}) but ${errors.length} step(s) failed`,
      result as unknown as Record<string, unknown>,
      errors,
    );
  }

  return result;
}

export async function getCorpusMetrics(
  http: HttpTransport,
  corpusId: string,
): Promise<CorpusMetrics> {
  return http.get<CorpusMetrics>(`/v1/corpora/${corpusId}/metrics`);
}
