import { describe, expect, it } from "vitest";

import type { StoredAsset } from "../store/asset-lake-store";
import { createPngBytes, signatureBytes } from "../testing/image-fixtures";
import { basePolicy } from "../testing/scenario";
import {
  validateAfterRemoteUpload,
  validateBeforeUpload,
  validateDimensions,
} from "./validate-upload";

const png = createPngBytes(4, 4);

describe("validateBeforeUpload", () => {
  it.each([
    ["image/png", png],
    ["image/jpeg", signatureBytes("image/jpeg")],
    ["image/webp", signatureBytes("image/webp")],
  ])("accepts %s whose bytes match", async (contentType, body) => {
    await expect(
      validateBeforeUpload(basePolicy, { body, contentType }),
    ).resolves.toBeUndefined();
  });

  it.each(["image/gif", "image/svg+xml", "application/pdf"])(
    "rejects %s as unsupported",
    async (contentType) => {
      await expect(
        validateBeforeUpload(basePolicy, { body: png, contentType }),
      ).rejects.toMatchObject({
        code: "UNSUPPORTED_IMAGE_TYPE",
      });
    },
  );

  it("accepts a file of exactly the maximum size and rejects one byte more", async () => {
    const policy = { ...basePolicy, maxFileSizeBytes: png.byteLength };
    await expect(
      validateBeforeUpload(policy, { body: png, contentType: "image/png" }),
    ).resolves.toBeUndefined();
    await expect(
      validateBeforeUpload(
        { ...policy, maxFileSizeBytes: png.byteLength - 1 },
        { body: png, contentType: "image/png" },
      ),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rejects PNG bytes declared as JPEG (spoofed Content-Type)", async () => {
    await expect(
      validateBeforeUpload(basePolicy, {
        body: png,
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({
      code: "SIGNATURE_MISMATCH",
    });
  });

  it("rejects bytes with no recognisable signature", async () => {
    await expect(
      validateBeforeUpload(basePolicy, {
        body: new Uint8Array(64),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "SIGNATURE_MISMATCH" });
  });
});

describe("validateDimensions", () => {
  const asset = (width: number | null, height: number | null): StoredAsset => ({
    assetId: "image-a-1x1-png",
    url: "https://cdn.sanity.io/x.png",
    mimeType: "image/png",
    size: 1,
    width,
    height,
    lqip: null,
    blurHash: null,
  });

  it("passes when the policy sets no bounds", () => {
    expect(() => validateDimensions(basePolicy, asset(10, 10))).not.toThrow();
  });

  it.each([
    [{ minWidth: 100 }, asset(99, 500)],
    [{ minHeight: 100 }, asset(500, 99)],
    [{ maxWidth: 100 }, asset(101, 50)],
    [{ maxHeight: 100 }, asset(50, 101)],
    [{ minWidth: 1 }, asset(null, null)],
  ])("rejects %o for %o", (bounds, candidate) => {
    expect(() =>
      validateDimensions({ ...basePolicy, ...bounds }, candidate),
    ).toThrow(expect.objectContaining({ code: "DIMENSIONS_OUT_OF_RANGE" }));
  });

  it("accepts dimensions exactly on the bounds", () => {
    const policy = {
      ...basePolicy,
      minWidth: 100,
      maxWidth: 100,
      minHeight: 50,
      maxHeight: 50,
    };
    expect(() => validateDimensions(policy, asset(100, 50))).not.toThrow();
  });
});

describe("validateAfterRemoteUpload", () => {
  const remote = (overrides: Partial<StoredAsset> = {}): StoredAsset => ({
    assetId: "image-b-300x200-png",
    url: "https://cdn.sanity.io/b.png",
    mimeType: "image/png",
    size: 2048,
    width: 300,
    height: 200,
    lqip: null,
    blurHash: null,
    ...overrides,
  });

  it("passes an asset inside the policy", () => {
    expect(() => validateAfterRemoteUpload(basePolicy, remote())).not.toThrow();
  });

  it.each([
    [
      "a type the policy does not allow",
      remote({ mimeType: "image/gif" }),
      "UNSUPPORTED_IMAGE_TYPE",
    ],
    [
      "a size over the limit",
      remote({ size: basePolicy.maxFileSizeBytes + 1 }),
      "FILE_TOO_LARGE",
    ],
    [
      "dimensions outside the bounds",
      remote({ width: 50 }),
      "DIMENSIONS_OUT_OF_RANGE",
    ],
  ])("rejects %s", (_label, asset, code) => {
    expect(() =>
      validateAfterRemoteUpload({ ...basePolicy, minWidth: 100 }, asset),
    ).toThrow(expect.objectContaining({ code }));
  });
});
