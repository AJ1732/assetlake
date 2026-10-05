import { describe, expect, it } from "vitest";

import { createSetupPlan } from "../setup/setup-plan";
import { toSetupDocuments } from "./setup-documents";

const plan = createSetupPlan({
  applicationSlug: "shop",
  applicationName: "Shop",
  environment: "staging",
  policy: {
    slug: "uploads",
    name: "Uploads",
    allowedMimeTypes: ["image/png"],
    maxFileSizeBytes: 1000,
    requiresReview: true,
  },
  presets: [
    {
      slug: "thumb",
      name: "Thumb",
      width: 100,
      height: 100,
      fit: "crop",
      crop: "center",
      quality: 70,
      autoFormat: true,
    },
    { slug: "wide", name: "Wide", width: 1200 },
  ],
});

describe("toSetupDocuments", () => {
  it("maps a plan to the policy, preset and application documents Sanity stores", () => {
    expect(toSetupDocuments(plan)).toStrictEqual([
      {
        _id: "assetlake-policy-uploads",
        _type: "assetLakePolicy",
        name: "Uploads",
        slug: { _type: "slug", current: "uploads" },
        allowedMimeTypes: ["image/png"],
        maxFileSizeBytes: 1000,
        requiresReview: true,
      },
      {
        _id: "assetlake-preset-thumb",
        _type: "assetLakePreset",
        name: "Thumb",
        slug: { _type: "slug", current: "thumb" },
        width: 100,
        height: 100,
        fit: "crop",
        crop: "center",
        quality: 70,
        autoFormat: true,
      },
      {
        _id: "assetlake-preset-wide",
        _type: "assetLakePreset",
        name: "Wide",
        slug: { _type: "slug", current: "wide" },
        width: 1200,
      },
      {
        _id: "assetlake-application-shop",
        _type: "assetLakeApplication",
        name: "Shop",
        slug: { _type: "slug", current: "shop" },
        environment: "staging",
        defaultPolicy: { _type: "reference", _ref: "assetlake-policy-uploads" },
        presets: [
          { _key: "thumb", _type: "reference", _ref: "assetlake-preset-thumb" },
          { _key: "wide", _type: "reference", _ref: "assetlake-preset-wide" },
        ],
      },
    ]);
  });
});
