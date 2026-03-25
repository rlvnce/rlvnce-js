import type { HttpTransport } from "../client.js";
import type { SearchPolicy, Policy } from "../types.js";

export async function updateSearchPolicy(
  http: HttpTransport,
  corpusId: string,
  policy: SearchPolicy,
): Promise<Policy> {
  const hasFields = Object.values(policy).some((v) => v !== undefined);
  if (!hasFields) {
    throw new Error(
      "No search policy fields provided. Specify at least one of: title_weight, headings_weight, body_weight, url_weight, meta_description_weight, recency_boost, recency_decay_rate, domain_boosts, path_boosts.",
    );
  }

  const current = await http.get<Policy>(`/v1/corpora/${corpusId}/policy`);
  const currentSearch = (current.search ?? {}) as Record<string, unknown>;
  return http.patch<Policy>(`/v1/corpora/${corpusId}/policy`, {
    search: { ...currentSearch, ...policy },
  });
}
