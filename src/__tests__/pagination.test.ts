import { describe, it, expect } from "vitest";
import { paginateOffset, paginateCursor } from "../pagination.js";

describe("paginateOffset", () => {
  it("iterates through multiple pages", async () => {
    let callCount = 0;
    const fn = async (opts: { limit?: number; offset?: number }) => {
      callCount++;
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? 100;
      if (offset === 0) return { items: [{ id: 1 }, { id: 2 }], total: 5 };
      if (offset === 2) return { items: [{ id: 3 }, { id: 4 }], total: 5 };
      return { items: [{ id: 5 }], total: 5 };
    };

    const items: Array<{ id: number }> = [];
    for await (const item of paginateOffset<{ id: number }>(fn, { limit: 2 })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
    expect(callCount).toBe(3);
  });

  it("stops on empty page", async () => {
    const fn = async () => ({ items: [] });
    const items: unknown[] = [];
    for await (const item of paginateOffset(fn)) {
      items.push(item);
    }
    expect(items).toEqual([]);
  });

  it("uses custom items key", async () => {
    const fn = async () => ({ corpora: [{ id: "a" }] });
    const items: unknown[] = [];
    for await (const item of paginateOffset(fn, undefined, "corpora")) {
      items.push(item);
    }
    expect(items).toEqual([{ id: "a" }]);
  });
});

describe("paginateCursor", () => {
  it("follows cursor through pages", async () => {
    let callCount = 0;
    const fn = async (opts: { limit?: number; cursor?: string }) => {
      callCount++;
      if (!opts.cursor) return { items: [{ id: 1 }], cursor: "page2" };
      if (opts.cursor === "page2") return { items: [{ id: 2 }], cursor: "page3" };
      return { items: [{ id: 3 }], cursor: null };
    };

    const items: Array<{ id: number }> = [];
    for await (const item of paginateCursor<{ id: number }>(fn)) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(callCount).toBe(3);
  });

  it("stops when cursor is null", async () => {
    const fn = async () => ({ items: [{ id: 1 }], cursor: null });
    const items: unknown[] = [];
    for await (const item of paginateCursor(fn)) {
      items.push(item);
    }
    expect(items).toEqual([{ id: 1 }]);
  });

  it("stops on empty items", async () => {
    const fn = async () => ({ items: [], cursor: "next" });
    const items: unknown[] = [];
    for await (const item of paginateCursor(fn)) {
      items.push(item);
    }
    expect(items).toEqual([]);
  });
});
