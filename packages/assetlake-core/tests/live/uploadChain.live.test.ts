import {
  DEFAULT_API_VERSION,
  SANITY_PROJECT_ID,
} from "@assetlake/sanity-schema/project";
import { createClient } from "@sanity/client";
import { afterAll, describe, expect, it } from "vitest";

import { createAssetLake } from "../../src/createAssetLake";
import { createPngBytes } from "../../src/testing/imageFixtures";

// Eval lane (handoff §21.2) against the synthetic `test` dataset, never production.
const dataset = process.env.SANITY_TEST_DATASET ?? "test";
const token = process.env.SANITY_WRITE_TOKEN ?? "";
const APPLICATION_ID = "assetlake-application-campus-demo";
const entity = { type: "user", id: `user-live-${Date.now()}` };

const timings: Record<string, number> = {};
async function timed<T>(step: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    timings[step] = Math.round(performance.now() - started);
  }
}

const assetLake = createAssetLake({
  projectId: SANITY_PROJECT_ID,
  dataset,
  apiVersion: DEFAULT_API_VERSION,
  token,
});
const sanity = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset,
  apiVersion: DEFAULT_API_VERSION,
  token,
  useCdn: false,
});
const created: { imageId?: string; assetId?: string } = {};

afterAll(async () => {
  if (created.imageId)
    await sanity.delete(created.imageId).catch(() => undefined);
  if (created.assetId)
    await sanity.delete(created.assetId).catch(() => undefined);
  console.log(
    JSON.stringify({ event: "LIVE_UPLOAD_CHAIN_TIMINGS", dataset, timings }),
  );
});

describe(`upload chain against "${dataset}"`, () => {
  it("uploads, records, transforms, serves from the CDN, replays, and deletes", async () => {
    const idempotencyKey = `live-${Date.now()}`;
    const input = {
      body: createPngBytes(600, 400, Date.now() % 251),
      filename: "live-chain.png",
      contentType: "image/png",
      applicationId: APPLICATION_ID,
      purpose: "avatar" as const,
      entity,
      actorId: entity.id,
      idempotencyKey,
    };

    const result = await timed("upload", () => assetLake.images.upload(input));
    Object.assign(created, { imageId: result.id, assetId: result.assetId });
    expect(result).toMatchObject({
      status: "ready",
      mimeType: "image/png",
      width: 600,
      height: 400,
    });

    const asset = await timed("readAsset", () =>
      sanity.getDocument<{
        mimeType: string;
        metadata: { dimensions: { width: number } };
      }>(result.assetId),
    );
    expect(asset?.mimeType).toBe("image/png");
    expect(asset?.metadata.dimensions.width).toBe(600);

    const record = await timed("readRecord", () =>
      sanity.getDocument<{
        image: { asset: { _ref: string } };
        status: string;
      }>(result.id),
    );
    expect(record?.image.asset._ref).toBe(result.assetId);
    expect(record?.status).toBe("ready");

    const url = await timed("presetUrl", () =>
      assetLake.images.url(result.id, { preset: "avatar" }),
    );
    expect(new URL(url).host).toBe("cdn.sanity.io");
    expect(url).toMatch(/w=256&h=256/);

    const response = await timed("cdnGet", () => fetch(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^image\//);

    const replay = await timed("replay", () => assetLake.images.upload(input));
    expect(replay.id).toBe(result.id);

    await timed("delete", () =>
      assetLake.images.delete({ id: result.id, actorEntity: entity }),
    );
    await expect(sanity.getDocument(result.id)).resolves.toBeUndefined();
    created.imageId = undefined;
    created.assetId = undefined;
  });
});
