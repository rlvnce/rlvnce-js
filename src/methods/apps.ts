import type { HttpTransport } from "../client.js";
import type { ListAppsOptions, App } from "../types.js";

export async function listApps(
  http: HttpTransport,
  options?: ListAppsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.type) params.type = options.type;
  if (options?.search) params.search = options.search;
  if (options?.limit !== undefined) params.limit = String(options.limit);
  if (options?.offset !== undefined) params.offset = String(options.offset);
  return http.get<Record<string, unknown>>("/v1/apps", params);
}

export async function getApp(
  http: HttpTransport,
  appId: string,
): Promise<App> {
  return http.get<App>(`/v1/apps/${appId}`);
}
