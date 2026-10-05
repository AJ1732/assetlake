import { createSetupPlan } from "@assetlake/core";
import { createPngBytes } from "@assetlake/core/testing";
import { describe, expect, it } from "vitest";

import { UsageError } from "../cli-errors";
import { createTestLake } from "../test-support";
import { upload, type UploadOptions } from "./upload";

const APPLICATION_ID = "assetlake-application-my-app";
const png = createPngBytes(300, 200);

async function readyLake() {
  const lake = createTestLake();
  await lake.assetLake.setup.ensure(
    createSetupPlan({ applicationSlug: "my-app" }),
  );
  return lake;
}

const options = (overrides: Partial<UploadOptions> = {}): UploadOptions => ({
  file: "./photos/photo.png",
  applicationId: APPLICATION_ID,
  purpose: "content",
  tags: [],
  ...overrides,
});

describe("upload", () => {
  it("uploads the file and prints the normalized record", async () => {
    const { assetLake } = await readyLake();

    const result = await upload(
      { assetLake, readFile: async () => png },
      options(),
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({
      status: "ready",
      mimeType: "image/png",
      width: 300,
      height: 200,
    });
  });

  it("adds the preset URL when a preset is given", async () => {
    const { assetLake } = await readyLake();

    const result = await upload(
      { assetLake, readFile: async () => png },
      options({ preset: "avatar" }),
    );

    expect(result.output).toMatchObject({ preset: "avatar" });
    expect((result.output as { presetUrl: string }).presetUrl).toContain(
      "w=256&h=256",
    );
  });

  it("takes the type from the bytes, not the file extension", async () => {
    const { assetLake } = await readyLake();

    const result = await upload(
      { assetLake, readFile: async () => png },
      options({ file: "photo.jpg" }),
    );

    expect(result.output).toMatchObject({ mimeType: "image/png" });
  });

  it("refuses a non-image before anything reaches the store", async () => {
    const { store, assetLake } = await readyLake();
    const text = new TextEncoder().encode("name,email\nada,ada@example.com\n");

    await expect(
      upload(
        { assetLake, readFile: async () => text },
        options({ file: "people.png" }),
      ),
    ).rejects.toThrow("people.png is not an image");
    expect(store.calls.uploadImageAsset).toBeUndefined();
  });

  it("records the entity, alt text and tags", async () => {
    const { store, assetLake } = await readyLake();

    const result = await upload(
      { assetLake, readFile: async () => png },
      options({
        entityType: "user",
        entityId: "user-1",
        alt: "A red square",
        tags: ["demo", "cli"],
      }),
    );

    const record = store.images.get((result.output as { id: string }).id);
    expect(record).toMatchObject({
      entity: { type: "user", id: "user-1" },
      alt: "A red square",
      tags: ["demo", "cli"],
    });
  });

  it("rejects an unknown purpose as a usage error", async () => {
    const { assetLake } = await readyLake();

    const attempt = upload(
      { assetLake, readFile: async () => png },
      options({ purpose: "banner" }),
    );

    await expect(attempt).rejects.toBeInstanceOf(UsageError);
    await expect(attempt).rejects.toThrow("--purpose");
  });

  it("requires the entity type and id together", async () => {
    const { assetLake } = await readyLake();

    await expect(
      upload(
        { assetLake, readFile: async () => png },
        options({ entityType: "user" }),
      ),
    ).rejects.toBeInstanceOf(UsageError);
  });
});
