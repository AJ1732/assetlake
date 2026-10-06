import { documentEventHandler } from "@sanity/functions";

import {
  createFunctionEngine,
  parseReviewerIds,
  REVIEWER_IDS_VARIABLE,
} from "../../src/function-runtime";

const FUNCTION_NAME = "image-review-drain";

// Woken when an instance gains unclaimed effects (src/triggers.ts). One drain runs every effect
// this engine has a handler for, including any the decision queues while it runs.
export const handler = documentEventHandler<{ _id: string }>(
  async ({ context, event }) => {
    const engine = createFunctionEngine(context.clientOptions, {
      executionId: FUNCTION_NAME,
      reviewerIds: parseReviewerIds(process.env[REVIEWER_IDS_VARIABLE]),
    });
    const result = await engine.drainEffects({ instanceId: event.data._id });
    console.log(
      JSON.stringify({
        event: "IMAGE_REVIEW_DRAINED",
        instanceId: event.data._id,
        drained: result.drained.length,
        failed: result.failed.length,
        lost: result.lost.length,
      }),
    );
  },
);
