import { createClient } from "@sanity/client";
import { afterAll, describe, expect, it } from "vitest";

import { createAssetLake } from "../../src/create-asset-lake";
import { createSetupPlan, planDocumentIds } from "../../src/setup/setup-plan";
import { createPngBytes } from "../../src/testing/image-fixtures";
import { liveTarget } from "./live-target";

// Eval lane: proves the root README's "Use AssetLake with your own Sanity project" path. It creates
// a fresh application through assetLake.setup (the code behind `assetlake init`), not the seeded
// campus demo, then uploads through it. Presets are dataset-global, so every slug is unique per run.
const { projectId, dataset } = liveTarget;
const run = Date.now().toString(36);
const presetSlug = `byo-thumb-${run}`;

const plan = createSetupPlan({
  applicationSlug: `byo-${run}`,
  applicationName: "My app",
  policy: {
    slug: `byo-public-${run}`,
    name: "Public images",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSizeBytes: 5 * 1024 * 1024,
    requiresReview: false,
  },
  presets: [
    {
      slug: presetSlug,
      name: "Thumbnail",
      width: 200,
      height: 200,
      fit: "crop",
      quality: 80,
      autoFormat: true,
    },
  ],
});
const setupIds = planDocumentIds(plan);

const sanity = createClient({ ...liveTarget, useCdn: false });
const assetLake = createAssetLake(liveTarget);
const created: { imageId?: string; assetId?: string } = {};

// The image record references the application, which references the policy and preset, so delete
// the image first and the setup documents in reverse plan order. Each step tolerates "already gone"
// so a failed run still cleans up.
afterAll(async () => {
  const leftovers = [
    created.imageId,
    created.assetId,
    ...setupIds.toReversed(),
  ];
  for (const id of leftovers) {
    if (id) await sanity.delete(id).catch(() => undefined);
  }
});

describe(`bring-your-own-project setup against "${dataset}"`, () => {
  it("creates the setup documents once; a second run creates nothing", async () => {
    await expect(assetLake.setup.ensure(plan)).resolves.toEqual({
      created: setupIds,
      existing: [],
    });
    await expect(assetLake.setup.ensure(plan)).resolves.toEqual({
      created: [],
      existing: setupIds,
    });
  });

  it("makes the setup documents readable without a token (public dataset, root-path ids)", async () => {
    const { token: _token, ...publicTarget } = liveTarget;
    const tokenless = createClient({ ...publicTarget, useCdn: false });
    const found = await tokenless.fetch<string[]>("*[_id in $ids]._id", {
      ids: setupIds,
    });
    expect(found.toSorted()).toEqual(setupIds.toSorted());
  });

  it("uploads through the new application and serves its preset from the CDN", async () => {
    const entity = { type: "user", id: `user-byo-${run}` };
    const image = await assetLake.images.upload({
      body: createPngBytes(400, 400, Date.now() % 251),
      filename: "byo.png",
      contentType: "image/png",
      applicationId: plan.application.id,
      purpose: "avatar",
      entity,
      actorId: entity.id,
    });
    Object.assign(created, { imageId: image.id, assetId: image.assetId });
    expect(image.status).toBe("ready");

    const url = await assetLake.images.url(image.id, { preset: presetSlug });
    expect(new URL(url).host).toBe("cdn.sanity.io");
    expect(url).toContain(`/images/${projectId}/${dataset}/`);
    expect(url).toMatch(/w=200&h=200/);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\//);

    await assetLake.images.delete({ id: image.id, actorEntity: entity });
    created.imageId = undefined;
    created.assetId = undefined;
  });
});
