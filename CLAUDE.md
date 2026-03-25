# clients/rlvnce-js — @rlvnce/client

See `README.md` for API surface, installation, usage examples, and development commands.

## Architecture

Thin stateless TypeScript client wrapping the RLVNCE public REST API.

```
User code → RlvnceClient → methods/*.ts → HttpTransport → RLVNCE API
```

- **`src/client.ts`** — `RlvnceClient` class (public API) + `HttpTransport` (internal HTTP layer)
- **`src/error.ts`** — `RlvnceApiError` (API errors) + `RlvnceCompositeError` (partial failures)
- **`src/types.ts`** — All request/response TypeScript interfaces
- **`src/pagination.ts`** — `paginateOffset` / `paginateCursor` async generators
- **`src/methods/*.ts`** — One file per domain, exports functions taking `(http, ...args)`

## Key Patterns

### Adding a new method

1. Add request/response types to `src/types.ts`
2. Add implementation function to the appropriate `src/methods/<domain>.ts`
3. Add public method to `RlvnceClient` class in `src/client.ts`
4. If paginated, add a `listAll*` variant using `paginateOffset` or `paginateCursor`
5. Add tests in `src/__tests__/methods/<domain>.test.ts`

### Error handling

- Simple methods: throw `RlvnceApiError` on non-2xx responses (handled by `HttpTransport`)
- Composite methods (`createCorpus`, `updateCorpus`, `cloneCorpus`): throw `RlvnceCompositeError` with `partialResult` and `errors[]` if early steps succeed but later steps fail

### Build

- ESM + CJS dual output via tsup
- Zero runtime dependencies — Node 18+ built-in `fetch`
- Types: plain TypeScript interfaces (no Zod at runtime)

### ESM

This package uses `"type": "module"`. All local imports must include `.js` extension.
