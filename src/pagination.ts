/**
 * Auto-paginate an offset-based endpoint, yielding items one at a time.
 *
 * @param fn - Function that fetches a single page given options with limit/offset.
 * @param options - Initial options (limit/offset are managed internally).
 * @param itemsKey - Key in the response that holds the items array (default "items").
 */
export async function* paginateOffset<T>(
  fn: (options: { limit?: number; offset?: number }) => Promise<Record<string, unknown>>,
  options?: { limit?: number; offset?: number },
  itemsKey = "items",
): AsyncGenerator<T> {
  const pageSize = options?.limit ?? 100;
  let offset = options?.offset ?? 0;

  while (true) {
    const page = await fn({ ...options, limit: pageSize, offset });
    const items = (page[itemsKey] ?? []) as T[];
    for (const item of items) {
      yield item;
    }
    if (items.length < pageSize) break;
    offset += items.length;
  }
}

/**
 * Auto-paginate a cursor-based endpoint, yielding items one at a time.
 *
 * @param fn - Function that fetches a single page given options with limit/cursor.
 * @param options - Initial options (cursor is managed internally).
 * @param itemsKey - Key in the response that holds the items array (default "items").
 */
export async function* paginateCursor<T>(
  fn: (options: { limit?: number; cursor?: string }) => Promise<Record<string, unknown>>,
  options?: { limit?: number; cursor?: string },
  itemsKey = "items",
): AsyncGenerator<T> {
  let cursor: string | undefined = options?.cursor;

  while (true) {
    const page = await fn({ ...options, ...(cursor ? { cursor } : {}) });
    const items = (page[itemsKey] ?? []) as T[];
    for (const item of items) {
      yield item;
    }
    const nextCursor = page.cursor as string | null | undefined;
    if (!nextCursor || items.length === 0) break;
    cursor = nextCursor;
  }
}
