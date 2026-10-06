import {
  type AssetLakeImageResult,
  createAssetLake,
  createSetupPlan,
  planDocumentIds,
} from "@assetlake/core";
import { createPngBytes } from "@assetlake/core/testing";
import { DEFAULT_API_VERSION } from "@assetlake/sanity-schema/project";
import { createClient } from "@sanity/client";
import {
  type Actor,
  createEngine,
  type Engine,
  ENGINE_API_VERSION,
} from "@sanity/workflow-engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApplyReviewEffect } from "../../src/apply-review-effect";
import {
  APPLY_REVIEW_EFFECT,
  REVIEW_ACTIONS,
  REVIEW_ACTIVITY,
  REVIEW_STAGES,
} from "../../src/image-review.workflow";
import { reviewDeployment } from "../../src/review-target";
import { startImageReview } from "../../src/start-review";

// Eval lane against the synthetic `test` dataset, with the definition deployed to deployment
// `test` (sanity-workflows deploy --deployment test). The token acts as starter, reviewer and
// drainer; the Functions are not involved, so this proves the workflow, the handler and core.
const target = {
  projectId: process.env.SANITY_PROJECT_ID?.trim() || "oshzwvjy",
  dataset: process.env.SANITY_TEST_DATASET ?? "test",
};
const token = process.env.SANITY_WRITE_TOKEN ?? "";
const run = Date.now().toString(36);
const entity = { type: "user", id: `user-review-${run}` };

const plan = createSetupPlan({
  applicationSlug: `review-eval-${run}`,
  policy: {
    slug: `review-eval-${run}`,
    name: "Review eval",
    allowedMimeTypes: ["image/png"],
    maxFileSizeBytes: 1_000_000,
    requiresReview: true,
  },
  presets: [],
});

const coreConfig = { ...target, apiVersion: DEFAULT_API_VERSION, token };
const assetLake = createAssetLake(coreConfig);
const sanity = createClient({ ...coreConfig, useCdn: false });
const tokenless = createClient({
  ...target,
  apiVersion: DEFAULT_API_VERSION,
  useCdn: false,
});
const engineClient = createClient({
  ...target,
  token,
  apiVersion: ENGINE_API_VERSION,
  perspective: "raw",
  useCdn: false,
});
const { tag, workflowResource } = reviewDeployment(target);
const engine = createEngine({
  client: engineClient,
  tag,
  workflowResource,
  executionContext: { kind: "test", id: "image-review-live" },
});

const cleanup: string[] = [];

beforeAll(async () => {
  await assetLake.setup.ensure(plan);
});

afterAll(async () => {
  // Engine documents stay: §16.3 forbids generic edits to them. Reset with sanity-workflows nuke.
  for (const id of [...cleanup, ...planDocumentIds(plan)].toReversed()) {
    await sanity.delete(id).catch(() => undefined);
  }
});

async function uploadForReview(seed: number): Promise<AssetLakeImageResult> {
  const image = await assetLake.images.upload({
    body: createPngBytes(64, 64, seed),
    filename: `review-${run}-${seed}.png`,
    contentType: "image/png",
    applicationId: plan.application.id,
    purpose: "avatar",
    entity,
    actorId: entity.id,
  });
  cleanup.push(image.assetId, image.id);
  return image;
}

/** Claims as the token's identity and returns that identity, which becomes the allowlist. */
async function claim(instanceId: string): Promise<Actor> {
  const { instance } = await engine.fireAction({
    instanceId,
    activity: REVIEW_ACTIVITY,
    action: REVIEW_ACTIONS.claim,
  });
  const reviewer = instance.fields.find((field) => field.name === "reviewer")
    ?.value as Actor | undefined;
  if (!reviewer) throw new Error("claim did not record a reviewer");
  return reviewer;
}

function drainerFor(reviewer: Actor): Engine {
  const reviewLake = createAssetLake({
    ...coreConfig,
    review: { reviewerIds: [reviewer.id] },
  });
  return createEngine({
    client: engineClient,
    tag,
    workflowResource,
    executionContext: { kind: "drainer", id: "image-review-live" },
    effects: {
      handlers: {
        [APPLY_REVIEW_EFFECT]: createApplyReviewEffect(reviewLake.images),
      },
    },
  });
}

const latestAvatar = () =>
  assetLake.images.findLatestForEntity({ entity, purpose: "avatar" });

describe(`image review workflow against "${target.dataset}"`, () => {
  it("holds an upload in review, then approval makes the app return it", async () => {
    const image = await uploadForReview(1);
    expect(image.status).toBe("review");
    await expect(latestAvatar()).resolves.toBeNull();

    const instance = await startImageReview(engine, target, image.id);
    expect(instance.currentStage).toBe(REVIEW_STAGES.review);
    const reviewer = await claim(instance._id);
    await engine.fireAction({
      instanceId: instance._id,
      activity: REVIEW_ACTIVITY,
      action: REVIEW_ACTIONS.approve,
    });

    const drained = await drainerFor(reviewer).drainEffects({
      instanceId: instance._id,
    });

    expect(drained.drained).toHaveLength(1);
    await expect(latestAvatar()).resolves.toMatchObject({
      id: image.id,
      status: "ready",
    });
    const settled = await engine.getInstance({ instanceId: instance._id });
    expect(settled.currentStage).toBe(REVIEW_STAGES.approved);
  });

  it("keeps workflow documents out of tokenless reads of the public dataset", async () => {
    const query = 'count(*[_type == "sanity.workflow.instance"])';

    expect(await engineClient.fetch<number>(query)).toBeGreaterThan(0);
    expect(await tokenless.fetch<number>(query)).toBe(0);
  });

  it("rejects: the image becomes rejected and is never returned", async () => {
    const image = await uploadForReview(2);
    const instance = await startImageReview(engine, target, image.id);
    const reviewer = await claim(instance._id);
    await engine.fireAction({
      instanceId: instance._id,
      activity: REVIEW_ACTIVITY,
      action: REVIEW_ACTIONS.reject,
      params: { note: `live eval ${run}` },
    });

    await drainerFor(reviewer).drainEffects({ instanceId: instance._id });

    const record = await sanity.getDocument<{ status: string }>(image.id);
    expect(record?.status).toBe("rejected");
    const latest = await latestAvatar();
    expect(latest?.id).not.toBe(image.id);
    const settled = await engine.getInstance({ instanceId: instance._id });
    expect(settled.currentStage).toBe(REVIEW_STAGES.rejected);
  });

  // transitionStatus relies on this: a stale ifRevisionId must be refused with 409, not applied.
  it("refuses a patch made against a stale revision with 409", async () => {
    const image = await uploadForReview(3);

    await expect(
      sanity
        .patch(image.id)
        .ifRevisionId("stale-revision")
        .set({ alt: "stale" })
        .commit(),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
