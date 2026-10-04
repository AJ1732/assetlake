import { describe, expect, it } from "vitest";

import { normalizeImage, toResultStatus } from "./normalize";

const asset = {
  assetId: "image-abc-1200x600-jpg",
  url: "https://cdn.sanity.io/images/p/d/abc-1200x600.jpg",
  mimeType: "image/jpeg",
  size: 2048,
  width: 1200,
  height: 600,
  lqip: "data:image/png;base64,AA",
  blurHash: "LEHV6n",
};

describe("normalizeImage", () => {
  it("maps asset facts and derives the aspect ratio", () => {
    expect(normalizeImage("assetlake-image-1", "ready", asset)).toEqual({
      id: "assetlake-image-1",
      assetId: asset.assetId,
      url: asset.url,
      mimeType: "image/jpeg",
      size: 2048,
      width: 1200,
      height: 600,
      aspectRatio: 2,
      lqip: asset.lqip,
      blurHash: asset.blurHash,
      status: "ready",
    });
  });

  it("returns null, not undefined, for metadata Sanity has not produced yet", () => {
    const result = normalizeImage("assetlake-image-1", "ready", {
      ...asset,
      width: null,
      height: null,
      lqip: null,
      blurHash: null,
    });
    expect(result).toMatchObject({
      width: null,
      height: null,
      aspectRatio: null,
      lqip: null,
      blurHash: null,
    });
  });

  it("exposes exactly the contract fields", () => {
    expect(Object.keys(normalizeImage("x", "ready", asset)).sort()).toEqual([
      "aspectRatio",
      "assetId",
      "blurHash",
      "height",
      "id",
      "lqip",
      "mimeType",
      "size",
      "status",
      "url",
      "width",
    ]);
  });

  it.each([
    ["review", "review"],
    ["ready", "ready"],
    ["processing", "review"],
    ["rejected", "review"],
    ["failed", "review"],
  ])("maps record status %s to result status %s", (status, expected) => {
    expect(toResultStatus(status)).toBe(expected);
  });
});
