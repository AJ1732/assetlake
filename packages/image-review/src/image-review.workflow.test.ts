import { createAssetLake } from "@assetlake/core";
import {
  createPngBytes,
  InMemoryStore,
  silentLogger,
} from "@assetlake/core/testing";
import {
  ActionDisabledError,
  type Actor,
  StartNotAllowedError,
} from "@sanity/workflow-engine";
import {
  createBench,
  createBenchEngine,
  subjectField,
} from "@sanity/workflow-engine-test";
import { describe, expect, it } from "vitest";

import { createApplyReviewEffect } from "./apply-review-effect";
import {
  APPLY_REVIEW_EFFECT,
  IMAGE_REVIEW_WORKFLOW,
  imageReview,
  REVIEW_ACTIONS,
  REVIEW_ACTIVITY,
  REVIEW_STAGES,
} from "./image-review.workflow";
import { reviewDeployment } from "./review-target";
import { startImageReview } from "./start-review";

// The bench's default resource is the dataset test.test, so the "test" deployment fits it exactly.
const TARGET = { projectId: "test", dataset: "test" };
const APPLICATION_ID = "assetlake-application-shop";
const REVIEW_POLICY_ID = "assetlake-policy-reviewed";

const reviewer: Actor = { kind: "person", id: "gReviewer1", roles: [] };
const colleague: Actor = { kind: "person", id: "gColleague", roles: [] };

/** Core over the in-memory store, holding one upload in review, plus a bench for the workflow. */
async function setup({ reviewerIds = [reviewer.id] } = {}) {
  const store = new InMemoryStore({
    applications: [
      { id: APPLICATION_ID, slug: "shop", defaultPolicyId: REVIEW_POLICY_ID },
    ],
    policies: [
      {
        id: REVIEW_POLICY_ID,
        allowedMimeTypes: ["image/png"],
        maxFileSizeBytes: 1_000_000,
        minWidth: null,
        minHeight: null,
        maxWidth: null,
        maxHeight: null,
        requiresReview: true,
      },
    ],
  });
  const assetLake = createAssetLake(
    {
      ...TARGET,
      apiVersion: "2026-10-04",
      token: "unused-in-memory",
      review: { reviewerIds },
    },
    { store, logger: silentLogger },
  );
  const image = await assetLake.images.upload({
    body: createPngBytes(20, 20),
    filename: "a.png",
    contentType: "image/png",
    applicationId: APPLICATION_ID,
    purpose: "avatar",
    actorId: "user-demo-001",
  });

  const bench = createBench({
    ...reviewDeployment(TARGET),
    documents: [{ _id: image.id, _type: "assetLakeImage", status: "review" }],
  });
  await bench.deployDefinitions({
    expectedMinReaderModel: 10,
    definitions: [imageReview],
  });
  const { instance } = await bench.startInstance({
    definition: IMAGE_REVIEW_WORKFLOW,
    initialFields: [subjectField(image.id, { type: "assetLakeImage" })],
  });
  const drainer = createBenchEngine(bench, {
    effects: {
      handlers: {
        [APPLY_REVIEW_EFFECT]: createApplyReviewEffect(assetLake.images),
      },
    },
  });

  const fire = (
    action: string,
    actor: Actor,
    params?: Record<string, unknown>,
  ) =>
    bench.fireAction({
      instanceId: instance._id,
      activity: REVIEW_ACTIVITY,
      action,
      actor,
      params,
    });
  const stage = () => bench.currentStage(instance._id);
  const imageStatus = () => store.images.get(image.id)?.status;
  const drain = () => drainer.drainEffects({ instanceId: instance._id });

  return { bench, instance, image, fire, stage, imageStatus, drain };
}

async function actionVerdict(
  context: Awaited<ReturnType<typeof setup>>,
  action: string,
  actor: Actor,
) {
  const evaluation = await context.bench.evaluate({
    instanceId: context.instance._id,
    actor,
  });
  return evaluation.currentStage.activities
    .flatMap((activity) => activity.actions)
    .find((candidate) => candidate.action.name === action);
}

describe("image review workflow", () => {
  it("starts in review with nobody holding the review", async () => {
    const context = await setup();

    expect(await context.stage()).toBe(REVIEW_STAGES.review);
    expect(
      await actionVerdict(context, REVIEW_ACTIONS.claim, reviewer),
    ).toMatchObject({ allowed: true });
  });

  it("does not let anyone approve before claiming", async () => {
    const context = await setup();

    expect(
      await actionVerdict(context, REVIEW_ACTIONS.approve, reviewer),
    ).toMatchObject({ allowed: false });
    await expect(
      context.fire(REVIEW_ACTIONS.approve, reviewer),
    ).rejects.toBeInstanceOf(ActionDisabledError);
  });

  it("does not let a colleague decide a review someone else claimed", async () => {
    const context = await setup();
    await context.fire(REVIEW_ACTIONS.claim, reviewer);

    await expect(
      context.fire(REVIEW_ACTIONS.reject, colleague, { note: "no" }),
    ).rejects.toBeInstanceOf(ActionDisabledError);
    expect(await context.stage()).toBe(REVIEW_STAGES.review);
  });

  it("queues one apply effect carrying the image, the decision and the reviewer", async () => {
    const context = await setup();
    await context.fire(REVIEW_ACTIONS.claim, reviewer);
    await context.fire(REVIEW_ACTIONS.approve, reviewer);

    expect(await context.stage()).toBe(REVIEW_STAGES.applying);
    const pending = await context.bench.listPendingEffects({
      instanceId: context.instance._id,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      name: APPLY_REVIEW_EFFECT,
      params: { decision: "approve", reviewer: reviewer.id },
    });
    expect(String(pending[0]?.params.subject)).toContain(context.image.id);
  });

  it("requires a note to reject", async () => {
    const context = await setup();
    await context.fire(REVIEW_ACTIONS.claim, reviewer);

    await expect(
      context.fire(REVIEW_ACTIONS.reject, reviewer),
    ).rejects.toThrow();
    expect(await context.stage()).toBe(REVIEW_STAGES.review);
  });

  it("approves through core: the drain makes the image ready and ends in approved", async () => {
    const context = await setup();
    await context.fire(REVIEW_ACTIONS.claim, reviewer);
    await context.fire(REVIEW_ACTIONS.approve, reviewer);

    const result = await context.drain();

    expect(result.drained).toHaveLength(1);
    expect(context.imageStatus()).toBe("ready");
    expect(await context.stage()).toBe(REVIEW_STAGES.approved);
  });

  it("rejects through core: the image becomes rejected and the note is kept", async () => {
    const context = await setup();
    await context.fire(REVIEW_ACTIONS.claim, reviewer);
    await context.fire(REVIEW_ACTIONS.reject, reviewer, {
      note: "Not a profile photo",
    });

    await context.drain();

    expect(context.imageStatus()).toBe("rejected");
    expect(await context.stage()).toBe(REVIEW_STAGES.rejected);
    const instance = await context.bench.getInstance({
      instanceId: context.instance._id,
    });
    expect(instance.fields.find((field) => field.name === "note")?.value).toBe(
      "Not a profile photo",
    );
  });

  it("returns to review with the decision cleared when core refuses the reviewer", async () => {
    const context = await setup({ reviewerIds: ["gSomeoneElse"] });
    await context.fire(REVIEW_ACTIONS.claim, reviewer);
    await context.fire(REVIEW_ACTIONS.approve, reviewer);

    await context.drain();

    expect(context.imageStatus()).toBe("review");
    expect(await context.stage()).toBe(REVIEW_STAGES.review);
    expect(
      await actionVerdict(context, REVIEW_ACTIONS.approve, reviewer),
    ).toMatchObject({ allowed: true });
  });

  it.each([
    ["review", [IMAGE_REVIEW_WORKFLOW]],
    ["ready", []],
    ["rejected", []],
  ])(
    "offers review as a start for an image in %s: %j",
    async (status, names) => {
      const context = await setup();

      const definitions = await context.bench.definitionsForDocument({
        document: { _id: "assetlake-image-x", _type: "assetLakeImage", status },
      });

      expect(definitions.map((definition) => definition.name)).toEqual(names);
    },
  );

  it("refuses a second open review of the same image", async () => {
    const context = await setup();

    await expect(
      context.bench.startInstance({
        definition: IMAGE_REVIEW_WORKFLOW,
        initialFields: [
          subjectField(context.image.id, { type: "assetLakeImage" }),
        ],
      }),
    ).rejects.toBeInstanceOf(StartNotAllowedError);
  });

  it("resumes the same instance when the same image is started twice by id", async () => {
    const context = await setup();
    const engine = createBenchEngine(context.bench);
    const other = { _id: "assetlake-image-other", _type: "assetLakeImage" };
    context.bench.seedDocuments([other]);

    const first = await startImageReview(engine, TARGET, other._id);
    const second = await startImageReview(engine, TARGET, other._id);

    expect(second._id).toBe(first._id);
    expect(first._id.startsWith("test.wf-instance.")).toBe(true);
  });
});
