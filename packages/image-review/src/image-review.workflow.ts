import { DOCUMENT_TYPES } from "@assetlake/core/contracts";
import {
  defineAction,
  defineActivity,
  defineField,
  defineStage,
  defineTransition,
  defineWorkflow,
} from "@sanity/workflow-engine/define";

export const IMAGE_REVIEW_WORKFLOW = "assetlake-image-review";
export const APPLY_REVIEW_EFFECT = "assetlake.apply-review";

export const REVIEW_STAGES = {
  review: "review",
  applying: "applying",
  approved: "approved",
  rejected: "rejected",
} as const;

export const REVIEW_ACTIVITY = "review";
export const REVIEW_ACTIONS = {
  claim: "claim",
  approve: "approve",
  reject: "reject",
} as const;

export type ReviewDecision = "approve" | "reject";
export type ApplyOutcome = "ok" | "failed";

const decide = (decision: ReviewDecision) => [
  {
    type: "field.set" as const,
    target: { field: "decision" },
    value: { type: "literal" as const, value: decision },
  },
];

const decided = (decision: ReviewDecision) =>
  `$allActivitiesDone && $fields.outcome == 'ok' && $fields.decision == '${decision}'`;

/**
 * Review (claim, then approve or reject) -> applying (the drainer calls core's transitionStatus)
 * -> approved | rejected. Every check here is advisory: transitionStatus is the enforcement point.
 */
export const imageReview = defineWorkflow({
  name: IMAGE_REVIEW_WORKFLOW,
  title: "AssetLake image review",
  description:
    "Decides whether an uploaded image becomes ready for apps. Review governs lifecycle, not confidentiality: the asset URL is already public.",
  initialStage: REVIEW_STAGES.review,
  start: {
    kind: "autonomous",
    // Only held images are candidates, so start pickers and any generated watcher agree with the
    // start Function's filter (src/triggers.ts).
    filter: 'status == "review"',
    requirements: [
      {
        type: "singleSubject",
        name: "one-open-review",
        title: "This image is already under review",
      },
    ],
  },
  fields: [
    defineField({
      type: "subject",
      name: "subject",
      title: "Image",
      types: [DOCUMENT_TYPES.image],
      required: true,
      initialValue: { type: "input" },
    }),
    defineField({ type: "actor", name: "reviewer", title: "Reviewer" }),
    defineField({ type: "string", name: "decision", title: "Decision" }),
    defineField({ type: "string", name: "note", title: "Rejection note" }),
  ],
  stages: [
    defineStage({
      name: REVIEW_STAGES.review,
      title: "Review",
      activities: [
        defineActivity({
          name: REVIEW_ACTIVITY,
          title: "Review image",
          actions: [
            // Coming back after a failed apply must not replay the old decision straight back out.
            defineAction({
              name: "reset",
              when: "true",
              ops: [{ type: "field.unset", target: { field: "decision" } }],
            }),
            defineAction({
              name: REVIEW_ACTIONS.claim,
              title: "Take review",
              filter: "!defined($fields.reviewer)",
              ops: [
                {
                  type: "field.set",
                  target: { field: "reviewer" },
                  value: { type: "actor" },
                },
              ],
            }),
            defineAction({
              name: REVIEW_ACTIONS.approve,
              title: "Approve",
              semantics: ["decision.accept"],
              status: "done",
              filter: "$fields.reviewer.id == $actor.id",
              ops: decide("approve"),
            }),
            defineAction({
              name: REVIEW_ACTIONS.reject,
              title: "Reject",
              semantics: ["decision.decline"],
              status: "done",
              filter: "$fields.reviewer.id == $actor.id",
              params: [
                {
                  type: "string",
                  name: "note",
                  title: "Why is it rejected?",
                  required: true,
                },
              ],
              ops: [
                ...decide("reject"),
                {
                  type: "field.set",
                  target: { field: "note" },
                  value: { type: "param", param: "note" },
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: "to-applying",
          to: REVIEW_STAGES.applying,
          when: "$allActivitiesDone && defined($fields.decision)",
        }),
      ],
    }),
    defineStage({
      name: REVIEW_STAGES.applying,
      title: "Applying decision",
      fields: [defineField({ type: "string", name: "outcome" })],
      activities: [
        defineActivity({
          name: "apply",
          title: "Apply decision to the image",
          actions: [
            defineAction({
              name: "run",
              when: "true",
              effects: [
                {
                  name: APPLY_REVIEW_EFFECT,
                  bindings: {
                    subject: "$fields.subject._id",
                    decision: "$fields.decision",
                    reviewer: "$fields.reviewer.id",
                  },
                },
              ],
            }),
            defineAction({
              name: "finished",
              status: "done",
              when: `$effectStatus['${APPLY_REVIEW_EFFECT}'] == 'done' && defined($fields.outcome)`,
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: "to-approved",
          to: REVIEW_STAGES.approved,
          when: decided("approve"),
        }),
        defineTransition({
          name: "to-rejected",
          to: REVIEW_STAGES.rejected,
          when: decided("reject"),
        }),
        defineTransition({
          name: "back-to-review",
          to: REVIEW_STAGES.review,
          when: `($allActivitiesDone && $fields.outcome == 'failed') || $effectStatus['${APPLY_REVIEW_EFFECT}'] == 'failed'`,
        }),
      ],
    }),
    defineStage({ name: REVIEW_STAGES.approved, title: "Approved" }),
    defineStage({ name: REVIEW_STAGES.rejected, title: "Rejected" }),
  ],
});
