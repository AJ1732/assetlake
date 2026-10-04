import "server-only";

import { isAssetLakeError } from "@assetlake/core";

import { toFailureResponse } from "./httpErrors";

export interface HandlerResult {
  response: Response;
  actorId: string | null;
  error?: unknown;
}

type Handler<Context extends unknown[]> = (
  request: Request,
  ...context: Context
) => Promise<HandlerResult>;

// Names and codes only: an error message may carry upstream text, including secrets.
function describeError(error: unknown) {
  if (error === undefined) return {};
  return {
    errorName: error instanceof Error ? error.name : typeof error,
    ...(isAssetLakeError(error) ? { errorCode: error.code } : {}),
  };
}

/** One structured line per request, and the last-resort catch so nothing leaks a stack. */
export function withRequestLog<Context extends unknown[]>(
  route: string,
  handler: Handler<Context>,
  // Resolved per call: binding console.log at wrap time pins whatever it was at module import.
  write: (line: string) => void = (line) => console.log(line),
) {
  return async (request: Request, ...context: Context): Promise<Response> => {
    const startedAt = performance.now();
    let result: HandlerResult;
    try {
      result = await handler(request, ...context);
    } catch (error) {
      result = { response: toFailureResponse(error), actorId: null, error };
    }

    const { status } = result.response;
    write(
      JSON.stringify({
        level: status >= 500 ? "error" : "info",
        event: "HTTP_REQUEST",
        at: new Date().toISOString(),
        route,
        method: request.method,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        actorId: result.actorId,
        ...describeError(result.error),
      }),
    );
    return result.response;
  };
}
