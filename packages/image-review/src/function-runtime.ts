import { createAssetLake } from "@assetlake/core";
import { DEFAULT_API_VERSION } from "@assetlake/sanity-schema/project";
import { createClient } from "@sanity/client";
import {
  createEngine,
  type EffectHandler,
  type Engine,
  ENGINE_API_VERSION,
} from "@sanity/workflow-engine";

import { createApplyReviewEffect } from "./apply-review-effect";
import { APPLY_REVIEW_EFFECT } from "./image-review.workflow";
import { reviewDeployment, type ReviewTarget } from "./review-target";

export const REVIEWER_IDS_VARIABLE = "ASSETLAKE_REVIEWER_IDS";

/** Comma-separated Sanity user ids. Empty fails loud: a drainer with no reviewers refuses all. */
export function parseReviewerIds(raw: string | undefined): string[] {
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new Error(`${REVIEWER_IDS_VARIABLE} is not set`);
  return ids;
}

export interface FunctionClientOptions extends ReviewTarget {
  token: string;
  apiHost?: string;
}

/**
 * The engine a Function runs, acting with the Blueprint's robot token. Only the drainer passes
 * reviewer ids; the start Function never applies a decision, so it registers no handler.
 */
export function createFunctionEngine(
  options: FunctionClientOptions,
  { executionId, reviewerIds }: { executionId: string; reviewerIds?: string[] },
): Engine {
  const { projectId, dataset, token } = options;
  const client = createClient({
    ...options,
    apiVersion: ENGINE_API_VERSION,
    perspective: "raw",
    useCdn: false,
  });
  const handlers: Record<string, EffectHandler> = reviewerIds
    ? {
        [APPLY_REVIEW_EFFECT]: createApplyReviewEffect(
          createAssetLake({
            projectId,
            dataset,
            apiVersion: DEFAULT_API_VERSION,
            token,
            review: { reviewerIds },
          }).images,
        ),
      }
    : {};

  return createEngine({
    client,
    ...reviewDeployment({ projectId, dataset }),
    executionContext: {
      kind: reviewerIds ? "drainer" : "server",
      id: executionId,
    },
    effects: { handlers, missingHandler: "skip" },
  });
}
