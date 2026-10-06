import type {
  WorkflowEvaluation,
  WorkflowInstance,
} from "@sanity/workflow-engine";
import { describe, expect, it } from "vitest";

import {
  CONFIDENTIALITY_NOTICE,
  pickQueuedRow,
  reviewActions,
  reviewerId,
  reviewerLabel,
  stageLabel,
} from "./review-view-models";

function evaluationWith(
  actions: Array<Record<string, unknown>>,
  activity = "review",
): WorkflowEvaluation {
  return {
    currentStage: { activities: [{ activity: { name: activity }, actions }] },
  } as unknown as WorkflowEvaluation;
}

const instanceWith = (fields: Array<{ name: string; value: unknown }>) =>
  ({ fields }) as unknown as WorkflowInstance;

describe("reviewActions", () => {
  it("shows claim before anyone holds the review and hides filtered-out decisions", () => {
    const evaluation = evaluationWith([
      { action: { name: "claim", title: "Take review" }, allowed: true },
      {
        action: { name: "approve", title: "Approve" },
        allowed: false,
        disabledReason: { kind: "filter-failed" },
      },
    ]);

    expect(reviewActions(evaluation)).toEqual([
      { name: "claim", title: "Take review", allowed: true, needsNote: false },
    ]);
  });

  it("marks reject as needing a note and skips automations and unknown actions", () => {
    const evaluation = evaluationWith([
      { action: { name: "approve", title: "Approve" }, allowed: true },
      {
        action: {
          name: "reject",
          title: "Reject",
          params: [{ type: "string", name: "note", required: true }],
        },
        allowed: true,
      },
      { action: { name: "reset" }, allowed: false, triggered: true },
      { action: { name: "escalate" }, allowed: true },
    ]);

    expect(reviewActions(evaluation)).toEqual([
      { name: "approve", title: "Approve", allowed: true, needsNote: false },
      { name: "reject", title: "Reject", allowed: true, needsNote: true },
    ]);
  });

  it("offers nothing outside the review activity, such as while applying", () => {
    expect(
      reviewActions(
        evaluationWith([{ action: { name: "run" }, allowed: true }], "apply"),
      ),
    ).toEqual([]);
  });
});

describe("reviewerId", () => {
  it("reads the reviewer the claim recorded", () => {
    const instance = instanceWith([
      { name: "reviewer", value: { kind: "person", id: "gReviewer1" } },
    ]);

    expect(reviewerId(instance)).toBe("gReviewer1");
  });

  it("reports an unclaimed review as nobody", () => {
    expect(reviewerId(instanceWith([]))).toBeNull();
  });
});

describe("pickQueuedRow", () => {
  const rows = [{ id: "a" }, { id: "b" }];

  it("keeps the chosen image while it is queued", () => {
    expect(pickQueuedRow(rows, "b")).toEqual({ id: "b" });
  });

  it("falls back to the oldest waiting image once the chosen one is decided", () => {
    expect(pickQueuedRow(rows, "gone")).toEqual({ id: "a" });
    expect(pickQueuedRow([], "gone")).toBeNull();
  });
});

describe("reviewerLabel", () => {
  it("says you, another reviewer's id, or nobody yet", () => {
    expect(reviewerLabel("gMe", "gMe")).toBe("you");
    expect(reviewerLabel("gOther", "gMe")).toBe("gOther");
    expect(reviewerLabel(null, "gMe")).toBe("nobody yet");
  });
});

describe("copy", () => {
  it("labels each stage in plain words", () => {
    expect(stageLabel("review")).toBe("Waiting for a decision");
    expect(stageLabel("applying")).toBe("Applying the decision");
  });

  // §16.1: the screen must say review is not privacy, on its face.
  it("states that review governs lifecycle, not confidentiality", () => {
    expect(CONFIDENTIALITY_NOTICE).toContain(
      "Review governs lifecycle, not confidentiality",
    );
    expect(CONFIDENTIALITY_NOTICE).toContain("already public");
  });
});
