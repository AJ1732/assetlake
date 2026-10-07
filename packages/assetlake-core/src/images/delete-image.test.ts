import { describe, expect, it } from "vitest";

import { createPngBytes } from "../testing/image-fixtures";
import { APPLICATION_ID, createScenario } from "../testing/scenario";

const owner = { type: "user", id: "user-demo-001" };

async function uploadAs(
  scenario: ReturnType<typeof createScenario>,
  seed: number,
) {
  return scenario.assetLake.images.upload({
    body: createPngBytes(20, 20, seed),
    filename: "a.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    entity: owner,
    actorId: owner.id,
  });
}

describe("images.delete", () => {
  it("removes the record and its now-unreferenced asset", async () => {
    const scenario = createScenario();
    const image = await uploadAs(scenario, 1);

    await scenario.assetLake.images.delete({
      id: image.id,
      actorEntity: owner,
    });
    expect(scenario.store.images.has(image.id)).toBe(false);
    expect(scenario.store.assets.has(image.assetId)).toBe(false);
  });

  it("refuses another user's image and leaves it untouched", async () => {
    const scenario = createScenario();
    const image = await uploadAs(scenario, 1);

    await expect(
      scenario.assetLake.images.delete({
        id: image.id,
        actorEntity: { type: "user", id: "user-demo-999" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(scenario.store.images.has(image.id)).toBe(true);
  });

  it("keeps a shared asset that another record still references", async () => {
    const scenario = createScenario();
    const first = await uploadAs(scenario, 5);
    const second = await uploadAs(scenario, 5);
    expect(second.assetId).toBe(first.assetId);

    await scenario.assetLake.images.delete({
      id: first.id,
      actorEntity: owner,
    });
    expect(scenario.store.assets.has(first.assetId)).toBe(true);
  });

  it("reports IMAGE_NOT_FOUND for unknown ids", async () => {
    const scenario = createScenario();
    await expect(
      scenario.assetLake.images.delete({
        id: "assetlake-image-missing",
        actorEntity: owner,
      }),
    ).rejects.toMatchObject({
      code: "IMAGE_NOT_FOUND",
    });
  });

  it("still succeeds when the asset delete fails after the record is gone, and logs why", async () => {
    const scenario = createScenario();
    const image = await uploadAs(scenario, 1);
    scenario.store.failNext("deleteAsset", new Error("Sanity unavailable"));

    await expect(
      scenario.assetLake.images.delete({ id: image.id, actorEntity: owner }),
    ).resolves.toBeUndefined();
    expect(scenario.store.images.has(image.id)).toBe(false);
    expect(scenario.entries.at(-1)).toEqual({
      level: "warn",
      event: "ASSET_DELETE_COMPLETED",
      fields: {
        imageId: image.id,
        assetId: image.assetId,
        assetDeleted: false,
        reason: "Sanity unavailable",
      },
    });
  });
});
