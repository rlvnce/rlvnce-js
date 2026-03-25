import { describe, it, expect, vi } from "vitest";
import { RlvnceClient, RlvnceApiError } from "../index.js";

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
}

function createClient(fetchFn: ReturnType<typeof vi.fn>) {
  return new RlvnceClient({
    apiKey: "rlv_test_key",
    baseUrl: "https://api.test.com",
    fetch: fetchFn as unknown as typeof globalThis.fetch,
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
