import { describe, expect, it } from "vitest";

import { reviewDeployments } from "./deployments";
import { imageReview } from "./image-review.workflow";

describe("reviewDeployments", () => {
  it("deploys the review workflow to production and test, each tagged by its dataset", () => {
    expect(reviewDeployments("oshzwvjy")).toEqual([
      {
        name: "production",
        tag: "production",
        workflowResource: { type: "dataset", id: "oshzwvjy.production" },
        expectedMinReaderModel: 10,
        definitions: [imageReview],
      },
      {
        name: "test",
        tag: "test",
        workflowResource: { type: "dataset", id: "oshzwvjy.test" },
        expectedMinReaderModel: 10,
        definitions: [imageReview],
      },
    ]);
  });
});
