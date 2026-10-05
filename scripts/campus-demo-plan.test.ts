import { toSetupDocuments } from "@assetlake/core";
import { describe, expect, it } from "vitest";

import { campusDemoPlan } from "./campus-demo-plan";

const slug = (current: string) => ({ _type: "slug", current });
const reference = (id: string) => ({ _type: "reference", _ref: id });

// Literal copy of what sanity-schema's seedDocuments() produced before B10 moved setup into core.
// The live demo and the `test` dataset hold exactly these documents.
const SEEDED_BEFORE_B10 = [
  {
    _id: "assetlake-policy-public-profile-images",
    _type: "assetLakePolicy",
    name: "Public Profile Images",
    slug: slug("public-profile-images"),
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5_242_880,
    requiresReview: false,
  },
  {
    _id: "assetlake-preset-avatar-sm",
    _type: "assetLakePreset",
    slug: slug("avatar-sm"),
    autoFormat: true,
    name: "Avatar small",
    width: 96,
    height: 96,
    fit: "crop",
    quality: 80,
  },
  {
    _id: "assetlake-preset-avatar",
    _type: "assetLakePreset",
    slug: slug("avatar"),
    autoFormat: true,
    name: "Avatar",
    width: 256,
    height: 256,
    fit: "crop",
    quality: 82,
  },
  {
    _id: "assetlake-preset-card",
    _type: "assetLakePreset",
    slug: slug("card"),
    autoFormat: true,
    name: "Card",
    width: 640,
    height: 360,
    fit: "crop",
    quality: 80,
  },
  {
    _id: "assetlake-preset-hero",
    _type: "assetLakePreset",
    slug: slug("hero"),
    autoFormat: true,
    name: "Hero",
    width: 1600,
    height: 900,
    fit: "max",
    quality: 82,
  },
  {
    _id: "assetlake-application-campus-demo",
    _type: "assetLakeApplication",
    name: "Campus Demo",
    slug: slug("campus-demo"),
    environment: "demo",
    defaultPolicy: reference("assetlake-policy-public-profile-images"),
    presets: [
      { _key: "avatar-sm", ...reference("assetlake-preset-avatar-sm") },
      { _key: "avatar", ...reference("assetlake-preset-avatar") },
      { _key: "card", ...reference("assetlake-preset-card") },
      { _key: "hero", ...reference("assetlake-preset-hero") },
    ],
  },
];

describe("campusDemoPlan", () => {
  it("produces exactly the six documents the demo was seeded with", () => {
    expect(toSetupDocuments(campusDemoPlan)).toStrictEqual(SEEDED_BEFORE_B10);
  });
});
