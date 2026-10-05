import { createSetupPlan } from "@assetlake/core";
import { createPngBytes } from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import { createTestLake } from "../test-support";
import { deleteImage } from "./delete";

async function lakeWithImage(entity?: { type: string; id: string }) {
  const lake = createTestLake();
  const plan = createSetupPlan({ applicationSlug: "my-app" });
  await lake.assetLake.setup.ensure(plan);
  const owner = entity ?? { type: "cli", id: "assetlake-cli" };
  const image = await lake.assetLake.images.upload({
    body: createPngBytes(64, 64),
    filename: "photo.png",
    contentType: "image/png",
    applicationId: plan.application.id,
    purpose: "content",
    entity: owner,
    actorId: owner.id,
  });
  return { ...lake, image };
}

describe("deleteImage", () => {
  it("deletes an image the CLI uploaded, with no flags", async () => {
    const { store, assetLake, image } = await lakeWithImage();

    const result = await deleteImage({ assetLake }, { imageId: image.id });

    expect(result).toEqual({
      exitCode: 0,
      output: { event: "IMAGE_DELETED", imageId: image.id },
    });
    expect(store.images.has(image.id)).toBe(false);
    expect(store.assets.has(image.assetId)).toBe(false);
  });

  it("deletes an image owned by the entity named in the flags", async () => {
    const { store, assetLake, image } = await lakeWithImage({
      type: "user",
      id: "user-1",
    });

    await deleteImage(
      { assetLake },
      { imageId: image.id, entityType: "user", entityId: "user-1" },
    );

    expect(store.images.has(image.id)).toBe(false);
  });

  it("refuses an image someone else owns", async () => {
    const { store, assetLake, image } = await lakeWithImage({
      type: "user",
      id: "user-1",
    });

    await expect(
      deleteImage({ assetLake }, { imageId: image.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.images.has(image.id)).toBe(true);
  });
});
