import type { Engine, WorkflowInstance } from "@sanity/workflow-engine";

import { IMAGE_REVIEW_WORKFLOW } from "./image-review.workflow";
import {
  imageSubject,
  reviewInstanceId,
  type ReviewTarget,
} from "./review-target";

/** Idempotent: starting the same image twice resumes or returns the first start. */
export async function startImageReview(
  engine: Engine,
  target: ReviewTarget,
  imageId: string,
): Promise<WorkflowInstance> {
  const { instance } = await engine.startInstance({
    definition: IMAGE_REVIEW_WORKFLOW,
    instanceId: await reviewInstanceId(engine.tag, imageId),
    initialFields: [
      {
        type: "subject",
        name: "subject",
        value: imageSubject(target, imageId),
      },
    ],
  });
  return instance;
}
