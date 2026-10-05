import "server-only";

import { type AssetLakeErrorCode, isAssetLakeError } from "@assetlake/core";

// A Record, not a switch: a new core error code fails typecheck until it gets a status.
const STATUS: Record<AssetLakeErrorCode, number> = {
  UNSUPPORTED_IMAGE_TYPE: 400,
  SIGNATURE_MISMATCH: 400,
  DIMENSIONS_OUT_OF_RANGE: 400,
  SOURCE_URL_NOT_ALLOWED: 400,
  FORBIDDEN: 403,
  IMAGE_NOT_FOUND: 404,
  PRESET_NOT_FOUND: 404,
  FILE_TOO_LARGE: 413,
  SOURCE_FETCH_FAILED: 502,
  APPLICATION_NOT_FOUND: 500,
  POLICY_NOT_FOUND: 500,
  PRESET_INVALID: 500,
  UPLOAD_FAILED: 500,
  METADATA_CREATE_FAILED: 500,
};

const GENERIC = "Something went wrong. Please try again.";

export const errorResponse = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

export const unauthenticated = () =>
  errorResponse(401, "UNAUTHENTICATED", "Sign in first.");

// Client errors keep core's message (written for end users); server faults never echo upstream
// text, which can carry internals.
export function toErrorResponse(error: unknown): Response {
  if (!isAssetLakeError(error)) return errorResponse(500, "INTERNAL", GENERIC);
  const status = STATUS[error.code];
  return errorResponse(
    status,
    error.code,
    status < 500 ? error.message : GENERIC,
  );
}
