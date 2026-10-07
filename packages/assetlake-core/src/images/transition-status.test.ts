import { describe, expect, it } from "vitest";

import type { ImageStatus } from "../contracts";
import { createPngBytes } from "../testing/image-fixtures";
import { APPLICATION_ID, createScenario } from "../testing/scenario";

const REVIEWER = { id: "gReviewer1" };
const owner = { type: "user", id: "user-demo-001" };

function reviewScenario(reviewerIds: string[] | null = [REVIEWER.id]) {
  return createScenario({
    policy: { requiresReview: true },
    config: reviewerIds ? { review: { reviewerIds } } : {},
  });
}

async function uploadForReview(scenario: ReturnType<typeof reviewScenario>) {
  return scenario.assetLake.images.upload({
    body: createPngBytes(20, 20, 1),
    filename: "a.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    entity: owner,
    actorId: owner.id,
  });
}

function setStatus(
  scenario: ReturnType<typeof reviewScenario>,
  id: string,
  status: ImageStatus,
) {
  const record = scenario.store.images.get(id);
  if (!record) throw new Error(`no record ${id}`);
  scenario.store.images.set(id, { ...record, status });
}

describe("images.transitionStatus", () => {
  it.each(["ready", "rejected"] as const)(
    "moves a review image to %s and reports it applied",
    async (to) => {
      const scenario = reviewScenario();
      const image = await uploadForReview(scenario);

      await expect(
        scenario.assetLake.images.transitionStatus({
          id: image.id,
          to,
          reviewer: REVIEWER,
        }),
      ).resolves.toEqual({
        id: image.id,
        from: "review",
        to,
        outcome: "applied",
      });
      expect(scenario.store.images.get(image.id)?.status).toBe(to);
    },
  );

  it("reports a repeat of the same decision as unchanged and writes nothing", async () => {
    const scenario = reviewScenario();
    const image = await uploadForReview(scenario);
    const input = { id: image.id, to: "ready" as const, reviewer: REVIEWER };
    await scenario.assetLake.images.transitionStatus(input);

    await expect(
      scenario.assetLake.images.transitionStatus(input),
    ).resolves.toMatchObject({ from: "ready", outcome: "unchanged" });
    expect(scenario.store.callCount("updateImageStatus")).toBe(1);
  });

  it.each([
    ["ready", "rejected"],
    ["rejected", "ready"],
    ["processing", "ready"],
    ["failed", "rejected"],
  ] as const)("refuses %s -> %s without writing", async (from, to) => {
    const scenario = reviewScenario();
    const image = await uploadForReview(scenario);
    setStatus(scenario, image.id, from);

    await expect(
      scenario.assetLake.images.transitionStatus({
        id: image.id,
        to,
        reviewer: REVIEWER,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(scenario.store.images.get(image.id)?.status).toBe(from);
    expect(scenario.store.callCount("updateImageStatus")).toBe(0);
  });

  it("refuses a reviewer outside the allowlist and writes nothing", async () => {
    const scenario = reviewScenario();
    const image = await uploadForReview(scenario);

    await expect(
      scenario.assetLake.images.transitionStatus({
        id: image.id,
        to: "ready",
        reviewer: { id: "gSomeoneElse" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(scenario.store.images.get(image.id)?.status).toBe("review");
  });

  it("refuses every reviewer when no allowlist is configured", async () => {
    const scenario = reviewScenario(null);
    const image = await uploadForReview(scenario);

    await expect(
      scenario.assetLake.images.transitionStatus({
        id: image.id,
        to: "ready",
        reviewer: REVIEWER,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reports an unknown image", async () => {
    const scenario = reviewScenario();

    await expect(
      scenario.assetLake.images.transitionStatus({
        id: "assetlake-image-missing",
        to: "ready",
        reviewer: REVIEWER,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_NOT_FOUND" });
  });

  it("refuses when the record changed between the read and the write", async () => {
    const scenario = reviewScenario();
    const image = await uploadForReview(scenario);
    const read = scenario.store.findImage.bind(scenario.store);
    scenario.store.findImage = async (id) => {
      const view = await read(id);
      scenario.store.touchImage(id);
      return view;
    };

    await expect(
      scenario.assetLake.images.transitionStatus({
        id: image.id,
        to: "ready",
        reviewer: REVIEWER,
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(scenario.store.images.get(image.id)?.status).toBe("review");
  });

  it("logs the transition and each refusal without the reviewer id", async () => {
    const scenario = reviewScenario();
    const image = await uploadForReview(scenario);
    await scenario.assetLake.images.transitionStatus({
      id: image.id,
      to: "rejected",
      reviewer: REVIEWER,
    });
    await scenario.assetLake.images
      .transitionStatus({ id: image.id, to: "ready", reviewer: REVIEWER })
      .catch(() => {});

    const reviewLines = scenario.entries.filter((entry) =>
      entry.event.startsWith("IMAGE_STATUS_"),
    );
    expect(reviewLines.map((entry) => entry.event)).toEqual([
      "IMAGE_STATUS_TRANSITIONED",
      "IMAGE_STATUS_TRANSITION_REFUSED",
    ]);
    expect(reviewLines[0]?.fields).toEqual({
      imageId: image.id,
      from: "review",
      to: "rejected",
      outcome: "applied",
    });
    expect(JSON.stringify(reviewLines)).not.toContain(REVIEWER.id);
  });
});
