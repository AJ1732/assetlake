import { describe, expect, it } from "vitest";

import { MISSING } from "./format";
import { imageDetailRow, imageRow } from "./test-fixtures";
import { pickExampleImage, toImageCard, toImageDetail } from "./view-models";

describe("toImageCard", () => {
  it("maps a complete row", () => {
    const card = toImageCard(imageRow(), "UTC");
    expect(card).toMatchObject({
      id: "assetlake-image-1",
      statusLabel: "Ready",
      purposeLabel: "Avatar",
      applicationLabel: "Campus Demo",
      dimensionsLabel: "640 × 480",
      mimeLabel: "image/png",
      sizeLabel: "2 KB",
      lqip: "data:image/jpeg;base64,AAAA",
    });
    expect(card.source).toEqual({
      asset: { _ref: "image-abc123-640x480-png" },
    });
  });

  it("is null-safe for a missing asset", () => {
    const card = toImageCard(imageRow({ asset: null }));
    expect(card.source).toBeNull();
    expect(card.lqip).toBeNull();
    expect(card.dimensionsLabel).toBe(MISSING);
    expect(card.mimeLabel).toBe(MISSING);
    expect(card.sizeLabel).toBe(MISSING);
  });

  it("is null-safe for missing lqip and dimensions", () => {
    const card = toImageCard(
      imageRow({
        asset: { ...imageRow().asset!, lqip: null, width: null, height: null },
      }),
    );
    expect(card.lqip).toBeNull();
    expect(card.dimensionsLabel).toBe(MISSING);
  });

  it("labels a missing application", () => {
    expect(toImageCard(imageRow({ application: null })).applicationLabel).toBe(
      "No application",
    );
  });

  it("falls back to the application id when the name is missing", () => {
    expect(
      toImageCard(imageRow({ application: { id: "app-x", name: null } }))
        .applicationLabel,
    ).toBe("app-x");
  });

  it("labels missing status, purpose and timestamp", () => {
    const card = toImageCard(
      imageRow({ status: null, purpose: null, uploadedAt: null }),
    );
    expect(card.statusLabel).toBe(MISSING);
    expect(card.purposeLabel).toBe(MISSING);
    expect(card.uploadedLabel).toBe(MISSING);
  });
});

describe("toImageDetail", () => {
  it("maps the technical properties", () => {
    const detail = toImageDetail(imageDetailRow(), "UTC");
    expect(detail).toMatchObject({
      assetId: "image-abc123-640x480-png",
      originalUrl:
        "https://cdn.sanity.io/images/oshzwvjy/production/abc123-640x480.png",
      exactSizeLabel: "2,048 bytes",
      entityLabel: "user · user-demo-001",
      policyLabel: "Public Profile Images",
      filenameLabel: "me.png",
      altText: "Profile photo",
      tags: ["profile"],
      width: 640,
      height: 480,
    });
  });

  it("is null-safe for a missing entity, asset, policy, tags and alt", () => {
    const detail = toImageDetail(
      imageDetailRow({
        entity: null,
        asset: null,
        policyName: null,
        tags: null,
        alt: null,
        originalFilename: null,
      }),
    );
    expect(detail).toMatchObject({
      assetId: MISSING,
      originalUrl: null,
      exactSizeLabel: MISSING,
      entityLabel: MISSING,
      policyLabel: "Application default",
      filenameLabel: MISSING,
      tags: [],
      width: null,
      height: null,
    });
    expect(detail.altText).toBe("Avatar image assetlake-image-1");
  });
});

describe("pickExampleImage", () => {
  const review = imageRow({ id: "review", status: "review" });
  const ready = imageRow({ id: "ready", status: "ready" });
  const broken = imageRow({ id: "broken", status: "ready", asset: null });

  it("returns the selected image", () => {
    expect(pickExampleImage([review, ready], "review")?.id).toBe("review");
  });

  it("defaults to the first ready image", () => {
    expect(pickExampleImage([review, ready], null)?.id).toBe("ready");
  });

  it("ignores a selection that no longer exists", () => {
    expect(pickExampleImage([review, ready], "deleted")?.id).toBe("ready");
  });

  it("skips images without an asset", () => {
    expect(pickExampleImage([broken, review], "broken")?.id).toBe("review");
  });

  it("returns null when no image is usable", () => {
    expect(pickExampleImage([broken], null)).toBeNull();
    expect(pickExampleImage([], null)).toBeNull();
  });
});
