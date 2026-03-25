import type { HttpTransport } from "../client.js";
import type { GetUsageOptions, Usage, Limits, RequestOptions } from "../types.js";

export async function getUsage(
  http: HttpTransport,
  options?: GetUsageOptions,
): Promise<Usage> {
  const params: Record<string, string | undefined> = {};
  if (options?.period) params.period = options.period;
  return http.get<Usage>("/v1/usage", params, options);
}

export async function getLimits(http: HttpTransport, options?: RequestOptions): Promise<Limits> {
  return http.get<Limits>("/v1/limits", undefined, options);
}
