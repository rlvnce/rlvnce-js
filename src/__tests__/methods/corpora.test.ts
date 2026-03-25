import { describe, it, expect, vi } from "vitest";
import { RlvnceClient, RlvnceCompositeError } from "../../index.js";

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

describe("createCorpus", () => {
  it("orchestrates corpus + sources + policy", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "Test" } },                     // POST /v1/corpora
      { body: { id: "s1", url: "https://example.com" } },       // POST sources
      { body: { crawl: { schedule: "daily" } } },               // PATCH policy
    ]);
    const client = createClient(fetch);

    const result = await client.createCorpus({
      name: "Test",
      sources: [{ url: "https://example.com" }],
      crawl_policy: { schedule: "daily" },
    });

    expect(result.corpus.id).toBe("c1");
    expect(result.sources).toHaveLength(1);
    expect(result.sources![0].url).toBe("https://example.com");
    expect(result.policy).toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("throws RlvnceCompositeError on partial failure", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "Test" } },                     // POST /v1/corpora
      { body: { code: "INVALID", message: "bad url" }, status: 400 }, // POST sources fails
    ]);
    const client = createClient(fetch);

    try {
      await client.createCorpus({
        name: "Test",
        sources: [{ url: "bad-url" }],
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RlvnceCompositeError);
      const err = e as RlvnceCompositeError;
      expect(err.partialResult).toHaveProperty("corpus");
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0].step).toContain("add source");
    }
  });
});

describe("getCorpus", () => {
  it("fetches corpus, policy, and sources in parallel", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "Test" } },
      { body: { crawl: {}, search: {} } },
      { body: { sources: [{ id: "s1", url: "https://example.com" }] } },
    ]);
    const client = createClient(fetch);
    const result = await client.getCorpus("c1");

    expect(result.id).toBe("c1");
    expect(result.policy).toBeDefined();
    expect(result.sources).toBeDefined();
  });
});

describe("deleteCorpus", () => {
  it("verifies name before deleting", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "My Corpus" } },   // GET verify
      { body: undefined, status: 204 },              // DELETE
    ]);
    const client = createClient(fetch);
    const result = await client.deleteCorpus("c1", "My Corpus");

    expect(result.deleted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on name mismatch", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "Actual Name" } },
    ]);
    const client = createClient(fetch);

    await expect(
      client.deleteCorpus("c1", "Wrong Name"),
    ).rejects.toThrow("Corpus name mismatch");
  });
});

describe("updateCorpus", () => {
  it("updates metadata and policy", async () => {
    const fetch = mockFetchSequence([
      { body: { id: "c1", name: "New Name" } },               // PATCH metadata
      { body: { crawl: { schedule: "manual" }, search: {} } }, // GET policy
      { body: { crawl: { schedule: "daily" }, search: {} } },  // PATCH policy
    ]);
    const client = createClient(fetch);
    const result = await client.updateCorpus("c1", {
      name: "New Name",
      crawl_policy: { schedule: "daily" },
    });

    expect(result.corpus?.name).toBe("New Name");
    expect(result.policy).toBeDefined();
  });

  it("throws if no fields provided", async () => {
    const fetch = mockFetchSequence([]);
    const client = createClient(fetch);
    await expect(client.updateCorpus("c1", {})).rejects.toThrow("No fields provided");
  });
});
