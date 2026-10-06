import { describe, expect, it } from "vitest";

import { createAssetLake } from "./create-asset-lake";
import { silentLogger } from "./logging/logger";
import { createSetupPlan } from "./setup/setup-plan";
import { createPngBytes } from "./testing/image-fixtures";
import { InMemoryStore } from "./testing/in-memory-store";
import { TEST_TOKEN } from "./testing/scenario";

const plan = createSetupPlan({
  applicationSlug: "shop",
  presets: [{ slug: "thumb", name: "Thumb", width: 100, height: 100 }],
});
const PLAN_IDS = [
  "assetlake-policy-public-images",
  "assetlake-preset-thumb",
  "assetlake-application-shop",
];

function createEmptyLake() {
  const store = new InMemoryStore();
  const assetLake = createAssetLake(
    {
      projectId: "testproject",
      dataset: "test",
      apiVersion: "2026-10-04",
      token: TEST_TOKEN,
      presetCacheTtlMs: 0,
    },
    { store, logger: silentLogger },
  );
  return { store, assetLake };
}

describe("assetLake.setup", () => {
  it("creates every plan document on the first run and none on the second", async () => {
    const { assetLake } = createEmptyLake();

    await expect(assetLake.setup.ensure(plan)).resolves.toEqual({
      created: PLAN_IDS,
      existing: [],
    });
    await expect(assetLake.setup.ensure(plan)).resolves.toEqual({
      created: [],
      existing: PLAN_IDS,
    });
  });

  it("reports missing ids until the plan is ensured", async () => {
    const { assetLake } = createEmptyLake();

    await expect(assetLake.setup.missing(plan)).resolves.toEqual(PLAN_IDS);
    await assetLake.setup.ensure(plan);
    await expect(assetLake.setup.missing(plan)).resolves.toEqual([]);
  });

  it("lets an upload use the new application's policy and preset right away", async () => {
    const { assetLake } = createEmptyLake();
    await assetLake.setup.ensure(plan);

    const image = await assetLake.images.upload({
      body: createPngBytes(300, 200),
      filename: "photo.png",
      contentType: "image/png",
      applicationId: plan.application.id,
      purpose: "content",
      actorId: "cli",
    });
    const url = await assetLake.images.url(image.id, { preset: "thumb" });

    expect(image.status).toBe("ready");
    expect(url).toContain("w=100&h=100");
  });

  it("lets an upload pick an additional policy that holds it for review", async () => {
    const { assetLake } = createEmptyLake();
    const reviewPlan = createSetupPlan({
      applicationSlug: "shop",
      additionalPolicies: [
        {
          ...plan.policy,
          slug: "reviewed",
          name: "Reviewed",
          requiresReview: true,
        },
      ],
      presets: [],
    });
    await assetLake.setup.ensure(reviewPlan);

    const image = await assetLake.images.upload({
      body: createPngBytes(300, 200),
      filename: "photo.png",
      contentType: "image/png",
      applicationId: reviewPlan.application.id,
      policyId: "assetlake-policy-reviewed",
      purpose: "content",
      actorId: "cli",
    });

    expect(image.status).toBe("review");
  });

  it("keeps an edited preset by default and restores it in reset mode", async () => {
    const { store, assetLake } = createEmptyLake();
    await assetLake.setup.ensure(plan);
    const edited = { ...store.presets.get("thumb")!, width: 999 };
    store.presets.set("thumb", edited);

    await assetLake.setup.ensure(plan);
    expect(store.presets.get("thumb")?.width).toBe(999);

    await expect(
      assetLake.setup.ensure(plan, { mode: "reset" }),
    ).resolves.toEqual({ created: [], existing: PLAN_IDS });
    expect(store.presets.get("thumb")?.width).toBe(100);
  });
});
