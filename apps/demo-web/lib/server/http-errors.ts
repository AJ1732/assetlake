import "server-only";

import { isAssetLakeError } from "@assetlake/core";
import type { ApiErrorCode, ApiFailure } from "@assetlake/core/contracts";

// Record (not a switch) so a new ApiErrorCode fails typecheck until it gets a status.
export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  BAD_REQUEST: 400,
  UNSUPPORTED_IMAGE_TYPE: 400,
  SIGNATURE_MISMATCH: 400,
  DIMENSIONS_OUT_OF_RANGE: 400,
  FORBIDDEN: 403,
  IMAGE_NOT_FOUND: 404,
  FILE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  APPLICATION_NOT_FOUND: 500,
  POLICY_NOT_FOUND: 500,
  PRESET_NOT_FOUND: 500,
  PRESET_INVALID: 500,
  UPLOAD_FAILED: 500,
  METADATA_CREATE_FAILED: 500,
};

export const GENERIC_SERVER_MESSAGE = "Something went wrong. Please try again.";

// The frozen contract has no generic server code; UPLOAD_FAILED is the agreed fallback (B03 plan).
const UNEXPECTED_ERROR_CODE: ApiErrorCode = "UPLOAD_FAILED";

export function failure(code: ApiErrorCode, message: string): Response {
  const body: ApiFailure = { success: false, error: { code, message } };
  return Response.json(body, { status: HTTP_STATUS[code] });
}

/** Client errors keep core's message; server faults never echo internals (handoff §22). */
export function toFailureResponse(error: unknown): Response {
  if (!isAssetLakeError(error))
    return failure(UNEXPECTED_ERROR_CODE, GENERIC_SERVER_MESSAGE);
  const isServerFault = HTTP_STATUS[error.code] >= 500;
  return failure(
    error.code,
    isServerFault ? GENERIC_SERVER_MESSAGE : error.message,
  );
}
