import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { createPngBytes } from "./testing/image-fixtures";
import { importGraph } from "./testing/import-graph";
import { APPLICATION_ID, createScenario } from "./testing/scenario";

// @sanity/client costs ~300 ms to import. Anything that injects its own store must not pay it.
vi.mock("@sanity/client", () => {
  throw new Error("@sanity/client was loaded");
});

const sourceFile = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

describe("@sanity/client import boundary", () => {
  it.each(["create-asset-lake.ts", "testing.ts", "index.ts"])(
    "is not a static import of %s",
    (entry) => {
      expect([...importGraph(sourceFile(entry))]).not.toContain(
        "@sanity/client",
      );
    },
  );

  it("is never loaded by an upload, URL and delete on the in-memory store", async () => {
    const { assetLake } = createScenario();
    const entity = { type: "user", id: "user-demo-001" };

    const image = await assetLake.images.upload({
      body: createPngBytes(20, 20),
      filename: "a.png",
      contentType: "image/png",
      applicationId: APPLICATION_ID,
      purpose: "avatar",
      entity,
      actorId: entity.id,
    });
    await assetLake.images.url(image.id, { preset: "avatar" });
    await assetLake.images.delete({ id: image.id, actorEntity: entity });
  });
});
