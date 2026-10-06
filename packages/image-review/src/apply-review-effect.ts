import {
  type AssetLake,
  isAssetLakeError,
  type ReviewOutcomeStatus,
} from "@assetlake/core";
import {
  type EffectHandler,
  type FieldOp,
  tryParseGdr,
} from "@sanity/workflow-engine";

import type { ApplyOutcome, ReviewDecision } from "./image-review.workflow";

const STATUS_FOR_DECISION: Record<ReviewDecision, ReviewOutcomeStatus> = {
  approve: "ready",
  reject: "rejected",
};

export type ImageTransitions = Pick<AssetLake["images"], "transitionStatus">;

interface ApplyReviewRequest {
  imageId: string;
  status: ReviewOutcomeStatus;
  reviewerId: string;
}

const isDecision = (value: unknown): value is ReviewDecision =>
  typeof value === "string" && Object.hasOwn(STATUS_FOR_DECISION, value);

// Bindings hold the subject as a GDR URI; a bare id is accepted so a hand-fired effect still works.
function toImageId(subject: unknown): string | null {
  if (typeof subject !== "string" || subject === "") return null;
  return tryParseGdr(subject)?.documentId ?? subject;
}

function readRequest(
  params: Record<string, unknown>,
): ApplyReviewRequest | null {
  const imageId = toImageId(params.subject);
  const { decision, reviewer } = params;
  if (!imageId || !isDecision(decision) || typeof reviewer !== "string")
    return null;
  return {
    imageId,
    status: STATUS_FOR_DECISION[decision],
    reviewerId: reviewer,
  };
}

const outcomeOp = (outcome: ApplyOutcome): FieldOp => ({
  type: "field.set",
  target: { scope: "stage", field: "outcome" },
  value: { type: "literal", value: outcome },
});

/**
 * Applies a committed review decision through core, which re-checks the reviewer and the status.
 * Never throws: a refusal is recorded as outcome "failed", which sends the instance back to review
 * instead of leaving it stuck in applying.
 */
export function createApplyReviewEffect(
  images: ImageTransitions,
): EffectHandler {
  return async (params, context) => {
    const request = readRequest(params);
    if (!request) {
      context.log("Apply review: malformed effect parameters", {
        keys: Object.keys(params),
      });
      return { ops: [outcomeOp("failed")] };
    }
    try {
      const transition = await images.transitionStatus({
        id: request.imageId,
        to: request.status,
        reviewer: { id: request.reviewerId },
      });
      context.log("Apply review: done", {
        imageId: transition.id,
        to: transition.to,
        outcome: transition.outcome,
      });
      return { ops: [outcomeOp("ok")] };
    } catch (error) {
      context.log("Apply review: refused", {
        imageId: request.imageId,
        code: isAssetLakeError(error) ? error.code : "UNEXPECTED",
      });
      return { ops: [outcomeOp("failed")] };
    }
  };
}
