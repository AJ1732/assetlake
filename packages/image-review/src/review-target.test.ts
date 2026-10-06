import { describe, expect, it } from "vitest";

import {
  imageSubject,
  reviewDeployment,
  reviewInstanceId,
} from "./review-target";

describe("reviewDeployment", () => {
  it("keeps engine documents in the content dataset, tagged with its name", () => {
    expect(
      reviewDeployment({ projectId: "oshzwvjy", dataset: "production" }),
    ).toEqual({
      tag: "production",
      workflowResource: { type: "dataset", id: "oshzwvjy.production" },
    });
  });
});

describe("reviewInstanceId", () => {
  it("is stable for one image and differs between images", async () => {
    const first = await reviewInstanceId("test", "assetlake-image-a");

    expect(await reviewInstanceId("test", "assetlake-image-a")).toBe(first);
    expect(await reviewInstanceId("test", "assetlake-image-b")).not.toBe(first);
  });

  // Undotted ids are visible to tokenless reads of a public dataset; dotted ones are not.
  it("keeps the engine's dotted id shape", async () => {
    expect(await reviewInstanceId("production", "assetlake-image-a")).toMatch(
      /^production\.wf-instance\.[0-9a-f]{12}$/,
    );
  });
});

describe("imageSubject", () => {
  it("points at the image in its own project and dataset", () => {
    expect(
      imageSubject(
        { projectId: "oshzwvjy", dataset: "test" },
        "assetlake-image-a",
      ),
    ).toEqual({
      id: "dataset:oshzwvjy:test:assetlake-image-a",
      type: "assetLakeImage",
    });
  });
});
