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
  INVALID_STATUS_TRANSITION: 409,
  SOURCE_FETCH_FAILED: 502,
  APPLICATION_NOT_FOUND: 500,
  POLICY_NOT_FOUND: 500,
  PRESET_INVALID: 500,
  UPLOAD_FAILED: 500,
  METADATA_CREATE_FAILED: 500,
};

const GENERIC = "Something went wrong. Please try again.";

export interface ErrorResponse {
  status: number;
  body: { error: { code: string; message: string } };
}

// Client errors keep core's message (written for end users); server faults never echo upstream
// text, which can carry internals.
export function toErrorResponse(error: unknown): ErrorResponse {
  if (isAssetLakeError(error)) {
    const status = STATUS[error.code];
    const message = status < 500 ? error.message : GENERIC;
    return { status, body: { error: { code: error.code, message } } };
  }
  const bodyParserStatus = (error as { status?: unknown } | null)?.status;
  if (typeof bodyParserStatus === "number" && bodyParserStatus < 500) {
    return {
      status: bodyParserStatus,
      body: { error: { code: "BAD_REQUEST", message: "Request rejected." } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: GENERIC } },
  };
}
