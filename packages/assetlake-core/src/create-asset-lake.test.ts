import { describe, expect, it } from "vitest";

import { createPngBytes } from "./testing/image-fixtures";
import { APPLICATION_ID, createScenario } from "./testing/scenario";

const entity = { type: "user", id: "user-demo-001" };

async function upload(
  scenario: ReturnType<typeof createScenario>,
  seed: number,
) {
  const result = await scenario.assetLake.images.upload({
    body: createPngBytes(300, 200, seed),
    filename: "a.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    entity,
    actorId: entity.id,
  });
  scenario.clock.advance(1000);
  return result;
}

describe("createAssetLake facade", () => {
  it("finds the latest ready image for an entity and purpose", async () => {
    const scenario = createScenario();
    await upload(scenario, 1);
    const latest = await upload(scenario, 2);

    await expect(
      scenario.assetLake.images.findLatestForEntity({
        entity,
        purpose: "avatar",
      }),
    ).resolves.toEqual(latest);
    await expect(
      scenario.assetLake.images.findLatestForEntity({
        entity,
        purpose: "cover",
      }),
    ).resolves.toBeNull();
  });

  it("builds preset URLs and responsive images for a stored image", async () => {
    const scenario = createScenario();
    const image = await upload(scenario, 1);

    const url = await scenario.assetLake.images.url(image.id, {
      preset: "avatar",
    });
    expect(url).toMatch(
      /^https:\/\/cdn\.sanity\.io\/images\/testproject\/test\/.*w=256&h=256/,
    );

    const responsive = await scenario.assetLake.images.responsive(image.id, {
      preset: "avatar",
    });
    expect(responsive).toMatchObject({
      width: 256,
      height: 256,
      lqip: image.lqip,
    });
  });

  it("counts uploads for quota checks", async () => {
    const scenario = createScenario();
    const since = scenario.clock.now();
    await upload(scenario, 1);
    await upload(scenario, 2);

    await expect(
      scenario.assetLake.images.countUploadsSince({
        applicationId: APPLICATION_ID,
        since,
      }),
    ).resolves.toBe(2);
    await expect(
      scenario.assetLake.images.countUploadsForEntity(entity),
    ).resolves.toBe(2);
  });

  it("reports IMAGE_NOT_FOUND when building a URL for an unknown image", async () => {
    const scenario = createScenario();
    await expect(
      scenario.assetLake.images.url("assetlake-image-missing", {
        preset: "avatar",
      }),
    ).rejects.toMatchObject({
      code: "IMAGE_NOT_FOUND",
    });
  });
});
