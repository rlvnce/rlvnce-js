/** Error thrown when the RLVNCE API returns a non-2xx response. */
export class RlvnceApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: unknown;
  /** Server-side trace ID for debugging (if returned by the API). */
  readonly traceId: string | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable: boolean,
    details?: unknown,
    traceId?: string,
  ) {
    super(message);
    this.name = "RlvnceApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    this.traceId = traceId;
  }
}

/** Error thrown when a composite operation partially succeeds. */
export class RlvnceCompositeError extends Error {
  /** Results from steps that completed before the failure. */
  readonly partialResult: Record<string, unknown>;
  /** Errors from individual steps that failed. */
  readonly errors: Array<{ step: string; error: Error }>;

  constructor(
    message: string,
    partialResult: Record<string, unknown>,
    errors: Array<{ step: string; error: Error }>,
  ) {
    super(message);
    this.name = "RlvnceCompositeError";
    this.partialResult = partialResult;
    this.errors = errors;
  }
}
