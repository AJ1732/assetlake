import { afterAll, describe, expect, it, vi } from "vitest";

// The default export builds from process.env at import and refuses to build without reviewer ids.
vi.hoisted(() => vi.stubEnv("ASSETLAKE_REVIEWER_IDS", "gImportTime"));

const { imageReviewBlueprint } = await import("../sanity.blueprint");

afterAll(() => {
  vi.unstubAllEnvs();
});

function buildBlueprint(environment: Record<string, string | undefined>) {
  const { resources = [] } = imageReviewBlueprint(environment)();
  return (name: string) =>
    resources.find((resource) => resource.name === name) as
      | Record<string, unknown>
      | undefined;
}

describe("sanity.blueprint.ts", () => {
  it("gives both Functions an editor robot token scoped to the project", () => {
    const resource = buildBlueprint({ ASSETLAKE_REVIEWER_IDS: "gReviewer1" });

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

  it("drains only production instances and passes the reviewer allowlist", () => {
    const resource = buildBlueprint({
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

  it("starts reviews on create of a production image held in review", () => {
    const resource = buildBlueprint({ ASSETLAKE_REVIEWER_IDS: "g1" });

    expect(resource("image-review-start")).toMatchObject({
      src: "./packages/image-review/functions/image-review-start",
      event: {
        on: ["create"],
        filter: '_type == "assetLakeImage" && status == "review"',
        resource: { type: "dataset", id: "oshzwvjy.production" },
      },
    });
  });

  it("targets the project named in the environment", () => {
    const resource = buildBlueprint({
      ASSETLAKE_REVIEWER_IDS: "g1",
      SANITY_PROJECT_ID: "abc123xy",
    });

    expect(resource("image-review-start")).toMatchObject({
      project: "abc123xy",
      event: { resource: { id: "abc123xy.production" } },
    });
  });

  it("refuses to build without reviewer ids", () => {
    expect(() => buildBlueprint({})).toThrow(
      "ASSETLAKE_REVIEWER_IDS is not set",
    );
  });
});
