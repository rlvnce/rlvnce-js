import { describe, it, expect, vi } from "vitest";
import { RlvnceClient, RlvnceApiError } from "../index.js";
import type { RequestInfo, ResponseInfo } from "../index.js";

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

function createClient(fetchFn: ReturnType<typeof vi.fn>, extra?: Partial<ConstructorParameters<typeof RlvnceClient>[0]>) {
  return new RlvnceClient({
    apiKey: "rlv_test_key",
    baseUrl: "https://api.test.com",
    fetch: fetchFn as unknown as typeof globalThis.fetch,
    ...extra,
  });
}

describe("HttpTransport", () => {
  it("sends correct auth headers", async () => {
    const fetch = mockFetch({ items: [] });
    const client = createClient(fetch);
    await client.listCorpora();

    const [url, init] = fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer rlv_test_key");
    expect(init.headers.apikey).toBe("rlv_test_key");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("builds URL with base path preserved", async () => {
    const fetch = mockFetch({ items: [] });
    const client = new RlvnceClient({
      apiKey: "rlv_test",
      baseUrl: "https://api.test.com/api",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await client.getLimits();

    const [url] = fetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/api/v1/limits");
  });

  it("appends query params", async () => {
    const fetch = mockFetch({ items: [] });
    const client = createClient(fetch);
    await client.listCorpora({ limit: 10, offset: 5, status: "active" });

    const [url] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("limit")).toBe("10");
    expect(parsed.searchParams.get("offset")).toBe("5");
    expect(parsed.searchParams.get("status")).toBe("active");
  });

  it("throws RlvnceApiError on non-2xx", async () => {
    const fetch = mockFetch({ code: "NOT_FOUND", message: "Corpus not found", retryable: false }, 404);
    const client = createClient(fetch);

    await expect(client.getLimits()).rejects.toThrow(RlvnceApiError);
    try {
      await client.getLimits();
    } catch (e) {
      const err = e as RlvnceApiError;
      expect(err.status).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
      expect(err.message).toBe("Corpus not found");
      expect(err.retryable).toBe(false);
    }
  });

  it("handles 204 No Content", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(undefined),
      text: () => Promise.resolve(""),
    });
    const client = createClient(fetch);
    await client.removeSource("corpus-id", "source-id");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sends POST body as JSON", async () => {
    const fetch = mockFetch({ results: [], total: 0 });
    const client = createClient(fetch);
    await client.search("corpus-id", "test query", { limit: 5 });

    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.query).toBe("test query");
    expect(body.limit).toBe(5);
  });

  it("strips trailing slashes from baseUrl", async () => {
    const fetch = mockFetch({});
    const client = new RlvnceClient({
      apiKey: "rlv_test",
      baseUrl: "https://api.test.com///",
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    await client.getLimits();
    const [url] = fetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/limits");
  });
});

describe("Retries", () => {
  it("retries on 500 and succeeds", async () => {
    let callCount = 0;
    const fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve(JSON.stringify({ code: "INTERNAL", message: "oops", retryable: true })),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tier: "pro" }),
        text: () => Promise.resolve(""),
      });
    });

    const client = createClient(fetch, { maxRetries: 2, retryDelay: 10 });
    const result = await client.getLimits();

    expect(result.tier).toBe("pro");
    expect(callCount).toBe(2);
  });

  it("retries on 429 (rate limit)", async () => {
    let callCount = 0;
    const fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve(JSON.stringify({ code: "RATE_LIMITED", message: "slow down" })),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tier: "pro" }),
        text: () => Promise.resolve(""),
      });
    });

    const client = createClient(fetch, { maxRetries: 2, retryDelay: 10 });
    const result = await client.getLimits();

    expect(result.tier).toBe("pro");
    expect(callCount).toBe(3);
  });

  it("does not retry on 404", async () => {
    const fetch = mockFetch({ code: "NOT_FOUND", message: "gone", retryable: false }, 404);
    const client = createClient(fetch, { maxRetries: 2, retryDelay: 10 });

    await expect(client.getLimits()).rejects.toThrow(RlvnceApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting retries", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(JSON.stringify({ code: "UNAVAILABLE", message: "down" })),
    });

    const client = createClient(fetch, { maxRetries: 1, retryDelay: 10 });

    await expect(client.getLimits()).rejects.toThrow(RlvnceApiError);
    expect(fetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });

  it("disables retries with maxRetries: 0", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve(JSON.stringify({ code: "INTERNAL", message: "oops" })),
    });

    const client = createClient(fetch, { maxRetries: 0 });

    await expect(client.getLimits()).rejects.toThrow(RlvnceApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Hooks", () => {
  it("calls onRequest and onResponse", async () => {
    const fetch = mockFetch({ tier: "pro" });
    const requests: RequestInfo[] = [];
    const responses: ResponseInfo[] = [];

    const client = createClient(fetch, {
      onRequest: (info) => requests.push(info),
      onResponse: (info) => responses.push(info),
    });

    await client.getLimits();

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
    expect(requests[0].url).toContain("/v1/limits");
    expect(requests[0].attempt).toBe(0);

    expect(responses).toHaveLength(1);
    expect(responses[0].status).toBe(200);
    expect(responses[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(responses[0].retryable).toBe(false);
  });

  it("calls hooks on each retry attempt", async () => {
    let callCount = 0;
    const fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 502,
          text: () => Promise.resolve(JSON.stringify({ code: "BAD_GATEWAY", message: "retry" })),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      });
    });

    const requests: RequestInfo[] = [];
    const responses: ResponseInfo[] = [];
    const client = createClient(fetch, {
      maxRetries: 1,
      retryDelay: 10,
      onRequest: (info) => requests.push(info),
      onResponse: (info) => responses.push(info),
    });

    await client.getLimits();

    expect(requests).toHaveLength(2);
    expect(requests[0].attempt).toBe(0);
    expect(requests[1].attempt).toBe(1);

    expect(responses).toHaveLength(2);
    expect(responses[0].status).toBe(502);
    expect(responses[0].retryable).toBe(true);
    expect(responses[1].status).toBe(200);
  });
});

describe("trace_id", () => {
  it("captures trace_id from error response", async () => {
    const fetch = mockFetch(
      { code: "NOT_FOUND", message: "gone", trace_id: "abc-123", retryable: false },
      404,
    );
    const client = createClient(fetch);

    try {
      await client.getLimits();
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as RlvnceApiError;
      expect(err.traceId).toBe("abc-123");
    }
  });
});

describe("AbortSignal", () => {
  it("aborts request when signal fires", async () => {
    const fetch = vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });

    const controller = new AbortController();
    const client = createClient(fetch, { maxRetries: 0 });

    const promise = client.search("c1", "test", { signal: controller.signal });
    // Abort after a tick to ensure the request has started
    setTimeout(() => controller.abort(), 5);

    await expect(promise).rejects.toThrow();
  });
});
