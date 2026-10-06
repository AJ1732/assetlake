import { reviewDeployment } from "@assetlake/image-review";
import { useQuery } from "@sanity/sdk-react";
import { useWorkflowEngine } from "@sanity/workflow-sdk";

import { REVIEW_QUEUE_QUERY } from "../data/queries";
import type { ReviewQueueResult } from "../data/types";
import { SANITY_TARGET } from "../sanity-target";

const EMPTY_QUEUE: ReviewQueueResult = { pending: [], rejected: [] };
const DEPLOYMENT = reviewDeployment(SANITY_TARGET);

/** Live: an upload held for review appears, and a decided one leaves, without polling. */
export function useReviewQueue(): ReviewQueueResult {
  const { data } = useQuery<ReviewQueueResult | null>({
    query: REVIEW_QUEUE_QUERY,
  });
  return data ?? EMPTY_QUEUE;
}

/** The engine acts as the signed-in Dashboard user; its checks are advisory (see image-review). */
export function useReviewEngine() {
  return useWorkflowEngine(DEPLOYMENT);
}
