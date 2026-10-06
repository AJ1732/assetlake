import { AssetLakeError, type AssetLakeErrorCode } from "@assetlake/core";
import { describe, expect, it } from "vitest";

import {
  GENERIC_SERVER_MESSAGE,
  HTTP_STATUS,
  toFailureResponse,
} from "@/lib/server/http-errors";

// The B03 spec status table, plus PRESET_INVALID, the URL-upload codes and the review code
// (added to core later).
const SPEC_STATUS: Record<string, number> = {
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
  SOURCE_URL_NOT_ALLOWED: 400,
  SOURCE_FETCH_FAILED: 502,
  INVALID_STATUS_TRANSITION: 409,
};

describe("HTTP status map", () => {
  it("matches the spec table exactly", () => {
    expect(HTTP_STATUS).toEqual(SPEC_STATUS);
  });

  it.each(Object.entries(SPEC_STATUS).filter(([, status]) => status < 500))(
    "%s keeps core's client-safe message",
    async (code, status) => {
      const response = toFailureResponse(
        new AssetLakeError(code as AssetLakeErrorCode, `core says ${code}`),
      );
      expect(response.status).toBe(status);
      expect((await response.json()).error).toEqual({
        code,
        message: `core says ${code}`,
      });
    },
  );

  it.each(Object.entries(SPEC_STATUS).filter(([, status]) => status >= 500))(
    "%s replaces core's message with a generic one",
    async (code, status) => {
      const response = toFailureResponse(
        new AssetLakeError(code as AssetLakeErrorCode, "dataset internals"),
      );
      expect(response.status).toBe(status);
      expect((await response.json()).error).toEqual({
        code,
        message: GENERIC_SERVER_MESSAGE,
      });
    },
  );

  it.each([new TypeError("boom"), "a string", null, { statusCode: 409 }])(
    "maps a non-AssetLake throw (%j) to 500 UPLOAD_FAILED",
    async (thrown) => {
      const response = toFailureResponse(thrown);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: { code: "UPLOAD_FAILED", message: GENERIC_SERVER_MESSAGE },
      });
    },
  );
});
