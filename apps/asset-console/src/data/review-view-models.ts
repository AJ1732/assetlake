import {
  REVIEW_ACTIONS,
  REVIEW_ACTIVITY,
  REVIEW_STAGES,
} from "@assetlake/image-review";
import {
  type ActionEvaluation,
  actionRendering,
  type WorkflowEvaluation,
  type WorkflowInstance,
} from "@sanity/workflow-engine";

import { formatLabel } from "./format";

export const CONFIDENTIALITY_NOTICE =
  "Review governs lifecycle, not confidentiality. These images are already public at their cdn.sanity.io URLs. Rejecting one keeps it out of apps; it does not make it private.";

type ReviewActionName = (typeof REVIEW_ACTIONS)[keyof typeof REVIEW_ACTIONS];

export interface ReviewActionModel {
  name: ReviewActionName;
  title: string;
  allowed: boolean;
  needsNote: boolean;
}

const REVIEW_ACTION_NAMES = new Set<string>(Object.values(REVIEW_ACTIONS));

const STAGE_LABELS: Record<string, string> = {
  [REVIEW_STAGES.review]: "Waiting for a decision",
  [REVIEW_STAGES.applying]: "Applying the decision",
  [REVIEW_STAGES.approved]: "Approved",
  [REVIEW_STAGES.rejected]: "Rejected",
};

export const stageLabel = (stage: string) =>
  STAGE_LABELS[stage] ?? formatLabel(stage);

const isReviewAction = (
  evaluation: ActionEvaluation,
): evaluation is ActionEvaluation & {
  action: { name: ReviewActionName };
} => REVIEW_ACTION_NAMES.has(evaluation.action.name);

/**
 * The buttons to render: only review actions the evaluation shows as buttons. A filtered-out
 * action (approve before claiming) is absent, never a dead button.
 */
export function reviewActions(
  evaluation: WorkflowEvaluation,
): ReviewActionModel[] {
  const activity = evaluation.currentStage.activities.find(
    (candidate) => candidate.activity.name === REVIEW_ACTIVITY,
  );
  return (activity?.actions ?? [])
    .filter(isReviewAction)
    .filter((action) => actionRendering(action) === "button")
    .map((action) => ({
      name: action.action.name,
      title: action.action.title ?? formatLabel(action.action.name),
      allowed: action.allowed,
      needsNote: (action.action.params ?? []).some(
        (parameter) => parameter.name === "note" && parameter.required === true,
      ),
    }));
}

/** The account-global id the engine recorded when the review was claimed. */
export function reviewerId(instance: WorkflowInstance): string | null {
  const reviewer = instance.fields.find(
    (field) => field.name === "reviewer",
  )?.value;
  return reviewer && typeof reviewer === "object" && "id" in reviewer
    ? String(reviewer.id)
    : null;
}

/** The chosen row while it is still queued; otherwise the oldest waiting one. */
export function pickQueuedRow<Row extends { id: string }>(
  rows: readonly Row[],
  chosenId: string | null,
): Row | null {
  return rows.find((row) => row.id === chosenId) ?? rows[0] ?? null;
}

export function reviewerLabel(
  reviewer: string | null,
  currentUserId: string,
): string {
  if (!reviewer) return "nobody yet";
  return reviewer === currentUserId ? "you" : reviewer;
}
