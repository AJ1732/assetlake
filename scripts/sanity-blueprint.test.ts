import { afterEach, describe, expect, it, vi } from "vitest";

// The manifest reads its environment at import, so every case loads a fresh copy.
async function loadBlueprint(environment: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(environment))
    vi.stubEnv(name, value);
  const { default: blueprint } = await import("../sanity.blueprint");
  const { resources = [] } = blueprint();
  return (name: string) =>
    resources.find((resource) => resource.name === name) as
      | Record<string, unknown>
      | undefined;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sanity.blueprint.ts", () => {
  it("gives both Functions an editor robot token scoped to the project", async () => {
    const resource = await loadBlueprint({
      ASSETLAKE_REVIEWER_IDS: "gReviewer1",
      SANITY_PROJECT_ID: undefined,
    });

    expect(resource("assetlake-image-review")).toMatchObject({
      memberships: [
        {
          resourceType: "project",
          resourceId: "oshzwvjy",
          roleNames: ["editor"],
        },
      ],
    });
    for (const name of ["image-review-drain", "image-review-start"])
      expect(resource(name)).toMatchObject({
        robotToken: "$.resources.assetlake-image-review.token",
        project: "oshzwvjy",
      });
  });

  it("drains only production instances and passes the reviewer allowlist", async () => {
    const resource = await loadBlueprint({
      ASSETLAKE_REVIEWER_IDS: "gReviewer1, gReviewer2",
    });

    expect(resource("image-review-drain")).toMatchObject({
      src: "./packages/image-review/functions/image-review-drain",
      env: { ASSETLAKE_REVIEWER_IDS: "gReviewer1,gReviewer2" },
      event: {
        filter: expect.stringContaining('tag == "production"'),
        resource: { type: "dataset", id: "oshzwvjy.production" },
      },
    });
  });

  it("starts reviews on create of a production image held in review", async () => {
    const resource = await loadBlueprint({ ASSETLAKE_REVIEWER_IDS: "g1" });

    expect(resource("image-review-start")).toMatchObject({
      src: "./packages/image-review/functions/image-review-start",
      event: {
        on: ["create"],
        filter: '_type == "assetLakeImage" && status == "review"',
        resource: { type: "dataset", id: "oshzwvjy.production" },
      },
    });
  });

  it("refuses to build without reviewer ids", async () => {
    await expect(
      loadBlueprint({ ASSETLAKE_REVIEWER_IDS: undefined }),
    ).rejects.toThrow("ASSETLAKE_REVIEWER_IDS is not set");
  });
});
