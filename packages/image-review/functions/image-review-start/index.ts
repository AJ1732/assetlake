import { documentEventHandler } from "@sanity/functions";

import { createFunctionEngine } from "../../src/function-runtime";
import { startImageReview } from "../../src/start-review";

const FUNCTION_NAME = "image-review-start";

// Runs on create of an assetLakeImage in review (src/triggers.ts). The instance id is derived from
// the image id, so a redelivered event resumes the same start.
export const handler = documentEventHandler<{ _id: string }>(
  async ({ context, event }) => {
    const engine = createFunctionEngine(context.clientOptions, {
      executionId: FUNCTION_NAME,
    });
    const instance = await startImageReview(
      engine,
      context.clientOptions,
      event.data._id,
    );
    console.log(
      JSON.stringify({
        event: "IMAGE_REVIEW_STARTED",
        imageId: event.data._id,
        instanceId: instance._id,
        stage: instance.currentStage,
      }),
    );
  },
);
