import type { HttpTransport } from "../client.js";
import type { GetUsageOptions, Usage, Limits } from "../types.js";

export async function getUsage(
  http: HttpTransport,
  options?: GetUsageOptions,
): Promise<Usage> {
  const params: Record<string, string | undefined> = {};
  if (options?.period) params.period = options.period;
  return http.get<Usage>("/v1/usage", params);
}

export async function getLimits(http: HttpTransport): Promise<Limits> {
  return http.get<Limits>("/v1/limits");
}
