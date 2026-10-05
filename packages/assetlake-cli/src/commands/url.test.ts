import { createSetupPlan } from "@assetlake/core";
import { createPngBytes } from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import { createTestLake } from "../test-support";
import { url } from "./url";

async function readyLake() {
  const lake = createTestLake();
  const plan = createSetupPlan({ applicationSlug: "my-app" });
  await lake.assetLake.setup.ensure(plan);
  return { ...lake, plan };
}

describe("url", () => {
  it("prints the preset URL for an uploaded image", async () => {
    const { assetLake, plan } = await readyLake();
    const image = await assetLake.images.upload({
      body: createPngBytes(800, 600),
      filename: "photo.png",
      contentType: "image/png",
      applicationId: plan.application.id,
      purpose: "content",
      actorId: "assetlake-cli",
    });

    const result = await url(
      { assetLake },
      { imageId: image.id, preset: "card" },
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({ imageId: image.id, preset: "card" });
    expect((result.output as { url: string }).url).toContain("w=640&h=360");
  });

  it("surfaces an unknown image as IMAGE_NOT_FOUND", async () => {
    const { assetLake } = await readyLake();

    await expect(
      url(
        { assetLake },
        { imageId: "assetlake-image-missing", preset: "card" },
      ),
    ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND" });
  });
});
