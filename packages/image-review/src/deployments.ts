import type { WorkflowDeploymentInput } from "@sanity/workflow-engine";

import { imageReview } from "./image-review.workflow";
import { reviewDeployment } from "./review-target";

// A required subject needs reader model 10. Every runtime sharing these datasets (console, both
// Functions, the live eval, the CLI) pins @sanity/workflow-* 0.36.0, which reads model 10.
const READER_MODEL = 10;

const REVIEW_DATASETS = ["production", "test"] as const;

export function reviewDeployments(
  projectId: string,
): WorkflowDeploymentInput[] {
  return REVIEW_DATASETS.map((dataset) => ({
    name: dataset,
    ...reviewDeployment({ projectId, dataset }),
    expectedMinReaderModel: READER_MODEL,
    definitions: [imageReview],
  }));
}
