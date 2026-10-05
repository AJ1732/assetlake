import { createClient } from "@sanity/client";
import { afterAll, describe, expect, it } from "vitest";

import { createAssetLake } from "../../src/create-asset-lake";
import { createSetupPlan, planDocumentIds } from "../../src/setup/setup-plan";
import { createPngBytes } from "../../src/testing/image-fixtures";
import { liveTarget } from "./live-target";

// Eval lane: Sanity fetches a remote image (Assets API from-url). The source is a cdn.sanity.io
// URL of an image this test uploads first, with a transform so Sanity sees new bytes (spike S1
// showed cdn.sanity.io passes the source policy).
const { dataset } = liveTarget;
const run = Date.now().toString(36);
const entity = { type: "user", id: `user-from-url-${run}` };
const CAMPUS_APPLICATION = "assetlake-application-campus-demo";

const assetLake = createAssetLake({
  ...liveTarget,
  remoteUploads: { allowedHosts: ["cdn.sanity.io"] },
});
const sanity = createClient({ ...liveTarget, useCdn: false });

// A policy smaller than any fetched image, to prove the after-upload check and its cleanup.
const tinyPlan = createSetupPlan({
  applicationSlug: `from-url-tiny-${run}`,
  policy: {
    slug: `from-url-tiny-${run}`,
    name: "Tiny",
    allowedMimeTypes: ["image/png"],
    maxFileSizeBytes: 100,
    requiresReview: false,
  },
  presets: [],
});

const cleanup: string[] = [];

afterAll(async () => {
  for (const id of [...cleanup, ...planDocumentIds(tinyPlan)].toReversed()) {
    await sanity.delete(id).catch(() => undefined);
  }
});

async function uploadSource() {
  const source = await assetLake.images.upload({
    body: createPngBytes(600, 400, Date.now() % 251),
    filename: `from-url-source-${run}.png`,
    contentType: "image/png",
    applicationId: CAMPUS_APPLICATION,
    purpose: "content",
    entity,
    actorId: entity.id,
  });
  cleanup.push(source.assetId, source.id);
  return source;
}

describe(`images.uploadFromUrl against "${dataset}"`, () => {
  it("stores an image fetched by Sanity and serves its preset from the CDN", async () => {
    const source = await uploadSource();

    const image = await assetLake.images.uploadFromUrl({
      url: `${source.url}?w=300`,
      filename: `from-url-${run}.png`,
      applicationId: CAMPUS_APPLICATION,
      purpose: "content",
      entity,
      actorId: entity.id,
    });
    cleanup.push(image.assetId, image.id);

    expect(image).toMatchObject({
      status: "ready",
      mimeType: "image/png",
      width: 300,
      height: 200,
    });
    expect(image.assetId).not.toBe(source.assetId);
    const url = await assetLake.images.url(image.id, { preset: "avatar" });
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\//);
  });

  it("deletes a fetched file the policy rejects and creates no record", async () => {
    await assetLake.setup.ensure(tinyPlan);
    const source = await uploadSource();
    const filename = `from-url-rejected-${run}.png`;

    await expect(
      assetLake.images.uploadFromUrl({
        url: `${source.url}?w=200`,
        filename,
        applicationId: tinyPlan.application.id,
        purpose: "content",
        entity,
        actorId: entity.id,
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });

    const leftovers = await sanity.fetch<number>(
      `count(*[_type == "sanity.imageAsset" && originalFilename == $filename])`,
      { filename },
    );
    expect(leftovers).toBe(0);
  });

  it("refuses a host that is not allowed", async () => {
    await expect(
      assetLake.images.uploadFromUrl({
        url: "https://example.com/photo.png",
        applicationId: CAMPUS_APPLICATION,
        purpose: "content",
        actorId: entity.id,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_URL_NOT_ALLOWED" });
  });
});
