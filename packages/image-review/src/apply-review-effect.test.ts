import { AssetLakeError, type TransitionStatusInput } from "@assetlake/core";
import type {
  EffectHandlerContext,
  FieldOp,
  WorkflowClient,
} from "@sanity/workflow-engine";
import { describe, expect, it, vi } from "vitest";

import { createApplyReviewEffect } from "./apply-review-effect";

const SUBJECT = "dataset:test:test:assetlake-image-1";

function createContext() {
  const log = vi.fn();
  return {
    log,
    context: {
      log,
      effectKey: "effect-1",
    } as unknown as EffectHandlerContext<WorkflowClient>,
  };
}

function fakeImages(
  respond: (input: TransitionStatusInput) => Promise<unknown> = async (
    input,
  ) => ({ ...input, from: "review", outcome: "applied" }),
) {
  const transitionStatus = vi.fn(respond);
  return { images: { transitionStatus } as never, transitionStatus };
}

const outcomeOf = (result: unknown) =>
  ((result as { ops: FieldOp[] }).ops[0] as { value: { value: string } }).value
    .value;

describe("apply review effect", () => {
  it.each([
    ["approve", "ready"],
    ["reject", "rejected"],
  ])(
    "applies %s as status %s for the recorded reviewer",
    async (decision, to) => {
      const { images, transitionStatus } = fakeImages();
      const { context } = createContext();

      const result = await createApplyReviewEffect(images)(
        { subject: SUBJECT, decision, reviewer: "gReviewer1" },
        context,
      );

      expect(transitionStatus).toHaveBeenCalledWith({
        id: "assetlake-image-1",
        to,
        reviewer: { id: "gReviewer1" },
      });
      expect(result).toEqual({
        ops: [
          {
            type: "field.set",
            target: { scope: "stage", field: "outcome" },
            value: { type: "literal", value: "ok" },
          },
        ],
      });
    },
  );

  it("accepts a bare image id as the subject", async () => {
    const { images, transitionStatus } = fakeImages();

    await createApplyReviewEffect(images)(
      { subject: "assetlake-image-1", decision: "approve", reviewer: "g1" },
      createContext().context,
    );

    expect(transitionStatus.mock.calls[0]?.[0].id).toBe("assetlake-image-1");
  });

  it("treats a repeated decision that core reports unchanged as ok", async () => {
    const { images } = fakeImages(async (input) => ({
      ...input,
      from: "ready",
      outcome: "unchanged",
    }));

    const result = await createApplyReviewEffect(images)(
      { subject: SUBJECT, decision: "approve", reviewer: "g1" },
      createContext().context,
    );

    expect(outcomeOf(result)).toBe("ok");
  });

  it("records a refusal from core as failed, logs its code, and does not throw", async () => {
    const { images } = fakeImages(async () => {
      throw new AssetLakeError("FORBIDDEN", "This reviewer may not review.");
    });
    const { context, log } = createContext();

    const result = await createApplyReviewEffect(images)(
      { subject: SUBJECT, decision: "reject", reviewer: "g1" },
      context,
    );

    expect(outcomeOf(result)).toBe("failed");
    expect(log).toHaveBeenCalledWith("Apply review: refused", {
      imageId: "assetlake-image-1",
      code: "FORBIDDEN",
    });
  });

  it.each([
    [{ subject: SUBJECT, decision: "maybe", reviewer: "g1" }],
    [{ subject: SUBJECT, decision: "approve" }],
    [{ decision: "approve", reviewer: "g1" }],
  ])(
    "fails without calling core when parameters are malformed: %o",
    async (params) => {
      const { images, transitionStatus } = fakeImages();

      const result = await createApplyReviewEffect(images)(
        params,
        createContext().context,
      );

      expect(outcomeOf(result)).toBe("failed");
      expect(transitionStatus).not.toHaveBeenCalled();
    },
  );
});
