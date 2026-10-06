import { describe, expect, it } from "vitest";

import { createFunctionEngine, parseReviewerIds } from "./function-runtime";

const OPTIONS = { projectId: "oshzwvjy", dataset: "production", token: "x" };

describe("parseReviewerIds", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseReviewerIds(" gA , gB,,")).toEqual(["gA", "gB"]);
  });

  it.each([undefined, "", " , "])(
    "fails loud on %j instead of running a drainer that refuses every decision",
    (raw) => {
      expect(() => parseReviewerIds(raw)).toThrow(
        "ASSETLAKE_REVIEWER_IDS is not set",
      );
    },
  );
});

describe("createFunctionEngine", () => {
  it("scopes the engine to the event's dataset and its tag", () => {
    const engine = createFunctionEngine(OPTIONS, {
      executionId: "image-review-start",
    });

    expect(engine.tag).toBe("production");
    expect(engine.workflowResource).toEqual({
      type: "dataset",
      id: "oshzwvjy.production",
    });
  });
});
