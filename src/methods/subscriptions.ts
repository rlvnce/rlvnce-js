import type { HttpTransport } from "../client.js";
import type {
  CreateSubscriptionParams,
  Subscription,
  ListSubscriptionsOptions,
} from "../types.js";

export async function createSubscription(
  http: HttpTransport,
  corpusId: string,
  params: CreateSubscriptionParams,
): Promise<Subscription> {
  return http.post<Subscription>(`/v1/corpora/${corpusId}/subscriptions`, params);
}

export async function listSubscriptions(
  http: HttpTransport,
  corpusId: string,
  options?: ListSubscriptionsOptions,
): Promise<Record<string, unknown>> {
  const params: Record<string, string | undefined> = {};
  if (options?.status) params.status = options.status;
  return http.get<Record<string, unknown>>(`/v1/corpora/${corpusId}/subscriptions`, params);
}
