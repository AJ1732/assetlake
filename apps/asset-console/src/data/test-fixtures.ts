import type { ImageDetailRow, ImageRow, PresetRow } from "./types";

// Test-only builders. Not imported by app code, so they never reach the bundle.

export function imageRow(overrides: Partial<ImageRow> = {}): ImageRow {
  return {
    id: "assetlake-image-1",
    status: "ready",
    purpose: "avatar",
    uploadedAt: "2026-10-04T12:00:00.000Z",
    application: {
      id: "assetlake-application-campus-demo",
      name: "Campus Demo",
    },
    entity: { type: "user", id: "user-demo-001" },
    source: { asset: { _ref: "image-abc123-640x480-png" } },
    asset: {
      assetId: "image-abc123-640x480-png",
      url: "https://cdn.sanity.io/images/oshzwvjy/production/abc123-640x480.png",
      mimeType: "image/png",
      size: 2048,
      width: 640,
      height: 480,
      lqip: "data:image/jpeg;base64,AAAA",
    },
    ...overrides,
  };
}

export function imageDetailRow(
  overrides: Partial<ImageDetailRow> = {},
): ImageDetailRow {
  return {
    ...imageRow(),
    alt: "Profile photo",
    tags: ["profile"],
    policyName: "Public Profile Images",
    originalFilename: "me.png",
    ...overrides,
  };
}

export function presetRow(overrides: Partial<PresetRow> = {}): PresetRow {
  return {
    id: "assetlake-preset-avatar",
    slug: "avatar",
    name: "Avatar",
    width: 256,
    height: 256,
    fit: "crop",
    crop: null,
    quality: 82,
    autoFormat: true,
    ...overrides,
  };
}
