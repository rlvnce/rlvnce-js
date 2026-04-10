import { describe, it, expect, vi } from "vitest";
import { RlvnceClient } from "../../index.js";

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
    apiKey: "rlv_test",
    baseUrl: "https://api.test.com",
    fetch: fetchFn as unknown as typeof globalThis.fetch,
  });
}

describe("search", () => {
  it("sends POST with query and options", async () => {
    const fetch = mockFetch({ results: [{ url: "https://example.com", score: 1.5 }], total: 1 });
    const client = createClient(fetch);
    const result = await client.search("corpus-1", "test query", {
      limit: 5,
      filters: { url_prefix: "https://docs." },
    });

    expect(result.results).toHaveLength(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("/v1/corpora/corpus-1/search");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.query).toBe("test query");
    expect(body.limit).toBe(5);
    expect(body.filters.url_prefix).toBe("https://docs.");
  });
});

describe("viewCache", () => {
  it("fetches cached page by document ID", async () => {
    const fetch = mockFetch({ url: "https://example.com", title: "Test", body: "content" });
    const client = createClient(fetch);
    const doc = await client.viewCache("corpus-1", "doc-1");

    expect(doc.url).toBe("https://example.com");
    expect(doc.title).toBe("Test");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("/v1/corpora/corpus-1/cache/doc-1");
    expect(init.method).toBe("GET");
  });

  it("getDocument still works as deprecated alias", async () => {
    const fetch = mockFetch({ url: "https://example.com", title: "Test", body: "content" });
    const client = createClient(fetch);
    const doc = await client.getDocument("corpus-1", "doc-1");

    expect(doc.url).toBe("https://example.com");
    const [url] = fetch.mock.calls[0];
    expect(url).toContain("/v1/corpora/corpus-1/cache/doc-1");
  });
});

describe("listDocuments", () => {
  it("passes filter params as query string", async () => {
    const fetch = mockFetch({ items: [], cursor: null });
    const client = createClient(fetch);
    await client.listDocuments("corpus-1", {
      source_id: "s1",
      content_type: "text/html",
      limit: 10,
    });

    const [url] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("source_id")).toBe("s1");
    expect(parsed.searchParams.get("content_type")).toBe("text/html");
    expect(parsed.searchParams.get("limit")).toBe("10");
  });
});

describe("sampleDocuments", () => {
  it("passes n as query param", async () => {
    const fetch = mockFetch({ documents: [{ url: "https://example.com" }] });
    const client = createClient(fetch);
    await client.sampleDocuments("corpus-1", { n: 3 });

    const [url] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("n")).toBe("3");
  });
});

describe("listChanges", () => {
  it("passes since and types as query params", async () => {
    const fetch = mockFetch({ items: [], cursor: null });
    const client = createClient(fetch);
    await client.listChanges("corpus-1", {
      since: "2026-01-01T00:00:00Z",
      types: "created,updated",
    });

    const [url] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("since")).toBe("2026-01-01T00:00:00Z");
    expect(parsed.searchParams.get("types")).toBe("created,updated");
  });
});
