import { describe, it, expect, vi } from "vitest";
import { RlvnceClient } from "../../index.js";

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: (resp.status ?? 200) >= 200 && (resp.status ?? 200) < 300,
      status: resp.status ?? 200,
      json: () => Promise.resolve(resp.body),
      text: () => Promise.resolve(JSON.stringify(resp.body)),
    });
  });
}

function createClient(fetchFn: ReturnType<typeof vi.fn>) {
  return new RlvnceClient({
    apiKey: "rlv_test",
    baseUrl: "https://api.test.com",
    fetch: fetchFn as unknown as typeof globalThis.fetch,
  });
}

describe("triggerCrawl", () => {
  it("sends POST to crawls endpoint", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "job-1", status: "running" } },
    ]);
    const client = createClient(fetch);
    const result = await client.triggerCrawl("corpus-1", { force: true });

    expect(result.id).toBe("job-1");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain("/v1/corpora/corpus-1/crawls");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.force).toBe(true);
  });

  it("resolves source_url to source_id", async () => {
    const fetch = mockFetchSequence([
      { body: { sources: [{ id: "s1", url: "https://example.com" }] } }, // GET sources
      { body: { id: "job-1", status: "running" } },                       // POST crawl
    ]);
    const client = createClient(fetch);
    const result = await client.triggerCrawl("corpus-1", {
      source_url: "https://example.com",
    });

    expect(result.id).toBe("job-1");
    // Second call should include source_id in body
    const [, init] = fetch.mock.calls[1];
    const body = JSON.parse(init.body);
    expect(body.source_id).toBe("s1");
  });

  it("throws if source_url not found", async () => {
    const fetch = mockFetchSequence([
      { body: { sources: [] } },
    ]);
    const client = createClient(fetch);
    await expect(
      client.triggerCrawl("corpus-1", { source_url: "https://notfound.com" }),
    ).rejects.toThrow("No source found");
  });
});

describe("getCrawlStatus", () => {
  it("fetches crawl job by ID", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "job-1", status: "completed", pages_crawled: 42 } },
    ]);
    const client = createClient(fetch);
    const result = await client.getCrawlStatus("corpus-1", "job-1");

    expect(result.status).toBe("completed");
    expect(result.pages_crawled).toBe(42);
  });
});

describe("listCrawls", () => {
  it("passes pagination params", async () => {
    const fetch = mockFetchSequence([
      { body: { items: [], total: 0 } },
    ]);
    const client = createClient(fetch);
    await client.listCrawls("corpus-1", { limit: 5, offset: 10 });

    const [url] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("limit")).toBe("5");
    expect(parsed.searchParams.get("offset")).toBe("10");
  });
});
