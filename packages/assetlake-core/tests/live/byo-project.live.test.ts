import {
  DEFAULT_API_VERSION,
  SANITY_PROJECT_ID,
} from "@assetlake/sanity-schema/project";
import { createClient } from "@sanity/client";
import { afterAll, describe, expect, it } from "vitest";

import { createAssetLake } from "../../src/create-asset-lake";
import { createPngBytes } from "../../src/testing/image-fixtures";

// Eval lane: proves the root README's "Use AssetLake with your own Sanity project" steps. It sets up
// a fresh policy, preset and application exactly as the README does (not the seeded campus demo),
// then uploads through it. Keep these document shapes in sync with that README section.
const dataset = process.env.SANITY_TEST_DATASET ?? "test";
const token = process.env.SANITY_WRITE_TOKEN ?? "";
const run = Date.now().toString(36);

const ids = {
  policy: `byo-policy-${run}`,
  preset: `byo-preset-${run}`,
  application: `byo-application-${run}`,
};
const presetSlug = `byo-thumb-${run}`;

const setupDocuments = [
  {
    _id: ids.policy,
    _type: "assetLakePolicy",
    name: "Public images",
    slug: { _type: "slug", current: `byo-public-images-${run}` },
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5 * 1024 * 1024,
    requiresReview: false,
  },
  {
    _id: ids.preset,
    _type: "assetLakePreset",
    name: "Thumbnail",
    slug: { _type: "slug", current: presetSlug },
    width: 200,
    height: 200,
    fit: "crop",
    quality: 80,
    autoFormat: true,
  },
  {
    _id: ids.application,
    _type: "assetLakeApplication",
    name: "My app",
    slug: { _type: "slug", current: `byo-my-app-${run}` },
    environment: "production",
    defaultPolicy: { _type: "reference", _ref: ids.policy },
    presets: [{ _key: "thumb", _type: "reference", _ref: ids.preset }],
  },
];

const sanity = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset,
  apiVersion: DEFAULT_API_VERSION,
  token,
  useCdn: false,
});
const assetLake = createAssetLake({
  projectId: SANITY_PROJECT_ID,
  dataset,
  apiVersion: DEFAULT_API_VERSION,
  token,
});
const created: { imageId?: string; assetId?: string } = {};

// The image record references the application, which references the policy and preset, so delete
// in that order. Each step tolerates "already gone" so a failed run still cleans up.
afterAll(async () => {
  const leftovers = [
    created.imageId,
    created.assetId,
    ids.application,
    ids.preset,
    ids.policy,
  ];
  for (const id of leftovers) {
    if (id) await sanity.delete(id).catch(() => undefined);
  }
});

describe(`bring-your-own-project setup against "${dataset}"`, () => {
  it("uploads through a freshly created application and serves its preset from the CDN", async () => {
    const transaction = sanity.transaction();
    for (const document of setupDocuments)
      transaction.createIfNotExists(document);
    await transaction.commit({ visibility: "sync" });

    const entity = { type: "user", id: `user-byo-${run}` };
    const image = await assetLake.images.upload({
      body: createPngBytes(400, 400, Date.now() % 251),
      filename: "byo.png",
      contentType: "image/png",
      applicationId: ids.application,
      purpose: "avatar",
      entity,
      actorId: entity.id,
    });
    Object.assign(created, { imageId: image.id, assetId: image.assetId });
    expect(image.status).toBe("ready");

    const url = await assetLake.images.url(image.id, { preset: presetSlug });
    expect(new URL(url).host).toBe("cdn.sanity.io");
    expect(url).toContain(`/images/${SANITY_PROJECT_ID}/${dataset}/`);
    expect(url).toMatch(/w=200&h=200/);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\//);

    await assetLake.images.delete({ id: image.id, actorEntity: entity });
    created.imageId = undefined;
    created.assetId = undefined;
  });
});
