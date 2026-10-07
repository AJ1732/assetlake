import { describe, expect, it } from "vitest";

import type { UploadImageInput } from "../contracts";
import { createPngBytes, signatureBytes } from "../testing/image-fixtures";
import {
  APPLICATION_ID,
  createScenario,
  TEST_TOKEN,
} from "../testing/scenario";

const input = (
  overrides: Partial<UploadImageInput> = {},
): UploadImageInput => ({
  body: createPngBytes(600, 400),
  filename: "avatar.png",
  contentType: "image/png",
  applicationId: APPLICATION_ID,
  purpose: "avatar",
  entity: { type: "user", id: "user-demo-001" },
  actorId: "user-demo-001",
  ...overrides,
});

describe("images.upload", () => {
  it("stores the asset, creates a ready record referencing it, and returns the normalized result", async () => {
    const { assetLake, store, events } = createScenario();
    const result = await assetLake.images.upload(input());

    expect(result).toMatchObject({
      status: "ready",
      mimeType: "image/png",
      width: 600,
      height: 400,
      aspectRatio: 1.5,
    });
    expect(result.url).toMatch(/^https:\/\/cdn\.sanity\.io\//);
    expect(store.images.get(result.id)).toMatchObject({
      assetId: result.assetId,
      applicationId: APPLICATION_ID,
      purpose: "avatar",
      status: "ready",
      entity: { type: "user", id: "user-demo-001" },
    });
    expect(events()).toEqual([
      "ASSET_UPLOAD_STARTED",
      "ASSET_UPLOAD_COMPLETED",
    ]);
  });

  it("marks the record for review when the policy requires it", async () => {
    const { assetLake } = createScenario({ policy: { requiresReview: true } });
    await expect(assetLake.images.upload(input())).resolves.toMatchObject({
      status: "review",
    });
  });

  it("rejects before contacting storage when validation fails", async () => {
    const { assetLake, store, events } = createScenario();
    await expect(
      assetLake.images.upload(
        input({ contentType: "image/gif", body: signatureBytes("image/gif") }),
      ),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_IMAGE_TYPE",
    });
    expect(store.callCount("uploadImageAsset")).toBe(0);
    expect(events()).toContain("ASSET_UPLOAD_REJECTED");
  });

  it("fails clearly for an unknown application", async () => {
    const { assetLake } = createScenario();
    await expect(
      assetLake.images.upload(input({ applicationId: "nope" })),
    ).rejects.toMatchObject({
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("deletes the uploaded asset when dimensions violate the policy, and creates no record", async () => {
    const { assetLake, store, events } = createScenario({
      policy: { minWidth: 1000 },
    });
    await expect(assetLake.images.upload(input())).rejects.toMatchObject({
      code: "DIMENSIONS_OUT_OF_RANGE",
    });
    expect(store.images.size).toBe(0);
    expect(store.assets.size).toBe(0);
    expect(events()).toContain("ASSET_COMPENSATION_DELETED");
  });

  it("compensates when record creation fails and surfaces METADATA_CREATE_FAILED with the cause", async () => {
    const { assetLake, store } = createScenario();
    const original = new Error("mutation rejected");
    store.failNext("createImage", original);

    const failure = await assetLake.images
      .upload(input())
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      code: "METADATA_CREATE_FAILED",
      cause: original,
    });
    expect(store.assets.size).toBe(0);
  });

  it("keeps the original error when compensation itself fails", async () => {
    const { assetLake, store, events } = createScenario();
    store.failNext("createImage");
    store.failNext("deleteAsset");

    await expect(assetLake.images.upload(input())).rejects.toMatchObject({
      code: "METADATA_CREATE_FAILED",
    });
    expect(events()).toContain("ASSET_COMPENSATION_DELETE_FAILED");
  });

  it("does not delete a deduplicated asset that another record still references", async () => {
    const { assetLake, store, events } = createScenario();
    const body = createPngBytes(600, 400, 7);
    const first = await assetLake.images.upload(input({ body }));
    store.failNext("createImage");

    await expect(
      assetLake.images.upload(input({ body })),
    ).rejects.toMatchObject({ code: "METADATA_CREATE_FAILED" });
    expect(store.assets.has(first.assetId)).toBe(true);
    expect(events()).toContain("ASSET_COMPENSATION_SKIPPED_REFERENCED");
  });

  it("replays an idempotent retry without uploading again", async () => {
    const { assetLake, store, events } = createScenario();
    const first = await assetLake.images.upload(
      input({ idempotencyKey: "retry-1" }),
    );
    const second = await assetLake.images.upload(
      input({ idempotencyKey: "retry-1", body: createPngBytes(10, 10, 3) }),
    );

    expect(second).toEqual(first);
    expect(store.callCount("uploadImageAsset")).toBe(1);
    expect(events()).toContain("ASSET_UPLOAD_REPLAYED");
  });

  it("returns the winning record when a concurrent retry created it first", async () => {
    const { assetLake, store } = createScenario();
    const winner = await assetLake.images.upload(
      input({ idempotencyKey: "race" }),
    );
    const realFind = store.findImage.bind(store);
    let lookups = 0;
    store.findImage = async (id) =>
      (lookups += 1) === 1 ? null : realFind(id);

    const loser = await assetLake.images.upload(
      input({ idempotencyKey: "race", body: createPngBytes(30, 30, 9) }),
    );
    expect(loser).toEqual(winner);
    expect(store.assets.has(winner.assetId)).toBe(true);
    expect(store.assets.size).toBe(1);
  });

  it("never puts the write token in results or logs", async () => {
    const { assetLake, entries } = createScenario();
    const result = await assetLake.images.upload(input());
    expect(JSON.stringify(result)).not.toContain(TEST_TOKEN);
    expect(JSON.stringify(entries)).not.toContain(TEST_TOKEN);
  });
});
