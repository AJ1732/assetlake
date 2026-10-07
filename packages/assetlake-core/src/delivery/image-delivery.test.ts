import { describe, expect, it } from "vitest";

import { createPngBytes } from "../testing/image-fixtures";
import {
  APPLICATION_ID,
  avatarPreset,
  createScenario,
} from "../testing/scenario";
import { createImageUrls } from "./image-urls";

const entity = { type: "user", id: "user-demo-001" };
const cardPreset = {
  ...avatarPreset,
  slug: "card",
  name: "Card",
  width: 640,
  height: 360,
};

async function scenarioWithImage() {
  const scenario = createScenario({ presets: [avatarPreset, cardPreset] });
  const image = await scenario.assetLake.images.upload({
    body: createPngBytes(600, 400, 1),
    filename: "a.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    entity,
    actorId: entity.id,
  });
  const readsBefore = scenario.store.callCount();
  return {
    ...scenario,
    image,
    readsSinceUpload: () => scenario.store.callCount() - readsBefore,
  };
}

describe("image delivery round trips", () => {
  it("builds a preset URL from one lean image read and one preset read", async () => {
    const { assetLake, store, image } = await scenarioWithImage();

    await assetLake.images.url(image.id, { preset: "avatar" });

    expect(store.callCount("findImageSource")).toBe(1);
    expect(store.callCount("findImage")).toBe(0);
    expect(store.callCount("findPresetBySlug")).toBe(1);
  });

  it("reuses the cached preset for later URLs of the same preset", async () => {
    const { assetLake, store, image } = await scenarioWithImage();

    await assetLake.images.url(image.id, { preset: "avatar" });
    await assetLake.images.responsive(image.id, { preset: "avatar" });

    expect(store.callCount("findPresetBySlug")).toBe(1);
    expect(store.callCount("findImageSource")).toBe(2);
  });

  it("takes lqip and original dimensions for responsive images from the lean read", async () => {
    const { assetLake, image } = await scenarioWithImage();

    const responsive = await assetLake.images.responsive(image.id, {
      preset: "card",
      sizes: "50vw",
    });

    expect(responsive).toMatchObject({
      sizes: "50vw",
      width: 512,
      height: 288,
      lqip: image.lqip,
    });
  });

  it("returns the source with the latest image, so every preset URL is built locally in 2 reads", async () => {
    const { assetLake, image, readsSinceUpload } = await scenarioWithImage();
    const urls = createImageUrls({ projectId: "testproject", dataset: "test" });

    const latest = await assetLake.images.findLatestForEntity({
      entity,
      purpose: "avatar",
    });
    const presets = await assetLake.presets.list();
    const local = presets.map(({ transform }) =>
      urls.buildUrl(latest!.source, transform),
    );

    expect(latest).toMatchObject({
      id: image.id,
      source: { asset: { _ref: image.assetId } },
    });
    expect(readsSinceUpload()).toBe(2);
    await expect(
      Promise.all(
        presets.map(({ slug }) =>
          assetLake.images.url(image.id, { preset: slug }),
        ),
      ),
    ).resolves.toEqual(local);
  });

  it("reports IMAGE_NOT_FOUND for an unknown image", async () => {
    const { assetLake } = createScenario();

    await expect(
      assetLake.images.responsive("assetlake-image-missing", {
        preset: "avatar",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND" });
  });
});
