/** Bad input from the person at the terminal: printed with a usage hint, exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

/** @sanity/client errors carry the HTTP status as statusCode. */
export function statusCodeOf(error: unknown): unknown {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? error.statusCode
    : undefined;
}

export function describeError(error: unknown): string {
  const statusCode = statusCodeOf(error);
  const message = error instanceof Error ? error.message : String(error);
  return statusCode === undefined ? message : `HTTP ${statusCode}: ${message}`;
}
